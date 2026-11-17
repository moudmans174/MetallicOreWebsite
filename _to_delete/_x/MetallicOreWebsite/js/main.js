/* Metallic Ore Limited – site interactions */
const WHATSAPP = "23277460171";
const OFFICE = { lat: 8.4745, lng: -13.2595 }; // Wilkinson Road, Freetown (approx.)

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("year").textContent = new Date().getFullYear();

  /* Sticky nav */
  const nav = document.getElementById("nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 40);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

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
  document.querySelectorAll(".reveal").forEach((el, i) => { el.style.transitionDelay = (i % 4) * 0.08 + "s"; io.observe(el); });

  function countUp(el) {
    const end = +el.dataset.count, suf = el.dataset.suffix || "";
    let start = null;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min((t - start) / 1600, 1);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + suf;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* Gold dust sparkles over the hero video */
  const cv = document.getElementById("sparkles"), ctx = cv.getContext("2d");
  let W, H, parts = [];
  const resize = () => { W = cv.width = cv.offsetWidth; H = cv.height = cv.offsetHeight; };
  resize(); window.addEventListener("resize", resize);
  const N = window.innerWidth < 600 ? 40 : 90;
  for (let i = 0; i < N; i++) parts.push(newPart(true));
  function newPart(init) {
    return { x: Math.random() * W, y: init ? Math.random() * H : H + 10, r: Math.random() * 2.2 + 0.4,
      vy: -(Math.random() * 0.5 + 0.15), vx: (Math.random() - 0.5) * 0.3, a: Math.random() * Math.PI * 2 };
  }
  (function loop() {
    ctx.clearRect(0, 0, W, H);
    parts.forEach((p, i) => {
      p.x += p.vx; p.y += p.vy; p.a += 0.04;
      const alpha = 0.35 + Math.sin(p.a) * 0.35;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      g.addColorStop(0, `rgba(255,230,150,${alpha})`); g.addColorStop(1, "rgba(242,193,78,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2); ctx.fill();
      if (p.y < -10) parts[i] = newPart(false);
    });
    requestAnimationFrame(loop);
  })();

  /* Gold calculator */
  const w = document.getElementById("calcWeight"), u = document.getElementById("calcUnit"),
        pu = document.getElementById("calcPurity"), out = document.getElementById("calcOut");
  function calc() {
    const oz = Prices.goldOz();
    if (!oz) { out.textContent = "—"; return; }
    const grams = (+w.value || 0) * (u.value === "kg" ? 1000 : u.value === "oz" ? OZ_IN_G : 1);
    const val = (grams / OZ_IN_G) * oz * (+pu.value);
    out.textContent = "$" + val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  [w, u, pu].forEach((el) => el.addEventListener("input", calc));
  document.getElementById("calc").addEventListener("submit", (e) => e.preventDefault());
  Prices.onUpdate(calc);

  /* TradingView live gold chart (loads only when hosted online) */
  const tv = document.getElementById("tvChart");
  const s = document.createElement("script");
  s.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
  s.async = true;
  s.innerHTML = JSON.stringify({
    autosize: true, symbol: "OANDA:XAUUSD", interval: "60", timezone: "Africa/Abidjan",
    theme: "dark", style: "1", locale: "en", backgroundColor: "rgba(5,15,36,1)",
    hide_side_toolbar: true, allow_symbol_change: true, support_host: "https://www.tradingview.com",
  });
  const inner = document.createElement("div"); inner.className = "tradingview-widget-container__widget"; inner.style.height = "100%";
  tv.appendChild(inner); tv.appendChild(s);

  /* Distance from visitor to office */
  document.getElementById("locateMe").addEventListener("click", () => {
    const outEl = document.getElementById("distanceOut");
    if (!navigator.geolocation) { outEl.textContent = "Location is not available in this browser."; return; }
    outEl.textContent = "Finding your location…";
    navigator.geolocation.getCurrentPosition((pos) => {
      const km = haversine(pos.coords.latitude, pos.coords.longitude, OFFICE.lat, OFFICE.lng);
      outEl.textContent = `You are about ${km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString()} km from our office.`;
    }, () => { outEl.textContent = "We couldn't get your location. Use “Get Directions” instead."; });
  });
  function haversine(a, b, c, d) {
    const R = 6371, toR = Math.PI / 180, dLat = (c - a) * toR, dLon = (d - b) * toR;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * toR) * Math.cos(c * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  /* Quote form -> WhatsApp */
  document.getElementById("quoteForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const msg = `Hello Metallic Ore Limited,\n\nName: ${f.get("name")}\nCountry: ${f.get("country") || "-"}\nProduct: ${f.get("product")}\nQuantity: ${f.get("qty") || "-"}\n\n${f.get("message") || ""}`;
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, "_blank");
  });
});
