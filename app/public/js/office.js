import * as THREE from "three";
import { OrbitControls } from "/vendor/three/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "/vendor/three/CSS2DRenderer.js";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STAFF = Object.fromEntries((window.STAFF || []).map((s) => [s.key, s]));
// ---------- renderer ----------
const host = $("#scene");
// "Magic Hour" palette: an enchanted office at night (mirrors the tokens in /css/nl.css)
const C = { paper: 0xfff7e8, paper2: 0xfff1da, ink: 0x0b1a4a, ink2: 0x24305e, tomato: 0xff6fae, tomatoD: 0xff4f6e, sun: 0xffd36e, amber: 0xffb13b, sky: 0x6fc3ff, skyL: 0xcfe9ff, leaf: 0x3dd6a0, leafL: 0xd6f5ea, lilac: 0x9b84ff, lilacL: 0xe6e0ff, night0: 0x050b2e, night1: 0x0b1a4a, night2: 0x13296b, royal: 0x1f3fa6, glow: 0x3d7bff,
  oak: 0x8a5a36, plank: 0x5e3a22, oakM: 0x7a4a2a, plankM: 0x4a2c18, wallP: 0x6a6aa8, wood: 0x7a4a2a, woodD: 0x55321c, gold: 0xe8b24a };
const PASTELS = [C.lilac, C.tomato, C.sun, C.leaf, C.sky];
// a deep jewel tint of a staff colour (mixed toward midnight navy in sRGB)
function pastel(hex, k = 0.42) { const s = String(hex || "").replace("#", ""); if (!/^[0-9a-f]{6}$/i.test(s)) return null; const n = parseInt(s, 16), p = C.night1; const mix = (sh) => Math.round(((n >> sh) & 255) * (1 - k) + ((p >> sh) & 255) * k); return (mix(16) << 16) | (mix(8) << 8) | mix(0); }
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const labels = new CSS2DRenderer(); labels.setSize(innerWidth, innerHeight); Object.assign(labels.domElement.style, { position: "absolute", top: "0", left: "0", pointerEvents: "none" }); host.appendChild(labels.domElement);
const scene = new THREE.Scene(); scene.background = null; // the night sky is the CSS gradient + stars behind the transparent canvas
scene.fog = new THREE.Fog(C.night1, 110, 260); // a faint blue haze on the far corners
// keep the HUD height in a CSS variable so the feed / hint / desk card never collide with a wrapped top bar
const hudTop = $(".hud-top"); const syncHud = () => hudTop && document.documentElement.style.setProperty("--hud-h", `${Math.ceil(hudTop.getBoundingClientRect().bottom)}px`);
syncHud(); if (hudTop && "ResizeObserver" in window) new ResizeObserver(syncHud).observe(hudTop); addEventListener("resize", syncHud);
const FR = 47; let aspect = innerWidth / innerHeight;
const camera = new THREE.OrthographicCamera(-FR * aspect / 2, FR * aspect / 2, FR / 2, -FR / 2, 0.1, 500);
camera.position.set(44, 50, 60); const fitZoom = () => Math.max(0.5, Math.min(1.05, (innerWidth - (innerWidth > 900 ? 340 : 0)) / 1150)); camera.zoom = fitZoom();
function offset() { if (innerWidth > 900) camera.setViewOffset(innerWidth, innerHeight, 170, 10, innerWidth, innerHeight); else camera.clearViewOffset(); camera.updateProjectionMatrix(); }
offset();
const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.07, maxPolarAngle: 1.15, minPolarAngle: 0.45, minAzimuthAngle: -0.25, maxAzimuthAngle: 1.45, minZoom: 0.5, maxZoom: 3.2 });
controls.target.set(0, 0, 2); controls.update();
addEventListener("resize", () => { aspect = innerWidth / innerHeight; camera.zoom = fitZoom(); Object.assign(camera, { left: -FR * aspect / 2, right: FR * aspect / 2, top: FR / 2, bottom: -FR / 2 }); offset(); renderer.setSize(innerWidth, innerHeight); labels.setSize(innerWidth, innerHeight); });

