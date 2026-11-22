import { bigint, boolean, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

// One row per tracked title per sync vault. `vault` is a SHA-256 hash of the
// user's secret sync key (the key itself is never stored).
export const syncItems = pgTable(
  "sync_items",
  {
    vault: text("vault").notNull(),
    itemId: text("item_id").notNull(),
    data: jsonb("data").notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
    serverTs: bigint("server_ts", { mode: "number" }).notNull(),
    deleted: boolean("deleted").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.vault, t.itemId] })],
);
