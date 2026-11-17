# Metallic Ore Limited – Website + Admin Panel

A dynamic website for Metallic Ore Limited with a password-protected admin panel.

## Start it

1. Install [Node.js](https://nodejs.org) 18 or newer (one-time).
2. Open this folder in VS Code → **Terminal → New Terminal**, then run:
   ```
   npm install
   npm start
   ```
3. Open:
   - Website: http://localhost:3000
   - Admin panel: http://localhost:3000/admin

**First login:** username `admin`, password `ChangeMe123!`. Change it straight away under **Account**.

## What you can manage in the admin panel

| Section | What you can change |
|---|---|
| Dashboard | New quote requests at a glance, quick links |
| Company & Contact | Name, tagline, phone, WhatsApp, email, address, logos, social links |
| Hero & Video | Headline, intro text, buttons, **background video upload**, poster image |
| About | Text, image, statistics |
| Products | Add / remove / reorder products, icons or photos |
| Market Prices | Live metals on/off, gold reference price, **diamond, rutile & mineral price table** |
| Why Choose Us / Export Process | Cards and steps |
| Location & Map | Address on Google Map, exact embed link, coordinates |
| Contact Form | Title, text, product options |
| Footer & SEO | Google title/description, footer text |
| Quote Requests | Every form submission saved here: mark read, reply on WhatsApp, delete, export CSV |
| Media Library | Upload / delete images and videos |
| Backups | Every save is backed up (last 30); one-click restore |
| Account | Change username and password |

Press **Save changes** (or Ctrl+S) and the website updates immediately.

## Folder structure
```
server.js          Node/Express server + API
admin/             Admin panel (HTML/CSS/JS)
public/            Public website
data/content.json  All website content (edited by the admin panel)
data/inquiries.json Quote requests (created automatically)
data/backups/      Automatic content backups
uploads/           Files uploaded in the admin panel
.env.example       Settings template → copy to .env
```

## Settings (.env)
Copy `.env.example` to `.env` to set the port, first-run admin login and a secret key.
If `JWT_SECRET` is not set, a random one is generated and stored in `data/.secret`.

## Going live
This needs a host that runs Node.js (static-only hosts like plain cPanel file hosting or GitHub Pages won't run the admin panel):
- **Render / Railway / Fly.io** – connect the folder (or a GitHub repo), start command `npm start`. Add a persistent disk for `data/` and `uploads/` so edits survive restarts.
- **VPS** (DigitalOcean, Contabo, etc.) – `npm install`, then run with `pm2 start server.js`, behind Nginx with HTTPS.
- **cPanel with "Setup Node.js App"** – point it to `server.js`.

Always use HTTPS in production so the admin login is encrypted.

## Notes
- Live gold/silver/platinum/palladium prices come from the free gold-api.com feed. Diamonds, rutile and other minerals have no free live feed, so set them under **Market Prices**.
- Back up the `data/` and `uploads/` folders regularly.