// night: a blue sky dome over a warm walnut bounce, soft moonlight from the upper left, and golden desk lamps as the key light
scene.add(new THREE.HemisphereLight(0x8ea6ff, 0x3a2414, 1.1));
const sunL = new THREE.DirectionalLight(0xbfd0ff, 1.5); sunL.position.set(-48, 70, 18); sunL.castShadow = true; // moonlight
Object.assign(sunL.shadow.camera, { left: -48, right: 48, top: 44, bottom: -44, near: 1, far: 200 }); sunL.shadow.mapSize.set(2048, 2048); sunL.shadow.bias = -0.0004; sunL.shadow.normalBias = 0.02; sunL.shadow.radius = 4; scene.add(sunL);
const fillL = new THREE.DirectionalLight(0x7f95ff, 0.55); fillL.position.set(40, 30, 55); scene.add(fillL);
const bounceL = new THREE.DirectionalLight(0xffc98a, 0.35); bounceL.position.set(30, 20, -10); scene.add(bounceL);
// warm lamp pools over each row of desks and the lounge
for (const [x, y, z, i] of [[-20, 5.5, -11, 22], [1.5, 5.5, -11, 22], [22, 5.5, -11, 22], [-20, 5.5, 9, 22], [5, 5.5, 9, 22], [24, 5.5, 2, 18], [-2, 6, -18, 14]]) { const pl = new THREE.PointLight(0xffc27a, i * 0.85, 30, 1.2); pl.position.set(x, y, z); scene.add(pl); }

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.02, ...o });
const mesh = (g, m, x = 0, y = 0, z = 0, cast = true) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; return o; };
const box = (w, h, d, c, x, y, z, o) => mesh(new THREE.BoxGeometry(w, h, d), typeof c === "number" ? M(c, o) : c, x, y, z);
// ---------- building ----------
const W = 66, D = 46;
const flat = (o) => { o.castShadow = false; return o; }; // walls stay out of the sun's shadow map so the room reads open-topped
// a diorama base: a walnut edge on a midnight board with a thin gold rim
scene.add(flat(box(W + 10, 1.2, D + 10, M(C.night2, { roughness: 0.6, emissive: C.night1, emissiveIntensity: 0.5 }), 0, -1.6, 0))); scene.add(flat(box(W + 10.3, 0.12, D + 10.3, M(C.gold, { metalness: 0.5, roughness: 0.35, emissive: C.amber, emissiveIntensity: 0.25 }), 0, -1.1, 0))); scene.add(flat(box(W + 2, 1, D + 2, C.woodD, 0, -0.5, 0)));
scene.add(mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), M(0x6e4630, { roughness: 0.62 }), 0, 0.01, 0, false));
const plankM = M(C.plankM, { roughness: 0.9 }); // pre-saturated so ACES lands on light oak #E8C29A / #D9AE82 for (let i = -W / 2 + 2; i < W / 2; i += 2) scene.add(mesh(new THREE.PlaneGeometry(0.07, D).rotateX(-Math.PI / 2), plankM, i, 0.015, 0, false));
for (let i = -W / 2 + 1; i < W / 2; i += 2) for (let z = -D / 2 + ((i * 7) % 9 + 9) % 9 + 3; z < D / 2 - 1; z += 13) scene.add(mesh(new THREE.PlaneGeometry(2, 0.06).rotateX(-Math.PI / 2), plankM, i, 0.016, z, false));
const wallM = M(C.wallP, { roughness: 0.95, emissive: 0x2a2c6e, emissiveIntensity: 0.55 }), trimM = M(C.gold, { roughness: 0.4, metalness: 0.45, emissive: C.amber, emissiveIntensity: 0.12 }), capM = M(C.sun, { roughness: 0.35, metalness: 0.5, emissive: C.amber, emissiveIntensity: 0.3 });
scene.add(flat(box(W, 7, 0.6, wallM, 0, 3.5, -D / 2))); scene.add(flat(box(0.6, 7, D, wallM, -W / 2, 3.5, 0)));
scene.add(flat(box(W, 1.0, 0.7, trimM, 0, 0.5, -D / 2 + 0.05))); scene.add(flat(box(0.7, 1.0, D, trimM, -W / 2 + 0.05, 0.5, 0)));
scene.add(flat(box(W + 0.4, 0.4, 0.9, capM, 0, 7.2, -D / 2))); scene.add(flat(box(0.9, 0.4, D, capM, -W / 2, 7.2, 0)));
// windows onto a starry night: deep blue sky, twinkling stars, a crescent moon, sleepy hills with a lit cottage or two
function windowTex(seed, withMoon) {
  let s = seed * 9301 + 49297; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const c = document.createElement("canvas"); c.width = 512; c.height = 240; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, "#050B2E"); gr.addColorStop(0.6, "#13296B"); gr.addColorStop(1, "#2B4BB0"); g.fillStyle = gr; g.fillRect(0, 0, 512, 240);
  for (let k = 0; k < 46; k++) { const x = rnd() * 512, y = rnd() * 170, r = rnd() < 0.15 ? 2.4 : 0.8 + rnd() * 1.1; g.fillStyle = rnd() < 0.25 ? "#FFE7A8" : "#FFFFFF"; g.globalAlpha = 0.55 + rnd() * 0.45; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  if (withMoon) { const mx = 380, my = 76, mr = 40; const halo = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 2.6); halo.addColorStop(0, "rgba(255,231,168,.42)"); halo.addColorStop(1, "rgba(255,231,168,0)"); g.fillStyle = halo; g.beginPath(); g.arc(mx, my, mr * 2.6, 0, 7); g.fill();
    const mc = document.createElement("canvas"); mc.width = mc.height = 128; const m = mc.getContext("2d"); m.fillStyle = "#FFF3C9"; m.beginPath(); m.arc(64, 64, mr, 0, 7); m.fill(); m.globalCompositeOperation = "destination-out"; m.beginPath(); m.arc(64 + mr * 0.55, 64 - mr * 0.28, mr * 0.9, 0, 7); m.fill(); g.drawImage(mc, mx - 64, my - 64); }
  g.fillStyle = "#0D1E58"; g.beginPath(); g.moveTo(0, 240); g.lineTo(0, 196); g.quadraticCurveTo(140 + rnd() * 60, 150, 300, 200); g.quadraticCurveTo(420, 168, 512, 190); g.lineTo(512, 240); g.fill();
  g.fillStyle = "#081340"; g.beginPath(); g.moveTo(0, 240); g.lineTo(0, 222); g.quadraticCurveTo(220, 186 + rnd() * 14, 512, 226); g.lineTo(512, 240); g.fill();
  for (let k = 0; k < 2; k++) { const hx = 70 + k * 230 + rnd() * 90, hy = 200 + rnd() * 10; g.fillStyle = "#081340"; g.fillRect(hx, hy - 14, 22, 16); g.beginPath(); g.moveTo(hx - 3, hy - 14); g.lineTo(hx + 11, hy - 26); g.lineTo(hx + 25, hy - 14); g.fill(); g.fillStyle = "#FFC764"; g.fillRect(hx + 8, hy - 9, 6, 6); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const frameM = M(C.gold, { roughness: 0.4, metalness: 0.45, emissive: C.amber, emissiveIntensity: 0.15 });
[-26, -14, 14, 26].forEach((x, i) => { scene.add(flat(box(7, 3.6, 0.2, frameM, x, 4.2, -D / 2 + 0.35)));
  scene.add(mesh(new THREE.PlaneGeometry(6.4, 3.0), new THREE.MeshBasicMaterial({ map: windowTex(i + 3, i === 3), toneMapped: false, fog: false }), x, 4.2, -D / 2 + 0.47, false));
  scene.add(flat(box(0.16, 3.0, 0.1, frameM, x, 4.2, -D / 2 + 0.52))); scene.add(flat(box(6.4, 0.14, 0.1, frameM, x, 4.2, -D / 2 + 0.52)));
  scene.add(flat(box(7.6, 0.28, 0.7, trimM, x, 2.3, -D / 2 + 0.6))); });
// a soft round glow sprite (lamp pools, fireflies)
let _glow = null; function glowTex() { if (_glow) return _glow; const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,.75)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); _glow = new THREE.CanvasTexture(c); _glow.colorSpace = THREE.SRGBColorSpace; return _glow; }
// rugs = rooms
const rug =(x, z, w, d, c) => scene.add(mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), M(c, { roughness: 1 }), x, 0.03, z, false));
// sign: a glowing marquee, white and gold on midnight
function signTex(text, sub) { const c = document.createElement("canvas"); c.width = 1024; c.height = 256; const g = c.getContext("2d");
  const draw = () => { g.clearRect(0, 0, 1024, 256); g.fillStyle = "#050B2E"; g.beginPath(); g.roundRect(4, 10, 1016, 242, 46); g.fill(); const bg = g.createLinearGradient(0, 0, 1024, 256); bg.addColorStop(0, "#13296B"); bg.addColorStop(1, "#0B1A4A"); g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, 1016, 236, 46); g.fill(); g.strokeStyle = "#FFD36E"; g.lineWidth = 8; g.beginPath(); g.roundRect(10, 10, 1004, 224, 40); g.stroke();
    g.save(); g.shadowColor = "rgba(255,211,110,.9)"; g.shadowBlur = 22; g.fillStyle = "#FFD36E"; g.beginPath(); g.arc(112, 108, 42, 0, 7); g.fill(); g.restore(); g.fillStyle = bg; g.beginPath(); g.arc(134, 94, 38, 0, 7); g.fill();
    g.fillStyle = "#FFD36E"; for (const [sx, sy, sr] of [[178, 60, 5], [196, 150, 3.5], [70, 170, 3], [930, 64, 4.5], [956, 168, 3], [900, 196, 2.5]]) { g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill(); }
    g.save(); g.shadowColor = "rgba(111,195,255,.65)"; g.shadowBlur = 18; g.fillStyle = "#FFFFFF"; g.font = "600 92px Fredoka, Nunito, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillText(text, 545, 132); g.restore(); g.textAlign = "center"; g.fillStyle = "#FFD36E"; g.font = "800 38px Nunito, system-ui, sans-serif"; g.fillText(sub, 545, 196); };
  draw(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (document.fonts?.load) Promise.all([document.fonts.load("600 92px Fredoka"), document.fonts.load("800 38px Nunito")]).then(() => { draw(); t.needsUpdate = true; }).catch(() => {});
  return t; }
scene.add(mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: signTex("Nightlight Press", "a publisher with no employees"), transparent: true, toneMapped: false }), 0, 5.2, -D / 2 + 0.45, false));
// ---------- desks ----------
const TOP = -13, BOT = 11, LANE_T = -7.5, LANE_B = 5.5;
const DESKS = {
  author: { x: -25, z: TOP, rug: 0x5a3fa8 }, editor: { x: -15, z: TOP, rug: 0x1f7a5c }, illustrator: { x: -4, z: TOP, rug: 0xa8344e }, narrator: { x: 7, z: TOP, rug: 0xa8781e }, binder: { x: 17, z: TOP, rug: 0x1f5aa8 }, proofreader: { x: 27, z: TOP, rug: 0x1a7f8a },
  marketer: { x: -25, z: BOT, rug: 0xa83a7a }, frontdesk: { x: -15, z: BOT, rug: 0x3f8a3a }, cashier: { x: -5, z: BOT, rug: 0x5a4aa8 }, storyteller: { x: 5, z: BOT, rug: 0xa8641e }, mailroom: { x: 15, z: BOT, rug: 0xa83a5a },
  clock: { x: -29, z: -1, side: true, rug: 0x8a6a1e },
};
for (const [k, d] of Object.entries(DESKS)) d.rug = pastel(STAFF[k]?.color) ?? d.rug; // rugs follow each desk's staff colour
const DOOR = new THREE.Vector3(27, 0, D / 2 - 1), LOUNGE = [new THREE.Vector3(24, 0, -1), new THREE.Vector3(28, 0, 1.5), new THREE.Vector3(20, 0, 2), new THREE.Vector3(-2, 0, -21 + 3.5)];
rug(DOOR.x, DOOR.z - 4, 9, 8, 0x6a2a4e);
const screens = {}, deskGroups = [], deskLabels = {}, anim = { spin: [], ring: [], onair: null, press: null, easel: null, shelf: [], fly: [], clockH: null, clockM: null, sparks: [] };
function label(html, y) { const d = document.createElement("div"); d.className = "lbl"; d.innerHTML = html; const o = new CSS2DObject(d); o.position.set(0, y, 0); return o; }
function makeDesk(key, dsk) {
  const g = new THREE.Group(); g.position.set(dsk.x, 0, dsk.z); if (dsk.side) g.rotation.y = -Math.PI / 2;
  rug(dsk.x, dsk.z - 0.5, dsk.side ? 7 : 8.4, dsk.side ? 9 : 7.2, dsk.rug);
  const wood = M(C.wood, { roughness: 0.7 }); g.add(box(4.2, 0.22, 1.9, wood, 0, 1.5, 0));
  for (const [x, z] of [[-1.9, -0.75], [1.9, -0.75], [-1.9, 0.75], [1.9, 0.75]]) g.add(box(0.16, 1.5, 0.16, wood, x, 0.75, z));
  g.add(box(4.0, 1.0, 0.1, M(C.woodD), 0, 1.0, 0.85));
  const scr = M(0x13234a, { emissive: C.sky, emissiveIntensity: 0.25, roughness: 0.4 }); // glows sky-blue while the desk is working screens[key] = scr;
  g.add(box(1.5, 1.0, 0.1, M(C.ink2, { roughness: 0.5 }), -0.6, 2.25, 0.3)); g.add(mesh(new THREE.PlaneGeometry(1.36, 0.86), scr, -0.6, 2.25, 0.36, false)); g.add(box(0.12, 0.5, 0.12, M(C.ink2), -0.6, 1.8, 0.3));
  g.add(box(1.1, 0.06, 0.4, M(0xf4efe6), -0.6, 1.63, -0.15));
  const lamp = new THREE.Group(); lamp.add(box(0.1, 0.9, 0.1, M(C.gold, { metalness: 0.5, roughness: 0.4 }), 0, 0.45, 0)); lamp.add(mesh(new THREE.ConeGeometry(0.35, 0.4, 16, 1, true), M(C.amber, { side: THREE.DoubleSide, emissive: C.amber, emissiveIntensity: 0.55 }), 0, 0.95, 0)); lamp.add(mesh(new THREE.SphereGeometry(0.16, 12, 8), M(0xfff1c8, { emissive: 0xffc960, emissiveIntensity: 2.6 }), 0, 0.85, 0, false));
  const pool = mesh(new THREE.CircleGeometry(0.95, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xffb85a, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), -0.2, 0.04, 0, false); lamp.add(pool);
  lamp.position.set(1.6, 1.6, 0.2); g.add(lamp);
  const chairM = M(C.royal, { roughness: 0.6 }); const chair = new THREE.Group(); chair.add(box(1.2, 0.18, 1.1, chairM, 0, 0.95, 0)); chair.add(box(1.2, 1.2, 0.16, chairM, 0, 1.6, -0.55)); chair.add(box(0.12, 0.9, 0.12, M(C.ink2), 0, 0.45, 0)); chair.position.set(0, 0, -1.7); g.add(chair);
  props(key, g);
  const s = STAFF[key] || { name: key, icon: "" }; const L = label(`<span class="nm"><i class="dt" style="background:${esc(s.color || "#B8A1FF")}"></i>${s.icon ? `<span class="ic">${s.icon}</span>` : ""}${esc(s.name)}</span><small>${esc(s.kind || "")}</small>`, 0); L.position.set(0, 0.3, 2.9); g.add(L); deskLabels[key] = L.element;
  L.element.onclick = () => openDesk(key);
  g.userData.key = key; g.traverse((o) => (o.userData.key = key)); scene.add(g); deskGroups.push(g);
  const world = (x, z) => new THREE.Vector3(x, 0, z).applyMatrix4(g.matrixWorld.clone().makeRotationY(g.rotation.y)).add(new THREE.Vector3(dsk.x, 0, dsk.z));
  g.updateMatrixWorld();
  dsk.chair = world(0, -1.7); dsk.side_ = world(2.8, -1.7); dsk.top = world(0, 0).setY(1.8);
  dsk.lane = dsk.side ? world(6, -1.7) : new THREE.Vector3(dsk.side_.x, 0, dsk.z < 0 ? LANE_T : LANE_B);
  dsk.group = g;
}
function props(key, g) {
  if (key === "author") { g.add(box(0.9, 0.25, 0.7, 0xfdf8ef, 0.7, 1.74, -0.1)); g.add(box(3.6, 3.2, 0.8, M(C.woodD), 0, 1.6, -3.4)); for (let i = 0; i < 18; i++) g.add(box(0.16, 0.7 + Math.random() * 0.25, 0.5, PASTELS[i % 5], -1.5 + (i % 9) * 0.36, i < 9 ? 1.0 : 2.3, -3.2)); }
  if (key === "editor") { for (let i = 0; i < 4; i++) g.add(box(0.85, 0.06, 1.1, 0xfdf8ef, 0.8, 1.64 + i * 0.07, -0.1)); g.add(box(0.06, 0.06, 0.8, C.tomatoD, 0.8, 1.95, -0.1)); }
  if (key === "illustrator") { const e = new THREE.Group(); e.add(box(0.12, 4, 0.12, C.woodD, -0.8, 2, 0.3)); e.add(box(0.12, 4, 0.12, C.woodD, 0.8, 2, 0.3)); e.add(box(0.12, 3.6, 0.12, C.woodD, 0, 1.8, -0.6)); const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }); const cv = mesh(new THREE.PlaneGeometry(2.6, 1.75), cm, 0, 2.9, 0.42, false); e.add(box(2.8, 1.95, 0.08, 0xfdf8ef, 0, 2.9, 0.36)); e.add(cv); e.position.set(3.7, 0, 0.2); e.rotation.y = -0.4; g.add(e); anim.easel = cm; for (let i = 0; i < 5; i++) g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 10), M(PASTELS[(i + 1) % 5]), 0.6 + i * 0.25, 1.68, 0.2)); }
  if (key === "narrator") { g.add(box(0.06, 1.0, 0.06, C.ink2, 0.7, 2.1, -0.3)); g.add(mesh(new THREE.CapsuleGeometry(0.16, 0.3, 4, 10), M(0x8c93a8, { metalness: 0.5, roughness: 0.4 }), 0.7, 2.7, -0.3)); const oa = M(0xb8432e, { emissive: C.tomato, emissiveIntensity: 0.1 }); g.add(box(1.6, 0.5, 0.12, oa, 0, 3.8, -2.6)); anim.onair = oa; for (let i = 0; i < 6; i++) g.add(box(0.8, 0.8, 0.15, i % 2 ? C.lilac : 0xd3c6ff, -2.6 + (i % 3) * 0.9, 1.3 + Math.floor(i / 3) * 0.9, -2.5)); }
  if (key === "binder") { const pr = new THREE.Group(); pr.add(box(2, 1.6, 1.6, C.tomato, 0, 0.8, 0)); const cyl = mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.8, 18).rotateZ(Math.PI / 2), M(0xc9d3e0, { metalness: 0.6, roughness: 0.35 }), 0, 1.9, 0); pr.add(cyl); pr.position.set(4, 0, -0.4); g.add(pr); anim.press = cyl; anim.stack = new THREE.Group(); anim.stack.position.set(1.0, 1.62, 0.2); g.add(anim.stack); }
  if (key === "proofreader") { g.add(box(0.5, 0.9, 0.08, C.ink, 0.9, 2.1, 0)); const ps = M(0x2c3e5c, { emissive: C.sky, emissiveIntensity: 0.3 }); g.add(mesh(new THREE.PlaneGeometry(0.42, 0.8), ps, 0.9, 2.1, 0.05, false)); anim.phone = ps; }
  if (key === "marketer") { const cb = box(3.6, 2.4, 0.15, 0xd2a273, 0, 3.2, -2.9); g.add(cb); anim.cork = new THREE.Group(); anim.cork.position.set(-1.3, 3.2, -2.8); g.add(anim.cork); g.add(mesh(new THREE.ConeGeometry(0.35, 0.8, 16, 1, true).rotateZ(Math.PI / 2), M(C.tomato, { side: THREE.DoubleSide }), 1.0, 1.85, 0)); }
  if (key === "frontdesk") { g.add(box(5.4, 1.6, 0.5, 0x2a7a6a, 0, 0.8, 1.2)); g.add(mesh(new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(C.sun, { metalness: 0.6, roughness: 0.3 }), 1.2, 1.62, 0.3)); g.add(box(0.8, 0.25, 0.6, 0xd9b27e, 0.7, 1.74, -0.2)); }
  if (key === "cashier") { g.add(box(1.1, 0.6, 0.9, C.ink2, 0.9, 1.9, 0)); g.add(box(0.9, 0.3, 0.5, M(0x2f6b4c, { emissive: C.leaf, emissiveIntensity: 0.6 }), 0.9, 2.35, 0.1)); anim.coins = new THREE.Group(); anim.coins.position.set(1.5, 1.62, 0.5); g.add(anim.coins); }
  if (key === "storyteller") { const ph = new THREE.Group(); ph.add(box(0.9, 0.35, 0.7, C.tomato, 0, 0.18, 0)); ph.add(mesh(new THREE.TorusGeometry(0.33, 0.09, 8, 16, Math.PI), M(C.tomatoD), 0, 0.42, 0)); ph.position.set(0.8, 1.6, 0); g.add(ph); anim.phoneG = ph; }
  if (key === "mailroom") { for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { g.add(box(0.85, 0.75, 0.6, C.wood, -1.4 + c * 0.9, 1.3 + r * 0.8, -3.1)); if (Math.random() > 0.4) g.add(box(0.6, 0.06, 0.4, 0xfdf8ef, -1.4 + c * 0.9, 1.0 + r * 0.8, -2.9)); } g.add(box(1.2, 0.5, 0.9, C.sky, 4, 0.25, 0)); }
  if (key === "clock") { const face = mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.15, 40).rotateX(Math.PI / 2), M(0xfff7e8, { emissive: 0xfff1d0, emissiveIntensity: 0.45 }), 0, 4.6, -3.0, false); g.add(face); g.add(mesh(new THREE.TorusGeometry(1.5, 0.14, 10, 40), capM, 0, 4.6, -3.0)); const hand = (len, w) => { const h = new THREE.Group(); h.add(box(w, len, 0.05, C.ink, 0, len / 2, 0)); h.position.set(0, 4.6, -2.88); g.add(h); return h; }; anim.clockH = hand(0.85, 0.14); anim.clockM = hand(1.25, 0.08); g.add(mesh(new THREE.SphereGeometry(0.3, 16, 12), M(0xfff6dc, { emissive: C.sun, emissiveIntensity: 0.3 }), 1.2, 1.8, 0.4)); anim.bell = g.children[g.children.length - 1].material; }
}
for (const [k, d] of Object.entries(DESKS)) makeDesk(k, d);
// lounge, shelf, door
(() => { const sofaM = M(C.royal, { roughness: 0.85 }); const g = new THREE.Group(); g.add(box(5, 0.9, 1.6, sofaM, 0, 0.45, 0)); g.add(box(5, 1.4, 0.4, sofaM, 0, 1.1, -0.7)); for (const x of [-2.6, 2.6]) g.add(box(0.4, 1.2, 1.6, sofaM, x, 0.6, 0)); for (const x of [-1.2, 1.2]) g.add(box(2.2, 0.25, 1.3, 0x2a4fc0, x, 1.0, 0.1)); g.add(box(1.0, 0.9, 0.3, M(C.sun, { emissive: C.amber, emissiveIntensity: 0.2 }), -1.3, 1.5, -0.4)); g.add(box(1.0, 0.9, 0.3, C.tomato, 1.3, 1.5, -0.4)); g.position.set(24, 0, 3.5); scene.add(g);
  scene.add(box(1.0, 2.2, 1.0, 0xffffff, 29, 1.1, -2)); scene.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 16), M(0x9fd3ff, { transparent: true, opacity: 0.75, roughness: 0.2 }), 29, 2.65, -2));
  scene.add(mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.8, 16), M(0xe07a52), 21, 0.4, -2)); scene.add(mesh(new THREE.SphereGeometry(1.0, 14, 10), M(C.leaf), 21, 1.6, -2)); scene.add(mesh(new THREE.SphereGeometry(0.6, 12, 8), M(0x5cc488), 21.5, 2.4, -1.7));
  rug(24, 0.5, 12, 7, 0x2a3f8a);
  const L = label("☕ Lounge<small>where idle staff wander</small>", 3.2); L.position.set(24, 3.4, 0.5); scene.add(L);
  const sh = new THREE.Group(); sh.add(box(12, 4.5, 1.2, C.woodD, 0, 2.25, 0)); for (const y of [1.2, 2.5, 3.8]) sh.add(box(11.6, 0.1, 1.1, C.wood, 0, y - 0.6, 0.05)); sh.add(box(12.3, 0.3, 1.4, capM, 0, 4.6, 0)); sh.position.set(-2, 0, -D / 2 + 1.2); scene.add(sh); anim.shelfG = sh;
  const SL = label("📚 The free shelf<small>Marketing adds a book every night</small>", 5.6); SL.position.set(-2, 5.4, -D / 2 + 1.5); scene.add(SL);
  scene.add(box(4.5, 5.5, 0.4, frameM, DOOR.x, 2.75, D / 2 - 0.2)); scene.add(box(3.4, 4.6, 0.45, M(C.royal, { roughness: 0.6 }), DOOR.x, 2.3, D / 2 - 0.2));
  scene.add(mesh(new THREE.CircleGeometry(0.75, 28), new THREE.MeshBasicMaterial({ color: 0xffc764, toneMapped: false, fog: false }), DOOR.x, 3.4, D / 2 + 0.04, false)); scene.add(mesh(new THREE.SphereGeometry(0.16, 12, 8), M(C.sun, { metalness: 0.6, roughness: 0.3 }), DOOR.x - 1.2, 2.2, D / 2 + 0.1));
  const DL = label("🚪 Front door<small>orders in, books out</small>", 6.2); DL.position.set(DOOR.x, 6.3, D / 2 - 0.4); scene.add(DL); })();
