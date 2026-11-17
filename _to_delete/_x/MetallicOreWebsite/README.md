# Metallic Ore Limited – Website

Dynamic website built from the company flyer.

## Structure
```
index.html          Main page
css/style.css       Styles (navy & gold theme, responsive)
js/prices.js        World market prices (live metals + indicative minerals)
js/main.js          Animations, calculator, map distance, WhatsApp form, chart
assets/             Background video, poster, logo, flyer
```

## Features
- Animated mining background video (`assets/mining-bg.mp4`) with gold-dust sparkle overlay
- Live scrolling price ticker
- Live gold, silver, platinum and palladium prices (free gold-api.com feed, refreshes every 60 s), per oz / gram / kg
- Live TradingView gold chart (XAU/USD)
- Gold value calculator (weight + purity)
- Indicative prices for diamonds, rutile, ilmenite, zircon, bauxite, iron ore, coltan
- Google Map of Wilkinson Road, Freetown, with Directions and "Show my distance"
- Quote form that opens WhatsApp (+232 77 460171), plus floating WhatsApp button

## Run it locally
Open the folder in VS Code and use the **Live Server** extension (right-click `index.html` → *Open with Live Server*).
Live prices, the chart and the map need an internet connection.

## Updating
- **Diamond / rutile / mineral prices:** edit `INDICATIVE_MINERALS` and `INDICATIVE_UPDATED` in `js/prices.js`.
- **Exact map pin:** replace the `src` of the map `<iframe>` in `index.html` with Google Maps → Share → *Embed a map* for your exact plot.
- **Background video:** replace `assets/mining-bg.mp4` with real site footage (keep it short, muted, under ~10 MB).

## Publishing
Upload the whole folder to any static host (Netlify, Vercel, GitHub Pages, cPanel hosting).
