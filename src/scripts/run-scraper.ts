import { runScraperPipeline } from '../lib/scraper-pipeline';

async function main() {
  const result = await runScraperPipeline();
  if (result.success) {
    console.log(`CLI Scraping completed successfully. Saved ${result.count} products.`);
    process.exit(0);
  } else {
    console.error(`CLI Scraping failed: ${result.error}`);
    process.exit(1);
  }
}

main();
