import { Hono } from "hono";
import { withDb, migrate, q, one, id, ledger, verifyChain, intervention, kvGet, kvSet } from "./db.js";
import * as engine from "./engine.js";
import * as pay from "./stripe.js";
import * as mail from "./agentmail.js";
import * as monid from "./monid.js";
import { mcpHandler } from "./mcp.js";
import { putMedia, getMedia, mediaRedirectUrl } from "./media.js";
import { LANG, STYLES } from "./prompts.js";
import { landingPage, orderPage, readerPage, shelfPage } from "./views/pages.js";
import { boardPage, officePage, adminPage } from "./views/company.js";
import { tellPage } from "./views/tell.js";

export const app = new Hono();
const BASE = () => process.env.PUBLIC_BASE_URL || "http://localhost:3100";
const isAdmin = (c) => process.env.ADMIN_TOKEN && (c.req.query("token") === process.env.ADMIN_TOKEN || c.req.header("x-admin-token") === process.env.ADMIN_TOKEN);
const e164 = (s) => { const d = String(s || "").replace(/[^\d+]/g, ""); if (!d) return ""; if (d.startsWith("+")) return "+" + d.slice(1).replace(/\D/g, ""); const n = d.replace(/\D/g, ""); if (n.length === 10) return "+1" + n; if (n.length === 11 && n.startsWith("1")) return "+" + n; return "+" + n; };
const first = (s) => String(s || "").trim().split(/\s+/)[0] || "";
app.use("*", async (c, next) => withDb(async () => { await migrate(); await next(); }));
app.use("/api/*", async (c, next) => { await next(); if (c.req.method === "GET") { c.header("Access-Control-Allow-Origin", "*"); } });
app.onError((err, c) => { console.error("[nightlight]", err); return c.json({ error: String(err.message || err) }, 500); });

// ---------- pages ----------
async function shelfBooks(limit = 12) { return q(`select b.id, b.title, b.hero_name, b.style, b.blurb, b.cover_media_id, b.kind, b.created_at, b.price_cents from books b where b.status='ready' and b.public order by b.ready_at desc limit $1`, [limit]); }
app.get("/", async (c) => c.html(landingPage({ mode: pay.mode(), price: pay.PRICE_CENTS, shelf: await shelfBooks(8), from: c.req.query("from") ? await one(`select id, title, style, (select occasion from orders where id=books.order_id) as occasion from books where id=$1 and public`, [c.req.query("from")]) : null })));
app.get("/order/:id", async (c) => {
  const oid = c.req.param("id"); const o = await one(`select * from orders where id=$1`, [oid]); if (!o) return c.notFound();
  if (c.req.query("cs")) { const r = await pay.confirmCheckout(oid, c.req.query("cs")); if (r.ok) await engine.startBook(oid); }
  else if (o.status === "paid" && !o.book_id) await engine.startBook(oid);
  return c.html(orderPage({ o: await one(`select * from orders where id=$1`, [oid]), mode: pay.mode() }));
});
app.get("/book/:id", async (c) => { const b = await one(`select * from books where id=$1`, [c.req.param("id")]); if (!b) return c.notFound(); return c.html(readerPage({ b, mode: pay.mode() })); });
app.get("/shelf", async (c) => c.html(shelfPage({ books: await shelfBooks(48), mode: pay.mode() })));
app.get("/office", (c) => c.html(officePage({ mode: pay.mode() })));
app.get("/tell", (c) => c.html(tellPage({ mode: pay.mode() })));
app.get("/board", (c) => c.html(boardPage({ mode: pay.mode() })));
app.get("/admin", (c) => isAdmin(c) ? c.html(adminPage({ token: c.req.query("token") })) : c.text("Not found", 404));
app.get("/healthz", (c) => c.json({ ok: true, mode: pay.mode(), base: BASE(), configured: { company_key: !!process.env.COMPANY_NAIVE_KEY, agents: !!(process.env.NAIVE_AGENT_AUTHOR && process.env.NAIVE_AGENT_FRONTDESK && process.env.NAIVE_AGENT_MARKETER), agentmail_webhook: !!process.env.AGENTMAIL_WEBHOOK_SECRET && process.env.AGENTMAIL_WEBHOOK_SECRET !== "none", naive_webhook: !!process.env.NAIVE_WEBHOOK_SECRET && process.env.NAIVE_WEBHOOK_SECRET !== "none", phone_line: !!process.env.MONID_NUMBER_ID, mobilerun_device: !!process.env.MOBILERUN_DEVICE_ID && process.env.MOBILERUN_DEVICE_ID !== "none" } }));
app.post("/mcp", mcpHandler);