// ---------- people ----------
const SKIN = [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0xffdbac, 0x5c3a21], HAIR = [0x1f1a17, 0x3b2a20, 0x6b4a2b, 0xc9a26b, 0x2b2b3a, 0x8a3b2a];
const people = {};
function makePerson(key, i) {
  const s = STAFF[key] || {}; const color = new THREE.Color(s.color || "#B8A1FF").getHex(); const g = new THREE.Group();
  const legM = M(C.ink2); const lL = box(0.24, 0.85, 0.28, legM, -0.2, 0.43, 0), lR = box(0.24, 0.85, 0.28, legM, 0.2, 0.43, 0); g.add(lL, lR);
  const body = mesh(new THREE.CapsuleGeometry(0.5, 0.85, 4, 14), M(color), 0, 1.5, 0); g.add(body);
  const head = mesh(new THREE.SphereGeometry(0.42, 22, 16), M(SKIN[i % SKIN.length]), 0, 2.55, 0); g.add(head);
  g.add(mesh(new THREE.SphereGeometry(0.45, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2.1), M(HAIR[(i * 5) % HAIR.length]), 0, 2.6, -0.03));
  for (const x of [-0.15, 0.15]) g.add(mesh(new THREE.SphereGeometry(0.055, 8, 6), M(C.ink), x, 2.58, 0.39, false));
  const hL = mesh(new THREE.SphereGeometry(0.15, 10, 8), M(SKIN[i % SKIN.length]), -0.45, 1.65, 0.45), hR = mesh(new THREE.SphereGeometry(0.15, 10, 8), M(SKIN[i % SKIN.length]), 0.45, 1.65, 0.45); g.add(hL, hR);
  const carry = new THREE.Group(); carry.position.set(0, 1.95, 0.6); g.add(carry);
  const bd = document.createElement("div"); bd.className = "bub"; const bo = new CSS2DObject(bd); bo.position.set(0, 3.4, 0); g.add(bo);
  const d = DESKS[key]; g.scale.setScalar(1.45); g.position.copy(d.chair); g.rotation.y = d.side ? Math.PI / 2 : 0; scene.add(g);
  people[key] = { key, g, lL, lR, hL, hR, body, carry, bub: bd, path: [], speed: 6.5, state: "sit", working: false, doing: "", idleAt: performance.now() + 4000 + Math.random() * 14000, tmp: null, onArrive: null, queue: [] };
}
Object.keys(DESKS).forEach(makePerson);
const ITEM = { manuscript: [0.8, 0.12, 1.0, 0xfffdf7], painting: [1.0, 0.7, 0.08, C.tomato], tape: [0.6, 0.4, 0.2, C.sun], book: [0.9, 0.3, 0.7, C.lilac], envelope: [0.9, 0.1, 0.6, 0xffe2a8], ticket: [0.6, 0.06, 0.4, C.leaf], note: [0.6, 0.06, 0.6, 0xc7f0a8], coin: [0.4, 0.1, 0.4, C.sun], phone: [0.4, 0.7, 0.08, C.sky] };
function itemMesh(type) { const [w, h, d, c] = ITEM[type] || ITEM.manuscript; return box(w, h, d, M(c, { emissive: c, emissiveIntensity: 0.4 }), 0, 0, 0); }
function bubble(p, text, ms = 3500) { if (!text) return; p.bub.textContent = text; p.bub.classList.add("show"); clearTimeout(p.bt); if (ms) p.bt = setTimeout(() => { if (p.working && p.doing) p.bub.textContent = p.doing; else p.bub.classList.remove("show"); }, ms); }
function route(fromKey, toPoint, toLane) { const a = DESKS[fromKey]; return [a.side_, a.lane, toLane, toPoint]; }
function backRoute(p, fromLane) { const d = DESKS[p.key]; return [fromLane, d.lane, d.side_, d.chair]; }
function walk(p, pts, done) { p.path = pts.map((v) => v.clone()); p.state = "walk"; p.onArrive = done; }
function handoff(fromKey, toKey, type, say) {
  const p = people[fromKey], t = DESKS[toKey]; if (!p || !t) return;
  if (p.state !== "sit" || p.queue.length) { fly(DESKS[fromKey].top, t.top, type); return; }
  p.carry.clear(); p.carry.add(itemMesh(type)); if (say) bubble(p, say, 2500);
  walk(p, route(fromKey, t.side_, t.lane), () => { p.carry.clear(); const q = people[toKey]; if (q) { bubble(q, "Thanks!", 1500); spark(t.top); } p.state = "wait"; setTimeout(() => walk(p, backRoute(p, t.lane), () => { p.state = "sit"; }), 600); });
}
function toDoor(fromKey, type, say) { const p = people[fromKey]; if (!p || p.state !== "sit") { fly(DESKS[fromKey].top, DOOR.clone().setY(2), type); return; } p.carry.clear(); p.carry.add(itemMesh(type)); if (say) bubble(p, say, 2500); const lane = new THREE.Vector3(DOOR.x, 0, LANE_B); walk(p, route(fromKey, DOOR.clone().add(new THREE.Vector3(0, 0, -2)), lane), () => { p.carry.clear(); fly(p.g.position.clone().setY(2), DOOR.clone().add(new THREE.Vector3(0, 3, 6)), type); p.state = "wait"; setTimeout(() => walk(p, backRoute(p, lane), () => (p.state = "sit")), 500); }); }
function fly(a, b, type) { const m = itemMesh(type); m.position.copy(a); scene.add(m); anim.fly.push({ m, a: a.clone(), b: b.clone(), t: 0, dur: 1.3 + a.distanceTo(b) / 40 }); }
function spark(pos, color = C.sun) { const m = mesh(new THREE.RingGeometry(0.2, 0.35, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }), pos.x, pos.y + 0.3, pos.z, false); scene.add(m); anim.sparks.push({ m, t: 0 }); }
// arriving visitor (an order)
function visitor(name) { const g = new THREE.Group(); g.add(mesh(new THREE.CapsuleGeometry(0.45, 0.8, 4, 12), M(C.sky), 0, 1.4, 0)); g.add(mesh(new THREE.SphereGeometry(0.38, 16, 12), M(SKIN[Math.floor(Math.random() * 6)]), 0, 2.4, 0)); const e = itemMesh("envelope"); e.position.set(0, 1.9, 0.55); g.add(e);
  const bd = document.createElement("div"); bd.className = "bub show"; bd.textContent = name ? `An order for ${name}!` : "A new order!"; const bo = new CSS2DObject(bd); bo.position.set(0, 3.4, 0); g.add(bo);
  g.position.copy(DOOR).add(new THREE.Vector3(0, 0, 3)); scene.add(g); const fd = DESKS.cashier; const v = { g, path: [DOOR.clone().add(new THREE.Vector3(0, 0, -3)), new THREE.Vector3(fd.side_.x + 1, 0, LANE_B + 2.5)], speed: 7, done: false };
  v.after = () => { g.remove(e); spark(fd.top, C.leaf); bd.textContent = "Thank you!"; v.path = [DOOR.clone().add(new THREE.Vector3(0, 0, -3)), DOOR.clone().add(new THREE.Vector3(0, 0, 4))]; v.after = () => { scene.remove(g); bo.element?.remove(); bd.remove(); v.done = true; }; };
  visitors.push(v); }
