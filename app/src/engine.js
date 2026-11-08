/**
 * Nightlight Press's operating procedure. Agents write, paint and talk; code decides when, whether and
 * how much. Every step is a short job; every consequential thing is a hash-chained ledger entry.
 */
import sharp from "sharp";
import { q, one, id, ledger, kvSet, kvGet } from "./db.js";
import { enqueue, claim, park, done, fail, Retry } from "./jobs.js";
import * as nv from "./naive.js";
import * as monid from "./monid.js";
import * as mail from "./agentmail.js";
import * as mr from "./mobilerun.js";
import { AUTHOR, FRONTDESK, MARKETER, TELLER, WORLD, WORLD_ART, WORLD_SEEDS, ROBOT_LOOK, ROBOT_STORY, fill, SCHEMAS, LANG, STYLES } from "./prompts.js";
const WORLD_ON = () => process.env.WORLD !== "classic";
import { checkStory, maxWordsFor } from "./editor.js";
import { renderBook } from "./picturebook.js";
import { putMedia, getMedia } from "./media.js";

const BASE = () => process.env.PUBLIC_BASE_URL || "http://localhost:3100";
const PAGES = () => Number(process.env.BOOK_PAGES || 10);
const US = (p) => /^\+1[2-9]\d{9}$/.test(String(p || ""));
const order = (oid) => one(`select * from orders where id=$1`, [oid]);
const book = (bid) => one(`select * from books where id=$1`, [bid]);
const hasActive = async (kind, field, value) => !!(await one(`select 1 from jobs where kind=$1 and ${field}=$2 and status in ('queued','waiting') limit 1`, [kind, value]));

/** One Naïve agent session as a resumable phase of a job. */
async function agentPhase(job, { agent, purpose, message, schema, budget = 400_000, phase = 0, maxMinutes = 5 }) {
  const p = job.payload || {}; const key = `phase_${phase}`;
  if (!p[key]) {
    const s = await nv.startSession(agent, message, { budget_micro_usd: budget, output_schema: schema, metadata: { order_id: job.order_id || "", job: String(job.id), purpose } });
    await q(`insert into agent_runs(id, agent, job_id, order_id, purpose) values($1,$2,$3,$4,$5) on conflict (id) do nothing`, [s.id, agent, job.id, job.order_id, purpose]);
    await ledger("agent_start", `agent:${agent}`, { purpose, session: s.id }, job.order_id);
    p[key] = { session: s.id, at: Date.now() };
    await park(job, { ms: 3000, payload: p }); return { state: "waiting" };
  }
  const r = await nv.checkSession(p[key].session);
  if (!r.done) {
    if (Date.now() - p[key].at > maxMinutes * 60_000) { await q(`update agent_runs set ended_at=now(), status='timeout' where id=$1`, [p[key].session]); delete p[key]; await park(job, { ms: 500, payload: p }); return { state: "waiting" }; }
    await park(job, { ms: 2000 }); return { state: "waiting" };
  }
  await q(`update agent_runs set ended_at=now(), status=$2, cost_micro_usd=$3, summary=$4 where id=$1`, [p[key].session, r.ok ? "done" : "failed", r.cost || 0, String(r.text || JSON.stringify(r.output || {})).slice(0, 300)]);
  if (!r.ok || (schema && !r.output)) { delete p[key]; p.fails = (p.fails || 0) + 1; if (p.fails >= 3) throw new Error(`${agent} ${purpose} failed: ${r.status}/${r.stop_reason}`); await park(job, { ms: 3000, payload: p }); return { state: "waiting" }; }
  return { state: "done", output: r.output, text: r.text, cost: r.cost, payload: p };
}

// ---------- intake ----------
export async function startBook(oid) {
  const o = await order(oid); if (!o) return null;
  if (o.book_id) return o.book_id;
  const bid = id("bk");
  await q(`insert into books(id, order_id, kind, hero_name, look, style, language, age, status, public, price_cents) values($1,$2,$3,$4,$5,$6,$7,$8,'writing',$9,$10)`, [bid, o.id, o.kind, o.child_name, o.look, o.style, o.language, o.child_age, o.kind === "catalog" || o.kind === "told", 0]);
  await q(`update orders set book_id=$2, status='making' where id=$1`, [o.id, bid]);
  await enqueue("write", { order_id: o.id, book_id: bid });
  await ledger("commission", "code", { book: bid, hero: o.child_name, age: o.child_age, style: o.style, language: o.language, kind: o.kind, robot: !!o.robot, teller: o.teller_name || undefined }, o.id);
  return bid;
}

