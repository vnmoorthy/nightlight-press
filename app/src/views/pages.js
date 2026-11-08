import { layout, esc, STAFF, art, WAVE } from "./layout.js";
import { LANG, STYLES } from "../prompts.js";
const SW = { watercolor: "linear-gradient(135deg,#FFF7E8,#6FC3FF 55%,#FF6FAE)", storybook: "linear-gradient(135deg,#FFB13B,#FFD36E 45%,#1F3FA6)", papercut: "linear-gradient(135deg,#FF6FAE,#FFD36E 38%,#6FC3FF 68%,#1F3FA6)", pencil: "repeating-linear-gradient(45deg,#FFF7E8 0 6px,#A9B6E0 6px 8px)", night: "linear-gradient(135deg,#050B2E,#1F3FA6 55%,#FFD36E)" };
const SN = { watercolor: "Watercolour", storybook: "Storybook", papercut: "Paper-cut", pencil: "Crayon", night: "Starry night" };
const OCC = ["A bedtime adventure", "First day of school", "A new baby in the family", "Being brave at the doctor", "Their birthday", "Moving to a new home", "Missing someone far away", "Learning to share"];
const cov = (b) => (b.cover_media_id ? `background-image:url('/api/media/${b.cover_media_id}')` : `background:${SW[b.style] || SW.watercolor}`);
const price = (c) => `$${(c / 100).toFixed(0)}`;
const CHEV = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

