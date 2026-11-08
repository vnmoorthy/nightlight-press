// Nightlight Press pitch deck generator (10 slides, LAYOUT_WIDE, "Daybreak storybook" theme).
//
//   node make_deck.js <out.pptx> [theme.json]
//
// Every image and video is looked up in ../../assets at build time. A missing (or still-rendering)
// file becomes a dashed "pending" placeholder, so re-running build.sh later picks up the real
// screens and renders without touching this file.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const pptxgen = require("pptxgenjs");
const React = require("react");
const RDS = require("react-dom/server");
const sharp = require("sharp");
const FA = require("react-icons/fa6");

const OUT = path.resolve(process.argv[2] || path.join(__dirname, "..", "Nightlight.raw.pptx"));
const THEME_OUT = process.argv[3] ? path.resolve(process.argv[3]) : null;
const ASSETS = path.resolve(process.env.NL_ASSETS || path.join(__dirname, "..", "..", "assets"));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "nl-deck-"));

const LIVE_URL = "https://nightlight-press-z5ept2z3by3j.vercel.app";
const LIVE_SHORT = "nightlight-press-z5ept2z3by3j.vercel.app";
const REPO_URL = "https://github.com/vnmoorthy/nightlight-press";
const REPO_SHORT = "github.com/vnmoorthy/nightlight-press";

// ---------------------------------------------------------------- theme
const HEX = {
  ink: "22223B", muted: "6B6A80", white: "FFFFFF", paper: "FFF8EC", paper2: "FFF1DA",
  tomato: "FF6B4A", sun: "FFC233", sky: "4DA8DA", leaf: "3BB273", lilac: "B8A1FF",
};
const THEME = {
  name: "Nightlight Daybreak",
  headFontFace: "Bookman Old Style",
  bodyFontFace: "Calibri",
  colors: {
    dk1: HEX.ink, lt1: HEX.white, dk2: HEX.muted, lt2: HEX.paper,
    accent1: HEX.tomato, accent2: HEX.sun, accent3: HEX.sky, accent4: HEX.leaf, accent5: HEX.lilac, accent6: HEX.paper2,
    hlink: HEX.tomato, folHlink: HEX.lilac,
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Nightlight Press";
pres.subject = "A children's picture-book publisher with no employees";
pres.author = "Nightlight Press";
pres.company = "Nightlight Press";

const C = pres.SchemeColor;
const INK = C.text1, MUTED = C.text2, WHITE = C.background1, PAPER = C.background2;
const TOMATO = C.accent1, SUN = C.accent2, SKY = C.accent3, LEAF = C.accent4, LILAC = C.accent5, PAPER2 = C.accent6;
const HEAD = "+mj-lt"; // theme heading font (Bookman Old Style) for non-title text
const SH = pres.shapes;
const W = 13.333, H = 7.5;

// fresh option objects every call (pptxgenjs mutates them)
const cutShadow = (o = 3) => ({ type: "outer", color: HEX.ink, opacity: 0.16, blur: 2, offset: o, angle: 90 });

// ---------------------------------------------------------------- assets
function fileOk(rel, minBytes) {
  const p = path.join(ASSETS, rel);
  try { const st = fs.statSync(p); return st.isFile() && st.size >= minBytes ? p : null; } catch { return null; }
}
function firstImage(cands) { for (const c of cands) { const p = fileOk(c, 2000); if (p) return p; } return null; }
function probeVideo(p) {
  try {
    const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", p], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const j = JSON.parse(out); const s = (j.streams || [])[0]; const d = parseFloat((j.format || {}).duration);
    if (!s || !s.width || !s.height || !(d > 0.5)) return null;
    return { w: s.width, h: s.height, dur: d };
  } catch { return null; }
}
function firstVideo(cands) {
  for (const c of cands) {
    const p = fileOk(c, 50000); if (!p) continue;
    const meta = probeVideo(p); if (meta) return { path: p, ...meta };
  }
  return null;
}
async function cropTo(p, boxW, boxH, position = "top") {
  const pxW = Math.min(2000, Math.round(boxW * 220));
  const pxH = Math.round(pxW * boxH / boxW);
  const buf = await sharp(p).resize(pxW, pxH, { fit: "cover", position }).jpeg({ quality: 86 }).toBuffer();
  return "image/jpeg;base64," + buf.toString("base64");
}
async function posterFor(video, boxW, boxH) {
  const png = path.join(TMP, `poster-${path.basename(video.path)}.png`);
  try {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(Math.min(1.5, video.dur * 0.4)), "-i", video.path, "-frames:v", "1", png]);
  } catch { return null; }
  const buf = await sharp(png).resize(Math.round(boxW * 160), Math.round(boxH * 160), { fit: "cover" }).png().toBuffer();
  return "data:image/png;base64," + buf.toString("base64");
}
const iconCache = {};
async function icon(name, hex = HEX.white) {
  const key = name + hex; if (iconCache[key]) return iconCache[key];
  const Comp = FA[name] || FA.FaStar;
  const svg = RDS.renderToStaticMarkup(React.createElement(Comp, { color: "#" + hex, size: 256 }));
  const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  return (iconCache[key] = "image/png;base64," + buf.toString("base64"));
}

