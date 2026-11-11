import { api } from '../api.js';
import { icon } from '../icons.js';
import { esc, setTitle, toast } from '../util.js';
import { state, addToCart } from '../state.js';
import { bindAddButtons, productCard, skeletonGrid } from '../components.js';

const SORTS = [
  ['relevance', 'Relevance'],
  ['price_asc', 'Price, low to high'],
  ['price_desc', 'Price, high to low'],
];

export async function render(root, ctx) {
  const q = (ctx.query.get('q') || '').trim();
  const category = ctx.query.get('category') || '';
  const min = ctx.query.get('min') || '';
  const max = ctx.query.get('max') || '';
  const sort = ctx.query.get('sort') || 'relevance';
  const inStock = ctx.query.get('inStock') !== '0';

  window.syncSearchBox?.(q);

  const go = (patch) => {
    const next = { q, category, min, max, sort, inStock: inStock ? '' : '0', ...patch };
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && !(k === 'sort' && v === 'relevance')) u.set(k, v);
    const s = u.toString();
    location.hash = s ? `#/search?${s}` : '#/search';
  };

  const title = q ? `Results for “${esc(q)}”` : category ? esc(category) : 'All products';
  setTitle(q || category || 'All products');

  root.innerHTML = `
    <div class="wrap page">
      <div class="page-head">
        <div><h1 class="page-title">${title}</h1><p class="lede" id="lede">&nbsp;</p></div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-secondary btn-sm filter-toggle" id="filter-toggle" aria-expanded="false">${icon('sliders-horizontal', 16)}Filters</button>
          <label class="visually-hidden" for="sort">Sort</label>
          <select class="select sm" id="sort">${SORTS.map(([v, l]) => `<option value="${v}" ${v === sort ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </div>
      </div>
      <div class="browse">
        <aside class="filters" id="filters" aria-label="Filters"></aside>
        <section id="results" aria-live="polite">${skeletonGrid(9)}</section>
      </div>
    </div>`;

  root.querySelector('#sort').addEventListener('change', (e) => go({ sort: e.target.value }));
  root.querySelector('#filter-toggle').addEventListener('click', (e) => {
    const open = root.querySelector('#filters').classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });

  bindAddButtons(root, async (id) => {
    const cart = await addToCart(id, 1);
    const item = cart.items.find((i) => i.id === id);
    toast(`Added ${item?.name ?? 'item'}`, { href: '#/checkout', label: 'Checkout' });
  });

  const run = async () => {
    const city = state.city;
    const res = await api.search({
      q, category, city, min, max, sort, inStock: inStock ? '1' : '0', size: 48,
    });
    if (!ctx.isCurrent(ctx.token)) return;

    const engine = state.meta.services.opensearch;
    root.querySelector('#lede').innerHTML = `<span class="num">${res.total} ${res.total === 1 ? 'product' : 'products'}</span><i class="dot"></i><span>${esc(city)}</span><i class="dot"></i><span class="mono muted">${res.took} ms from OpenSearch</span>`;

    // Category counts ignore the selected category so people can switch between aisles.
    const total = res.categories.reduce((s, c) => s + c.count, 0);
    root.querySelector('#filters').innerHTML = `
      <div class="filter">
        <h4>Category</h4>
        <div class="filter-list">
          <button class="filter-row" data-cat="" aria-pressed="${!category}"><span>All</span><span class="mono muted">${total}</span></button>
          ${state.meta.categories.map((name) => {
            const c = res.categories.find((x) => x.name === name);
            return `<button class="filter-row" data-cat="${esc(name)}" aria-pressed="${category === name}"><span>${esc(name)}</span><span class="mono muted">${c ? c.count : 0}</span></button>`;
          }).join('')}
        </div>
      </div>
      <div class="filter">
        <h4>Price</h4>
        <div class="price-inputs">
          <div><label class="field-label" for="min">Min</label><input class="input num" id="min" inputmode="numeric" placeholder="₹0" value="${esc(min)}"></div>
          <div><label class="field-label" for="max">Max</label><input class="input num" id="max" inputmode="numeric" placeholder="₹5,000" value="${esc(max)}"></div>
        </div>
      </div>
      <div class="filter">
        <h4>Availability</h4>
        <button class="switch" role="switch" id="stock-switch" aria-checked="${inStock}"><span>In stock in ${esc(city)}</span><span class="track"></span></button>
      </div>`;

    const results = root.querySelector('#results');
    if (!res.hits.length) {
      const hint = inStock ? `Nothing matches in ${esc(city)} right now. Try turning off the stock filter or a different city.` : 'Try a shorter word, or check the spelling.';
      results.innerHTML = `<div class="empty"><h3>${q ? `No products for “${esc(q)}”` : 'No products here'}</h3><p>${hint}</p>
        <div class="chips">${state.meta.categories.slice(0, 4).map((c) => `<a class="chip" href="#/search?category=${encodeURIComponent(c)}">${esc(c)}</a>`).join('')}</div>
        <button class="btn btn-secondary btn-sm" id="clear" style="margin-top:8px">Clear filters</button></div>`;
      results.querySelector('#clear').addEventListener('click', () => (location.hash = '#/search'));
    } else {
      results.innerHTML = `<div class="grid three stagger">${res.hits.map((p) => productCard(p, city)).join('')}</div>
        <p class="engine mono">${icon('search', 14)}<span>${esc(engine.index)} on ${engine.mode === 'aiven' ? 'Aiven for OpenSearch' : 'local stand-in'}</span></p>`;
    }

    const filters = root.querySelector('#filters');
    filters.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => go({ category: b.dataset.cat })));
    filters.querySelector('#stock-switch').addEventListener('click', () => go({ inStock: inStock ? '0' : '' }));
    const price = () => {
      const clean = (v) => String(v).replace(/[^\d]/g, '');
      go({ min: clean(filters.querySelector('#min').value), max: clean(filters.querySelector('#max').value) });
    };
    filters.querySelector('#min').addEventListener('change', price);
    filters.querySelector('#max').addEventListener('change', price);
  };

  ctx.on('city', run);
  await run();
}