const H = {};
H.write = async (job) => {
  const o = await order(job.order_id); const b = await book(job.book_id);
  const p = job.payload || {};
  const vars = { age: o.child_age || 5, language: LANG[o.language] || "English", name: o.child_name, pronoun: o.pronoun, look: o.look || "the illustrator may choose a friendly, simple look", favorites: o.favorites || "playing outside, stories, animals", occasion: o.occasion || "a cosy adventure before bedtime", pages: o.kind === "told" ? Number(process.env.TOLD_PAGES || 8) : PAGES(), max_words: maxWordsFor(o.child_age || 5), from: o.kind === "catalog" ? "Nightlight Press" : o.buyer_name || "someone who loves them", robot: o.robot ? ROBOT_STORY : "", world: WORLD_ON() ? WORLD : "", teller: o.teller_name || "a storyteller", told: String(o.told_text || "").slice(0, 8000) };
  let msg = fill(o.kind === "told" ? TELLER : AUTHOR, vars);
  if (p.feedback) msg += `\n\nYour previous draft failed the Editor's checks: ${p.feedback}. Fix exactly those problems and return the whole book again.\nPrevious draft: ${JSON.stringify(p.draft).slice(0, 12000)}`;
  const r = await agentPhase(job, { agent: "author", purpose: p.feedback ? `rewrite ${o.child_name}'s book for the Editor` : `write ${o.child_name}'s book`, message: msg, schema: SCHEMAS.story, budget: 600_000, phase: p.round || 0 });
  if (r.state !== "done") return "waiting";
  const story = r.output;
  if (o.kind === "told" && o.child_name === "the child who is talking" && story.hero_name) { const hn = String(story.hero_name).trim().split(/\s+/)[0].slice(0, 40); await q(`update orders set child_name=$2 where id=$1`, [o.id, hn]); await q(`update books set hero_name=$2 where id=$1`, [b.id, hn]); o.child_name = hn; b.hero_name = hn; }
  const check = checkStory(story, { name: o.child_name, age: o.child_age || 5, language: o.language });
  const facts = Array.isArray(story.robot_facts) ? story.robot_facts : []; if (facts.length < 3 || facts.some((f) => String(f).split(/\s+/).length > 26)) { check.pass = false; check.issues.push("the Learn about robots page needs three facts of at most 25 words each"); }
  if (o.robot) { const sales = story.pages.filter((pg) => /\b(buy|buying|bought|price|prices|sale|store|shop|shopping)\b|\$\d/i.test(pg.text)).length; if (sales) { check.pass = false; check.issues.push(`${sales} page(s) mention buying, shops or prices; a robot friend must never sell anything`); } }
  await ledger("edit_check", "code:editor", { book: b.id, pass: check.pass, issues: check.issues, words: check.words, reading_grade: check.reading_grade, round: (p.round || 0) + 1 }, o.id);
  if (!check.pass && (p.round || 0) < 1) { const np = { ...r.payload, round: (p.round || 0) + 1, feedback: check.issues.join("; "), draft: story }; await park(job, { ms: 200, payload: np }); return "rewrite"; }
  await q(`update books set title=$2, dedication=$3, look=$4, blurb=$5, story=$6, checks=$7, status='illustrating' where id=$1`, [b.id, story.title, story.dedication, story.hero_look || o.look, story.blurb, JSON.stringify(story), JSON.stringify(check)]);
  for (let i = 0; i < story.pages.length; i++) await q(`insert into pages(id, book_id, idx, text, scene) values($1,$2,$3,$4,$5) on conflict (book_id, idx) do update set text=excluded.text, scene=excluded.scene, image_media_id=null, audio_media_id=null`, [id("pg"), b.id, i + 1, story.pages[i].text, story.pages[i].scene]);
  await q(`delete from pages where book_id=$1 and idx > $2`, [b.id, story.pages.length]);
  await ledger("story", "agent:author", { book: b.id, title: story.title, pages: story.pages.length, words: check.words }, o.id);
  const ps = await q(`select id, idx from pages where book_id=$1 order by idx`, [b.id]);
  await enqueue("paint", { order_id: o.id, book_id: b.id, payload: { cover: true } });
  for (const pg of ps) { await enqueue("paint", { order_id: o.id, book_id: b.id, page_id: pg.id }); await enqueue("narrate", { order_id: o.id, book_id: b.id, page_id: pg.id }); }
  return done(job, { title: story.title });
};

