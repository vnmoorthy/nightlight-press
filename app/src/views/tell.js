import { layout, esc } from "./layout.js";
import { LANG, STYLES } from "../prompts.js";
const SN = { watercolor: "Watercolour", storybook: "Storybook", papercut: "Paper-cut", pencil: "Crayon", night: "Starry night" };
const SW = { watercolor: "linear-gradient(135deg,#f6d6c2,#b9d4e8 55%,#e8dcb5)", storybook: "linear-gradient(135deg,#c2703d,#ffc233 50%,#3bb273)", papercut: "linear-gradient(135deg,#ff6b4a,#ffc233 40%,#3bb273 70%,#4da8da)", pencil: "repeating-linear-gradient(45deg,#fff 0 6px,#ffe8c2 6px 8px)", night: "linear-gradient(135deg,#22223b,#4da8da 60%,#ffc233)" };
export function tellPage({ mode }) {
  const body = `
<style>
.tell{background:linear-gradient(180deg,#dceffa 0%,#fff1da 55%,#fff8ec 100%);min-height:calc(100vh - 64px);padding:48px 0 90px;position:relative;overflow:hidden}
.tell .sunb{position:absolute;right:-60px;top:-60px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,#ffd766 0 55%,rgba(255,194,51,.25) 56% 70%,transparent 71%);pointer-events:none}
.tell .wrap{position:relative}
.tell h1{font-size:clamp(40px,6vw,76px);color:#22223b}
.tell h1 em{font-style:normal;color:#ff6b4a}
.tell .lead{font-size:clamp(18px,2vw,22px);color:#3a3a5c;max-width:760px;margin:14px 0 0}
.tgrid{display:grid;grid-template-columns:1.35fr .9fr;gap:28px;margin-top:34px;align-items:start}
.stagecard{background:#fff;border-radius:28px;box-shadow:0 2px 0 #eadfcb,0 22px 60px rgba(34,34,59,.12);padding:28px}
.microw{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.mic{width:96px;height:96px;border-radius:50%;border:0;background:#ff6b4a;color:#fff;font-size:40px;cursor:pointer;box-shadow:0 6px 0 #e04e2e,0 16px 40px rgba(255,107,74,.35);transition:transform .15s;flex:none}
.mic:active{transform:translateY(3px);box-shadow:0 3px 0 #e04e2e}
.mic.on{animation:pulse 1.4s infinite}@keyframes pulse{0%{box-shadow:0 6px 0 #e04e2e,0 0 0 0 rgba(255,107,74,.55)}70%{box-shadow:0 6px 0 #e04e2e,0 0 0 26px rgba(255,107,74,0)}100%{box-shadow:0 6px 0 #e04e2e,0 0 0 0 rgba(255,107,74,0)}}
.micstate b{display:block;font:600 22px Fredoka,system-ui;color:#22223b}.micstate span{color:#6b6a80}
.transcript{margin-top:22px;min-height:260px;max-height:46vh;overflow:auto;border-radius:20px;background:#fff8ec;border:2px dashed #eadfcb;padding:22px 24px;font:clamp(20px,2.1vw,26px)/1.55 Literata,Georgia,serif;color:#22223b;outline:none}
.transcript:empty:before{content:attr(data-ph);color:#a8a3b8}
.transcript .interim{color:#9a95ad}
.tcount{display:flex;justify-content:space-between;margin-top:10px;color:#6b6a80;font-size:14px}
.side .field label{font-weight:700}
.robot{display:flex;gap:14px;align-items:center;background:#eaf6fd;border:2px solid #cfe7f6;border-radius:18px;padding:14px;margin:6px 0 14px;cursor:pointer}
.robot input{width:22px;height:22px;accent-color:#4da8da;flex:none}
.robot svg{width:54px;height:54px;flex:none}
.robot small{display:block;color:#6b6a80}
.go{width:100%;font-size:19px;padding:18px 24px}
.tswatch{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.tswatch label{border-radius:14px;padding:6px;text-align:center;font-size:12px;cursor:pointer;background:#fff;box-shadow:inset 0 0 0 2px #eadfcb}.tswatch input{display:none}.tswatch .sw{height:40px;border-radius:9px;margin-bottom:4px}.tswatch label:has(input:checked){box-shadow:inset 0 0 0 3px #ff6b4a}
.how3{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.how3 span{background:#fff;border-radius:999px;padding:8px 14px;font-weight:700;color:#3a3a5c;box-shadow:0 2px 0 #eadfcb}
@media(max-width:920px){.tgrid{grid-template-columns:1fr}.tswatch{grid-template-columns:repeat(3,1fr)}}
</style>
<main class="tell"><div class="sunb" aria-hidden="true"></div><div class="wrap">
  <div class="eyebrow">Tell us a story</div>
  <h1 style="margin-top:12px">Say it out loud. <em>We'll make it a book.</em></h1>
  <p class="lead">Tell any story, a bedtime tale, something that happened today, a story from when you were small. Our Author keeps your plot and your words, the Illustrator paints every page and the Narrator reads it back, in about two minutes.</p>
  <div class="how3"><span>🎙️ You talk</span><span>✒️ Author adapts it</span><span>🎨 Illustrator paints it</span><span>📚 Ready to read</span></div>
  <div class="tgrid">
    <section class="stagecard">
      <div class="microw"><button class="mic" id="mic" type="button" aria-label="Start telling">🎙️</button>
        <div class="micstate" id="micstate"><b>Tap the microphone and start talking</b><span>Your words appear here as you speak. You can edit them before we make the book.</span></div></div>
      <div class="transcript" id="transcript" contenteditable="true" spellcheck="false" data-ph="“Once upon a time, a little girl named Maya found a tiny robot in the garden…”"></div>
      <div class="tcount"><span id="wc">0 words</span><span id="hint">A good story is 60 to 400 words.</span></div>
    </section>
    <form class="stagecard side" id="tellForm" novalidate>
      <div class="row2"><div class="field"><label for="hero">Who is the story about?</label><input id="hero" name="hero" maxlength="40" placeholder="Maya" required></div>
        <div class="field"><label for="age">Reader's age</label><select id="age" name="age">${Array.from({ length: 12 }, (_, i) => `<option ${i + 1 === 5 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></div></div>
      <div class="field"><label for="look">What does the hero look like? <span class="muted small">(optional)</span></label><input id="look" name="look" maxlength="240" placeholder="Curly hair, red glasses, a yellow raincoat"></div>
      <div class="row2"><div class="field"><label for="teller">Told by</label><input id="teller" name="teller" maxlength="60" placeholder="Your name"></div>
        <div class="field"><label for="language">Language</label><select id="language" name="language">${Object.entries(LANG).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div></div>
      <div class="field"><label>Pictures</label><div class="tswatch">${Object.keys(STYLES).map((k) => `<label><input type="radio" name="style" value="${k}" ${k === "storybook" ? "checked" : ""}><div class="sw" style="background:${SW[k]}"></div>${SN[k]}</label>`).join("")}</div></div>
      <label class="robot"><input type="checkbox" name="robot"><svg viewBox="0 0 64 64" aria-hidden="true"><line x1="32" y1="6" x2="32" y2="16" stroke="#22223b" stroke-width="3"/><circle cx="32" cy="6" r="5" fill="#ffc233"/><circle cx="32" cy="26" r="13" fill="#fff" stroke="#22223b" stroke-width="2.5"/><ellipse cx="27" cy="26" rx="2.6" ry="3.4" fill="#22223b"/><ellipse cx="37" cy="26" rx="2.6" ry="3.4" fill="#22223b"/><rect x="18" y="38" width="28" height="16" rx="7" fill="#4da8da" stroke="#22223b" stroke-width="2.5"/><circle cx="23" cy="57" r="4" fill="#22223b"/><circle cx="41" cy="57" r="4" fill="#22223b"/></svg><span><b>Add Pip the PlayRobot as a friend</b><small>A kind robot sidekick joins the story. It's credited in the book and never sells anything.</small></span></label>
      <div class="field"><label for="email">Email the book to <span class="muted small">(optional)</span></label><input id="email" name="email" type="email" placeholder="you@example.com"></div>
      <div class="err" id="tellErr" role="alert"></div>
      <button class="btn coral go" id="go" type="submit">Make it a book</button>
      <p class="small muted" style="margin:12px 0 0">Told stories go on the free shelf for everyone to read. Please don't include anyone's private details.</p>
    </form>
  </div>
</div></main>`;
  return layout({ title: "Tell us a story · Nightlight Press", body, mode, desc: "Tell a story out loud and Nightlight's AI staff turns it into an illustrated, narrated picture book in about two minutes.", scripts: `<link href="https://fonts.googleapis.com/css2?family=Literata:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet"><script src="/js/tell.js" defer></script>` });
}
