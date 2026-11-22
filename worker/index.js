import { catalog } from './catalog.js';
import { fetchOffer } from './retailers.js';

const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' });
const dayMilliseconds = 86400000;

export async function collect(db, scheduledTime, fetchPage) {
  const day = dayFormat.format(scheduledTime);
  const statement = db.prepare(`
    INSERT INTO observations (product_id, day, observed_at, status, price_ore, protein_grams)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (product_id, day) DO UPDATE SET
      observed_at = excluded.observed_at, status = excluded.status,
      price_ore = excluded.price_ore, protein_grams = excluded.protein_grams
    WHERE excluded.observed_at > observations.observed_at
      AND (excluded.status <> 'error' OR observations.status = 'error')
  `);

  const results = await Promise.all(catalog.map(async (product) => {
    try {
      return await fetchOffer(product, fetchPage);
    } catch (error) {
      console.warn('Price collection failed', product.id, error.message);
      return { status: 'error', priceOre: null };
    }
  }));

  const observedAt = new Date().toISOString();
  await db.batch(catalog.map(({ id, weight, protein }, index) => {
    const { status, priceOre } = results[index];
    return statement.bind(id, day, observedAt, status, priceOre, weight * protein / 100);
  }));

  const saved = results.filter(({ status }) => status !== 'error').length;
  console.log('Price collection finished', { day, saved, total: catalog.length });
  if (saved === 0) throw new Error('No retailer offers could be read');
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== '/api/prices') {
      return new Response('Sidan finns inte.', { status: 404 });
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    const today = dayFormat.format(Date.now());
    const since = dayFormat.format(Date.now() - 364 * dayMilliseconds);
    const observations = await env.PRICES.batch(catalog.map(({ id }) => env.PRICES.prepare(`
      SELECT day, observed_at AS observedAt, status, price_ore AS priceOre,
        protein_grams AS proteinGrams
      FROM observations WHERE product_id = ? AND day >= ? ORDER BY day
    `).bind(id, since)));

    const products = catalog.map(({ source, sku, variant, ...product }, index) => ({
      ...product, history: observations[index].results,
    }));
    const headers = { 'Cache-Control': 'public, max-age=120', 'Content-Type': 'application/json; charset=utf-8' };
    if (request.method === 'HEAD') return new Response(null, { headers });
    return new Response(JSON.stringify({ today, products }), { headers });
  },

  async scheduled(event, env) {
    await collect(env.PRICES, event.scheduledTime);
  },
};
