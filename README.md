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

## Automatisering (Daglig Refresh i Molnet)

När applikationen hostas på **Coolify**, **Render**, **Vercel** eller liknande molnplattformar kan prisskrapningen automatiseras genom att anropa applikationens inbyggda HTTP API-endpoint på ett schema.

### Exponerad API-endpoint: `/api/scrape`

Endpointen stöder både `GET` och `POST`-anrop. Av säkerhetsskäl kräver den en autentiseringstoken i produktion för att förhindra överbelastning av servern då Playwright-instansen är resurskrävande.

#### Konfiguration:
1.  Sätt miljövariabeln `CRON_SECRET` på din server (t.ex. i Coolify eller Render dashboard) till en slumpmässig, svårgissad sträng.
2.  Anropa endpointen med parametern `token` eller headern `x-cron-token`:
    *   **HTTP GET:** `https://din-app.se/api/scrape?token=DITT_CRON_SECRET`
    *   **HTTP Header:** `x-cron-token: DITT_CRON_SECRET`

*Obs: I utvecklingsläge (`NODE_ENV === 'development'`) tillåts körning utan token såvida inte `CRON_SECRET` har definierats i din lokala `.env`.*

#### Hur det fungerar:
När API-endpointen anropas med en giltig token startar den skrapningen **asynkront i bakgrunden** och svarar omedelbart med HTTP-status `202 Accepted` och JSON-strukturen:
```json
{
  "status": "scraping_started",
  "message": "Daily grocery price scraping pipeline initiated in the background..."
}
```
Detta förhindrar att anropet tajmar ut (då skrapningen tar ca 30 sekunder att köra) och gör att externa schemaläggare kan anropa den stabilt.

### Konfigurera schemaläggning

#### 1. Via Coolify (Rekommenderas)
I din Coolify dashboard för din applikation:
1.  Gå till fliken **Cron Jobs**.
2.  Klicka på **Add Cron Job**.
3.  Ange önskat schema (t.ex. `0 4 * * *` för varje morgon kl 04:00).
4.  Ange kommandot:
    ```bash
    curl -X GET "http://localhost:3000/api/scrape?token=$CRON_SECRET"
    ```
    *(Coolify kommer att köra anropet internt i nätverket eller externt mot din container).*

#### 2. Via externa schemaläggare (t.ex. Cron-Job.org / Vercel Cron)
Ställ in en schemalagd HTTP-begäran som anropar:
`https://din-app.se/api/scrape?token=DITT_CRON_SECRET` varje natt.

#### 3. Alternativ: Köra lokalt cronjobb på servern
Om du vill köra ett lokalt cronjobb som kör CLI-skriptet via terminalen:
```bash
0 4 * * * cd /Users/ossianhempel/Developer/protein-per-krona && bun run scrape >> cron.log 2>&1
```

---

## Licens
Privat förvaringsplats tillhörande [ossianhempel](https://github.com/ossianhempel).
