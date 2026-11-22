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
  for (const value of new Set(products.map((product) => product.type))) type.add(new Option(value, value));
  type.disabled = false;
  type.addEventListener('change', renderComparison);

  const range = select('range');
  range.disabled = false;
  const history = select('history');
  const datePicker = select('history-date');
  const fieldset = select('series');
  const chart = select('chart');
  const choices = products.map((product, colour) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = true;
    label.append(input, createSwatch(colour), document.createTextNode(productName(product)));
    fieldset.append(label);
    return { product, colour, input };
  });

  function renderHistory() {
    const tbody = select('history-rows');
    tbody.replaceChildren();
    for (const { product, input } of choices) {
      if (!input.checked) continue;
      const observation = product.history.find(({ day }) => day === datePicker.value);
      const row = tbody.insertRow();
      cell(row, productName(product));
      const price = pricePer100g(observation);
      cell(row, price === null ? '–' : cost.format(price)).className = 'price';
      cell(row, observation?.status === 'ok' ? sek.format(observation.priceOre / 100) : missingPrice(observation));
    }
  }

  function renderChartAndHistory() {
    const days = Number(range.value);
    const series = choices.filter(({ input }) => input.checked);
    renderChart(series, days);
    const selectedDate = datePicker.value;
    const dates = [...new Set(series.flatMap(({ product }) => product.history
      .filter(({ day }) => dayNumber(today) - dayNumber(day) < days)
      .map(({ day }) => day)))].sort().reverse();
    datePicker.replaceChildren(...dates.map((day) => new Option(date.format(new Date(day)), day)));
    if (dates.includes(selectedDate)) datePicker.value = selectedDate;
    history.hidden = dates.length === 0;
    renderHistory();
  }

  function renderChart(series, days) {
    select('chart-status').textContent = drawChart(chart, series, today, days);
  }

  function renderComparison() {
    renderProducts(sorted.filter((product) => !type.value || type.value === product.type), today);
  }

  fieldset.hidden = false;
  fieldset.addEventListener('change', renderChartAndHistory);
  range.addEventListener('change', renderChartAndHistory);
  datePicker.addEventListener('change', renderHistory);
  let chartWidth = chart.clientWidth;
  new ResizeObserver(() => {
    if (chart.clientWidth === chartWidth) return;
    chartWidth = chart.clientWidth;
    renderChart(choices.filter(({ input }) => input.checked), Number(range.value));
  }).observe(chart);
  renderComparison();
  renderChartAndHistory();
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
