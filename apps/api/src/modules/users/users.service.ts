import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { roles, permissions } from "@signflow/shared";
import { Database } from "../../database/database";
import { AuditService } from "../audit/audit.service";
@Injectable()
export class UsersService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(AuditService) private audit: AuditService,
  ) {}
  async update(id: string, body: unknown, actorId: string) {
    const b = z
      .object({
        name: z.string().min(2).max(255),
        active: z.boolean(),
        role: z.enum(roles),
        permissions: z.array(z.enum(permissions)).default([]),
      })
      .parse(body);
    if (
      b.role === "auditor" &&
      b.permissions.some((p) => p !== "read" && p !== "audit.read")
    )
      throw new BadRequestException("Auditor só pode consultar");
    if (id === actorId && (!b.active || b.role !== "admin"))
      throw new BadRequestException(
        "Você não pode remover seu próprio acesso administrativo",
      );
    await this.db.transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(718292)");
      if (!(await tx.query("SELECT id FROM users WHERE id=$1", [id])).rows[0])
        throw new NotFoundException("Funcionário não encontrado");
      await tx.query(
        "UPDATE users SET name=$2,active=$3,updated_at=now() WHERE id=$1",
        [id, b.name, b.active],
      );
      await tx.query("UPDATE user_roles SET role=$2 WHERE user_id=$1", [
        id,
        b.role,
      ]);
      await tx.query("DELETE FROM user_permissions WHERE user_id=$1", [id]);
      for (const p of b.permissions)
        await tx.query(
          "INSERT INTO user_permissions(user_id,permission) VALUES($1,$2)",
          [id, p],
        );
      await tx.query("UPDATE sessions SET revoked_at=now() WHERE user_id=$1", [
        id,
      ]);
      await this.audit.append(tx, "users.updated", id, actorId, {
        active: b.active,
        role: b.role,
      });
    });
    return { success: true };
  }
}
