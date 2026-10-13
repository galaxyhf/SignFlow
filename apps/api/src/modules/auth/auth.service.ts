import {
  Inject,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { hash, verify, argon2id } from "argon2";
import { Database, Queryable } from "../../database/database";
import { AuditService } from "../audit/audit.service";
import { SettingsService } from "../settings/settings.service";
import { token, sha256, equal } from "../../common/crypto";
import {
  loginSchema,
  userSchema,
  registerSchema,
  passwordSchema,
  Permission,
} from "@signflow/shared";
export type Actor = {
  id: string;
  name: string;
  login: string;
  role: string;
  permissions: Permission[];
};
export const hashPassword = (password: string) =>
  hash(password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
@Injectable()
export class AuthService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(AuditService) private audit: AuditService,
    @Inject(SettingsService) private settings: SettingsService,
  ) {}
  async rate(key: string, limit = 30, seconds = 60) {
    const r = (
      await this.db.query<{ count: number }>(
        "INSERT INTO rate_limits(key,count,reset_at) VALUES($1,1,now()+($2::int * interval '1 second')) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<now() THEN 1 ELSE rate_limits.count+1 END,reset_at=CASE WHEN rate_limits.reset_at<now() THEN excluded.reset_at ELSE rate_limits.reset_at END RETURNING count",
        [sha256(key), seconds],
      )
    ).rows[0];
    if (r.count > limit)
      throw new ForbiddenException(
        "Limite de tentativas atingido. Aguarde antes de tentar novamente.",
      );
  }
  async actor(tx: Queryable, id: string) {
    const u = (
      await tx.query<{ id: string; name: string; login: string; role: string }>(
        "SELECT u.id,u.name,u.login,r.role FROM users u JOIN user_roles r ON r.user_id=u.id WHERE u.id=$1 AND u.active=true",
        [id],
      )
    ).rows[0];
    if (!u) throw new UnauthorizedException("Sessão inválida");
    const p = (
      await tx.query<{ permission: Permission }>(
        "SELECT permission FROM role_permissions WHERE role=$1 UNION SELECT permission FROM user_permissions WHERE user_id=$2",
        [u.role, u.id],
      )
    ).rows.map((r) => r.permission);
    return { ...u, permissions: p };
  }
  async login(input: unknown, ip: string) {
    const body = loginSchema.parse(input);
    const settings = await this.settings.get();
    await this.rate(`login:ip:${ip}`, settings.loginAttempts * 4, 900);
    await this.rate(`login:user:${body.login}`, settings.loginAttempts, 900);
    const u = (
      await this.db.query<{
        id: string;
        password_hash: string;
        active: boolean;
      }>("SELECT id,password_hash,active FROM users WHERE login=$1", [
        body.login,
      ])
    ).rows[0];
    const fallback =
      "$argon2id$v=19$m=19456,t=2,p=1$MDEyMzQ1Njc4OWFiY2RlZg$QOgWLJXdrzuCaIvAOjRfM9TjrbVkJJfmSkBtOkYu01M";
    let valid = false;
    try {
      valid = await verify(u?.password_hash ?? fallback, body.password);
    } catch {
      valid = false;
    }
    if (!u || !u.active || !valid) {
      await this.db.transaction((tx) =>
        this.audit.append(tx, "auth.login_failed", null, null, {
          accountHash: sha256(body.login),
        }),
      );
      throw new UnauthorizedException("Login ou senha inválidos");
    }
    const sessionToken = token(),
      csrf = token();
    const expires = new Date(Date.now() + settings.sessionHours * 3600000);
    await this.db.transaction(async (tx) => {
      await tx.query(
        "INSERT INTO sessions(user_id,token_hash,csrf_hash,expires_at) VALUES($1,$2,$3,$4)",
        [u.id, sha256(sessionToken), sha256(csrf), expires],
      );
      await this.audit.append(tx, "auth.login", u.id, u.id);
    });
    return {
      sessionToken,
      csrf,
      expires,
      user: await this.actor(this.db, u.id),
    };
  }
  async authenticate(sessionToken?: string, csrf?: string, mutation = false) {
    if (!sessionToken)
      throw new UnauthorizedException("Faça login para continuar");
    const s = (
      await this.db.query<{ user_id: string; csrf_hash: string }>(
        "SELECT user_id,csrf_hash FROM sessions WHERE token_hash=$1 AND expires_at>now() AND revoked_at IS NULL",
        [sha256(sessionToken)],
      )
    ).rows[0];
    if (!s) throw new UnauthorizedException("Sessão expirada");
    if (mutation && (!csrf || !equal(s.csrf_hash, sha256(csrf))))
      throw new ForbiddenException("Verificação CSRF inválida");
    return this.actor(this.db, s.user_id);
  }
  async logout(sessionToken: string, actor: Actor) {
    await this.db.transaction(async (tx) => {
      await tx.query(
        "UPDATE sessions SET revoked_at=now() WHERE token_hash=$1",
        [sha256(sessionToken)],
      );
      await this.audit.append(tx, "auth.logout", actor.id, actor.id);
    });
  }
  async changePassword(actor: Actor, current: string, next: string) {
    passwordSchema.parse(next);
    const u = (
      await this.db.query<{ password_hash: string }>(
        "SELECT password_hash FROM users WHERE id=$1",
        [actor.id],
      )
    ).rows[0];
    if (!(await verify(u.password_hash, current)))
      throw new UnauthorizedException("Senha atual inválida");
    const passwordHash = await hashPassword(next);
    await this.db.transaction(async (tx) => {
      await tx.query(
        "UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1",
        [actor.id, passwordHash],
      );
      await tx.query("UPDATE sessions SET revoked_at=now() WHERE user_id=$1", [
        actor.id,
      ]);
      await this.audit.append(tx, "auth.password_changed", actor.id, actor.id);
    });
  }
  async register(input: unknown, ip: string) {
    const body = registerSchema.parse(input);
    await this.rate(`register:ip:${ip}`, 5, 3600);
    return this.createUser(
      { ...body, role: "employee", active: true, permissions: [] },
      null,
      false,
    );
  }
  async createUser(
    input: unknown,
    actorId: string | null,
    provisionFirstAdmin = actorId === null,
  ) {
    const u = userSchema.parse(input),
      passwordHash = await hashPassword(u.password);
    return this.db.transaction(async (tx) => {
      if (provisionFirstAdmin) {
        await tx.query("SELECT pg_advisory_xact_lock(718292)");
        const existing = (
          await tx.query(
            "SELECT u.id FROM users u JOIN user_roles r ON r.user_id=u.id WHERE r.role='admin' LIMIT 1",
          )
        ).rows[0];
        if (existing)
          throw new BadRequestException("Administrador já provisionado");
      }

      const row = (
        await tx.query<{ id: string }>(
          "INSERT INTO users(name,login,password_hash,active) VALUES($1,$2,$3,$4) RETURNING id",
          [u.name, u.login, passwordHash, u.active],
        )
      ).rows[0];
      await tx.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [
        row.id,
        u.role,
      ]);
      for (const p of u.permissions)
        await tx.query(
          "INSERT INTO user_permissions(user_id,permission) VALUES($1,$2)",
          [row.id, p],
        );
      await this.audit.append(
        tx,
        actorId === null && u.role === "employee"
          ? "auth.registered"
          : "users.created",
        row.id,
        actorId,
        {
          role: u.role,
        },
      );
      return row;
    });
  }
}
