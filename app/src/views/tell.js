import { layout, esc, art } from "./layout.js";
import { LANG, STYLES } from "../prompts.js";
const SN = { watercolor: "Watercolour", storybook: "Storybook", papercut: "Paper-cut", pencil: "Crayon", night: "Starry night" };
const SW = { watercolor: "linear-gradient(135deg,#FFF7E8,#6FC3FF 55%,#FF6FAE)", storybook: "linear-gradient(135deg,#FFB13B,#FFD36E 45%,#1F3FA6)", papercut: "linear-gradient(135deg,#FF6FAE,#FFD36E 38%,#6FC3FF 68%,#1F3FA6)", pencil: "repeating-linear-gradient(45deg,#FFF7E8 0 6px,#A9B6E0 6px 8px)", night: "linear-gradient(135deg,#050B2E,#1F3FA6 55%,#FFD36E)" };
export function tellPage({ mode }) {
  const body = `
<style>
.tell{min-height:calc(100vh - 64px);padding:56px 0 90px;position:relative;overflow:hidden}
.tell .sunb{position:absolute;left:50%;top:-220px;width:1100px;height:700px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(closest-side,rgba(255,211,110,.16),rgba(61,123,255,.18) 55%,transparent 100%);pointer-events:none}
.tell .wrap{position:relative}
.tell h1{font-size:clamp(40px,6vw,76px);color:#fff;line-height:1.02}
.tell h1 em{font-style:normal;color:var(--gold);text-shadow:0 0 30px rgba(255,211,110,.45)}
.tell .lead{font-size:clamp(18px,2vw,22px);color:var(--text);max-width:760px;margin:16px 0 0}
.tgrid{display:grid;grid-template-columns:1.35fr .9fr;gap:28px;margin-top:34px;align-items:start}
.stagecard{background:var(--glass);border:1px solid var(--glass-b);border-radius:22px;box-shadow:0 30px 70px -30px rgba(0,0,0,.85);padding:28px;-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}
.tell section.stagecard{background:radial-gradient(80% 70% at 18% 0%,rgba(255,211,110,.12),transparent 60%),var(--glass)}
.microw{display:flex;align-items:center;gap:22px;flex-wrap:wrap}
.mic{width:104px;height:104px;border-radius:50%;border:0;background:radial-gradient(circle at 35% 30%,#FFF0C2,var(--gold) 45%,var(--amber));color:var(--night1);font-size:42px;cursor:pointer;box-shadow:0 0 0 8px rgba(255,211,110,.14),0 0 50px rgba(255,211,110,.55);transition:transform .15s,box-shadow .2s;flex:none}
.mic:hover{transform:scale(1.05);box-shadow:0 0 0 10px rgba(255,211,110,.2),0 0 70px rgba(255,211,110,.75)}
.mic:active{transform:scale(.97)}
.mic.on{animation:pulse 1.4s infinite}@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(255,211,110,.6),0 0 50px rgba(255,211,110,.55)}70%{box-shadow:0 0 0 30px rgba(255,211,110,0),0 0 70px rgba(255,211,110,.7)}100%{box-shadow:0 0 0 0 rgba(255,211,110,0),0 0 50px rgba(255,211,110,.55)}}
.micstate b{display:block;font:600 22px Fredoka,system-ui;color:#fff}.micstate span{color:var(--muted)}
.transcript{margin-top:22px;min-height:260px;max-height:46vh;overflow:auto;border-radius:18px;background:rgba(11,22,64,.75);border:1px solid var(--glass-b);padding:22px 24px;font:clamp(20px,2.1vw,26px)/1.55 Literata,Georgia,serif;color:var(--cream);outline:none;box-shadow:inset 0 0 40px rgba(61,123,255,.12)}
.transcript:focus{border-color:var(--gold);box-shadow:0 0 0 4px rgba(255,211,110,.18),inset 0 0 40px rgba(61,123,255,.12)}
.transcript:empty:before{content:attr(data-ph);color:#7F8DBD}
.transcript .interim{color:#8FA0D6}
.tcount{display:flex;justify-content:space-between;margin-top:10px;color:var(--muted);font-size:14px}
.side .field label{font-weight:700}
.robot{display:flex;gap:14px;align-items:center;background:rgba(111,195,255,.08);border:1px solid rgba(111,195,255,.3);border-radius:18px;padding:14px;margin:6px 0 14px;cursor:pointer;color:var(--text);transition:box-shadow .2s,transform .2s}
.robot:hover{transform:translateY(-2px);box-shadow:0 0 0 2px rgba(255,255,255,.6),0 14px 40px rgba(61,123,255,.3)}
.robot:has(input:checked){border-color:var(--gold);box-shadow:0 0 26px rgba(255,211,110,.3)}
.robot input{width:22px;height:22px;accent-color:var(--amber);flex:none}
.robot svg{width:54px;height:54px;flex:none;filter:drop-shadow(0 0 10px rgba(111,195,255,.5))}
.robot b{color:#fff}
.robot small{display:block;color:var(--muted)}
.go{width:100%;font-size:19px;padding:18px 24px}
.tswatch{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.tswatch label{border-radius:14px;padding:6px;text-align:center;font-size:12px;cursor:pointer;background:var(--glass);color:var(--muted);box-shadow:inset 0 0 0 1px var(--glass-b)}.tswatch input{display:none}.tswatch .sw{height:40px;border-radius:9px;margin-bottom:4px}.tswatch label:has(input:checked){box-shadow:inset 0 0 0 2px var(--gold),0 0 20px rgba(255,211,110,.35);color:#fff}
.how3{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.how3 span{background:var(--glass);border:1px solid var(--glass-b);border-radius:999px;padding:8px 14px;font-weight:700;color:#fff}
@media(max-width:920px){.tgrid{grid-template-columns:1fr}.tswatch{grid-template-columns:repeat(3,1fr)}}
@media(max-width:600px){.stagecard{padding:20px}.mic{width:88px;height:88px;font-size:36px}.mic:before{inset:-18px}}
.thero{display:grid;grid-template-columns:1.05fr .95fr;gap:36px;align-items:center}
.tstage-art{position:relative;margin:0;border-radius:26px;overflow:hidden;aspect-ratio:3/2;box-shadow:0 0 0 1px rgba(255,211,110,.28),0 0 60px rgba(255,211,110,.22),0 0 120px rgba(61,123,255,.3),0 40px 80px -30px rgba(0,0,0,.9)}
.tstage-art img{width:100%;height:100%;object-fit:cover}
.tstage-art:after{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 10%,transparent 55%,rgba(5,11,46,.55));pointer-events:none}
.mic{position:relative;isolation:isolate}
.mic:before{content:"";position:absolute;inset:-26px;z-index:-1;background:conic-gradient(from 0deg,rgba(255,211,110,0),rgba(255,211,110,.55),rgba(255,111,174,.35),rgba(111,195,255,.45),rgba(255,211,110,0));clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);filter:blur(1px);opacity:.75;animation:micstar 14s linear infinite}
.mic.on:before{opacity:1;animation-duration:4s}
@keyframes micstar{to{rotate:360deg}}
.transcript{transition:box-shadow .4s}
.transcript.lit{box-shadow:0 0 0 2px rgba(255,211,110,.35),0 0 40px rgba(255,211,110,.25),inset 0 0 40px rgba(61,123,255,.12)}
.robot img{width:64px;height:64px;flex:none;object-fit:contain;filter:drop-shadow(0 0 12px rgba(111,195,255,.55))}
.robot picture{flex:none}
@media(max-width:920px){.thero{grid-template-columns:1fr;gap:22px}.tstage-art{max-width:640px}}
</style>
<main class="tell" data-starfield><div class="sunb" aria-hidden="true"></div><div class="wrap">
  <div class="thero"><div>
  <div class="eyebrow" data-reveal="fade">Tell us a story</div>
  <h1 style="margin-top:12px" data-reveal>Say it out loud. <em><span class="swoosh" style="--swoosh-delay:.8s">We'll make it a book.</span></em></h1>
  <p class="lead" data-reveal>Tell any story, a bedtime tale, something that happened today, a story from when you were small. Our Author keeps your plot and your words, the Illustrator paints every page and the Narrator reads it back, in about two minutes.</p>
  <div class="how3" data-reveal="fade"><span>🎙️ You talk</span><span>✒️ Author adapts it</span><span>🎨 Illustrator paints it</span><span>📚 Ready to read</span></div></div>
  <figure class="tstage-art" data-reveal="zoom">${art("tell-stage", { eager: true, alt: "A child in star pyjamas sings into a gold star microphone on a cloud stage while ribbons of light become an open picture book, and Pip the robot cheers" })}</figure></div>
  <div class="tgrid">
    <section class="stagecard">
      <div class="microw"><button class="mic" id="mic" type="button" aria-label="Start telling">🎙️</button>
        <div class="micstate" id="micstate"><b>Tap the microphone and start talking</b><span>Your words appear here as you speak. You can edit them before we make the book.</span></div></div>
      <div class="transcript" data-sparkle="mix" id="transcript" contenteditable="true" spellcheck="false" data-ph="“Once upon a time, a little girl named Maya found a tiny robot in the garden…”"></div>
      <div class="tcount"><span id="wc">0 words</span><span id="hint">A good story is 60 to 400 words.</span></div>
    </section>
    <form class="stagecard side" id="tellForm" novalidate>
      <div class="row2"><div class="field"><label for="hero">Who is the story about? <span class="muted small">(or let the child say it)</span></label><input id="hero" name="hero" maxlength="40" placeholder="Zara, or leave blank"></div>
        <div class="field"><label for="age">Reader's age</label><select id="age" name="age">${Array.from({ length: 12 }, (_, i) => `<option ${i + 1 === 5 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></div></div>
      <div class="field"><label for="look">What does the hero look like? <span class="muted small">(optional)</span></label><input id="look" name="look" maxlength="240" placeholder="Curly hair, red glasses, a yellow raincoat"></div>
      <div class="row2"><div class="field"><label for="teller">Told by</label><input id="teller" name="teller" maxlength="60" placeholder="Your name"></div>
        <div class="field"><label for="language">Language</label><select id="language" name="language">${Object.entries(LANG).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div></div>
      <div class="field"><label>Pictures</label><div class="tswatch">${Object.keys(STYLES).map((k) => `<label><input type="radio" name="style" value="${k}" ${k === "storybook" ? "checked" : ""}><div class="sw" style="background:${SW[k]}"></div>${SN[k]}</label>`).join("")}</div></div>
      <label class="robot"><input type="checkbox" name="robot" checked>${art("pip-mascot", { w: 1024, h: 1024, png: true })}<span><b>Add Pip the PlayRobot as a friend</b><small>A kind robot sidekick joins the story. It's credited in the book and never sells anything.</small></span></label>
      <div class="field"><label for="email">Email the book to <span class="muted small">(optional)</span></label><input id="email" name="email" type="email" placeholder="you@example.com"></div>
      <div class="err" id="tellErr" role="alert"></div>
      <button class="btn coral go" id="go" type="submit">Make it a book</button>
      <label class="check" style="margin:12px 0 8px;background:transparent;border-color:rgba(255,255,255,.13)"><input type="checkbox" name="consent"><span class="small">I'm a grown-up, and I'm happy for this story (and any first name or details a child says) to be used to make the book.</span></label><label class="check" style="margin:0;background:transparent;border-color:rgba(255,255,255,.13)"><input type="checkbox" name="share"><span class="small">Share the finished book on the free shelf for everyone to read</span></label><p class="small muted" style="margin:10px 0 0">Kids can just talk: "I'm Zara, I'm six, I love dolphins, tell me a story about a robot!" We only use a first name, never surnames, schools or addresses.</p>
    </form>
  </div>
</div></main>`;
  return layout({ title: "Tell us a story · Nightlight Press", body, mode, desc: "Tell a story out loud and Nightlight's AI staff turns it into an illustrated, narrated picture book in about two minutes.", scripts: `<link href="https://fonts.googleapis.com/css2?family=Literata:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet"><script src="/js/tell.js" defer></script>` });
}
