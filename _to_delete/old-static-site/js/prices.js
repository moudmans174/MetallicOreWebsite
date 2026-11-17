/* =========================================================
   Metallic Ore Limited – world market prices
   ---------------------------------------------------------
   1) LIVE precious metals (gold, silver, platinum, palladium)
      are pulled from the free gold-api.com feed every 60 s.
   2) Diamonds, rutile and industrial minerals have no free
      public live feed. Their INDICATIVE prices are set below in
      INDICATIVE_MINERALS – update them whenever you get new
      quotes from buyers or market reports.
   ========================================================= */

const OZ_IN_G = 31.1034768;

const LIVE_METALS = [
  { sym: "XAU", name: "Gold",      fallback: 3998.90 }, // Kitco spot, 11 Nov 2026 – shown only if the live feed is down
  { sym: "XAG", name: "Silver",    fallback: null },
  { sym: "XPT", name: "Platinum",  fallback: null },
  { sym: "XPD", name: "Palladium", fallback: null },
];

const INDICATIVE_UPDATED = "November 2026";
const INDICATIVE_MINERALS = [
  { name: "Rough diamonds (gem)",        grade: "Sierra Leone alluvial, mixed parcel avg.", price: "250 – 600",      unit: "per carat" },
  { name: "Rough diamonds (1 ct+ white)", grade: "Single stones, good colour/clarity",      price: "1,000 – 5,000+", unit: "per carat" },
  { name: "Industrial diamonds / boart",  grade: "Near-gem & industrial",                   price: "5 – 40",         unit: "per carat" },
  { name: "Rutile",                       grade: "95% TiO₂ min, bulk FOB",                  price: "1,300 – 1,700",  unit: "per tonne" },
  { name: "Ilmenite",                     grade: "50–54% TiO₂ concentrate",                 price: "250 – 350",      unit: "per tonne" },
  { name: "Zircon",                       grade: "Premium, 66% ZrO₂",                       price: "1,500 – 2,000",  unit: "per tonne" },
  { name: "Bauxite",                      grade: "Metallurgical, CIF China",                price: "65 – 80",        unit: "per tonne" },
  { name: "Iron ore",                     grade: "62% Fe fines, CFR China",                 price: "95 – 110",       unit: "per tonne" },
  { name: "Coltan (tantalite)",           grade: "30% Ta₂O₅ concentrate",                   price: "180 – 250",      unit: "per kg" },
];

/* ---------- state ---------- */
const Prices = {
  unit: "oz",
  data: {},      // sym -> { price, prev, history:[], live:bool, updated }
  listeners: [],
  onUpdate(fn) { this.listeners.push(fn); },
  goldOz() { return this.data.XAU ? this.data.XAU.price : null; },
};

const fmt = (n, d = 2) =>
  n == null || isNaN(n) ? "—" : "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

function convert(pricePerOz, unit) {
  if (pricePerOz == null) return null;
  if (unit === "g") return pricePerOz / OZ_IN_G;
  if (unit === "kg") return (pricePerOz / OZ_IN_G) * 1000;
  return pricePerOz;
}
const unitLabel = (u) => ({ oz: "USD / troy oz", g: "USD / gram", kg: "USD / kg" }[u]);