// dashed card that says what will go here
function pending(slide, box, label, dark = false) {
  slide.addText([
    { text: "Pending: ", options: { bold: true } },
    { text: label },
  ], {
    shape: SH.ROUNDED_RECTANGLE, rectRadius: 0.12, x: box.x, y: box.y, w: box.w, h: box.h,
    fill: { color: dark ? INK : PAPER2 }, line: { color: dark ? SUN : MUTED, width: 1.25, dashType: "dash" },
    color: dark ? PAPER : MUTED, fontSize: 12, align: "center", valign: "middle", isTextBox: true,
    objectName: box.name ? box.name + "-pending" : "pending",
  });
}
// paper-cut card frame + picture cropped to fill it
async function framedImage(slide, cands, box, opts = {}) {
  const pad = opts.pad ?? 0.1;
  slide.addShape(SH.ROUNDED_RECTANGLE, {
    x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad, rectRadius: 0.14,
    fill: { color: opts.frame || WHITE }, line: { type: "none" }, shadow: cutShadow(4), rotate: opts.rotate || 0,
    objectName: (opts.name || "img") + "-frame",
  });
  const p = firstImage(cands);
  if (!p) { pending(slide, box, opts.label || cands[0], opts.dark); return null; }
  slide.addImage({
    data: await cropTo(p, box.w, box.h, opts.position || "top"), x: box.x, y: box.y, w: box.w, h: box.h,
    rotate: opts.rotate || 0, altText: opts.alt || opts.label || path.basename(p), objectName: opts.name || "img",
  });
  return p;
}
// autoplay video (motion.py wires playback) or still image fallback
async function framedVideoOr(slide, videoCands, imageCands, box, opts = {}) {
  const v = firstVideo(videoCands);
  if (!v) return { kind: "image", path: await framedImage(slide, imageCands, box, opts) };
  // contain the video inside the box, keep its aspect
  let w = box.w, h = box.w * v.h / v.w;
  if (h > box.h) { h = box.h; w = box.h * v.w / v.h; }
  const x = box.x + (box.w - w) / 2, y = box.y + (box.h - h) / 2;
  const pad = opts.pad ?? 0.1;
  slide.addShape(SH.ROUNDED_RECTANGLE, {
    x: x - pad, y: y - pad, w: w + 2 * pad, h: h + 2 * pad, rectRadius: 0.14,
    fill: { color: opts.frame || WHITE }, line: { type: "none" }, shadow: cutShadow(4), objectName: (opts.name || "video") + "-frame",
  });
  const posterImg = firstImage(opts.poster || []);
  const cover = posterImg
    ? "data:image/png;base64," + (await sharp(posterImg).resize(Math.round(w * 160), Math.round(h * 160), { fit: "cover" }).png().toBuffer()).toString("base64")
    : await posterFor(v, w, h);
  const media = { type: "video", path: v.path, x, y, w, h, objectName: "video-" + (opts.name || "clip") };
  if (cover) media.cover = cover;
  slide.addMedia(media);
  return { kind: "video", path: v.path };
}

// small helpers
function iconDot(slide, data, x, y, d, fill, name) {
  slide.addShape(SH.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { type: "none" }, objectName: name ? name + "-dot" : undefined });
  const m = d * 0.24;
  slide.addImage({ data, x: x + m, y: y + m, w: d - 2 * m, h: d - 2 * m, altText: "", objectName: name ? name + "-icon" : undefined });
}
function card(slide, x, y, w, h, name, fill = WHITE) {
  slide.addShape(SH.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.16, fill: { color: fill }, line: { type: "none" }, shadow: cutShadow(3), objectName: name });
}

// ---------------------------------------------------------------- layouts
const blob = (x, y, w, h, color, transparency = 0) => ({
  text: { text: "", options: { shape: SH.OVAL, x, y, w, h, fill: { color, transparency }, line: { type: "none" } } },
});
const kicker = (color) => ({
  placeholder: {
    options: { name: "kicker", type: "body", x: 0.6, y: 0.32, w: 8.5, h: 0.32, fontSize: 12, bold: true, color, charSpacing: 2, margin: 0, valign: "top" },
    text: "",
  },
});

