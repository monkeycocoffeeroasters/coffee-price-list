/**
 * Coffee Price List — sheet proxy (Google Apps Script web app)
 *
 * Runs as the sheet's owner/editor and serves the price list as public,
 * read-only JSON, so website visitors never need Google access or a Claude
 * connector. Only the price-list columns are exposed — nothing else in the
 * spreadsheet or your Drive.
 *
 * Deploy: Deploy > New deployment > Web app
 *   Execute as: Me
 *   Who has access: Anyone
 * Then paste the /exec URL into CONFIG.apiUrl in the website's index.html.
 *
 * Availability: cross out (strikethrough) a coffee's name in the sheet to hide
 * it from the website. Crossing out just one bag size's size/price cell hides
 * only that size.
 */

// "Updated Coffee Offerings 2025"
const SPREADSHEET_ID = '17zmJMkw-3rn1XRhcU55_upC7myx2KV2b2Nvl8jEKVOc';
const SHEET_NAME = 'Sheet1';     // falls back to the first tab if renamed
const CACHE_SECONDS = 300;       // sheet edits show on the site within ~5 minutes
const CACHE_KEY = 'coffee-price-list-v2';

function doGet() {
  const cache = CacheService.getScriptCache();
  let body = cache.get(CACHE_KEY);
  if (!body) {
    try {
      body = JSON.stringify(buildPayload_());
      cache.put(CACHE_KEY, body, CACHE_SECONDS);
    } catch (err) {
      body = JSON.stringify({ ok: false, error: String((err && err.message) || err) });
    }
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

/** Run this once from the editor to authorize and preview the JSON in the log. */
function testPayload() {
  Logger.log(JSON.stringify(buildPayload_(), null, 2));
}

/** Clears the cache so the next visit reads the sheet fresh. */
function clearCache() {
  CacheService.getScriptCache().remove(CACHE_KEY);
}

function buildPayload_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  const range = sheet.getDataRange();
  const grid = range.getDisplayValues();
  const struck = range.getFontLines().map(function (row) {
    return row.map(function (line) { return line === 'line-through'; });
  });
  const merged = range.getMergedRanges();
  fillMerged_(grid, merged, range.getRow(), range.getColumn());
  fillMerged_(struck, merged, range.getRow(), range.getColumn());
  return parseGrid_(grid, struck);
}

/** Copies each merged range's value into every cell it covers. */
function fillMerged_(grid, merged, r0, c0) {
  merged.forEach(function (m) {
    const top = m.getRow() - r0;
    const left = m.getColumn() - c0;
    const value = grid[top][left];
    for (let r = 0; r < m.getNumRows(); r++) {
      for (let c = 0; c < m.getNumColumns(); c++) {
        if (grid[top + r]) grid[top + r][left + c] = value;
      }
    }
  });
}

/**
 * Sheet layout: a header row (Roast | Origin (2 cols) | Varietal | Process |
 * Price | Size), then for each coffee a row with its name, followed by a row
 * whose second Origin column holds its flavor notes. A coffee listed again
 * with another size/price (e.g. 125g and 250g) becomes one coffee with two sizes.
 * `struck` (optional) is a same-shaped grid of booleans: true where the cell's
 * text is crossed out. A crossed-out name skips that coffee and its notes row;
 * a crossed-out size or price cell skips that bag size.
 */
function parseGrid_(grid, struck) {
  const isStruck = function (r, c) { return !!(struck && struck[r] && struck[r][c]); };
  const SKIP = {};
  const norm = function (s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); };

  let h = -1;
  for (let r = 0; r < grid.length && h < 0; r++) {
    if (grid[r].some(function (v) { return norm(v).toLowerCase() === 'roast'; })) h = r;
  }
  if (h < 0) throw new Error('No header row with "Roast" found in the sheet.');

  const head = grid[h].map(function (v) { return norm(v).toLowerCase(); });
  const find = function (word) { return head.findIndex(function (v) { return v.indexOf(word) === 0; }); };
  const col = {
    roast: find('roast'),
    origin: find('origin'),
    varietal: find('varietal'),
    process: find('process'),
    price: find('price'),
    size: find('size'),
  };
  const lastOrigin = head.lastIndexOf('origin');
  col.notes = lastOrigin > col.origin ? lastOrigin : col.origin + 1;
  Object.keys(col).forEach(function (k) {
    if (col[k] < 0) throw new Error('Column "' + k + '" not found in the header row.');
  });

  const num = function (s) { const n = Number(String(s).replace(/[^0-9.]/g, '')); return isFinite(n) ? n : null; };
  const items = [];
  const byName = {};
  let cur = null;

  for (let r = h + 1; r < grid.length; r++) {
    const row = grid[r].map(norm);
    const name = row[col.origin];
    const notes = row[col.notes];
    if (name && isStruck(r, col.origin)) {
      cur = SKIP;          // unavailable: ignore this coffee and its notes row
      continue;
    }
    if (name) {
      if (!byName[name]) {
        byName[name] = {
          roast: row[col.roast],
          name: name,
          varietal: row[col.varietal],
          process: row[col.process],
          notes: [],
          sizes: [],
        };
        items.push(byName[name]);
      }
      cur = byName[name];
    } else if (cur === SKIP) {
      continue;
    } else if (notes && cur && !cur.notes.length) {
      cur.notes = notes.split(',').map(norm).filter(String);
    }
    const size = row[col.size];
    const price = num(row[col.price]);
    if (isStruck(r, col.size) || isStruck(r, col.price)) continue;
    if (cur && size && price != null && !cur.sizes.some(function (s) { return s.label === size; })) {
      cur.sizes.push({ label: size, grams: num(size), price: price });
    }
  }

  const available = items.filter(function (it) { return it.sizes.length > 0; });
  available.forEach(function (it) { it.sizes.sort(function (a, b) { return (a.grams || 0) - (b.grams || 0); }); });
  return { ok: true, currency: 'PHP', updated: new Date().toISOString(), coffees: available };
}
