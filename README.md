# Protein per krona

[Jämför proteinpulver](https://protein-per-krona.plate-snap-admin.workers.dev/) från svenska varumärken. Webbplatsen rankar valda förpackningar efter kronor per 100 gram deklarerat protein och visar hur priset förändras över tid.

## Data

- Varje rad avser en viss smak, förpackningsstorlek och butik. [Produktkatalogen](worker/catalog.js) anger vikt och protein från respektive näringsdeklaration.
- En Cloudflare Worker hämtar publika butikspriser dagligen kl. 05.00 UTC. Cloudflare D1 lagrar högst en observation per produkt och svensk kalenderdag, även vid omkörning. Ett saknat pris lämnar en lucka i diagrammet.
- Jämförpriset är butikspris i kronor delat med gram protein i förpackningen, multiplicerat med 100. Frakt och rabatter som kräver inloggning, rabattkod eller ett flerköp ingår inte.
- Proteinkvalitet visas med ingrediensdata från [Mathai, Liu & Stein (2017), tabell 7](https://doi.org/10.1017/S0007114517000125). DIAAS för färdiga produkter är okänt. Tabellen rangordnar produkter efter pris.
- [Prisdata i JSON](https://protein-per-krona.plate-snap-admin.workers.dev/api/prices) visar upp till 365 dagar. Priset anges i öre. Observationen sparar mängden protein som användes vid mätningen så att äldre jämförpriser förblir korrekta vid ändrade näringsvärden.

## Kör lokalt

Du behöver Node.js 24 och npm.

```sh
npm ci
npm test
npm run db:local
npm run dev
```

Öppna `http://localhost:8787`. Initiera den lokala databasen medan utvecklingsservern körs med `curl -fsS 'http://localhost:8787/cdn-cgi/local/scheduled'`. `npm run probe` kontrollerar butikspriserna utan att skriva till databasen.

Den gamla TanStack-appen finns i Git-historiken. Dess SQLite-fil avsåg dagligvaror och hör till den tidigare versionen av projektet. Den aktuella jämförelsen hämtar priser för proteinpulver.

## Publicera en egen instans

Frontend är vanlig HTML, CSS och JavaScript i `public/`. Worker och schemaläggning konfigureras i `wrangler.jsonc`. Skapa en egen Cloudflare D1-databas med `npx wrangler d1 create protein-per-krona` och ersätt databasens ID i konfigurationen. Byt även Worker-namn om du vill ha ett annat namn.

```sh
npm run db:remote
npm run deploy
```

Lägg till eller uppdatera en produkt i katalogen, bekräfta aktuell näringsdeklaration och kör `npm run probe` och `npm test`. En ny smak eller förpackningsstorlek får ett eget produkt-ID. Lägg till en parsare i `worker/retailers.js` när en butik kräver ett annat prisformat.

## Licens

Projektets kod är tillgänglig under [MIT](LICENSE). De kopierade Marketingskills-filerna i `.agents/skills` och `.claude/skills` har en [separat upphovsrättsnotis](THIRD_PARTY_LICENSES.md).
