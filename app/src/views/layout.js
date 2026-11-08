export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const LOGO = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><defs><radialGradient id="nlg" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#1F3FA6"/><stop offset="1" stop-color="#0B1A4A"/></radialGradient></defs><circle cx="16" cy="16" r="15" fill="url(#nlg)" stroke="#FFD36E" stroke-opacity=".55" stroke-width="1"/><circle cx="16" cy="11.2" r="5.6" fill="#FFD36E" opacity=".22"/><path d="M16 6.1l1.35 2.85 3.1.38-2.28 2.13.6 3.07L16 13.05l-2.77 1.48.6-3.07-2.28-2.13 3.1-.38z" fill="#FFD36E"/><path d="M5.8 18.4c3.4-1.7 7-1.6 10.2.5v7.1c-3.2-2-6.8-2.1-10.2-.5z" fill="#FFF7E8"/><path d="M26.2 18.4c-3.4-1.7-7-1.6-10.2.5v7.1c3.2-2 6.8-2.1 10.2-.5z" fill="#EAF0FF"/><path d="M16 18.9v7.1" stroke="#FFB13B" stroke-width="1" stroke-linecap="round"/></svg>`;
/** The staff of Nightlight Press. `kind` says what each one really is. */
export const STAFF = [
  { key: "author", name: "The Author", role: "Writes a new story for each child, in their language", kind: "Naïve agent", color: "#B9A6FF", icon: "✒️" },
  { key: "editor", name: "The Editor", role: "Counts every word, checks reading level, the child's name on each page, no brands or scary bits", kind: "Code", color: "#5EE6A8", icon: "🔎" },
  { key: "illustrator", name: "The Illustrator", role: "Paints the cover and every page in the style you pick", kind: "Monid · image model", color: "#FF8A6B", icon: "🎨" },
  { key: "narrator", name: "The Narrator", role: "Records a gentle read-aloud for each page", kind: "Naïve speech", color: "#FFD36E", icon: "🎙️" },
  { key: "binder", name: "The Binder", role: "Typesets and binds a print-ready PDF", kind: "Code · PDFKit", color: "#6FC3FF", icon: "📚" },
  { key: "mailroom", name: "The Mailroom", role: "Emails the book with the PDF attached and texts the link", kind: "AgentMail · Monid SMS", color: "#FF8FC4", icon: "✉️" },
  { key: "storyteller", name: "The Storyteller Line", role: "Phones Grandma and reads her the book, introducing itself as an AI", kind: "Monid phone line", color: "#FFB13B", icon: "☎️" },
  { key: "frontdesk", name: "The Front Desk", role: "Reads replies, answers questions and sends changes back to production", kind: "Naïve agent · AgentMail", color: "#9BF06B", icon: "💬" },
  { key: "proofreader", name: "The Proofreader", role: "Opens each finished book on a real Android phone to check it", kind: "Mobilerun", color: "#4FE3D3", icon: "📱" },
  { key: "marketer", name: "Marketing", role: "Commissions a new free book for the shelf every night and tells subscribers", kind: "Naïve agent", color: "#FF6FAE", icon: "📣" },
  { key: "cashier", name: "The Cashier", role: "Takes the $19 through Stripe Checkout. Agents never touch money", kind: "Code · Stripe", color: "#A99BFF", icon: "💳" },
  { key: "clock", name: "The Night Manager", role: "Wakes the office every five minutes and keeps the queue moving", kind: "Naïve scheduled agent", color: "#FFE08A", icon: "⏰" },
];
/** Painted art from /art: webp with a jpg/png fallback, lazy by default, sized to stop layout shift. */
export function art(name, { cls = "", alt = "", w = 1536, h = 1024, png = false, eager = false, attrs = "" } = {}) {
  return `<picture class="${cls}" ${attrs}><source srcset="/art/${name}.webp" type="image/webp"><img src="/art/${name}.${png ? "png" : "jpg"}" alt="${esc(alt)}" width="${w}" height="${h}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></picture>`;
}
/** A glowing wavy divider between sections. */
export const WAVE = `<div class="wave" aria-hidden="true"><svg viewBox="0 0 1440 64" preserveAspectRatio="none"><path class="w1" d="M0 34C180 6 360 6 540 30S900 58 1080 32 1320 8 1440 26"/><path class="w2" d="M0 44C200 22 380 24 560 40S920 60 1100 42 1330 22 1440 36"/></svg><span class="wave-star"></span></div>`;
export function layout({ title, body, scripts = "", bodyClass = "", head = "", nav = true, mode = "pledge", desc }) {
  const d = desc || "A picture book starring your child: written, painted, narrated and bound in minutes by Nightlight Press, a publisher run entirely by AI agents.";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(d)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(d)}"><meta property="og:image" content="/img/og.jpg"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#050B2E">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(LOGO.replace('aria-hidden="true"', 'xmlns="http://www.w3.org/2000/svg"'))}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Literata:ital,wght@0,400;0,500;1,400&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/nl.css"><link rel="stylesheet" href="/css/magic.css">${head}</head><body class="${bodyClass}">
${nav ? `<nav class="top"><div class="wrap"><a class="brand" href="/">${LOGO}Nightlight Press</a><div class="links"><a href="/#how">How it works</a><a href="/tell">Tell a story</a><a href="/shelf">The shelf</a><a href="/office">Watch the office</a><a href="/board">Company board</a><a class="btn small" href="/#make">Make their book</a></div></div></nav>` : ""}
${body}
${nav ? `<footer><div class="wrap"><div>${LOGO.replace("<svg", '<svg style="width:18px;height:18px;vertical-align:-4px;margin-right:6px"')}Nightlight Press. A US children's publisher with no employees: agents on Naïve, art and phone calls through Monid, letters through AgentMail, phones through Mobilerun.</div><div><a href="/office">The office</a> · <a href="/board">Company board</a> · <a href="/api/ledger.json">Public ledger</a> · Payments: ${mode === "pledge" ? "pledge mode, no card is charged" : mode === "test" ? "Stripe test mode" : "Stripe"}</div></div></footer>` : ""}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>window.toast=(m)=>{const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(window.__tt);window.__tt=setTimeout(()=>t.classList.remove('show'),3400)};window.esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));</script>
<script src="/js/magic.js" defer></script>${scripts}<script src="/js/pip.js" defer></script></body></html>`;
}
