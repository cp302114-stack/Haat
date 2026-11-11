import { icon } from './icons.js';
import { artSvg } from './art.js';
import { esc, inr, percentOff, clock } from './util.js';
import { on, state } from './state.js';

// The mark is a flat price tag, the same shape as the stock tags on the shelf.
export const MARK = `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M2 3a1 1 0 0 1 1-1h7.17a1 1 0 0 1 .7.29l7.84 7.84a1 1 0 0 1 0 1.42l-6.17 6.17a1 1 0 0 1-1.42 0L2.29 10.88A1 1 0 0 1 2 10.17z" fill="currentColor"/><circle cx="6.5" cy="6.5" r="1.5" fill="var(--bg)"/></svg>`;

// ---------------------------------------------------------------- stock tag
export const stockLabel = (n) => (n <= 0 ? 'Sold out' : n <= 5 ? `${n} left` : `${n} in stock`);
export const stockClass = (n) => (n <= 0 ? 'out' : n <= 5 ? 'low' : '');

export function stockTag(productId, city, n, size = '') {
  return `<span class="stock ${stockClass(n)} ${size}" data-pid="${productId}" data-city="${esc(city)}" data-n="${n}" aria-live="polite">${stockLabel(n)}</span>`;
}

// Keeps every tag on the page honest. Stock events come from Kafka consumers
// through the server stream, so a purchase anywhere changes the tag everywhere.
export function bindLiveStock() {
  on('stock', ({ productId, city, available }) => {
    document.querySelectorAll(`.stock[data-pid="${productId}"][data-city="${CSS.escape(city)}"]`).forEach((el) => {
      const before = Number(el.dataset.n);
      el.dataset.n = available;
      el.textContent = stockLabel(available);
      el.classList.remove('low', 'out');
      if (stockClass(available)) el.classList.add(stockClass(available));
      if (before !== available) {
        el.classList.add('bump');
        setTimeout(() => el.classList.remove('bump'), 700);
      }
    });
    if (city === state.city) {
      document.querySelectorAll(`[data-add="${productId}"]`).forEach((btn) => {
        btn.disabled = available <= 0;
        if (btn.dataset.label !== undefined) btn.innerHTML = available <= 0 ? 'Sold out' : btn.dataset.label;
      });
    }
  });
}

// --------------------------------------------------------------------- price
export function priceBlock(p, withOff = false) {
  const off = percentOff(p.price, p.mrp);
  return `<div class="price"><span class="now">${inr(p.price)}</span>${p.mrp > p.price ? `<span class="was">${inr(p.mrp)}</span>` : ''}${withOff && off ? `<span class="off">${off}% off</span>` : ''}</div>`;
}

// --------------------------------------------------------------- product card
export function productCard(p, city) {
  const n = p.available ?? 0;
  const out = n <= 0;
  const addLabel = `${icon('plus', 16)}Add`;
  return `<article class="card ${out ? 'is-out' : ''}">
    <a class="tile" href="#/product/${p.id}" tabindex="-1" aria-hidden="true">
      ${artSvg(p.art, p.color, p.name)}
      ${stockTag(p.id, city, n)}
    </a>
    <div class="meta">
      <span class="brand">${esc(p.brand)}</span>
      <h3 class="name"><a href="#/product/${p.id}">${esc(p.name)}</a></h3>
      <div class="buy">
        ${priceBlock(p)}
        <button class="btn btn-secondary btn-sm" data-add="${p.id}" data-label="${esc(addLabel)}" ${out ? 'disabled' : ''} aria-label="Add ${esc(p.name)} to cart">${out ? 'Sold out' : addLabel}</button>
      </div>
    </div>
  </article>`;
}

export function skeletonGrid(n = 8) {
  return `<div class="grid skel-grid">${Array.from({ length: n }, () => '<div class="skeleton"></div>').join('')}</div>`;
}

// --------------------------------------------------------------- ledger row
const SERVICE = {
  postgres: 'PostgreSQL',
  kafka: 'Kafka',
  opensearch: 'OpenSearch',
  notify: 'Notifications',
};

export function feedRow(e) {
  const where = e.meta?.topic ? ` <span class="mono muted">${esc(e.meta.topic)} p${e.meta.partition} @${e.meta.offset}</span>` : '';
  return `<div class="feed-row" data-seq="${e.seq}">
    <span class="t mono">${clock(e.at)}</span>
    <span class="svc"><i class="${esc(e.service)}"></i>${esc(SERVICE[e.service] || e.service)}</span>
    <span class="what"><b>${esc(e.action)}</b> <span>${esc(e.detail)}</span>${where}</span>
    <span class="ms mono">${e.ms != null ? `${e.ms} ms` : ''}</span>
  </div>`;
}

// Wires every [data-add] button inside root to the cart.
export function bindAddButtons(root, onAdd) {
  root.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-add]');
    if (!btn || btn.disabled) return;
    ev.preventDefault();
    btn.disabled = true;
    try {
      await onAdd(Number(btn.dataset.add), btn);
    } finally {
      const n = Number(document.querySelector(`.stock[data-pid="${btn.dataset.add}"]`)?.dataset.n ?? 1);
      btn.disabled = n <= 0;
    }
  });
}
