import "../config/env";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { resolve } from "node:path";
import { required } from "../config/env";
async function main() {
  const pool = new Pool({
    connectionString: required("DATABASE_URL_UNPOOLED"),
    max: 1,
  });
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: resolve(__dirname, "../../drizzle"),
    });
    console.log("Migrations aplicadas");
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "Falha ao aplicar migrations; confirme a conexão direta e os privilégios",
  );
  process.exit(1);
});
