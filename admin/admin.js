/* Metallic Ore Limited – Admin panel */
(() => {
  /* ---------------- helpers ---------------- */
  const $ = (s, el = document) => el.querySelector(s);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const getPath = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  function setPath(o, p, v) {
    const ks = p.split("."); let cur = o;
    ks.slice(0, -1).forEach((k, i) => { if (cur[k] == null) cur[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; cur = cur[k]; });
    cur[ks[ks.length - 1]] = v;
  }
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach((c) => c != null && c !== false && el.append(c.nodeType ? c : document.createTextNode(c)));
    return el;
  }
  const fmtDate = (d) => new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.round(b / 1024) + " KB");
  let toastT;
  function toast(msg, err) {
    const t = $("#toast"); t.textContent = msg; t.className = "toast show" + (err ? " err" : "");
    clearTimeout(toastT); toastT = setTimeout(() => (t.className = "toast"), 3000);
  }
  async function api(method, url, body) {
    const r = await fetch(url, { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    let j = {}; try { j = await r.json(); } catch {}
    if (r.status === 401 && url !== "/api/login") { showLogin(); throw new Error("Please log in again"); }
    if (!r.ok) throw new Error(j.error || "Request failed (" + r.status + ")");
    return j;
  }
  function uploadFile(file, onProgress) {
    return new Promise((resolve, reject) => {
      const fd = new FormData(); fd.append("file", file);
      const x = new XMLHttpRequest(); x.open("POST", "/api/upload");
      x.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress(Math.round((e.loaded / e.total) * 100));
      x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch {} x.status < 300 ? resolve(j) : reject(new Error(j.error || "Upload failed")); };
      x.onerror = () => reject(new Error("Upload failed")); x.send(fd);
    });
  }

  /* ---------------- state ---------------- */
  let content = null, draft = null, dirty = false, inquiries = [], me = null;
  function markDirty() { dirty = true; $("#dirtyFlag").hidden = false; $("#discardBtn").hidden = false; $("#saveBtn").disabled = false; }
  function clearDirty() { dirty = false; $("#dirtyFlag").hidden = true; $("#discardBtn").hidden = true; $("#saveBtn").disabled = true; }
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------------- section definitions ---------------- */
  const ICON_OPTS = ["gold", "diamond", "minerals", "export", "truck", "shield"];
  const SECTIONS = {
    company: { title: "Company & Contact", cards: [
      { title: "Company details", fields: [
        { p: "company.name", l: "Company name" }, { p: "company.tagline", l: "Tagline" },
        { p: "company.brandMain", l: "Logo text (gold part)" }, { p: "company.brandSub", l: "Logo text (white part)" },
        { p: "company.licence", l: "Licence / business line", full: true } ] },
      { title: "Contact", fields: [
        { p: "company.phone", l: "Phone (as displayed)" },
        { p: "company.whatsapp", l: "WhatsApp number", hint: "Digits only, with country code, e.g. 23277460171" },
        { p: "company.email", l: "Email (optional)" }, { p: "company.address1", l: "Address line 1" }, { p: "company.address2", l: "Address line 2" } ] },
      { title: "Logos", fields: [ { p: "company.logo", l: "Main logo", t: "image", full: true }, { p: "company.logoMark", l: "Small logo / icon (menu & browser tab)", t: "image", full: true } ] },
      { title: "Social media", hint: "Leave empty to hide.", fields: [ { p: "company.facebook", l: "Facebook URL" }, { p: "company.instagram", l: "Instagram URL" }, { p: "company.linkedin", l: "LinkedIn URL" } ] },
    ]},
    hero: { title: "Hero & Background Video", cards: [
      { title: "Headline", fields: [
        { p: "hero.headlinePre", l: "Headline – start" }, { p: "hero.headlineHighlight", l: "Headline – gold highlight" },
        { p: "hero.headlinePost", l: "Headline – second line", full: true },
        { p: "hero.lead", l: "Intro text", t: "textarea", full: true, hint: "Wrap words in **double stars** to make them gold and bold." },
        { p: "hero.ctaPrimary", l: "Main button text" }, { p: "hero.ctaSecondary", l: "Second button text" },
        { p: "hero.showGoldBadge", l: "Show live gold price badge", t: "check" } ] },
      { title: "Background video", hint: "Short, muted MP4 works best (under ~15 MB, 10–30 seconds).", fields: [
        { p: "hero.video", l: "Video", t: "video", full: true }, { p: "hero.poster", l: "Poster image (shown while the video loads)", t: "image", full: true } ] },
    ]},
    about: { title: "About Section", cards: [
      { title: "Text", fields: [
        { p: "about.eyebrow", l: "Small heading" }, { p: "about.titleMain", l: "Title" }, { p: "about.titleScript", l: "Title – script part" },
        { p: "about.paragraphs", l: "Paragraphs", t: "strlist", area: true, full: true, hint: "Use **double stars** for bold." },
        { p: "about.image", l: "Image", t: "image", full: true } ] },
      { title: "Statistics", fields: [ { p: "about.stats", t: "repeater", full: true, item: "Statistic", fields: [
        { k: "value", l: "Number", t: "number" }, { k: "suffix", l: "Suffix (%, +, /7…)" }, { k: "label", l: "Label", full: true } ] } ] },
    ]},
    products: { title: "Products & Services", cards: [
      { title: "Section heading", fields: [ { p: "products.eyebrow", l: "Small heading" }, { p: "products.title", l: "Title" } ] },
      { title: "Products", hint: "Add, remove or reorder products. Upload an image to replace the icon.", fields: [ { p: "products.items", t: "repeater", full: true, item: "Product", titleKey: "title", fields: [
        { k: "title", l: "Name" }, { k: "sub", l: "Subtitle" }, { k: "text", l: "Description", t: "textarea", full: true },
        { k: "icon", l: "Icon", t: "select", opts: ICON_OPTS }, { k: "image", l: "Image (optional – replaces icon)", t: "image", full: true } ] } ] },
    ]},
    prices: { title: "Market Prices", cards: [
      { title: "Live precious metals", hint: "Gold, silver, platinum and palladium update automatically from the world spot market.", fields: [
        { p: "prices.title", l: "Section title", full: true },
        { p: "prices.liveEnabled", l: "Use live prices", t: "check" },
        { p: "prices.goldFallback", l: "Gold reference price (USD/oz) – shown if the live feed is down", t: "number" },
        { p: "prices.showSilver", l: "Show silver", t: "check" }, { p: "prices.showPlatinum", l: "Show platinum", t: "check" },
        { p: "prices.showPalladium", l: "Show palladium", t: "check" }, { p: "prices.showChart", l: "Show live gold chart", t: "check" },
        { p: "prices.showCalculator", l: "Show gold value calculator", t: "check" } ] },
      { title: "Diamonds, rutile & other minerals", hint: "These are shown as indicative prices. Update them whenever you get new market quotes.", fields: [
        { p: "prices.indicativeUpdated", l: "Prices as of (e.g. November 2026)" },
        { p: "prices.minerals", t: "table", full: true, cols: [ { k: "name", l: "Mineral" }, { k: "grade", l: "Grade / basis" }, { k: "price", l: "Price (USD)" }, { k: "unit", l: "Unit" } ] },
        { p: "prices.note", l: "Note under the table", t: "textarea", full: true } ] },
    ]},
    why: { title: "Why Choose Us", cards: [
      { title: "Heading", fields: [ { p: "why.eyebrow", l: "Small heading" }, { p: "why.title", l: "Title" } ] },
      { title: "Reasons", fields: [ { p: "why.items", t: "repeater", full: true, item: "Reason", titleKey: "title", fields: [
        { k: "icon", l: "Icon (emoji)" }, { k: "title", l: "Title" }, { k: "text", l: "Text", t: "textarea", full: true } ] } ] },
    ]},
    process: { title: "Export Process", cards: [
      { title: "Heading & background", fields: [ { p: "process.titleMain", l: "Title" }, { p: "process.titleScript", l: "Title – script part" }, { p: "process.image", l: "Background image", t: "image", full: true } ] },
      { title: "Steps", fields: [ { p: "process.steps", t: "repeater", full: true, item: "Step", titleKey: "title", fields: [ { k: "title", l: "Title" }, { k: "text", l: "Text", t: "textarea", full: true } ] } ] },
    ]},
    location: { title: "Location & Map", cards: [
      { title: "Google Map", hint: "Simplest: type your address or place name. For an exact pin: in Google Maps click Share → Embed a map → copy only the link inside src=\"…\" and paste it below.", fields: [
        { p: "location.title", l: "Section title" }, { p: "location.mapQuery", l: "Address / place to show on map" },
        { p: "location.mapEmbedUrl", l: "Google Maps embed link (optional, overrides address)", full: true, hint: "Must start with https://www.google.com/maps/embed" },
        { p: "location.lat", l: "Latitude (for directions & distance)", t: "number" }, { p: "location.lng", l: "Longitude", t: "number" } ] },
    ], after: mapPreview },
    contact: { title: "Contact Form", cards: [
      { title: "Quote request form", fields: [ { p: "contact.title", l: "Title" }, { p: "contact.text", l: "Text", t: "textarea", full: true },
        { p: "contact.products", l: "Product options in the form", t: "strlist", full: true } ] },
    ]},
    seo: { title: "Footer & SEO", cards: [
      { title: "Search engines (Google)", fields: [ { p: "seo.title", l: "Page title", full: true }, { p: "seo.description", l: "Description", t: "textarea", full: true } ] },
      { title: "Footer", fields: [ { p: "footer.script", l: "Script text" }, { p: "footer.line", l: "Line under it" } ] },
    ]},
  };

  const MENU = [
    ["", [["dashboard", "📊", "Dashboard"]]],
    ["Website content", [["company", "🏢", "Company & Contact"], ["hero", "🎬", "Hero & Video"], ["about", "📖", "About"], ["products", "💎", "Products"],
      ["prices", "💰", "Market Prices"], ["why", "🤝", "Why Choose Us"], ["process", "🚢", "Export Process"], ["location", "📍", "Location & Map"],
      ["contact", "✉️", "Contact Form"], ["seo", "🔎", "Footer & SEO"]]],
    ["Manage", [["inquiries", "📥", "Quote Requests"], ["media", "🖼️", "Media Library"], ["backups", "🕘", "Backups"], ["account", "🔐", "Account"]]],
  ];

  function renderMenu(active) {
    const unread = inquiries.filter((i) => !i.read).length;
    $("#menu").replaceChildren(...MENU.flatMap(([grp, items]) => [
      grp ? h("div", { class: "grp" }, grp) : null,
      ...items.map(([id, ic, label]) => h("a", { href: "#" + id, class: id === active ? "active" : "" }, ic, " ", label,
        id === "inquiries" && unread ? h("span", { class: "badge" }, String(unread)) : null)),
    ]).filter(Boolean));
  }

  /* ---------------- field renderers ---------------- */
  function onVal(path, v) { setPath(draft, path, v); markDirty(); }

  function mediaField(path, kind) {
    const val = getPath(draft, path) || "";
    const prev = h("div", { class: "prev" });
    const setPrev = (u) => {
      prev.replaceChildren(); prev.style.backgroundImage = "";
      if (!u) return;
      if (kind === "video") prev.append(h("video", { src: u, muted: true, autoplay: true, loop: true, playsinline: true }));
      else prev.style.backgroundImage = `url('${u.replace(/'/g, "%27")}')`;
    };
    setPrev(val);
    const input = h("input", { value: val, placeholder: kind === "video" ? "/uploads/my-video.mp4" : "/uploads/my-image.jpg", oninput: (e) => { onVal(path, e.target.value); setPrev(e.target.value); } });
    const file = h("input", { type: "file", accept: kind === "video" ? "video/mp4,video/webm" : "image/*", hidden: true });
    const upBtn = h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => file.click() }, "⬆ Upload");
    file.addEventListener("change", async () => {
      if (!file.files[0]) return;
      try {
        upBtn.disabled = true;
        const r = await uploadFile(file.files[0], (p) => (upBtn.textContent = `Uploading ${p}%`));
        input.value = r.url; onVal(path, r.url); setPrev(r.url); toast("Uploaded – remember to save");
      } catch (e) { toast(e.message, true); }
      finally { upBtn.disabled = false; upBtn.textContent = "⬆ Upload"; file.value = ""; }
    });
    const pickBtn = h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => openPicker(kind, (u) => { input.value = u; onVal(path, u); setPrev(u); }) }, "🖼 Library");
    const clr = h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => { input.value = ""; onVal(path, ""); setPrev(""); } }, "Clear");
    return h("div", { class: "media-field" }, prev, h("div", { class: "ctl" }, input, h("div", { class: "btns" }, upBtn, pickBtn, clr, file)));
  }

  function control(f, path) {
    const v = getPath(draft, path);
    switch (f.t) {
      case "textarea": return h("textarea", { rows: 3, oninput: (e) => onVal(path, e.target.value) }, v ?? "");
      case "number": return h("input", { type: "number", step: "any", value: v ?? "", oninput: (e) => onVal(path, e.target.value === "" ? "" : Number(e.target.value)) });
      case "check": return h("input", { type: "checkbox", checked: v !== false, onchange: (e) => onVal(path, e.target.checked) });
      case "select": return h("select", { onchange: (e) => onVal(path, e.target.value) }, ...f.opts.map((o) => h("option", { value: o, selected: o === v }, o)));
      case "image": return mediaField(path, "image");
      case "video": return mediaField(path, "video");
      case "strlist": return strList(f, path);
      case "repeater": return repeater(f, path);
      case "table": return tableEditor(f, path);
      default: return h("input", { value: v ?? "", oninput: (e) => onVal(path, e.target.value) });
    }
  }
  function fieldEl(f, path) {
    const isCheck = f.t === "check";
    return h(isCheck ? "label" : "div", { class: "field" + (f.full || ["repeater", "table"].includes(f.t) ? " full" : "") + (isCheck ? " check" : "") },
      isCheck ? control(f, path) : null,
      f.l ? h("span", {}, f.l) : null,
      isCheck ? null : control(f, path),
      f.hint ? h("small", {}, f.hint) : null);
  }

  function strList(f, path) {
    const wrap = h("div", { class: "strlist" });
    const draw = () => {
      const arr = getPath(draft, path) || [];
      wrap.replaceChildren(...arr.map((s, i) => h("div", { class: "row" },
        f.area ? h("textarea", { rows: 3, oninput: (e) => { arr[i] = e.target.value; markDirty(); } }, s) : h("input", { value: s, oninput: (e) => { arr[i] = e.target.value; markDirty(); } }),
        h("button", { type: "button", class: "icon-btn", title: "Move up", onclick: () => { if (i) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; markDirty(); draw(); } } }, "↑"),
        h("button", { type: "button", class: "icon-btn del", title: "Remove", onclick: () => { arr.splice(i, 1); markDirty(); draw(); } }, "✕"))),
        h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => { arr.push(""); setPath(draft, path, arr); markDirty(); draw(); } }, "+ Add"));
    };
    draw(); return wrap;
  }

  function repeater(f, path) {
    const wrap = h("div");
    const draw = () => {
      const arr = getPath(draft, path) || []; setPath(draft, path, arr);
      wrap.replaceChildren(...arr.map((it, i) => h("div", { class: "rep-item" },
        h("div", { class: "rep-head" }, h("b", {}, `${f.item} ${i + 1}${f.titleKey && it[f.titleKey] ? " · " + it[f.titleKey] : ""}`),
          h("button", { type: "button", class: "icon-btn", title: "Move up", onclick: () => { if (i) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; markDirty(); draw(); } } }, "↑"),
          h("button", { type: "button", class: "icon-btn", title: "Move down", onclick: () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; markDirty(); draw(); } } }, "↓"),
          h("button", { type: "button", class: "icon-btn del", title: "Delete", onclick: () => { if (confirm(`Delete this ${f.item.toLowerCase()}?`)) { arr.splice(i, 1); markDirty(); draw(); } } }, "✕")),
        h("div", { class: "grid2" }, ...f.fields.map((sf) => fieldEl(sf, `${path}.${i}.${sf.k}`))))),
        h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => {
          const blank = {}; f.fields.forEach((sf) => (blank[sf.k] = sf.t === "number" ? 0 : sf.t === "select" ? sf.opts[0] : ""));
          arr.push(blank); markDirty(); draw();
        } }, `+ Add ${f.item.toLowerCase()}`));
    };
    draw(); return wrap;
  }

  function tableEditor(f, path) {
    const wrap = h("div", { style: "overflow-x:auto" });
    const draw = () => {
      const arr = getPath(draft, path) || []; setPath(draft, path, arr);
      wrap.replaceChildren(h("table", { class: "tbl mtbl" },
        h("thead", {}, h("tr", {}, ...f.cols.map((c) => h("th", {}, c.l)), h("th", {}, ""))),
        h("tbody", {}, ...arr.map((row, i) => h("tr", {},
          ...f.cols.map((c) => h("td", {}, h("input", { value: row[c.k] ?? "", oninput: (e) => { row[c.k] = e.target.value; markDirty(); } }))),
          h("td", { style: "white-space:nowrap" },
            h("button", { type: "button", class: "icon-btn", title: "Move up", onclick: () => { if (i) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; markDirty(); draw(); } } }, "↑"),
            " ",
            h("button", { type: "button", class: "icon-btn del", title: "Delete", onclick: () => { arr.splice(i, 1); markDirty(); draw(); } }, "✕")))))),
        h("button", { type: "button", class: "btn btn--ghost btn--sm", style: "margin-top:10px", onclick: () => { arr.push({}); markDirty(); draw(); } }, "+ Add mineral"));
    };
    draw(); return wrap;
  }

  function mapPreview() {
    const L = draft.location || {};
    const src = /^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/i.test(L.mapEmbedUrl || "") ? L.mapEmbedUrl
      : `https://maps.google.com/maps?q=${encodeURIComponent(L.mapQuery || "")}&z=15&output=embed`;
    return h("div", { class: "card" }, h("h3", {}, "Preview"), h("p", { class: "hint" }, "Updates when you reopen this page after editing."),
      h("iframe", { src, style: "width:100%;height:340px;border:0;border-radius:12px", loading: "lazy" }));
  }

  /* ---------------- pages ---------------- */
  function sectionPage(id) {
    const s = SECTIONS[id];
    const nodes = s.cards.map((c) => h("div", { class: "card" }, h("h3", {}, c.title), c.hint ? h("p", { class: "hint" }, c.hint) : h("div", { style: "height:12px" }),
      h("div", { class: "grid2" }, ...c.fields.map((f) => fieldEl(f, f.p)))));
    if (s.after) nodes.push(s.after());
    return nodes;
  }

  function dashboardPage() {
    const unread = inquiries.filter((i) => !i.read).length;
    return [
      h("div", { class: "kpis" },
        h("div", { class: "kpi" }, h("span", {}, "New quote requests"), h("strong", {}, String(unread))),
        h("div", { class: "kpi" }, h("span", {}, "Total requests"), h("strong", {}, String(inquiries.length))),
        h("div", { class: "kpi" }, h("span", {}, "Products listed"), h("strong", {}, String(content.products?.items?.length || 0))),
        h("div", { class: "kpi" }, h("span", {}, "Content last saved"), h("strong", { style: "font-size:1rem" }, content.updatedAt ? fmtDate(content.updatedAt) : "—"))),
      h("div", { class: "card" }, h("h3", {}, "Quick actions"), h("div", { style: "height:12px" }),
        h("div", { class: "quick" },
          h("a", { href: "#prices" }, "💰 Update mineral prices", h("small", {}, "Diamonds, rutile, zircon…")),
          h("a", { href: "#inquiries" }, "📥 Read quote requests", h("small", {}, `${unread} unread`)),
          h("a", { href: "#hero" }, "🎬 Change background video", h("small", {}, "Upload real site footage")),
          h("a", { href: "#products" }, "💎 Edit products", h("small", {}, "Add, remove, reorder")),
          h("a", { href: "#company" }, "📞 Contact details", h("small", {}, "Phone, WhatsApp, address")),
          h("a", { href: "/", target: "_blank" }, "↗ View live website", h("small", {}, "Opens in a new tab")))),
      h("div", { class: "card" }, h("h3", {}, "Latest quote requests"), h("div", { style: "height:8px" }),
        inquiries.length ? inqTable(inquiries.slice(0, 5)) : h("p", { class: "muted" }, "No requests yet.")),
    ];
  }

  function inqTable(list) {
    return h("div", { style: "overflow-x:auto" }, h("table", { class: "tbl" },
      h("thead", {}, h("tr", {}, ...["Date", "From", "Request", "Message", ""].map((t) => h("th", {}, t)))),
      h("tbody", {}, ...list.map((i) => {
        const wa = (i.phone || "").replace(/\D/g, "");
        return h("tr", { class: i.read ? "" : "unread" },
          h("td", { style: "white-space:nowrap" }, fmtDate(i.date), i.read ? null : h("div", {}, h("span", { class: "pill", style: "color:var(--gold)" }, "NEW"))),
          h("td", {}, h("b", {}, i.name), i.country ? h("div", { class: "muted" }, i.country) : null,
            i.email ? h("div", {}, h("a", { href: "mailto:" + i.email }, i.email)) : null, i.phone ? h("div", { class: "muted" }, i.phone) : null),
          h("td", {}, i.product || "—", i.qty ? h("div", { class: "muted" }, i.qty) : null),
          h("td", {}, h("div", { class: "inq-msg" }, i.message || "—")),
          h("td", {}, h("div", { class: "row-actions" },
            h("button", { class: "btn btn--ghost btn--sm", onclick: async () => { await api("PATCH", "/api/inquiries/" + i.id, { read: !i.read }); i.read = !i.read; route(); } }, i.read ? "Mark unread" : "Mark read"),
            wa ? h("a", { class: "btn btn--ghost btn--sm", target: "_blank", rel: "noopener", href: `https://wa.me/${wa}?text=${encodeURIComponent(`Hello ${i.name}, thank you for your request to ${content.company?.name || "us"}.`)}` }, "WhatsApp") : null,
            h("button", { class: "btn btn--danger btn--sm", onclick: async () => { if (!confirm("Delete this request?")) return; await api("DELETE", "/api/inquiries/" + i.id); inquiries = inquiries.filter((x) => x.id !== i.id); route(); toast("Deleted"); } }, "Delete"))));
      }))));
  }

  function inquiriesPage() {
    let filter = "all", q = "";
    const box = h("div");
    const draw = () => {
      const list = inquiries.filter((i) => (filter === "unread" ? !i.read : true) && JSON.stringify(i).toLowerCase().includes(q.toLowerCase()));
      box.replaceChildren(list.length ? inqTable(list) : h("p", { class: "muted" }, "No requests found."));
    };
    const sel = h("select", { style: "width:auto", onchange: (e) => { filter = e.target.value; draw(); } }, h("option", { value: "all" }, "All"), h("option", { value: "unread" }, "Unread only"));
    const search = h("input", { placeholder: "Search name, product, message…", style: "max-width:320px", oninput: (e) => { q = e.target.value; draw(); } });
    draw();
    return [h("div", { class: "card" },
      h("div", { class: "row-actions", style: "margin-bottom:16px;align-items:center" }, search, sel,
        h("a", { class: "btn btn--ghost btn--sm", href: "/api/inquiries.csv" }, "⬇ Export to Excel (CSV)"),
        h("button", { class: "btn btn--ghost btn--sm", onclick: async () => { await loadInquiries(); route(); toast("Refreshed"); } }, "↻ Refresh")),
      box)];
  }

  function mediaPage() {
    const grid = h("div", { class: "media-grid" }, h("p", { class: "muted" }, "Loading…"));
    const status = h("p", { class: "muted", style: "margin-top:8px" });
    const file = h("input", { type: "file", multiple: true, accept: "image/*,video/mp4,video/webm", hidden: true });
    const drop = h("div", { class: "drop", onclick: () => file.click() }, "⬆ Click or drag images / videos here to upload", status);
    async function doUpload(files) {
      for (const f of files) {
        try { await uploadFile(f, (p) => (status.textContent = `Uploading ${f.name}… ${p}%`)); toast("Uploaded " + f.name); }
        catch (e) { toast(f.name + ": " + e.message, true); }
      }
      status.textContent = ""; load();
    }
    file.addEventListener("change", () => doUpload([...file.files]));
    ["dragover", "dragenter"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => doUpload([...e.dataTransfer.files]));
    async function load() {
      const files = await api("GET", "/api/media");
      grid.replaceChildren(...(files.length ? files.map((m) => h("div", { class: "mitem" },
        h("div", { class: "th", style: m.type === "image" ? `background-image:url('${m.url}')` : "" }, m.type === "video" ? h("video", { src: m.url, muted: true, preload: "metadata" }) : null),
        h("div", { class: "meta" }, m.name, h("br"), fmtSize(m.size)),
        h("div", { class: "act" },
          h("button", { class: "btn btn--ghost btn--sm", onclick: () => { navigator.clipboard?.writeText(m.url); toast("Link copied: " + m.url); } }, "Copy link"),
          h("button", { class: "btn btn--danger btn--sm", onclick: async () => { if (!confirm("Delete " + m.name + "? Make sure it is not used on the website.")) return; await api("DELETE", "/api/media/" + encodeURIComponent(m.name)); toast("Deleted"); load(); } }, "Delete"))))
        : [h("p", { class: "muted" }, "No uploads yet.")]));
    }
    load();
    return [h("div", { class: "card" }, h("h3", {}, "Media library"), h("p", { class: "hint" }, "Images (jpg, png, webp, gif) and videos (mp4, webm), up to 80 MB each."), drop, file, grid)];
  }

  function backupsPage() {
    const box = h("div", {}, h("p", { class: "muted" }, "Loading…"));
    api("GET", "/api/backups").then((list) => box.replaceChildren(list.length ? h("table", { class: "tbl" },
      h("thead", {}, h("tr", {}, h("th", {}, "Saved version"), h("th", {}, ""))),
      h("tbody", {}, ...list.map((b) => h("tr", {}, h("td", {}, fmtDate(b.date)),
        h("td", {}, h("button", { class: "btn btn--ghost btn--sm", onclick: async () => {
          if (!confirm("Restore the website content to " + fmtDate(b.date) + "? The current version is backed up first.")) return;
          await api("POST", `/api/backups/${b.file}/restore`); await loadContent(); toast("Restored"); route();
        } }, "Restore")))))) : h("p", { class: "muted" }, "No backups yet. A backup is made automatically every time you save.")));
    return [h("div", { class: "card" }, h("h3", {}, "Backups"), h("p", { class: "hint" }, "The last 30 versions are kept automatically. Restore one if something goes wrong."), box)];
  }

  function accountPage() {
    const f = h("form", { class: "grid2", onsubmit: async (e) => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(f));
      if (d.newPassword && d.newPassword !== d.confirm) return toast("New passwords do not match", true);
      try { await api("POST", "/api/account", { currentPassword: d.currentPassword, newPassword: d.newPassword || undefined, newUsername: d.newUsername || undefined });
        toast("Account updated"); f.reset(); me.mustChange = false; $("#pwBanner").hidden = true; }
      catch (err) { toast(err.message, true); }
    } },
      h("label", { class: "field" }, h("span", {}, "Username"), h("input", { name: "newUsername", value: me?.username || "" })),
      h("label", { class: "field" }, h("span", {}, "Current password *"), h("input", { name: "currentPassword", type: "password", required: true, autocomplete: "current-password" })),
      h("label", { class: "field" }, h("span", {}, "New password (min. 8 characters)"), h("input", { name: "newPassword", type: "password", minlength: 8, autocomplete: "new-password" })),
      h("label", { class: "field" }, h("span", {}, "Confirm new password"), h("input", { name: "confirm", type: "password", autocomplete: "new-password" })),
      h("div", {}, h("button", { class: "btn btn--gold", type: "submit" }, "Update account")));
    return [h("div", { class: "card" }, h("h3", {}, "Admin account"), h("p", { class: "hint" }, "Change your username or password."), f)];
  }

  /* ---------------- media picker ---------------- */
  async function openPicker(kind, cb) {
    const m = $("#mediaModal"), g = $("#pickerGrid");
    g.replaceChildren(h("p", { class: "muted" }, "Loading…")); m.hidden = false;
    const files = (await api("GET", "/api/media")).filter((f) => f.type === kind);
    g.replaceChildren(...(files.length ? files.map((f) => h("div", { class: "mitem pick", onclick: () => { cb(f.url); m.hidden = true; markDirty(); } },
      h("div", { class: "th", style: kind === "image" ? `background-image:url('${f.url}')` : "" }, kind === "video" ? h("video", { src: f.url, muted: true, preload: "metadata" }) : null),
      h("div", { class: "meta" }, f.name))) : [h("p", { class: "muted" }, `No ${kind}s uploaded yet. Use Upload instead.`)]));
  }
  $("#mediaModal").addEventListener("click", (e) => { if (e.target.id === "mediaModal" || e.target.hasAttribute("data-close")) $("#mediaModal").hidden = true; });

  /* ---------------- router ---------------- */
  const TITLES = { dashboard: "Dashboard", inquiries: "Quote Requests", media: "Media Library", backups: "Backups", account: "Account" };
  function route() {
    const id = location.hash.slice(1) || "dashboard";
    const page = $("#page"); const y = window.scrollY;
    let nodes;
    if (SECTIONS[id]) nodes = sectionPage(id);
    else nodes = ({ dashboard: dashboardPage, inquiries: inquiriesPage, media: mediaPage, backups: backupsPage, account: accountPage }[id] || dashboardPage)();
    page.replaceChildren(...nodes);
    $("#pageTitle").textContent = SECTIONS[id]?.title || TITLES[id] || "Dashboard";
    renderMenu(id);
    $("#side").classList.remove("open");
    if (route.last === id) window.scrollTo(0, y); else window.scrollTo(0, 0);
    route.last = id;
  }
  window.addEventListener("hashchange", route);

  /* ---------------- boot ---------------- */
  async function loadContent() { content = await api("GET", "/api/content"); draft = clone(content); clearDirty(); }
  async function loadInquiries() { inquiries = await api("GET", "/api/inquiries"); }

  function showLogin() { $("#appView").hidden = true; $("#loginView").hidden = false; }
  async function startApp() {
    me = await api("GET", "/api/me");
    await Promise.all([loadContent(), loadInquiries()]);
    $("#loginView").hidden = true; $("#appView").hidden = false;
    $("#pwBanner").hidden = !me.mustChange;
    route();
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault(); $("#loginErr").textContent = "";
    try { await api("POST", "/api/login", Object.fromEntries(new FormData(e.target))); e.target.reset(); await startApp(); }
    catch (err) { $("#loginErr").textContent = err.message; }
  });
  $("#logoutBtn").addEventListener("click", async () => { if (dirty && !confirm("You have unsaved changes. Log out anyway?")) return; await api("POST", "/api/logout"); clearDirty(); showLogin(); });
  $("#menuBtn").addEventListener("click", () => $("#side").classList.toggle("open"));
  $("#saveBtn").addEventListener("click", async () => {
    try { $("#saveBtn").disabled = true; const r = await api("PUT", "/api/content", draft); draft.updatedAt = r.updatedAt; content = clone(draft); clearDirty(); toast("✓ Saved – the website is updated"); }
    catch (e) { toast(e.message, true); $("#saveBtn").disabled = false; }
  });
  $("#discardBtn").addEventListener("click", () => { if (!confirm("Discard all unsaved changes?")) return; draft = clone(content); clearDirty(); route(); });
  document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); if (dirty) $("#saveBtn").click(); } });

  startApp().catch(() => showLogin());
})();
