/* Loads the site content managed in the admin panel and renders the page. */
(function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // escape, then allow **bold** only
  const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const get = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  const safeUrl = (u) => (/^(https?:\/\/|\/|assets\/|uploads\/)/i.test(String(u || "")) ? u : "");

  const ICONS = {
    gold: '<svg viewBox="0 0 64 64"><path d="M10 44 18 30h28l8 14z" fill="url(#g1)"/><path d="M18 30 24 20h16l6 10z" fill="url(#g2)"/><defs><linearGradient id="g1" x1="0" x2="1"><stop offset="0" stop-color="#f7d774"/><stop offset="1" stop-color="#b8860b"/></linearGradient><linearGradient id="g2" x1="0" x2="1"><stop offset="0" stop-color="#ffe9a0"/><stop offset="1" stop-color="#d4a017"/></linearGradient></defs></svg>',
    diamond: '<svg viewBox="0 0 64 64"><path d="M12 24 22 12h20l10 12-20 28z" fill="#cfe9ff"/><path d="M12 24h40L32 52z" fill="#9fd0f5"/><path d="M22 12l4 12h12l4-12M26 24l6 28 6-28" fill="none" stroke="#fff" stroke-width="1.5"/></svg>',
    minerals: '<svg viewBox="0 0 64 64"><path d="M14 50 20 22l8 28zM26 50l8-38 8 38zM40 50l6-24 6 24z" fill="#b9d3ff"/><path d="M20 22l8 28M34 12l8 38M46 26l6 24" stroke="#fff" stroke-width="1.2"/></svg>',
    export: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="20" fill="#2f7fd8"/><path d="M20 26c6-2 8 4 14 2s6-8 10-6M18 38c8 0 8 6 16 4s8 2 12-2" stroke="#7fd36b" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="32" cy="32" r="20" fill="none" stroke="#f7d774" stroke-width="2"/></svg>',
    truck: '<svg viewBox="0 0 64 64"><rect x="8" y="22" width="30" height="18" rx="2" fill="#f2c14e"/><path d="M38 28h10l8 8v4H38z" fill="#d79a1d"/><circle cx="18" cy="44" r="5" fill="#333" stroke="#f7d774" stroke-width="2"/><circle cx="46" cy="44" r="5" fill="#333" stroke="#f7d774" stroke-width="2"/></svg>',
    shield: '<svg viewBox="0 0 64 64"><path d="M32 8 52 16v14c0 12-8 22-20 26C20 52 12 42 12 30V16z" fill="#2f7fd8"/><path d="m22 32 7 7 13-14" stroke="#f7d774" stroke-width="4" fill="none" stroke-linecap="round"/></svg>',
  };

  function render(c) {
    window.SITE = c;
    document.title = c.seo?.title || document.title;
    document.getElementById("metaDesc").content = c.seo?.description || "";
    if (safeUrl(c.company?.logoMark)) document.getElementById("favicon").href = c.company.logoMark;

    document.querySelectorAll("[data-text]").forEach((el) => { el.textContent = get(c, el.dataset.text) ?? ""; });
    document.querySelectorAll("[data-rich]").forEach((el) => { el.innerHTML = rich(get(c, el.dataset.rich)); });
    document.querySelectorAll("[data-src]").forEach((el) => { const u = safeUrl(get(c, el.dataset.src)); if (u) el.src = u; });

    // hero video
    const v = document.getElementById("heroVideo");
    if (safeUrl(c.hero?.poster)) v.poster = c.hero.poster;
    if (safeUrl(c.hero?.video)) { v.src = c.hero.video; v.play?.().catch(() => {}); }
    document.getElementById("heroGold").hidden = c.hero?.showGoldBadge === false || c.prices?.liveEnabled === false;

    // about
    document.getElementById("aboutParas").innerHTML = (c.about?.paragraphs || []).map((p) => `<p>${rich(p)}</p>`).join("");
    document.getElementById("aboutStats").innerHTML = (c.about?.stats || []).map((s) =>
      `<div><strong data-count="${Number(s.value) || 0}" data-suffix="${esc(s.suffix)}">0</strong><span>${esc(s.label)}</span></div>`).join("");
    if (safeUrl(c.about?.image)) document.getElementById("aboutImg").style.backgroundImage = `url('${c.about.image}')`;

    // products
    document.getElementById("productCards").innerHTML = (c.products?.items || []).map((p) => `
      <article class="card reveal">
        ${safeUrl(p.image) ? `<div class="card__img" style="background-image:url('${esc(p.image)}')"></div>` : `<div class="card__icon">${ICONS[p.icon] || ICONS.gold}</div>`}
        <h3>${esc(p.title)}</h3><p class="card__sub">${esc(p.sub)}</p><p>${rich(p.text)}</p>
      </article>`).join("");

    // why
    document.getElementById("whyGrid").innerHTML = (c.why?.items || []).map((w) =>
      `<div class="why__item reveal"><div class="ring">${esc(w.icon)}</div><h4>${esc(w.title)}</h4><p>${esc(w.text)}</p></div>`).join("");

    // process
    const proc = document.getElementById("process");
    if (safeUrl(c.process?.image)) proc.style.backgroundImage = `url('${c.process.image}')`;
    document.getElementById("steps").innerHTML = (c.process?.steps || []).map((s, i) =>
      `<li class="reveal"><b>${String(i + 1).padStart(2, "0")}</b><h4>${esc(s.title)}</h4><p>${esc(s.text)}</p></li>`).join("");

    // location
    const L = c.location || {};
    const map = document.getElementById("mapFrame");
    const embed = /^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/i.test(L.mapEmbedUrl || "") ? L.mapEmbedUrl : "";
    map.src = embed || `https://maps.google.com/maps?q=${encodeURIComponent(L.mapQuery || "Freetown, Sierra Leone")}&z=15&ie=UTF8&iwloc=&output=embed`;
    document.getElementById("directionsBtn").href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(L.lat && L.lng ? L.lat + "," + L.lng : L.mapQuery || "")}`;
    document.getElementById("emailRow").hidden = !c.company?.email;

    // contact
    const wa = String(c.company?.whatsapp || "").replace(/\D/g, "");
    document.getElementById("waFloat").href = `https://wa.me/${wa}`;
    document.getElementById("waFloat").hidden = !wa;
    document.getElementById("productSelect").innerHTML = (c.contact?.products || []).map((p) => `<option>${esc(p)}</option>`).join("");

    // socials
    const soc = [["facebook", "Facebook"], ["instagram", "Instagram"], ["linkedin", "LinkedIn"]]
      .filter(([k]) => /^https?:\/\//.test(c.company?.[k] || ""))
      .map(([k, n]) => `<a href="${esc(c.company[k])}" target="_blank" rel="noopener">${n}</a>`);
    document.getElementById("socials").innerHTML = soc.join(" · ");

    document.getElementById("year").textContent = new Date().getFullYear();
  }

  fetch("/api/content", { cache: "no-store" })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((c) => {
      render(c);
      window.initPrices && window.initPrices(c);
      window.initMain && window.initMain(c);
      document.body.classList.remove("loading");
    })
    .catch((e) => {
      console.error("Could not load site content", e);
      document.body.classList.remove("loading");
      document.body.insertAdjacentHTML("afterbegin", '<p style="position:fixed;bottom:0;left:0;right:0;z-index:99;background:#b00;color:#fff;padding:8px;text-align:center">Site content could not be loaded. Start the server with <b>npm start</b>.</p>');
    });
})();
