// Headless Chrome captures for the deck: page screenshots and an office screencast (CDP, no extra deps).
// usage: node capture.mjs <base-url> [office-base-url]
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
const BASE = process.argv[2] || "http://localhost:3100";
const OFFICE = process.argv[3] || BASE;
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333, W = 1600, H = 1000, OUT = decodeURIComponent(new URL("./shots/", import.meta.url).pathname);
mkdirSync(OUT, { recursive: true });
const prof = "/tmp/nl-deck-chrome"; rmSync(prof, { recursive: true, force: true });
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`, ...(process.env.GPU_FLAGS ? process.env.GPU_FLAGS.split(" ") : ["--use-angle=metal"]), "--hide-scrollbars", "--mute-audio", `--user-data-dir=${prof}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ver; for (let i = 0; i < 200 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); } }
if (!ver) { console.error("chrome did not start"); process.exit(1); }
const tgt = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let nid = 0; const pend = new Map(); const listeners = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } else listeners.forEach((f) => f(d)); };
const send = (method, params = {}) => new Promise((r) => { const id = ++nid; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
const evalJs = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
async function go(url, wait = 3000) { await send("Page.navigate", { url }); await sleep(wait); }
async function shot(name, { url, wait = 3000, js, after = 600, full = false } = {}) {
  if (ONLY.length && !ONLY.includes(name)) return;
  await go(url, wait); if (js) { await evalJs(js); await sleep(after); }
  const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 88, captureBeyondViewport: full });
  writeFileSync(`${OUT}${name}.jpg`, Buffer.from(r.result.data, "base64")); console.log("shot", name);
}
const ORDER = process.env.ORDER_ID, BOOK = process.env.BOOK_ID;
await shot("landing", { url: `${BASE}/`, wait: 3500 });
await shot("form", { url: `${BASE}/#make`, wait: 3000, js: `(()=>{const f=document.getElementById('orderForm');f.child_name.value='Maya';f.look.value='Brown skin, curly black hair in two puffs, round red glasses, a yellow raincoat with star buttons';f.favorites.value='Dinosaurs, her dog Biscuit, puddles, mango lassi';document.getElementById('make').scrollIntoView();window.scrollBy(0,-70)})()` });
await shot("staff", { url: `${BASE}/#staff`, wait: 2500, js: `document.getElementById('staff').scrollIntoView();window.scrollBy(0,-60)` });
if (ORDER) await shot("order", { url: `${BASE}/order/${ORDER}`, wait: 5000 });
if (BOOK) await shot("reader", { url: `${BASE}/book/${BOOK}`, wait: 3500 });
if (BOOK) await shot("reader_p3", { url: `${BASE}/book/${BOOK}`, wait: 3500, js: `document.getElementById('nextp').click();document.getElementById('nextp').click();document.getElementById('nextp').click()`, after: 1500 });
await shot("shelf", { url: `${BASE}/shelf`, wait: 3000 });
await shot("board", { url: `${OFFICE}/board`, wait: 4500 });
await shot("office", { url: `${OFFICE}/office`, wait: 8000 });
// screencast of the office replaying the last book
if (!ONLY.length || ONLY.includes("video")) {
  const dir = "/tmp/nl-office-frames"; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  await go(`${OFFICE}/office`, 7000);
  const frames = [];
  listeners.push(async (d) => { if (d.method !== "Page.screencastFrame") return; const { data, metadata, sessionId } = d.params; const f = `${dir}/f_${String(frames.length).padStart(5, "0")}.jpg`; writeFileSync(f, Buffer.from(data, "base64")); frames.push({ f, t: metadata.timestamp }); send("Page.screencastFrameAck", { sessionId }); });
  await send("Page.startScreencast", { format: "jpeg", quality: Number(process.env.SC_Q || 75), maxWidth: Number(process.env.SC_W || 1440), maxHeight: H, everyNthFrame: 1 });
  await sleep(1500); await evalJs(`document.getElementById('replay').click()`);
  await sleep(Number(process.env.VIDEO_SECONDS || 24) * 1000);
  await send("Page.stopScreencast"); await sleep(300);
  const lines = []; for (let i = 0; i < frames.length; i++) { const dur = i < frames.length - 1 ? Math.max(0.005, frames[i + 1].t - frames[i].t) : 0.04; lines.push(`file '${frames[i].f}'`, `duration ${dur.toFixed(4)}`); }
  lines.push(`file '${frames[frames.length - 1].f}'`); writeFileSync(`${dir}/list.txt`, lines.join("\n"));
  console.log("frames", frames.length, "fps~", (frames.length / ((frames.at(-1).t - frames[0].t) || 1)).toFixed(1));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `${dir}/list.txt`, "-vf", "fps=30,scale=1440:-2:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-movflags", "+faststart", `${OUT}${process.env.VIDEO_NAME || "office"}.mp4`]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", "8", "-i", `${OUT}${process.env.VIDEO_NAME || "office"}.mp4`, "-frames:v", "1", "-q:v", "3", `${OUT}${process.env.VIDEO_NAME || "office"}_poster.jpg`]);
  console.log("video written");
}
ws.close(); chrome.kill();
process.exit(0);
