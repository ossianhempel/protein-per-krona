import { readBulkOffer } from './bulk.js';

function structuredOffer(html, product) {
  for (const [, text] of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      continue;
    }
    for (const entry of data?.['@graph'] ?? [data]) {
      const variants = entry?.['@type'] === 'ProductGroup' ? entry.hasVariant ?? [] : [entry];
      for (const variant of variants) {
        if (variant?.['@type'] !== 'Product') continue;
        const offers = Array.isArray(variant.offers) ? variant.offers : [variant.offers];
        const found = offers.find((item) => item?.url === product.url
          && (product.source === 'shopify' || (Array.isArray(variant.offers) ? item.sku : variant.sku) === product.sku));
        if (found?.['@type'] === 'Offer') {
          return { price: found.price, currency: found.priceCurrency, availability: found.availability };
        }
      }
    }
  }
  return null;
}

function gymgrossistenOffer(html, product) {
  const marker = `<meta itemprop="sku" content="${product.sku}"`;
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const offer = html.slice(start, html.indexOf('<div', start));
  function meta(property) {
    return offer.match(new RegExp(`itemprop="${property}" content="([^"]*)"`))?.[1];
  }
  if (meta('url') !== product.url) return null;
  return { price: meta('price'), currency: meta('priceCurrency'), availability: meta('availability') };
}

function mmSportsOffer(html, product) {
  const raw = html.match(/\bvar productJSON = (\{[^\n]*\});/);
  if (!raw || !html.includes('itemprop="priceCurrency" content="SEK"')) return null;
  // The storefront puts variant price, stock and SKU at indexes 0, 1 and 5.
  const variant = JSON.parse(raw[1]).variants?.[product.variant]?.[0];
  if (variant?.[5] !== product.sku || !Number.isInteger(variant[1])) return null;
  return { price: variant[0], currency: 'SEK', availability: variant[1] > 0 ? 'InStock' : 'OutOfStock' };
}

export function readOffer(html, product) {
  let offer;
  if (product.source === 'gymgrossisten') {
    offer = gymgrossistenOffer(html, product);
  } else if (product.source === 'mmsports') {
    offer = mmSportsOffer(html, product);
  } else {
    offer = structuredOffer(html, product);
  }
  return normalizeOffer(offer);
}

function normalizeOffer(offer) {
  if (offer?.currency !== 'SEK') throw new Error('Exact offer or SEK currency missing');
  const stock = offer.availability?.split('/').at(-1);
  if (['OutOfStock', 'SoldOut', 'PreOrder', 'BackOrder', 'Discontinued'].includes(stock)) {
    return { status: 'unavailable', priceOre: null };
  }
  const amount = String(offer.price);
  if (stock !== 'InStock' || !/^\d+(\.\d{1,2})?$/.test(amount)) {
    throw new Error('Unexpected price or availability');
  }
  const priceOre = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(priceOre) || priceOre <= 0) throw new Error('Invalid price');
  return { status: 'ok', priceOre };
}

export async function fetchOffer(product, fetchPage = fetch) {
  async function fetchPageForStore(url, headers = {}) {
    const response = await fetchPage(url, {
      headers: {
        'User-Agent': 'ProteinPerKrona/1.0 (+https://github.com/ossianhempel/protein-per-krona)',
        'Accept-Language': 'sv-SE,sv;q=0.9',
        ...headers,
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  }

  if (product.source === 'bulk') return normalizeOffer(await readBulkOffer(product, fetchPageForStore));
  const response = await fetchPageForStore(product.url);
  return readOffer(await response.text(), product);
}