function artPrompt(b, scene, { cover = false, robot = false } = {}) {
  const style = STYLES[b.style] || STYLES.watercolor;
  return `${style}. ${cover ? `The front cover of a children's picture book called "${b.title}": the hero in a joyful, inviting moment that sums up the story, with calm empty space in the top third for the title` : `A page from a children's picture book. ${scene}`}. The hero, ${b.hero_name}, appears exactly as described: ${b.look}. Keep the hero's face, hair, skin tone, clothes and signature item identical to every other page of this book.${robot ? ` The hero's robot friend Pip appears beside them, drawn identically on every page: ${ROBOT_LOOK}.` : ""}${(b.story?.cast || []).length ? ` Other recurring characters, drawn exactly like this whenever they appear: ${(b.story.cast || []).slice(0, 4).map((c) => `${c.name}: ${c.look}`).join("; ")}.` : ""} ${WORLD_ON() ? WORLD_ART.trim() + " " : ""}Safe, gentle and joyful for young children. Absolutely no text, letters, numbers, words, captions or logos anywhere in the image.`;
}
H.paint = async (job) => {
  const b = await book(job.book_id); const p = job.payload || {};
  const pg = job.page_id ? await one(`select * from pages where id=$1`, [job.page_id]) : null;
  if (!p.run) {
    const ord = await order(job.order_id);
    const prompt = artPrompt(b, pg?.scene || "", { cover: !!p.cover, robot: !!ord?.robot });
    if (pg) await q(`update pages set prompt=$2 where id=$1`, [pg.id, prompt]);
    const run = await monid.startRun("openai", process.env.IMAGE_ENDPOINT || "/v1/image/gpt-image-2.5-sunburst", { body: { prompt, size: "1536x1024", quality: process.env.IMAGE_QUALITY || "medium" }, maxCost: 0.3 });
    if (run.status === "BLOCKED") throw new Error(`illustrator blocked: ${run.reason || ""}`);
    return park(job, { ms: 9000, payload: { ...p, run: run.runId, at: Date.now() } });
  }
  const run = await monid.getRun(p.run);
  if (!monid.TERMINAL.has(run.status)) { if (Date.now() - p.at > 4 * 60_000) { await monid.stopRun(p.run).catch(() => {}); return park(job, { ms: 500, payload: { cover: p.cover } }); } return park(job, { ms: 4000 }); }
  const url = monid.findUrl(monid.out(run));
  if (!url) { if ((p.tries || 0) < 2) return park(job, { ms: 1000, payload: { cover: p.cover, tries: (p.tries || 0) + 1 } }); throw new Error(`no image (${run.status} ${run?.providerResponse?.httpStatus})`); }
  const res = await fetch(url); if (!res.ok) throw new Retry(`image download ${res.status}`, 4000);
  const jpg = await sharp(Buffer.from(await res.arrayBuffer())).resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const mid = await putMedia({ order_id: job.order_id, kind: p.cover ? "cover" : "page", mime: "image/jpeg", bytes: jpg, meta: { book: b.id, page: pg?.idx || 0, cost_usd: run?.cost?.value ?? null } });
  if (p.cover) await q(`update books set cover_media_id=$2 where id=$1`, [b.id, mid]); else await q(`update pages set image_media_id=$2 where id=$1`, [pg.id, mid]);
  await ledger("paint", "agent:illustrator", { book: b.id, page: p.cover ? "cover" : pg.idx, media: mid, bytes: jpg.length, cost_usd: run?.cost?.value ?? null }, job.order_id);
  await maybeBind(b.id, job.order_id);
  return done(job, { media: mid });
};

H.narrate = async (job) => {
  const b = await book(job.book_id); const pg = await one(`select * from pages where id=$1`, [job.page_id]);
  const text = pg.idx === 1 ? `${b.title}. ${pg.text}` : pg.text;
  let mid = null;
  if (process.env.NARRATION !== "openai") {
    try { const s = await nv.speak(text, { voice: process.env.NARRATOR_VOICE || "sage" }); if (s.fileId) mid = await putMedia({ order_id: job.order_id, kind: "audio", mime: s.mime, naive_file_id: s.fileId, meta: { book: b.id, page: pg.idx, seconds: s.seconds, provider: "naive" } }); }
    catch (e) { if (!process.env.OPENAI_API_KEY) throw e; }
  }
  if (!mid) {
    const r = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts", voice: process.env.OPENAI_TTS_VOICE || "sage", input: text, instructions: "You are reading a picture book aloud at bedtime to a small child: warm, gentle, smiling, unhurried, with little pauses.", response_format: "mp3" }) });
    if (!r.ok) throw new Retry(`tts ${r.status}`, 5000);
    mid = await putMedia({ order_id: job.order_id, kind: "audio", mime: "audio/mpeg", bytes: Buffer.from(await r.arrayBuffer()), meta: { book: b.id, page: pg.idx, provider: "openai" } });
  }
  await q(`update pages set audio_media_id=$2 where id=$1`, [pg.id, mid]);
  await ledger("narrate", "agent:narrator", { book: b.id, page: pg.idx }, job.order_id);
  await maybeBind(b.id, job.order_id);
  return done(job, {});
};

