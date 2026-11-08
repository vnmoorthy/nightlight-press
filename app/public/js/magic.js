/* Nightlight Press - magic.js: small, original "wonder" effects for the Magic Hour theme.
   Self-contained, no dependencies. Every effect honours prefers-reduced-motion and idles when nothing moves.
   API (window.Magic):
     starfield(container, opts)  canvas starfield with twinkle + occasional shooting stars
     sparkleTrail(opts)          gold sparkle trail over [data-sparkle] (mouse/pen only; off on touch)
     burst(elOrPoint, opts)      celebratory burst of sparkles + paper stars
     parallax(selector, opts)    layered pointer + scroll parallax via [data-depth]
     reveal(root)                "page opens" reveal for [data-reveal] (auto-run on load)
     swoosh(root)                gold wand-swoosh underline for .swoosh (auto-run on load)
     reduced()                   true when the viewer prefers reduced motion
*/
(function () {
  "use strict";
  if (window.Magic && window.Magic.version) return;
  var doc = document, root = doc.documentElement;
  root.classList.add("mg-js");

  var C = { gold: "#FFD36E", amber: "#FFB13B", sky: "#6FC3FF", pink: "#FF6FAE", cream: "#FFF7E8", glow: "#3D7BFF", white: "#FFFFFF", star: "#EAF0FF" };
  var mqReduce = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  function reduced() { return !!mqReduce.matches; }
  function fine() { return !!(window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function toEl(x) { return typeof x === "string" ? doc.querySelector(x) : x && x.nodeType === 1 ? x : null; }
  function toEls(x) { return typeof x === "string" ? [].slice.call(doc.querySelectorAll(x)) : x && x.length != null ? [].slice.call(x) : x ? [x] : []; }
  function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")"; }
  function onReady(fn) { if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", fn); else fn(); }
  var NOOP = { destroy: function () {} };

  /* ---------- sprites (pre-rendered once per colour; cheap drawImage afterwards) ---------- */
  var cache = {};
  function sparkSprite(color) {
    var k = "s" + color; if (cache[k]) return cache[k];
    var s = 64, m = s / 2, c = doc.createElement("canvas"); c.width = c.height = s; var g = c.getContext("2d");
    var halo = g.createRadialGradient(m, m, 0, m, m, m);
    halo.addColorStop(0, rgba(color, 0.5)); halo.addColorStop(0.3, rgba(color, 0.16)); halo.addColorStop(1, rgba(color, 0));
    g.fillStyle = halo; g.fillRect(0, 0, s, s);
    var R = m * 0.94, p = 0.16;
    g.beginPath(); g.moveTo(m, m - R);
    g.quadraticCurveTo(m + R * p, m - R * p, m + R, m); g.quadraticCurveTo(m + R * p, m + R * p, m, m + R);
    g.quadraticCurveTo(m - R * p, m + R * p, m - R, m); g.quadraticCurveTo(m - R * p, m - R * p, m, m - R); g.closePath();
    var core = g.createRadialGradient(m, m, 0, m, m, R);
    core.addColorStop(0, "#fff"); core.addColorStop(0.22, color); core.addColorStop(1, rgba(color, 0.15));
    g.fillStyle = core; g.fill();
    return (cache[k] = c);
  }
  function dotSprite(color) {
    var k = "d" + color; if (cache[k]) return cache[k];
    var s = 32, m = s / 2, c = doc.createElement("canvas"); c.width = c.height = s; var g = c.getContext("2d");
    var r = g.createRadialGradient(m, m, 0, m, m, m);
    r.addColorStop(0, "#fff"); r.addColorStop(0.2, rgba(color, 0.95)); r.addColorStop(0.5, rgba(color, 0.25)); r.addColorStop(1, rgba(color, 0));
    g.fillStyle = r; g.fillRect(0, 0, s, s);
    return (cache[k] = c);
  }

  /* ---------- (a) starfield ---------- */
  function starfield(container, opts) {
    opts = opts || {};
    var host = toEl(container) || doc.body;
    if (host === root) host = doc.body;
    if (host.__mgStarfield) return host.__mgStarfield;
    var isBody = host === doc.body;
    if (!isBody && getComputedStyle(host).position === "static") host.style.position = "relative";
    host.classList.add("mg-starfield-host");
    var cv = doc.createElement("canvas");
    cv.className = "mg-starfield" + (isBody ? " mg-fixed" : "");
    cv.setAttribute("aria-hidden", "true");
    host.insertBefore(cv, host.firstChild);
    var ctx = cv.getContext("2d");
    var density = opts.density || 0.00017, maxStars = opts.max || 340, fps = opts.fps || 30;
    var shootEvery = opts.shooting === false ? 0 : opts.interval || [4, 9];
    var drift = opts.drift == null ? 1.6 : opts.drift;
    var palette = opts.colors || [C.white, C.white, C.star, C.star, C.star, C.cream, C.sky, C.sky, C.gold, C.pink];
    var w = 0, h = 0, dpr = 1, stars = [], shooters = [], raf = 0, last = 0, lastDraw = 0, nextShot = 0, visible = true, dead = false;

    function build() {
      var r = isBody ? { width: innerWidth, height: innerHeight } : host.getBoundingClientRect();
      var nw = Math.max(1, Math.round(r.width)), nh = Math.max(1, Math.round(Math.min(r.height, 4000)));
      if (nw === w && nh === h && stars.length) return;
      w = nw; h = nh; dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      var n = Math.min(maxStars, Math.round(w * h * density));
      stars = [];
      for (var i = 0; i < n; i++) {
        var z = Math.pow(Math.random(), 2.2); // most stars far and faint
        var big = Math.random() < 0.06;
        stars.push({ x: Math.random() * w, y: Math.random() * h, z: z,
          r: big ? rand(1.5, 2.3) : 0.35 + z * 1.15, a: big ? rand(0.75, 1) : rand(0.25, 0.85),
          tw: rand(0.6, 2.4), ph: Math.random() * 6.28, big: big, c: big ? pick([C.cream, C.gold, C.sky, C.white]) : pick(palette) });
      }
      draw(performance.now(), 0);
    }
    function draw(now, dt) {
      var t = now / 1000, still = reduced();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        if (!still && drift) { s.x += drift * (0.15 + s.z) * dt; if (s.x > w + 4) s.x = -4; }
        var tw = still ? 1 : 0.55 + 0.45 * Math.sin(t * s.tw + s.ph);
        var a = s.a * (still ? 0.85 : 0.35 + 0.65 * tw);
        if (s.big) {
          var sz = s.r * (still ? 9 : 7 + 4 * tw);
          ctx.globalAlpha = a; ctx.drawImage(sparkSprite(s.c), s.x - sz / 2, s.y - sz / 2, sz, sz);
        } else {
          ctx.globalAlpha = a; ctx.fillStyle = s.c;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
        }
      }
      // shooting stars
      for (var j = shooters.length - 1; j >= 0; j--) {
        var m = shooters[j]; m.age += dt;
        var k = m.age / m.life; if (k >= 1) { shooters.splice(j, 1); continue; }
        m.x += m.vx * dt; m.y += m.vy * dt;
        var fade = k < 0.15 ? k / 0.15 : k > 0.6 ? (1 - k) / 0.4 : 1;
        var len = m.len * (0.4 + 0.6 * Math.min(1, k * 3));
        var sp = Math.hypot(m.vx, m.vy), tx = m.x - (m.vx / sp) * len, ty = m.y - (m.vy / sp) * len;
        var gr = ctx.createLinearGradient(m.x, m.y, tx, ty);
        gr.addColorStop(0, rgba(C.cream, 0.95 * fade)); gr.addColorStop(0.25, rgba(C.gold, 0.45 * fade)); gr.addColorStop(1, rgba(C.sky, 0));
        ctx.globalAlpha = 1; ctx.strokeStyle = gr; ctx.lineWidth = 1.8; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.globalAlpha = fade; var hs = 16; ctx.drawImage(sparkSprite(C.cream), m.x - hs / 2, m.y - hs / 2, hs, hs);
      }
      ctx.globalAlpha = 1;
    }
    function shoot() {
      if (reduced() || !w) return;
      var dir = Math.random() < 0.5 ? -1 : 1, ang = rand(0.28, 0.6), sp = rand(Math.max(520, w * 0.55), Math.max(800, w * 0.85));
      shooters.push({ x: dir > 0 ? rand(0, w * 0.6) : rand(w * 0.4, w), y: rand(0, h * 0.45),
        vx: Math.cos(ang) * sp * dir, vy: Math.sin(ang) * sp, age: 0, life: rand(0.75, 1.15), len: rand(90, 170) });
      wake();
    }
    function tick(now) {
      raf = 0; if (dead) return;
      var dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (shootEvery && now > nextShot) { if (nextShot) shoot(); nextShot = now + rand(shootEvery[0], shootEvery[1]) * 1000; }
      var budget = shooters.length ? 0 : 1000 / fps - 2; // run smooth while a meteor flies
      if (now - lastDraw >= budget) { draw(now, (now - lastDraw) / 1000 || dt); lastDraw = now; }
      if (!raf && visible && !doc.hidden && !reduced()) raf = requestAnimationFrame(tick); // shoot() may already have re-armed
    }
    function wake() { if (!raf && !dead && visible && !doc.hidden && !reduced()) { last = lastDraw = performance.now(); raf = requestAnimationFrame(tick); } }
    function sleep() { if (raf) cancelAnimationFrame(raf); raf = 0; }

    var ro = window.ResizeObserver ? new ResizeObserver(function () { build(); }) : null;
    if (ro && !isBody) ro.observe(host);
    var onResize = function () { build(); };
    addEventListener("resize", onResize);
    var io = !isBody && window.IntersectionObserver ? new IntersectionObserver(function (e) { visible = e[0].isIntersecting; visible ? wake() : sleep(); }) : null;
    if (io) io.observe(host);
    var onVis = function () { doc.hidden ? sleep() : wake(); };
    doc.addEventListener("visibilitychange", onVis);
    var onMq = function () { if (reduced()) { sleep(); shooters = []; draw(performance.now(), 0); } else wake(); };
    if (mqReduce.addEventListener) mqReduce.addEventListener("change", onMq);

    build(); wake();
    var api = {
      canvas: cv,
      shoot: function () { shoot(); },
      pause: sleep,
      resume: wake,
      destroy: function () {
        dead = true; sleep(); if (ro) ro.disconnect(); if (io) io.disconnect();
        removeEventListener("resize", onResize); doc.removeEventListener("visibilitychange", onVis);
        if (mqReduce.removeEventListener) mqReduce.removeEventListener("change", onMq);
        cv.remove(); host.classList.remove("mg-starfield-host"); host.__mgStarfield = null;
      }
    };
    host.__mgStarfield = api;
    return api;
  }

  /* ---------- shared FX overlay (sparkle trail + bursts); only animates while particles live ---------- */
  var fx = null;
  function fxLayer() {
    if (fx) return fx;
    var cv = doc.createElement("canvas"); cv.className = "mg-fx"; cv.setAttribute("aria-hidden", "true");
    doc.body.appendChild(cv);
    var ctx = cv.getContext("2d"), parts = [], running = false, last = 0, w = 0, h = 0, dpr = 1, MAX = 420;
    function size() { dpr = Math.min(window.devicePixelRatio || 1, 2); w = innerWidth; h = innerHeight; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    size(); addEventListener("resize", size);
    function star5(r) {
      ctx.beginPath();
      for (var i = 0; i < 10; i++) { var rr = i % 2 ? r * 0.46 : r, a = -Math.PI / 2 + (i * Math.PI) / 5; ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath();
    }
    function tick(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i]; p.age += dt;
        var t = p.age / p.life; if (t >= 1) { parts.splice(i, 1); continue; }
        if (p.delay && p.age < 0) continue;
        var dragK = Math.max(0, 1 - p.drag * dt);
        p.vx *= dragK; p.vy = p.vy * dragK + p.g * dt;
        if (p.flutter) p.vx += Math.sin(p.age * 7 + p.ph) * p.flutter * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        var a = t < 0.08 ? t / 0.08 : t > 0.55 ? (1 - t) / 0.45 : 1;
        if (p.k === "ring") {
          var e = 1 - Math.pow(1 - t, 3);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = (1 - t) * 0.7;
          ctx.strokeStyle = p.c; ctx.lineWidth = 2.5 * (1 - t) + 0.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, p.r0 + (p.r1 - p.r0) * e), 0, 6.283); ctx.stroke();
          continue;
        }
        var cs = Math.cos(p.rot), sn = Math.sin(p.rot);
        if (p.k === "paper") {
          var fl = Math.cos(p.age * p.vf + p.ph); // paper flip
          ctx.setTransform(dpr * cs * fl, dpr * sn * fl, -dpr * sn, dpr * cs, dpr * p.x, dpr * p.y);
          ctx.globalAlpha = a; ctx.fillStyle = fl < 0 ? p.back : p.c; star5(p.s); ctx.fill();
        } else {
          var s = p.s * (p.tw ? 0.7 + 0.3 * Math.sin(p.age * p.tw + p.ph) : 1) * (p.k === "trail" ? 1 - t * 0.5 : 1);
          ctx.setTransform(dpr * cs, dpr * sn, -dpr * sn, dpr * cs, dpr * p.x, dpr * p.y);
          ctx.globalAlpha = a; ctx.drawImage(p.img, -s / 2, -s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1;
      if (parts.length) requestAnimationFrame(tick);
      else { running = false; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); }
    }
    fx = {
      add: function (p) {
        p.age = p.age || 0; p.rot = p.rot || 0; p.vr = p.vr || 0; p.drag = p.drag || 0; p.g = p.g || 0; p.vx = p.vx || 0; p.vy = p.vy || 0; p.ph = p.ph == null ? Math.random() * 6.28 : p.ph;
        if (parts.length >= MAX) parts.shift();
        parts.push(p);
        if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
      }
    };
    return fx;
  }

  var PALETTES = {
    gold: [C.gold, C.gold, C.amber, C.cream], sky: [C.sky, C.sky, C.cream, "#BFE6FF"], pink: [C.pink, C.gold, C.cream],
    mix: [C.gold, C.amber, C.sky, C.pink, C.cream]
  };
  function paletteFor(name) { return PALETTES[(name || "").trim()] || PALETTES.gold; }

  /* ---------- (b) sparkle trail ---------- */
  var trailApi = null;
  function sparkleTrail(opts) {
    if (trailApi) return trailApi;
    opts = opts || {};
    if (!fine() || reduced()) return NOOP;
    var lx = -999, ly = -999, gap = opts.spacing || 9;
    function move(e) {
      if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      if (reduced()) return;
      var el = e.target && e.target.closest ? e.target.closest("[data-sparkle]") : null;
      if (!el) return;
      var dx = e.clientX - lx, dy = e.clientY - ly;
      if (dx * dx + dy * dy < gap * gap) return;
      lx = e.clientX; ly = e.clientY;
      var pal = paletteFor(el.getAttribute("data-sparkle")), L = fxLayer(), n = Math.random() < 0.45 ? 2 : 1;
      for (var i = 0; i < n; i++) {
        var col = pick(pal), dot = Math.random() < 0.3;
        L.add({ k: "trail", img: dot ? dotSprite(col) : sparkSprite(col), x: e.clientX + rand(-7, 7), y: e.clientY + rand(-7, 7),
          vx: rand(-28, 28) - dx * 0.6, vy: rand(8, 55) - dy * 0.4, g: 70, drag: 2.2, life: rand(0.7, 1.1),
          s: dot ? rand(7, 12) : rand(13, 24), vr: rand(-2, 2), rot: rand(0, 1.5), tw: rand(8, 14) });
      }
    }
    doc.addEventListener("pointermove", move, { passive: true });
    trailApi = { destroy: function () { doc.removeEventListener("pointermove", move); trailApi = null; } };
    return trailApi;
  }

  /* ---------- (c) celebration burst ---------- */
  function burst(target, opts) {
    opts = opts || {};
    var el = null, x, y;
    if (target && typeof target.x === "number" && typeof target.y === "number" && !target.nodeType) { x = target.x; y = target.y; }
    else {
      el = toEl(target); if (!el) return;
      var r = el.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2;
    }
    if (el) {
      var cls = reduced() ? "mg-glow-pulse" : "mg-pop";
      el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
      setTimeout(function () { el.classList.remove(cls); }, 1200);
    }
    if (reduced()) return;
    var L = fxLayer(), n = Math.max(8, Math.min(140, opts.count || 54)), pal = opts.colors || [C.gold, C.gold, C.amber, C.sky, C.pink, C.cream];
    var power = opts.power || 1, spread = opts.spread == null ? Math.PI * 2 : opts.spread, dir = opts.angle == null ? -Math.PI / 2 : opts.angle;
    function ang() { return spread >= 6.28 ? Math.random() * 6.283 : dir + rand(-spread / 2, spread / 2); }
    L.add({ k: "ring", x: x, y: y, r0: 6, r1: 70 * power, c: C.gold, life: 0.7 });
    L.add({ k: "ring", x: x, y: y, r0: 4, r1: 46 * power, c: C.sky, life: 0.55 });
    var i, a, v;
    for (i = 0; i < n * 0.5; i++) {
      a = ang(); v = rand(180, 560) * power;
      L.add({ k: "spark", img: sparkSprite(pick(pal)), x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120 * power,
        g: 240, drag: 2.1, life: rand(0.9, 1.6), s: rand(16, 36), vr: rand(-3, 3), rot: Math.random() * 3, tw: rand(6, 12) });
    }
    for (i = 0; i < n * 0.32; i++) {
      a = ang(); v = rand(220, 600) * power; var col = pick([C.gold, C.amber, C.sky, C.pink, C.cream]);
      L.add({ k: "paper", c: col, back: rgba(col, 0.55), x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 260 * power,
        g: 560, drag: 1.5, flutter: 120, life: rand(1.4, 2.3), s: rand(6, 11), vr: rand(-5, 5), vf: rand(6, 13) });
    }
    for (i = 0; i < n * 0.18; i++) {
      a = ang(); v = rand(80, 320) * power;
      L.add({ k: "dot", img: dotSprite(pick(pal)), x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 90, drag: 1.8, life: rand(0.7, 1.3), s: rand(6, 12), tw: rand(10, 18) });
    }
  }

  /* ---------- (d) parallax ---------- */
  var hasTranslate = "translate" in root.style;
  function parallax(selector, opts) {
    opts = opts || {};
    var els = toEls(selector || "[data-depth]");
    if (!els.length || reduced()) return NOOP;
    var strength = opts.strength == null ? 26 : opts.strength, scrollK = opts.scroll == null ? 0.18 : opts.scroll;
    var layers = els.map(function (el, i) {
      var d = parseFloat(el.getAttribute("data-depth"));
      var sp = parseFloat(el.getAttribute("data-speed"));
      if (isNaN(d)) d = (i + 1) / els.length;
      el.classList.add("mg-layer");
      return { el: el, d: d, sp: isNaN(sp) ? d * scrollK : sp, frame: el.parentElement || el };
    });
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, scrolled = true, usePointer = opts.pointer !== false && fine();
    function apply() {
      raf = 0;
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      var vh = innerHeight, moving = Math.abs(tx - cx) > 0.0015 || Math.abs(ty - cy) > 0.0015;
      for (var i = 0; i < layers.length; i++) {
        var L = layers[i], top = 0;
        if (scrollK || L.sp) { var r = L.frame.getBoundingClientRect(); if (r.bottom < -200 || r.top > vh + 200) continue; top = Math.min(0, r.top); }
        var x = -cx * L.d * strength, y = -cy * L.d * strength + top * L.sp;
        if (hasTranslate) L.el.style.translate = x.toFixed(2) + "px " + y.toFixed(2) + "px";
        else L.el.style.transform = "translate3d(" + x.toFixed(2) + "px," + y.toFixed(2) + "px,0)";
      }
      scrolled = false;
      if (moving) raf = requestAnimationFrame(apply);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(apply); }
    function onMove(e) { if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return; tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2; kick(); }
    function onScroll() { scrolled = true; kick(); }
    if (usePointer) addEventListener("pointermove", onMove, { passive: true });
    addEventListener("scroll", onScroll, { passive: true });
    kick();
    return {
      destroy: function () {
        removeEventListener("pointermove", onMove); removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf);
        layers.forEach(function (L) { L.el.style.translate = ""; L.el.style.transform = ""; L.el.classList.remove("mg-layer"); });
      }
    };
  }

  /* ---------- (e) "page opens" reveal ---------- */
  var revealIO = null;
  function reveal(scope) {
    var els = [].slice.call((toEl(scope) || doc).querySelectorAll("[data-reveal]:not(.is-revealed)"));
    if (scope && scope.nodeType === 1 && scope.hasAttribute("data-reveal") && !scope.classList.contains("is-revealed")) els.unshift(scope);
    if (!els.length) return;
    if (reduced() || !window.IntersectionObserver) { els.forEach(function (e) { e.classList.add("is-revealed"); }); return; }
    if (!revealIO) {
      revealIO = new IntersectionObserver(function (entries) {
        var show = [];
        entries.forEach(function (en) {
          var el = en.target;
          if (en.isIntersecting) show.push(el);
          else if (en.boundingClientRect.bottom < 0) { el.classList.add("is-revealed", "mg-instant"); revealIO.unobserve(el); } // already scrolled past
        });
        show.sort(function (a, b) { var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.top - rb.top || ra.left - rb.left; });
        show.forEach(function (el, i) {
          var d = el.getAttribute("data-reveal-delay");
          el.style.setProperty("--mg-delay", (d != null && d !== "" ? parseFloat(d) : Math.min(i, 8) * 90) + "ms");
          el.classList.add("is-revealed"); revealIO.unobserve(el);
        });
      }, { rootMargin: "0px 0px -6% 0px", threshold: 0 });
    }
    els.forEach(function (e) { revealIO.observe(e); });
  }

  /* ---------- (f) wand swoosh underline ---------- */
  var uid = 0, swooshIO = null;
  var SWOOSH_D = "M3 19 C 60 8, 140 2, 197 5 C 150 11, 74 19, 3 19 Z";
  var SHINE_D = "M30 15 C 80 8, 140 5, 186 6 C 140 8.5, 84 12, 30 15 Z";
  var STAR = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 0 Q11.6 8.4 20 10 Q11.6 11.6 10 20 Q8.4 11.6 0 10 Q8.4 8.4 10 0Z"/></svg>';
  function swoosh(scope) {
    var els = [].slice.call((toEl(scope) || doc).querySelectorAll(".swoosh:not([data-mg-swoosh])"));
    els.forEach(function (el) {
      el.setAttribute("data-mg-swoosh", "");
      var id = "mgsw" + ++uid;
      var wrap = doc.createElement("span"); wrap.className = "mg-swoosh-wrap"; wrap.setAttribute("aria-hidden", "true");
      wrap.innerHTML = '<svg class="mg-swoosh" viewBox="0 0 200 24" preserveAspectRatio="none" focusable="false">' +
        '<defs><linearGradient id="' + id + '" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="' + C.amber + '" stop-opacity=".35"/>' +
        '<stop offset=".35" stop-color="' + C.amber + '"/><stop offset=".75" stop-color="' + C.gold + '"/><stop offset="1" stop-color="' + C.cream + '"/></linearGradient></defs>' +
        '<path d="' + SWOOSH_D + '" fill="url(#' + id + ')"/><path d="' + SHINE_D + '" fill="' + C.cream + '" opacity=".55"/></svg>' +
        '<span class="mg-swoosh-star">' + STAR + "</span>";
      el.appendChild(wrap);
    });
    if (!els.length) return;
    if (reduced() || !window.IntersectionObserver) { els.forEach(function (e) { e.classList.add("is-drawn"); }); return; }
    if (!swooshIO) swooshIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-drawn"); swooshIO.unobserve(en.target); } });
    }, { threshold: 0.6 });
    els.forEach(function (e) { swooshIO.observe(e); });
  }

  /* ---------- boot ---------- */
  onReady(function () {
    reveal(); swoosh();
    [].forEach.call(doc.querySelectorAll("[data-starfield]"), function (el) { starfield(el); });
    if (doc.querySelector("[data-sparkle]")) sparkleTrail();
  });

  window.Magic = { version: "1.0", starfield: starfield, sparkleTrail: sparkleTrail, burst: burst, parallax: parallax, reveal: reveal, swoosh: swoosh, reduced: reduced };
})();
