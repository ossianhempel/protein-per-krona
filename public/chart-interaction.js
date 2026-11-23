const brandLogos = {
  'Star Nutrition': 'star-nutrition.png',
  'Body Science': 'body-science.png',
  Core: 'core.png',
  Tyngre: 'tyngre.png',
};
const date = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'long', timeZone: 'UTC' });
const sek = new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 2 });
const dayMilliseconds = 86400000;

function distanceSquared(point, start, end = start) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  const progress = length ? ((point.x - start.x) * dx + (point.y - start.y) * dy) / length : 0;
  const fraction = Math.max(0, Math.min(1, progress));
  return (point.x - start.x - dx * fraction) ** 2 + (point.y - start.y - dy * fraction) ** 2;
}

function nearestObservation(plots, position, radius, dotRadius) {
  let nearest;
  let shortest = radius ** 2;
  for (const { product, segments } of plots) {
    for (const [segmentIndex, segment] of segments.entries()) {
      const first = segment[0];
      const last = segment.at(-1);
      // Inside a date gap, only the visible endpoint dot should respond.
      const inGap = (position.x < first.x && segmentIndex > 0) ||
        (position.x > last.x && segmentIndex < segments.length - 1);
      const hitRadius = inGap ? dotRadius : radius;
      if (position.x < first.x - hitRadius || position.x > last.x + hitRadius) continue;
      const points = inGap ? [position.x < first.x ? first : last] : segment;
      for (const [index, start] of points.entries()) {
        const end = points[index + 1] ?? start;
        if (position.x < start.x - radius || position.x > end.x + radius) continue;
        const distance = distanceSquared(position, start, end);
        // Equal distances favor the series painted on top.
        if (distance > shortest || distance > hitRadius ** 2) continue;
        shortest = distance;
        const point = Math.abs(position.x - start.x) <= Math.abs(position.x - end.x) ? start : end;
        nearest = { product, point };
      }
    }
  }
  return nearest;
}

function offerDetails(product, point) {
  const observedDate = new Date(point.day * dayMilliseconds);
  const day = observedDate.toISOString().slice(0, 10);
  const { priceOre } = product.history.find((entry) => entry.day === day);
  return {
    dateLabel: date.format(observedDate),
    variant: `${product.flavour} · ${product.weight.toLocaleString('sv-SE')} g`,
    normalized: sek.format(point.price),
    pack: `${sek.format(priceOre / 100)} hos ${product.retailer}`,
  };
}

function seriesLabel(product, point, anchor) {
  const offer = offerDetails(product, point);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chart-label';
  button.dataset.productId = product.id;
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', `${product.brand} ${product.name}, ${offer.dateLabel}, ${offer.normalized} per 100 g protein`);
  const description = document.createElement('span');
  description.id = `chart-price-${product.id}`;
  description.hidden = true;
  description.textContent = `${offer.variant}. Påse ${offer.pack}.`;
  button.setAttribute('aria-describedby', description.id);
  button.style.top = `${anchor.y}px`;
  button.style.left = `${anchor.x}px`;
  const logo = brandLogos[product.brand];
  if (logo) {
    const image = new Image();
    image.src = `./brands/${logo}`;
    image.alt = product.brand;
    button.append(image);
  } else {
    const brand = document.createElement('strong');
    brand.textContent = product.brand;
    button.append(brand);
  }
  const name = document.createElement('span');
  name.textContent = product.name;
  button.append(name, description);
  return button;
}

export function chartControls(container, svg, plots, anchors, dotRadius, onSelect) {
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  tooltip.setAttribute('aria-hidden', 'true');
  const heading = document.createElement('strong');
  const detail = document.createElement('div');
  const price = document.createElement('div');
  const pack = document.createElement('div');
  tooltip.append(heading, detail, price, pack);
  let previous;

  function showTooltip({ product, point }, position) {
    if (previous?.product !== product || previous.point !== point) {
      previous = { product, point };
      const offer = offerDetails(product, point);
      heading.textContent = `${product.brand} ${product.name}`;
      detail.textContent = `${offer.dateLabel} · ${offer.variant}`;
      price.textContent = `${offer.normalized} / 100 g protein`;
      pack.textContent = offer.pack;
    }
    tooltip.hidden = false;
    const right = position.x + 10;
    const left = right + tooltip.offsetWidth <= container.clientWidth ? right : position.x - tooltip.offsetWidth - 10;
    tooltip.style.left = `${Math.max(0, left)}px`;
    const above = position.y - tooltip.offsetHeight - 9;
    tooltip.style.top = `${above >= 0 ? above : position.y + 10}px`;
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  function pointerPosition(event) {
    const rect = svg.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  svg.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const position = pointerPosition(event);
    const hit = nearestObservation(plots, position, 11, dotRadius);
    svg.classList.toggle('chart-hit', Boolean(hit));
    if (hit) showTooltip(hit, position);
    else hideTooltip();
  });
  svg.addEventListener('pointerleave', () => {
    svg.classList.remove('chart-hit');
    hideTooltip();
  });
  svg.addEventListener('click', (event) => {
    const position = pointerPosition(event);
    const hit = nearestObservation(plots, position, event.pointerType === 'touch' ? 18 : 11, dotRadius);
    if (!hit) {
      hideTooltip();
      return;
    }
    onSelect(hit.product.id);
    showTooltip(hit, position);
  });

  const buttons = anchors.map(({ plot, point, x, y }) => {
    const { product } = plot;
    const button = seriesLabel(product, point, { x, y });
    button.style.setProperty('--brand-colour', plot.colour);
    const showLatest = () => showTooltip({ product, point }, { x, y });
    button.addEventListener('focus', showLatest);
    button.addEventListener('blur', hideTooltip);
    button.addEventListener('pointerenter', showLatest);
    button.addEventListener('pointerleave', hideTooltip);
    button.addEventListener('click', () => {
      onSelect(product.id);
      showLatest();
    });
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hideTooltip();
    });
    return button;
  });
  return [svg, ...buttons, tooltip];
}
