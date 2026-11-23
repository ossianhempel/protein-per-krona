import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { dayNumber, plotSegments, pricePer100g, priceRank } from '../public/prices.js';
import { catalog } from '../worker/catalog.js';
import worker, { collect } from '../worker/index.js';
import { fetchOffer, readOffer } from '../worker/retailers.js';

const tyngre = catalog.find(({ id }) => id === 'tyngre-whey-vanilla');
const core = catalog.find(({ source }) => source === 'core');

function productPage(metadata) {
  return `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', ...metadata })}</script>`;
}

function offer(product, overrides = {}) {
  return { '@type': 'Offer', url: product.url, price: 399.95, priceCurrency: 'SEK', availability: 'https://schema.org/InStock', ...overrides };
}

test('the price is for the exact variant and out-of-stock listings have no price', () => {
  const offers = [
    offer(core, { sku: 'other', url: core.url + '9', price: 299 }),
    offer(core, { sku: core.sku }),
  ];
  assert.deepEqual(readOffer(productPage({ offers }), core), { status: 'ok', priceOre: 39995 });
  assert.throws(() => readOffer(productPage({ offers: offers.slice(0, 1) }), core), /Exact offer/);
  const unavailable = offer(tyngre, { availability: 'https://schema.org/OutOfStock' });
  assert.deepEqual(readOffer(productPage({ sku: tyngre.sku, offers: unavailable }), tyngre),
    { status: 'unavailable', priceOre: null });
  assert.throws(() => readOffer(productPage({ sku: tyngre.sku, offers: offer(tyngre, { priceCurrency: 'EUR' }) }), tyngre), /SEK/);
});

test('Gymgrossisten and MM Sports report the current one-bag price for the target variant', () => {
  const star = catalog.find(({ source }) => source === 'gymgrossisten');
  const body = catalog.find(({ source }) => source === 'mmsports');
  const starPage = `
    <div>Ord.pris 449 kr</div>
    <div itemprop="offers">
      <meta itemprop="sku" content="587" />
      <meta itemprop="availability" content="InStock" />
      <meta itemprop="priceCurrency" content="SEK" />
      <meta itemprop="price" content="399.0" />
      <meta itemprop="url" content="https://www.gymgrossisten.com/whey-80-1-kg-vanilj/587.html" />
      <div itemprop="shippingDetails"></div>
    </div>`;
  const bodyPage = `
    <div>Engångsköp 379 kr</div>
    <div>Prenumeration 349 kr</div>
    <meta itemprop="priceCurrency" content="SEK" />
    <script>
      var productJSON = {"variants":{"5148":[[379,12,{},1,379,"B2411",0,0,449]],"54509":[[349,7,{},1,349,"B1234567"]]}};
    </script>`;
  assert.deepEqual(readOffer(starPage, star), { status: 'ok', priceOre: 39900 });
  assert.deepEqual(readOffer(bodyPage, body), { status: 'ok', priceOre: 37900 });
  assert.throws(() => readOffer(bodyPage, { ...body, variant: '54509' }), /Exact offer/);
});

