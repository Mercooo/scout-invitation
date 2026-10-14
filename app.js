/* Come Away — invitation behaviour. No dependencies.
   Edit text/details in config.js, not here. */
(() => {
  "use strict";

  const C = window.INVITE || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2; // easeInOutSine
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const body = document.body;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } },
  };

  /* ------------------------------------------------------------------
     1. Language (English / Arabic) + details from config.js
  ------------------------------------------------------------------- */
  const I = window.I18N || { en: {}, ar: {} };
  const EN = {};                       // English text, captured from the page itself
  $$("[data-i18n]").forEach((el) => { EN[el.dataset.i18n] = el.innerHTML; });
  $$("[data-i18n-ph]").forEach((el) => { EN[el.dataset.i18nPh] = el.getAttribute("placeholder"); });
  $$("[data-i18n-aria]").forEach((el) => { EN[el.dataset.i18nAria] = el.getAttribute("aria-label"); });
  $$("[data-bind]").forEach((el) => { EN["bind:" + el.dataset.bind] = el.textContent; });

  let lang = "en";
  const isAr = () => lang === "ar";
  function t(key, vars) {
    let s = isAr() && I.ar[key] !== undefined ? I.ar[key] : (I.en[key] !== undefined ? I.en[key] : EN[key]);
    if (typeof s === "function") return s(vars);
    if (vars && typeof vars === "object") s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ""));
    return s;
  }
  const cfg = (key) => (isAr() && C.ar && C.ar[key]) || C[key];

  const startDate = C.start ? new Date(C.start) : null;
  const endDate = C.end ? new Date(C.end) : null;

  function renderCountdown() {
    const el = $("#countdown");
    el.textContent = "";
    if (!startDate || isNaN(startDate)) return;
    const days = Math.ceil((startDate - Date.now()) / 864e5);
    if (days > 1) el.textContent = t("cd_days", days);
    else if (days === 1) el.textContent = t("cd_tomorrow");
    else if (days === 0) el.textContent = t("cd_tonight");
  }

  function applyLang(next, persist) {
    lang = next;
    root.lang = lang;
    root.dir = isAr() ? "rtl" : "ltr";
    if (persist) store.set("scout-lang", lang);
    $$("[data-i18n]").forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
    $$("[data-i18n-ph]").forEach((el) => el.setAttribute("placeholder", t(el.dataset.i18nPh)));
    $$("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    $$("[data-bind]").forEach((el) => {
      const v = cfg(el.dataset.bind);
      el.textContent = v || EN["bind:" + el.dataset.bind];
    });
    $$("[data-lang-toggle]").forEach((b) => {
      b.textContent = isAr() ? "English" : "عربي";
      b.setAttribute("lang", isAr() ? "en" : "ar");
    });
    document.title = t("doc_title", { title: cfg("title") || "Come Away" });
    renderCountdown();
    if (typeof syncSoundBtn === "function") syncSoundBtn();
    if (typeof syncSubmitLabel === "function") syncSubmitLabel();
    if (typeof refreshSuccess === "function") refreshSuccess();
    if (typeof clearErrors === "function") clearErrors();
  }

  if (C.mapsUrl) {
    const a = $("#mapLink");
    a.href = C.mapsUrl;
    a.hidden = false;
  }

  /* ------------------------------------------------------------------
     2. Sound — a real track if assets/music.mp3 exists, otherwise a
        soft ambient pad + distant bells synthesised right in the browser.
  ------------------------------------------------------------------- */
  const Sound = (() => {
    const MUSIC_FILE = "assets/music.mp3";
    const CHORDS = [ // D  ·  Bm  ·  G  ·  A  — warm, unresolved, hopeful
      [146.83, 220.0, 293.66, 369.99, 440.0],
      [123.47, 185.0, 246.94, 293.66, 369.99],
      [196.0, 246.94, 293.66, 369.99, 392.0],
      [220.0, 277.18, 329.63, 440.0, 554.37],
    ];
    const BELLS = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66];

    let ctx, master, padBus, filter, fxBus, fileEl, volTimer;
    let mode = null; // "file" | "synth"
    let on = false;
    let intensity = 0;
    let chordTimer, bellTimer, started = false;

    function impulse(seconds, decay) {
      const rate = ctx.sampleRate, len = rate * seconds;
      const buf = ctx.createBuffer(2, len, rate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    }

    function ensureCtx() {
      if (ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);

      const verb = ctx.createConvolver();
      verb.buffer = impulse(4.5, 2.4);
      const wet = ctx.createGain();
      wet.gain.value = 0.7;
      verb.connect(wet);
      wet.connect(master);

      filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 700;
      filter.Q.value = 0.4;
      padBus = ctx.createGain();
      padBus.connect(filter);
      filter.connect(master);
      filter.connect(verb);

      fxBus = ctx.createGain();
      fxBus.connect(master);
      fxBus.connect(verb);
      return ctx;
    }

    function voice(freq, t0, dur) {
      [["sine", -5, 0.034], ["triangle", 5, 0.014]].forEach(([type, detune, level]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        o.detune.value = detune;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(level, t0 + 5);
        g.gain.setValueAtTime(level, t0 + dur - 1);
        g.gain.linearRampToValueAtTime(0, t0 + dur + 5);
        o.connect(g);
        g.connect(padBus);
        o.start(t0);
        o.stop(t0 + dur + 5.5);
      });
    }

    function nextChord(i) {
      if (!ctx || mode !== "synth") return;
      const t0 = ctx.currentTime + 0.05;
      CHORDS[i % CHORDS.length].forEach((f) => voice(f, t0, 14));
      chordTimer = setTimeout(() => nextChord(i + 1), 12000);
    }

    function bell(freq, level = 0.05, when = 0) {
      const t0 = ctx.currentTime + when;
      [[1, level], [2.01, level * 0.25]].forEach(([mult, lv]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = freq * mult;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(lv, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.2);
        o.connect(g);
        g.connect(fxBus);
        o.start(t0);
        o.stop(t0 + 4.4);
      });
    }

    function scheduleBell() {
      bellTimer = setTimeout(() => {
        if (on && mode === "synth" && !document.hidden) bell(BELLS[Math.floor(Math.random() * BELLS.length)]);
        scheduleBell();
      }, 4500 + Math.random() * 6500);
    }

    function targetGain() { return on ? 0.55 + 0.45 * intensity : 0; }

    function applyLevels() {
      if (ctx && master) {
        const t = ctx.currentTime;
        master.gain.setTargetAtTime(targetGain(), t, 0.6);
        filter.frequency.setTargetAtTime(650 + 2300 * intensity, t, 0.5);
      }
      if (fileEl && mode === "file") tweenFile(on ? 0.25 + 0.6 * intensity : 0);
    }

    function tweenFile(target) {
      clearInterval(volTimer);
      volTimer = setInterval(() => {
        const d = target - fileEl.volume;
        if (Math.abs(d) < 0.01) {
          fileEl.volume = clamp(target);
          clearInterval(volTimer);
          if (target === 0 && !on) fileEl.pause();
          return;
        }
        fileEl.volume = clamp(fileEl.volume + d * 0.12);
      }, 50);
    }

    function startSynth() {
      if (!ensureCtx()) return;
      mode = "synth";
      nextChord(0);
      scheduleBell();
      applyLevels();
    }

    function start() {
      started = true;
      ensureCtx();
      if (ctx && ctx.state === "suspended") ctx.resume();
      // Try the real track first. If it isn't there, fall back to the synth.
      fileEl = new Audio(MUSIC_FILE);
      fileEl.loop = true;
      fileEl.volume = 0;
      fileEl.preload = "auto";
      const p = fileEl.play();
      if (p && p.then) {
        p.then(() => { mode = "file"; applyLevels(); }).catch(() => { fileEl = null; startSynth(); });
      } else {
        startSynth();
      }
    }

    return {
      get on() { return on; },
      set(v) {
        on = v;
        if (on) {
          if (!started) start();
          else {
            if (ctx && ctx.state === "suspended") ctx.resume();
            if (fileEl && mode === "file") fileEl.play().catch(() => {});
          }
        }
        applyLevels();
      },
      intensity(v) { intensity = clamp(v); if (on) applyLevels(); },
      hidden(h) {
        if (!started) return;
        if (h) { if (ctx && master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.1); if (fileEl) fileEl.pause(); }
        else if (on) { if (fileEl && mode === "file") fileEl.play().catch(() => {}); applyLevels(); }
      },
      knock() {
        if (!on || !ensureCtx()) return;
        const t0 = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(150, t0);
        o.frequency.exponentialRampToValueAtTime(55, t0 + 0.12);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
        o.connect(g);
        g.connect(fxBus);
        o.start(t0);
        o.stop(t0 + 0.25);
      },
      chime() {
        if (!on || !ensureCtx()) return;
        [587.33, 880, 1174.66, 1479.98].forEach((f, i) => bell(f, 0.07, i * 0.16));
      },
    };
  })();

  const soundBtn = $("#sound");
  function syncSoundBtn() {
    soundBtn.setAttribute("aria-pressed", String(Sound.on));
    soundBtn.setAttribute("aria-label", t(Sound.on ? "aria_on" : "aria_off"));
    $(".sound-label", soundBtn).textContent = t(Sound.on ? "music_on" : "music_off");
  }
  soundBtn.addEventListener("click", () => { Sound.set(!Sound.on); syncSoundBtn(); });
  document.addEventListener("visibilitychange", () => Sound.hidden(document.hidden));

  /* ------------------------------------------------------------------
     3. Gate
  ------------------------------------------------------------------- */
  const gate = $("#gate");
  function openGate(withSound) {
    if (withSound) Sound.set(true);
    syncSoundBtn();
    body.classList.remove("locked");
    body.classList.add("ready");
    gate.classList.add("gone");
    gate.setAttribute("aria-hidden", "true");
    gate.inert = true;
    window.scrollTo(0, 0);
    update();
  }
  $("#begin").addEventListener("click", () => openGate(true));
  $("#quiet").addEventListener("click", () => openGate(false));
  $("#begin").focus({ preventScroll: true });
  syncSoundBtn();

  /* ------------------------------------------------------------------
     4. Scroll-linked story
  ------------------------------------------------------------------- */
  const reach = $("#reach"), stage = $("#stage");
  const godEl = $("#handGod"), youEl = $("#handYou");
  const flare = $("#flare"), touch = $("#touch");
  const caps = $$(".cap").map((el) => ({ el, a: +el.dataset.a, b: +el.dataset.b }));
  let touched = false;

  function updateReach() {
    const r = reach.getBoundingClientRect();
    const g = clamp(-r.top / Math.max(1, r.height - innerHeight));
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const W = godEl.getBoundingClientRect().width, H = (W * 400) / 220;
    const e = ease(g);
    const meetY = sh * 0.36;
    const gap = Math.max(52, sh * 0.07);

    // Fingertips sit at x=80/220 (His) and x=140/220 (yours, rotated 180°) of the hand width.
    const godTop = lerp(-H, meetY - 0.8625 * H, e);
    const youTop = lerp(sh * 0.92, meetY + gap - 0.1375 * H, e);
    godEl.style.transform = `translate3d(${sw / 2 - (80 / 220) * W}px,${godTop}px,0)`;
    youEl.style.transform = `translate3d(${sw / 2 - (140 / 220) * W}px,${youTop}px,0) rotate(180deg)`;

    const midY = meetY + gap / 2;
    flare.style.top = touch.style.top = `${midY}px`;
    flare.style.setProperty("--fs", (0.45 + 0.7 * g).toFixed(3));
    flare.style.setProperty("--fo", (Math.pow(g, 2.2) * 0.95).toFixed(3));

    caps.forEach(({ el, a, b }) => el.classList.toggle("on", g >= a && g < b));

    if (g > 0.985 && !touched) { touched = true; touch.classList.add("on"); Sound.chime(); }
    else if (g < 0.9 && touched) { touched = false; touch.classList.remove("on"); }
    return g;
  }

  let ticking = false;
  function update() {
    ticking = false;
    const max = root.scrollHeight - innerHeight;
    const p = max > 0 ? clamp(scrollY / max) : 0;
    const g = updateReach();
    const lift = clamp(p / 0.3);
    const dawn = clamp(0.5 * g + 0.45 * p, 0, 0.88);
    root.style.setProperty("--p", p.toFixed(4));
    root.style.setProperty("--dawn", dawn.toFixed(3));
    root.style.setProperty("--beam", (0.1 + 0.25 * lift + 0.55 * g).toFixed(3));
    Sound.intensity(dawn / 0.88);
    skyState.dawn = dawn;
    if (reduceMotion) drawSky(0);
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => { resizeSky(); onScroll(); });

  /* Reveal-on-scroll */
  const door = $("#door");
  let knocked = false;
  function knock() {
    door.classList.remove("knocking");
    void door.offsetWidth;
    door.classList.add("knocking");
    [300, 850, 1400].forEach((ms) => setTimeout(() => {
      door.classList.remove("shake");
      void door.offsetWidth;
      door.classList.add("shake");
      Sound.knock();
    }, ms));
  }
  door.addEventListener("click", knock);
  door.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); knock(); } });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add("in");
      io.unobserve(en.target);
      if (en.target === door && !knocked) { knocked = true; setTimeout(knock, 900); }
    });
  }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" });
  $$(".reveal").forEach((el) => io.observe(el));

  /* ------------------------------------------------------------------
     5. Night sky: twinkling stars, drifting embers, the odd shooting star
  ------------------------------------------------------------------- */
  const cv = $("#stars"), cx = cv.getContext("2d");
  const skyState = { dawn: 0 };
  let sw = 0, sh = 0, stars = [], embers = [], shoot = null, nextShoot = 0;

  function resizeSky() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    sw = innerWidth; sh = innerHeight;
    cv.width = sw * dpr; cv.height = sh * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = clamp(Math.round((sw * sh) / 9000), 70, 230);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * sw, y: Math.random() * sh * 0.92,
      r: Math.random() * 1.3 + 0.3, ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 1.4,
    }));
    embers = Array.from({ length: sw < 600 ? 14 : 24 }, () => newEmber(true));
    if (reduceMotion) drawSky(0);
  }
  function newEmber(anywhere) {
    return {
      x: Math.random() * sw, y: anywhere ? Math.random() * sh : sh + 10,
      r: Math.random() * 1.6 + 0.6, vy: 6 + Math.random() * 14, ph: Math.random() * 6.28, sw: 8 + Math.random() * 18,
    };
  }
  let lastT = 0;
  function drawSky(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    const fade = 1 - skyState.dawn * 1.05;
    cx.clearRect(0, 0, sw, sh);
    if (fade > 0.02) {
      cx.fillStyle = "#fff";
      for (const s of stars) {
        const a = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 1000 * s.sp + s.ph))) * fade;
        cx.globalAlpha = a;
        cx.beginPath(); cx.arc(s.x, s.y, s.r, 0, 6.283); cx.fill();
      }
    }
    if (!reduceMotion) {
      for (const e of embers) {
        e.y -= e.vy * dt;
        const x = e.x + Math.sin(t / 1000 + e.ph) * e.sw;
        if (e.y < -10) Object.assign(e, newEmber(false));
        const a = clamp(Math.min(1, (sh - e.y) / 120)) * clamp(e.y / 160) * 0.7;
        cx.globalAlpha = a;
        cx.fillStyle = "#ffc978";
        cx.shadowColor = "#ffb45c"; cx.shadowBlur = 8;
        cx.beginPath(); cx.arc(x, e.y, e.r, 0, 6.283); cx.fill();
        cx.shadowBlur = 0;
      }
      if (fade > 0.3) {
        if (!shoot && t > nextShoot) {
          shoot = { x: Math.random() * sw * 0.7, y: Math.random() * sh * 0.3, life: 0 };
          nextShoot = t + 9000 + Math.random() * 9000;
        }
        if (shoot) {
          shoot.life += dt;
          const k = shoot.life / 0.9;
          const x = shoot.x + k * 260, y = shoot.y + k * 120;
          const g = cx.createLinearGradient(x, y, x - 90, y - 42);
          g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(1, "rgba(255,255,255,0)");
          cx.globalAlpha = (1 - k) * fade;
          cx.strokeStyle = g; cx.lineWidth = 1.5;
          cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x - 90, y - 42); cx.stroke();
          if (k >= 1) shoot = null;
        }
      }
    }
    cx.globalAlpha = 1;
    if (!reduceMotion) requestAnimationFrame(drawSky);
  }
  resizeSky();
  if (!reduceMotion) { nextShoot = 6000; requestAnimationFrame(drawSky); }

  /* ------------------------------------------------------------------
     6. RSVP
  ------------------------------------------------------------------- */
  const form = $("#rsvp-form"), card = $("#rsvpCard"), success = $("#success");
  const submitBtn = $("#submitBtn"), formError = $("#formError");
  const ANSWER_KEY = { yes: "a_yes", maybe: "a_maybe", no: "a_no" };

  const attending = () => form.elements.attending.value;
  function syncSubmitLabel() {
    $("span", submitBtn).textContent = t(attending() === "yes" ? "submit_yes" : "submit_other");
  }
  $$('input[name="attending"]').forEach((r) => r.addEventListener("change", syncSubmitLabel));

  function fieldError(name, msg) {
    const input = form.elements[name];
    input.closest(".field").classList.toggle("bad", !!msg);
    $(`.err[data-for="${name}"]`).textContent = msg || "";
    input.setAttribute("aria-invalid", msg ? "true" : "false");
  }
  ["name", "phone"].forEach((n) => form.elements[n].addEventListener("input", () => fieldError(n, "")));

  function validate() {
    let ok = true, firstBad = null;
    const name = form.elements.name.value.trim();
    const digits = form.elements.phone.value.replace(/\D/g, "");
    if (name.length < 2) { fieldError("name", t("err_name")); ok = false; firstBad = firstBad || "name"; } else fieldError("name", "");
    if (attending() !== "no" && digits.length < 7) { fieldError("phone", t("err_phone")); ok = false; firstBad = firstBad || "phone"; } else fieldError("phone", "");
    if (firstBad) form.elements[firstBad].focus();
    return ok;
  }

  function collect() {
    const f = form.elements;
    return {
      attending: attending(),
      name: f.name.value.trim(),
      phone: f.phone.value.trim(),
      group: f.group.value.trim(),
      age: f.age.value,
      note: f.note.value.trim(),
      event: `${C.title || "Event"} (${C.start || ""})`,
      lang,
      submittedAt: new Date().toISOString(),
    };
  }

  function plain(key) { const d = document.createElement("div"); d.innerHTML = t(key); return d.textContent; }

  function waLink(d) {
    const num = String(C.whatsapp || "").replace(/\D/g, "");
    if (!num) return "";
    const org = cfg("organizer");
    const vars = { org: org && !/^\[/.test(org) ? org : "", title: cfg("title") || "", answer: plain(ANSWER_KEY[d.attending]) };
    const lines = [
      t(vars.org ? "wa_hi" : "wa_hi_anon", vars),
      t("wa_name", { v: d.name }),
      d.phone && t("wa_phone", { v: d.phone }),
      d.group && t("wa_group", { v: d.group }),
      d.note && t("wa_note_l", { v: d.note }),
    ].filter(Boolean);
    return `https://wa.me/${num}?text=${encodeURIComponent(lines.join("\n"))}`;
  }

  function burst() {
    const box = $("#sparks");
    box.textContent = "";
    for (let i = 0; i < 22; i++) {
      const s = document.createElement("i");
      const ang = (Math.PI * 2 * i) / 22 + Math.random() * 0.4;
      const dist = 70 + Math.random() * 70;
      s.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
      s.style.setProperty("--dy", `${Math.sin(ang) * dist}px`);
      s.style.setProperty("--sd", `${0.35 + Math.random() * 0.35}s`);
      box.appendChild(s);
    }
  }

  let shown = null; // the RSVP currently displayed in the success panel
  function refreshSuccess() { if (shown && !success.hidden) showSuccess(shown, false); }
  function clearErrors() { fieldError("name", ""); fieldError("phone", ""); formError.hidden = true; }

  function showSuccess(d, fresh) {
    shown = d;
    const first = d.name.split(/\s+/)[0];
    $("#successTitle").textContent = t(`ok_${d.attending}_t`, { first });
    $("#successText").textContent = t(`ok_${d.attending}_p`);
    $(".badge-wrap").hidden = d.attending === "no";
    $("#calBtn").hidden = d.attending === "no";

    const wa = waLink(d);
    const wb = $("#waBtn");
    wb.hidden = !wa;
    if (wa) {
      wb.href = wa;
      wb.textContent = t(C.rsvpEndpoint ? "wa_btn_also" : "wa_btn_main");
      wb.className = C.rsvpEndpoint ? "btn btn-ghost" : "btn btn-gold";
    }
    const note = $("#successNote");
    note.hidden = !(wa && !C.rsvpEndpoint);
    note.textContent = t("wa_note");
    $("#demoNote").hidden = !!(C.rsvpEndpoint || C.whatsapp);

    form.hidden = true;
    success.hidden = false;
    if (d.attending !== "no" && fresh) { burst(); Sound.chime(); }
    if (fresh) card.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formError.hidden = true;
    if (form.elements.website.value) return; // honeypot
    if (!validate()) return;

    const data = collect();
    submitBtn.disabled = true;
    submitBtn.classList.add("loading");
    try {
      if (C.rsvpEndpoint) {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 15000);
        // no-cors: works with Google Apps Script / Formspree style endpoints; we can't read the reply.
        await fetch(C.rsvpEndpoint, { method: "POST", mode: "no-cors", body: new URLSearchParams(data), signal: ctl.signal });
        clearTimeout(timer);
      } else if (!C.whatsapp) {
        console.warn("[invitation] No rsvpEndpoint or whatsapp set in config.js — this RSVP was not sent anywhere.", data);
      }
      store.set("scout-rsvp", JSON.stringify(data));
      showSuccess(data, true);
    } catch (err) {
      formError.textContent = t("send_fail") + (C.whatsapp ? t("send_fail_wa") : "");
      formError.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("loading");
    }
  });

  $("#editBtn").addEventListener("click", () => {
    success.hidden = true;
    form.hidden = false;
    form.elements.name.focus({ preventScroll: true });
  });

  // Add to calendar (.ics)
  $("#calBtn").addEventListener("click", () => {
    if (!startDate || isNaN(startDate)) return;
    const f = (d) => {
      const z = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}T${z(d.getHours())}${z(d.getMinutes())}00`;
    };
    const esc = (s) => String(s || "").replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
    const end = endDate && !isNaN(endDate) ? endDate : new Date(startDate.getTime() + 3 * 36e5);
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Come Away//EN", "BEGIN:VEVENT",
      `UID:${f(startDate)}-comeaway@invitation`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d{3}/g, "")}`,
      `DTSTART:${f(startDate)}`, `DTEND:${f(end)}`,
      `SUMMARY:${esc(t("ics_summary", { title: cfg("title") || "Retreat" }))}`,
      `LOCATION:${esc([cfg("whereName"), cfg("whereDetail")].filter(Boolean).join(", "))}`,
      `DESCRIPTION:${esc(cfg("tagline"))}`,
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "come-away.ics" });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  // Returning visitor: remember their answer
  try {
    const prev = JSON.parse(store.get("scout-rsvp") || "null");
    if (prev && prev.name) {
      const f = form.elements;
      f.name.value = prev.name; f.phone.value = prev.phone || ""; f.group.value = prev.group || "";
      f.age.value = prev.age || ""; f.note.value = prev.note || "";
      const radio = $(`input[name="attending"][value="${prev.attending}"]`);
      if (radio) radio.checked = true;
      syncSubmitLabel();
      showSuccess(prev, false);
    }
  } catch (_) { /* ignore corrupt storage */ }

  /* Language toggle + initial language: ?lang=ar  →  saved choice  →  browser language */
  $$("[data-lang-toggle]").forEach((b) => b.addEventListener("click", () => { applyLang(isAr() ? "en" : "ar", true); onScroll(); }));
  const q = new URLSearchParams(location.search).get("lang");
  const saved = store.get("scout-lang");
  const first = q === "ar" || q === "en" ? q : saved || ((navigator.language || "").toLowerCase().startsWith("ar") ? "ar" : "en");
  applyLang(first, !!q);

  update();
})();