async function maybeBind(bid, oid) {
  const s = await one(`select count(*)::int n, count(image_media_id)::int img, count(audio_media_id)::int aud from pages where book_id=$1`, [bid]);
  const b = await book(bid);
  if (s.n && s.img === s.n && s.aud === s.n && b.cover_media_id && b.status === "illustrating" && !(await hasActive("bind", "book_id", bid))) { await q(`update books set status='binding' where id=$1`, [bid]); await enqueue("bind", { order_id: oid, book_id: bid }); }
}

H.bind = async (job) => {
  const b = await book(job.book_id); const o = await order(job.order_id);
  const pages = await q(`select p.idx, p.text, m.bytes from pages p left join media m on m.id=p.image_media_id where p.book_id=$1 order by p.idx`, [b.id]);
  const cover = b.cover_media_id ? (await getMedia(b.cover_media_id))?.bytes : null;
  const pdf = await renderBook(b, pages, cover, { forName: o.kind === "custom" ? o.child_name : null, robot: !!o.robot, teller: o.kind === "told" ? o.teller_name : null });
  const mid = await putMedia({ order_id: o.id, kind: "book", mime: "application/pdf", bytes: pdf, meta: { book: b.id, pages: pages.length } });
  await q(`update books set pdf_media_id=$2, status='ready', ready_at=now() where id=$1`, [b.id, mid]);
  const mins = Math.round((Date.now() - new Date(o.created_at).getTime()) / 6000) / 10;
  await ledger("bind", "agent:binder", { book: b.id, pages: pages.length, pdf_bytes: pdf.length, minutes_since_order: mins }, o.id);
  await q(`update orders set status='ready' where id=$1`, [o.id]);
  const revised = await kvGet(`revised:${b.id}`);
  if (revised) await q(`delete from kv where k=$1`, [`revised:${b.id}`]);
  if (!revised) await queueFilm(b, o.id);
  if (o.kind === "catalog") { if (!revised) await enqueue("market", { order_id: o.id, book_id: b.id }); }
  else await enqueue("deliver", { order_id: o.id, book_id: b.id, payload: { revised: !!revised } });
  return done(job, { minutes: mins });
};

H.deliver = async (job) => {
  const b = await book(job.book_id); const o = await order(job.order_id); const p = job.payload || {};
  const link = `${BASE()}/book/${b.id}`;
  const text = `${p.revised ? "Here is the revised book" : `${o.child_name}'s book is ready`}: "${b.title}".\n\nRead it and listen to it here (tap "Read to me" at bedtime):\n${link}\n\nThe PDF is attached, ready to print. If anything should change (a name, hair colour, a pet, a word), just reply to this email and our Front Desk will fix it.\n\nNightlight Press\nWritten, illustrated, narrated and bound by our AI staff.`;
  const pdf = b.pdf_media_id ? await getMedia(b.pdf_media_id) : null;
  const attachments = pdf?.bytes && pdf.bytes.length < 4_300_000 ? [{ filename: `${b.title.replace(/[^\w ]+/g, "").trim().replace(/\s+/g, "_") || "book"}.pdf`, content_type: "application/pdf", content: pdf.bytes.toString("base64") }] : [{ filename: "book.pdf", content_type: "application/pdf", url: `${BASE()}/api/book/${b.id}.pdf` }];
  if (o.buyer_email) {
    try {
      const sent = await mail.sendEmail({ to: o.buyer_email, subject: `${p.revised ? "Revised: " : ""}"${b.title}", a book starring ${o.child_name}`, text, attachments, labels: ["nightlight", o.id] });
      await q(`insert into messages(id, order_id, channel, direction, counterparty, subject, body, provider_id) values($1,$2,'email','out',$3,$4,$5,$6)`, [id("msg"), o.id, o.buyer_email, b.title, text, String(sent?.message_id || "")]);
      await ledger("deliver", "code:mailroom", { book: b.id, to: o.buyer_email.replace(/(.).+(@.+)/, "$1…$2"), revised: !!p.revised }, o.id);
    } catch (e) { await ledger("deliver_failed", "code:mailroom", { error: String(e.message).slice(0, 200) }, o.id); }
  }
  if (US(o.buyer_phone)) { try { await monid.sendSms(o.buyer_phone, `Nightlight Press: ${o.child_name}'s book "${b.title}" is ready: ${link}`); await ledger("sms", "code:mailroom", { to_last4: o.buyer_phone.slice(-4) }, o.id); } catch (e) { await ledger("sms_failed", "code:mailroom", { error: String(e.message).slice(0, 120) }, o.id); } }
  await q(`update orders set status='delivered' where id=$1`, [o.id]);
  if (o.read_to_phone && !p.revised && !(await hasActive("read_call", "book_id", b.id))) await enqueue("read_call", { order_id: o.id, book_id: b.id });
  await enqueue("proof", { order_id: o.id, book_id: b.id, delayMs: 5000 });
  return done(job, {});
};

