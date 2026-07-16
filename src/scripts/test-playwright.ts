import { chromium } from 'playwright';

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set user agent and viewport
  await page.setViewportSize({ width: 1280, height: 800 });
  
  console.log('Setting up response listener...');
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('coop.se/personalization/search/products')) {
      console.log('Intercepted Coop API URL:', url);
      try {
        const text = await response.text();
        const data = JSON.parse(text);
        console.log('Coop Response Keys:', Object.keys(data));
        if (data.results) console.log('Coop results keys:', Object.keys(data.results));
        const items = data.results?.items || [];
        console.log('Coop items count:', items.length);
        if (items.length > 0) {
          console.log('Coop first item keys:', Object.keys(items[0]));
          console.log('Coop first item details:', JSON.stringify(items[0], null, 2));
        }
      } catch (e) {
        console.log('Error parsing Coop JSON:', e);
      }
    }
  });
  
  console.log('Navigating to Coop search page for "kvarg"...');
  await page.goto('https://www.coop.se/handla/sok/?q=kvarg', { waitUntil: 'networkidle' });
  
  console.log('Waiting 5 seconds for client-side queries...');
  await page.waitForTimeout(5000);
  
  console.log('Closing browser...');
  await browser.close();
}

main();
