import { layout, esc, LOGO, STAFF } from "./layout.js";

export function officePage({ mode }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The office · Nightlight Press</title>
<meta name="description" content="Watch Nightlight Press work: a children's publisher whose whole staff is AI agents. Live.">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(LOGO.replace('aria-hidden="true"', 'xmlns="http://www.w3.org/2000/svg"'))}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/office.css"><script type="importmap">{"imports":{"three":"/vendor/three/three.module.min.js"}}</script></head><body>
<div id="scene"></div>
<header class="hud-top"><a class="brand" href="/">${LOGO}<span>Nightlight Press</span></a><span class="sub">The office, live. Nobody here is a person.</span>
  <div class="kp" id="kp"></div>
  <div class="right"><span class="pill" id="clock" title="When the office was last woken">waking…</span><button class="pill btnp" id="replay">Replay the last book</button><a class="pill" href="/board">Company board</a><a class="pill solid" href="/#make">Make a book</a></div></header>
<aside class="feed" id="feed"><h4>What the staff is doing</h4><div id="events"></div></aside>
<section class="making" id="making"></section>
<div class="banner" id="banner"></div>
<div class="hint">Drag to look around · scroll to zoom · click a desk</div>
<div class="card-desk" id="desk" hidden></div>
<script>window.STAFF=${JSON.stringify(STAFF)}</script>
<script type="module" src="/js/office.js"></script></body></html>`;
}

export function boardPage({ mode }) {
  const body = `<main class="page"><div class="wrap">
  <div style="display:flex;justify-content:space-between;align-items:end;gap:20px;flex-wrap:wrap"><div><div class="eyebrow">Company board</div><h1 style="font-size:clamp(34px,5vw,56px);margin-top:16px">Nightlight Press, in <em class="hl">numbers</em></h1><p class="lede muted" style="margin-top:12px">Everything here is computed from the database and a hash-chained ledger the agents write as they work. Refreshes every five seconds.</p></div>
  <div class="btnrow"><a class="btn dark small" href="/office">Watch the office</a><a class="btn ghost small" href="/api/ledger.json">Download the ledger</a></div></div>
  <div class="kpis" id="kpis"></div>
  <div class="bgrid">
    <div class="card pad"><h3>Unit economics, per book</h3><div id="econ"></div></div>
    <div class="card pad"><h3>Who ran without a person</h3><div id="autonomy"></div></div>
  </div>
  <div class="card pad" style="margin-top:22px"><h3>The staff</h3><div id="agents" class="tbl"></div></div>
  <div class="bgrid" style="margin-top:22px"><div class="card pad"><h3>Work in the queue</h3><div id="jobs" class="tbl"></div></div><div class="card pad"><h3>Interventions by a person</h3><p class="small muted" style="margin:0 0 10px">Every time a human steps in, it's logged here. The goal is zero.</p><div id="interventions"></div><h3 style="margin-top:18px">Waiting for a person</h3><div id="clear"></div></div></div>
  <div class="card pad" style="margin-top:22px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px"><h3 style="margin:0">The ledger</h3><span id="chain" class="tag"></span></div><div id="ledger" class="tbl ledger"></div></div>
</div></main>`;
  return layout({ title: "Company board · Nightlight Press", body, mode, scripts: `<script src="/js/board.js" defer></script>` });
}

export function adminPage({ token }) {
  const body = `<main class="page"><div class="wrap"><div class="eyebrow">Operator</div><h1 style="font-size:44px;margin-top:16px">Founder controls</h1><p class="lede muted" style="margin-top:12px">Every button here is logged on the public board as an intervention. The company is designed so you never need them.</p>
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin:26px 0"><button class="btn dark" data-act="tick">Wake the office now</button><button class="btn" data-act="commission">Ask Marketing for a shelf book</button><button class="btn ghost" data-act="retry-failed">Retry failed jobs</button></div>
  <pre id="out" class="card outbox"></pre>
  <h3 style="margin-top:30px">Recent orders</h3><div id="orders" class="card" style="padding:8px 20px 12px;margin-top:12px"></div></div></main>
  <script>const T=${JSON.stringify(token || "")};const H={"x-admin-token":T,"content-type":"application/json"};
  document.querySelectorAll('[data-act]').forEach(b=>b.onclick=async()=>{b.disabled=true;const r=await fetch('/api/admin/'+b.dataset.act,{method:'POST',headers:H});document.getElementById('out').textContent=JSON.stringify(await r.json(),null,2);b.disabled=false;load()});
  async function load(){const r=await fetch('/api/admin/orders',{headers:H});const o=await r.json();document.getElementById('orders').innerHTML=o.map(x=>'<div class="row"><span>'+esc(x.child_name)+' · '+esc(x.kind)+' · '+esc(x.status)+'</span><span class="small muted">'+esc(x.buyer_email||'')+' '+(x.book_id?'<a href="/book/'+x.book_id+'">book</a>':'')+' <a href="/order/'+x.id+'">order</a></span></div>').join('')||'none'}load();</script>`;
  return layout({ title: "Operator · Nightlight Press", body });
}