// ---------- orders ----------
app.post("/api/orders", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const o = { id: id("ord"), buyer_name: String(b.buyer_name || "").trim().slice(0, 80), buyer_email: String(b.buyer_email || "").trim().toLowerCase().slice(0, 200), buyer_phone: e164(b.buyer_phone),
    child_name: String(b.child_name || "").trim().slice(0, 40), child_age: Math.max(1, Math.min(12, Number(b.child_age) || 5)), pronoun: ["he", "she", "they"].includes(b.pronoun) ? b.pronoun : "they",
    look: String(b.look || "").trim().slice(0, 240), favorites: String(b.favorites || "").trim().slice(0, 300), occasion: String(b.occasion || "").trim().slice(0, 240),
    language: LANG[b.language] ? b.language : "en", style: STYLES[b.style] ? b.style : "watercolor", read_to_name: String(b.read_to_name || "").trim().slice(0, 60), read_to_phone: e164(b.read_to_phone), robot: !!b.robot };
  const errs = [];
  if (!o.child_name) errs.push("the child's first name"); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.buyer_email)) errs.push("your email");
  if (o.read_to_phone && !b.read_consent) errs.push("the consent box for the read-aloud call");
  if (errs.length) return c.json({ error: `Please add ${errs.join(", ")}.` }, 400);
  await q(`insert into orders(id,buyer_name,buyer_email,buyer_phone,child_name,child_age,pronoun,look,favorites,occasion,language,style,read_to_name,read_to_phone,amount_cents,source,template_book_id,robot) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [o.id, o.buyer_name, o.buyer_email, o.buyer_phone || null, o.child_name, o.child_age, o.pronoun, o.look, o.favorites, o.occasion, o.language, o.style, o.read_to_name || null, o.read_to_phone || null, pay.PRICE_CENTS, String(b.source || "web").slice(0, 20), b.from || null, o.robot]);
  await ledger("order", "code", { hero: o.child_name, age: o.child_age, style: o.style, language: o.language, read_aloud: !!o.read_to_phone, price_cents: pay.PRICE_CENTS }, o.id);
  if (b.subscribe) await q(`insert into subscribers(email, source) values($1,'order') on conflict do nothing`, [o.buyer_email]);
  const r = await pay.startCheckout({ ...o, amount_cents: pay.PRICE_CENTS }, BASE());
  if (r.paid) { await engine.startBook(o.id); await engine.tick({ budgetMs: 2500, source: "order" }).catch(() => {}); await engine.chainPulse(0).catch(() => {}); }
  return c.json({ id: o.id, url: r.url });
});
// A story told out loud (on stage, at bedtime) becomes a public picture book. Free, so it is rate-limited.
app.post("/api/tell", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const told = String(b.story || "").replace(/\s+/g, " ").trim().slice(0, 8000);
  const hero = String(b.hero || "").trim().slice(0, 40);
  const teller = String(b.teller || "").trim().slice(0, 60) || "a storyteller";
  if (told.split(" ").length < 12) return c.json({ error: "Tell a little more: a sentence or two about the hero and the story." }, 400);
  if (!b.consent) return c.json({ error: "A grown-up needs to tick the permission box first." }, 400);
  const recent = await one(`select count(*) filter (where created_at > now() - interval '60 seconds')::int m, count(*) filter (where created_at > now() - interval '1 day')::int d from orders where kind='told'`);
  if (recent.m >= 1) return c.json({ error: "The Author is already writing a told story. Try again in a minute." }, 429);
  if (recent.d >= Number(process.env.TOLD_PER_DAY || 40)) return c.json({ error: "We've written today's told stories. Come back tomorrow." }, 429);
  const email = String(b.email || "").trim().toLowerCase();
  const o = { id: id("ord"), child_name: hero || "the child who is talking", child_age: Math.max(1, Math.min(12, Number(b.age) || 5)), pronoun: ["he", "she", "they"].includes(b.pronoun) ? b.pronoun : "they",
    look: String(b.look || "").trim().slice(0, 240), language: LANG[b.language] ? b.language : "en", style: STYLES[b.style] ? b.style : "storybook", robot: !!b.robot };
  await q(`insert into orders(id, kind, buyer_email, child_name, child_age, pronoun, look, occasion, language, style, status, paid_mode, amount_cents, source, told_text, teller_name, robot) values($1,'told',$2,$3,$4,$5,$6,$7,$8,$9,'paid','house',0,$10,$11,$12,$13)`,
    [o.id, /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null, o.child_name, o.child_age, o.pronoun, o.look, "a story told out loud by " + teller, o.language, o.style, String(b.source || "tell").slice(0, 20), told, teller, o.robot]);
  await ledger("told", "code", { teller, hero: hero || "a child (named in the story)", shared: !!b.share, words: told.split(" ").length, robot: o.robot, language: o.language, style: o.style }, o.id);
  const bid = await engine.startBook(o.id); if (!b.share) await q(`update books set public=false where id=$1`, [bid]);
  await engine.tick({ budgetMs: 2500, source: "tell" }).catch(() => {});
  await engine.chainPulse(0).catch(() => {});
  return c.json({ id: o.id, url: `/order/${o.id}` });
});
// Speech to text for browsers without live speech recognition: the recording is transcribed once and discarded.
app.post("/api/transcribe", async (c) => {
  const buf = Buffer.from(await c.req.arrayBuffer());
  if (buf.length < 2000) return c.json({ error: "That recording is empty." }, 400);
  if (buf.length > 4_000_000) return c.json({ error: "That recording is too long; keep it under three minutes." }, 400);
  const fd = new FormData(); fd.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe"); fd.append("file", new Blob([buf], { type: c.req.header("content-type") || "audio/webm" }), "story.webm");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return c.json({ error: "Couldn't hear that. Try again, or type the story." }, 502);
  return c.json({ text: String(j.text || "").trim() });
});
app.post("/api/subscribe", async (c) => { const b = await c.req.json().catch(() => ({})); const e = String(b.email || "").trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return c.json({ error: "Add a valid email." }, 400); await q(`insert into subscribers(email, source) values($1,'web') on conflict do nothing`, [e]); return c.json({ ok: true }); });

const STAGE = { write: ["author", "Writing the story"], paint: ["illustrator", "Painting"], narrate: ["narrator", "Recording the read-aloud"], bind: ["binder", "Binding the book"], deliver: ["mailroom", "Sending it to you"], read_call: ["storyteller", "Phoning someone to read it aloud"], revise: ["author", "Making your changes"], frontdesk: ["frontdesk", "Reading your message"], proof: ["proofreader", "Checking it on a real phone"], film: ["illustrator", "Animating pages into short films"] };
app.get("/api/order/:id", async (c) => {
  const o = await one(`select * from orders where id=$1`, [c.req.param("id")]); if (!o) return c.json({ error: "not found" }, 404);
  const b = o.book_id ? await one(`select id, title, status, cover_media_id, checks, look, blurb, dedication, ready_at from books where id=$1`, [o.book_id]) : null;
  const pages = b ? await q(`select idx, text, image_media_id, audio_media_id from pages where book_id=$1 order by idx`, [b.id]) : [];
  const jobs = await q(`select kind, status from jobs where order_id=$1 and status in ('queued','waiting')`, [o.id]);
  const events = await q(`select seq, created_at, kind, actor, detail from ledger where order_id=$1 order by seq`, [o.id]);
  return c.json({ order: { id: o.id, child_name: o.child_name, status: o.status, style: o.style, language: LANG[o.language], created_at: o.created_at, paid_mode: o.paid_mode, read_to: !!o.read_to_phone }, book: b, pages, working: [...new Set(jobs.map((j) => j.kind))].map((k) => STAGE[k]).filter(Boolean), events });
});

// ---------- books ----------
app.get("/api/book/:id", async (c) => {
  const raw = c.req.param("id");
  if (raw.endsWith(".pdf")) {
    const b = await one(`select * from books where id=$1`, [raw.slice(0, -4)]); if (!b?.pdf_media_id) return c.notFound();
    const m = await getMedia(b.pdf_media_id);
    return new Response(m.bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${(b.title || "book").replace(/[^\w ]+/g, "").trim().replace(/\s+/g, "_")}.pdf"` } });
  }
  const b = await one(`select id, title, dedication, blurb, hero_name, style, status, cover_media_id, cover_video_media_id, pdf_media_id, public, kind, checks, order_id, story->'robot_facts' as robot_facts from books where id=$1`, [raw]); if (!b) return c.json({ error: "not found" }, 404);
  const pages = await q(`select idx, text, image_media_id, audio_media_id, video_media_id from pages where book_id=$1 order by idx`, [b.id]);
  return c.json({ book: b, pages });
});
app.post("/api/book/:id/message", async (c) => {
  const b = await one(`select order_id from books where id=$1`, [c.req.param("id")]); if (!b) return c.json({ error: "not found" }, 404);
  const o = await one(`select * from orders where id=$1`, [b.order_id]); if (o.kind !== "custom") return c.json({ error: "Shelf books can't be changed; make one about your child instead." }, 400);
  const body = await c.req.json().catch(() => ({})); const text = String(body.text || "").trim(); if (text.length < 3) return c.json({ error: "Tell us what to change." }, 400);
  await q(`insert into messages(id, order_id, channel, direction, counterparty, subject, body) values($1,$2,'web','in',$3,'change request',$4)`, [id("msg"), o.id, o.buyer_email, text.slice(0, 4000)]);
  await engine.enqueue("frontdesk", { order_id: o.id, payload: { from: o.buyer_email, text, source: "reader page" } });
  return c.json({ ok: true });
});
app.post("/api/book/:id/read-to", async (c) => {
  const b = await one(`select id, order_id, status from books where id=$1`, [c.req.param("id")]); if (!b || b.status !== "ready") return c.json({ error: "The book isn't ready yet." }, 400);
  const body = await c.req.json().catch(() => ({})); const phone = e164(body.phone); if (!/^\+\d{8,15}$/.test(phone)) return c.json({ error: "Add a phone number with the country code." }, 400);
  if (!body.consent) return c.json({ error: "Please confirm they know an AI storyteller will call." }, 400);
  const o = await one(`select * from orders where id=$1`, [b.order_id]); if (o.kind !== "custom") return c.json({ error: "Read-aloud calls are for books you've made." }, 400);
  const calls = (await one(`select count(*)::int n from ledger where order_id=$1 and kind='read_call'`, [o.id])).n; if (calls >= 3) return c.json({ error: "This book has already been read aloud three times." }, 400);
  await q(`update orders set read_to_phone=$2, read_to_name=$3 where id=$1`, [o.id, phone, String(body.name || "").slice(0, 60) || null]);
  await engine.enqueue("read_call", { order_id: o.id, book_id: b.id }); engine.tick({ budgetMs: 3500, source: "read-to" }).catch(() => {});
  return c.json({ ok: true });
});
app.get("/api/media/:id", async (c) => {
  const m = await getMedia(c.req.param("id")); if (!m) return c.notFound();
  if (m.bytes) return new Response(m.bytes, { headers: { "Content-Type": m.mime, "Cache-Control": "public, max-age=604800, immutable" } });
  const url = await mediaRedirectUrl(m); return url ? c.redirect(url, 302) : c.notFound();
});

