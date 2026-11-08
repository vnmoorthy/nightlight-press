/**
 * Monid: the company's telephone (agentline voice persona), plus image generation and voice cloning.
 * The RUN is the call: POST /v1/run → 202 RUNNING for the length of the call; POST /v1/runs/{id}/stop hangs up.
 */
import { Retry } from "./jobs.js";
const BASE = process.env.MONID_BASE || "https://api.monid.ai/v1";
export const PROVIDER = () => process.env.MONID_VOICE_PROVIDER || "agentline";
export const NUMBER_ID = () => process.env.MONID_NUMBER_ID || "";
export const FROM_E164 = () => process.env.MONID_FROM_E164 || "";
export const TERMINAL = new Set(["COMPLETED", "FAILED", "BLOCKED", "STOPPED", "TIMED_OUT"]);

async function api(path, init = {}) {
  const r = await fetch(`${BASE}${path}`, { ...init, headers: { Authorization: `Bearer ${process.env.MONID_API_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (r.status === 429 || r.status >= 502) throw new Retry(`monid ${path} ${r.status}`, 6000);
  if (!r.ok && r.status !== 202) throw new Error(`monid ${path} ${r.status}: ${text.slice(0, 300)}`);
  return json;
}
export async function startRun(provider, endpoint, { body, queryParams, pathParams, maxCost } = {}) {
  const input = {}; if (body) input.body = body; if (queryParams) input.queryParams = queryParams; if (pathParams) input.pathParams = pathParams;
  const payload = { provider, endpoint, input }; if (maxCost) payload.maxCost = maxCost;
  return api(`/run`, { method: "POST", body: JSON.stringify(payload) });
}
export const getRun = (runId) => api(`/runs/${runId}`);
export const stopRun = (runId) => api(`/runs/${runId}/stop`, { method: "POST" });
export async function quick(provider, endpoint, opts = {}, waitMs = 6000) {
  let run = await startRun(provider, endpoint, opts);
  const t0 = Date.now();
  while (run.runId && !TERMINAL.has(run.status) && Date.now() - t0 < waitMs) { await new Promise((r) => setTimeout(r, 900)); run = await getRun(run.runId); }
  return run;
}
export const out = (run) => run?.output ?? run?.providerResponse?.data ?? null;
export function httpErr(run) { const h = run?.providerResponse?.httpStatus; return h && h >= 400 ? h : null; }

export async function placeInterviewCall({ to, instructions, greeting }) {
  if (!NUMBER_ID()) throw new Error("MONID_NUMBER_ID not set");
  const body = { fromNumberId: NUMBER_ID(), to, instructions: instructions.slice(0, 10000) };
  if (greeting) body.greeting = greeting.slice(0, 1000);
  return startRun(PROVIDER(), "/place-calls", { body, maxCost: 5 });
}
export async function readCall(runId) {
  const run = await getRun(runId);
  return { done: TERMINAL.has(run.status), status: run.status, output: out(run), cost: Number(run?.cost?.value ?? 0), http: run?.providerResponse?.httpStatus, error: run?.error ?? run?.providerResponse?.error ?? null };
}
export async function hangUp(runId) { try { return await stopRun(runId); } catch (e) { return { error: String(e.message) }; } }

/** Find the live call to a number (to read its transcript while it happens). */
export async function findLiveCallId(to) {
  const run = await quick(PROVIDER(), "/list-calls", { body: { numberId: NUMBER_ID(), limit: 5 }, queryParams: { numberId: NUMBER_ID(), limit: 5 } }, 5000);
  const o = out(run); const list = Array.isArray(o) ? o : (o?.calls || o?.data || o?.items || []);
  const norm = (s) => String(s || "").replace(/[^\d+]/g, "");
  const hit = list.find((c) => norm(c.to_number || c.to || c.toNumber) === norm(to) && !/completed|failed/i.test(String(c.status))) || list.find((c) => norm(c.to_number || c.to || c.toNumber) === norm(to));
  return hit ? String(hit.id || hit.call_id || hit.callId) : null;
}
export async function callDetail(callId) {
  const run = await quick(PROVIDER(), "/calls/{id}", { body: { numberId: NUMBER_ID(), callId }, pathParams: { id: callId }, queryParams: { numberId: NUMBER_ID() } }, 5000);
  return out(run);
}
export async function callTranscript(callId) {
  const run = await quick(PROVIDER(), "/calls/{id}/transcript", { body: { numberId: NUMBER_ID(), callId }, pathParams: { id: callId }, queryParams: { numberId: NUMBER_ID() } }, 5000);
  const o = out(run);
  const turns = Array.isArray(o) ? o : (o?.transcript || o?.turns || o?.messages || o?.data || []);
  return Array.isArray(turns) ? cleanTurns(turns.map((t) => ({ role: String(t.role || t.speaker || "").toLowerCase().includes("agent") ? "interviewer" : "subject", text: String(t.text || t.content || "").trim() }))) : [];
}
export function transcriptFromOutput(o) {
  const t = o?.transcript ?? o?.call?.transcript ?? o?.turns;
  if (Array.isArray(t)) return cleanTurns(t.map((x) => ({ role: String(x.role || x.speaker || "").toLowerCase().includes("agent") ? "interviewer" : "subject", text: String(x.text || x.content || "").trim() })));
  if (typeof t === "string" && t.trim()) return t.split(/\n+/).map((line) => { const m = line.match(/^(\w+)\s*:\s*(.*)$/); return m ? { role: /agent|assistant|interviewer/i.test(m[1]) ? "interviewer" : "subject", text: m[2] } : { role: "subject", text: line }; });
  return [];
}
/**
 * Clean a live transcript: providers emit growing partial utterances as separate turns, and a speaker
 * sometimes restates what they already said. Keep one turn per utterance and only the new words.
 */
export function cleanTurns(turns) {
  const n = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();
  const out = []; const last = { interviewer: null, subject: null }; // { idx, full }
  for (const t of turns) {
    const text = String(t.text || "").trim(); if (!text) continue;
    const role = t.role === "interviewer" ? "interviewer" : "subject";
    const prev = out[out.length - 1];
    if (prev && prev.role === role) {
      if (n(text).startsWith(n(prev.text))) { prev.text = text; last[role] = { idx: out.length - 1, full: text }; continue; }
      if (n(prev.text).startsWith(n(text))) continue;
    }
    const L = last[role];
    if (L && n(L.full).length >= 20 && n(text).startsWith(n(L.full))) {
      const w = L.full.split(/\s+/).length, words = text.split(/\s+/);
      out[L.idx].text = out[L.idx].text === L.full ? words.slice(0, w).join(" ") : out[L.idx].text; // heal a cut-off last word
      const rest = words.slice(w).join(" ").trim(); last[role] = { idx: L.idx, full: text };
      if (rest.split(/\s+/).filter(Boolean).length < 2) continue;
      if (prev && prev.role === role) { prev.text = `${prev.text} ${rest}`; last[role] = { idx: out.length - 1, full: text }; continue; }
      out.push({ role, text: rest }); last[role] = { idx: out.length - 1, full: text }; continue;
    }
    if (L && n(L.full) === n(text)) continue;
    out.push({ role, text }); last[role] = { idx: out.length - 1, full: text };
  }
  return out;
}
export async function sendSms(to, text) {
  if (!NUMBER_ID()) throw new Error("MONID_NUMBER_ID not set");
  const run = await quick(PROVIDER(), "/send-messages", { body: { fromNumberId: NUMBER_ID(), to, body: text.slice(0, 1600) }, maxCost: 0.1 }, 6000);
  if (httpErr(run)) throw new Error(`sms ${httpErr(run)}: ${JSON.stringify(run?.providerResponse?.error || "").slice(0, 160)}`);
  return out(run);
}
export async function balance() { try { return await api(`/wallet/balance`); } catch (e) { return { error: String(e.message) }; } }

/** Book cover through Monid (OpenAI gpt-image). Start now, poll later. */
export async function startCover(prompt) {
  return startRun("openai", "/v1/image/gpt-image-2.5-flare", { body: { prompt: prompt.slice(0, 4000), size: "1024x1536", quality: "medium" }, maxCost: 0.2 });
}
/** Deep-search a provider output for the first https URL (artifact links differ by provider). */
export function findUrl(o, prefer = ["download_link", "download_url", "url", "link", "audio_url", "image_url", "signed_url"]) {
  if (!o) return null;
  if (typeof o === "string") return /^https:\/\//.test(o) ? o : null;
  if (Array.isArray(o)) { for (const x of o) { const u = findUrl(x, prefer); if (u) return u; } return null; }
  if (typeof o === "object") {
    for (const k of prefer) if (typeof o[k] === "string" && /^https:\/\//.test(o[k])) return o[k];
    for (const v of Object.values(o)) { const u = findUrl(v, prefer); if (u) return u; }
  }
  return null;
}
/** Zero-shot voice clone + TTS (FishAudio via Monid): reference clip 10–30 s + its transcript. Returns a run. */
export async function startOwnVoice(text, referenceUrl, referenceText) {
  return startRun("fishaudio", "/text-to-speech", { body: { text: text.slice(0, 4800), reference_audio_url: referenceUrl, reference_text: referenceText.slice(0, 1000), prosody: { speed: 0.92 } }, maxCost: 0.3 });
}