H.read_call = async (job) => {
  const b = await book(job.book_id); const o = await order(job.order_id); const p = job.payload || {};
  if (!p.run) {
    const pages = await q(`select idx, text from pages where book_id=$1 order by idx`, [b.id]);
    const story = pages.map((x) => `[Page ${x.idx}] ${x.text}`).join("\n");
    const listener = o.read_to_name || "you";
    const greeting = `Hello ${listener === "you" ? "there" : listener}! This is Nightlight, an A I storyteller from Nightlight Press. ${o.buyer_name ? `${o.buyer_name.split(" ")[0]} asked me` : "I was asked"} to read you a brand new book starring ${o.child_name}, called ${b.title}. Shall I begin?`;
    const instructions = `You are Nightlight's storyteller, a warm and gentle AI voice. You have already introduced yourself as an AI. When they say yes (or anything friendly), read the book below aloud, page by page, slowly and warmly, with small pauses between pages. Read the words exactly as written. Do not add commentary while reading. If they ask a question, answer kindly in one sentence and continue. After the last page, say "The end. Sweet dreams," thank them, mention that ${o.child_name}'s family can read it again any time, and say goodbye. If they say they don't want to listen, apologise warmly and end the call.\n\nThe book "${b.title}":\n${story}`;
    const run = await monid.placeInterviewCall({ to: o.read_to_phone, instructions, greeting });
    await ledger("read_call", "agent:storyteller-line", { book: b.id, to_last4: String(o.read_to_phone).slice(-4), listener, run: run.runId, disclosed_ai: true }, o.id);
    return park(job, { ms: 8000, payload: { run: run.runId, at: Date.now() } });
  }
  const c = await monid.readCall(p.run);
  if (!c.done) { if (Date.now() - p.at > 9 * 60_000) await monid.hangUp(p.run); return park(job, { ms: 6000 }); }
  await ledger("read_call_done", "agent:storyteller-line", { book: b.id, duration_seconds: Number(c.output?.duration_seconds || 0), cost_usd: c.cost || 0, status: String(c.output?.status || c.status) }, o.id);
  return done(job, {});
};

H.proof = async (job) => {
  const b = await book(job.book_id); const p = job.payload || {};
  if (!p.task) {
    let dev = null; try { dev = await mr.readyDevice(); } catch (e) { if (e instanceof Retry) throw e; }
    if (!dev) { if (!(await kvGet("mobilerun_warned"))) { await ledger("proof_skipped", "code", { reason: "no Mobilerun phone connected yet" }, job.order_id); await kvSet("mobilerun_warned", true); } return done(job, { skipped: true }); }
    const schema = { type: "object", properties: { title_seen: { type: "string" }, picture_visible: { type: "boolean" } }, required: ["title_seen", "picture_visible"] };
    const t = await mr.runTask(dev, `Open the web browser (Safari on an iPhone, Chrome on Android). Tap the address bar, clear it, type exactly ${BASE()}/book/${b.id} and press Go, even if another page is already open. Wait for the book to load. Report the book's title exactly as shown, and whether a picture is visible on the page. Then tap the arrow to turn one page and confirm the next picture appears. Do not tap anything else.`, schema);
    await ledger("agent_start", "agent:proofreader", { purpose: `open "${b.title}" on a real phone`, task: t.id }, job.order_id);
    return park(job, { ms: 9000, payload: { task: t.id, at: Date.now() } });
  }
  const s = await mr.taskStatus(p.task);
  if (!["completed", "failed", "cancelled"].includes(String(s.status))) { if (Date.now() - p.at > 7 * 60_000) { await mr.stopTask(p.task); return done(job, { timeout: true }); } return park(job, { ms: 6000 }); }
  let shot = null; try { const sh = await mr.taskShots(p.task); const u = (sh.urls || []).slice(-1)[0]; if (u) { const r = await fetch(u); if (r.ok) shot = await putMedia({ order_id: job.order_id, kind: "proof", mime: r.headers.get("content-type") || "image/png", bytes: Buffer.from(await r.arrayBuffer()), meta: { book: b.id } }); } } catch { /* optional */ }
  const out = s.output || s.structured_output || {}; const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); const ok = !!s.succeeded && norm(out.title_seen).includes(norm(b.title).slice(0, 16));
  await ledger("proof", "agent:proofreader", { book: b.id, ok, title_seen: String(out.title_seen || "").slice(0, 120), screenshot: !!shot, steps: s.steps }, job.order_id);
  return done(job, { ok });
};

