const origin = 'https://www.bulk.com';
const catalogQuery = `
  query ProteinPrice($sku: String!, $optionIds: [String!]!) {
    refineProduct(sku: $sku, optionIds: $optionIds) {
      sku
      inStock
      ... on SimpleProductView { price { final { amount { value currency } } } }
    }
  }`;

export async function readBulkOffer(product, fetchPage) {
  const listing = new URL(product.url);
  const sku = listing.pathname.split('/').at(-1).toUpperCase();
  // Bulk's Swedish storefront supplies the option IDs in its public variant links.
  const options = atob(listing.searchParams.get('o') ?? '').split(',');
  if (options.length !== 2 || !options.every((option) => /^\d+-\d+$/.test(option))) {
    throw new Error('Invalid Bulk variant options');
  }
  const optionIds = options.map((option) => btoa(`configurable/${option.replace('-', '/')}`));
  const config = await fetchPage(`${origin}/se/configs.json?sheet=prod&v=021225`);
  const storefront = Object.fromEntries((await config.json()).data.map(({ key, value }) => [key, value]));
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': storefront['commerce-x-api-key'],
  };
  for (const field of ['environment-id', 'website-code', 'store-view-code', 'store-code', 'customer-group']) {
    headers[`Magento-${field}`] = storefront[`commerce-${field}`];
  }
  if (Object.values(headers).some((value) => value == null || value === '')) {
    throw new Error('Bulk storefront settings missing');
  }
  const url = new URL('/se/cs-graphql', origin);
  url.searchParams.set('query', catalogQuery);
  url.searchParams.set('variables', JSON.stringify({ sku, optionIds }));
  const response = await fetchPage(url.href, headers);
  const variant = (await response.json()).data?.refineProduct;
  if (variant?.sku !== product.sku || typeof variant.inStock !== 'boolean') return null;
  const amount = variant.price?.final?.amount;
  return { price: amount?.value, currency: amount?.currency, availability: variant.inStock ? 'InStock' : 'OutOfStock' };
}