test('a product group keeps the price tied to the requested Myprotein variant', () => {
  const target = catalog.find(({ source }) => source === 'myprotein');
  const variant = (sku, offers) => ({ '@type': 'Product', sku, offers });
  const data = { '@graph': [{ '@type': 'ProductGroup', hasVariant: [
    variant('wrong-flavour', offer(target, { price: 199 })),
    variant(target.sku, offer(target, { url: target.url + '9', price: 299 })),
    variant(target.sku, offer(target, { price: 455 })),
  ] }] };
  const page = `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
  assert.deepEqual(readOffer(page, target), { status: 'ok', priceOre: 45500 });
});

test('Bulk uses the guest price and stock for the resolved Swedish variant', async () => {
  const target = catalog.find(({ source }) => source === 'bulk');
  const settings = ['x-api-key', 'environment-id', 'website-code', 'store-view-code', 'store-code', 'customer-group'];
  const priceForSku = (sku, inStock = true) => async (url, init) => {
    const request = new URL(url);
    if (request.pathname === '/se/configs.json') {
      return Response.json({ data: settings.map((field) => ({ key: `commerce-${field}`, value: `swedish-${field}` })) });
    }
    assert.equal(request.pathname, '/se/cs-graphql');
    assert.deepEqual(JSON.parse(request.searchParams.get('variables')), {
      sku: 'BPB-WPC8-0000',
      optionIds: [btoa('configurable/179/25'), btoa('configurable/178/26')],
    });
    const headers = new Headers(init.headers);
    for (const field of settings) {
      assert.equal(headers.get(field === 'x-api-key' ? field : `magento-${field}`), `swedish-${field}`);
    }
    return Response.json({ data: { refineProduct: {
      sku, inStock, price: { final: { amount: { value: 425, currency: 'SEK' } } },
    } } });
  };
  assert.deepEqual(await fetchOffer(target, priceForSku(target.sku)), { status: 'ok', priceOre: 42500 });
  assert.deepEqual(await fetchOffer(target, priceForSku(target.sku, false)), { status: 'unavailable', priceOre: null });
  await assert.rejects(() => fetchOffer(target, priceForSku('another-size')), /Exact offer/);
});

test('rank uses kronor per 100 g of protein and ignores stale or unavailable prices', () => {
  const current = { status: 'ok', day: '2026-11-20', priceOre: 30000, proteinGrams: 750 };
  const product = { history: [current] };
  assert.equal(pricePer100g(current), 40);
  assert.equal(priceRank(product, '2026-11-21'), 40);
  assert.equal(priceRank(product, '2026-11-22'), Infinity);
  assert.equal(priceRank({ history: [current, { day: '2026-11-21', status: 'unavailable' }] }, '2026-11-21'), Infinity);
});

test('the chart connects adjacent observations and leaves a gap across missing days', () => {
  const observed = (day, priceOre) => ({ day, priceOre, proteinGrams: 500, status: 'ok' });
  const history = [
    observed('2026-11-16', 30000), observed('2026-11-17', 25000),
    { day: '2026-11-18', status: 'error' }, observed('2026-11-19', 24000),
    observed('2026-11-20', 24000),
  ];
  assert.deepEqual(plotSegments(history, dayNumber('2026-11-16'), dayNumber('2026-11-19')).map((segment) =>
    segment.map(({ price }) => price)), [[60, 50], [48]]);
});

test('a scheduled collection saves verified observations without erasing prices on a failed same-day retry', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_observations.sql', import.meta.url), 'utf8'));
  try {
    const db = {
      prepare(sql) {
        const query = sqlite.prepare(sql);
        return { bind: (...args) => () => ({ results: query.all(...args) }) };
      },
      async batch(statements) {
        return statements.map((execute) => execute());
      },
    };
    const now = Date.now();
    await collect(db, now, async (url) => url === tyngre.url
      ? new Response(productPage({ sku: tyngre.sku, offers: offer(tyngre) }))
      : new Response(null, { status: 503 }));
    await assert.rejects(() => collect(db, now, async () => new Response(null, { status: 503 })), /No retailer offers/);

    const response = await worker.fetch(new Request('https://tracker.example/api/prices'), { PRICES: db });
    const { products } = await response.json();
    assert.deepEqual(products.find(({ id }) => id === tyngre.id).history.map(({ status, priceOre, proteinGrams }) =>
      ({ status, priceOre, proteinGrams })), [{ status: 'ok', priceOre: 39995, proteinGrams: 675 }]);
    assert.ok(products.filter(({ id }) => id !== tyngre.id).every(({ history }) =>
      history.length === 1 && history[0].status === 'error' && history[0].priceOre === null));
  } finally {
    sqlite.close();
  }
});
