# Coffee Price List — live from Google Sheets

Two parts:

| Folder | What it is | Where it runs |
|---|---|---|
| `apps-script/Code.gs` | The **proxy**. Reads "Updated Coffee Offerings 2025" as you and serves the price list as public JSON. | Google Apps Script (free) |
| `index.html` | The **website**. One file: fetches the proxy, shows the list; customers click a coffee for flavor notes and bag sizes. | Any free static host |

Customers need no Google account and no Claude connector. Only the price-list columns are exposed, read-only.

---

## Step 1 — Deploy the proxy (about 5 minutes)

1. Open the **Updated Coffee Offerings 2025** sheet → **Extensions → Apps Script**.
   (Needs edit access. Or go to script.google.com → New project: the script opens the sheet by its ID either way.)
2. Delete the sample code, paste in all of `apps-script/Code.gs`, click **Save**.
3. In the function dropdown pick **testPayload** → **Run**. Approve the permission prompt (it asks to read your spreadsheets).
   Check **Execution log**: you should see your coffees as JSON.
4. **Deploy → New deployment** → gear icon → **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   → **Deploy**, then copy the **Web app URL** (ends in `/exec`).
5. Paste that URL in a browser tab. You should see `{"ok":true, ... "coffees":[...]}`.

**Later code changes:** Deploy → Manage deployments → edit (pencil) → Version: *New version* → Deploy. This keeps the same URL.
Editing the **sheet** needs no redeploy: the site shows changes within about 5 minutes (run `clearCache` for immediately).

## Step 2 — Configure the website

Open `index.html` (edit it right on GitHub: pencil icon), find the **SETTINGS** block near the top:

```js
apiUrl: 'PASTE_YOUR_WEB_APP_URL_HERE',   // ← your /exec URL
shopName: 'Coffee Price List',           // page title
tagline: '...',
orderUrl: '',                            // optional: Messenger / IG / shop link shows an "Order now" button
```

## Step 3 — Hosting

This repo is published with **GitHub Pages** (Settings → Pages → branch `main`, folder `/`). Any commit to `index.html` goes live in about a minute.

Other free options if you ever move it:

- **Netlify Drop** (easiest): go to app.netlify.com/drop, drag a folder containing `index.html` in. Done — you get a `*.netlify.app` link. Free account keeps it permanent.
- **GitHub Pages:** new public repo → upload `index.html` → Settings → Pages → Branch `main` / root → Save. URL: `https://<user>.github.io/<repo>/`.
- **Cloudflare Pages:** Workers & Pages → Create → Pages → Upload assets → upload `index.html`.

All three support a custom domain for free if you own one.

---

## Sheet rules the proxy relies on

- A header row containing **Roast, Origin, Varietal, Process, Price, Size** (any order; Origin may span two columns).
- Each coffee: a row with its name in Origin, then a row with its **flavor notes** (comma-separated) in the second Origin column.
- Same coffee name again with a different size/price → one coffee with several bag sizes (like Karo 125g / 250g).
- Adding, removing or reordering coffees, renaming roasts, changing prices: all fine.

## How it behaves

- Visitors' browsers keep the last list, so if Google is slow the saved list shows (with a small notice) instead of a blank page.
- Filters by roast, search by origin/flavor, sort by price, works on phones, follows dark mode.
- Proxy responses are cached 5 minutes, which keeps it well inside Apps Script's free quotas.
