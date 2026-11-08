// Nightlight Press showcase: staff grid + live office feed. Plain JS, no build step.
(function () {
  "use strict";
  var API = "https://nightlight-press-z5ept2z3by3j.vercel.app";

  var STAFF = [
    ["✒️", "The Author", "Writes a new story for each child, in their language", "Naïve agent", "#B9A6FF"],
    ["🔎", "The Editor", "Counts every word, checks reading level and the child's name on each page", "Code", "#5EE6A8"],
    ["🎨", "The Illustrator", "Paints the cover and every page in the style you pick", "Monid · image model", "#FF8A6B"],
    ["🎙️", "The Narrator", "Records a gentle read-aloud for each page", "Naïve speech", "#FFD36E"],
    ["📚", "The Binder", "Typesets and binds a print-ready PDF", "Code · PDFKit", "#6FC3FF"],
    ["✉️", "The Mailroom", "Emails the book with the PDF attached and texts the link", "AgentMail · Monid SMS", "#FF8FC4"],
    ["☎️", "The Storyteller Line", "Phones Grandma and reads her the book, introducing itself as an AI", "Monid phone line", "#FFB13B"],
    ["💬", "The Front Desk", "Reads replies, answers questions and sends changes back to production", "Naïve agent · AgentMail", "#9BF06B"],
    ["📱", "The Proofreader", "Opens each finished book on a real phone to check it", "Mobilerun", "#4FE3D3"],
    ["📣", "Marketing", "Commissions a new free book for the shelf every night", "Naïve agent", "#FF6FAE"],
    ["💳", "The Cashier", "Takes the $19 through Stripe Checkout. Agents never touch money", "Code · Stripe", "#A99BFF"],
    ["⏰", "The Night Manager", "Wakes the office every five minutes and keeps the queue moving", "Naïve scheduled agent", "#FFE08A"]
  ];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var grid = document.getElementById("staffGrid");
  if (grid) {
    STAFF.forEach(function (s) {
      var card = el("div", "member glass tile");
      card.style.setProperty("--c", s[4]);
      var av = el("div", "av", s[0]);
      av.setAttribute("aria-hidden", "true");
      card.appendChild(av);
      card.appendChild(el("b", null, s[1]));
      card.appendChild(el("p", null, s[2]));
      card.appendChild(el("span", "tag", s[3]));
      grid.appendChild(card);
    });
  }

  // ---- live panel ----
  var eventsEl = document.getElementById("events");
  if (!eventsEl) return;
  var updated = document.getElementById("updated");
  var dots = ["liveDot", "feedDot", "heroDot"].map(function (id) { return document.getElementById(id); });
  var heroLive = document.getElementById("heroLive");
  var clockLine = document.getElementById("clockLine");
  var lastSeq = null;

  function pageLabel(p) { return p === "cover" ? "the cover" : "page " + p; }
  // Short, privacy-safe one-liners. Free text from the ledger (notes, emails) is never shown.
  var KINDS = {
    commission: function (d) { return ["🧾", "The Cashier", d.kind === "catalog" ? "opened a new shelf book" : "took a new order"]; },
    commission_shelf: function () { return ["📣", "Marketing", "commissioned tonight's free book"]; },
    story: function (d) { return ["✒️", "The Author", d.revised ? "revised a manuscript" : "finished a " + (d.pages || 10) + "-page story"]; },
    edit_check: function (d) { return ["🔎", "The Editor", d.pass ? "approved the draft" + (d.words ? " (" + d.words + " words)" : "") : "sent a draft back"]; },
    paint: function (d) { return ["🎨", "The Illustrator", "painted " + pageLabel(d.page)]; },
    narrate: function (d) { return ["🎙️", "The Narrator", "recorded " + pageLabel(d.page)]; },
    bind: function (d) { return ["📚", "The Binder", "bound a book" + (d.minutes_since_order != null ? ", " + Math.round(d.minutes_since_order) + " min after the order" : "")]; },
    deliver: function (d) { return ["✉️", "The Mailroom", d.revised ? "emailed a revised book" : "emailed a finished book"]; },
    sms: function () { return ["💬", "The Mailroom", "texted the book link"]; },
    call: function () { return ["☎️", "The Storyteller Line", "read a book over the phone"]; },
    frontdesk: function () { return ["💬", "The Front Desk", "answered a family's email"]; },
    publish: function () { return ["📣", "Marketing", "put a new book on the free shelf"]; },
    proofread: function () { return ["📱", "The Proofreader", "checked a book on a real phone"]; },
    proof: function () { return ["📱", "The Proofreader", "checked a book on a real phone"]; },
    agent_start: function (d, e) { var w = String(e.actor || "").replace(/^(agent|code):/, ""); return ["🌙", w ? w.charAt(0).toUpperCase() + w.slice(1) : "A desk", "started a shift"]; },
    note: function () { return ["🗒️", "The CEO", "left a note on the board"]; },
    tick: function () { return ["⏰", "The Night Manager", "woke the office"]; }
  };
  function describe(e) {
    var d = e.detail || {};
    var f = KINDS[e.kind];
    if (f) return f(d, e);
    var who = String(e.actor || "office").replace(/^(agent|code):/, "");
    who = who.charAt(0).toUpperCase() + who.slice(1);
    return ["✨", who, String(e.kind || "worked").replace(/_/g, " ")];
  }
  function ago(iso) {
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (!isFinite(s)) return "";
    if (s < 60) return Math.round(s) + "s ago";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    return Math.round(s / 86400) + " d ago";
  }
  function setOnline(on) {
    dots.forEach(function (d) { if (d) d.classList.toggle("off", !on); });
  }
  function setK(k, v) {
    var n = document.querySelector('[data-k="' + k + '"]');
    if (n && v != null && n.textContent !== String(v)) n.textContent = v;
  }

  function renderEvents(list) {
    if (!Array.isArray(list) || !list.length) {
      if (!eventsEl.children.length) eventsEl.appendChild(el("li", "msg", "The office is quiet right now. Desks wake every five minutes."));
      return;
    }
    var sorted = list.slice().sort(function (a, b) { return Number(b.seq) - Number(a.seq); }).slice(0, 14);
    var top = sorted[0] && sorted[0].seq;
    if (top === lastSeq) { // refresh the relative times only
      Array.prototype.forEach.call(eventsEl.querySelectorAll("time"), function (t) { t.textContent = ago(t.getAttribute("datetime")); });
      return;
    }
    lastSeq = top;
    eventsEl.textContent = "";
    sorted.forEach(function (e) {
      var x = describe(e);
      var li = el("li");
      li.appendChild(el("span", "e", x[0]));
      var txt = el("span");
      txt.appendChild(el("strong", null, x[1]));
      txt.appendChild(document.createTextNode(" " + x[2]));
      li.appendChild(txt);
      var t = el("time", null, ago(e.created_at));
      t.setAttribute("datetime", e.created_at || "");
      li.appendChild(t);
      eventsEl.appendChild(li);
    });
  }

  function getJSON(path) {
    var ctl = "AbortController" in window ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
    return fetch(API + path, { cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(to); if (!r.ok) throw new Error(r.status); return r.json(); });
  }

  var everLive = false;
  function tick() {
    Promise.allSettled([getJSON("/api/board"), getJSON("/api/office")]).then(function (res) {
      var board = res[0].status === "fulfilled" ? res[0].value : null;
      var office = res[1].status === "fulfilled" ? res[1].value : null;
      var ok = !!(board || office);
      if (ok) everLive = true;
      var snap = window.NL_SNAPSHOT;
      if (!ok && !everLive && snap) { // live API unreachable (offline or blocked): show the last-known snapshot, clearly labelled
        board = snap.board; office = snap.office;
      }
      setOnline(ok);
      if (board && board.stats) {
        var s = board.stats, c = board.costs || {};
        ["orders", "delivered", "ready", "shelf", "painted", "narrated", "subscribers"].forEach(function (k) { setK(k, s[k] != null ? s[k] : 0); });
        if (c.per_book_usd != null) setK("per_book", "$" + Number(c.per_book_usd).toFixed(2));
        var runs = (board.agents || []).reduce(function (a, g) { return a + (Number(g.runs) || 0); }, 0);
        setK("agents", runs);
        if (heroLive) heroLive.textContent = (ok ? "Live: " : "") + (s.ready || 0) + " books made · " + (s.painted || 0) + " pages painted";
      }
      if (office) {
        renderEvents(office.events);
        if (office.clock && office.clock.at && clockLine) clockLine.textContent = "Night Manager last woke the office " + ago(office.clock.at) + ".";
      } else if (board && board.ledger) {
        renderEvents(board.ledger);
      }
      var fmt = { hour: "numeric", minute: "2-digit" };
      if (updated) updated.textContent = ok ? "updated " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })
        : (!everLive && snap) ? "snapshot " + new Date(snap.at).toLocaleTimeString([], fmt) + " · reconnecting" : "offline, retrying";
      if (!ok && !everLive && snap && clockLine) clockLine.textContent = "Showing the last snapshot. The live feed reconnects by itself.";
      if (!ok && !eventsEl.children.length) eventsEl.appendChild(el("li", "msg", "Can't reach the live office right now. Retrying every five seconds."));
    });
  }
  tick();
  setInterval(function () { if (!document.hidden) tick(); }, 5000);
})();
