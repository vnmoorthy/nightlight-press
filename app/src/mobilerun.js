/** Mobilerun: before a family is told a chapter is ready, the Proofreader opens it on a real phone. */
import { Retry } from "./jobs.js";
const BASE = process.env.MOBILERUN_BASE || "https://api.mobilerun.ai/v1";
async function api(path, init = {}) {
  const r = await fetch(`${BASE}${path}`, { ...init, headers: { Authorization: `Bearer ${process.env.MOBILERUN_API_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const text = await r.text();
  if (r.status === 429 || r.status >= 500) throw new Retry(`mobilerun ${path} ${r.status}`, 8000);
  if (!r.ok) throw new Error(`mobilerun ${path} ${r.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}
export async function readyDevice() {
  const pinned = process.env.MOBILERUN_DEVICE_ID; if (pinned && pinned !== "none") return pinned;
  if (!process.env.MOBILERUN_API_KEY) return null;
  const d = await api(`/devices?state=ready`);
  return d.items?.[0]?.id || null;
}
export const runTask = (deviceId, task, outputSchema) => api(`/tasks`, { method: "POST", body: JSON.stringify({ deviceId, task, llmModel: process.env.MOBILERUN_MODEL || "mobilerun/mobile-agent-fast", maxSteps: 30, outputSchema }) });
export const taskStatus = (id) => api(`/tasks/${id}/status`);
export const taskShots = (id) => api(`/tasks/${id}/screenshots`);
export const stopTask = (id) => api(`/tasks/${id}/cancel`, { method: "POST" }).catch(() => null);
