import { dayNumber, plotSegments } from './prices.js';

const colours = ['#155aa0', '#b04119', '#773b9d', '#00746a', '#825d01', '#bd3866', '#34530e', '#434e7d'];
const shortDate = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'long', timeZone: 'UTC' });
const dateForDay = (day) => new Date(day * 86400000);

function svgElement(name, attributes, text) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

export function createSwatch(index) {
  const marker = svgElement('svg', { viewBox: '0 0 12 12', class: 'swatch', 'aria-hidden': 'true' });
  marker.append(svgElement('circle', { cx: 6, cy: 6, r: 5, fill: colours[index % colours.length] }));
  return marker;
}

export function drawChart(container, series, today, days) {
  const end = dayNumber(today);
  const plots = series.map(({ product, colour }) => ({
    colour: colours[colour % colours.length],
    label: `${product.brand} ${product.name}`,
    segments: plotSegments(product.history, end - days + 1, end),
  }));
  const points = plots.flatMap(({ segments }) => segments.flat());
  if (points.length === 0) {
    container.replaceChildren();
    container.setAttribute('aria-label', 'Inga prisobservationer för urvalet');
    return 'Inga prisobservationer för urvalet.';
  }

  const width = Math.max(container.clientWidth, 225);
  const height = Math.round(parseFloat(getComputedStyle(container).fontSize) * (width < 430 ? 12 : 14));
  const left = 36;
  const right = width - 18;
  const bottom = height - 29;
  const top = 12;
  const first = Math.min(...points.map(({ day }) => day));
  const last = Math.max(...points.map(({ day }) => day));
  const dateCount = new Set(points.map(({ day }) => day)).size;
  const low = Math.min(...points.map(({ price }) => price));
  const high = Math.max(...points.map(({ price }) => price));
  const step = Math.max(5, Math.ceil((high - low) / 20) * 5);
  const min = Math.max(0, Math.floor(low / step) * step - step);
  const max = Math.max(min + step * 3, Math.ceil(high / step) * step);
  const x = (day) => first === last ? (left + right) / 2 : left + (day - first) / (last - first) * (right - left);
  const y = (cost) => bottom - (cost - min) / (max - min) * (bottom - top);
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' });

  for (let tick = min; tick <= max; tick += step) {
    svg.append(
      svgElement('line', { x1: left, x2: right, y1: y(tick), y2: y(tick) }),
      svgElement('text', { x: left - 8, y: y(tick) + 4, 'text-anchor': 'end' }, tick),
    );
  }
  const dateTicks = Math.min(width < 470 ? 3 : 6, last - first + 1);
  for (let i = 0; i < dateTicks; i++) {
    const day = dateTicks === 1 ? first : Math.round(first + (last - first) * i / (dateTicks - 1));
    const anchor = dateTicks === 1 ? 'middle' : i === 0 ? 'start' : i === dateTicks - 1 ? 'end' : 'middle';
    svg.append(svgElement('text', { x: x(day), y: height - 6, 'text-anchor': anchor }, shortDate.format(dateForDay(day))));
  }

  for (const { colour, label, segments } of plots) {
    for (const segment of segments) {
      if (segment.length > 1) {
        svg.append(svgElement('polyline', {
          points: segment.map(({ day, price }) => `${x(day)},${y(price)}`).join(' '),
          fill: 'none', stroke: colour, 'stroke-width': 2.5, 'stroke-linejoin': 'round',
        }));
      }
      for (const { day, price } of segment) {
        const dot = svgElement('circle', { cx: x(day), cy: y(price), r: dateCount > 45 ? 2 : 4, fill: colour });
        dot.append(svgElement('title', {}, `${label}, ${fullDate.format(dateForDay(day))}: ${price.toFixed(2).replace('.', ',')} kr`));
        svg.append(dot);
      }
    }
  }

  container.replaceChildren(svg);
  const count = dateCount === 1 ? 'En dag med prisdata' : `${dateCount} dagar med prisdata`;
  container.setAttribute('aria-label', `Kronor per 100 gram protein. ${count}. Värdena finns i tabellen nedan.`);
  if (dateCount === 1) return 'Första mätningen. Linjer visas när det finns priser för flera dagar i följd.';
  return `${count}. Luckor betyder att en prisobservation saknas.`;
}