// ---------- company ----------
app.get("/api/board", async (c) => {
  const s = await one(`select count(*) filter (where kind='custom')::int orders, count(*) filter (where kind='custom' and status='delivered')::int delivered, coalesce(sum(captured_cents) filter (where kind='custom' and paid_mode in ('live','test')),0)::int revenue, coalesce(sum(amount_cents) filter (where kind='custom' and paid_mode='pledge'),0)::int pledged from orders`);
  const bk = await one(`select count(*) filter (where status='ready')::int ready, count(*) filter (where status='ready' and public)::int shelf, count(*) filter (where status not in ('ready'))::int making from books`);
  const pg = await one(`select count(image_media_id)::int painted, count(audio_media_id)::int narrated from pages`);
  const t = await one(`select percentile_cont(0.5) within group (order by extract(epoch from (b.ready_at - o.created_at))) med from books b join orders o on o.id=b.order_id where b.ready_at is not null`);
  const img = await one(`select coalesce(sum((detail->>'cost_usd')::numeric),0) usd, count(*)::int n from ledger where kind='paint'`);
  const calls = await one(`select coalesce(sum((detail->>'cost_usd')::numeric),0) usd, count(*)::int n from ledger where kind='read_call_done'`);
  const ag = await q(`select agent, count(*)::int runs, coalesce(sum(cost_micro_usd),0)::bigint cost, (array_agg(purpose order by started_at desc))[1] last_purpose, count(*) filter (where status='running')::int running from agent_runs group by agent order by agent`);
  const interventions = await q(`select created_at, who, what, why from interventions order by id desc limit 20`);
  const clearances = await q(`select seq, created_at, order_id, detail from ledger where kind='clearance_requested' order by seq desc limit 10`);
  const jobs = await q(`select id, kind, status, polls, errors, left(coalesce(error,''),140) error from jobs where status in ('queued','waiting') order by id desc limit 40`);
  const failed = await q(`select id, kind, updated_at, left(coalesce(error,''),160) error from jobs where status='failed' order by id desc limit 10`);
  const ledgerRows = await q(`select seq, created_at, kind, actor, order_id, detail, hash from ledger order by seq desc limit 120`);
  const agentUsd = ag.reduce((a, r) => a + Number(r.cost || 0), 0) / 1e6; const books = Math.max(1, bk.ready);
  return c.json({ mode: pay.mode(), stats: { ...s, ...bk, ...pg, median_seconds: t?.med ? Math.round(Number(t.med)) : null, subscribers: (await one(`select count(*)::int n from subscribers`)).n }, costs: { images_usd: Number(img.usd), calls_usd: Number(calls.usd), agents_usd: agentUsd, per_book_usd: (Number(img.usd) + agentUsd) / books }, agents: ag, interventions, clearances, jobs, failed, ledger: ledgerRows, chain: await verifyChain(), clock: await kvGet("clock"), monid: await monid.balance().catch(() => null) });
});
const DESK = { write: "author", revise: "author", paint: "illustrator", narrate: "narrator", bind: "binder", deliver: "mailroom", read_call: "storyteller", proof: "proofreader", frontdesk: "frontdesk", commission: "marketer", market: "marketer", film: "illustrator" };
app.get("/api/office", async (c) => {
  const since = Number(c.req.query("since") || 0);
  const jobs = await q(`select j.kind, j.order_id, j.page_id, o.child_name, o.kind as okind from jobs j left join orders o on o.id=j.order_id where j.status in ('queued','waiting') and j.next_run_at < now() + interval '2 minutes' order by j.id`);
  const staff = {};
  for (const j of jobs) { const a = DESK[j.kind]; if (!a) continue; const who = j.child_name ? first(j.child_name) : "tonight's shelf book";
    const doing = { write: `Writing ${who}'s story`, revise: `Revising ${who}'s book`, paint: `Painting ${who}'s pictures`, narrate: `Recording ${who}'s read-aloud`, bind: `Binding ${who}'s book`, deliver: `Mailing ${who}'s book`, read_call: `On the phone, reading ${who}'s book`, proof: `Checking ${who}'s book on a phone`, frontdesk: `Answering ${who}'s family`, commission: "Commissioning tonight's shelf book", market: "Publishing to the shelf and socials" }[j.kind];
    staff[a] = staff[a] ? { ...staff[a], n: staff[a].n + 1 } : { state: "working", doing, n: 1 }; }
  const events = await q(`select seq, created_at, kind, actor, order_id, detail from ledger where seq > $1 order by seq desc limit 50`, [since]);
  const making = await q(`select b.id, b.title, b.status, o.child_name, o.kind, (select count(image_media_id) from pages p where p.book_id=b.id)::int painted, (select count(*) from pages p where p.book_id=b.id)::int pages from books b join orders o on o.id=b.order_id where b.status <> 'ready' or b.ready_at > now() - interval '15 minutes' order by b.created_at desc limit 6`);
  const s = await one(`select count(*) filter (where status='ready')::int books, count(*) filter (where status='ready' and public)::int shelf from books`);
  const r = await one(`select coalesce(sum(captured_cents) filter (where kind='custom' and paid_mode in ('live','test')),0)::int revenue, coalesce(sum(amount_cents) filter (where kind='custom' and paid_mode='pledge'),0)::int pledged, count(*) filter (where kind='custom')::int orders from orders`);
  const pg = await one(`select count(image_media_id)::int painted from pages`);
  return c.json({ now: new Date().toISOString(), clock: await kvGet("clock"), staff, events: events.reverse(), making, stats: { ...s, ...r, ...pg }, mode: pay.mode() });
});
app.get("/api/ledger.json", async (c) => c.json(await q(`select * from ledger order by seq asc`)));
app.get("/api/verify", async (c) => c.json(await verifyChain()));

