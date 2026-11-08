/** Serverless entry on Naïve's host: one function at /api/app; the original path arrives as ?__path=. */
import { handle } from "@hono/node-server/vercel";
import { app } from "./app.js";
const h = handle(app);
export default function handler(req, res) {
  try {
    const u = new URL(req.url, "http://x"); const p = u.searchParams.get("__path");
    if (p) { u.searchParams.delete("__path"); const qs = u.searchParams.toString(); req.url = p + (qs ? `?${qs}` : ""); }
  } catch { /* keep url */ }
  return h(req, res);
}
