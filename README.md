# Flight Miles Tracker

An independent, mobile-first, installable web app for LOT Polish Airlines flights. Compare Turkish Airlines Miles&Smiles Status Miles and award Miles with Miles & More award miles, Points, Qualifying Points and HON Circle Points. Log individual flight segments and see progress towards loyalty status. Flight history and dated starting balances remain in the local browser; no airline login or API key is required.

## Put it on your iPhone using GitHub Pages

1. On GitHub, create a new **public** repository, e.g. `flight-miles-tracker`.
2. **Unzip the downloaded project.** Upload **all the contents of the `flight-miles-tracker` folder** into the repository root (`index.html`, `app.mjs`, `logic.mjs`, `airports.mjs`, `styles.css`, `sw.js`, `manifest.webmanifest`, and the `assets` folder and `enhancements.mjs`). Do not upload the ZIP as a single file.
3. In GitHub, go to **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root)**, then Save.
4. Your app will become available at `https://YOUR-GITHUB-USERNAME.github.io/flight-miles-tracker/` (replace with your actual account and repository names). Open that URL in **Safari on the iPhone**.
5. Tap Safari's **Share** icon → **Add to Home Screen** → **Add**. The app opens like a regular app and, once loaded, is available offline.

Alternatively, any HTTPS static host with service workers works. For desktop preview, serve the directory with `python3 -m http.server 8000`, and visit `http://localhost:8000`.

## How to use

* The default flight is **WAW → OTP**, LOT Economy booking class **E**.
* Choose a saved route or enter the three-letter IATA codes. There are **175 included airports** for offline distance calculations; for any other airports, use **More options** to enter the great-circle distance and route category manually.
* Set booking class and one-way/return. The app instantly compares **both programmes**. Only **one** programme can be credited for the same flight segment.
* Default Miles & More award-mile figures assume a **LOT-issued 080 ticket** or another qualifying booking that uses booking class. If the fare-based Lufthansa Group calculation applies, select it under **More options** and enter the **eligible airfare in euros**. The award-mile figure then uses 4× eligible airfare (or 6× if you hold the qualifying Miles & More frequent flyer status). Points calculations do not change.
* To save flights, choose a travel date and the programme to which you intend to credit them. A return journey is saved as **two flight segments**.
* In **Status tracker**, enter your current Turkish Miles&Smiles and Miles & More balances as dated snapshots. Previously logged flights on or before the snapshot dates are not added again; flights after those dates are counted for the respective programme. Turkish's rolling status window can expire, so refresh the snapshot from your official account periodically.
* Under **Scan airline screenshots**, choose up to 10 images. The browser loads an English-language OCR reader on first use, reads text on the device and proposes balance figures and recognisable flight routes/dates. Check and correct the extracted text and numbers before pressing Save. For flight entries, choose/confirm the LOT booking class and credited programme: calculated credits are estimates rather than posted airline transactions.
* Save entries as **Planned** until you actually fly. Mark flights **Flown** in Flight log. Only flown entries are counted as earned in Status tracker.
* Export CSV for spreadsheets or JSON to back up and restore your data. Keep the JSON file if switching phones or clearing browser data.

## Important calculation details

* **Turkish Miles&Smiles, LOT-operated:** by distance × booking-class multiplier with a per-segment minimum. For eligible LOT flights the airline permits both award Miles and Status Miles.
* **Miles & More, LOT-issued (080):** fixed award miles for domestic / cross-border European flights, distance-based for routes beyond Europe, according to booking class. Some combinations (e.g. domestic Business award miles) are not listed in the published chart; the app labels award miles as unavailable rather than guessing.
* **Miles & More Points / Qualifying Points:** LOT-operated continental Economy 20, Premium Economy 20, Business 40; intercontinental Economy 60, Premium Economy 80, Business 200 per segment. HON Circle Points are only for eligible Business flights. Continental Premium Economy is listed by Miles & More even though it is not offered by LOT on typical European routes.
* Airport distance is **shortest great-circle distance**, rounded to miles. Airlines may use different mileage reference distances; amounts are **estimates**.
* Certain codeshares, special fare tickets, partner flights, fare-class exceptions and promotions may not qualify or may differ. This app assumes the flight is **operated by LOT**. A LO codeshare operated by another airline is **not** covered by these tables.
* **Turkish initial Elite qualification:** 40,000 Status Miles in the rolling preceding 12 months. **Miles & More Frequent Traveller:** 650 Points + 325 Qualifying Points in a calendar year; **Senator:** 2,000 Points + 1,000 Qualifying Points. Renewal conditions differ. The tracker adds eligible logged flights to dated starting snapshots, and its future-flight projection is indicative. It does not automatically deduct award-mile redemptions or expired historical status miles.

### Example: WAW → OTP, LOT Economy E (one-way)

* Approximate great-circle distance: **575 miles**.
* Turkish Miles&Smiles: **575 Status Miles** and **575 award Miles**.
* Miles & More (LOT 080): **750 award miles**, **20 Points**, **20 Qualifying Points**.
* For an identical return itinerary: **1,150 Turkish Status Miles** versus **1,500 M&M award miles + 40 Points + 40 Qualifying Points**, credited to one programme only.

## Primary sources (checked 13 November 2026)

* [Turkish Miles&Smiles · Earning on LOT Polish Airlines](https://www.turkishairlines.com/en-lu/miles-and-smiles/program-partners/airlines/lot-polish-airlines/)
* [Miles & More · LOT earning table and Points](https://www.miles-and-more.com/pl/en/earn/lot-polish-airlines/partner/airlines/lot-polish-airlines/earn/basic-offer/lot-polish-airlines_earn_basic_4m.html)
* [LOT · Miles & More programme and status Points](https://www.lot.com/pl/en/explore/loyalty-programmes/miles-and-more)
* [Miles & More status thresholds](https://www.miles-and-more.com/pl/en/program/status-benefits/status-level-comparison.html)
* [Turkish Airlines membership status qualification](https://www.turkishairlines.com/uk-int/miles-and-smiles/membership-statuses/)

## Security and privacy

All calculations run in the browser. Flight history is stored using `localStorage` on the device and specific website origin. The screenshot scanner downloads the Tesseract.js OCR software from jsDelivr when first used (internet required) but processes selected images in your browser; the app does not upload screenshots to an API or server. Automatic reading is best-effort and requires confirmation. No account information is sent by the app itself. A public GitHub repository reveals the *app code*, **not your private local flight log**. Back up your history before clearing browser data or moving to a new device.

This is an unofficial tool and is not affiliated with LOT Polish Airlines, Turkish Airlines or Miles & More. Airline terms prevail, and mileage rules may change.

## Files

* `index.html` and `styles.css`: responsive interface.
* `app.mjs`: interaction, local log, JSON/CSV export and status tracker.
* `enhancements.mjs`: dated programme snapshots, browser-based screenshot reading and reviewed imports.
* `logic.mjs`: source-driven calculation formulas.
* `airports.mjs`: offline reference airport coordinates, curated for common LOT and international trips.
* `manifest.webmanifest`, `sw.js`, `assets/`: installability and offline support.
* `tests/`: calculator regression tests.
