/** The app's MCP endpoint: Naïve agents run and read the company through it. */
import { q, one, ledger, verifyChain } from "./db.js";
import { tick, enqueue, chainPulse } from "./engine.js";
const TOOLS = [
  { name: "tick", description: "Advance the company: write, paint, narrate, bind, deliver, answer families, publish. Safe any time.", inputSchema: { type: "object", properties: {} } },
  { name: "board_summary", description: "Books made, on the shelf, revenue, ledger integrity.", inputSchema: { type: "object", properties: {} } },
  { name: "commission_shelf_book", description: "Ask the Marketing desk to commission a new public book for the shelf.", inputSchema: { type: "object", properties: {} } },
  { name: "recent_books", description: "The latest books and their status.", inputSchema: { type: "object", properties: {} } },
  { name: "note", description: "Write a note on the public company ledger.", inputSchema: { type: "object", properties: { agent: { type: "string" }, text: { type: "string" } }, required: ["text"] } },
];
async function call(name, a = {}) {
  if (name === "tick") { const r = await tick({ budgetMs: 6500, source: "clock-agent" }); return { ...r, chained: await chainPulse(0) }; }
  if (name === "board_summary") return { ...(await one(`select count(*) filter (where status='ready')::int books, count(*) filter (where status='ready' and public)::int shelf from books`)), ...(await one(`select coalesce(sum(captured_cents) filter (where kind='custom' and paid_mode in ('live','test')),0)::int revenue_cents, coalesce(sum(amount_cents) filter (where kind='custom' and paid_mode='pledge'),0)::int pledged_cents, count(*) filter (where kind='custom')::int orders from orders`)), ledger: await verifyChain() };
  if (name === "commission_shelf_book") { await enqueue("commission", {}); return { ok: true }; }
  if (name === "recent_books") return q(`select id, title, status, kind, created_at from books order by created_at desc limit 20`);
  if (name === "note") { await ledger("note", `agent:${String(a.agent || "agent").slice(0, 30)}`, { text: String(a.text).slice(0, 2000) }); return { ok: true }; }
  throw new Error(`unknown tool ${name}`);
}
export async function mcpHandler(c) {
  const token = process.env.VETTA_MCP_TOKEN;
  if (!token || (c.req.header("authorization") || "") !== `Bearer ${token}`) return c.json({ jsonrpc: "2.0", error: { code: -32001, message: "unauthorized" }, id: null }, 401);
  const req = await c.req.json().catch(() => ({})); const reply = (result) => c.json({ jsonrpc: "2.0", id: req.id ?? null, result });
  try {
    if (req.method === "initialize") return reply({ protocolVersion: req.params?.protocolVersion || "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "nightlight", version: "1.0.0" } });
    if (req.method?.startsWith("notifications/")) return c.body(null, 202);
    if (req.method === "tools/list") return reply({ tools: TOOLS });
    if (req.method === "tools/call") { const r = await call(req.params?.name, req.params?.arguments || {}); return reply({ content: [{ type: "text", text: JSON.stringify(r).slice(0, 7900) }] }); }
    if (req.method === "ping") return reply({});
    return c.json({ jsonrpc: "2.0", id: req.id ?? null, error: { code: -32601, message: `method not found: ${req.method}` } });
  } catch (e) { return c.json({ jsonrpc: "2.0", id: req.id ?? null, result: { isError: true, content: [{ type: "text", text: String(e.message) }] } }); }
}
