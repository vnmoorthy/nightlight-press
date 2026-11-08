/** AgentMail: the company's correspondence with families (outbound mail, inbound replies via Svix webhooks). */
import { createHmac, timingSafeEqual } from "node:crypto";
const BASE = process.env.AGENTMAIL_BASE || "https://api.agentmail.to/v0";
export const INBOX = () => process.env.AGENTMAIL_INBOX_ID || "";
async function api(path, init = {}) {
  const r = await fetch(`${BASE}${path}`, { ...init, headers: { Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(`agentmail ${path} ${r.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}
export const listInboxes = () => api(`/inboxes`);
export const createInbox = (username, display_name) => api(`/inboxes`, { method: "POST", body: JSON.stringify({ username, display_name }) });
export const listWebhooks = () => api(`/webhooks`);
export const createWebhook = (url, inbox_ids) => api(`/webhooks`, { method: "POST", body: JSON.stringify({ url, event_types: ["message.received"], inbox_ids, client_id: "nightlight-app" }) });
export async function sendEmail({ to, subject, text, html, attachments, labels }) {
  const body = { to: Array.isArray(to) ? to : [to], subject, text, html, attachments, labels };
  return api(`/inboxes/${encodeURIComponent(INBOX())}/messages/send`, { method: "POST", body: JSON.stringify(body) });
}
export const listMessages = (limit = 20) => api(`/inboxes/${encodeURIComponent(INBOX())}/messages?limit=${limit}`);
export const getAttachment = (messageId, attachmentId) => api(`/inboxes/${encodeURIComponent(INBOX())}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`);
/** Svix signature check: base64(HMAC-SHA256(secret, `${id}.${ts}.${body}`)), 5-minute tolerance. */
export function verifySvix(rawBody, headers, secret) {
  if (!secret) return false;
  const id = headers["svix-id"], ts = headers["svix-timestamp"], sig = headers["svix-signature"] || "";
  if (!id || !ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(String(secret).replace(/^whsec_/, ""), "base64");
  const want = createHmac("sha256", key).update(`${id}.${ts}.${rawBody}`).digest();
  return sig.split(" ").some((p) => { const [, b64] = p.split(","); if (!b64) return false; const got = Buffer.from(b64, "base64"); return got.length === want.length && timingSafeEqual(got, want); });
}
export function verifyNaive(rawBody, headers, secret) {
  if (!secret) return false;
  const ts = Number(headers["vetta-timestamp"]); if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const want = createHmac("sha256", secret).update(`${ts}.`).update(rawBody).digest();
  return String(headers["vetta-signature"] || "").split(",").filter((p) => p.startsWith("v1=")).some((p) => { const got = Buffer.from(p.slice(3), "hex"); return got.length === want.length && timingSafeEqual(got, want); });
}
