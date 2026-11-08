(() => {
  const ID = window.ORDER_ID, $ = (s) => document.querySelector(s); let seen = 0, done = false, lastPulse = 0;
  const KIND = { order: "📝 Order received", payment: "💳 Cashier: payment recorded", commission: "📋 Production started", agent_start: "▶", story: "✒️ Author finished the manuscript", edit_check: "🔎 Editor", paint: "🎨 Illustrator painted", narrate: "🎙️ Narrator recorded page", bind: "📚 Binder bound the book", deliver: "✉️ Mailroom emailed the book", sms: "💬 Mailroom texted the link", read_call: "☎️ Storyteller Line is calling", read_call_done: "☎️ Call finished", frontdesk: "💬 Front Desk read your message", revise: "🔁 Sent back for changes", proof: "📱 Proofreader checked it on a phone", proof_skipped: "📱 Proofreader skipped", deliver_failed: "⚠️ Email failed", job_failed: "⚠️ A step failed and will be retried", film: "🎬 The Film desk animated a page", told: "🎙️ Your story reached the Author" };
  function line(e) {
    const d = e.detail || {}; let t = KIND[e.kind] || e.kind;
    if (e.kind === "agent_start") t = `▶ ${(e.actor || "").replace("agent:", "")} started: ${d.purpose || ""}`;
    if (e.kind === "edit_check") t = `🔎 Editor ${d.pass ? "approved the draft" : "sent the draft back"}: ${d.words} words, reading grade ${d.reading_grade ?? "?"}${d.issues?.length ? ` (${d.issues.slice(0, 2).join("; ")})` : ""}`;
    if (e.kind === "paint") t = `🎨 Illustrator painted ${d.page === "cover" ? "the cover" : `page ${d.page}`}`;
    if (e.kind === "narrate") t = `🎙️ Narrator recorded page ${d.page}`;
    if (e.kind === "story") t = d.revised ? "✒️ Author revised the text" : `✒️ Author finished "${d.title}" (${d.pages} pages, ${d.words} words)`;
    if (e.kind === "film") t = `🎬 The Film desk animated ${d.page === "cover" ? "the cover" : `page ${d.page}`} into a short film`;
    if (e.kind === "told") t = `🎙️ ${d.teller}'s story (${d.words} words) reached the Author`;
    if (e.kind === "bind") t = `📚 Binder bound ${d.pages} pages, ${d.minutes_since_order} min after you ordered`;
    if (e.kind === "payment") t = d.mode === "pledge" ? "💳 Cashier: pledge mode, nothing charged" : `💳 Cashier: $${(d.amount_cents / 100).toFixed(2)} paid`;
    return `<div><span class="when">${new Date(e.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</span> ${esc(t)}</div>`;
  }
  async function pulse() { if (Date.now() - lastPulse < 3000 || done) return; lastPulse = Date.now(); fetch("/api/pulse", { method: "POST" }).catch(() => {}); }
  async function load() {
    pulse();
    const r = await fetch(`/api/order/${ID}`); if (!r.ok) return; const j = await r.json(); const b = j.book, pages = j.pages || [];
    const ev = j.events || []; if (ev.length > seen) { const log = $("#log"); log.insertAdjacentHTML("afterbegin", ev.slice(seen).reverse().map(line).join("")); seen = ev.length; }
    const kinds = new Set(ev.map((e) => e.kind)); const working = (j.working || []).map((w) => w[0]);
    const doneMap = { author: kinds.has("story"), editor: ev.some((e) => e.kind === "edit_check" && e.detail?.pass) || (kinds.has("story") && kinds.has("edit_check")), illustrator: pages.length && pages.every((p) => p.image_media_id) && b?.cover_media_id, narrator: pages.length && pages.every((p) => p.audio_media_id), binder: kinds.has("bind"), mailroom: kinds.has("deliver") };
    document.querySelectorAll(".stn").forEach((s) => { const k = s.dataset.k; s.classList.toggle("done", !!doneMap[k]); s.classList.toggle("on", working.includes(k) || (k === "editor" && working.includes("author") && kinds.has("agent_start") && !doneMap.editor && kinds.has("edit_check"))); });
    $("#working").innerHTML = (j.working || []).length ? `<span class="spin"></span> ${(j.working || []).map((w) => esc(w[1])).join(" · ")}` : b?.status === "ready" ? "All done." : '<span class="spin"></span> Waiting for the next desk';
    const th = $("#thumbs"); const want = pages.length ? pages.length + 1 : 11;
    if (th.children.length !== want) th.innerHTML = Array.from({ length: want }, (_, i) => `<div class="th"><i>${i ? i : "cover"}</i></div>`).join("");
    const imgs = [b?.cover_media_id, ...pages.map((p) => p.image_media_id)];
    [...th.children].forEach((el, i) => { const m = imgs[i]; if (m && el.dataset.m !== m) { el.dataset.m = m; el.style.backgroundImage = `url('/api/media/${m}')`; el.classList.add("ready"); } });
    const painted = imgs.filter(Boolean).length; $("#pcount").textContent = pages.length ? `${painted} of ${pages.length + 1} painted · ${pages.filter((p) => p.audio_media_id).length} of ${pages.length} narrated` : "";
    if (b?.title) $("#headline").textContent = `“${b.title}”`;
    if (pages.length && !$("#manuscript").dataset.done) { $("#manuscript").innerHTML = `<div class="eyebrow">The manuscript</div>` + pages.map((p) => `<p style="margin:0 0 12px"><b class="pn">${p.idx}</b>${esc(p.text)}</p>`).join(""); $("#manuscript").dataset.done = 1; }
    if (b?.status === "ready" && !done) {
      done = true; $("#ready").hidden = false; $("#readyTitle").textContent = b.title; $("#readyOpen").href = `/book/${b.id}`; $("#readyPdf").href = `/api/book/${b.id}.pdf`;
      if (b.cover_media_id) $("#readyCover").style.backgroundImage = `url('/api/media/${b.cover_media_id}')`;
      $("#readyNote").textContent = kinds.has("deliver") ? "It's in your inbox too, with the PDF attached." : "The Mailroom is sending it to your inbox now.";
      $("#sub").textContent = "Read it tonight. Reply to the email, or use the box beside the book, to change anything.";
      toast("The book is ready."); setTimeout(() => { done = false; }, 20000);
    }
  }
  load(); setInterval(load, 2000);
})();
