import { dayNumber, priceRank, pricePer100g } from './prices.js';
import { createSwatch, drawChart } from './chart.js';

const select = (id) => document.getElementById(id);
const sek = new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 2 });
const cost = new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('sv-SE');
const date = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'long', timeZone: 'Europe/Stockholm' });
const time = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Stockholm' });

function cell(row, text) {
  const element = row.insertCell();
  if (text !== undefined) element.textContent = text;
  return element;
}

function productName(product) {
  return `${product.brand} ${product.name}`;
}

function addNote(parent, text) {
  const note = document.createElement('small');
  note.textContent = text;
  parent.append(note);
  return note;
}

function tableMessage(tbody, message, columns) {
  tbody.replaceChildren();
  cell(tbody.insertRow(), message).colSpan = columns;
}

function missingPrice(observation) {
  if (observation?.status === 'unavailable') return 'Ej i lager';
  if (observation?.status === 'error') return 'Pris kunde inte hämtas';
  if (observation?.status === 'ok') return 'Äldre prisobservation';
  return 'Pris saknas';
}

function renderProducts(products, today) {
  const tbody = select('products');
  tbody.replaceChildren();
  for (const product of products) {
    const row = tbody.insertRow();
    row.dataset.productId = product.id;
    const name = cell(row);
    const link = document.createElement('a');
    link.href = product.url;
    link.textContent = productName(product);
    name.append(link);
    addNote(name, `${product.flavour} · ${number.format(product.weight)} g`);
    addNote(name, `${product.ingredient} · ${number.format(product.protein)} g protein / 100 g`);
    const last = product.history.at(-1);
    const price = priceRank(product, today);
    const comparable = Number.isFinite(price);
    const normalized = cell(row, comparable ? cost.format(price) : '–');
    normalized.className = 'price';
    const bagPrice = comparable ? sek.format(last.priceOre / 100) : missingPrice(last);
    const priceCell = cell(row, bagPrice);
    addNote(priceCell, product.retailer);
    const priceDate = comparable && last.day !== today ? date.format(new Date(last.day)) : '';
    if (priceDate) addNote(priceCell, priceDate);
    const mobilePrice = addNote(normalized, comparable ? `Påse ${bagPrice}` : bagPrice);
    mobilePrice.className = 'mobile-price';
    addNote(mobilePrice, product.retailer);
    if (priceDate) addNote(mobilePrice, priceDate);
  }
}

function setup({ products, today }) {
  const sorted = products.toSorted((a, b) => priceRank(a, today) - priceRank(b, today));
  const latestAttempt = products.map(({ history }) => history.at(-1)?.observedAt).filter(Boolean).sort().at(-1);
  if (latestAttempt) select('updated').textContent = `Senaste priskontroll ${time.format(new Date(latestAttempt))} svensk tid.`;

  const type = select('type');
  type.disabled = false;
  type.addEventListener('change', renderComparison);
  const includeVegan = select('include-vegan');
  includeVegan.disabled = false;
  includeVegan.addEventListener('change', renderProductVisibility);

  const range = select('range');
  range.disabled = false;
  const history = select('history');
  const datePicker = select('history-date');
  const fieldset = select('series');
  const chart = select('chart');
  const clearHighlight = select('clear-highlight');
  const highlighted = new Set();
  const choices = products.map((product, colour) => {
    const label = document.createElement('label');
    label.dataset.productId = product.id;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = true;
    label.append(input, createSwatch(colour), document.createTextNode(productName(product)));
    fieldset.append(label);
    return { product, colour, input, label };
  });

  function applyHighlight() {
    clearHighlight.disabled = highlighted.size === 0;
    for (const item of document.querySelectorAll('[data-product-id]')) {
      const active = highlighted.has(item.dataset.productId);
      item.dataset.highlight = active ? 'selected' : highlighted.size ? 'muted' : '';
      if (item.hasAttribute('aria-pressed')) item.setAttribute('aria-pressed', String(active));
    }
  }

  function toggleHighlight(id) {
    if (!highlighted.delete(id)) highlighted.add(id);
    applyHighlight();
  }

  clearHighlight.addEventListener('click', () => {
    highlighted.clear();
    applyHighlight();
  });

  function visibleProduct(product) {
    return includeVegan.checked || !product.vegan;
  }

  function selectedSeries() {
    return choices.filter(({ product, input }) => visibleProduct(product) && input.checked);
  }

  function renderHistory(series) {
    const tbody = select('history-rows');
    tbody.replaceChildren();
    for (const { product } of series) {
      const observation = product.history.find(({ day }) => day === datePicker.value);
      const row = tbody.insertRow();
      row.dataset.productId = product.id;
      cell(row, productName(product));
      const price = pricePer100g(observation);
      cell(row, price === null ? '–' : cost.format(price)).className = 'price';
      cell(row, observation?.status === 'ok' ? sek.format(observation.priceOre / 100) : missingPrice(observation));
    }
    applyHighlight();
  }

  function renderChartAndHistory() {
    const days = Number(range.value);
    const series = selectedSeries();
    renderChart(series, days);
    const selectedDate = datePicker.value;
    const dates = [...new Set(series.flatMap(({ product }) => product.history
      .filter(({ day }) => dayNumber(today) - dayNumber(day) < days)
      .map(({ day }) => day)))].sort().reverse();
    datePicker.replaceChildren(...dates.map((day) => new Option(date.format(new Date(day)), day)));
    if (dates.includes(selectedDate)) datePicker.value = selectedDate;
    history.hidden = dates.length === 0;
    renderHistory(series);
  }

  function renderChart(series, days) {
    select('chart-status').textContent = drawChart(chart, series, today, days, toggleHighlight);
    const plotted = new Set([...chart.querySelectorAll('.chart-series')].map((series) => series.dataset.productId));
    for (const id of highlighted) {
      if (!plotted.has(id)) highlighted.delete(id);
    }
    applyHighlight();
  }

  function renderComparison() {
    renderProducts(sorted.filter((product) =>
      visibleProduct(product) && (!type.value || type.value === product.type)), today);
    applyHighlight();
  }

  function renderProductVisibility() {
    const selectedType = type.value;
    const types = new Set(products.filter(visibleProduct).map((product) => product.type));
    type.length = 1;
    for (const value of types) type.add(new Option(value, value));
    if (types.has(selectedType)) type.value = selectedType;
    for (const { product, label } of choices) label.hidden = !visibleProduct(product);
    renderComparison();
    renderChartAndHistory();
  }

  fieldset.hidden = false;
  fieldset.addEventListener('change', renderChartAndHistory);
  range.addEventListener('change', renderChartAndHistory);
  datePicker.addEventListener('change', () => renderHistory(selectedSeries()));
  let chartWidth = chart.clientWidth;
  new ResizeObserver(() => {
    if (chart.clientWidth === chartWidth) return;
    chartWidth = chart.clientWidth;
    renderChart(selectedSeries(), Number(range.value));
  }).observe(chart);
  renderProductVisibility();
}

try {
  const response = await fetch('./api/prices');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  setup(await response.json());
} catch (error) {
  console.error(error);
  select('chart').setAttribute('aria-label', 'Prisdata kunde inte hämtas');
  select('chart-status').textContent = 'Prisdata kunde inte hämtas. Försök igen om en stund.';
  tableMessage(select('products'), 'Prisdata kunde inte hämtas.', 3);
}
