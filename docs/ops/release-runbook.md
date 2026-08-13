# Release runbook

Deja is local‑first, so there's **nothing server‑side to deploy** — "launching" means two independent things: publishing the extension, and (optionally) hosting the landing page.

## 1. Publish the extension (Chrome Web Store)

1. **Bump the version** in `package.json` (it's injected into the manifest at build) — or run `npm run release -- <version>`, which bumps, builds, and zips in one step.
2. **Build:** `npm run build`.
3. **Zip the build output** — the *contents* of `dist/`, not the folder:
   ```bash
   cd dist && zip -r ../deja-<version>.zip . && cd ..
   ```
4. **Create a developer account** at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (one‑time US$5 fee).
5. **Create the listing** and upload the zip. Fill in the description, **permission justifications**, **single‑purpose** statement, and **data‑safety** answers — all drafted in [`store/listing.md`](../../store/listing.md). Add the `1280×800` screenshots already in [`store/`](../../store/) (shot list + remaining promo/video notes in [`store/assets.md`](../../store/assets.md)), and link a hosted **privacy‑policy URL** (`site/privacy.html` via Netlify Drop — see the GTM plan).
6. **Submit for review** as **Unlisted** first. Expect a review wait; ship updates by repeating steps 1–3 and uploading a new zip. The repo is open source (MIT); leave the listing Unlisted until the Week 2 go/no-go.

## 2. Host the landing page (optional)

`site/index.html` (+ `site/privacy.html`) is self‑contained with no build step and no third‑party requests. Host on any static host — **Netlify Drop** is the GTM plan default (drag the `site/` folder); GitHub Pages / Vercel / Cloudflare Pages also work. Before going live, replace `REPLACE_EXTENSION_ID` (store URL). Source links already point at the public GitHub repo.

## 3. Soft launch

Per the roadmap: invite ~50 users from communities you're already in, watch how the resurface moment lands, and tune the thresholds before any broad launch. No analytics by design — listen, don't measure.

> Firefox/Edge are not targeted yet (this is an MV3 Chrome build); both are plausible later with minor manifest work.
