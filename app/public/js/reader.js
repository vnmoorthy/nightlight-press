(() => {
  const ID = window.BOOK_ID, $ = (s) => document.querySelector(s); let book = null, pages = [], at = 0, playing = false, ver = "";
  const pic = $("#pic"), txt = $("#txt"), aud = $("#aud"), dots = $("#dots");
  const facts = () => (Array.isArray(book?.robot_facts) ? book.robot_facts : []);
  const slides = () => [{ cover: true }, ...pages, ...(facts().length ? [{ facts: true }] : [])];
  const vid = document.createElement("video"); vid.id = "vid"; vid.muted = true; vid.loop = true; vid.playsInline = true; vid.setAttribute("playsinline", ""); vid.style.cssText = "width:100%;aspect-ratio:3/2;object-fit:cover;display:none;background:#0b1a4a"; pic.after(vid);
  function showMedia(imageId, videoId) { if (videoId) { pic.style.display = "none"; vid.style.display = "block"; const src = `/api/media/${videoId}`; if (!vid.src.endsWith(src)) { vid.src = src; vid.poster = imageId ? `/api/media/${imageId}` : ""; } vid.play().catch(() => {}); } else { vid.pause(); vid.style.display = "none"; pic.style.display = "block"; pic.src = imageId ? `/api/media/${imageId}` : ""; } }
  function render() {
    const s = slides()[at]; if (!s) return;
    if (s.facts) { showMedia(pages[pages.length - 1]?.image_media_id, null); txt.innerHTML = `<div style="font:600 26px/1.2 var(--display, Fredoka)">🤖 Learn about robots</div><ol style="text-align:left;max-width:640px;margin:12px auto 0;padding-left:22px;line-height:1.5">${facts().map((f) => `<li style="margin:6px 0">${esc(f)}</li>`).join("")}</ol>`; }
    else if (s.cover) { showMedia(book.cover_media_id, book.cover_video_media_id); txt.innerHTML = `<span style="font:600 28px/1.2 var(--display)">${esc(book.title || "")}</span>${book.dedication ? `<div class="small muted" style="margin-top:8px;font-style:italic">${esc(book.dedication)}</div>` : ""}`; }
    else { showMedia(s.image_media_id, s.video_media_id); txt.textContent = s.text; }
    dots.innerHTML = slides().map((_, i) => `<i class="${i === at ? "on" : ""}"></i>`).join("");
    const nx = slides()[at + 1]; if (nx?.image_media_id) { const im = new Image(); im.src = `/api/media/${nx.image_media_id}`; }
  }
  function go(i, keepPlaying) { at = Math.max(0, Math.min(slides().length - 1, i)); render(); if (playing && keepPlaying) play(); else stop(); }
  function stop() { playing = false; aud.pause(); $("#readBtn").textContent = "▶ Read to me"; }
  function play() {
    playing = true; $("#readBtn").textContent = "❚❚ Pause";
    const s = slides()[at]; if (s.cover) { setTimeout(() => playing && go(1, true), 1800); return; } if (s.facts) { setTimeout(() => { stop(); toast("The end. Sweet dreams."); }, 6000); return; }
    if (!s.audio_media_id) { setTimeout(() => playing && (at < slides().length - 1 ? go(at + 1, true) : stop()), 4000); return; }
    aud.src = `/api/media/${s.audio_media_id}`; aud.play().catch(() => stop());
  }
  aud.onended = () => { if (!playing) return; if (at < slides().length - 1) setTimeout(() => playing && go(at + 1, true), 900); else { stop(); toast("The end. Sweet dreams."); } };
  $("#readBtn").onclick = () => (playing ? stop() : play());
  $("#prev").onclick = () => go(at - 1, true); $("#nextp").onclick = () => go(at + 1, true);
  addEventListener("keydown", (e) => { if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return; if (e.key === "ArrowRight") go(at + 1, true); if (e.key === "ArrowLeft") go(at - 1, true); if (e.key === " ") { e.preventDefault(); playing ? stop() : play(); } });
  let tx = 0; $("#spread").addEventListener("touchstart", (e) => (tx = e.touches[0].clientX), { passive: true }); $("#spread").addEventListener("touchend", (e) => { const d = e.changedTouches[0].clientX - tx; if (Math.abs(d) > 50) go(at + (d < 0 ? 1 : -1), true); });
  $("#shareBtn").onclick = async () => { try { await navigator.clipboard.writeText(location.href); toast("Link copied."); } catch { toast(location.href); } };
  const cb = $("#chgBtn"); if (cb) cb.onclick = async () => { const t = $("#chg").value.trim(); if (t.length < 3) return toast("Tell the Front Desk what to change."); cb.disabled = true; const r = await fetch(`/api/book/${ID}/message`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t }) }); const j = await r.json(); cb.disabled = false; if (!r.ok) return toast(j.error); $("#chg").value = ""; toast("The Front Desk has it. This page updates when the changes are done, and you'll get an email."); fetch("/api/pulse", { method: "POST" }); };
  const rb = $("#rtBtn"); if (rb) rb.onclick = async () => { rb.disabled = true; const r = await fetch(`/api/book/${ID}/read-to`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: $("#rtName").value, phone: $("#rtPhone").value, consent: $("#rtOk").checked }) }); const j = await r.json(); rb.disabled = false; toast(r.ok ? "Calling now. The Storyteller Line will read the whole book." : j.error); };
  async function load() {
    const r = await fetch(`/api/book/${ID}`); if (!r.ok) return; const j = await r.json();
    const v = JSON.stringify([j.book.status, j.book.title, j.pages.map((p) => [p.text, p.image_media_id, p.audio_media_id, p.video_media_id]), j.book.cover_media_id, j.book.cover_video_media_id, j.book.robot_facts]);
    book = j.book; pages = j.pages;
    $("#btitle").textContent = book.title || "A new book"; $("#pdfBtn").hidden = !book.pdf_media_id;
    $("#bstatus").textContent = book.status === "ready" ? "Written, illustrated, narrated and bound by the Nightlight staff." : "The staff is working on this book now. It updates by itself.";
    if (v !== ver) { const first = !ver; ver = v; if (!playing) render(); if (!first && book.status === "ready") toast("Updated with the latest changes."); }
    if (book.status !== "ready") fetch("/api/pulse", { method: "POST" }).catch(() => {});
  }
  load().then(() => setInterval(load, 4000));
})();
