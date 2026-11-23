import { dayNumber, plotSegments } from './prices.js';
import { chartControls } from './chart-interaction.js';

const colours = [
  '#155aa0', '#b04119', '#773b9d', '#00746a', '#825d01', '#bd3866',
  '#34530e', '#434e7d', '#5c6510', '#7d3522', '#00738d', '#aa2351',
];
const shortDate = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
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

export function drawChart(container, series, today, days, onSelect) {
  const end = dayNumber(today);
  const plots = series.map(({ product, colour }) => ({
    colour: colours[colour % colours.length],
    product,
    segments: plotSegments(product.history, end - days + 1, end),
  })).filter(({ segments }) => segments.length > 0);
  const points = plots.flatMap(({ segments }) => segments.flat());
  if (points.length === 0) {
    container.replaceChildren();
    container.setAttribute('aria-label', 'Inga prisobservationer för urvalet');
    return 'Inga prisobservationer för urvalet.';
  }

  const width = container.clientWidth;
  const gap = 55;
  const labelInset = 28;
  const height = Math.max(230, plots.length * gap + 38);
  const left = 36;
  const right = width - (width < 500 ? 108 : 168);
  const bottom = height - 29;
  const top = 12;
  const first = Math.min(...points.map(({ day }) => day));
  const last = Math.max(...points.map(({ day }) => day));
  const dateCount = new Set(points.map(({ day }) => day)).size;
  const dotRadius = dateCount > 45 ? 2 : 4;
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

  const groups = new Map();
  for (const plot of plots) {
    const { product, colour } = plot;
    plot.segments = plot.segments.map((segment) => segment.map((point) =>
      ({ ...point, x: x(point.day), y: y(point.price) })));
    const group = svgElement('g', { class: 'chart-series', 'data-product-id': product.id });
    group.style.setProperty('--brand-colour', colour);
    svg.append(group);
    groups.set(product.id, group);
    const { segments } = plot;
    for (const segment of segments) {
      if (segment.length > 1) {
        group.append(svgElement('polyline', {
          points: segment.map(({ x, y }) => `${x},${y}`).join(' '),
          'stroke-linejoin': 'round',
        }));
      }
      for (const point of segment) {
        group.append(svgElement('circle', { cx: point.x, cy: point.y, r: dotRadius }));
      }
    }
  }

  const labels = plots.map((plot) => ({ plot, point: plot.segments.at(-1).at(-1) }))
    .sort((a, b) => a.point.y - b.point.y);
  let labelY = labelInset - gap;
  const anchors = labels.map(({ plot, point }, index) => {
    const limit = height - labelInset - (labels.length - index - 1) * gap;
    labelY = Math.max(labelY + gap, Math.min(point.y, limit));
    const labelX = right + 13;
    if (point.day === last) {
      groups.get(plot.product.id).append(svgElement('path', {
        d: `M${point.x + 5} ${point.y} L${labelX - 3} ${labelY}`,
        class: 'chart-leader',
      }));
    }
    return { plot, point, x: labelX, y: labelY };
  });
  container.replaceChildren(...chartControls(container, svg, plots, anchors, dotRadius, onSelect));
  const count = dateCount === 1 ? 'En dag med prisdata' : `${dateCount} dagar med prisdata`;
  container.setAttribute('aria-label', `Kronor per 100 gram protein. ${count}. Värdena finns i tabellen nedan.`);
  if (dateCount === 1) return 'Första mätningen. Linjer visas när det finns priser för flera dagar i följd.';
  return `${count}. Luckor betyder att en prisobservation saknas.`;
}
