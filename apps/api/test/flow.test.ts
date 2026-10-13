import "reflect-metadata";
import { AsyncLocalStorage } from "node:async_hooks";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PDFDocument, degrees } from "pdf-lib";
import { PNG } from "pngjs";
import { Database, Queryable } from "../src/database/database";
import { ObjectStorage } from "../src/modules/storage/storage.service";
import { AuditService } from "../src/modules/audit/audit.service";
import { SettingsService } from "../src/modules/settings/settings.service";
import { promoteInitialAdmin } from "../src/modules/auth/promote-admin.cli";
import { AuthService } from "../src/modules/auth/auth.service";
import { ClientsService } from "../src/modules/clients/clients.service";
import { FilesService } from "../src/modules/documents/files.service";
import {
  PdfService,
  fieldRect,
  fieldPlacement,
} from "../src/modules/pdf/pdf.service";
import { TemplatesService } from "../src/modules/templates/templates.service";
import { DocumentsRepository } from "../src/modules/documents/documents.repository";
import { DocumentsService } from "../src/modules/documents/documents.service";
import { SigningService } from "../src/modules/signing/signing.service";
import { ReviewsService } from "../src/modules/documents/reviews.service";
import { JobsService } from "../src/modules/jobs/jobs.service";
import { AuthGuard } from "../src/common/auth.guard";
import { Reflector } from "@nestjs/core";
import { ExecutionContext } from "@nestjs/common";
import {
  Field,
  validTaxId,
  canTransition,
  validateValues,
  rolePermissions,
} from "@signflow/shared";
import { sha256 } from "../src/common/crypto";
class TestStorage extends ObjectStorage {
  objects = new Map<string, Uint8Array>();
  fail = false;
  async put(key: string, bytes: Uint8Array) {
    if (this.fail) throw new Error("Storage unavailable");
    this.objects.set(key, bytes.slice());
  }
  async get(key: string) {
    const b = this.objects.get(key);
    if (!b) throw new Error("Not found");
    return b;
  }
}
let pg: PGlite,
  db: Database,
  audit: AuditService,
  settings: SettingsService,
  auth: AuthService,
  clients: ClientsService,
  files: FilesService,
  templates: TemplatesService,
  repo: DocumentsRepository,
  documents: DocumentsService,
  signing: SigningService,
  jobs: JobsService;
const storage = new TestStorage(),
  pdf = new PdfService();