// ---------- clocks ----------
app.post("/api/pulse", async (c) => {
  const clock = await kvGet("clock"); const age = clock ? Date.now() - new Date(clock.at).getTime() : 1e12;
  const depth = Number(c.req.header("x-chain-depth") || 0);
  if (age < Number(process.env.PULSE_MIN_MS || 1500) && !depth) return c.json({ skipped: true, age });
  const r = await engine.tick({ budgetMs: Number(process.env.TICK_BUDGET_MS || 6500), source: depth ? "self-chain" : "pulse" });
  return c.json({ ...r, chained: await engine.chainPulse(depth) });
});
app.post("/api/webhooks/naive", async (c) => {
  const raw = await c.req.text();
  if (!mail.verifyNaive(raw, { "vetta-timestamp": c.req.header("vetta-timestamp"), "vetta-signature": c.req.header("vetta-signature") }, process.env.NAIVE_WEBHOOK_SECRET)) return c.json({ error: "bad signature" }, 401);
  const r = await engine.tick({ budgetMs: 5500, source: "naive-webhook" }); return c.json({ ...r, chained: await engine.chainPulse(0) });
});
app.post("/api/webhooks/agentmail", async (c) => {
  const raw = await c.req.text();
  const hdr = { "svix-id": c.req.header("svix-id"), "svix-timestamp": c.req.header("svix-timestamp"), "svix-signature": c.req.header("svix-signature") };
  if (process.env.AGENTMAIL_WEBHOOK_SECRET && process.env.AGENTMAIL_WEBHOOK_SECRET !== "none" && !mail.verifySvix(raw, hdr, process.env.AGENTMAIL_WEBHOOK_SECRET)) return c.json({ error: "bad signature" }, 401);
  const ev = JSON.parse(raw || "{}"); if (ev.event_type !== "message.received") return c.json({ ok: true });
  if (await kvGet(`am:${ev.event_id}`)) return c.json({ ok: true, dupe: true }); await kvSet(`am:${ev.event_id}`, true);
  const m = ev.message || {}; const fromAddr = (String(m.from || "").match(/[\w.+-]+@[\w.-]+/) || [""])[0].toLowerCase();
  const label = [...(m.labels || []), ...(ev.thread?.labels || [])].find((l) => /^ord_/.test(l));
  const o = label ? await one(`select * from orders where id=$1`, [label]) : await one(`select * from orders where lower(buyer_email)=$1 and kind='custom' order by created_at desc limit 1`, [fromAddr]);
  const text = String(m.extracted_text || m.text || m.preview || "");
  await q(`insert into messages(id, order_id, channel, direction, counterparty, subject, body, provider_id) values($1,$2,'email','in',$3,$4,$5,$6)`, [id("msg"), o?.id || null, m.from || fromAddr, m.subject || "", text.slice(0, 20000), String(m.message_id || "")]);
  if (o) { await engine.enqueue("frontdesk", { order_id: o.id, payload: { from: m.from || fromAddr, text, source: "email" } }); await engine.tick({ budgetMs: 3500, source: "agentmail-webhook" }); await engine.chainPulse(0); }
  return c.json({ ok: true, matched: !!o });
});

