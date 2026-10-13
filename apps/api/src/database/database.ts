import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { required } from "../config/env";
export interface Queryable {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}
@Injectable()
export class Database implements OnModuleDestroy {
  readonly pool = new Pool({
    connectionString: required("DATABASE_URL"),
    max: 4,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
  });
  readonly orm = drizzle(this.pool);
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ) {
    return this.pool.query<T>(sql, params);
  }
  async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const value = await fn(c);
      await c.query("COMMIT");
      return value;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async onModuleDestroy() {
    await this.pool.end();
  }
}
