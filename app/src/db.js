/**
 * Postgres access that works both as a long-running local server (pool) and on Naïve's serverless
 * host (one client per request, opened lazily, closed at the end; a pooled connection in a frozen
 * instance is a leaked backend). The ledger is hash-chained and appended under an advisory lock.
 */
import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { MIGRATIONS } from "./prompts.generated.js";

const { Pool, Client } = pg;
const als = new AsyncLocalStorage();
const SERVERLESS = !!process.env.VERCEL || process.env.NL_SERVERLESS === "1";

function libpqCompat(url) {
  try { const u = new URL(url); if (u.searchParams.has("sslmode")) u.searchParams.set("uselibpqcompat", "true"); return u.toString(); } catch { return url; }
}
let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: libpqCompat(process.env.DATABASE_URL || ""), max: 6, idleTimeoutMillis: 10_000 });
  return pool;
}
export async function withDb(fn) {
  const ctx = { client: null, connecting: null };
  return als.run(ctx, async () => {
    try { return await fn(); }
    finally { if (ctx.client) { try { await ctx.client.end(); } catch { /* ignore */ } } }
  });
}
async function conn() {
  const ctx = als.getStore();
  if (!ctx || !SERVERLESS) return getPool();
  if (ctx.client) return ctx.client;
  if (!ctx.connecting) ctx.connecting = (async () => {
    const c = new Client({ connectionString: libpqCompat(process.env.DATABASE_URL || ""), connectionTimeoutMillis: 5000, statement_timeout: 8000 });
    await c.connect(); ctx.client = c; return c;
  })();
  return ctx.connecting;
}
export async function q(text, params = []) { const c = await conn(); return (await c.query(text, params)).rows; }
export async function one(text, params = []) { return (await q(text, params))[0] || null; }
export async function tx(fn) {
  const c = await conn();
  if (c instanceof Pool) {
    const cl = await c.connect();
    try { await cl.query("begin"); const r = await fn(cl); await cl.query("commit"); return r; }
    catch (e) { await cl.query("rollback").catch(() => {}); throw e; }
    finally { cl.release(); }
  }
  await c.query("begin");
  try { const r = await fn(c); await c.query("commit"); return r; }
  catch (e) { await c.query("rollback").catch(() => {}); throw e; }
}
export const id = (prefix) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
export const sha256 = (s) => createHash("sha256").update(s).digest("hex");

/** Canonical JSON: sorted keys at every level, so jsonb re-ordering cannot break the chain. */
export function canon(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
}

let migrated = null;
export function migrate() {
  if (!migrated) migrated = (async () => {
    await tx(async (c) => {
      await c.query("select pg_advisory_xact_lock(733100)");
      await c.query(`create table if not exists _migrations (name text primary key, applied_at timestamptz default now())`);
      for (const [name, sql] of MIGRATIONS) {
        const done = (await c.query(`select 1 from _migrations where name=$1`, [name])).rows[0];
        if (done) continue;
        await c.query(sql);
        await c.query(`insert into _migrations(name) values($1)`, [name]);
      }
    });
  })().catch((e) => { migrated = null; throw e; });
  return migrated;
}

export async function ledger(kind, actor, detail = {}, order_id = null) {
  const clean = JSON.parse(JSON.stringify(detail ?? {}));
  return tx(async (c) => {
    await c.query("select pg_advisory_xact_lock(733101)");
    const prev = (await c.query(`select hash from ledger order by seq desc limit 1`)).rows[0];
    const prev_hash = prev?.hash || "GENESIS";
    const hash = sha256(canon({ kind, actor, detail: clean, order_id, prev_hash }));
    return (await c.query(`insert into ledger(kind, actor, detail, order_id, prev_hash, hash) values($1,$2,$3,$4,$5,$6) returning seq, created_at, hash`, [kind, actor, JSON.stringify(clean), order_id, prev_hash, hash])).rows[0];
  });
}
export async function verifyChain() {
  const rows = await q(`select seq, kind, actor, detail, order_id, prev_hash, hash from ledger order by seq asc`);
  let prev = "GENESIS";
  for (const r of rows) {
    if (r.prev_hash !== prev) return { ok: false, at: r.seq, length: rows.length };
    if (sha256(canon({ kind: r.kind, actor: r.actor, detail: r.detail, order_id: r.order_id, prev_hash: r.prev_hash })) !== r.hash) return { ok: false, at: r.seq, length: rows.length };
    prev = r.hash;
  }
  return { ok: true, length: rows.length, head: prev };
}
export async function intervention(who, what, why, order_id = null) {
  await q(`insert into interventions(order_id, who, what, why) values($1,$2,$3,$4)`, [order_id, who, what, why]);
  await ledger("intervention", `human:${who}`, { what, why }, order_id);
}
export async function kvGet(k) { return (await one(`select v from kv where k=$1`, [k]))?.v ?? null; }
export async function kvSet(k, v) { await q(`insert into kv(k, v, updated_at) values($1,$2,now()) on conflict (k) do update set v=excluded.v, updated_at=now()`, [k, JSON.stringify(v)]); }
