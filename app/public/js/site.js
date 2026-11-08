(() => {
  const f = document.getElementById("orderForm"); if (!f) return;
  const steps = [...f.querySelectorAll("fieldset[data-step]")], bars = [...f.querySelectorAll(".stepper i")];
  const next = f.querySelector("#next"), back = f.querySelector("#back"), submit = f.querySelector("#submit"), err = f.querySelector("#formErr");
  let at = 0; const pron = { v: "they" };
  f.querySelectorAll('.chips[data-name="pronoun"] button').forEach((b) => b.onclick = () => { f.querySelectorAll('.chips[data-name="pronoun"] button').forEach((x) => x.classList.remove("on")); b.classList.add("on"); pron.v = b.dataset.v; });
  f.querySelectorAll("#occChips button").forEach((b) => b.onclick = () => { f.querySelector("#occasion").value = b.textContent; f.querySelectorAll("#occChips button").forEach((x) => x.classList.toggle("on", x === b)); });
  function show(i) { at = i; steps.forEach((s, k) => (s.hidden = k !== i)); bars.forEach((b, k) => b.classList.toggle("on", k <= i)); back.hidden = i === 0; next.hidden = i === steps.length - 1; submit.hidden = i !== steps.length - 1; err.textContent = ""; const first = steps[i].querySelector("input,textarea,select"); if (first && i) first.focus({ preventScroll: true }); }
  function check(i) {
    if (i === 0 && !f.child_name.value.trim()) { err.textContent = "Add the child's first name."; f.child_name.focus(); return false; }
    if (i === 2) { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.buyer_email.value.trim())) { err.textContent = "Add the email the book should go to."; f.buyer_email.focus(); return false; }
      if (f.read_to_phone.value.trim() && !f.read_consent.checked) { err.textContent = "Tick the box to confirm they're expecting an AI storyteller's call."; return false; } }
    return true;
  }
  next.onclick = () => { if (check(at)) show(at + 1); };
  back.onclick = () => show(at - 1);
  f.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.tagName === "INPUT" && at < steps.length - 1) { e.preventDefault(); next.click(); } });
  f.onsubmit = async (e) => {
    e.preventDefault(); for (let i = 0; i < steps.length; i++) if (!check(i)) { show(i); check(i); return; }
    submit.disabled = true; submit.innerHTML = '<span class="spin"></span> Sending it to the office…';
    const d = Object.fromEntries(new FormData(f).entries()); d.pronoun = pron.v; d.read_consent = !!f.read_consent.checked; d.subscribe = !!f.subscribe.checked; if (f.dataset.from) d.from = f.dataset.from;
    try { const r = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(d) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Something went wrong."); location.href = j.url; }
    catch (x) { err.textContent = x.message; submit.disabled = false; submit.textContent = "Try again"; }
  };
  if (location.search.includes("cancelled")) toast("Checkout was cancelled. Nothing was charged.");
  const sf = document.getElementById("subForm"); if (sf) sf.onsubmit = async (e) => { e.preventDefault(); const r = await fetch("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: sf.email.value }) }); const j = await r.json(); toast(r.ok ? "Subscribed. Tonight's book will find you." : j.error); if (r.ok) sf.reset(); };
})();
