import { chromium } from 'playwright';
import { db } from '../db';
import { scrapedProducts, priceHistory } from '../db/schema';
import { mapProductToFoodId, parseWeightInGrams } from '../lib/scrapers';
import { sql } from 'drizzle-orm';

const QUERIES = [
  'kvarg',
  'keso',
  'kycklingfile',
  'tonfisk',
  'nötfärs',
  'blandfärs',
  'ägg',
  'linser',
  'proteinpulver',
  'kasein'
];

async function scrapeWillys(browser: any, query: string): Promise<any[]> {
  console.log(`[Willys] Scraping for query "${query}"...`);
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  
  let searchData: any = null;
  
  // Listen for the search API response
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/axfood/rest/v1/search') || url.includes('/axfood/rest/p/search')) {
      try {
        const text = await response.text();
        const data = JSON.parse(text);
        if (data && data.results) {
          searchData = data;
          console.log(`[Willys] Intercepted search results for "${query}" (${data.results.length} items).`);
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
  });
  
  try {
    await page.goto(`https://www.willys.se/sok?q=${encodeURIComponent(query)}`, {
      waitUntil: 'networkidle',
      timeout: 20000
    });
    
    // Wait a little bit extra to ensure API is called and intercepted
    let elapsed = 0;
    while (!searchData && elapsed < 8000) {
      await page.waitForTimeout(500);
      elapsed += 500;
    }
  } catch (err) {
    console.error(`[Willys] Error loading search page for "${query}":`, err);
  } finally {
    await page.close();
  }
  
  if (!searchData || !searchData.results) {
    return [];
  }
  
  const products: any[] = [];
  for (const item of searchData.results) {
    const matchedFoodId = mapProductToFoodId(item.name);
    if (!matchedFoodId) continue; // Only store high-protein items we can map
    
    const price = item.priceValue || item.price?.value || 0;
    if (price <= 0) continue;
    
    const rawWeight = item.displayVolume || '';
    const weightG = parseWeightInGrams(rawWeight, item.name);
    
    // Parse compare price per kg/l
    let pricePerUnit = 0;
    if (item.comparePrice) {
      const match = item.comparePrice.match(/([\d,.:]+)\s*kr/);
      if (match) {
        pricePerUnit = parseFloat(match[1].replace(',', '.').replace(':', '.'));
      }
    }
    
    products.push({
      id: `willys-${item.code}`,
      store: 'willys',
      name: item.name,
      price: price,
      pricePerUnit: pricePerUnit || null,
      packageWeightG: weightG,
      unit: rawWeight.includes('kg') ? 'kg' : 'g',
      url: `https://www.willys.se/produkt/${item.code}`,
      imageUrl: item.image?.url || null,
      matchedFoodId: matchedFoodId,
      updatedAt: new Date().toISOString()
    });
  }
  
  return products;
}

async function scrapeCoop(browser: any, query: string): Promise<any[]> {
  console.log(`[Coop] Scraping for query "${query}"...`);
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  
  let searchData: any = null;
  
  // Listen for the search API response
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('coop.se/personalization/search/products')) {
      try {
        const text = await response.text();
        const data = JSON.parse(text);
        if (data && data.results && data.results.items) {
          searchData = data;
          console.log(`[Coop] Intercepted search results for "${query}" (${data.results.items.length} items).`);
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
  });
  
  try {
    await page.goto(`https://www.coop.se/handla/sok/?q=${encodeURIComponent(query)}`, {
      waitUntil: 'networkidle',
      timeout: 20000
    });
    
    // Wait a little bit extra to ensure API is called and intercepted
    let elapsed = 0;
    while (!searchData && elapsed < 8000) {
      await page.waitForTimeout(500);
      elapsed += 500;
    }
  } catch (err) {
    console.error(`[Coop] Error loading search page for "${query}":`, err);
  } finally {
    await page.close();
  }
  
  if (!searchData || !searchData.results || !searchData.results.items) {
    return [];
  }
  
  const products: any[] = [];
  for (const item of searchData.results.items) {
    const matchedFoodId = mapProductToFoodId(item.name);
    if (!matchedFoodId) continue; // Only store high-protein items we can map
    
    const price = item.salesPriceData?.b2cPrice || item.piecePriceData?.b2cPrice || 0;
    if (price <= 0) continue;
    
    const rawWeight = item.packageSizeInformation || item.packageSize || '';
    const weightG = parseWeightInGrams(item.packageSize || rawWeight, item.name);
    
    const pricePerUnit = item.comparativePriceData?.b2cPrice || 0;
    
    products.push({
      id: `coop-${item.id || item.ean}`,
      store: 'coop',
      name: item.name,
      price: price,
      pricePerUnit: pricePerUnit || null,
      packageWeightG: weightG,
      unit: String(item.packageSizeUnit || 'Gram').toLowerCase() === 'kilo' ? 'kg' : 'g',
      url: `https://www.coop.se/handla/sok/?q=${item.ean || item.id}`,
      imageUrl: item.imageUrl || null,
      matchedFoodId: matchedFoodId,
      updatedAt: new Date().toISOString()
    });
  }
  
  return products;
}

async function main() {
  console.log('Starting daily grocery scraping pipeline...');
  const browser = await chromium.launch({ headless: true });
  
  const allProducts: any[] = [];
  
  try {
    for (const q of QUERIES) {
      // Scrape Willys
      try {
        const willysProds = await scrapeWillys(browser, q);
        allProducts.push(...willysProds);
      } catch (err) {
        console.error(`Failed to scrape Willys for "${q}":`, err);
      }
      
      // Scrape Coop
      try {
        const coopProds = await scrapeCoop(browser, q);
        allProducts.push(...coopProds);
      } catch (err) {
        console.error(`Failed to scrape Coop for "${q}":`, err);
      }
      
      // Slight delay between queries to avoid throttling
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Scraping finished. Found ${allProducts.length} matching products.`);
    
    // Save to database
    console.log('Saving products to database...');
    let savedCount = 0;
    const nowStr = new Date().toISOString();
    
    for (const prod of allProducts) {
      try {
        // Upsert into scraped_products
        await db.insert(scrapedProducts).values({
          id: prod.id,
          store: prod.store,
          name: prod.name,
          price: prod.price,
          pricePerUnit: prod.pricePerUnit,
          packageWeightG: prod.packageWeightG,
          unit: prod.unit,
          url: prod.url,
          imageUrl: prod.imageUrl,
          matchedFoodId: prod.matchedFoodId,
          updatedAt: nowStr
        })
        .onConflictDoUpdate({
          target: scrapedProducts.id,
          set: {
            price: prod.price,
            pricePerUnit: prod.pricePerUnit,
            packageWeightG: prod.packageWeightG,
            url: prod.url,
            imageUrl: prod.imageUrl,
            matchedFoodId: prod.matchedFoodId,
            updatedAt: nowStr
          }
        })
        .run();
        
        // Insert into price_history
        await db.insert(priceHistory).values({
          scrapedProductId: prod.id,
          price: prod.price,
          updatedAt: nowStr
        }).run();
        
        savedCount++;
      } catch (dbErr) {
        console.error(`Failed to save product ${prod.id} to DB:`, dbErr);
      }
    }
    
    console.log(`Success! Scraped and saved ${savedCount} products into database.`);
  } catch (err) {
    console.error('Fatal error in scraping pipeline:', err);
  } finally {
    await browser.close();
  }
}

main();
