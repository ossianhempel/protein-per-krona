# Protein per krona 🇸🇪

En fullstack-applikation byggd med **TanStack Start**, **SQLite** och **Drizzle ORM** som rankar och jämför svenska livsmedel utifrån protein per krona samt proteinkvalitet (Amino Acid Score - AAS). Applikationen uppdateras dagligen genom en automatiserad scraper (Playwright) som hämtar aktuella priser från Willys och Coop.

## Nyckelfunktioner
*   **Protein per SEK-rankning (g/kr):** Hitta de absolut billigaste källorna till protein i matbutikerna idag.
*   **Amino Acid Score (AAS) & Proteinkvalitet:** Beräknar proteinkvaliteten baserat på WHO/FAO:s (2007) referensmönster för vuxna för de 9 essentiella aminosyrorna. Visar grafiskt eventuella begränsande aminosyror (t.ex. lysin i havre/vete, metionin i baljväxter).
*   **Dagliga priser & prishistorik:** Skrapar automatiskt priser från Willys och Coop och matchar dem mot databasen med Drizzle ORM. Visualiserar prishistorik över tid med anpassade SVG-linjediagram.
*   **Snabba filter & sök:** Filtrera efter matbutik, livsmedelskategori (Mejeri & Ägg, Kött, Fisk, Baljväxter, Kosttillskott) samt sök direkt bland varumärken och produkter.

---

## Teknisk arkitektur

### 1. Databas & Ingestion
*   **Drizzle ORM + SQLite (`sqlite.db`):** WAL-läge aktiverat för högpresterande läs- och skrivoperationer.
*   **Livsmedelsdatabasen (Livsmedelsverket):** Fullständig ingestion från Livsmedelsverkets XLSX-rådata.
*   **AAS-beräkning:** Beräknar biologiskt värde utifrån WHO/FAO:s referensmönster för vuxna (mg per gram protein):
    *   Histidin: 15 | Isoleucin: 30 | Leucin: 59 | Lysin: 45
    *   Metionin + Cystein: 22
    *   Fenylalanin + Tyrosin: 38
    *   Treonin: 23 | Tryptofan: 6 | Valin: 39

### 2. Scrapers (Playwright)
Scraping-pipelinen (`src/scripts/run-scraper.ts`) körs headless via Playwright:
*   Navigerar till Willys och Coop sökresultatsidor.
*   Interceptar nätverkstrafik för att hämta butikernas interna REST API JSON-svar. Detta gör datahämtningen 100% robust jämfört med att förlita sig på sköra CSS-klasser i DOM:en.
*   Matchar automatiskt skrapade produkter mot livsmedelsdatabasens ID:n samt rensar och sparar priser och prishistorik.

---

## Installation & Kom igång

### Förutsättningar
*   **Bun** eller **Node.js** (v20+)
*   Playwright webbläsare installerade (`npx playwright install chromium`)

### 1. Installera beroenden
```bash
bun install
# eller
npm install
```

### 2. Konfigurera databas och importera Livsmedelsverket
Skapa databasschemat och importera all data från Livsmedelsverkets rådatabas samt beräkna AAS för alla livsmedel:
```bash
bun run db:push
bun run src/scripts/import-livsmedel.ts
```

### 3. Kör scrapern manuellt
Kör prisskrapningen mot Willys och Coop för att fylla databasen med färska matbutikspriser:
```bash
bun run scrape
```

### 4. Starta applikationen lokalt
Kör utvecklingsservern:
```bash
bun run dev
```
Applikationen finns nu tillgänglig på [http://localhost:3000](http://localhost:3000).

---

## Automatisering (Daglig Refresh)

För att hålla priserna uppdaterade varje morgon rekommenderas det att sätta upp ett cronjobb på din server.

Kör `crontab -e` och lägg till följande rad för att köra scrapern varje natt kl 04:00:
```bash
0 4 * * * cd /Users/ossianhempel/Developer/protein-per-krona && bun run scrape >> cron.log 2>&1
```

---

## Licens
Privat förvaringsplats tillhörande [ossianhempel](https://github.com/ossianhempel).