pres.defineSlideMaster({
  title: "NL_TITLE",
  background: { color: PAPER },
  objects: [
    blob(-1.2, 6.15, 6.4, 2.6, LEAF),
    blob(3.9, 6.45, 6.8, 2.4, SKY),
    blob(9.2, 6.05, 5.6, 2.8, SUN),
    blob(2.2, 6.75, 3.6, 1.6, LILAC),
    kicker(TOMATO),
    { placeholder: { options: { name: "title", type: "title", align: "left", x: 0.6, y: 0.85, w: 5.9, h: 2.9, fontSize: 36, bold: true, color: INK, valign: "top", margin: 0, lineSpacingMultiple: 0.95 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 3.95, w: 5.6, h: 1.1, fontSize: 16, color: MUTED, valign: "top", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "NL_CONTENT",
  background: { color: PAPER },
  objects: [
    blob(11.75, -1.05, 2.4, 2.4, SUN),
    blob(11.25, 0.95, 0.42, 0.42, LILAC),
    blob(10.7, 6.95, 3.9, 1.7, LEAF),
    blob(12.15, 6.7, 2.2, 1.6, TOMATO),
    { text: { text: "Nightlight Press", options: { x: 0.6, y: 7.0, w: 3, h: 0.3, fontSize: 10, color: MUTED, margin: 0, fontFace: HEAD } } },
    kicker(TOMATO),
    { placeholder: { options: { name: "title", type: "title", align: "left", x: 0.6, y: 0.66, w: 10.4, h: 0.72, fontSize: 32, bold: true, color: INK, valign: "top", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 12.45, y: 7.02, w: 0.5, h: 0.3, fontSize: 11, bold: true, color: WHITE, align: "center" },
});
pres.defineSlideMaster({
  title: "NL_NIGHT",
  background: { color: INK },
  objects: [
    blob(11.75, -1.05, 2.4, 2.4, SUN),
    blob(11.45, -0.85, 2.0, 2.0, INK), // crescent bite
    blob(9.7, 0.42, 0.09, 0.09, SUN), blob(10.9, 1.05, 0.07, 0.07, PAPER), blob(12.55, 1.7, 0.1, 0.1, SUN), blob(8.6, 0.25, 0.06, 0.06, PAPER),
    blob(-1.2, 6.85, 6.2, 2.0, LILAC, 72),
    blob(3.9, 7.05, 7.0, 2.0, SKY, 78),
    blob(9.6, 6.8, 5.2, 2.2, LEAF, 74),
    { text: { text: "Nightlight Press", options: { x: 0.6, y: 7.0, w: 3, h: 0.3, fontSize: 10, color: PAPER, margin: 0, fontFace: HEAD } } },
    kicker(SUN),
    { placeholder: { options: { name: "title", type: "title", align: "left", x: 0.6, y: 0.66, w: 10.4, h: 0.72, fontSize: 32, bold: true, color: PAPER, valign: "top", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 12.45, y: 7.02, w: 0.5, h: 0.3, fontSize: 11, bold: true, color: PAPER, align: "center" },
});

// ---------------------------------------------------------------- slides
async function build() {
  const report = [];

  // 1 ── title / hook
  pres.addSection({ title: "Hook" });
  {
    const s = pres.addSlide({ masterName: "NL_TITLE", sectionTitle: "Hook" });
    s.addText("NIGHTLIGHT PRESS", { placeholder: "kicker" });
    s.addText([
      { text: "A bedtime book starring your child.", options: { breakLine: true } },
      { text: "Made by a company with no employees.", options: { color: TOMATO } },
    ], { placeholder: "title" });
    s.addText("$19. Ten painted pages and a painted cover, read aloud on the web and bound as a print-ready PDF, in the inbox in under two minutes.", { placeholder: "body" });
    s.addShape(SH.OVAL, { x: 11.35, y: 0.35, w: 1.9, h: 1.9, fill: { color: SUN }, line: { type: "none" }, objectName: "anim-1-0" });
    const media = await framedVideoOr(s,
      ["blender/office_flythrough.mp4"],
      ["blender/hero_still.jpg", "blender/hero_still.png", "hero.jpg"],
      { x: 6.95, y: 1.05, w: 5.75, h: 3.02 }, { name: "hero", label: "assets/blender/office_flythrough.mp4", position: "centre" });
    report.push(["slide 1 hero", media.kind, media.path]);
    s.addText("Cinematic render scripted by OpenAI GPT-6 Astra, rendered in Blender 5.2 EEVEE", {
      x: 6.95, y: 4.3, w: 5.75, h: 0.3, fontSize: 10, italic: true, color: MUTED, margin: 0, isTextBox: true, objectName: "anim-2-0",
    });
    s.addImage({ data: await icon("FaGlobe", HEX.tomato), x: 0.6, y: 5.27, w: 0.28, h: 0.28, altText: "", objectName: "anim-2-1" });
    s.addText(LIVE_SHORT, {
      x: 0.98, y: 5.2, w: 5.4, h: 0.42, fontSize: 16, bold: true, color: TOMATO, margin: 0, valign: "middle", isTextBox: true,
      hyperlink: { url: LIVE_URL, tooltip: "Open the live company" }, objectName: "anim-2-2",
    });
    s.addNotes([
      "Hook. Nightlight Press makes a bedtime picture book starring your child: written, painted, narrated and bound by twelve desks of agents and code. Nobody works here.",
      "The price is $19, one time. You get ten painted pages plus a painted cover, a read-aloud web book with a 'Read to me' button, and a print-ready 11 by 8.5 inch landscape PDF by email. Revisions are free: reply to the email or use the box beside the book.",
      "The live company is at " + LIVE_SHORT + ". The render on the right was scripted by OpenAI GPT-6 Astra and rendered in Blender 5.2 EEVEE.",
      "Built on Naive for the Autonomous Company Hackathon; the question to judge is how much of this company runs without us. The answer: all of the daily work.",
    ].join("\n\n"));
  }

  // 2 ── opportunity
  pres.addSection({ title: "Why" });
  {
    const s = pres.addSlide({ masterName: "NL_CONTENT", sectionTitle: "Why" });
    s.addText("THE OPPORTUNITY", { placeholder: "kicker" });
    s.addText("Every child wants to be the hero", { placeholder: "title" });
    // tilted paper-cut page with a sun behind it
    s.addShape(SH.OVAL, { x: 0.35, y: 1.55, w: 1.5, h: 1.5, fill: { color: SUN }, line: { type: "none" }, objectName: "anim-1-0" });
    const p = await framedImage(s, ["book/page-01.jpg", "book/page-03.jpg", "screens/reader-page.jpg"],
      { x: 0.85, y: 2.0, w: 4.95, h: 3.82 }, { name: "anim-1-1", rotate: -3, label: "a painted page (assets/book/page-01.jpg)" });
    report.push(["slide 2 page", p ? "image" : "pending", p]);
    s.addText("Page 1 of “Maya’s Little Brave Hello”, painted for one child", {
      x: 0.85, y: 6.18, w: 4.95, h: 0.3, fontSize: 10, italic: true, color: MUTED, margin: 0, isTextBox: true, align: "center",
    });
    const rows = [
      ["FaHeart", TOMATO, "Bedtime is personal", "Parents want the story about their child: their name, their look, their pet, the thing they are nervous about this week, in the language spoken at home."],
      ["FaHourglassHalf", SKY, "Custom books are slow", "Name-swap templates feel generic. A truly one-off book usually means a writer, an illustrator and a long wait."],
      ["FaMoon", LEAF, "Nightlight makes it tonight", "Written from scratch for one child, painted, narrated and bound by software in minutes, for $19, with free revisions."],
    ];
    for (let i = 0; i < rows.length; i++) {
      const [ic, col, head, body] = rows[i];
      const y = 1.78 + i * 1.6;
      iconDot(s, await icon(ic), 6.45, y + 0.05, 0.72, col, `anim-${2 + i}-0`);
      s.addText(head, { x: 7.4, y, w: 5.3, h: 0.42, fontSize: 20, bold: true, color: INK, fontFace: HEAD, margin: 0, isTextBox: true, objectName: `anim-${2 + i}-1` });
      s.addText(body, { x: 7.4, y: y + 0.46, w: 5.3, h: 0.95, fontSize: 14, color: MUTED, margin: 0, valign: "top", isTextBox: true, objectName: `anim-${2 + i}-2` });
    }
    s.addNotes([
      "The opportunity, qualitatively. Kids light up when a story is about them, and parents want bedtime to feel personal: their child's name and look, their pet, the specific thing they are worried about this week, in the language they speak at home.",
      "Today the choice is a name-swap template, which feels generic, or a commissioned one-off, which means a writer, an illustrator and a long wait.",
      "Nightlight writes each book from scratch for one child in any of 16 languages, paints it, narrates it and binds it in minutes, for $19. We are not quoting market sizes here; the point is that an autonomous company can make a genuinely custom product at a price a parent will pay on a whim.",
    ].join("\n\n"));
  }

  // 3 ── product in 3 screens
  pres.addSection({ title: "Product" });
  {
    const s = pres.addSlide({ masterName: "NL_CONTENT", sectionTitle: "Product" });
    s.addText("THE PRODUCT", { placeholder: "kicker" });
    s.addText("From order to bedtime in three screens", { placeholder: "title" });
    const steps = [
      [["screens/make.jpg", "screens/order-form.jpg", "screens/form.jpg"], "the order form (screens/make.jpg)", TOMATO, "Tell us about your child", "Name, age, looks, loves and language. $19, one time."],
      [["screens/making-of.jpg", "screens/order.jpg"], "the making-of page (screens/making-of.jpg)", SKY, "Watch the staff make it", "The order page shows each desk at work: written, edited, painted, narrated, bound."],
      [["screens/reader.jpg", "screens/reader-page.jpg"], "the reader (screens/reader.jpg)", LEAF, "Read it tonight", "A web book with “Read to me”, the PDF by email, and free revisions by reply."],
    ];
    for (let i = 0; i < steps.length; i++) {
      const [cands, label, col, head, body] = steps[i];
      const x = 0.6 + i * 4.15;
      card(s, x, 1.75, 3.85, 4.05, `anim-${1 + i}-0`);
      const p = await framedImage(s, cands, { x: x + 0.18, y: 1.93, w: 3.49, h: 2.18 }, { name: `anim-${1 + i}-1`, pad: 0, frame: PAPER2, label });
      report.push([`slide 3 screen ${i + 1}`, p ? "image" : "pending", p]);
      s.addShape(SH.OVAL, { x: x - 0.22, y: 1.52, w: 0.62, h: 0.62, fill: { color: col }, line: { color: WHITE, width: 2 }, objectName: `anim-${1 + i}-2` });
      s.addText(String(i + 1), { x: x - 0.22, y: 1.52, w: 0.62, h: 0.62, fontSize: 20, bold: true, color: i === 0 ? WHITE : INK, fontFace: HEAD, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: `anim-${1 + i}-3` });
      s.addText(head, { x: x + 0.22, y: 4.35, w: 3.45, h: 0.45, fontSize: 19, bold: true, color: INK, fontFace: HEAD, margin: 0, isTextBox: true, objectName: `anim-${1 + i}-4` });
      s.addText(body, { x: x + 0.22, y: 4.85, w: 3.45, h: 0.85, fontSize: 15, color: MUTED, margin: 0, valign: "top", isTextBox: true, objectName: `anim-${1 + i}-5` });
    }
    card(s, 0.6, 6.05, 12.15, 0.66, "anim-4-0", PAPER2);
    iconDot(s, await icon("FaStopwatch", HEX.ink), 0.72, 6.12, 0.52, SUN, "anim-4-1");
    s.addText([
      { text: "Measured locally: ", options: { bold: true } },
      { text: "order \u2192 bound book in 1.6 min, in the inbox at 102 s. A revision request is re-emailed in 46 s." },
    ], { x: 1.4, y: 6.08, w: 11.2, h: 0.6, fontSize: 14, color: INK, margin: 0, valign: "middle", isTextBox: true, objectName: "anim-4-2" });
    s.addNotes([
      "The product is three screens. One: the order form. A parent types the child's name, age, what they look like, what they love and the language. It is $19, one time, through Stripe Checkout; the hosted instance runs in an honest pledge mode until the founder adds a Stripe key.",
      "Two: the making-of page. While the parent waits, the order page shows each desk working: the Author writing, the Editor checking, the Illustrator painting, the Narrator recording, the Binder binding. Locally the book is bound in 1.6 minutes and emailed at 102 seconds.",
      "Three: the reader. A read-aloud web book with a 'Read to me' button, the print-ready PDF in the inbox, and free revisions: reply to the email or type in the box beside the book. A revision came back re-emailed in 46 seconds in our local test.",
    ].join("\n\n"));
  }

  // 4 ── the book
  {
    const s = pres.addSlide({ masterName: "NL_CONTENT", sectionTitle: "Product" });
    s.addText("THE BOOK", { placeholder: "kicker" });
    s.addText("A real book, painted for one child", { placeholder: "title" });
    s.addShape(SH.OVAL, { x: 6.35, y: 5.55, w: 1.2, h: 1.2, fill: { color: LILAC }, line: { type: "none" }, objectName: "anim-1-0" });
    s.addShape(SH.OVAL, { x: 0.35, y: 1.45, w: 0.9, h: 0.9, fill: { color: SUN }, line: { type: "none" }, objectName: "anim-1-1" });
    const p = await framedImage(s, ["book/collage.jpg", "book/page-01.jpg"], { x: 0.75, y: 1.8, w: 6.2, h: 4.85 }, { name: "anim-1-2", label: "book collage (assets/book/collage.jpg)", position: "centre" });
    report.push(["slide 4 collage", p ? "image" : "pending", p]);
    s.addText("“Maya’s Little Brave Hello”", { x: 7.65, y: 1.75, w: 5.1, h: 0.5, fontSize: 22, bold: true, color: TOMATO, fontFace: HEAD, margin: 0, isTextBox: true, objectName: "anim-2-0" });
    s.addText("A finished order from our own engine, start to finish with no human in the loop.", { x: 7.65, y: 2.3, w: 4.9, h: 0.65, fontSize: 15, color: MUTED, margin: 0, valign: "top", isTextBox: true, objectName: "anim-2-1" });
    const specs = [
      ["FaPaintbrush", SUN, "10 painted pages and a painted cover"],
      ["FaFilePdf", TOMATO, "Print-ready PDF, 11 × 8.5 in landscape"],
      ["FaVolumeHigh", SKY, "Read-aloud web book with “Read to me”"],
      ["FaLanguage", LEAF, "Written in the child’s language: 16 languages"],
      ["FaReply", LILAC, "Free revisions: reply to the email"],
    ];
    for (let i = 0; i < specs.length; i++) {
      const [ic, col, txt] = specs[i];
      const y = 3.2 + i * 0.66;
      iconDot(s, await icon(ic, col === SUN || col === LILAC ? HEX.ink : HEX.white), 7.65, y, 0.48, col, `anim-${3 + i}-0`);
      s.addText(txt, { x: 8.3, y, w: 4.45, h: 0.48, fontSize: 15, color: INK, margin: 0, valign: "middle", isTextBox: true, objectName: `anim-${3 + i}-1` });
    }
    s.addNotes([
      "This is the book itself: 'Maya's Little Brave Hello', a finished order that went through the engine with no human touching it.",
      "Every book has ten painted pages plus a painted cover, painted by the Illustrator desk on Monid's gpt-image-2.5-sunburst model. The Binder lays it out with PDFKit as a print-ready 11 by 8.5 inch landscape PDF, so a parent can print it at home or at a copy shop.",
      "The same book is a read-aloud web book: 'Read to me' plays the Narrator's recording page by page. The Author writes in the child's language, sixteen languages so far, and the Editor enforces word limits by age, puts the child's name on the pages and checks reading grade and banned words.",
      "Revisions are free: reply to the email or use the box beside the book.",
    ].join("\n\n"));
  }

  // 5 ── staff
  pres.addSection({ title: "Company" });
  {
    const s = pres.addSlide({ masterName: "NL_CONTENT", sectionTitle: "Company" });
    s.addText("THE STAFF", { placeholder: "kicker" });
    s.addText("Twelve desks. Nobody on payroll.", { placeholder: "title" });
    const KIND = { agent: [LILAC, HEX.ink, "Agent"], model: [SUN, HEX.ink, "Model"], code: [SKY, HEX.white, "Code"] };
    // legend
    let lx = 0.6;
    for (const k of ["agent", "model", "code"]) {
      s.addShape(SH.OVAL, { x: lx, y: 1.5, w: 0.22, h: 0.22, fill: { color: KIND[k][0] }, line: { type: "none" } });
      s.addText(KIND[k][2], { x: lx + 0.3, y: 1.45, w: 0.8, h: 0.32, fontSize: 12, bold: true, color: INK, margin: 0, valign: "middle", isTextBox: true });
      lx += 1.15;
    }
    s.addText("Models write, code decides.", { x: 4.15, y: 1.45, w: 4, h: 0.32, fontSize: 12, italic: true, color: MUTED, margin: 0, valign: "middle", isTextBox: true });
    const desks = [
      ["Author", "agent", "NAÏVE AGENT", "FaPenNib", "Writes the story in the child’s language (16 languages)"],
      ["Editor", "code", "CODE", "FaSpellCheck", "Word limits by age, name on pages, banned words, reading grade"],
      ["Illustrator", "model", "MONID", "FaPaintbrush", "Paints 10 pages + cover with gpt-image-2.5-sunburst"],
      ["Narrator", "model", "NAÏVE SPEECH", "FaMicrophone", "Records every page; OpenAI TTS only as fallback"],
      ["Binder", "code", "CODE · PDFKIT", "FaBook", "Binds the print-ready 11 × 8.5 in landscape PDF"],
      ["Mailroom", "code", "AGENTMAIL · MONID", "FaEnvelope", "Emails the PDF; texts US numbers by SMS"],
      ["Storyteller Line", "agent", "MONID PHONE", "FaPhone", "Reads the book by phone; says it’s an AI, consent first, 3 calls max"],
      ["Front Desk", "agent", "NAÏVE · AGENTMAIL", "FaBellConcierge", "Answers replies and the box beside the book; files revisions"],
      ["Proofreader", "agent", "MOBILERUN", "FaMobileScreen", "Opens each finished book on a real phone and checks it"],
      ["Marketing", "agent", "NAÏVE AGENT", "FaBullhorn", "A free shelf book every 12 h; emails subscribers"],
      ["Cashier", "code", "CODE · STRIPE", "FaCashRegister", "Stripe Checkout; honest pledge mode until a key is added"],
      ["Night Manager", "agent", "NAÏVE SCHEDULE", "FaMoon", "Every 5 min, calls the app’s MCP tick tool"],
    ];
    for (let i = 0; i < desks.length; i++) {
      const [name, kind, tag, ic, job] = desks[i];
      const col = i % 4, row = Math.floor(i / 4);
      const x = 0.6 + col * 3.05, y = 1.98 + row * 1.6;
      const step = 1 + row, sub = col * 3;
      card(s, x, y, 2.85, 1.42, `anim-${step}-${sub}`);
      iconDot(s, await icon(ic, KIND[kind][1]), x + 0.15, y + 0.15, 0.5, KIND[kind][0], `anim-${step}-${sub + 1}`);
      s.addText([
        { text: name, options: { fontSize: 15, bold: true, color: INK, fontFace: HEAD, breakLine: true } },
        { text: tag, options: { fontSize: 10, bold: true, color: MUTED, charSpacing: 1 } },
      ], { x: x + 0.76, y: y + 0.12, w: 2.0, h: 0.58, margin: 0, valign: "middle", isTextBox: true, objectName: `anim-${step}-${sub + 2}` });
      s.addText(job, { x: x + 0.15, y: y + 0.76, w: 2.58, h: 0.6, fontSize: 12, color: INK, margin: 0, valign: "top", isTextBox: true, objectName: `anim-${step}-${sub + 2}b` });
    }
    s.addNotes([
      "The staff: twelve desks, nobody on payroll. Purple desks are agents, yellow are models, blue are plain code. Our rule is 'models write, code decides': agents and models produce words, pictures and audio; deterministic code checks them and moves the order along.",
      "Author is a Naive agent that writes in the child's language, sixteen languages. Editor is code: word limits by age, the child's name on the pages, banned words and brands, reading grade, and it can send a draft back once. Illustrator paints with Monid's gpt-image-2.5-sunburst. Narrator uses Naive speech with OpenAI TTS as a fallback; in our local run 19 of 25 page narrations came from Naive speech.",
      "Binder is code with PDFKit. Mailroom emails the PDF through AgentMail and texts US numbers through Monid SMS. The Storyteller Line is a Monid phone line that says it is an AI, needs consent and makes at most three calls per book. Front Desk is a Naive agent fed by the AgentMail inbound webhook and the box on the reader page.",
      "Proofreader uses Mobilerun to open each finished book on a real phone. Marketing is a Naive agent that commissions a free shelf book every 12 hours and emails subscribers; Instagram posting through Mobilerun is opt-in. Cashier is Stripe Checkout, in honest pledge mode on the hosted instance until a key is added. The Night Manager is a Naive scheduled agent that calls the app's MCP tick tool every five minutes.",
    ].join("\n\n"));
  }

  // 6 ── office floor
  {
    const s = pres.addSlide({ masterName: "NL_NIGHT", sectionTitle: "Company" });
    s.addText("THE OFFICE", { placeholder: "kicker" });
    s.addText("Watch the company work", { placeholder: "title" });
    const media = await framedVideoOr(s, ["office.mp4", "screens/office.mp4"], ["screens/office.jpg"],
      { x: 0.7, y: 1.7, w: 7.85, h: 4.9 }, { name: "office", frame: PAPER, label: "office floor (assets/office.mp4)", dark: true, poster: ["screens/office.jpg"] });
    report.push(["slide 6 office", media.kind, media.path]);
    const pts = [
      ["FaLightbulb", "Desks light up", "Each desk is a real worker. When its job runs, the desk lights up."],
      ["FaListCheck", "The feed is the ledger", "The sidebar streams the public, hash-chained ledger as it is written."],
      ["FaCube", "Open it yourself", "Live at /office, drawn in Three.js from the same job queue."],
    ];
    for (let i = 0; i < pts.length; i++) {
      const [ic, head, body] = pts[i];
      const y = 1.8 + i * 1.55;
      iconDot(s, await icon(ic, HEX.ink), 9.05, y, 0.6, SUN, `anim-${2 + i}-0`);
      s.addText(head, { x: 9.8, y: y - 0.02, w: 3.0, h: 0.4, fontSize: 18, bold: true, color: PAPER, fontFace: HEAD, margin: 0, isTextBox: true, objectName: `anim-${2 + i}-1` });
      s.addText(body, { x: 9.8, y: y + 0.42, w: 3.0, h: 0.95, fontSize: 14, color: PAPER, margin: 0, valign: "top", isTextBox: true, objectName: `anim-${2 + i}-2` });
    }
    s.addNotes([
      "This is the office floor, live at /office. It is a 3D scene in Three.js, and every desk is one of the twelve workers. When a desk's job is running in the queue, the desk lights up; the sidebar is the public ledger streaming in.",
      "Nothing here is staged for the demo: it renders from the same Postgres job queue and hash-chained ledger the company runs on. Let the clip play; it loops.",
    ].join("\n\n"));
  }

  // 7 ── how it runs without us
  pres.addSection({ title: "Autonomy" });
  {
    const s = pres.addSlide({ masterName: "NL_CONTENT", sectionTitle: "Autonomy" });
    s.addText("AUTONOMY", { placeholder: "kicker" });
    s.addText("How it runs without us", { placeholder: "title" });
    s.addText("FOUR CLOCKS", { x: 0.6, y: 1.5, w: 3.6, h: 0.28, fontSize: 11, bold: true, color: MUTED, charSpacing: 2, margin: 0, isTextBox: true });
    const clocks = [
      ["FaClock", SUN, "Night Manager cron", "Naïve schedule, every 5 min → MCP tick"],
      ["FaBell", LILAC, "session.idle webhook", "Naïve calls back when an agent finishes"],
      ["FaInbox", SKY, "message.received webhook", "AgentMail calls when a parent replies"],
      ["FaHeartPulse", LEAF, "Page pulses", "Open order and reader pages nudge tick"],
    ];
    const tickC = { x: 5.55, y: 3.55, r: 0.85 };
    for (let i = 0; i < clocks.length; i++) {
      const [ic, col, head, body] = clocks[i];
      const y = 1.86 + i * 0.98;
      card(s, 0.6, y, 3.95, 0.84, `anim-1-${i * 3}`);
      iconDot(s, await icon(ic, col === SKY || col === LEAF ? HEX.white : HEX.ink), 0.72, y + 0.14, 0.56, col, `anim-1-${i * 3 + 1}`);
      s.addText([
        { text: head, options: { fontSize: 14, bold: true, color: INK, breakLine: true } },
        { text: body, options: { fontSize: 11, color: MUTED } },
      ], { x: 1.4, y: y + 0.08, w: 3.1, h: 0.68, margin: 0, valign: "middle", isTextBox: true, objectName: `anim-1-${i * 3 + 2}` });
      // arrow into tick
      const y1 = y + 0.42;
      const x2 = tickC.x - tickC.r + 0.05, y2 = tickC.y + (y1 - tickC.y) * 0.35;
      s.addShape(SH.LINE, {
        x: 4.6, y: Math.min(y1, y2), w: x2 - 4.6, h: Math.max(0.001, Math.abs(y2 - y1)), flipV: y2 < y1,
        line: { color: MUTED, width: 1.5, endArrowType: "triangle" }, objectName: `anim-2-${i}`,
      });
    }
    // tick circle + self-continuation ring
    s.addShape(SH.BLOCK_ARC, {
      x: tickC.x - 1.12, y: tickC.y - 1.12, w: 2.24, h: 2.24, fill: { color: SUN }, line: { type: "none" },
      angleRange: [200, 160], arcThicknessRatio: 0.14, objectName: "anim-3-0",
    });
    s.addShape(SH.OVAL, { x: tickC.x - tickC.r, y: tickC.y - tickC.r, w: 2 * tickC.r, h: 2 * tickC.r, fill: { color: TOMATO }, line: { type: "none" }, shadow: cutShadow(3), objectName: "anim-3-1" });
    s.addText([
      { text: "tick()", options: { fontSize: 22, bold: true, color: WHITE, fontFace: HEAD, breakLine: true } },
      { text: "each step < 7 s", options: { fontSize: 11, color: WHITE } },
    ], { x: tickC.x - tickC.r, y: tickC.y - tickC.r, w: 2 * tickC.r, h: 2 * tickC.r, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "anim-3-2" });
    s.addText([{ text: "re-invokes itself", options: { breakLine: true } }, { text: "while work is due" }], { x: 4.85, y: tickC.y + 1.2, w: 1.9, h: 0.45, fontSize: 11, italic: true, color: INK, align: "center", margin: 0, isTextBox: true, objectName: "anim-3-3" });
    // what tick drives
    const sinks = [
      ["FaDatabase", SKY, "Postgres job queue", "Leases with FOR UPDATE SKIP LOCKED; every step under 7 s, so it fits serverless. Agent calls are resumable phases."],
      ["FaLink", LILAC, "Hash-chained public ledger", "sha256 over canonical sorted-key JSON plus the previous hash. Anyone can verify the history."],
      ["FaHandPaper", TOMATO, "Interventions board", "Every human action is logged as an intervention on the public /board."],
    ];
    for (let i = 0; i < sinks.length; i++) {
      const [ic, col, head, body] = sinks[i];
      const y = 1.86 + i * 1.32;
      s.addShape(SH.LINE, {
        x: tickC.x + tickC.r + 0.05, y: Math.min(tickC.y, y + 0.58), w: 7.55 - (tickC.x + tickC.r + 0.05), h: Math.max(0.001, Math.abs(y + 0.58 - tickC.y)),
        flipV: y + 0.58 < tickC.y, line: { color: MUTED, width: 1.5, endArrowType: "triangle" }, objectName: `anim-4-${i * 4}`,
      });
      card(s, 7.6, y, 5.1, 1.16, `anim-4-${i * 4 + 1}`);
      iconDot(s, await icon(ic === "FaHandPaper" ? "FaHand" : ic, col === LILAC ? HEX.ink : HEX.white), 7.75, y + 0.14, 0.56, col, `anim-4-${i * 4 + 2}`);
      s.addText([
        { text: head, options: { fontSize: 15, bold: true, color: INK, fontFace: HEAD, breakLine: true } },
        { text: body, options: { fontSize: 12, color: MUTED } },
      ], { x: 8.45, y: y + 0.08, w: 4.15, h: 1.0, margin: 0, valign: "middle", isTextBox: true, objectName: `anim-4-${i * 4 + 3}` });
    }
    // bottom band: self-continuation
    card(s, 0.6, 5.85, 12.1, 0.82, "anim-5-0", PAPER2);
    iconDot(s, await icon("FaArrowsRotate", HEX.ink), 0.75, 5.98, 0.56, SUN, "anim-5-1");
    s.addText([
      { text: "Self-continuation: ", options: { bold: true, color: INK } },
      { text: "after each tick the app calls itself again while work is due, under one Postgres lease with a depth cap.", options: { color: INK } },
    ], { x: 1.45, y: 5.9, w: 7.9, h: 0.72, fontSize: 14, margin: 0, valign: "middle", isTextBox: true, objectName: "anim-5-2" });
    s.addText("Models write, code decides.", { x: 9.4, y: 5.9, w: 3.15, h: 0.72, fontSize: 16, bold: true, italic: true, color: TOMATO, fontFace: HEAD, align: "right", margin: 0, valign: "middle", isTextBox: true, objectName: "anim-5-3" });
    s.addNotes([
      "How it runs without us. Four clocks wake the company. The Night Manager is a Naive scheduled agent that calls the app's MCP tick tool every five minutes. Naive's session.idle webhook fires when an agent finishes. AgentMail's message.received webhook fires when a parent replies. And any open order or reader page pulses the tick.",
      "A tick takes one step off a Postgres job queue. Jobs are leased with FOR UPDATE SKIP LOCKED, and every step is under seven seconds, so it runs on serverless; agent calls are split into resumable phases. After each tick the app re-invokes itself while work is still due, holding a single lease in Postgres with a depth cap, so one order flows through all twelve desks without waiting for the next clock.",
      "Every event is appended to a public ledger, hash-chained with sha256 over canonical sorted-key JSON plus the previous hash. And every human action is logged as an intervention on the public board, so you can count exactly how often we touched it.",
      "Two honest lessons: Naive board tasks in our blueprint once made an agent pull, hand-edit and redeploy the app, so we removed the tasks and gave agents no app access. And a batch model rejected the Night Manager's cron runs, so we switched models.",
    ].join("\n\n"));
  }

  // 8 ── unit economics
  pres.addSection({ title: "Business" });
  {
    const s = pres.addSlide({ masterName: "NL_CONTENT", sectionTitle: "Business" });
    s.addText("UNIT ECONOMICS", { placeholder: "kicker" });
    s.addText("$19 a book, about 94% gross margin", { placeholder: "title" });
    const hdr = (t, align = "left") => ({ text: t, options: { bold: true, color: PAPER, fill: { color: INK }, align, fontSize: 14 } });
    const cell = (t, o = {}) => ({ text: t, options: { color: INK, fill: { color: WHITE }, fontSize: 16, ...o } });
    const rows = [
      [hdr("Per book"), hdr("Amount", "right")],
      [cell("Price, one time"), cell("$19.00", { align: "right", bold: true })],
      [cell("Paintings (11 × ~$0.011, Monid)"), cell("$0.12", { align: "right" })],
      [cell("Agent runs (Naïve)"), cell("< $0.01", { align: "right" })],
      [cell("Stripe fee"), cell("$0.85", { align: "right" })],
      [cell("Gross margin", { bold: true, fill: { color: SUN } }), cell("≈ 94%", { align: "right", bold: true, fill: { color: SUN }, fontSize: 18 })],
    ];
    s.addTable(rows, {
      x: 0.6, y: 1.8, w: 6.7, colW: [4.9, 1.8], rowH: [0.55, 0.7, 0.7, 0.7, 0.7, 0.8],
      border: { type: "solid", color: HEX.paper2, pt: 1 }, valign: "middle", margin: [0.06, 0.18, 0.06, 0.18],
      objectName: "anim-1-0",
    });
    s.addText("Measured locally on the same code the hosted app runs.", { x: 0.6, y: 6.15, w: 6.7, h: 0.3, fontSize: 11, italic: true, color: MUTED, margin: 0, isTextBox: true, objectName: "anim-1-1" });
    const stats = [
      ["102 s", "order → book in the parent’s inbox", "bound at 1.6 min, then emailed with the PDF", SUN],
      ["46 s", "revision request → revised book re-emailed", "the reply goes straight to the Front Desk", LILAC],
    ];
    for (let i = 0; i < stats.length; i++) {
      const [big, l1, l2, col] = stats[i];
      const y = 1.8 + i * 2.2;
      card(s, 7.85, y, 4.85, 1.95, `anim-${2 + i}-0`);
      s.addShape(SH.OVAL, { x: 8.1, y: y + 0.25, w: 0.9, h: 0.9, fill: { color: col }, line: { type: "none" }, objectName: `anim-${2 + i}-1` });
      s.addText(big, { x: 9.2, y: y + 0.18, w: 3.3, h: 1.0, fontSize: 48, bold: true, color: INK, fontFace: HEAD, margin: 0, valign: "middle", isTextBox: true, objectName: `anim-${2 + i}-2` });
      s.addText([
        { text: l1, options: { bold: true, color: INK, fontSize: 14, breakLine: true } },
        { text: l2, options: { color: MUTED, fontSize: 12 } },
      ], { x: 8.1, y: y + 1.27, w: 4.45, h: 0.6, margin: 0, valign: "top", isTextBox: true, objectName: `anim-${2 + i}-3` });
    }
    s.addNotes([
      "Unit economics per book. The price is $19, one time. The eleven paintings cost about $0.011 each, $0.12 a book. All the agent runs together are under a cent. The Stripe fee on $19 is $0.85. That leaves a gross margin of about 94 percent.",
      "Speed is the other half: in our local measurement an order became a bound book in 1.6 minutes and was in the inbox at 102 seconds. A revision request came back as a revised, re-emailed book in 46 seconds.",
      "Because no step needs a person, volume does not need hiring: the same queue, ledger and four clocks serve the tenth order and the ten-thousandth. The hosted instance is in honest pledge mode until the founder adds a Stripe key; nothing about the flow changes when it goes live.",
    ].join("\n\n"));
  }

  // 9 ── sponsors
  {
    const s = pres.addSlide({ masterName: "NL_CONTENT", sectionTitle: "Business" });
    s.addText("BUILT ON", { placeholder: "kicker" });
    s.addText("Each sponsor does a real job", { placeholder: "title" });
    const sp = [
      ["Naïve", TOMATO, "FaBuilding", HEX.white, "Runs the company: four agents, the 5-minute schedule, the hosted Hono app with managed Postgres, the MCP endpoint, webhooks, speech, vault and identity."],
      ["Mobilerun", SUN, "FaMobileScreen", HEX.ink, "The Proofreader. On the founder’s iPhone 16 at 7:48 AM it opened the live site in Safari and read the headline back exactly, in 3 steps."],
      ["AgentMail", SKY, "FaEnvelopeOpenText", HEX.white, "The Mailroom sends the PDF; the message.received webhook hands replies to the Front Desk, so revisions need no human."],
      ["Monid", LEAF, "FaPalette", HEX.white, "Paints every page with gpt-image-2.5-sunburst, texts US parents, and runs the Storyteller phone line."],
    ];
    for (let i = 0; i < sp.length; i++) {
      const [name, col, ic, icHex, body] = sp[i];
      const y = 1.72 + i * 1.27;
      card(s, 0.6, y, 8.55, 1.12, `anim-${1 + i}-0`);
      iconDot(s, await icon(ic, icHex), 0.78, y + 0.2, 0.72, col, `anim-${1 + i}-1`);
      s.addText(name, { x: 1.7, y: y + 0.1, w: 1.9, h: 0.92, fontSize: 19, bold: true, color: INK, fontFace: HEAD, margin: 0, valign: "middle", isTextBox: true, objectName: `anim-${1 + i}-2` });
      s.addText(body, { x: 3.6, y: y + 0.08, w: 5.4, h: 0.96, fontSize: 13, color: INK, margin: 0, valign: "middle", isTextBox: true, objectName: `anim-${1 + i}-3` });
    }
    // the phone
    const ph = { x: 10.0, y: 1.55, w: 2.42, h: 5.25 };
    s.addShape(SH.ROUNDED_RECTANGLE, { x: ph.x - 0.12, y: ph.y - 0.12, w: ph.w + 0.24, h: ph.h + 0.24, rectRadius: 0.32, fill: { color: INK }, line: { type: "none" }, shadow: cutShadow(5), objectName: "anim-5-0" });
    const proof = firstImage(["mobilerun/iphone-proof-4.png", "mobilerun/iphone-proof-3.png", "mobilerun/iphone-proof-2.png", "mobilerun/iphone-proof-1.png"]);
    if (proof) {
      s.addImage({ data: await cropTo(proof, ph.w, ph.h, "top"), x: ph.x, y: ph.y, w: ph.w, h: ph.h, altText: "Mobilerun opened the live site in Safari on an iPhone 16", objectName: "anim-5-1" });
    } else pending(s, { ...ph, name: "anim-5-1" }, "iPhone proof (assets/mobilerun/)", true);
    report.push(["slide 9 iphone", proof ? "image" : "pending", proof]);
    s.addShape(SH.OVAL, { x: 9.12, y: 0.95, w: 1.0, h: 1.0, fill: { color: TOMATO }, line: { color: WHITE, width: 2 }, rotate: -12, objectName: "anim-6-0" });
    s.addText("real iPhone 16", { x: 9.12, y: 0.95, w: 1.0, h: 1.0, fontSize: 11, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0.05, rotate: -12, isTextBox: true, objectName: "anim-6-1" });
    s.addNotes([
      "Each sponsor does one concrete job; none is a logo on a slide.",
      "Naive runs the company: the Author, Front Desk, Marketing and Night Manager agents, the five-minute schedule, the hosted Hono app with managed Postgres, the MCP endpoint, the webhooks, speech, vault and identity.",
      "Mobilerun is the Proofreader. It opens each finished book on a real phone. At 7:48 this morning, on the founder's iPhone 16, it opened the live site in Safari and read the headline back exactly, in three steps. That is the screenshot on the right.",
      "AgentMail is the Mailroom's outbox and the Front Desk's inbox: the PDF goes out by email, and the message.received webhook turns a parent's reply into a revision without a human.",
      "Monid paints every page with gpt-image-2.5-sunburst, sends SMS to US parents, and runs the Storyteller phone line, which says it is an AI, needs consent and makes at most three calls per book.",
    ].join("\n\n"));
  }

  // 10 ── close
  pres.addSection({ title: "Close" });
  {
    const s = pres.addSlide({ masterName: "NL_NIGHT", sectionTitle: "Close" });
    s.addText("TONIGHT", { placeholder: "kicker" });
    s.addText("It runs while you sleep", { placeholder: "title" });
    s.addText("Twelve desks, four clocks, one public ledger and no employees. Your child’s book tonight, for $19.", {
      x: 0.6, y: 1.65, w: 5.6, h: 1.0, fontSize: 18, color: PAPER, margin: 0, valign: "top", isTextBox: true, objectName: "anim-1-0",
    });
    s.addText("Order one now", {
      shape: SH.ROUNDED_RECTANGLE, rectRadius: 0.4, x: 0.6, y: 3.0, w: 4.2, h: 0.85, fill: { color: TOMATO }, line: { type: "none" },
      fontSize: 24, bold: true, color: WHITE, fontFace: HEAD, align: "center", valign: "middle", isTextBox: true, shadow: cutShadow(4), objectName: "anim-2-0",
    });
    const links = [["FaGlobe", "Live", LIVE_SHORT, LIVE_URL], ["FaGithub", "Code", REPO_SHORT, REPO_URL]];
    for (let i = 0; i < links.length; i++) {
      const [ic, lab, txt, url] = links[i];
      const y = 4.25 + i * 0.62;
      s.addImage({ data: await icon(ic, HEX.sun), x: 0.6, y: y + 0.07, w: 0.32, h: 0.32, altText: "", objectName: `anim-3-${i * 2}` });
      s.addText([
        { text: lab + "   ", options: { bold: true, color: SUN } },
        { text: txt, options: { color: PAPER, hyperlink: { url, tooltip: url } } },
      ], { x: 1.05, y, w: 5.6, h: 0.46, fontSize: 16, margin: 0, valign: "middle", isTextBox: true, objectName: `anim-3-${i * 2 + 1}` });
    }
    const media = await framedVideoOr(s, ["blender/book_open.mp4"], ["book/page-10.jpg", "book/collage.jpg", "blender/hero_still.jpg"],
      { x: 7.0, y: 1.75, w: 5.6, h: 4.33 }, { name: "book", frame: PAPER, label: "assets/blender/book_open.mp4", dark: true, position: "centre" });
    report.push(["slide 10 book", media.kind, media.path]);
    s.addNotes([
      "Close. Nightlight Press runs while we sleep: twelve desks, four clocks, one public ledger, no employees. The Night Manager will tick again in the next five minutes whether or not anyone is watching.",
      "Order one now at " + LIVE_SHORT + ". It costs $19 and lands in the inbox in under two minutes. The code is at " + REPO_SHORT + ".",
      "Every human intervention is on the public board, so you can check our claim that the company runs without us.",
    ].join("\n\n"));
  }

  await pres.writeFile({ fileName: OUT });
  if (THEME_OUT) fs.writeFileSync(THEME_OUT, JSON.stringify(THEME, null, 2));
  fs.rmSync(TMP, { recursive: true, force: true });
  for (const r of report) console.log(`  ${r[0].padEnd(20)} ${String(r[1]).padEnd(8)} ${r[2] ? path.relative(ASSETS, r[2]) : "-"}`);
  console.log("wrote", OUT);
}

build().catch((e) => { console.error(e); process.exit(1); });
