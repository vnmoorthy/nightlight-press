(() => {
  const $ = (s) => document.querySelector(s);
  const box = $("#transcript"), mic = $("#mic"), state = $("#micstate"), form = $("#tellForm"), err = $("#tellErr"), go = $("#go");
  let finalText = "", listening = false, rec = null, media = null, chunks = [];
  const words = () => (box.innerText || "").trim().split(/\s+/).filter(Boolean).length;
  const count = () => { $("#wc").textContent = `${words()} words`; };
  box.addEventListener("input", () => { finalText = box.innerText; count(); });
  const say = (b, s) => { state.innerHTML = `<b>${esc(b)}</b><span>${esc(s)}</span>`; };
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function render(interim) { box.innerHTML = esc(finalText) + (interim ? ` <span class="interim">${esc(interim)}</span>` : ""); box.scrollTop = box.scrollHeight; count(); }
  function startLive() {
    rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = document.querySelector("#language").value === "es" ? "es-US" : navigator.language || "en-US";
    rec.onresult = (e) => { let interim = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) finalText += (finalText && !/\s$/.test(finalText) ? " " : "") + t.trim() + " "; else interim += t; } render(interim); };
    rec.onerror = (e) => { if (e.error === "not-allowed") { stop(); say("The microphone is blocked", "Allow microphone access in the address bar, or type the story."); } };
    rec.onend = () => { if (listening) { try { rec.start(); } catch { /* already started */ } } };
    rec.start();
  }
  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    media = new MediaRecorder(stream); chunks = [];
    media.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    media.onstop = async () => { stream.getTracks().forEach((t) => t.stop()); say("Listening back…", "Turning your recording into words."); const blob = new Blob(chunks, { type: media.mimeType || "audio/webm" });
      const r = await fetch("/api/transcribe", { method: "POST", headers: { "content-type": blob.type }, body: blob }); const j = await r.json();
      if (!r.ok) return say("Couldn't hear that", j.error || "Try again, or type the story.");
      finalText = (finalText + " " + j.text).trim() + " "; render(""); say("Got it", "Edit anything you like, then make it a book."); };
    media.start();
  }
  async function start() {
    err.textContent = ""; listening = true; mic.classList.add("on"); mic.textContent = "■"; mic.setAttribute("aria-label", "Stop");
    finalText = (box.innerText || "").trim(); if (finalText) finalText += " ";
    try { if (SR) { startLive(); say("Listening…", "Tell your story. Tap the button again when you're done."); } else { await startRecording(); say("Recording…", "Tell your story. Tap again when you're done and we'll write it down."); } }
    catch { stop(); say("The microphone isn't available", "Type the story in the box instead."); }
  }
  function stop() { listening = false; mic.classList.remove("on"); mic.textContent = "🎙️"; mic.setAttribute("aria-label", "Start telling"); try { rec && rec.stop(); } catch { /* */ } if (media && media.state === "recording") media.stop(); else say(words() ? "Lovely story" : "Tap the microphone and start talking", words() ? "Check the hero's name, then make it a book." : "Your words appear here as you speak."); render(""); }
  mic.onclick = () => (listening ? stop() : start());
  form.onsubmit = async (e) => {
    e.preventDefault(); if (listening) stop();
    const story = (box.innerText || "").trim();
    if (story.split(/\s+/).length < 12) { err.textContent = "Tell a little more: a sentence or two about the hero and the story."; return; }
    if (!form.consent.checked) { err.textContent = "A grown-up needs to tick the permission box first."; return; }
    go.disabled = true; go.innerHTML = '<span class="spin"></span> Sending your story to the Author…';
    const d = Object.fromEntries(new FormData(form).entries()); d.robot = !!form.robot.checked; d.consent = !!form.consent.checked; d.share = !!form.share.checked; d.story = story; d.source = "tell";
    try { const r = await fetch("/api/tell", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(d) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Something went wrong."); location.href = j.url; }
    catch (x) { err.textContent = x.message; go.disabled = false; go.textContent = "Make it a book"; }
  };
})();
