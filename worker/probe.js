import { catalog } from './catalog.js';
import { fetchOffer } from './retailers.js';

for (const product of catalog) {
  try {
    console.log(product.id, await fetchOffer(product));
  } catch (error) {
    console.error(product.id, error.message, error.cause?.message ?? '');
    process.exitCode = 1;
  }
}
