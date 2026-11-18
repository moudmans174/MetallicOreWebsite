/* Loads the site content managed in the admin panel, applies language & theme, and renders the page. */
(function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); // escape, then allow **bold** only
  const get = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  const safeUrl = (u) => (/^(https?:\/\/|\/|assets\/|uploads\/)/i.test(String(u || "")) ? u : "");
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

  let C = null; // site content

  /* translated content value: falls back to English when a translation is missing */
  function tr(path) {
    if (window.LANG !== "en") {
      const v = C.translations?.[window.LANG]?.[path];
      if (v != null && v !== "") return v;
    }
    return get(C, path);
  }
  window.tr = (p) => tr(p);

  const ICONS = {
    gold: '<svg viewBox="0 0 64 64"><path d="M10 44 18 30h28l8 14z" fill="url(#g1)"/><path d="M18 30 24 20h16l6 10z" fill="url(#g2)"/><defs><linearGradient id="g1" x1="0" x2="1"><stop offset="0" stop-color="#f7d774"/><stop offset="1" stop-color="#b8860b"/></linearGradient><linearGradient id="g2" x1="0" x2="1"><stop offset="0" stop-color="#ffe9a0"/><stop offset="1" stop-color="#d4a017"/></linearGradient></defs></svg>',
    diamond: '<svg viewBox="0 0 64 64"><path d="M12 24 22 12h20l10 12-20 28z" fill="#cfe9ff"/><path d="M12 24h40L32 52z" fill="#9fd0f5"/><path d="M22 12l4 12h12l4-12M26 24l6 28 6-28" fill="none" stroke="#fff" stroke-width="1.5"/></svg>',
    minerals: '<svg viewBox="0 0 64 64"><path d="M14 50 20 22l8 28zM26 50l8-38 8 38zM40 50l6-24 6 24z" fill="#b9d3ff"/><path d="M20 22l8 28M34 12l8 38M46 26l6 24" stroke="#fff" stroke-width="1.2"/></svg>',
    export: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="20" fill="#2f7fd8"/><path d="M20 26c6-2 8 4 14 2s6-8 10-6M18 38c8 0 8 6 16 4s8 2 12-2" stroke="#7fd36b" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="32" cy="32" r="20" fill="none" stroke="#f7d774" stroke-width="2"/></svg>',
    truck: '<svg viewBox="0 0 64 64"><rect x="8" y="22" width="30" height="18" rx="2" fill="#f2c14e"/><path d="M38 28h10l8 8v4H38z" fill="#d79a1d"/><circle cx="18" cy="44" r="5" fill="#333" stroke="#f7d774" stroke-width="2"/><circle cx="46" cy="44" r="5" fill="#333" stroke="#f7d774" stroke-width="2"/></svg>',
    shield: '<svg viewBox="0 0 64 64"><path d="M32 8 52 16v14c0 12-8 22-20 26C20 52 12 42 12 30V16z" fill="#2f7fd8"/><path d="m22 32 7 7 13-14" stroke="#f7d774" stroke-width="4" fill="none" stroke-linecap="round"/></svg>',
  };

  /* ---------------- interface strings ---------------- */
  function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach((el) => { if (!el.dataset.html) el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
    document.querySelectorAll("[data-i18n-title]").forEach((el) => (el.title = t(el.dataset.i18nTitle)));
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    updateThemeBtn();
  }

  /* ---------------- theme ---------------- */
  function currentTheme() { return document.documentElement.getAttribute("data-theme") || "dark"; }
  function setTheme(th, save) {
    document.documentElement.setAttribute("data-theme", th);
    if (save) store.set("mo_theme", th);
    updateThemeBtn();
    document.dispatchEvent(new CustomEvent("themechange", { detail: th }));
  }
  function updateThemeBtn() {
    const b = document.getElementById("themeBtn"); if (!b) return;
    const label = currentTheme() === "dark" ? t("ui.themeLight") : t("ui.themeDark");
    b.title = label; b.setAttribute("aria-label", label);
  }

  /* ---------------- language ---------------- */
  function enabledLangs() {
    const list = (C.settings?.languages || ["en"]).filter((l) => window.LANGS[l]);
    return list.includes("en") ? list : ["en", ...list];
  }
  function pickLang() {
    const langs = enabledLangs();
    const fromUrl = new URLSearchParams(location.search).get("lang");
    if (langs.includes(fromUrl)) return fromUrl;
    const saved = store.get("mo_lang");
    if (langs.includes(saved)) return saved;
    const def = C.settings?.defaultLang;
    if (langs.includes(def) && def !== "en") return def;
    const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    if (langs.includes(nav)) return nav;
    return langs.includes(def) ? def : "en";
  }
  function setLang(lang, save) {
    window.LANG = lang;
    const meta = window.LANGS[lang] || window.LANGS.en;
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.dir;
    document.body.classList.toggle("lang-cjk", lang === "zh");
    document.body.classList.toggle("lang-ar", lang === "ar");
    if (lang === "ar" && !document.getElementById("arFont")) {
      document.head.insertAdjacentHTML("beforeend", '<link id="arFont" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" />');
    }
    if (save) {
      store.set("mo_lang", lang);
      const u = new URL(location.href);
      if (lang === (C.settings?.defaultLang || "en")) u.searchParams.delete("lang"); else u.searchParams.set("lang", lang);
      history.replaceState(null, "", u);
    }
    const sel = document.getElementById("langSelect"); if (sel) sel.value = lang;
  }

  /* ---------------- render content ---------------- */
  function render() {
    const c = C;
    window.SITE = c;
    document.title = tr("seo.title") || document.title;
    document.getElementById("metaDesc").content = tr("seo.description") || "";
    if (safeUrl(c.company?.logoMark)) document.getElementById("favicon").href = c.company.logoMark;

    document.querySelectorAll("[data-text]").forEach((el) => { el.textContent = tr(el.dataset.text) ?? ""; });
    document.querySelectorAll("[data-rich]").forEach((el) => { el.innerHTML = rich(tr(el.dataset.rich)); });
    document.querySelectorAll("[data-src]").forEach((el) => { const u = safeUrl(get(c, el.dataset.src)); if (u) el.src = u; });

    const v = document.getElementById("heroVideo");
    if (safeUrl(c.hero?.poster) && v.getAttribute("poster") !== c.hero.poster) v.poster = c.hero.poster;
    if (safeUrl(c.hero?.video) && v.getAttribute("src") !== c.hero.video) { v.src = c.hero.video; v.play?.().catch(() => {}); }
    document.getElementById("heroGold").hidden = c.hero?.showGoldBadge === false || c.prices?.liveEnabled === false;

    document.getElementById("aboutParas").innerHTML = (c.about?.paragraphs || []).map((p, i) => `<p>${rich(tr("about.paragraphs." + i))}</p>`).join("");
    document.getElementById("aboutStats").innerHTML = (c.about?.stats || []).map((s, i) =>
      `<div><strong data-count="${Number(s.value) || 0}" data-suffix="${esc(s.suffix)}">${Number(s.value) || 0}${esc(s.suffix)}</strong><span>${esc(tr(`about.stats.${i}.label`))}</span></div>`).join("");
    if (safeUrl(c.about?.image)) document.getElementById("aboutImg").style.backgroundImage = `url('${c.about.image}')`;

    document.getElementById("productCards").innerHTML = (c.products?.items || []).map((p, i) => `
      <article class="card reveal">
        ${safeUrl(p.image) ? `<div class="card__img" style="background-image:url('${esc(p.image)}')"></div>` : `<div class="card__icon">${ICONS[p.icon] || ICONS.gold}</div>`}
        <h3>${esc(tr(`products.items.${i}.title`))}</h3><p class="card__sub">${esc(tr(`products.items.${i}.sub`))}</p><p>${rich(tr(`products.items.${i}.text`))}</p>
      </article>`).join("");

    document.getElementById("whyGrid").innerHTML = (c.why?.items || []).map((w, i) =>
      `<div class="why__item reveal"><div class="ring">${esc(w.icon)}</div><h4>${esc(tr(`why.items.${i}.title`))}</h4><p>${esc(tr(`why.items.${i}.text`))}</p></div>`).join("");

    const proc = document.getElementById("process");
    if (safeUrl(c.process?.image)) proc.style.backgroundImage = `url('${c.process.image}')`;
    document.getElementById("steps").innerHTML = (c.process?.steps || []).map((s, i) =>
      `<li class="reveal"><b>${String(i + 1).padStart(2, "0")}</b><h4>${esc(tr(`process.steps.${i}.title`))}</h4><p>${esc(tr(`process.steps.${i}.text`))}</p></li>`).join("");

    const L = c.location || {};
    const map = document.getElementById("mapFrame");
    const embed = /^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/i.test(L.mapEmbedUrl || "") ? L.mapEmbedUrl : "";
    const hl = { zh: "zh-CN" }[window.LANG] || window.LANG;
    const mapSrc = embed || `https://maps.google.com/maps?q=${encodeURIComponent(L.mapQuery || "Freetown, Sierra Leone")}&z=15&hl=${hl}&ie=UTF8&iwloc=&output=embed`;
    if (map.getAttribute("src") !== mapSrc) map.src = mapSrc;
    document.getElementById("directionsBtn").href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(L.lat && L.lng ? L.lat + "," + L.lng : L.mapQuery || "")}`;
    document.getElementById("emailRow").hidden = !c.company?.email;

    const wa = String(c.company?.whatsapp || "").replace(/\D/g, "");
    document.getElementById("waFloat").href = `https://wa.me/${wa}`;
    document.getElementById("waFloat").hidden = !wa;
    const ps = document.getElementById("productSelect"), keep = ps.selectedIndex;
    // option value stays English so the admin panel receives requests in one language
    ps.innerHTML = (c.contact?.products || []).map((p, i) => `<option value="${esc(p)}">${esc(tr("contact.products." + i))}</option>`).join("");
    if (keep > 0) ps.selectedIndex = keep;

    const soc = [["facebook", "Facebook"], ["instagram", "Instagram"], ["linkedin", "LinkedIn"]]
      .filter(([k]) => /^https?:\/\//.test(c.company?.[k] || ""))
      .map(([k, n]) => `<a href="${esc(c.company[k])}" target="_blank" rel="noopener">${n}</a>`);
    document.getElementById("socials").innerHTML = soc.join(" · ");
    document.getElementById("year").textContent = new Date().getFullYear();
  }

  /* ---------------- switches ---------------- */
  function setupSwitches() {
    const sel = document.getElementById("langSelect");
    const langs = enabledLangs();
    sel.innerHTML = langs.map((l) => `<option value="${l}">${window.LANGS[l].name}</option>`).join("");
    sel.value = window.LANG;
    sel.closest(".lang-pick").hidden = langs.length < 2;
    sel.addEventListener("change", () => {
      setLang(sel.value, true);
      applyI18n(); render();
      window.rerenderPrices && window.rerenderPrices();
      window.observeReveals && window.observeReveals();
    });
    document.getElementById("themeBtn").addEventListener("click", () => setTheme(currentTheme() === "dark" ? "light" : "dark", true));
  }

  fetch("/api/content", { cache: "no-store" })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((c) => {
      C = c;
      // theme: visitor's choice → admin default
      const saved = store.get("mo_theme");
      let th = saved || c.settings?.defaultTheme || "dark";
      if (th === "auto") th = window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
      setTheme(th, false);
      setLang(pickLang(), false);
      applyI18n(); render(); setupSwitches();
      window.initPrices && window.initPrices(c);
      window.initMain && window.initMain(c);
      document.body.classList.remove("loading");
    })
    .catch((e) => {
      console.error("Could not load site content", e);
      document.body.classList.remove("loading");
      document.body.insertAdjacentHTML("afterbegin", '<p style="position:fixed;bottom:0;left:0;right:0;z-index:99;background:#b00;color:#fff;padding:8px;text-align:center">' + esc(t("err.content")) + " (npm start)</p>");
    });
})();
