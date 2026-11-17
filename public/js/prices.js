/* =========================================================
   World market prices
   - LIVE gold, silver, platinum, palladium from the free gold-api.com
     feed (refreshes every 60 s).
   - Diamonds, rutile & industrial minerals: indicative prices set
     in the ADMIN PANEL → Market Prices.
   ========================================================= */
const OZ_IN_G = 31.1034768;

const Prices = {
  unit: "oz", data: {}, listeners: [], metals: [],
  onUpdate(fn) { this.listeners.push(fn); },
  goldOz() { return this.data.XAU ? this.data.XAU.price : null; },
};

const fmt = (n, d = 2) => n == null || isNaN(n) ? "—" : "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const escP = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function convert(p, u) { if (p == null) return null; if (u === "g") return p / OZ_IN_G; if (u === "kg") return (p / OZ_IN_G) * 1000; return p; }
const unitLabel = (u) => ({ oz: "USD / troy oz", g: "USD / gram", kg: "USD / kg" }[u]);

async function fetchJSON(url) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
  try { const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" }); if (!r.ok) throw new Error(r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
async function fetchMetal(sym) {
  try { const j = await fetchJSON(`https://api.gold-api.com/price/${sym}`); if (typeof j.price === "number") return j.price; } catch (e) {}
  if (sym === "XAU") { try { const j = await fetchJSON("https://xaus.com/api/v1/spot"); if (j.spot_usd_oz) return Number(j.spot_usd_oz); } catch (e) {} }
  return null;
}

async function refreshPrices(live) {
  const results = live ? await Promise.all(Prices.metals.map((m) => fetchMetal(m.sym))) : Prices.metals.map(() => null);
  Prices.metals.forEach((m, i) => {
    const p = results[i];
    const d = Prices.data[m.sym] || { history: [], prev: null, price: null };
    if (p != null) {
      d.prev = d.price; d.price = p; d.live = true; d.history.push(p);
      if (d.history.length > 40) d.history.shift();
      if (d.first == null) d.first = p;
    } else if (d.price == null && m.fallback) { d.price = m.fallback; d.live = false; d.first = m.fallback; }
    d.updated = new Date(); Prices.data[m.sym] = d;
  });
  Prices.listeners.forEach((fn) => fn());
}

function sparkline(h) {
  if (!h || h.length < 2) return '<svg viewBox="0 0 100 30"><line x1="0" y1="15" x2="100" y2="15" stroke="rgba(242,193,78,.35)" stroke-dasharray="3 3"/></svg>';
  const min = Math.min(...h), max = Math.max(...h), r = max - min || 1;
  const pts = h.map((v, i) => `${(i / (h.length - 1)) * 100},${28 - ((v - min) / r) * 26}`).join(" ");
  return `<svg viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${h[h.length - 1] >= h[0] ? "#2ecc71" : "#ff5d5d"}" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>`;
}
function changeHTML(d) {
  if (!d || !d.live || d.first == null) return '<span class="muted">' + (d && d.price ? "reference price · live feed offline" : "connecting…") + "</span>";
  const pct = ((d.price - d.first) / d.first) * 100;
  return `<span class="${pct >= 0 ? "up" : "down"}">${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(2)}%</span> <span class="muted">since you opened the page</span>`;
}

function renderGrid() {
  const grid = document.getElementById("metalGrid");
  grid.innerHTML = Prices.metals.map((m) => {
    const d = Prices.data[m.sym] || {}; const val = convert(d.price, Prices.unit);
    const flash = d.prev != null && d.price !== d.prev ? (d.price > d.prev ? "flash-up" : "flash-down") : "";
    return `<div class="metal ${m.sym === "XAU" ? "gold-card" : ""}">
      <div class="metal__top"><span class="metal__name">${m.name}</span><span class="metal__sym">${m.sym}/USD</span></div>
      <div class="metal__price ${flash}">${val == null ? "—" : fmt(val, Prices.unit === "kg" ? 0 : 2)}</div>
      <div class="metal__unit">${unitLabel(Prices.unit)}${d.live ? " · LIVE" : ""}</div>
      <div class="metal__chg">${changeHTML(d)}</div>${sparkline(d.history)}</div>`;
  }).join("");
  setTimeout(() => grid.querySelectorAll(".flash-up,.flash-down").forEach((e) => e.classList.remove("flash-up", "flash-down")), 1500);
}
function renderTicker(minerals) {
  const el = document.getElementById("tickerInner");
  const live = Prices.metals.map((m) => {
    const d = Prices.data[m.sym]; if (!d || d.price == null) return "";
    let chg = "";
    if (d.live && d.first) { const pct = ((d.price - d.first) / d.first) * 100; chg = ` <i class="${pct >= 0 ? "up" : "down"}">${pct >= 0 ? "▲" : "▼"}${Math.abs(pct).toFixed(2)}%</i>`; }
    return `<span><b>${m.name.toUpperCase()}</b> ${fmt(d.price)}/oz${chg}</span>`;
  });
  const gold = Prices.goldOz();
  if (gold) live.splice(1, 0, `<span><b>GOLD</b> ${fmt(gold / OZ_IN_G)}/g · ${fmt((gold / OZ_IN_G) * 1000, 0)}/kg</span>`);
  const ind = minerals.slice(0, 8).map((m) => `<span><b>${escP(m.name).toUpperCase()}</b> $${escP(m.price)} ${escP(m.unit)}*</span>`);
  const html = [...live, ...ind].join("") || "Market prices";
  if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
}
function renderHero() {
  const d = Prices.data.XAU; const p = document.getElementById("heroGoldPrice"), c = document.getElementById("heroGoldChange");
  if (!d) return;
  p.textContent = fmt(d.price) + " /oz";
  if (d.live && d.first) { const pct = ((d.price - d.first) / d.first) * 100; c.className = pct >= 0 ? "up" : "down"; c.textContent = (pct >= 0 ? "▲ " : "▼ ") + Math.abs(pct).toFixed(2) + "%"; }
  else c.textContent = d.live ? "" : "(reference)";
}

window.initPrices = function (site) {
  const P = site.prices || {};
  Prices.metals = [
    { sym: "XAU", name: "Gold", fallback: Number(P.goldFallback) || null },
    P.showSilver !== false && { sym: "XAG", name: "Silver" },
    P.showPlatinum !== false && { sym: "XPT", name: "Platinum" },
    P.showPalladium !== false && { sym: "XPD", name: "Palladium" },
  ].filter(Boolean);
  const minerals = P.minerals || [];

  document.getElementById("chartPanel").hidden = P.showChart === false;
  document.getElementById("calcPanel").hidden = P.showCalculator === false;
  if (P.showChart === false || P.showCalculator === false) document.getElementById("pricesSplit").style.gridTemplateColumns = "1fr";

  document.getElementById("mineralTable").innerHTML = minerals.map((m) =>
    `<tr><td>${escP(m.name)}</td><td class="muted">${escP(m.grade)}</td><td>$${escP(m.price)}</td><td class="muted">${escP(m.unit)}</td></tr>`).join("");
  document.getElementById("mineralNote").textContent = `* Indicative world-market ranges as of ${P.indicativeUpdated || "—"}. ${P.note || ""}`;

  Prices.onUpdate(renderGrid);
  Prices.onUpdate(() => renderTicker(minerals));
  Prices.onUpdate(renderHero);
  Prices.onUpdate(() => {
    const d = Prices.data.XAU, el = document.getElementById("lastUpdated");
    if (d) el.textContent = "Last updated " + d.updated.toLocaleTimeString() + (d.live ? "." : " (live feed unavailable – showing reference price).");
  });

  document.querySelectorAll(".unit-switch button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".unit-switch button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active"); Prices.unit = b.dataset.unit; renderGrid();
  }));

  const live = P.liveEnabled !== false;
  refreshPrices(live);
  if (live) setInterval(() => refreshPrices(true), 60000);
};
