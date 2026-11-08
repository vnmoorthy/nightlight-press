/* Magic Hour hero carousel + content rails. Visual only. */
(() => {
  const hc = document.getElementById("hc");
  if (hc) {
    const slides = [...hc.querySelectorAll(".hc-slide")];
    const dots = [...hc.querySelectorAll(".hc-dots button")];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let i = 0, timer = null, paused = false;
    const play = (s) => { const v = s.querySelector("video"); if (v) { if (v.preload === "none") v.preload = "auto"; const p = v.play(); if (p && p.catch) p.catch(() => {}); } };
    const stop = (s) => { const v = s.querySelector("video"); if (v) v.pause(); };
    const go = (n) => {
      const prev = slides[i];
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => { const on = k === i; s.classList.toggle("on", on); s.setAttribute("aria-hidden", on ? "false" : "true"); s.querySelectorAll("a,button").forEach((el) => (el.tabIndex = on ? 0 : -1)); });
      dots.forEach((d, k) => { d.classList.toggle("on", k === i); d.setAttribute("aria-selected", k === i ? "true" : "false"); });
      if (prev !== slides[i]) stop(prev);
      play(slides[i]);
    };
    const arm = () => { clearInterval(timer); if (!reduce) timer = setInterval(() => { if (!paused && !document.hidden) go(i + 1); }, 7000); };
    dots.forEach((d, k) => d.addEventListener("click", () => { go(k); arm(); }));
    hc.querySelectorAll(".hc-arrow").forEach((b) => b.addEventListener("click", () => { go(i + Number(b.dataset.dir)); arm(); }));
    hc.addEventListener("mouseenter", () => (paused = true));
    hc.addEventListener("mouseleave", () => (paused = false));
    hc.addEventListener("focusin", () => (paused = true));
    hc.addEventListener("focusout", () => (paused = false));
    hc.tabIndex = -1;
    hc.addEventListener("keydown", (e) => { if (e.target.closest("input,textarea,select")) return; if (e.key === "ArrowRight") { go(i + 1); arm(); } else if (e.key === "ArrowLeft") { go(i - 1); arm(); } });
    go(0); arm();
    if (window.Magic && hc.querySelector(".hc-magic")) Magic.parallax("#hc .hc-magic [data-depth]", { strength: 22, scroll: 0.16, pointer: true });
  }
  document.querySelectorAll(".rail").forEach((r) => {
    const t = r.querySelector(".rail-track"); if (!t) return;
    r.querySelectorAll(".rail-arrow").forEach((b) => b.addEventListener("click", () => t.scrollBy({ left: Number(b.dataset.dir) * t.clientWidth * 0.85, behavior: "smooth" })));
  });
})();
