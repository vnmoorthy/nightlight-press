// Pip, the PlayRobot friend, lives on the reader pages of books that include him.
// Tapping Pip opens a grown-up check (hold for 3 seconds) before the PlayRobot toy page opens,
// because a link from a children's book to a shop is meant for parents.
(() => {
  const ID = window.BOOK_ID; if (!ID) return;
  const PIP = `<svg viewBox="0 0 64 70" aria-hidden="true"><line x1="32" y1="4" x2="32" y2="14" stroke="#A9B6E0" stroke-width="3"/><path d="M32 0l2.6 5.4 5.9.8-4.3 4.1 1 5.8L32 13.4l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" fill="#FFD36E"/><rect x="14" y="14" width="36" height="28" rx="13" fill="#FFF7E8" stroke="#0B1A4A" stroke-width="2.5"/><ellipse cx="26" cy="28" rx="3.4" ry="4.4" fill="#0B1A4A"/><ellipse cx="38" cy="28" rx="3.4" ry="4.4" fill="#0B1A4A"/><path d="M27 35q5 4 10 0" stroke="#0B1A4A" stroke-width="2.2" fill="none" stroke-linecap="round"/><rect x="18" y="43" width="28" height="16" rx="7" fill="#6FC3FF" stroke="#0B1A4A" stroke-width="2.5"/><circle cx="32" cy="51" r="3.2" fill="#FFD36E"/><circle cx="22" cy="63" r="5" fill="#13296B" stroke="#A9B6E0" stroke-width="2"/><circle cx="42" cy="63" r="5" fill="#13296B" stroke="#A9B6E0" stroke-width="2"/></svg>`;
  const css = `.pipbtn{position:absolute;left:14px;bottom:14px;width:74px;height:82px;border:0;background:none;cursor:pointer;z-index:4;animation:pipbob 2.6s ease-in-out infinite;filter:drop-shadow(0 8px 18px rgba(61,123,255,.55))}
.pipbtn svg{width:100%;height:100%}.pipbtn .say{position:absolute;left:calc(100% - 4px);bottom:58%;white-space:nowrap;background:#FFF7E8;color:#0B1A4A;font:800 13px Nunito,system-ui;padding:6px 10px;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,.35)}
@keyframes pipbob{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-8px) rotate(3deg)}}@media (prefers-reduced-motion:reduce){.pipbtn{animation:none}}
.pipgate{position:fixed;inset:0;z-index:60;display:none;place-items:center;background:rgba(5,11,46,.72);backdrop-filter:blur(6px)}.pipgate.on{display:grid}
.pipgate .box{width:min(440px,92vw);background:#0B1A4A;border:1px solid rgba(255,255,255,.13);border-radius:24px;padding:26px;text-align:center;color:#EAF0FF;font-family:Nunito,system-ui;box-shadow:0 30px 80px rgba(0,0,0,.5)}
.pipgate h3{font:700 22px Fredoka,system-ui;color:#fff;margin:6px 0}.pipgate p{color:#A9B6E0;margin:6px 0 16px}
.pipgate .hold{position:relative;overflow:hidden;width:100%;border:0;border-radius:999px;padding:14px;font:800 15px Nunito;color:#0B1A4A;background:linear-gradient(135deg,#FFD36E,#FFB13B);cursor:pointer;user-select:none;-webkit-user-select:none}
.pipgate .hold i{position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(255,255,255,.55)}.pipgate .no{margin-top:10px;background:none;border:1px solid rgba(255,255,255,.13);color:#fff;border-radius:999px;padding:10px 18px;cursor:pointer;font:700 14px Nunito}`;
  fetch(`/api/book/${ID}`).then((r) => r.json()).then(({ book }) => {
    if (!book?.robot) return;
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const spread = document.getElementById("spread"); if (!spread) return; if (getComputedStyle(spread).position === "static") spread.style.position = "relative";
    const b = document.createElement("button"); b.className = "pipbtn"; b.type = "button"; b.setAttribute("aria-label", "Pip the PlayRobot: tap to meet Pip (a grown-up will need to help)"); b.innerHTML = PIP + `<span class="say">Hi! I'm Pip!</span>`; spread.appendChild(b);
    setTimeout(() => b.querySelector(".say")?.remove(), 5000);
    // Keep Pip on the picture's lower-left corner, never over the story words below it.
    let rq = 0; const place = () => { cancelAnimationFrame(rq); rq = requestAnimationFrame(() => {
      const m = [...spread.querySelectorAll("#pic, video, canvas")].find((x) => x.offsetHeight > 60 && getComputedStyle(x).display !== "none" && getComputedStyle(x).visibility !== "hidden"); if (!m) return;
      const r = m.getBoundingClientRect(), sr = spread.getBoundingClientRect(), small = r.height < 260;
      b.style.width = small ? "54px" : ""; b.style.height = small ? "60px" : "";
      b.style.bottom = "auto"; b.style.top = `${Math.max(6, r.bottom - sr.top - spread.clientTop - (small ? 66 : 92))}px`; b.style.left = `${Math.max(6, r.left - sr.left - spread.clientLeft + (small ? 8 : 12))}px`; }); };
    place(); addEventListener("resize", place); spread.addEventListener("load", place, true); spread.addEventListener("loadedmetadata", place, true);
    try { new ResizeObserver(place).observe(spread); new MutationObserver(place).observe(spread, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "hidden", "class"] }); } catch { /* old browsers keep the default corner */ }
    const g = document.createElement("div"); g.className = "pipgate"; g.setAttribute("role", "dialog"); g.setAttribute("aria-modal", "true");
    g.innerHTML = `<div class="box"><div style="width:70px;margin:0 auto">${PIP}</div><h3>Meet Pip at the PlayRobot toy shop</h3><p>This opens a shop page for grown-ups. Grown-up, please press and hold the button for 3 seconds.</p><button class="hold" type="button"><i></i><span>Press and hold</span></button><button class="no" type="button">Back to the story</button></div>`;
    document.body.appendChild(g);
    const hold = g.querySelector(".hold"), bar = hold.querySelector("i"); let t0 = 0, raf = 0;
    const tickHold = () => { const k = Math.min(1, (performance.now() - t0) / 3000); bar.style.width = `${k * 100}%`; if (k >= 1) { g.classList.remove("on"); window.open(book.toy_url, "_blank", "noopener"); return; } raf = requestAnimationFrame(tickHold); };
    const start = (e) => { e.preventDefault(); t0 = performance.now(); raf = requestAnimationFrame(tickHold); };
    const stop = () => { cancelAnimationFrame(raf); bar.style.width = "0"; };
    hold.addEventListener("pointerdown", start); ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => hold.addEventListener(ev, stop));
    hold.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) start(e); }); hold.addEventListener("keyup", stop);
    g.querySelector(".no").onclick = () => g.classList.remove("on"); g.onclick = (e) => { if (e.target === g) g.classList.remove("on"); };
    b.onclick = () => { g.classList.add("on"); hold.focus(); };
  }).catch(() => {});
})();