H.frontdesk = async (job) => {
  const o = await order(job.order_id); const b = o.book_id ? await book(o.book_id) : null; const p = job.payload || {};
  const msg = `${FRONTDESK}\n\nThe family's book: "${b?.title || "(not ready yet)"}", starring ${o.child_name}, ${b ? (b.story?.pages || []).length : 0} pages. Current look of the hero: ${b?.look || o.look || "unspecified"}.\nPage texts:\n${(b?.story?.pages || []).map((x, i) => `${i + 1}. ${x.text}`).join("\n").slice(0, 6000)}\n\nMessage from ${p.from || o.buyer_email}:\n${String(p.text || "").slice(0, 6000)}`;
  const r = await agentPhase(job, { agent: "frontdesk", purpose: `answer ${o.child_name}'s family`, message: msg, schema: SCHEMAS.frontdesk, budget: 200_000 });
  if (r.state !== "done") return "waiting";
  const out = r.output;
  await ledger("frontdesk", "agent:frontdesk", { intent: out.intent, pages: out.pages, escalate: !!out.escalate, source: p.source || "email" }, o.id);
  if (o.buyer_email && out.reply) { try { await mail.sendEmail({ to: o.buyer_email, subject: `Re: ${b?.title || "your book"}`, text: out.reply, labels: ["nightlight", o.id] }); await q(`insert into messages(id, order_id, channel, direction, counterparty, subject, body) values($1,$2,'email','out',$3,$4,$5)`, [id("msg"), o.id, o.buyer_email, "reply", out.reply]); } catch { /* best effort */ } }
  if (out.escalate) await ledger("clearance_requested", "agent:frontdesk", { reason: out.intent === "refund" ? "refund request: a person must approve" : "a person should read this message" }, o.id);
  if (b && ["revise_text", "revise_art", "revise_both"].includes(out.intent)) await enqueue("revise", { order_id: o.id, book_id: b.id, payload: { intent: out.intent, pages: out.pages || [], instructions: out.instructions } });
  return done(job, { intent: out.intent });
};

H.revise = async (job) => {
  const b = await book(job.book_id); const o = await order(job.order_id); const p = job.payload || {};
  const pages = await q(`select * from pages where book_id=$1 order by idx`, [b.id]);
  const targets = (p.pages && p.pages.length ? pages.filter((x) => p.pages.includes(x.idx)) : pages);
  if (p.intent === "revise_art" || p.intent === "revise_both") {
    if (/hair|skin|glasses|eyes|clothes|dress|shirt|look|wear|freckles|beard|curly|straight|tall|short/i.test(p.instructions || "")) await q(`update books set look = look || '. ' || $2 where id=$1`, [b.id, String(p.instructions).slice(0, 300)]);
  }
  if ((p.intent === "revise_text" || p.intent === "revise_both") && !p.texted) {
    const msg = `${fill(AUTHOR, { age: o.child_age || 5, language: LANG[o.language] || "English", name: o.child_name, pronoun: o.pronoun, look: b.look, favorites: o.favorites || "", occasion: o.occasion || "", pages: pages.length, max_words: maxWordsFor(o.child_age || 5), from: o.buyer_name || "" })}\n\nThe family asked for this change, which is authoritative: ${p.instructions}\nChange only what they asked; keep everything else identical. Current book: ${JSON.stringify(b.story).slice(0, 12000)}`;
    const r = await agentPhase(job, { agent: "author", purpose: `revise ${o.child_name}'s book for the family`, message: msg, schema: SCHEMAS.story, budget: 600_000 });
    if (r.state !== "done") return "waiting";
    const story = r.output; await q(`update books set title=$2, story=$3, revision=revision+1 where id=$1`, [b.id, story.title, JSON.stringify(story)]);
    for (let i = 0; i < Math.min(story.pages.length, pages.length); i++) if (story.pages[i].text !== pages[i].text) { await q(`update pages set text=$2, audio_media_id=null where id=$1`, [pages[i].id, story.pages[i].text]); await enqueue("narrate", { order_id: o.id, book_id: b.id, page_id: pages[i].id }); }
    await ledger("story", "agent:author", { book: b.id, revised: true }, o.id);
    p.texted = true;
  }
  if (p.intent === "revise_art" || p.intent === "revise_both") { for (const t of targets) { await q(`update pages set image_media_id=null where id=$1`, [t.id]); await enqueue("paint", { order_id: o.id, book_id: b.id, page_id: t.id }); } if (!p.pages?.length) await enqueue("paint", { order_id: o.id, book_id: b.id, payload: { cover: true } }); }
  await q(`update books set status='illustrating', revision=revision+1 where id=$1`, [b.id]);
  await q(`update orders set status='making' where id=$1`, [o.id]);
  await ledger("revise", "code", { book: b.id, intent: p.intent, pages: targets.map((t) => t.idx) }, o.id);
  await kvSet(`revised:${b.id}`, true);
  await maybeBind(b.id, o.id);
  return done(job, {});
};