// ---------- operator (every use is an intervention) ----------
app.post("/api/admin/tick", async (c) => isAdmin(c) ? c.json(await engine.tick({ budgetMs: 7000, source: "admin" })) : c.text("no", 401));
app.post("/api/admin/commission", async (c) => { if (!isAdmin(c)) return c.text("no", 401); await engine.enqueue("commission", {}); await intervention("founder", "asked the Marketing desk for a shelf book now", "demo"); return c.json(await engine.tick({ budgetMs: 5000, source: "admin" })); });
app.post("/api/admin/retry-failed", async (c) => { if (!isAdmin(c)) return c.text("no", 401); const rows = await q(`update jobs set status='waiting', errors=0, error=null, lease_until=null, next_run_at=now() where status='failed' returning id, kind, order_id`); for (const r of rows) await intervention("founder", `retried failed ${r.kind} job #${r.id}`, "a platform issue was fixed", r.order_id); return c.json({ retried: rows.length }); });
app.post("/api/admin/intervene", async (c) => { if (!isAdmin(c)) return c.text("no", 401); const b = await c.req.json(); await intervention(b.who || "founder", b.what || "", b.why || "", b.order_id || null); return c.json({ ok: true }); });
app.get("/api/admin/diag", async (c) => { if (!isAdmin(c)) return c.text("no", 401); const { createHash } = await import("node:crypto"); const fp = (v) => v ? createHash("sha256").update(v).digest("hex").slice(0, 10) : null; return c.json({ company_key: fp(process.env.COMPANY_NAIVE_KEY), platform_key: fp(process.env.NAIVE_API_KEY), same: process.env.COMPANY_NAIVE_KEY === process.env.NAIVE_API_KEY }); });
app.get("/api/admin/orders", async (c) => isAdmin(c) ? c.json(await q(`select id, kind, child_name, buyer_email, status, created_at, book_id from orders order by created_at desc limit 50`)) : c.text("no", 401));
