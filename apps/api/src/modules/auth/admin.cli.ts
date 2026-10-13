import "../../config/env";
import { Database } from "../../database/database";
import { AuthService } from "./auth.service";
import { AuditService } from "../audit/audit.service";
import { SettingsService } from "../settings/settings.service";
import { required } from "../../config/env";
async function main() {
  const db = new Database(),
    audit = new AuditService(),
    settings = new SettingsService(db, audit),
    auth = new AuthService(db, audit, settings);
  try {
    const count = (
      await db.query(
        "SELECT count(*)::int total FROM users u JOIN user_roles r ON r.user_id=u.id WHERE r.role='admin'",
      )
    ).rows[0];
    if (Number(count.total) > 0)
      throw new Error(
        "Administrador já provisionado; cadastre funcionários pelo painel",
      );
    await auth.createUser(
      {
        name: required("ADMIN_NAME"),
        login: required("ADMIN_LOGIN"),
        password: required("ADMIN_PASSWORD"),
        role: "admin",
        active: true,
      },
      null,
    );
    console.log("Primeiro administrador criado");
  } finally {
    await db.onModuleDestroy();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Falha de provisionamento");
  process.exit(1);
});
