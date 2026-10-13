import { tmpdir } from "node:os";
import { join } from "node:path";
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { PGlite } from "@electric-sql/pglite";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "../apps/api/src/app.module";
import { Database, Queryable } from "../apps/api/src/database/database";
import { StorageService } from "../apps/api/src/modules/storage/storage.service";
import { AuthService } from "../apps/api/src/modules/auth/auth.service";
async function main() {
  if (process.env.NODE_ENV !== "test")
    throw new Error("Servidor exclusivo para testes");
  const pg = new PGlite();
  await pg.exec(
    (await readFile("apps/api/drizzle/0000_fast_dust.sql", "utf8")).replaceAll(
      "--> statement-breakpoint",
      "",
    ),
  );
  const scope = new AsyncLocalStorage<Queryable>();
  const db = {
    query: async <T extends Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ) => {
      const tx = scope.getStore();
      if (tx) return tx.query<T>(sql, params);
      return { rows: (await pg.query<T>(sql, params)).rows };
    },
    transaction: <T>(fn: (q: Queryable) => Promise<T>) =>
      pg.transaction((tx) => {
        const q: Queryable = {
          query: async <R extends Record<string, unknown>>(
            sql: string,
            params: unknown[] = [],
          ) => ({ rows: (await tx.query<R>(sql, params)).rows }),
        };
        return scope.run(q, () => fn(q));
      }),
  };
  const objects = new Map<string, Uint8Array>();
  const storage = {
    assertPrivate: async () => {},
    put: async (key: string, bytes: Uint8Array) => {
      objects.set(key, bytes.slice());
    },
    get: async (key: string) => {
      const bytes = objects.get(key);
      if (!bytes) throw new Error("Not found");
      return bytes;
    },
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Database)
    .useValue(db)
    .overrideProvider(StorageService)
    .useValue(storage)
    .compile();
  const app = module.createNestApplication({
    bodyParser: false,
    logger: false,
  });
  app.use(express.json({ limit: "600kb" }));
  app.use(cookieParser());
  app.use(helmet());
  const password = randomBytes(20).toString("base64url"),
    login = "e2e-admin";
  await app
    .get(AuthService)
    .createUser(
      { name: "Administrador E2E", login, password, role: "admin" },
      null,
    );
  await writeFile(
    join(tmpdir(), "signflow-e2e-credentials.json"),
    JSON.stringify({ login, password }),
    { mode: 0o600 },
  );
  await app.listen(3101, "localhost");
  console.log(
    "API E2E pronta (PostgreSQL embarcado e storage em memória, exclusivos de teste)",
  );
  const shutdown = async () => {
    await app.close();
    await pg.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Falha");
  process.exit(1);
});