const visitors = [];
// ---------- textures ----------
const tl = new THREE.TextureLoader(); const texCache = {};
function tex(id) { if (!texCache[id]) { const t = tl.load(`/api/media/${id}`, () => { t.userData.ok = true; (t.userData.wait || []).forEach((f) => f(t)); t.userData.wait = []; }, undefined, () => { delete texCache[id]; }); t.colorSpace = THREE.SRGBColorSpace; t.userData.wait = []; texCache[id] = t; } return texCache[id]; }
// apply a texture only once it has loaded, so a slow or failed image never paints a black square on the bright set
function withTex(id, fn) { const t = tex(id); if (t.userData.ok) fn(t); else t.userData.wait.push(fn); }
function paintEasel(id) { if (!id || !anim.easel) return; withTex(id, (t) => { anim.easel.map = t; anim.easel.needsUpdate = true; }); }
let shelfN = 0; function shelfAdd(cover) { const i = shelfN++; if (i >= 27) return; const row = Math.floor(i / 9), col = i % 9; const m = new THREE.MeshStandardMaterial({ color: [C.lilac, C.tomato, C.sun][i % 3] }); if (cover) withTex(cover, (t) => { m.color.set(0xffffff); m.map = t; m.needsUpdate = true; }); const b = mesh(new THREE.BoxGeometry(1.1, 0.95, 0.12), m, -5.2 + col * 1.3, 0.62 + row * 1.3 + 0.5, 0.62, false); b.scale.set(0.01, 0.01, 0.01); anim.shelfG.add(b); anim.shelf.push({ b, t: 0 }); }
function corkAdd(cover) { if (!anim.cork || !cover) return; const n = anim.cork.children.length; if (n > 5) anim.cork.remove(anim.cork.children[0]); const cm = new THREE.MeshStandardMaterial({ color: 0xfffdf7 }); withTex(cover, (t) => { cm.map = t; cm.needsUpdate = true; }); const m = mesh(new THREE.PlaneGeometry(0.9, 0.62), cm, 0, 0, 0.1, false); anim.cork.children.forEach((c, k) => c.position.set((k % 3) * 1.25, k < 3 ? 0.4 : -0.45, 0.1)); m.position.set((n % 3) * 1.25, n < 3 ? 0.4 : -0.45, 0.1); anim.cork.add(m); }
// ---------- events ----------
const KIND = {
  told: (d) => ["🎙️", `<b>${esc(d.teller)}</b> told a story about <b>${esc(d.hero)}</b> (${d.words} words)${d.robot ? " with Pip" : ""}`],
  film: (d) => ["🎬", `<b>Film desk</b> animated ${d.page === "cover" ? "the cover" : `page ${d.page}`} into a short film`],
  order: (d) => ["📝", `New order: a ${d.style || ""} book for <b>${esc(d.hero)}</b>, age ${d.age}`],
  payment: (d) => ["💳", d.mode === "pledge" ? "<b>Cashier</b> logged a pledge: nothing charged" : `<b>Cashier</b> took $${(d.amount_cents / 100).toFixed(2)}`],
  checkout: () => ["💳", "<b>Cashier</b> opened Stripe Checkout"],
  commission: (d) => ["📋", `Production started for <b>${esc(d.hero)}</b>${d.kind === "catalog" ? " (shelf book)" : ""}`],
  commission_shelf: (d) => ["📣", `<b>Marketing</b> commissioned tonight's shelf book: ${esc(d.hero)}, ${esc(d.occasion)}`],
  agent_start: (d, e) => ["▶️", `<b>${esc(name(e.actor))}</b> started: ${esc(d.purpose)}`],
  story: (d) => ["✒️", d.revised ? "<b>Author</b> revised the text" : `<b>Author</b> finished “${esc(d.title)}”: ${d.pages} pages, ${d.words} words`],
  edit_check: (d) => ["🔎", `<b>Editor</b> ${d.pass ? "approved the draft" : "sent the draft back"} (${d.words} words, grade ${d.reading_grade ?? "?"})`],
  paint: (d) => ["🎨", `<b>Illustrator</b> painted ${d.page === "cover" ? "the cover" : `page ${d.page}`}`],
  narrate: (d) => ["🎙️", `<b>Narrator</b> recorded page ${d.page}`],
  bind: (d) => ["📚", `<b>Binder</b> bound ${d.pages} pages, ${d.minutes_since_order} min after the order`],
  deliver: (d) => ["✉️", `<b>Mailroom</b> emailed the book${d.revised ? " (revised)" : ""}`],
  sms: () => ["💬", "<b>Mailroom</b> texted the link"],
  read_call: (d) => ["☎️", `<b>Storyteller Line</b> is phoning ${esc(d.listener)} to read it`],
  read_call_done: (d) => ["☎️", `<b>Storyteller Line</b> finished a ${Math.round((d.duration_seconds || 0) / 60 * 10) / 10}-minute reading`],
  frontdesk: (d) => ["💬", `<b>Front Desk</b> answered a family (${esc(d.intent)})`],
  revise: (d) => ["🔁", `Changes sent back to production: pages ${(d.pages || []).join(", ") || "all"}`],
  proof: (d) => ["📱", `<b>Proofreader</b> ${d.ok ? "checked it on a real phone ✓" : "flagged a problem on the phone"}`],
  proof_skipped: () => ["📱", "<b>Proofreader</b> is waiting for a phone to be connected"],
  publish: (d) => ["📚", `<b>Marketing</b> put “${esc(d.title)}” on the free shelf (${(d.channels || []).join(", ")})`],
  clearance_requested: (d) => ["✋", `Waiting for a person: ${esc(d.reason)}`],
  intervention: (d) => ["🧑", `A person stepped in: ${esc(d.what)}`],
  job_failed: (d) => ["⚠️", `A ${esc(d.kind)} step failed: ${esc(String(d.error || "").slice(0, 80))}`],
  deliver_failed: () => ["⚠️", "An email failed to send"],
};
const ACT = { "agent:author": "author", "code:editor": "editor", "agent:illustrator": "illustrator", "agent:narrator": "narrator", "agent:binder": "binder", "code:mailroom": "mailroom", "agent:storyteller-line": "storyteller", "agent:proofreader": "proofreader", "agent:frontdesk": "frontdesk", "agent:marketer": "marketer", "agent:film": "illustrator" };
const name = (a) => STAFF[ACT[a] || String(a).replace(/^agent:/, "")]?.name || String(a).replace(/^agent:/, "");
function feed(e, replay) { const f = KIND[e.kind]; if (!f) return; const [i, t] = f(e.detail || {}, e); const el = document.createElement("div"); el.className = `ev${replay ? " replay" : ""}`; el.innerHTML = `<i>${i}</i><div>${t}<small>${new Date(e.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}${replay ? " · replay" : ""}</small></div>`; const box = $("#events"); box.prepend(el); while (box.children.length > 60) box.lastChild.remove(); }
function banner(t) { const b = $("#banner"); b.innerHTML = t; b.classList.add("show"); clearTimeout(window.__bn); window.__bn = setTimeout(() => b.classList.remove("show"), 4200); }
const hero = {};
function act(e) {
  const d = e.detail || {};
  switch (e.kind) {
    case "order": visitor(d.hero); break;
    case "payment": spark(DESKS.cashier.top, C.leaf); bubble(people.cashier, d.mode === "pledge" ? "Pledge noted" : `+$${(d.amount_cents / 100).toFixed(0)}`); if (anim.coins && anim.coins.children.length < 12) { const c = itemMesh("coin"); c.position.set(0, anim.coins.children.length * 0.11, 0); anim.coins.add(c); } break;
    case "commission": hero[e.order_id] = d.hero; if (d.kind === "catalog") handoff("marketer", "author", "ticket", `A book about ${d.hero}`); else handoff("cashier", "author", "ticket", `Paid! Book for ${d.hero}`); break;
    case "commission_shelf": bubble(people.marketer, `Tonight: ${d.hero}, ${d.occasion}`, 4000); break;
    case "agent_start": { const k = ACT[e.actor]; if (k && people[k]) bubble(people[k], d.purpose, 4000); if (k && screens[k]) screens[k].emissiveIntensity = 1.6; break; }
    case "story": if (!d.revised) handoff("author", "editor", "manuscript", `“${d.title}” is done!`); else bubble(people.author, "Revised!"); break;
    case "edit_check": if (d.pass) { handoff("editor", "illustrator", "manuscript", `Approved: ${d.words} words`); setTimeout(() => fly(DESKS.editor.top, DESKS.narrator.top, "manuscript"), 400); } else handoff("editor", "author", "manuscript", `Too long, try again`); break;
    case "paint": paintEasel(d.media); bubble(people.illustrator, d.page === "cover" ? "Painted the cover" : `Painted page ${d.page}`, 1800); fly(DESKS.illustrator.top, DESKS.binder.top, "painting"); break;
    case "narrate": bubble(people.narrator, `Recorded page ${d.page}`, 1500); if (anim.onair) anim.onair.emissiveIntensity = 2.5; fly(DESKS.narrator.top, DESKS.binder.top, "tape"); break;
    case "bind": bubble(people.binder, `Bound in ${d.minutes_since_order} min!`, 3500); if (anim.stack && anim.stack.children.length < 8) { const b = itemMesh("book"); b.position.y = anim.stack.children.length * 0.32; anim.stack.add(b); } handoff("binder", "mailroom", "book", "Hot off the press"); banner(`📚 “${esc(hero[e.order_id] ? `${hero[e.order_id]}'s book` : "A new book")}” is bound`); break;
    case "deliver": toDoor("mailroom", "envelope", "Off it goes!"); break;
    case "sms": bubble(people.mailroom, "Texted the link", 2000); break;
    case "read_call": anim.ringing = Date.now() + 12000; bubble(people.storyteller, `Hello ${d.listener}! I'm an AI storyteller…`, 6000); break;
    case "read_call_done": anim.ringing = 0; bubble(people.storyteller, "The end. Sweet dreams.", 4000); break;
    case "frontdesk": bubble(people.frontdesk, d.intent === "thanks" ? "Aww, thank you!" : d.intent?.startsWith("revise") ? "On it, sending to production" : "Replied!", 3000); if (d.intent?.startsWith("revise")) handoff("frontdesk", d.intent === "revise_art" ? "illustrator" : "author", "note"); break;
    case "proof": bubble(people.proofreader, d.ok ? "Looks right on a phone ✓" : "Something's off", 3000); if (anim.phone) anim.phone.emissiveIntensity = 2; break;
    case "told": visitor(d.hero); bubble(people.frontdesk, `A story from ${d.teller}!`, 3000); handoff("frontdesk", "author", "note", "A told story!"); break;
    case "film": bubble(people.illustrator, d.page === "cover" ? "The cover moves!" : `Page ${d.page} is a film now!`, 2500); spark(DESKS.illustrator.top, 0x6fc3ff); break;
    case "publish": handoff("marketer", "author", "book", "To the shelf!"); shelfAdd(d.cover); corkAdd(d.cover); banner(`📚 New on the free shelf: “${esc(d.title)}”`); break;
    case "job_failed": spark((DESKS[{ paint: "illustrator", narrate: "narrator", write: "author", deliver: "mailroom" }[d.kind] || "clock"] || DESKS.clock).top, C.tomatoD); break;
  }
}
// ---------- polling ----------
let since = 0, first = true, lastClock = null, replaying = false;
function setStaff(staff) {
  for (const [k, p] of Object.entries(people)) {
    if (k === "clock" || k === "cashier") continue; const s = staff[k]; const was = p.working; p.working = !!s; p.doing = s ? s.doing + (s.n > 1 ? ` (${s.n})` : "") : "";
    if (screens[k]) screens[k].emissiveIntensity = p.working ? 1.4 : Math.max(0.25, screens[k].emissiveIntensity * 0.9);
    deskLabels[k]?.classList.toggle("on", p.working);
    if (p.working && (!was || p.bub.textContent !== p.doing) && p.state === "sit") bubble(p, p.doing, 0);
    if (!p.working && was) p.bub.classList.remove("show");
    if (p.working && p.state === "idle-walk") { p.path = [DESKS[k].lane, DESKS[k].side_, DESKS[k].chair]; p.state = "walk"; p.onArrive = () => (p.state = "sit"); }
  }
}
function making(rows) { $("#making").innerHTML = rows.slice(0, 4).map((r) => `<a class="mk" href="/book/${r.id}"><div class="c" ${""}></div><div style="flex:1"><b>${esc(r.title || `${r.child_name}'s book`)}</b><span>${r.kind === "catalog" ? "Shelf book · " : ""}${r.status === "ready" ? "Ready ✓" : r.status}${r.pages ? ` · ${r.painted}/${r.pages} pages painted` : ""}</span><div class="bar"><i style="width:${r.status === "ready" ? 100 : r.status === "writing" ? 8 : Math.round(10 + 80 * (r.painted || 0) / Math.max(1, r.pages))}%"></i></div></div></a>`).join(""); }
async function poll() {
  try {
    const j = await (await fetch(`/api/office?since=${since}`)).json();
    $("#kp").innerHTML = [["Books made", j.stats.books], ["Pages painted", j.stats.painted], [j.mode === "pledge" ? "Pledged" : "Revenue", `$${(((j.mode === "pledge" ? j.stats.pledged : j.stats.revenue) || 0) / 100).toFixed(0)}`], ["On the shelf", j.stats.shelf]].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join("");
    if (first) { for (let i = 0; i < Math.min(j.stats.shelf, 27); i++) shelfAdd(null); }
    setStaff(j.staff || {}); making(j.making || []);
    for (const e of j.events) { since = Math.max(since, e.seq); if (e.kind === "commission") hero[e.order_id] = e.detail?.hero; feed(e); if (!first) act(e); else if (e.kind === "paint") paintEasel(e.detail?.media); }
    if (j.clock) { const age = Math.round((Date.now() - new Date(j.clock.at)) / 1000); $("#clock").innerHTML = `<span class="dot"></span> Night Manager · woke the office ${age < 60 ? `${age}s` : `${Math.round(age / 60)}m`} ago`; if (lastClock && lastClock !== j.clock.at) { if (anim.bell) anim.bell.emissiveIntensity = 3; if (/mcp|naive/.test(j.clock.source)) bubble(people.clock, "Everyone up! Checking the queue", 2500); } lastClock = j.clock.at; }
    first = false;
  } catch (e) { console.warn(e); }
}
poll(); setInterval(poll, 2000);
setInterval(() => fetch("/api/pulse", { method: "POST" }).catch(() => {}), 5000);
// replay the most recent finished book
$("#replay").onclick = async () => {
  if (replaying) return; replaying = true; $("#replay").textContent = "Replaying…";
  let all; try { all = await (await fetch("/api/ledger.json")).json(); } catch { replaying = false; $("#replay").textContent = "Replay the last book"; return banner("The ledger is napping. Try again in a moment."); }
  const last = [...all].reverse().find((e) => e.kind === "bind" && e.order_id);
  if (!last) { replaying = false; $("#replay").textContent = "Replay the last book"; return banner("No finished books yet. Make one!"); }
  const evs = all.filter((e) => e.order_id === last.order_id && KIND[e.kind] && !["read_call", "read_call_done"].includes(e.kind)).slice(0, 80);
  banner("Replaying how the last book was made"); let k = 0;
  const step = () => { if (k >= evs.length) { replaying = false; $("#replay").textContent = "Replay the last book"; return; } const e = evs[k++]; feed({ ...e, created_at: new Date().toISOString() }, true); act(e); setTimeout(step, ["paint", "narrate"].includes(e.kind) ? 380 : 1500); };
  step();
};
// desk card
function openDesk(key) { const s = STAFF[key]; if (!s) return; const p = people[key]; const c = $("#desk"); c.hidden = false; c.innerHTML = `<button aria-label="Close">×</button><div class="ico" style="--c:${esc(s.color || "#B8A1FF")}">${s.icon}</div><h3>${esc(s.name)}</h3><span class="tag">${esc(s.kind)}</span><p class="role">${esc(s.role)}</p><p class="now${p?.working ? " on" : ""}">${p?.working ? `Now: ${esc(p.doing)}` : "Idle right now"}</p>`; c.querySelector("button").onclick = () => (c.hidden = true); }
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let downAt = 0;
renderer.domElement.addEventListener("pointerdown", () => (downAt = performance.now()));
renderer.domElement.addEventListener("pointerup", (ev) => { if (performance.now() - downAt > 250) return; ptr.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera); const hit = ray.intersectObjects(deskGroups, true)[0]; if (hit?.object.userData.key) openDesk(hit.object.userData.key); });
// ---------- fireflies: tiny golden sparkles drifting through the room ----------
const FF_N = 80, ffPos = new Float32Array(FF_N * 3), ffCol = new Float32Array(FF_N * 3), ffSeed = [];
for (let i = 0; i < FF_N; i++) { ffSeed.push({ x: (Math.random() - 0.5) * (W - 6), y: 1.5 + Math.random() * 7, z: (Math.random() - 0.5) * (D - 6), p: Math.random() * 6.28, s: 0.25 + Math.random() * 0.5, r: 0.8 + Math.random() * 2.2 }); }
const ffGeo = new THREE.BufferGeometry(); ffGeo.setAttribute("position", new THREE.BufferAttribute(ffPos, 3)); ffGeo.setAttribute("color", new THREE.BufferAttribute(ffCol, 3));
const fireflies = new THREE.Points(ffGeo, new THREE.PointsMaterial({ size: 11, map: glowTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false, sizeAttenuation: false }));
fireflies.frustumCulled = false; fireflies.renderOrder = 5; scene.add(fireflies);
const ffCalm = matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
function fireflyStep(t) { const tt = ffCalm ? 0 : t; for (let i = 0; i < FF_N; i++) { const f = ffSeed[i], a = tt * f.s + f.p; ffPos[i * 3] = f.x + Math.sin(a) * f.r; ffPos[i * 3 + 1] = f.y + Math.sin(a * 1.7 + f.p) * 0.6; ffPos[i * 3 + 2] = f.z + Math.cos(a * 0.8) * f.r; const b = 0.35 + 0.65 * Math.max(0, Math.sin(tt * (1.2 + f.s * 2) + f.p * 3)); ffCol[i * 3] = 1.0 * b; ffCol[i * 3 + 1] = 0.83 * b; ffCol[i * 3 + 2] = 0.43 * b; } ffGeo.attributes.position.needsUpdate = true; ffGeo.attributes.color.needsUpdate = true; }
// ---------- loop ----------
const clk = new THREE.Clock(); const tmp = new THREE.Vector3();
function step(p, dt, t) {
  if (p.path.length) {
    const tgt = p.path[0]; tmp.copy(tgt).sub(p.g.position); tmp.y = 0; const dist = tmp.length();
    if (dist < 0.15) { p.path.shift(); if (!p.path.length) { const cb = p.onArrive; p.onArrive = null; const d = DESKS[p.key]; if (d && p.g.position.distanceTo(d.chair) < 0.3) p.g.rotation.y = d.side ? Math.PI / 2 : 0; cb && cb(); } }
    else { tmp.normalize(); p.g.position.addScaledVector(tmp, Math.min(dist, p.speed * dt)); p.g.rotation.y = Math.atan2(tmp.x, tmp.z); const s = Math.sin(t * 12); p.lL.rotation.x = s * 0.6; p.lR.rotation.x = -s * 0.6; p.body.position.y = 1.5 + Math.abs(s) * 0.08; }
  } else { p.lL.rotation.x = p.lR.rotation.x = 0; p.body.position.y = 1.5; }
  const typing = p.working && p.state === "sit"; p.hL.position.y = 1.65 + (typing ? Math.max(0, Math.sin(t * 18 + 1)) * 0.12 : 0); p.hR.position.y = 1.65 + (typing ? Math.max(0, Math.sin(t * 18 + 2.4)) * 0.12 : 0);
  p.g.position.y = p.state === "sit" && !p.path.length ? 0.15 : 0;
  // idle wandering: the lounge, the shelf, the water cooler
  if (!p.working && p.state === "sit" && performance.now() > p.idleAt && p.key !== "clock") {
    const spot = LOUNGE[Math.floor(Math.random() * LOUNGE.length)].clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 2)); const lane = new THREE.Vector3(spot.x, 0, spot.z < -10 ? LANE_T : LANE_B);
    p.state = "idle-walk"; walk(p, route(p.key, spot, lane), () => { p.state = "idle-walk"; if (Math.random() < 0.5) bubble(p, ["☕ Coffee break", "What a starry night", "Who's reading tonight?", "Love that cover", "Queue's quiet"][Math.floor(Math.random() * 5)], 2200); setTimeout(() => { if (p.state === "idle-walk") walk(p, backRoute(p, lane), () => (p.state = "sit")); }, 3500 + Math.random() * 4000); });
    p.state = "idle-walk"; p.idleAt = performance.now() + 20000 + Math.random() * 30000;
  }
}
function loop() {
  const dt = Math.min(clk.getDelta(), 0.05), t = clk.elapsedTime;
  for (const p of Object.values(people)) step(p, dt, t);
  for (const v of visitors) { if (v.done || !v.path.length) continue; const tgt = v.path[0]; tmp.copy(tgt).sub(v.g.position); tmp.y = 0; const dist = tmp.length(); if (dist < 0.2) { v.path.shift(); if (!v.path.length) v.after?.(); } else { tmp.normalize(); v.g.position.addScaledVector(tmp, Math.min(dist, v.speed * dt)); v.g.rotation.y = Math.atan2(tmp.x, tmp.z); v.g.position.y = Math.abs(Math.sin(t * 12)) * 0.1; } }
  for (let i = anim.fly.length - 1; i >= 0; i--) { const f = anim.fly[i]; f.t += dt / f.dur; const k = Math.min(1, f.t); f.m.position.lerpVectors(f.a, f.b, k); f.m.position.y += Math.sin(k * Math.PI) * 5; f.m.rotation.y += dt * 6; if (k >= 1) { scene.remove(f.m); anim.fly.splice(i, 1); spark(f.b); } }
  for (let i = anim.sparks.length - 1; i >= 0; i--) { const s = anim.sparks[i]; s.t += dt; s.m.scale.setScalar(1 + s.t * 6); s.m.material.opacity = Math.max(0, 1 - s.t * 1.6); if (s.t > 0.7) { scene.remove(s.m); anim.sparks.splice(i, 1); } }
  for (const s of anim.shelf) if (s.t < 1) { s.t = Math.min(1, s.t + dt * 1.5); s.b.scale.setScalar(Math.max(0.01, s.t)); }
  if (anim.press) anim.press.rotation.x += dt * (people.binder?.working ? 6 : 0.3);
  if (anim.onair) anim.onair.emissiveIntensity = people.narrator?.working ? 1.6 + Math.sin(t * 4) * 0.4 : Math.max(0.1, anim.onair.emissiveIntensity * 0.97);
  if (anim.phone) anim.phone.emissiveIntensity = Math.max(0.3, anim.phone.emissiveIntensity * 0.985);
  if (anim.bell) anim.bell.emissiveIntensity = Math.max(0.3, anim.bell.emissiveIntensity * 0.96);
  if (anim.phoneG) { const r = anim.ringing && Date.now() < anim.ringing; anim.phoneG.rotation.z = r ? Math.sin(t * 40) * 0.12 : 0; if (r && Math.random() < dt * 2) spark(DESKS.storyteller.top, C.sun); }
  for (const [k, s] of Object.entries(screens)) if (!people[k]?.working) s.emissiveIntensity = Math.max(0.25, s.emissiveIntensity * 0.985);
  const now = new Date(); if (anim.clockH) { anim.clockH.rotation.z = -((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2; anim.clockM.rotation.z = -(now.getMinutes() + now.getSeconds() / 60) / 60 * Math.PI * 2; }
  fireflyStep(t);
  controls.update(); renderer.render(scene, camera); labels.render(scene, camera); requestAnimationFrame(loop);
}
loop();
window.__office = { act, people, DESKS };