export function landingPage({ mode, price: p = 1900, shelf = [], from }) {
  const fan = [...shelf.slice(0, 3)];
  const demo = [{ title: "Maya and the Moon Library", style: "night" }, { title: "Leo's Very Big First Day", style: "watercolor" }, { title: "Abuela's Kite", style: "papercut" }];
  while (fan.length < 3) fan.push(demo[fan.length]);
  const body = `
<header class="hc" id="hc" aria-roledescription="carousel" aria-label="Nightlight Press highlights">
  <div class="hc-slide on hc-magic" role="group" aria-roledescription="slide" aria-label="1 of 3">
    <div class="hc-scene" aria-hidden="true">
      <div class="hc-layer hc-bg" data-depth="0.12">${art("hero-panorama", { eager: true })}</div>
      <div class="hc-stars" data-starfield></div>
      <div class="hc-layer hc-pip" data-depth="0.6"><div class="hc-pip-in"><img class="float float-glow" src="/media/pip_hero.webp" width="1024" height="1024" alt="Pip the PlayRobot, rendered in 3D, waving" fetchpriority="high" decoding="async"><span class="hc-hi">Hi, I'm Pip!</span></div></div>
    </div>
    <div class="hc-copy"><div class="wrap"><div class="in"><div class="eyebrow white" data-reveal="fade">A children's publisher with no employees</div>
      <h1 data-reveal>Tonight's bedtime book stars <em class="hl"><span class="swoosh gild" style="--swoosh-delay:.9s">your child.</span></em></h1>
      <p data-reveal>Tell us their name, what they look like and what they love. Our AI staff writes a new story, paints every page, records a read-aloud and binds a print-ready book in about five minutes. ${price(p)}, with changes free.</p>
      <div class="ctas" data-reveal="zoom"><a class="btn" href="#make" data-sparkle>Make their book · ${price(p)}</a><a class="btn ghost" href="/tell">Tell a story out loud</a></div>
      <div class="hc-badges" data-reveal="fade"><span>✒️ A new story every time</span><span>🎨 Painted for them</span><span>🎙️ Read aloud, 16 languages</span><span>☎️ We'll phone Grandma</span></div></div></div></div></div>
  <div class="hc-slide" role="group" aria-roledescription="slide" aria-label="2 of 3"><video muted loop playsinline preload="none" poster="/media/book_open_poster.jpg" src="/media/book_open.mp4"></video>
    <div class="hc-copy"><div class="wrap"><div class="in"><div class="eyebrow white">New · Tell a story</div>
      <h2>Tell us a story. <em class="hl">We'll make it a book.</em></h2>
      <p>Say it out loud: a bedtime tale, something from today, a story from when you were small. The Author keeps your words, the Illustrator paints every page.</p>
      <div class="ctas"><a class="btn" href="/tell">Tell a story</a><a class="btn ghost" href="/shelf">Read the free shelf</a></div></div></div></div></div>
  <div class="hc-slide" role="group" aria-roledescription="slide" aria-label="3 of 3"><video muted loop playsinline preload="none" poster="/media/office_flythrough_poster.jpg" src="/media/office_flythrough.mp4"></video>
    <div class="hc-copy"><div class="wrap"><div class="in"><div class="eyebrow white">Run entirely by AI agents</div>
      <h2>A publisher with <em class="hl">no employees.</em></h2>
      <p>Twelve desks, every one an agent or a piece of code. Watch the Author, the Illustrator and the Narrator work, live, in a 3D office.</p>
      <div class="ctas"><a class="btn" href="/office">Watch the office work</a><a class="btn ghost" href="/board">Company board</a></div></div></div></div></div>
  <div class="hc-ctrl"><div class="wrap"><div class="hc-dots" role="tablist" aria-label="Choose a slide"><button type="button" class="on" aria-label="Slide 1" aria-selected="true"></button><button type="button" aria-label="Slide 2" aria-selected="false"></button><button type="button" aria-label="Slide 3" aria-selected="false"></button></div>
    <button type="button" class="hc-arrow" data-dir="-1" aria-label="Previous slide">${CHEV("M15 5l-7 7 7 7")}</button><button type="button" class="hc-arrow" data-dir="1" aria-label="Next slide">${CHEV("M9 5l7 7-7 7")}</button></div></div>
</header>

<section class="rails rails-night"><div class="sec-art" aria-hidden="true">${art("shelf-night")}</div><div class="wrap">
  <div class="rail"><div class="rail-h"><div><div class="eyebrow">The free shelf</div><h2 style="margin-top:12px">New on the free shelf</h2></div><div style="display:flex;gap:14px;align-items:center"><a href="/shelf">See all</a><div class="rail-nav"><button type="button" class="rail-arrow" data-dir="-1" aria-label="Scroll left">${CHEV("M15 5l-7 7 7 7")}</button><button type="button" class="rail-arrow" data-dir="1" aria-label="Scroll right">${CHEV("M9 5l7 7-7 7")}</button></div></div></div>
    <div class="rail-track">${(shelf.length ? shelf.slice(0, 12) : demo).map((b) => `<a class="tile" href="${b.id ? `/book/${b.id}` : "/shelf"}" style="${cov(b)}"><small>${SN[b.style] || "Free"}</small><b>${esc(b.title)}</b></a>`).join("")}</div></div>
  <div class="rail"><div class="rail-h"><div><div class="eyebrow">Pick a look</div><h2 style="margin-top:12px">Make one like these</h2></div><div class="rail-nav"><button type="button" class="rail-arrow" data-dir="-1" aria-label="Scroll left">${CHEV("M15 5l-7 7 7 7")}</button><button type="button" class="rail-arrow" data-dir="1" aria-label="Scroll right">${CHEV("M9 5l7 7-7 7")}</button></div></div>
    <div class="rail-track">${Object.keys(STYLES).map((k, i) => { const ex = shelf.find((b) => b.style === k && b.cover_media_id); return `<a class="tile" href="/#make" style="${ex ? cov(ex) : `background:${SW[k]}`}"><small>${SN[k] || k}</small><b>${esc(["A bedtime adventure", "First day of school", "A new baby in the family", "Being brave at the doctor", "Their birthday"][i % 5])}</b></a>`; }).join("")}</div></div>
</div></section>

${WAVE}<section id="how"><div class="wrap"><div class="sec-head"><div><div class="eyebrow" data-reveal="fade">How it works</div><h2 style="margin-top:16px;max-width:760px" data-reveal>Three minutes of you. <span class="swoosh">Five minutes of them.</span></h2></div><div class="sec-head-art books-art" aria-hidden="true">${art("floating-books", { cls: "float float-slow", w: 1024, h: 1024, png: true })}</div></div>
<div class="steps">
  <div class="card step" data-reveal><div class="n">1</div><h3>Tell us about the hero</h3><p class="muted">First name, age, what they look like, what they love, and what the story is for: a first day of school, a new sibling, a brave trip to the dentist. No photos needed.</p></div>
  <div class="card step" data-reveal><div class="n">2</div><h3>Watch it being made</h3><p class="muted">The Author writes it, the Editor checks every word, the Illustrator paints each page and the Narrator records it. You watch each page arrive live.</p></div>
  <div class="card step" data-reveal><div class="n">3</div><h3>Read it tonight</h3><p class="muted">A web book with "Read to me", a print-ready PDF in your inbox, and if you like, a phone call that reads it to Grandma. Reply to the email to change anything.</p></div>
</div></div></section>

${WAVE}<section id="make" class="make-sec"><div class="wrap make">
  <div><div class="eyebrow">Make their book</div><h2 style="margin-top:16px">Who's the hero?</h2>
    <p class="lede muted" style="margin-top:16px">Every book is written from scratch for one child. Nothing is a template with a name pasted in.</p>
    <div class="card getcard"><b style="font:600 20px var(--display)">What you get for ${price(p)}</b>
      <ul class="muted"><li>An illustrated story of 10 pages plus a painted cover</li><li>A read-aloud web book for bedtime</li><li>A print-ready PDF, emailed to you</li><li>Free changes: reply to the email and the Front Desk fixes it</li><li>Optional: we phone a grandparent and read it to them</li></ul>
      <p class="small muted" style="margin:14px 0 0">${mode === "pledge" ? "This instance is in <b>pledge mode</b>: no card is taken and the book is free while we test." : mode === "test" ? "Stripe <b>test mode</b>: use card 4242 4242 4242 4242." : "Secure checkout by Stripe."}</p></div>
  </div>
  <form class="card form" id="orderForm" novalidate data-from="${esc(from?.id || "")}">
    <div class="stepper"><i class="on"></i><i></i><i></i></div>
    <fieldset data-step="1" style="border:0;padding:0;margin:0;min-width:0">
      <div class="row3"><div class="field"><label for="child_name">Child's first name</label><input id="child_name" name="child_name" autocomplete="off" maxlength="40" placeholder="Maya" required></div>
        <div class="field"><label for="child_age">Age</label><select id="child_age" name="child_age">${Array.from({ length: 12 }, (_, i) => `<option ${i + 1 === 5 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></div>
        <div class="field"><label>Call them</label><div class="chips" data-name="pronoun"><button type="button" data-v="she">she</button><button type="button" data-v="he">he</button><button type="button" class="on" data-v="they">they</button></div></div></div>
      <div class="field"><label for="look">What do they look like?</label><textarea id="look" name="look" rows="2" maxlength="240" placeholder="Brown skin, curly black hair in two puffs, round glasses, a yellow raincoat"></textarea></div>
      <div class="field"><label for="favorites">What do they love?</label><textarea id="favorites" name="favorites" rows="2" maxlength="300" placeholder="Dinosaurs, our dog Biscuit, swimming, Grandma's mango lassi"></textarea></div>
    </fieldset>
    <fieldset data-step="2" hidden style="border:0;padding:0;margin:0;min-width:0">
      <div class="field"><label for="occasion">What should the story be about?</label><div class="chips" id="occChips" style="margin-bottom:10px">${OCC.map((o) => `<button type="button">${esc(o)}</button>`).join("")}</div><textarea id="occasion" name="occasion" rows="2" maxlength="240" placeholder="Starting kindergarten next week and feeling a bit nervous">${esc(from?.occasion || "")}</textarea></div>
      <div class="field"><label>Pictures</label><div class="styles">${Object.keys(STYLES).map((k) => `<label><input type="radio" name="style" value="${k}" ${k === (from?.style || "watercolor") ? "checked" : ""}><div class="sw" style="background:${SW[k]}"></div><span>${SN[k]}</span></label>`).join("")}</div></div>
      <div class="field"><label for="language">Language</label><select id="language" name="language">${Object.entries(LANG).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
    </fieldset>
    <fieldset data-step="3" hidden style="border:0;padding:0;margin:0;min-width:0">
      <div class="row2"><div class="field"><label for="buyer_email">Your email (the book arrives here)</label><input id="buyer_email" name="buyer_email" type="email" autocomplete="email" required placeholder="you@example.com"></div>
        <div class="field"><label for="buyer_name">From (for the dedication)</label><input id="buyer_name" name="buyer_name" autocomplete="name" maxlength="80" placeholder="Mum and Dad"></div></div>
      <div class="field"><label for="buyer_phone">Text me the link too (US mobile, optional)</label><input id="buyer_phone" name="buyer_phone" type="tel" autocomplete="tel" placeholder="(415) 555-0134"></div>
      <div class="card callcard"><b style="font:600 18px var(--display)">☎️ Phone someone and read it to them</b><p class="small" style="margin:4px 0 12px;color:var(--ink2)">When the book is ready, our Storyteller Line calls them and reads it aloud. It says it's an AI at the start.</p>
        <div class="row2"><div class="field" style="margin:0"><label for="read_to_name">Their name</label><input id="read_to_name" name="read_to_name" maxlength="60" placeholder="Grandma Lakshmi"></div><div class="field" style="margin:0"><label for="read_to_phone">Their phone</label><input id="read_to_phone" name="read_to_phone" type="tel" placeholder="+1 312 555 0199"></div></div>
        <label class="check" style="margin:12px 0 0"><input type="checkbox" name="read_consent"><span class="small">They know an AI storyteller from Nightlight will call them, and they're happy to get the call.</span></label></div>
      <label class="check"><input type="checkbox" name="subscribe" checked><span>Send me the free book Marketing commissions each night (unsubscribe any time)</span></label>
    </fieldset>
    <div class="err" id="formErr" role="alert"></div>
    <div class="formnav"><button type="button" class="btn ghost small" id="back" hidden>Back</button><span></span><button type="button" class="btn" id="next">Next</button><button type="submit" class="btn coral" id="submit" hidden>${mode === "pledge" ? "Make the book (free while testing)" : `Make the book · ${price(p)}`}</button></div>
  </form>
</div></section>

${WAVE}<section id="staff"><div class="wrap"><div class="sec-head staff-head"><div><div class="eyebrow lilac" data-reveal="fade">The staff</div><h2 style="margin-top:16px;max-width:820px" data-reveal>Twelve jobs. <span class="swoosh gild">Nobody on payroll.</span></h2>
<p class="lede muted" style="margin-top:14px" data-reveal>Each desk is a real agent or a piece of code with one job. Agents write, paint and talk. Code decides when, whether, and how much. <a href="/office">Watch them work in the office</a>.</p></div>
<figure class="art-frame" data-reveal="right">${art("staff-scene", { alt: "A cutaway of the Nightlight office at night: robots writing, editing, painting, recording, filming, binding and sorting mail" })}<figcaption>After hours at the Nightlight office, Fernhush Bay</figcaption></figure></div>
<div class="staff">${STAFF.map((s) => `<div class="card" data-reveal="zoom" style="--c:${s.color}"><div class="av">${s.icon}</div><div><b>${esc(s.name)}</b><div class="small muted">${esc(s.role)}</div><span class="tag">${esc(s.kind)}</span></div></div>`).join("")}</div></div></section>



${WAVE}<section><div class="wrap"><div class="eyebrow leaf">Made carefully</div><h2 style="margin-top:16px">What we promise parents</h2>
<div class="trust"><div class="card" data-reveal><div class="ico" aria-hidden="true">📷</div><h3>No photos, ever</h3><p class="muted">We never ask for a picture of your child. The Illustrator works from your words.</p></div><div class="card" data-reveal><div class="ico" aria-hidden="true">✅</div><h3>Checked by code, not vibes</h3><p class="muted">The Editor rejects drafts with too many words for the age, missing names, brands or anything scary, and sends them back to be rewritten.</p></div><div class="card" data-reveal><div class="ico" aria-hidden="true">🤖</div><h3>AI says it's AI</h3><p class="muted">Every phone call starts by saying it's an AI storyteller. We only call people you've told us expect it, at most three times per book.</p></div></div>
<div class="faq" style="margin-top:54px;max-width:820px">
<details><summary>How long does it take?</summary><p class="muted">Usually four to seven minutes. You can watch every page being painted on your order page.</p></details>
<details><summary>Can I change something?</summary><p class="muted">Yes, free. Reply to the email or use the box beside the book: "make her hair curlier", "her dog is called Biscuit, not Cookie", "add her baby brother on page 4". The Front Desk sends it back to the right desk.</p></details>
<details><summary>Who actually runs this company?</summary><p class="muted">Agents running on Naïve, with a public <a href="/board">company board</a> and a hash-chained ledger of everything they do. When a person steps in, it's recorded as an intervention.</p></details>
<details><summary>Can I print it?</summary><p class="muted">The PDF is 11 × 8.5 inch landscape with full-bleed pictures, ready for any home printer or a print shop.</p></details>
</div>
<form id="subForm" class="card subscribe" data-reveal="zoom"><div style="flex:1;min-width:240px"><b>🌙 A free bedtime book, every night</b><div class="muted small">Marketing writes one each night. We'll email it to you.</div></div><input type="email" name="email" required placeholder="you@example.com" aria-label="Your email"><button class="btn dark">Subscribe</button></form>
</div></section>`;
  return layout({ title: "Nightlight Press · a bedtime book starring your child", body, mode, scripts: `<script src="/js/site.js" defer></script><script src="/js/carousel.js" defer></script>`, head: `<link rel="preload" as="image" href="/art/hero-panorama.webp" type="image/webp">` });
}

export function orderPage({ o, mode }) {
  const st = [["author", "Author", "writes the story"], ["editor", "Editor", "checks every word"], ["illustrator", "Illustrator", "paints each page"], ["narrator", "Narrator", "records it"], ["binder", "Binder", "binds the PDF"], ["mailroom", "Mailroom", "emails it to you"]];
  const sm = Object.fromEntries(STAFF.map((s) => [s.key, s]));
  const body = `<main class="mo"><div class="mo-art" aria-hidden="true">${art("floating-books", { cls: "float float-slow", w: 1024, h: 1024, png: true })}</div><div class="wrap">
  <div class="eyebrow white">Order ${esc(o.id)}</div>
  <h1 id="headline" style="margin-top:16px;font-size:clamp(34px,5vw,60px)">${esc(o.child_name)}'s book is being made</h1>
  <p class="lede" id="sub" style="margin-top:14px">You can close this page. The book will arrive at ${esc(o.buyer_email || "your inbox")}. Or stay and watch each desk do its part.</p>
  <div class="line" id="line">${st.map(([k, n, d]) => `<div class="stn" data-k="${k}" style="--c:${sm[k].color}"><div class="av">${sm[k].icon}</div><b>${n}</b><span>${d}</span></div>`).join("")}</div>
  <div id="ready" hidden class="card readycard"><div id="readyCover" class="readycover"></div><div style="flex:1;min-width:220px"><div class="eyebrow leaf">Ready</div><h2 id="readyTitle" style="font-size:32px;margin:12px 0 8px"></h2><p class="muted" id="readyNote" style="margin:0 0 18px"></p><div class="btnrow"><a class="btn" id="readyOpen" href="#">Open the book</a><a class="btn ghost small" id="readyPdf" href="#">Download PDF</a></div></div></div>
  <div class="mk">
    <div><h3>Pages <span class="small" id="pcount"></span></h3><div class="thumbs" id="thumbs">${Array.from({ length: 11 }, (_, i) => `<div class="th"><i>${i ? i : "cover"}</i></div>`).join("")}</div>
      <div id="manuscript" class="manuscript"></div></div>
    <div><h3>What the staff is doing</h3><div class="card logcard"><div id="working" class="working"></div><div class="log" id="log"></div></div>
      <p class="small muted" style="margin-top:14px">Every line above is written to the <a href="/board">company ledger</a> as it happens. <a href="/office">See the whole office</a>.</p></div>
  </div></div></main>`;
  return layout({ title: `${o.child_name}'s book · Nightlight Press`, body, mode, scripts: `<script>window.ORDER_ID=${JSON.stringify(o.id)}</script><script src="/js/order.js" defer></script>` });
}

export function readerPage({ b, mode }) {
  const custom = b.kind !== "catalog";
  const body = `<main class="reader"><div class="stage" data-starfield><div class="spot" aria-hidden="true"></div><div class="spread" id="spread"><img id="pic" alt="" src="${b.cover_media_id ? `/api/media/${b.cover_media_id}` : ""}"><div class="txt" id="txt"><span class="cvt">${esc(b.title || "A new book")}</span>${b.dedication ? `<div class="ded">${esc(b.dedication)}</div>` : ""}</div></div>
    <div class="ctrls"><button id="prev" aria-label="Previous page">${CHEV("M15 5l-7 7 7 7")}</button><button class="read" id="readBtn">▶ Read to me</button><button id="nextp" aria-label="Next page">${CHEV("M9 5l7 7-7 7")}</button></div><div class="dots" id="dots" style="margin-top:16px"></div><audio id="aud" preload="none"></audio></div>
  <aside class="panel"><div><div class="eyebrow">${custom ? `A book for ${esc(b.hero_name)}` : "From the free shelf"}</div><h2 style="font-size:30px;margin-top:14px" id="btitle">${esc(b.title || "A new book")}</h2><p class="small muted" style="margin:8px 0 0" id="bstatus">${b.status === "ready" ? "Written, illustrated, narrated and bound by the Nightlight staff." : "This book is still being made. It will update by itself."}</p></div>
    <div class="box btnrow"><a class="btn small" href="/api/book/${b.id}.pdf" id="pdfBtn" ${b.pdf_media_id ? "" : "hidden"}>Download the PDF</a><button class="btn small ghost" id="shareBtn">Copy link</button></div>
    ${custom ? `<div class="box"><h3>Change something</h3><p class="small muted" style="margin:0 0 6px">The Front Desk reads this and sends it to the right desk. Changes are free.</p><textarea id="chg" rows="3" placeholder="Her dog is called Biscuit, and make her hair curlier on page 3"></textarea><button class="btn small" id="chgBtn">Send to the Front Desk</button></div>
    <div class="box"><h3>Read it to someone by phone</h3><p class="small muted" style="margin:0 0 6px">The Storyteller Line calls and reads the whole book aloud. It says it's an AI first.</p><input id="rtName" placeholder="Grandma Lakshmi" aria-label="Their name"><input id="rtPhone" type="tel" placeholder="+1 312 555 0199" aria-label="Their phone"><label class="c"><input type="checkbox" id="rtOk"><span>They know an AI storyteller will call and are happy to get it.</span></label><button class="btn small" id="rtBtn" style="margin-top:12px">Call and read it</button></div>`
    : `<div class="box"><h3>Make one starring your child</h3><p class="small muted" style="margin:0 0 12px">Same care, written from scratch around them. Ready in about five minutes.</p><a class="btn small" href="/?from=${b.id}#make">Make their book</a></div>`}
    <p class="small muted" style="margin-top:auto">Use ← → to turn pages, space to play.</p></aside></main>`;
  return layout({ title: `${b.title || "A book"} · Nightlight Press`, body, mode, desc: b.blurb || undefined, scripts: `<script>window.BOOK_ID=${JSON.stringify(b.id)}</script><script src="/js/reader.js" defer></script>`, head: b.cover_media_id ? `<meta property="og:image" content="/api/media/${b.cover_media_id}">` : "" });
}

export function shelfPage({ books, mode }) {
  const body = `<header class="pagehero shelfhero"><div class="sec-art" aria-hidden="true">${art("shelf-night", { eager: true })}</div><div class="wrap"><div class="eyebrow white" data-reveal="fade">The shelf</div><h1 style="margin-top:16px;font-size:clamp(38px,5vw,64px);max-width:860px" data-reveal>Free bedtime books, written by our <em class="hl"><span class="swoosh gild">staff.</span></em></h1><p class="lede" style="margin-top:16px">Marketing commissions a new one every night. Read them aloud for free, then make one starring your child.</p></div></header>
<section style="padding-top:30px"><div class="wrap"><div class="shelf">${books.length ? books.map((b) => `<a class="cover" data-reveal="zoom" href="/book/${b.id}" style="${cov(b)}"><span class="t">${esc(b.title)}</span><span class="s">${SN[b.style] || ""}</span></a>`).join("") : `<p class="muted">The first shelf book is being written. Check back tonight.</p>`}</div>
<div style="text-align:center;margin-top:54px"><a class="btn" href="/#make">Make a book starring your child</a></div></div></section>`;
  return layout({ title: "The shelf · Nightlight Press", body, mode });
}
