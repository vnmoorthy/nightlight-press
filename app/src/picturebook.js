/** The Binder: a landscape picture book with a painted cover, read-aloud-sized type and an honest colophon.
 *  Magic Hour (the website's theme): deep navy with soft blue glows, a sparse starfield, gold-to-amber pills,
 *  frosted glass, the gold star-above-an-open-book mark, Fredoka display type, Literata story text, Nunito labels. */
import PDFDocument from "pdfkit";
import { FONTS } from "./prompts.generated.js";
const N0 = "#050B2E", N1 = "#0B1A4A", N2 = "#13296B", ROYAL = "#1F3FA6", GLOW = "#3D7BFF", SKY = "#6FC3FF";
const GOLD = "#FFD36E", AMBER = "#FFB13B", PINK = "#FF6FAE", CREAM = "#FFF7E8", TEXT = "#EAF0FF", MUTED = "#A9B6E0", WHITE = "#FFFFFF";
export function renderBook(b, pages, coverBytes, { forName, robot = false, teller = null } = {}) {
  return new Promise((resolve, reject) => {
    const W = 792, H = 612;
    const doc = new PDFDocument({ size: [W, H], margin: 0, autoFirstPage: true, info: { Title: b.title || "A Nightlight book", Author: "Nightlight Press", Creator: "Nightlight Press" } });
    // Fonts: FONTS (app/fonts, embedded by gen-prompts.mjs) first, then EB Garamond, then PDF built-ins.
    const f = (...keys) => { for (const k of keys) { const s = FONTS[k]; if (s) return Buffer.from(s, "base64"); } return null; };
    doc.registerFont("Body", f("literata-400-normal", "ebg-400-normal") || "Times-Roman");
    doc.registerFont("Italic", f("literata-400-italic", "ebg-400-italic") || "Times-Italic");
    doc.registerFont("Display", f("fredoka-600-normal", "ebg-600-normal") || "Helvetica-Bold");
    doc.registerFont("Label", f("nunito-700-normal", "fredoka-600-normal", "ebg-600-normal") || "Helvetica-Bold");
    doc.registerFont("Sans", f("nunito-400-normal", "literata-400-normal", "ebg-400-normal") || "Helvetica");
    const chunks = []; doc.on("data", (c) => chunks.push(c)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
    const bg = (c) => { doc.save(); doc.rect(0, 0, W, H).fill(c); doc.restore(); };
    const noBreak = (fn) => { const m = doc.page.margins.bottom; doc.page.margins.bottom = 0; fn(); doc.page.margins.bottom = m; };
    const title = b.title || "";
    /** Largest size in [min, max] at which `text` fits on one line of `width` (a two-line wrap still happens below min). */
    const fitWidth = (font, text, max, min, width) => { doc.font(font); let s = max; for (; s > min; s -= 1) { doc.fontSize(s); if (doc.widthOfString(text) <= width) break; } doc.fontSize(s); return s; };
    /** A small seeded random source so every render of a book draws the same sky. */
    const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const seed0 = [...(b.id || title)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    /** A soft radial glow: `color` at `opacity` in the middle, fading to nothing at radius r. */
    const glow = (cx, cy, r, color, opacity) => {
      doc.save(); const g = doc.radialGradient(cx, cy, 0, cx, cy, r); g.stop(0, color, opacity).stop(0.55, color, opacity * 0.35).stop(1, color, 0);
      doc.circle(cx, cy, r).fill(g); doc.restore();
    };
    /** A four-point twinkle. */
    const sparkle = (cx, cy, r, color, opacity = 1) => {
      doc.save(); doc.moveTo(cx, cy - r).quadraticCurveTo(cx, cy, cx + r, cy).quadraticCurveTo(cx, cy, cx, cy + r).quadraticCurveTo(cx, cy, cx - r, cy).quadraticCurveTo(cx, cy, cx, cy - r).closePath();
      doc.fillOpacity(opacity).fill(color); doc.restore();
    };
    /** A sparse starfield inside x, y, w, h: mostly tiny cream dots, a few gold, and a handful of twinkles. `keep` lists rectangles left clear for type. */
    const stars = (seed, n, x, y, w, h, keep = []) => {
      const r = rng(seed);
      for (let i = 0; i < n; i++) {
        const sx = x + r() * w, sy = y + r() * h, k = r(), o = 0.35 + r() * 0.55, s = r();
        if (keep.some((k) => sx > k[0] - 8 && sx < k[0] + k[2] + 8 && sy > k[1] - 8 && sy < k[1] + k[3] + 8)) continue;
        if (k > 0.93) sparkle(sx, sy, 3.2 + s * 3.2, GOLD, 0.85);
        else { doc.save(); doc.circle(sx, sy, 0.55 + s * 1.15).fillOpacity(o).fill(k > 0.78 ? GOLD : k > 0.6 ? SKY : CREAM); doc.restore(); }
      }
    };
    /** The site's mark (LOGO in views/layout.js): a gold star above an open book in a navy circle, `size` points wide, top-left at x, y. */
    const mark = (x, y, size) => {
      doc.save(); doc.translate(x, y).scale(size / 32);
      const g = doc.radialGradient(16, 13, 0, 16, 13, 18); g.stop(0, ROYAL).stop(1, N1);
      doc.circle(16, 16, 15).fill(g);
      doc.circle(16, 16, 15).lineWidth(1).strokeOpacity(0.55).stroke(GOLD); doc.strokeOpacity(1);
      doc.circle(16, 11.2, 5.6).fillOpacity(0.22).fill(GOLD); doc.fillOpacity(1);
      doc.path("M16 6.1l1.35 2.85 3.1.38-2.28 2.13.6 3.07L16 13.05l-2.77 1.48.6-3.07-2.28-2.13 3.1-.38z").fill(GOLD);
      doc.path("M5.8 18.4c3.4-1.7 7-1.6 10.2.5v7.1c-3.2-2-6.8-2.1-10.2-.5z").fill(CREAM);
      doc.path("M26.2 18.4c-3.4-1.7-7-1.6-10.2.5v7.1c3.2-2 6.8-2.1 10.2-.5z").fill(TEXT);
      doc.path("M16 18.9v7.1").lineWidth(1).lineCap("round").stroke(AMBER);
      doc.restore();
    };
    /** "Nightlight Press" imprint: the mark plus the name, centred on cy. */
    const imprint = (cy, color = MUTED) => {
      doc.font("Label").fontSize(11.5); const tw = doc.widthOfString("Nightlight Press"), total = 24 + 9 + tw, x = (W - total) / 2;
      mark(x, cy - 12, 24);
      doc.fillColor(color).text("Nightlight Press", x + 33, cy - doc.currentLineHeight() / 2 + 0.5, { lineBreak: false });
    };
    /** Frosted glass: white at 6% with a 13% white border. */
    const glass = (x, y, w, h, r) => { doc.save(); doc.roundedRect(x, y, w, h, r).fillOpacity(0.06).fill(WHITE); doc.roundedRect(x + 0.5, y + 0.5, w - 1, h - 1, r).lineWidth(1).strokeOpacity(0.13).stroke(WHITE); doc.restore(); };
    /** A gold-to-amber pill. */
    const goldPill = (x, y, w, h) => { doc.save(); const g = doc.linearGradient(x, y, x + w, y + h); g.stop(0, GOLD).stop(1, AMBER); doc.roundedRect(x, y, w, h, h / 2).fill(g); doc.restore(); };
    /** Gently wavy hills along the foot of a page. */
    const waveY = (x, y, amp, len, phase) => y + amp * Math.sin((x / len) * 2 * Math.PI + phase) + amp * 0.35 * Math.sin((x / len) * 4.6 * Math.PI + phase * 1.7);
    const hill = (y, amp, len, phase, fill, opacity) => {
      doc.save(); doc.moveTo(0, waveY(0, y, amp, len, phase)); for (let x = 6; x < W + 6; x += 6) doc.lineTo(Math.min(x, W), waveY(Math.min(x, W), y, amp, len, phase));
      doc.lineTo(W, H).lineTo(0, H).closePath(); doc.fillOpacity(opacity).fill(fill); doc.restore();
    };
    /** The Magic Hour night sky: a navy ground, soft blue glows and a sparse starfield. */
    const night = (base, seed, n, glows, keep = []) => { bg(base); for (const [cx, cy, r, c, o] of glows) glow(cx, cy, r, c, o); stars(seed, n, 0, 0, W, H, keep); };

    // ---- Cover: the full-bleed painting under a navy glass title band, with the gold mark as a seal ----
    night(N1, seed0, 70, [[W / 2, H * 0.42, 420, ROYAL, 0.6]]);
    if (coverBytes) { try { doc.image(coverBytes, 0, 0, { cover: [W, H], align: "center", valign: "center" }); } catch { /* typographic cover */ } }
    {
      const sub = teller ? `From a story told by ${teller}` : forName ? `A Nightlight book starring ${forName}` : "A Nightlight book";
      const maxTW = W - 80 - 80;
      fitWidth("Display", title, 40, 28, maxTW);
      const tw = Math.min(maxTW, doc.widthOfString(title)), th = doc.heightOfString(title, { width: maxTW, align: "center" });
      doc.font("Italic").fontSize(16); const sw = doc.widthOfString(sub), sh = doc.currentLineHeight();
      const pw = Math.min(W - 64, Math.max(460, tw + 96, sw + 96)), ph = 24 + th + 6 + sh + 22, px = (W - pw) / 2, py = 26;
      doc.save();
      for (const [dy, o] of [[10, 0.12], [6, 0.14], [3, 0.16]]) doc.roundedRect(px - 2, py + dy, pw + 4, ph, 26).fillOpacity(o).fill(N0);
      doc.roundedRect(px, py, pw, ph, 24).fillOpacity(0.86).fill(N1);
      doc.restore();
      doc.save(); doc.roundedRect(px, py, pw, ph, 24).clip(); glow(W / 2, py - 10, pw * 0.55, ROYAL, 0.45); doc.restore();
      doc.save(); doc.roundedRect(px + 0.5, py + 0.5, pw - 1, ph - 1, 24).lineWidth(1).strokeOpacity(0.13).stroke(WHITE); doc.restore();
      sparkle(px + 24, py + 22, 5.5, GOLD); sparkle(px + 40, py + 36, 2.6, GOLD, 0.8); sparkle(px + pw - 26, py + ph - 24, 4.5, GOLD, 0.9); sparkle(px + pw - 42, py + ph - 38, 2.4, GOLD, 0.7);
      noBreak(() => {
        fitWidth("Display", title, 40, 28, maxTW);
        doc.fillColor(CREAM).text(title, px + 40, py + 22, { width: pw - 80, align: "center" });
        doc.font("Italic").fontSize(16).fillColor(GOLD).text(sub, px + 24, doc.y + 6, { width: pw - 48, align: "center", lineBreak: false });
      });
      // Publisher's seal, bottom right, like a real picture-book cover.
      glow(W - 50, H - 50, 46, GOLD, 0.35);
      doc.save(); doc.circle(W - 50, H - 50, 25).fillOpacity(0.9).fill(N0); doc.restore();
      mark(W - 50 - 22, H - 50 - 22, 44);
    }

    // ---- Half-title + dedication on a starry navy page, with the imprint at the foot ----
    doc.addPage();
    noBreak(() => {
      const tW = W - 200, dW = W - 240;
      fitWidth("Display", title, 36, 26, tW); const tH = doc.heightOfString(title, { width: tW, align: "center" }), tS = doc._fontSize;
      doc.font("Italic").fontSize(17); const dH = b.dedication ? doc.heightOfString(b.dedication, { width: dW, align: "center", lineGap: 2 }) : 0;
      const logo = 64, block = logo + 30 + tH + (dH ? 30 + dH : 0), y0 = Math.max(64, (H - 100 - block) / 2 + 20);
      night(N1, seed0 + 1, 64, [[W / 2, y0 + block / 2, 400, ROYAL, 0.65], [W / 2, y0 + logo / 2, 120, GLOW, 0.3]], [[(W - tW) / 2 - 10, y0 - 10, tW + 20, block + 20], [W / 2 - 110, H - 84, 220, 40]]);
      glow(W / 2, y0 + logo / 2, 70, GOLD, 0.28);
      mark((W - logo) / 2, y0, logo);
      doc.fillColor(CREAM).font("Display").fontSize(tS).text(title, (W - tW) / 2, y0 + logo + 30, { width: tW, align: "center" });
      if (dH) doc.font("Italic").fontSize(17).fillColor(MUTED).text(b.dedication, (W - dW) / 2, doc.y + 30, { width: dW, align: "center", lineGap: 2 });
      imprint(H - 64);
    });

    // ---- Story pages: the painting on top, read-aloud text in cream on a navy band below ----
    for (const pg of pages) {
      doc.addPage(); bg(N1);
      const text = String(pg.text || ""), tW = W - 150, opts = { width: tW, align: "center", lineGap: 5 };
      // Story type never drops below 18pt: when a page is wordy the band grows and the painting gives up a little height.
      doc.font("Body"); let fs = 22, imgH = 452;
      const room = () => H - 34 - (imgH + 18);
      for (;;) { doc.fontSize(fs); if (doc.heightOfString(text, opts) <= room()) break; if (fs > 18) fs -= 1; else if (imgH > 360) imgH -= 8; else break; }
      doc.fontSize(fs); const h = doc.heightOfString(text, opts), top = imgH + 18, bottom = H - 34;
      glow(W / 2, imgH + (H - imgH) / 2 + 10, 340, ROYAL, 0.4);
      stars(seed0 + 10 + (pg.idx || 0), 22, 0, imgH + 8, W, H - imgH - 8, [[(W - tW) / 2 - 16, imgH, tW + 32, H - imgH], [W - 90, H - 60, 90, 60]]);
      if (pg.bytes) {
        try { doc.save(); doc.rect(0, 0, W, imgH).clip(); doc.image(pg.bytes, 0, 0, { cover: [W, imgH], align: "center", valign: "center" }); doc.restore(); } catch { /* skip */ }
        doc.save(); const g = doc.linearGradient(0, imgH - 40, 0, imgH); g.stop(0, N1, 0).stop(1, N1, 1); doc.rect(0, imgH - 40, W, 40).fill(g); doc.restore();
      }
      doc.save(); doc.moveTo(W / 2 - 90, imgH + 1).lineTo(W / 2 + 90, imgH + 1).lineWidth(1).strokeOpacity(0.35).stroke(GOLD); doc.restore();
      noBreak(() => {
        doc.font("Body").fontSize(fs).fillColor(CREAM).text(text, (W - tW) / 2, top + Math.max(0, (bottom - top - h) / 2), { ...opts, height: H - top - 6 });
        const n = String(pg.idx ?? ""); doc.font("Label").fontSize(11); const nw = Math.max(26, doc.widthOfString(n) + 16), nx = W - 30 - nw, ny = H - 30 - 20;
        goldPill(nx, ny, nw, 20);
        doc.fillColor(N1).text(n, nx, ny + 10 - doc.currentLineHeight() / 2 + 0.5, { width: nw, align: "center", lineBreak: false });
      });
    }

    // ---- Learn about robots: three true facts the Author wrote for this reader, in glass cards with glowing badges ----
    const facts = (b.story && Array.isArray(b.story.robot_facts) ? b.story.robot_facts : []).slice(0, 3);
    if (facts.length) {
      doc.addPage();
      night(N1, seed0 + 2, 46, [[W / 2, 90, 380, ROYAL, 0.6], [W * 0.15, H * 0.8, 260, GLOW, 0.22]], [[160, 44, W - 320, 80], [60, 132, W - 120, H - 160]]);
      noBreak(() => {
        doc.fillColor(CREAM).font("Display").fontSize(34).text("Learn about robots", 60, 52, { width: W - 120, align: "center" });
        doc.font("Italic").fontSize(15).fillColor(MUTED).text("Three true things to wonder about together", 60, 98, { width: W - 120, align: "center" });
        const cx0 = 70, cw = W - 140, tx = cx0 + 116, tw = cw - 116 - 30, gap = 16, top = 140, avail = H - 36 - top;
        let fs = 21; const hOf = (s) => { doc.font("Body").fontSize(s); return facts.map((t) => Math.max(92, doc.heightOfString(String(t), { width: tw, lineGap: 3 }) + 40)); };
        let hs = hOf(fs); while (fs > 18 && hs.reduce((a, c) => a + c, 0) + gap * (facts.length - 1) > avail) hs = hOf(--fs);
        let y = top + Math.max(0, (avail - hs.reduce((a, c) => a + c, 0) - gap * (facts.length - 1)) / 2);
        facts.forEach((t, i) => {
          const ch = hs[i], cy = y + ch / 2, bx = cx0 + 58, color = [GOLD, SKY, PINK][i % 3];
          glass(cx0, y, cw, ch, 22);
          glow(bx, cy, 56, color, 0.7);
          doc.save(); doc.circle(bx, cy, 28).fill(color); doc.restore();
          // a tiny robot face in each badge
          doc.save();
          doc.moveTo(bx, cy - 9).lineTo(bx, cy - 16).lineWidth(2).lineCap("round").stroke(N1); doc.circle(bx, cy - 17.5, 3).fill(CREAM);
          doc.roundedRect(bx - 15, cy - 9, 30, 22, 7).fill(N1);
          doc.circle(bx - 6, cy + 1, 3.3).fill(color); doc.circle(bx + 6, cy + 1, 3.3).fill(color);
          doc.moveTo(bx - 4, cy + 7).quadraticCurveTo(bx, cy + 9.5, bx + 4, cy + 7).lineWidth(1.4).lineCap("round").stroke(CREAM);
          doc.restore();
          doc.font("Body").fontSize(fs); const th = doc.heightOfString(String(t), { width: tw, lineGap: 3 });
          doc.fillColor(CREAM).text(String(t), tx, cy - th / 2, { width: tw, lineGap: 3 });
          y += ch + gap;
        });
      });
    }

    // ---- The End, under the stars over dark hills, with the colophon and the mark ----
    doc.addPage();
    night(N0, seed0 + 3, 80, [[W / 2, 200, 360, ROYAL, 0.5], [W / 2, H + 60, 460, GLOW, 0.3]], [[200, 52, W - 400, 160], [120, 226, W - 240, 290]]);
    hill(538, 12, 560, 0.7, N2, 0.85);
    hill(566, 9, 470, 2.3, N1, 1);
    hill(592, 6, 380, 4.1, N0, 0.9);
    glow(W / 2, 92, 64, GOLD, 0.3);
    mark(W / 2 - 28, 64, 56);
    noBreak(() => {
      doc.font("Display").fontSize(48); const ey = 140;
      glow(W / 2, ey + 30, 170, GOLD, 0.16);
      doc.fillColor(GOLD).text("The End", 40, ey, { width: W - 80, align: "center" });
      doc.font("Italic").fontSize(17).fillColor(MUTED).text("Sweet dreams.", 40, doc.y + 4, { width: W - 80, align: "center" });
      if (b.blurb) doc.font("Body").fontSize(13.5).fillColor(CREAM).text(b.blurb, 140, doc.y + 28, { width: W - 280, align: "center", lineGap: 3, height: 116 });
      imprint(436, CREAM);
      const c = b.checks || {};
      doc.font("Body").fontSize(9.5).fillColor(MUTED).text(`Written by Nightlight’s Author, illustrated by its Illustrator, narrated by its Narrator and bound by its Binder: AI staff at a publisher with no employees. Checked by the Editor before a single picture was painted${c.reading_grade != null ? ` (reading grade ${c.reading_grade}, ${c.words} words)` : ""}.${teller ? ` Adapted from a story told aloud by ${teller}.` : ""}${robot ? " Featuring Pip, a PlayRobot character, included at the family's request." : ""}`, 100, 458, { width: W - 200, align: "center", lineGap: 1.5 });
      if (robot) { const toy = process.env.PLAYROBOT_TOY_URL || "https://vnmoorthy.github.io/nightlight-press/playrobot/#pip"; doc.font("Body").fontSize(10).fillColor("#FFD36E").text("For grown-ups: meet Pip at the PlayRobot toy shop", 100, 512, { width: W - 200, align: "center", link: toy, underline: true }); }
    });
    doc.end();
  });
}