let admin: string, clientId: string, versionId: string, bytes: Uint8Array;
const signature = () => {
  const png = new PNG({ width: 300, height: 100 });
  for (let x = 20; x < 250; x++)
    for (let y = 40; y < 43; y++) {
      const i = (y * 300 + x) * 4;
      png.data[i] = 20;
      png.data[i + 1] = 20;
      png.data[i + 2] = 20;
      png.data[i + 3] = 255;
    }
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
};
const field: Field = {
  id: randomUUID(),
  name: "assinatura",
  label: "Assinatura",
  type: "signature",
  page: 0,
  x: 0.1,
  y: 0.6,
  width: 0.5,
  height: 0.2,
  required: true,
  actor: "signer",
  defaultValue: "",
  options: [],
  validation: {},
};
async function request() {
  const r = await documents.create(
    {
      title: "Autorização de teste",
      clientId,
      templateVersionId: versionId,
      expectedName: "Signatário de teste",
      description: "Teste",
      ticket: "TEST-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      internalValues: {},
    },
    admin,
  );
  return { ...r, token: r.link.split("/").pop()! };
}
async function prepared(token: string) {
  return signing.prepare(token, {
    name: "Signatário declarado",
    cpf: "",
    values: {},
    signature: signature(),
  });
}
beforeAll(async () => {
  process.env.EVIDENCE_SECRET = "unit-test-secret".repeat(4);
  process.env.JOB_SECRET = "job-test-secret".repeat(4);
  pg = new PGlite();
  await pg.exec(
    (await readFile("apps/api/drizzle/0000_fast_dust.sql", "utf8")).replaceAll(
      "--> statement-breakpoint",
      "",
    ),
  );
  const scope = new AsyncLocalStorage<Queryable>();
  const adapter: Queryable & {
    transaction: <T>(fn: (t: Queryable) => Promise<T>) => Promise<T>;
  } = {
    query: async <T extends Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ) => {
      const current = scope.getStore();
      if (current) return current.query<T>(sql, params);
      const r = await pg.query<T>(sql, params);
      return { rows: r.rows };
    },
    transaction: (fn) =>
      pg.transaction((tx) => {
        const q: Queryable = {
          query: async <T extends Record<string, unknown>>(
            sql: string,
            params: unknown[] = [],
          ) => ({ rows: (await tx.query<T>(sql, params)).rows }),
        };
        return scope.run(q, () => fn(q));
      }),
  };
  db = adapter as Database;
  audit = new AuditService();
  settings = new SettingsService(db, audit);
  auth = new AuthService(db, audit, settings);
  clients = new ClientsService(db, audit);
  files = new FilesService(db, storage, pdf, audit, settings);
  templates = new TemplatesService(db, files, audit);
  repo = new DocumentsRepository(db, audit);
  documents = new DocumentsService(
    db,
    repo,
    templates,
    files,
    storage,
    pdf,
    audit,
    settings,
  );
  signing = new SigningService(db, repo, files, pdf, audit, settings);
  jobs = new JobsService(db, repo, files, storage, pdf, audit);
  admin = (
    await auth.createUser(
      {
        name: "Administrador teste",
        login: "admin-test",
        password: "Test-password-123!",
        role: "admin",
      },
      null,
    )
  ).id;
  clientId = String(
    (
      await clients.save(
        { name: "Cliente teste", taxId: "52998224725", internalCode: "TEST" },
        admin,
      )
    ).id,
  );
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  doc.addPage([595, 842]);
  bytes = await doc.save();
  const uploaded = await files.upload(bytes, admin);
  const t = await templates.publish(
    { name: "Modelo teste", fileId: uploaded.id, fields: [field] },
    admin,
  );
  versionId = t.version.id;
});
afterAll(async () => {
  await pg?.close();
});
describe("Regras e segurança", () => {
  it("valida CPF/CNPJ e rejeita repetições", () => {
    expect(validTaxId("529.982.247-25")).toBe(true);
    expect(validTaxId("11.222.333/0001-81")).toBe(true);
    expect(validTaxId("00000000000")).toBe(false);
  });
  it("calcula posição normalizada com origem invertida do PDF", () => {
    expect(fieldRect(field, 100, 200)).toEqual({
      x: 10,
      y: 40,
      width: 50,
      height: 40,
    });
  });
  it("posiciona campos em páginas rotacionadas e com cropbox", async () => {
    const doc = await PDFDocument.create(),
      p = doc.addPage([200, 300]);
    p.setCropBox(10, 20, 100, 200);
    p.setRotation(degrees(90));
    const r = fieldPlacement(field, p);
    expect(r.x).toBeCloseTo(90);
    expect(r.y).toBeCloseTo(40);
    expect(r.width).toBeCloseTo(100);
    expect(r.height).toBeCloseTo(20);
    p.setRotation(degrees(180));
    expect(fieldPlacement(field, p).x).toBeCloseTo(100);
    p.setRotation(degrees(270));
    expect(fieldPlacement(field, p).y).toBeCloseTo(200);
  });
  it("comprovante longo preserva todo o conteúdo em novas páginas", async () => {
    const source = await PDFDocument.create();
    source.addPage();
    const final = await pdf.fill(await source.save(), [], {}, undefined, {
      Concordância: "Texto de concordância ".repeat(500),
    });
    expect((await PDFDocument.load(final)).getPageCount()).toBeGreaterThan(2);
  });
  it("controla transições e isolamento do auditor", () => {
    expect(canTransition("signed", "reviewed")).toBe(true);
    expect(canTransition("reviewed", "pending")).toBe(false);
    expect(rolePermissions.auditor.includes("requests.write")).toBe(false);
  });
  it("valida campos obrigatórios e impede preencher campos internos", () => {
    const f = { ...field, type: "text" as const, actor: "employee" as const };
    expect(() => validateValues([f], { [f.id]: "invadido" }, "signer")).toThrow(
      "não autorizado",
    );
    expect(() => validateValues([f], {}, "employee")).toThrow("obrigatório");
  });
  it("rejeita arquivos não PDF e assinatura vazia", async () => {
    await expect(
      pdf.inspect(Buffer.from("arquivo inválido")),
    ).rejects.toThrow();
    const blank = new PNG({ width: 300, height: 100 });
    await expect(
      pdf.validateSignature(
        `data:image/png;base64,${PNG.sync.write(blank).toString("base64")}`,
      ),
    ).rejects.toThrow("não vazia");
  });
  it("impede duplicidade de clientes", async () => {
    await expect(
      clients.save(
        { name: "Duplicado", taxId: "52998224725", internalCode: "DUP" },
        admin,
      ),
    ).rejects.toThrow();
  });
  it("autentica, valida CSRF, expira e revoga sessões", async () => {
    await expect(
      auth.login({ login: "admin-test", password: "wrong" }, "test"),
    ).rejects.toThrow();
    const login = await auth.login(
      { login: "admin-test", password: "Test-password-123!" },
      "test",
    );
    expect(login.user.role).toBe("admin");
    await expect(
      auth.authenticate(login.sessionToken, "incorrect", true),
    ).rejects.toThrow("CSRF");
    await db.query(
      "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
      [sha256(login.sessionToken)],
    );
    await expect(auth.authenticate(login.sessionToken)).rejects.toThrow(
      "expirada",
    );
    const next = await auth.login(
      { login: "admin-test", password: "Test-password-123!" },
      "test",
    );
    await auth.logout(next.sessionToken, next.user);
    await expect(auth.authenticate(next.sessionToken)).rejects.toThrow();
  });
  it("backend bloqueia auditor em mutações mesmo com CSRF válido", async () => {
    await auth.createUser(
      {
        name: "Auditor",
        login: "auditor-test",
        password: "Test-password-123!",
        role: "auditor",
      },
      admin,
    );
    const session = await auth.login(
      { login: "auditor-test", password: "Test-password-123!" },
      "auditor-ip",
    );
    const reflector = {
      getAllAndOverride: (key: string) =>
        key === "permission" ? "clients.write" : false,
    } as Reflector;
    const guard = new AuthGuard(auth, reflector);
    const req = {
      method: "POST",
      headers: { origin: "http://127.0.0.1:3000" },
      ip: "auditor-ip",
      cookies: { sf_session: session.sessionToken },
      header: () => session.csrf,
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => null,
      getClass: () => null,
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).rejects.toThrow("permissão");
  });
});
describe("Fluxo integrado com PostgreSQL embarcado", () => {
  it("preserva versões e impede editar auditoria", async () => {
    await expect(
      db.query("UPDATE template_versions SET version=2 WHERE id=$1", [
        versionId,
      ]),
    ).rejects.toThrow("imutável");
    await expect(db.query("DELETE FROM audit_events")).rejects.toThrow(
      "imutável",
    );
  });
  it("gera token, prepara, confirma, processa e preserva PDF/evidências", async () => {
    const r = await request();
    const record = await repo.get(r.id);
    expect(record.token_hash).toBe(sha256(r.token));
    expect((await signing.open(r.token)).status).toBe("viewed");
    const p = await prepared(r.token);
    const body = {
      preparationId: p.preparationId,
      idempotencyKey: randomUUID(),
      accepted: true,
      consentVersion: p.consentVersion,
    };
    const accepted = await signing.confirm(
      r.token,
      body,
      "127.0.0.1",
      "vitest",
    );
    await expect(
      signing.confirm(
        r.token,
        { ...body, idempotencyKey: randomUUID() },
        "ip",
        "ua",
      ),
    ).rejects.toThrow("já recebeu");
    expect((await signing.confirm(r.token, body, "ip", "ua")).id).toBe(
      accepted.id,
    );
    expect(await jobs.runOne(String(accepted.id))).toEqual({
      processed: true,
      status: "signed",
    });
    const details = await documents.details(r.id);
    expect(details.status).toBe("signed");
    const final = await signing.file(r.token, "signed");
    expect((await PDFDocument.load(final)).getPageCount()).toBe(3);
    expect(details.evidence).toBeTruthy();
    expect(await files.bytes(record.original_file_id)).toEqual(bytes);
    expect((await audit.verify(db)).valid).toBe(true);
    expect(
      (
        await db.query(
          "SELECT count(*)::int n FROM signatures WHERE request_id=$1",
          [r.id],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("submissões concorrentes com mesma chave produzem uma assinatura", async () => {
    const r = await request(),
      p = await prepared(r.token),
      body = {
        preparationId: p.preparationId,
        idempotencyKey: randomUUID(),
        accepted: true,
        consentVersion: p.consentVersion,
      };
    const results = await Promise.all([
      signing.confirm(r.token, body, "ip", "ua"),
      signing.confirm(r.token, body, "ip", "ua"),
    ]);
    expect(results[0].id).toBe(results[1].id);
    expect(
      (
        await db.query(
          "SELECT count(*)::int n FROM signatures WHERE request_id=$1",
          [r.id],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("expira e revoga links", async () => {
    const r = await request();
    await db.query(
      "UPDATE signature_requests SET expires_at=now()-interval '1 second' WHERE id=$1",
      [r.id],
    );
    await expect(signing.open(r.token)).rejects.toThrow("expirado");
    const next = await request();
    await documents.action(next.id, "revoke", admin);
    await expect(signing.open(next.token)).rejects.toThrow("revogado");
  });
  it("falha de storage não conclui assinatura e job pode ser recuperado", async () => {
    const r = await request(),
      p = await prepared(r.token);
    const accepted = await signing.confirm(
      r.token,
      {
        preparationId: p.preparationId,
        idempotencyKey: randomUUID(),
        accepted: true,
        consentVersion: p.consentVersion,
      },
      "ip",
      "ua",
    );
    storage.fail = true;
    expect((await jobs.runOne(String(accepted.id))).status).toBe("failed");
    expect((await repo.get(r.id)).status).toBe("failed");
    expect(
      (
        await db.query("SELECT final_file_id FROM signatures WHERE id=$1", [
          accepted.id,
        ])
      ).rows[0].final_file_id,
    ).toBeNull();
    storage.fail = false;
    await db.query(
      "UPDATE processing_jobs SET next_run_at=now() WHERE signature_id=$1",
      [accepted.id],
    );
    expect((await jobs.runOne(String(accepted.id))).status).toBe("signed");
  });
  it("recupera lease de execução interrompida", async () => {
    const r = await request(),
      p = await prepared(r.token);
    const s = await signing.confirm(
      r.token,
      {
        preparationId: p.preparationId,
        idempotencyKey: randomUUID(),
        accepted: true,
        consentVersion: p.consentVersion,
      },
      "ip",
      "ua",
    );
    await db.query(
      "UPDATE processing_jobs SET status='running',lease_until=now()-interval '1 second',lease_token=$2 WHERE signature_id=$1",
      [s.id, randomUUID()],
    );
    expect((await jobs.runOne(String(s.id))).status).toBe("signed");
  });
  it("registra conferência e divergência sem apagar histórico", async () => {
    const r = await request(),
      p = await prepared(r.token);
    const accepted = await signing.confirm(
      r.token,
      {
        preparationId: p.preparationId,
        idempotencyKey: randomUUID(),
        accepted: true,
        consentVersion: p.consentVersion,
      },
      "ip",
      "ua",
    );
    await jobs.runOne(String(accepted.id));
    const reviews = new ReviewsService(db, repo, audit);
    await expect(
      reviews.record(r.id, { result: "divergent", notes: "" }, admin),
    ).rejects.toThrow();
    await reviews.record(r.id, { result: "reviewed" }, admin);
    await reviews.record(
      r.id,
      { result: "divergent", notes: "CPF declarado diverge do cadastro" },
      admin,
    );
    const d = await documents.details(r.id);
    expect(d.status).toBe("divergent");
    expect(d.reviews).toHaveLength(2);
    await expect(
      db.query("DELETE FROM identity_reviews WHERE request_id=$1", [r.id]),
    ).rejects.toThrow("imutável");
  });
  it("nova versão não modifica documento enviado", async () => {
    const r = await request(),
      old = await repo.get(r.id),
      v = await templates.version(versionId);
    await templates.publish(
      {
        name: "Modelo alterado",
        fileId: v.file_id,
        fields: [{ ...field, x: 0.3 }],
      },
      admin,
      v.template_id,
    );
    expect((await repo.get(r.id)).fields[0].x).toBe(old.fields[0].x);
  });
  it("renova validade invalidando token anterior", async () => {
    const r = await request();
    const renewed = await documents.action(
      r.id,
      "renew",
      admin,
      new Date(Date.now() + 86400000).toISOString(),
    );
    await expect(signing.open(r.token)).rejects.toThrow();
    expect((await signing.open(renewed.link!.split("/").pop()!)).id).toBe(r.id);
  });
  it("documento ainda não assinado não pode ser conferido", async () => {
    const r = await request();
    await expect(
      new ReviewsService(db, repo, audit).record(
        r.id,
        { result: "reviewed" },
        admin,
      ),
    ).rejects.toThrow("não pode");
  });
  it("recusa assinatura e preserva o evento", async () => {
    const r = await request();
    await signing.refuse(r.token, "Não concordo com o documento");
    await expect(signing.open(r.token)).rejects.toThrow("revogado");
    expect((await repo.get(r.id)).status).toBe("refused");
  });
});

describe("Cadastro público e senha mínima de 9 caracteres", () => {
  it("rejeita senha de 8 caracteres no cadastro e na troca", async () => {
    await expect(
      auth.register(
        {
          name: "Conta curta",
          login: "short-registration",
          password: "12345678",
        },
        "register-short",
      ),
    ).rejects.toThrow("9 caracteres");
    const actor = await auth.actor(db, admin);
    await expect(
      auth.changePassword(actor, "Test-password-123!", "12345678"),
    ).rejects.toThrow("9 caracteres");
  });
  it("cadastra funcionário com 9 caracteres e autentica pelo login normalizado", async () => {
    const created = await auth.register(
      { name: "Nova conta", login: "  Conta.Nova  ", password: "123456789" },
      "register-valid",
    );
    const row = (
      await db.query<{ password_hash: string }>(
        "SELECT password_hash FROM users WHERE id=$1",
        [created.id],
      )
    ).rows[0];
    expect(row.password_hash.startsWith("$argon2id$")).toBe(true);
    expect(row.password_hash).not.toBe("123456789");
    const session = await auth.login(
      { login: "CONTA.NOVA", password: "123456789" },
      "register-login",
    );
    expect(session.user.id).toBe(created.id);
    expect(session.user.role).toBe("employee");
    expect(session.user.permissions).not.toContain("users.write");
    expect(session.user.permissions).not.toContain("settings.write");
    expect(
      (
        await db.query(
          "SELECT action FROM audit_events WHERE aggregate_id=$1 ORDER BY sequence LIMIT 1",
          [created.id],
        )
      ).rows[0].action,
    ).toBe("auth.registered");
  });
  it("impede login duplicado com diferença de caixa", async () => {
    await expect(
      auth.register(
        { name: "Duplicada", login: "Conta.Nova", password: "123456789" },
        "register-duplicate",
      ),
    ).rejects.toThrow();
  });
  it("não aceita perfil ou permissões enviados no cadastro público", async () => {
    await expect(
      auth.register(
        {
          name: "Tentativa de privilégio",
          login: "privilege-registration",
          password: "123456789",
          role: "admin",
          permissions: ["users.write"],
        },
        "register-privilege",
      ),
    ).rejects.toThrow();
    expect(
      (
        await db.query(
          "SELECT count(*)::int total FROM users WHERE login='privilege-registration'",
        )
      ).rows[0].total,
    ).toBe(0);
  });
  it("permite trocar para senha de 9 caracteres e revoga a sessão anterior", async () => {
    const session = await auth.login(
      { login: "conta.nova", password: "123456789" },
      "register-password",
    );
    await auth.changePassword(session.user, "123456789", "987654321");
    await expect(auth.authenticate(session.sessionToken)).rejects.toThrow();
    expect(
      (
        await auth.login(
          { login: "conta.nova", password: "987654321" },
          "register-password",
        )
      ).user.role,
    ).toBe("employee");
  });
});

describe("Provisionamento administrativo e edição de configurações", () => {
  it("não promove contas quando já existe um administrador", async () => {
    await expect(promoteInitialAdmin(db, audit, "conta.nova")).rejects.toThrow(
      "Já existe administrador",
    );
  });
  it("promove conta existente, revoga sessões e libera configuração com auditoria", async () => {
    const session = await auth.login(
      { login: "conta.nova", password: "987654321" },
      "promote-login",
    );
    await db.query("UPDATE user_roles SET role='employee' WHERE user_id=$1", [
      admin,
    ]);
    await promoteInitialAdmin(db, audit, "conta.nova");
    await expect(auth.authenticate(session.sessionToken)).rejects.toThrow();
    const actor = await auth.actor(db, session.user.id);
    expect(actor.role).toBe("admin");
    expect(actor.permissions).toContain("settings.write");
    const current = await settings.get();
    await settings.save(
      { ...current, companyName: "Empresa configurada" },
      actor.id,
    );
    expect((await settings.get()).companyName).toBe("Empresa configurada");
    const event = (
      await db.query(
        "SELECT data FROM audit_events WHERE aggregate_id=$1 AND action='users.initial_admin_promoted'",
        [actor.id],
      )
    ).rows[0];
    expect(event.data).toMatchObject({
      from: "employee",
      to: "admin",
      source: "operator-cli",
    });
    expect((await audit.verify(db)).valid).toBe(true);
  });
});
