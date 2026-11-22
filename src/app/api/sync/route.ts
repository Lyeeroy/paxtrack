import { createHash } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { syncItems } from "@/db/schema";

export const dynamic = "force-dynamic";

type Incoming = { id: string; updatedAt: number; deleted?: boolean; [k: string]: unknown };

export async function POST(req: Request) {
  let body: { key?: string; since?: number; items?: Incoming[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const key = String(body.key ?? "");
  if (key.length < 16 || key.length > 128) {
    return Response.json({ error: "invalid key" }, { status: 400 });
  }
  const vault = createHash("sha256").update(key).digest("hex");
  const since = Number(body.since ?? 0);
  const incoming = Array.isArray(body.items) ? body.items.slice(0, 2000) : [];
  const now = Date.now();

  try {
    const db = getDb();
    for (const it of incoming) {
      if (!it || typeof it.id !== "string" || typeof it.updatedAt !== "number") continue;
      await db
        .insert(syncItems)
        .values({
          vault,
          itemId: it.id,
          data: it,
          updatedAt: it.updatedAt,
          serverTs: now,
          deleted: !!it.deleted,
        })
        .onConflictDoUpdate({
          target: [syncItems.vault, syncItems.itemId],
          set: {
            data: it,
            updatedAt: it.updatedAt,
            serverTs: now,
            deleted: !!it.deleted,
          },
          // last-write-wins per title
          setWhere: sql`${syncItems.updatedAt} < ${it.updatedAt}`,
        });
    }

    const rows = await db
      .select({ data: syncItems.data })
      .from(syncItems)
      .where(and(eq(syncItems.vault, vault), gt(syncItems.serverTs, since)));

    return Response.json({ items: rows.map((r) => r.data), serverTime: now });
  } catch (e) {
    console.error("sync failed", e);
    return Response.json({ error: "server error" }, { status: 500 });
  }
}
