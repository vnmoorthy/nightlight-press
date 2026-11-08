/** The Binder: a landscape picture book with a painted cover, read-aloud-sized type and an honest colophon. Daybreak storybook palette. */
import PDFDocument from "pdfkit";
import { FONTS } from "./prompts.generated.js";
const INK = "#22223B", MUTED = "#6B6A80", PAPER = "#FFF8EC", PAPER2 = "#FFF1DA", LINE = "#EADFCB", TOMATO = "#FF6B4A", SUN = "#FFC233";
export function renderBook(b, pages, coverBytes, { forName } = {}) {
  return new Promise((resolve, reject) => {
    const W = 792, H = 612;
    const doc = new PDFDocument({ size: [W, H], margin: 0, autoFirstPage: true, info: { Title: b.title || "A Nightlight book", Author: "Nightlight Press", Creator: "Nightlight Press" } });
    const f = (k) => FONTS[k] ? Buffer.from(FONTS[k], "base64") : null;
    doc.registerFont("Body", f("ebg-400-normal") || "Times-Roman"); doc.registerFont("Italic", f("ebg-400-italic") || "Times-Italic"); doc.registerFont("Semi", f("ebg-600-normal") || "Times-Bold");
    const chunks = []; doc.on("data", (c) => chunks.push(c)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
    const bg = (c) => { doc.save(); doc.rect(0, 0, W, H).fill(c); doc.restore(); };
    const noBreak = (fn) => { const m = doc.page.margins.bottom; doc.page.margins.bottom = 0; fn(); doc.page.margins.bottom = m; };
    // A little paper-cut sun between two hairlines: the book's ornament.
    const ornament = (cx, cy, r = 9) => {
      doc.save();
      doc.lineWidth(1).strokeColor(LINE).moveTo(cx - 120, cy).lineTo(cx - r * 2.6, cy).stroke().moveTo(cx + r * 2.6, cy).lineTo(cx + 120, cy).stroke();
      doc.lineWidth(Math.max(1.6, r * 0.24)).lineCap("round").strokeColor(TOMATO);
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 + Math.PI / 8; doc.moveTo(cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 1.5).lineTo(cx + Math.cos(a) * r * 2.05, cy + Math.sin(a) * r * 2.05).stroke(); }
      doc.circle(cx, cy, r).fill(TOMATO);
      doc.restore();
    };
    // Cover
    bg(PAPER2);
    if (coverBytes) { try { doc.image(coverBytes, 0, 0, { cover: [W, H], align: "center", valign: "center" }); } catch { /* typographic cover */ } }
    doc.save(); doc.rect(0, 0, W, 150).fillOpacity(0.8).fill(INK); doc.restore(); doc.fillOpacity(1);
    noBreak(() => { doc.fillColor(PAPER).font("Semi").fontSize(40).text(b.title || "", 40, 34, { width: W - 80, align: "center" });
      doc.font("Italic").fontSize(15).fillColor(SUN).text(forName ? `A Nightlight book starring ${forName}` : "A Nightlight book", 40, 104, { width: W - 80, align: "center" }); });
    // Title + dedication
    doc.addPage(); bg(PAPER);
    ornament(W / 2, 150);
    noBreak(() => { doc.fillColor(INK).font("Semi").fontSize(34).text(b.title || "", 80, 200, { width: W - 160, align: "center" });
      if (b.dedication) doc.font("Italic").fontSize(17).fillColor(MUTED).text(b.dedication, 120, 320, { width: W - 240, align: "center" }); });
    // Pages
    for (const pg of pages) {
      doc.addPage(); bg(PAPER);
      const imgH = 452;
      if (pg.bytes) { try { doc.save(); doc.rect(0, 0, W, imgH).clip(); doc.image(pg.bytes, 0, 0, { cover: [W, imgH], align: "center", valign: "center" }); doc.restore(); } catch { /* skip */ } }
      noBreak(() => { doc.fillColor(INK).font("Body").fontSize(String(pg.text || "").length > 220 ? 17 : 20).text(pg.text || "", 56, imgH + 22, { width: W - 112, height: H - imgH - 40, align: "center", lineGap: 3 });
        doc.fillColor(MUTED).font("Body").fontSize(9).text(String(pg.idx), W - 40, H - 22, { width: 20, align: "right", lineBreak: false }); });
    }
    // The end + colophon
    doc.addPage(); bg(PAPER2);
    ornament(W / 2, 132);
    noBreak(() => { doc.fillColor(TOMATO).font("Semi").fontSize(46).text("The End", 40, 170, { width: W - 80, align: "center" });
      doc.font("Italic").fontSize(16).fillColor(INK).text("Sweet dreams.", 40, 240, { width: W - 80, align: "center" });
      if (b.blurb) doc.font("Body").fontSize(13).fillColor(INK).text(b.blurb, 140, 320, { width: W - 280, align: "center", lineGap: 2 });
      const c = b.checks || {};
      doc.font("Body").fontSize(9.5).fillColor(MUTED).text(`Written by Nightlight's Author, illustrated by its Illustrator, narrated by its Narrator and bound by its Binder: AI staff at a publisher with no employees. Checked by the Editor before a single picture was painted${c.reading_grade != null ? ` (reading grade ${c.reading_grade}, ${c.words} words)` : ""}. Nightlight Press · nightlight`, 120, 520, { width: W - 240, align: "center" }); });
    doc.end();
  });
}
