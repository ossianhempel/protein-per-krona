import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const foods = sqliteTable('foods', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category'),
  protein: real('protein').notNull(), // grams per 100g
  carbs: real('carbs').notNull(),     // grams per 100g
  fat: real('fat').notNull(),         // grams per 100g
  calories: real('calories').notNull(), // kcal per 100g
  
  // Essential Amino Acids (mg per 100g)
  histidine: real('histidine'),
  isoleucine: real('isoleucine'),
  leucine: real('leucine'),
  lysine: real('lysine'),
  methionine: real('methionine'),
  cysteine: real('cysteine'),
  phenylalanine: real('phenylalanine'),
  tyrosine: real('tyrosine'),
  threonine: real('threonine'),
  tryptophan: real('tryptophan'),
  valine: real('valine'),
  
  // Calculated Amino Acid Score (AAS)
  aas: real('aas'),
});

export const scrapedProducts = sqliteTable('scraped_products', {
  id: text('id').primaryKey(), // store-specific id, e.g., "willys-10123"
  store: text('store').notNull(), // "willys" | "coop"
  name: text('name').notNull(),
  price: real('price').notNull(), // current price in SEK
  pricePerUnit: real('price_per_unit'), // price per kg or unit
  packageWeightG: real('package_weight_g').notNull(), // size in grams
  unit: text('unit'), // e.g., "g", "kg"
  url: text('url').notNull(),
  imageUrl: text('image_url'),
  matchedFoodId: integer('matched_food_id').references(() => foods.id),
  updatedAt: text('updated_at').notNull(), // ISO timestamp
});

export const priceHistory = sqliteTable('price_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scrapedProductId: text('scraped_product_id').notNull().references(() => scrapedProducts.id, { onDelete: 'cascade' }),
  price: real('price').notNull(),
  updatedAt: text('updated_at').notNull(),
});
