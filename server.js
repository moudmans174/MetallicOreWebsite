/* =========================================================
   Metallic Ore Limited – website + admin panel server
   Run:  npm install   then   npm start
   Site:  http://localhost:3000        Admin: http://localhost:3000/admin
   ========================================================= */
require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "uploads");
const BACKUPS = path.join(DATA, "backups");
const CONTENT_FILE = path.join(DATA, "content.json");
const ADMIN_FILE = path.join(DATA, "admin.json");
const INQ_FILE = path.join(DATA, "inquiries.json");
[DATA, UPLOADS, BACKUPS].forEach((d) => fs.mkdirSync(d, { recursive: true }));

/* ---------- JSON file helpers (atomic writes) ---------- */
const readJSON = (f, dflt) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return dflt; } };
function writeJSON(f, obj) {
  const tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, f);
}

/* ---------- secrets & first-run admin account ---------- */
let JWT_SECRET = process.env.JWT_SECRET;
const SECRET_FILE = path.join(DATA, ".secret");
if (!JWT_SECRET) {
  JWT_SECRET = readJSON(SECRET_FILE, null);
  if (!JWT_SECRET) { JWT_SECRET = crypto.randomBytes(48).toString("hex"); writeJSON(SECRET_FILE, JWT_SECRET); }
}
if (!fs.existsSync(ADMIN_FILE)) {
  const user = process.env.ADMIN_USER || "admin";
  const pass = process.env.ADMIN_PASSWORD || "ChangeMe123!";
  writeJSON(ADMIN_FILE, { username: user, hash: bcrypt.hashSync(pass, 10), mustChange: !process.env.ADMIN_PASSWORD });
  console.log(`\n  Admin account created → username: ${user}  password: ${pass}\n  Change it after your first login.\n`);
}
if (!fs.existsSync(INQ_FILE)) writeJSON(INQ_FILE, []);

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (req.path.startsWith("/admin")) res.setHeader("X-Frame-Options", "DENY");
  next();
});

/* ---------- simple in-memory rate limiter ---------- */
function rateLimit(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip + req.path, now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: "Too many requests. Please try again later." });
    arr.push(now); hits.set(key, arr); next();
  };
}

/* ---------- auth ---------- */
const COOKIE = "mo_admin";
function auth(req, res, next) {
  try {
    req.admin = jwt.verify(req.cookies[COOKIE], JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: "Not logged in" }); }
}

app.post("/api/login", rateLimit(10, 15 * 60 * 1000), (req, res) => {
  const { username, password } = req.body || {};
  const a = readJSON(ADMIN_FILE, {});
  if (!username || !password || username !== a.username || !bcrypt.compareSync(password, a.hash))
    return res.status(401).json({ error: "Wrong username or password" });
  const token = jwt.sign({ u: a.username }, JWT_SECRET, { expiresIn: "8h" });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "strict", secure: req.secure, maxAge: 8 * 3600 * 1000 });
  res.json({ ok: true, mustChange: !!a.mustChange });
});
app.post("/api/logout", (req, res) => { res.clearCookie(COOKIE); res.json({ ok: true }); });
app.get("/api/me", auth, (req, res) => {
  const a = readJSON(ADMIN_FILE, {});
  res.json({ username: a.username, mustChange: !!a.mustChange });
});
app.post("/api/account", auth, (req, res) => {
  const { currentPassword, newPassword, newUsername } = req.body || {};
  const a = readJSON(ADMIN_FILE, {});
  if (!bcrypt.compareSync(currentPassword || "", a.hash)) return res.status(400).json({ error: "Current password is wrong" });
  if (newPassword) {
    if (newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });
    a.hash = bcrypt.hashSync(newPassword, 10); a.mustChange = false;
  }
  if (newUsername && newUsername.trim()) a.username = newUsername.trim().slice(0, 40);
  writeJSON(ADMIN_FILE, a);
  res.cookie(COOKIE, jwt.sign({ u: a.username }, JWT_SECRET, { expiresIn: "8h" }), { httpOnly: true, sameSite: "strict", secure: req.secure, maxAge: 8 * 3600 * 1000 });
  res.json({ ok: true });
});

