import { db } from '../db';
import { foods } from '../db/schema';
import { like, or } from 'drizzle-orm';

async function main() {
  console.log('Finding matching foods in database...');
  
  const keywords = ['kvarg', 'cottage cheese', 'kyckling', 'tonfisk', 'nötfärs', 'linser', 'bönor', 'ägg', 'vassle', 'kasein', 'soja'];
  
  for (const kw of keywords) {
    const results = await db.select({
      id: foods.id,
      name: foods.name,
      category: foods.category,
      protein: foods.protein
    })
    .from(foods)
    .where(like(foods.name, `%${kw}%`))
    .limit(10);
    
    console.log(`\nKeyword: "${kw}" -> found ${results.length} matches:`);
    for (const r of results) {
      console.log(`  - [ID: ${r.id}] ${r.name} (Protein: ${r.protein}g) - ${r.category}`);
    }
  }
}

main();