/* ---------- fetching ---------- */
async function fetchJSON(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function fetchMetal(sym) {
  try {
    const j = await fetchJSON(`https://api.gold-api.com/price/${sym}`);
    if (typeof j.price === "number") return j.price;
  } catch (e) { /* try backup below */ }
  if (sym === "XAU") {
    try {
      const j = await fetchJSON("https://xaus.com/api/v1/spot");
      if (j.spot_usd_oz) return Number(j.spot_usd_oz);
    } catch (e) { /* fall through */ }
  }
  return null;
}

async function refreshPrices() {
  const results = await Promise.all(LIVE_METALS.map((m) => fetchMetal(m.sym)));
  LIVE_METALS.forEach((m, i) => {
    const p = results[i];
    const d = Prices.data[m.sym] || { history: [], prev: null, price: null };
    if (p != null) {
      d.prev = d.price;
      d.price = p;
      d.live = true;
      d.history.push(p);
      if (d.history.length > 40) d.history.shift();
      if (d.first == null) d.first = p;
    } else if (d.price == null && m.fallback != null) {
      d.price = m.fallback; d.live = false; d.first = m.fallback;
    }
    d.updated = new Date();
    Prices.data[m.sym] = d;
  });
  Prices.listeners.forEach((fn) => fn());
}

/* ---------- rendering ---------- */
function sparkline(hist) {
  if (!hist || hist.length < 2) return '<svg viewBox="0 0 100 30"><line x1="0" y1="15" x2="100" y2="15" stroke="rgba(242,193,78,.35)" stroke-dasharray="3 3"/></svg>';
  const min = Math.min(...hist), max = Math.max(...hist), r = max - min || 1;
  const pts = hist.map((v, i) => `${(i / (hist.length - 1)) * 100},${28 - ((v - min) / r) * 26}`).join(" ");
  const col = hist[hist.length - 1] >= hist[0] ? "#2ecc71" : "#ff5d5d";
  return `<svg viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>`;
}

function changeHTML(d) {
  if (!d || !d.live || d.first == null || d.price == null) return '<span class="muted">' + (d && !d.live && d.price ? "reference price · live feed offline" : "connecting…") + "</span>";
  const diff = d.price - d.first, pct = (diff / d.first) * 100;
  const cls = diff >= 0 ? "up" : "down", arrow = diff >= 0 ? "▲" : "▼";
  return `<span class="${cls}">${arrow} ${Math.abs(pct).toFixed(2)}%</span> <span class="muted">since you opened the page</span>`;
}

function renderGrid() {
  const grid = document.getElementById("metalGrid");
  if (!grid) return;
  grid.innerHTML = LIVE_METALS.map((m) => {
    const d = Prices.data[m.sym] || {};
    const val = convert(d.price, Prices.unit);
    let flash = "";
    if (d.prev != null && d.price !== d.prev) flash = d.price > d.prev ? "flash-up" : "flash-down";
    return `<div class="metal ${m.sym === "XAU" ? "gold-card" : ""}">
      <div class="metal__top"><span class="metal__name">${m.name}</span><span class="metal__sym">${m.sym}/USD</span></div>
      <div class="metal__price ${flash}">${val == null ? "—" : fmt(val, Prices.unit === "g" ? 2 : Prices.unit === "kg" ? 0 : 2)}</div>
      <div class="metal__unit">${unitLabel(Prices.unit)}${d.live ? " · LIVE" : ""}</div>
      <div class="metal__chg">${changeHTML(d)}</div>
      ${sparkline(d.history)}
    </div>`;
  }).join("");
  setTimeout(() => grid.querySelectorAll(".flash-up,.flash-down").forEach((e) => e.classList.remove("flash-up", "flash-down")), 1500);
}

function renderTicker() {
  const el = document.getElementById("tickerInner");
  if (!el) return;
  const live = LIVE_METALS.map((m) => {
    const d = Prices.data[m.sym];
    if (!d || d.price == null) return "";
    let chg = "";
    if (d.live && d.first) {
      const pct = ((d.price - d.first) / d.first) * 100;
      chg = ` <i class="${pct >= 0 ? "up" : "down"}">${pct >= 0 ? "▲" : "▼"}${Math.abs(pct).toFixed(2)}%</i>`;
    }
    return `<span><b>${m.name.toUpperCase()}</b> ${fmt(d.price)}/oz${chg}</span>`;
  });
  const gold = Prices.goldOz();
  if (gold) live.splice(1, 0, `<span><b>GOLD</b> ${fmt(gold / OZ_IN_G)}/g · ${fmt((gold / OZ_IN_G) * 1000, 0)}/kg</span>`);
  const ind = INDICATIVE_MINERALS.slice(0, 6).map((m) => `<span><b>${m.name.toUpperCase()}</b> $${m.price} ${m.unit}*</span>`);
  const html = [...live, ...ind].join("");
  if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
}

function renderHero() {
  const d = Prices.data.XAU;
  const p = document.getElementById("heroGoldPrice"), c = document.getElementById("heroGoldChange");
  if (!p || !d) return;
  p.textContent = fmt(d.price) + " /oz";
  if (d.live && d.first) {
    const pct = ((d.price - d.first) / d.first) * 100;
    c.className = pct >= 0 ? "up" : "down";
    c.textContent = (pct >= 0 ? "▲ " : "▼ ") + Math.abs(pct).toFixed(2) + "%";
  } else c.textContent = d.live ? "" : "(reference)";
}

function renderUpdated() {
  const el = document.getElementById("lastUpdated");
  const d = Prices.data.XAU;
  if (el && d) el.textContent = "Last updated " + d.updated.toLocaleTimeString() + (d.live ? "." : " (live feed unavailable – showing reference price).");
}

function renderTable() {
  const tb = document.getElementById("mineralTable");
  if (!tb) return;
  tb.innerHTML = INDICATIVE_MINERALS.map((m) => `<tr><td>${m.name}</td><td class="muted">${m.grade}</td><td>$${m.price}</td><td class="muted">${m.unit}</td></tr>`).join("");
  document.getElementById("mineralNote").textContent =
    `* Indicative world-market ranges as of ${INDICATIVE_UPDATED}. Diamond, rutile and industrial mineral prices are negotiated per parcel and depend on grade, size, quantity and terms. Contact Metallic Ore Limited for a firm quote.`;
}

Prices.onUpdate(renderGrid);
Prices.onUpdate(renderTicker);
Prices.onUpdate(renderHero);
Prices.onUpdate(renderUpdated);

document.addEventListener("DOMContentLoaded", () => {
  renderTable();
  document.querySelectorAll(".unit-switch button").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".unit-switch button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      Prices.unit = b.dataset.unit;
      renderGrid();
    })
  );
  refreshPrices();
  setInterval(refreshPrices, 60000);
});
