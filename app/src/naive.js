/** Naïve Managed Agents: start a session now, check it on a later tick. Never block a request on an agent. */
import { createClient } from "@usenaive-sdk/managed-agents";
import { Retry } from "./jobs.js";

const BASE = process.env.NAIVE_BASE || "https://api.vetta.sh";
// On Naïve's host the platform injects its own app-scoped NAIVE_API_KEY; the company's key travels as COMPANY_NAIVE_KEY.
const KEY = () => process.env.COMPANY_NAIVE_KEY || process.env.NAIVE_API_KEY || "missing";
export const naive = createClient({ baseUrl: BASE, apiKey: KEY() });
export const AGENTS = {
  author: process.env.NAIVE_AGENT_AUTHOR || "",
  frontdesk: process.env.NAIVE_AGENT_FRONTDESK || "",
  marketer: process.env.NAIVE_AGENT_MARKETER || "",
};
const busy = (e) => /rate_limit|capacity|429|502|503|504|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up/i.test(String(e?.message || e) + String(e?.status || ""));

export async function startSession(agentKey, message, { budget_micro_usd = 400_000, metadata = {}, output_schema } = {}) {
  const agent_id = AGENTS[agentKey];
  if (!agent_id) throw new Error(`agent ${agentKey} is not configured`);
  try {
    const body = { agent_id, message, window: "immediate", budget_micro_usd, metadata };
    if (output_schema) { body.output_schema = output_schema; body.structured_output_required = true; }
    return await naive.sessions.create(body);
  } catch (e) { if (busy(e)) throw new Retry(`naive busy: ${String(e.message).slice(0, 120)}`, 9000); throw e; }
}

export async function checkSession(sid) {
  let s;
  try { s = await naive.sessions.get(sid); } catch (e) { if (busy(e)) throw new Retry("naive busy", 6000); throw e; }
  const status = String(s.status || "");
  if (!["idle", "completed", "failed", "cancelled"].includes(status)) return { done: false, status };
  let output = s.structured_output ?? s.output ?? null;
  let text = "";
  try {
    const after = Math.max(0, Number(s.last_seq || 0) - 80);
    const ev = await naive.sessions.events(sid, { after_seq: after, limit: 100 });
    for (const e of ev.data || ev || []) {
      if (e.type === "message.completed" && e.data?.role !== "user" && e.data?.from !== "platform" && e.data?.content) text = e.data.content;
      if (e.type === "session.idle" && e.data?.structured_output && !output) output = e.data.structured_output;
    }
  } catch { /* events are best effort */ }
  if (!output && text) { try { const m = text.match(/\{[\s\S]*\}/); if (m) output = JSON.parse(m[0]); } catch { /* not json */ } }
  const ok = (status === "idle" && (s.stop_reason === "end_turn" || !s.stop_reason)) || status === "completed";
  return { done: true, ok, status, stop_reason: s.stop_reason, output, text, cost: Number(s.consumed_micro_usd ?? s.usage?.consumed_micro_usd ?? 0) };
}

/** Upload bytes to Naïve Files and return the file id (published scope). */
export async function uploadFile(buffer, name, mime) {
  const fd = new FormData();
  fd.append("file", new Blob([buffer], { type: mime }), name);
  fd.append("name", name);
  const r = await fetch(`${BASE}/v1/files`, { method: "POST", headers: { Authorization: `Bearer ${KEY()}` }, body: fd });
  if (!r.ok) throw new Error(`naive files ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).id;
}
export async function fileUrl(fileId) {
  const r = await fetch(`${BASE}/v1/files/${fileId}/url`, { method: "POST", headers: { Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json" }, body: "{}" });
  if (!r.ok) throw new Error(`naive file url ${r.status}`);
  return (await r.json()).url;
}
/** Text-to-speech through Naïve media (returns a Naïve file id). */
export async function speak(text, { voice = "sage", model } = {}) {
  const body = { text: text.slice(0, 4000), voice };
  if (model) body.model = model;
  const r = await fetch(`${BASE}/v1/media/audio/speech`, { method: "POST", headers: { Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) });
  if (r.status === 429 || r.status >= 500) throw new Retry(`naive speech ${r.status}`, 8000);
  if (!r.ok) throw new Error(`naive speech ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return { fileId: j.file?.id, mime: j.file?.content_type || "audio/wav", seconds: j.duration_seconds, cost: j.cost_micro_usd };
}
