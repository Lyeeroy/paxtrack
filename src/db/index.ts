import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

type Database = ReturnType<typeof drizzle>;

let dbInstance: Database | undefined;

function getPool(): Pool {
  const existing = globalForDb.__arenaNextJsPostgresqlPool;
  if (existing) return existing;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString });
  globalForDb.__arenaNextJsPostgresqlPool = pool;
  return pool;
}

/** Create the client on first use so builds don't need DATABASE_URL. */
export function getDb(): Database {
  if (!dbInstance) {
    dbInstance = drizzle(getPool());
  }
  return dbInstance;
}