// Catalog: the Marketing desk commissions a new public book each night and announces it.
H.commission = async (job) => {
  const recent = (await q(`select title from books where kind='catalog' order by created_at desc limit 12`)).map((r) => r.title).filter(Boolean).join("; ") || "nothing yet";
  const r = await agentPhase(job, { agent: "marketer", purpose: "commission tonight's shelf book", message: fill(MARKETER, { recent, world: WORLD_ON() ? WORLD : "", seeds: WORLD_ON() ? WORLD_SEEDS : "" }), schema: SCHEMAS.marketer, budget: 150_000 });
  if (r.state !== "done") return "waiting";
  const m = r.output; const oid = id("ord");
  await q(`insert into orders(id, kind, child_name, child_age, pronoun, look, favorites, occasion, style, language, status, paid_mode, amount_cents, source) values($1,'catalog',$2,$3,$4,$5,$6,$7,$8,'en','paid','house',0,'marketing')`, [oid, m.hero_name, m.age, m.pronoun, m.look, m.favorites, m.occasion, m.style]);
  await kvSet(`caption:${oid}`, m.caption);
  await ledger("commission_shelf", "agent:marketer", { hero: m.hero_name, occasion: m.occasion, style: m.style }, oid);
  await startBook(oid);
  return done(job, { order: oid });
};
H.market = async (job) => {
  const b = await book(job.book_id); const caption = (await kvGet(`caption:${job.order_id}`)) || `A new book on the Nightlight shelf: "${b.title}". Written, illustrated and narrated by our AI staff; make it about your child.`;
  await q(`update books set public=true, price_cents=0 where id=$1`, [b.id]);
  const posted = { caption, at: new Date().toISOString(), shelf: `${BASE()}/shelf`, channels: ["shelf"] };
  // newsletter to subscribers
  const subs = await q(`select email from subscribers order by created_at desc limit 90`);
  let sent = 0; for (const s of subs) { try { await mail.sendEmail({ to: s.email, subject: `New tonight: "${b.title}"`, text: `${caption}\n\nRead it free tonight:\n${BASE()}/book/${b.id}\n\nOr make a book starring your own child ($19, ready in minutes):\n${BASE()}/?from=${b.id}#make\n\nNightlight Press (reply STOP to unsubscribe)` }); sent++; } catch { break; } }
  if (sent) posted.channels.push(`newsletter:${sent}`);
  // social post from a real phone, when one is connected
  // Posting to social media from a phone is public and permanent, so it needs an explicit opt-in (MOBILERUN_SOCIAL=1).
  let dev = null; if (process.env.MOBILERUN_SOCIAL === "1") { try { dev = await mr.readyDevice(); } catch { /* none */ } }
  if (dev) { try { const t = await mr.runTask(dev, `Open the Instagram app. Create a new post using the most recent image in the gallery if one is there; otherwise open the web browser to ${BASE()}/book/${b.id}. Write this caption exactly: "${caption.replace(/"/g, "'")}". Share it. Report whether it was posted.`); posted.channels.push("instagram"); posted.task = t.id; } catch (e) { posted.instagram_error = String(e.message).slice(0, 120); } }
  await q(`update books set posted=$2 where id=$1`, [b.id, JSON.stringify(posted)]);
  await ledger("publish", "agent:marketer", { book: b.id, title: b.title, cover: b.cover_media_id, channels: posted.channels }, job.order_id);
  return done(job, posted);
};

// ---------- the clock ----------
export async function tick({ budgetMs = 6500, source = "timer" } = {}) {
  const t0 = Date.now(); const did = [];
  await kvSet("clock", { at: new Date().toISOString(), source });
  if (process.env.AUTO_SHELF !== "0") {
    // one atomic claim, so concurrent ticks can never commission the same night's book twice
    const due = await one(`insert into kv(k, v, updated_at) values('last_commission', '0', now()) on conflict (k) do update set v='0', updated_at=now() where kv.updated_at < now() - ($1 || ' hours')::interval returning k`, [String(Number(process.env.SHELF_EVERY_HOURS || 12))]);
    if (due) await enqueue("commission", {});
  }
  while (Date.now() - t0 < budgetMs) {
    const job = await claim(); if (!job) break;
    const h = H[job.kind]; if (!h) { await fail(job, new Error(`no handler for ${job.kind}`)); continue; }
    try { const r = await h(job); did.push(`${job.kind}#${job.id}:${typeof r === "string" ? r : "ok"}`); }
    catch (e) { const r = await fail(job, e); did.push(`${job.kind}#${job.id}:${r}`); if (r === "failed") await ledger("job_failed", "code", { job: job.id, kind: job.kind, error: String(e.message).slice(0, 200) }, job.order_id); }
  }
  return { ran: did.length, did, ms: Date.now() - t0, source };
}

