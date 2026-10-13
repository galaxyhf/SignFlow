import "../../config/env";
import { z } from "zod";
import { Database } from "../../database/database";
import { AuditService } from "../audit/audit.service";
export async function promoteInitialAdmin(
  db: Database,
  audit: AuditService,
  login: string,
) {
  return db.transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(718292)");
    const existing = (
      await tx.query(
        "SELECT u.id FROM users u JOIN user_roles r ON r.user_id=u.id WHERE r.role='admin' LIMIT 1",
      )
    ).rows[0];
    if (existing)
      throw new Error(
        "Já existe administrador. Gerencie os perfis pelo painel.",
      );
    const target = (
      await tx.query<{ id: string; role: string }>(
        "SELECT u.id,r.role FROM users u JOIN user_roles r ON r.user_id=u.id WHERE u.login=$1 AND u.active=true FOR UPDATE OF u,r",
        [login],
      )
    ).rows[0];
    if (!target) throw new Error("Login ativo não encontrado");
    await tx.query("UPDATE user_roles SET role='admin' WHERE user_id=$1", [
      target.id,
    ]);
    await tx.query("UPDATE users SET updated_at=now() WHERE id=$1", [
      target.id,
    ]);
    await tx.query(
      "UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL",
      [target.id],
    );
    await audit.append(tx, "users.initial_admin_promoted", target.id, null, {
      from: target.role,
      to: "admin",
      source: "operator-cli",
    });
    return { id: target.id };
  });
}
async function main() {
  const index = process.argv.indexOf("--login");
  if (index < 0)
    throw new Error("Use: npm run admin:promote -- --login seu.login");
  const login = z
    .string()
    .trim()
    .min(3)
    .max(255)
    .transform((v) => v.toLowerCase())
    .parse(process.argv[index + 1]);
  const db = new Database();
  try {
    await promoteInitialAdmin(db, new AuditService(), login);
    console.log("Conta promovida a administrador. Entre novamente no sistema.");
  } finally {
    await db.onModuleDestroy();
  }
}
if (require.main === module)
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : "Falha no provisionamento");
    process.exit(1);
  });