/* ---------- site content ---------- */
app.get("/api/content", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(readJSON(CONTENT_FILE, {}));
});
app.put("/api/content", auth, (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body) || !body.company)
    return res.status(400).json({ error: "Invalid content" });
  // keep a backup of the previous version (last 30)
  if (fs.existsSync(CONTENT_FILE)) {
    fs.copyFileSync(CONTENT_FILE, path.join(BACKUPS, `content-${Date.now()}.json`));
    const old = fs.readdirSync(BACKUPS).filter((f) => f.startsWith("content-")).sort();
    old.slice(0, Math.max(0, old.length - 30)).forEach((f) => fs.unlinkSync(path.join(BACKUPS, f)));
  }
  body.updatedAt = new Date().toISOString();
  writeJSON(CONTENT_FILE, body);
  res.json({ ok: true, updatedAt: body.updatedAt });
});
app.get("/api/backups", auth, (req, res) => {
  res.json(fs.readdirSync(BACKUPS).filter((f) => f.startsWith("content-")).sort().reverse()
    .map((f) => ({ file: f, date: new Date(+f.replace(/\D/g, "")).toISOString() })));
});
app.post("/api/backups/:file/restore", auth, (req, res) => {
  const f = path.basename(req.params.file);
  const p = path.join(BACKUPS, f);
  if (!/^content-\d+\.json$/.test(f) || !fs.existsSync(p)) return res.status(404).json({ error: "Backup not found" });
  fs.copyFileSync(CONTENT_FILE, path.join(BACKUPS, `content-${Date.now()}.json`));
  fs.copyFileSync(p, CONTENT_FILE);
  res.json({ ok: true });
});

/* ---------- media uploads ---------- */
const ALLOWED = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "video/mp4": ".mp4", "video/webm": ".webm" };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) => {
      const base = path.parse(file.originalname).name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "file";
      cb(null, `${base}-${Date.now().toString(36)}${ALLOWED[file.mimetype]}`);
    },
  }),
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(ALLOWED[file.mimetype] ? null : new Error("Only images (jpg, png, webp, gif) and videos (mp4, webm) are allowed"), !!ALLOWED[file.mimetype]),
});
app.post("/api/upload", auth, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file received" });
    res.json({ ok: true, url: "/uploads/" + req.file.filename, name: req.file.filename, size: req.file.size });
  });
});
app.get("/api/media", auth, (req, res) => {
  const files = fs.readdirSync(UPLOADS).filter((f) => !f.startsWith(".")).map((f) => {
    const st = fs.statSync(path.join(UPLOADS, f));
    return { name: f, url: "/uploads/" + f, size: st.size, date: st.mtime, type: /\.(mp4|webm)$/i.test(f) ? "video" : "image" };
  }).sort((a, b) => b.date - a.date);
  res.json(files);
});
app.delete("/api/media/:name", auth, (req, res) => {
  const p = path.join(UPLOADS, path.basename(req.params.name));
  if (!fs.existsSync(p)) return res.status(404).json({ error: "Not found" });
  fs.unlinkSync(p); res.json({ ok: true });
});

/* ---------- quote requests / inquiries ---------- */
const clip = (v, n) => String(v || "").trim().slice(0, n);
app.post("/api/inquiries", rateLimit(5, 10 * 60 * 1000), (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot field – bots fill it
  const item = {
    id: crypto.randomUUID(), date: new Date().toISOString(), read: false,
    name: clip(b.name, 100), country: clip(b.country, 60), email: clip(b.email, 120), phone: clip(b.phone, 40),
    product: clip(b.product, 60), qty: clip(b.qty, 60), message: clip(b.message, 3000),
  };
  if (!item.name) return res.status(400).json({ error: "Name is required" });
  const list = readJSON(INQ_FILE, []);
  list.unshift(item); writeJSON(INQ_FILE, list.slice(0, 5000));
  res.json({ ok: true });
});
app.get("/api/inquiries", auth, (req, res) => res.json(readJSON(INQ_FILE, [])));
app.patch("/api/inquiries/:id", auth, (req, res) => {
  const list = readJSON(INQ_FILE, []);
  const it = list.find((i) => i.id === req.params.id);
  if (!it) return res.status(404).json({ error: "Not found" });
  if (typeof req.body.read === "boolean") it.read = req.body.read;
  if (typeof req.body.note === "string") it.note = clip(req.body.note, 2000);
  writeJSON(INQ_FILE, list); res.json({ ok: true });
});
app.delete("/api/inquiries/:id", auth, (req, res) => {
  writeJSON(INQ_FILE, readJSON(INQ_FILE, []).filter((i) => i.id !== req.params.id)); res.json({ ok: true });
});
app.get("/api/inquiries.csv", auth, (req, res) => {
  const cols = ["date", "name", "country", "email", "phone", "product", "qty", "message", "read", "note"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`;
  const csv = [cols.join(","), ...readJSON(INQ_FILE, []).map((i) => cols.map((c) => esc(i[c])).join(","))].join("\r\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=quote-requests.csv");
  res.send(csv);
});

/* ---------- static files ---------- */
app.use("/uploads", express.static(UPLOADS, { maxAge: "7d" }));
app.use("/admin", express.static(path.join(ROOT, "admin")));
app.use(express.static(path.join(ROOT, "public")));
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () => {
  console.log(`  Metallic Ore website →  http://localhost:${PORT}`);
  console.log(`  Admin panel          →  http://localhost:${PORT}/admin`);
});