// ---------- the Film desk: animate the cover and two key pages ----------
const FILM_ON = () => process.env.FILM !== "0" && /^https:\/\//.test(BASE());
H.film = async (job) => {
  const b = await book(job.book_id); const p = job.payload || {};
  const pg = job.page_id ? await one(`select * from pages where id=$1`, [job.page_id]) : null;
  const imageId = pg ? pg.image_media_id : b.cover_media_id; if (!imageId) return done(job, { skipped: "no picture" });
  if (!p.run) {
    const prompt = `Gentle storybook animation of this painted picture-book ${pg ? "page" : "cover"}: the characters move softly and naturally${pg?.scene ? ` (${String(pg.scene).slice(0, 300)})` : ""}, friendly robots blink and roll, leaves and light shimmer, a slow camera push-in. Keep the painting style and every character exactly as painted. No text.`;
    const run = await monid.startRun("kling", process.env.FILM_ENDPOINT || "/v1/video/kling-2.5-turbo-i2v", { body: { prompt, media: [{ type: "first_frame", url: `${BASE()}/api/media/${imageId}` }], duration: 5, resolution: "720p" }, maxCost: 0.35 });
    if (run.status === "BLOCKED") throw new Error(`film blocked: ${run.reason || ""}`);
    await ledger("agent_start", "agent:film", { purpose: `animate ${pg ? `page ${pg.idx}` : "the cover"} of "${b.title}"`, run: run.runId }, job.order_id);
    return park(job, { ms: 20000, payload: { run: run.runId, at: Date.now() } });
  }
  const run = await monid.getRun(p.run);
  if (!monid.TERMINAL.has(run.status)) { if (Date.now() - p.at > 9 * 60_000) return done(job, { timeout: true }); return park(job, { ms: 15000 }); }
  const url = monid.findUrl(monid.out(run)); if (!url) return done(job, { failed: run.status });
  // Clips are too big to stream through a serverless response, so the app redirects to them: Kling's link
  // (valid 30 days) and a durable copy in Naïve Files.
  let fid = null, size = 0; try { const res = await fetch(url); if (res.ok) { const buf = Buffer.from(await res.arrayBuffer()); size = buf.length; fid = await nv.uploadFile(buf, `${b.id}-${pg ? `page-${pg.idx}` : "cover"}.mp4`, "video/mp4"); } } catch { /* the Kling link still works */ }
  const bytes = { length: size };
  const mid = await putMedia({ order_id: job.order_id, kind: "video", mime: "video/mp4", url, naive_file_id: fid, meta: { book: b.id, page: pg?.idx || 0, cost_usd: run?.cost?.value ?? null, url_expires: Date.now() + 29 * 86400_000 } });
  if (pg) await q(`update pages set video_media_id=$2 where id=$1`, [pg.id, mid]); else await q(`update books set cover_video_media_id=$2 where id=$1`, [b.id, mid]);
  await ledger("film", "agent:film", { book: b.id, page: pg ? pg.idx : "cover", bytes: bytes.length, cost_usd: run?.cost?.value ?? null }, job.order_id);
  return done(job, { media: mid });
};
async function queueFilm(b, oid) {
  if (!FILM_ON() || (await hasActive("film", "book_id", b.id))) return;
  const ps = await q(`select id, idx from pages where book_id=$1 order by idx`, [b.id]);
  const picks = [ps[Math.floor(ps.length / 2)], ps[ps.length - 1]].filter(Boolean);
  await enqueue("film", { order_id: oid, book_id: b.id });
  for (const x of picks) await enqueue("film", { order_id: oid, book_id: b.id, page_id: x.id });
}

// ---------- self-continuation ----------
// On serverless hosting nothing runs between requests. After a tick, if work is due, the app wakes itself
// again, so a book finishes in minutes even when nobody is watching. One chain at a time (a lease in kv),
// and a depth cap so it can never loop forever.
export async function dueCount() { return (await one(`select count(*)::int n from jobs where status in ('queued','waiting') and next_run_at <= now() + interval '10 seconds'`)).n; }
export async function chainPulse(depth = 0) {
  const base = BASE();
  if (!/^https:\/\//.test(base) || process.env.SELF_PULSE === "0") return false;
  if (depth >= Number(process.env.CHAIN_MAX || 400)) return false;
  if (!(await dueCount())) return false;
  const lease = await one(`insert into kv(k, v, updated_at) values('chain', '0', now()) on conflict (k) do update set updated_at=now() where $1::int > 0 or kv.updated_at < now() - interval '15 seconds' returning k`, [depth]);
  if (!lease) return false;
  try { await fetch(`${base}/api/pulse`, { method: "POST", headers: { "x-chain-depth": String(depth + 1) }, signal: AbortSignal.timeout(1500) }); } catch { /* the next invocation runs on its own */ }
  return true;
}
export { enqueue };
