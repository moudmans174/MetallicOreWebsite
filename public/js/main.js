/* Site interactions – started by content.js once content has loaded */
window.initMain = function (site) {
  const WHATSAPP = String(site.company?.whatsapp || "").replace(/\D/g, "");
  const OFFICE = { lat: Number(site.location?.lat), lng: Number(site.location?.lng) };

  /* Sticky nav */
  const nav = document.getElementById("nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 40);
  onScroll(); window.addEventListener("scroll", onScroll, { passive: true });

  /* Mobile menu */
  const toggle = document.getElementById("navToggle"), links = document.getElementById("navLinks");
  toggle.addEventListener("click", () => { toggle.classList.toggle("open"); links.classList.toggle("open"); });
  links.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => { toggle.classList.remove("open"); links.classList.remove("open"); }));

  /* Scroll reveal + counters */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      e.target.querySelectorAll("[data-count]").forEach(countUp);
      io.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  window.observeReveals = () => document.querySelectorAll(".reveal:not(.in)").forEach((el, i) => { el.style.transitionDelay = (i % 4) * 0.08 + "s"; io.observe(el); });
  window.observeReveals();
  function countUp(el) {
    const end = +el.dataset.count, suf = el.dataset.suffix || ""; let start = null;
    const step = (t) => { if (!start) start = t; const p = Math.min((t - start) / 1600, 1);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + suf; if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* Gold dust sparkles */
  const cv = document.getElementById("sparkles"), ctx = cv.getContext("2d");
  let W, H; const parts = [];
  const resize = () => { W = cv.width = cv.offsetWidth; H = cv.height = cv.offsetHeight; };
  resize(); window.addEventListener("resize", resize);
  const newPart = (init) => ({ x: Math.random() * W, y: init ? Math.random() * H : H + 10, r: Math.random() * 2.2 + 0.4, vy: -(Math.random() * 0.5 + 0.15), vx: (Math.random() - 0.5) * 0.3, a: Math.random() * 6.28 });
  for (let i = 0; i < (window.innerWidth < 600 ? 40 : 90); i++) parts.push(newPart(true));
  (function loop() {
    ctx.clearRect(0, 0, W, H);
    parts.forEach((p, i) => {
      p.x += p.vx; p.y += p.vy; p.a += 0.04;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      g.addColorStop(0, `rgba(255,230,150,${0.35 + Math.sin(p.a) * 0.35})`); g.addColorStop(1, "rgba(242,193,78,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, 6.28); ctx.fill();
      if (p.y < -10) parts[i] = newPart(false);
    });
    requestAnimationFrame(loop);
  })();

  /* Gold calculator */
  const w = document.getElementById("calcWeight"), u = document.getElementById("calcUnit"), pu = document.getElementById("calcPurity"), out = document.getElementById("calcOut");
  function calc() {
    const oz = Prices.goldOz(); if (!oz) { out.textContent = "—"; return; }
    const grams = (+w.value || 0) * (u.value === "kg" ? 1000 : u.value === "oz" ? OZ_IN_G : 1);
    out.textContent = "$" + ((grams / OZ_IN_G) * oz * +pu.value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  [w, u, pu].forEach((el) => el.addEventListener("input", calc));
  document.getElementById("calc").addEventListener("submit", (e) => e.preventDefault());
  Prices.onUpdate(calc); calc();

  /* TradingView gold chart */
  function buildChart() {
    if (site.prices?.showChart === false) return;
    const light = document.documentElement.getAttribute("data-theme") === "light";
    const tv = document.getElementById("tvChart"); tv.innerHTML = "";
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"; s.async = true;
    s.innerHTML = JSON.stringify({ autosize: true, symbol: "OANDA:XAUUSD", interval: "60", timezone: "Africa/Abidjan", theme: light ? "light" : "dark", style: "1", locale: { zh: "zh_CN", ar: "ar_AE", fr: "fr" }[window.LANG] || "en",
      backgroundColor: light ? "rgba(255,255,255,1)" : "rgba(5,15,36,1)", hide_side_toolbar: true, allow_symbol_change: true, support_host: "https://www.tradingview.com" });
    const inner = document.createElement("div"); inner.className = "tradingview-widget-container__widget"; inner.style.height = "100%";
    tv.appendChild(inner); tv.appendChild(s);
  }
  buildChart();
  document.addEventListener("themechange", buildChart);

  /* Distance to office */
  document.getElementById("locateMe").addEventListener("click", () => {
    const o = document.getElementById("distanceOut");
    if (!navigator.geolocation || !OFFICE.lat) { o.textContent = t("loc.unavailable"); return; }
    o.textContent = t("loc.finding");
    navigator.geolocation.getCurrentPosition((pos) => {
      const R = 6371, r = Math.PI / 180, a = pos.coords.latitude, b = pos.coords.longitude;
      const x = Math.sin(((OFFICE.lat - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(OFFICE.lat * r) * Math.sin(((OFFICE.lng - b) * r) / 2) ** 2;
      const km = 2 * R * Math.asin(Math.sqrt(x));
      o.textContent = t("loc.result", { km: km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString() });
    }, () => { o.textContent = t("loc.failed"); });
  });

  /* Quote form → saved to admin panel + WhatsApp */
  const form = document.getElementById("quoteForm"), status = document.getElementById("formStatus");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    data.lang = window.LANG;
    const btn = form.querySelector("button"); btn.disabled = true; status.textContent = t("form.sending");
    try {
      const r = await fetch("/api/inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || t("form.error"));
      status.textContent = t("form.thanks");
      if (WHATSAPP) {
        const msg = `Hello ${site.company?.name || ""},\n\nName: ${data.name}\nCountry: ${data.country || "-"}\nProduct: ${data.product}\nQuantity: ${data.qty || "-"}\n\n${data.message || ""}`;
        window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, "_blank");
      }
      form.reset();
    } catch (err) { status.textContent = err.message && !/fetch/i.test(err.message) ? err.message : t("form.error"); }
    finally { btn.disabled = false; }
  });
};
