const millisecondsPerDay = 86400000;

export function dayNumber(date) {
  return Date.parse(date) / millisecondsPerDay;
}

export function pricePer100g(observation) {
  if (observation?.status !== 'ok') return null;
  // Converting öre to kronor and scaling to 100 grams cancel out.
  return observation.priceOre / observation.proteinGrams;
}

export function plotSegments(history, firstDay, lastDay) {
  const segments = [];
  let previousDay = -Infinity;
  for (const observation of history) {
    const day = dayNumber(observation.day);
    const price = pricePer100g(observation);
    if (day < firstDay || day > lastDay || price === null) continue;
    if (day !== previousDay + 1) segments.push([]);
    segments.at(-1).push({ day, price });
    previousDay = day;
  }
  return segments;
}

export function priceRank(product, today) {
  const latest = product.history.at(-1);
  if (!latest || dayNumber(today) - dayNumber(latest.day) > 1) return Infinity;
  return pricePer100g(latest) ?? Infinity;
}
