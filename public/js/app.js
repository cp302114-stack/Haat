import { icon } from './icons.js';
import { api, ApiError } from './api.js';
import { artSvg } from './art.js';
import { $, $$, debounce, esc, inr, toast } from './util.js';
import { state, init, on, emit, setCity, setCartQty, removeFromCart, refreshCart } from './state.js';
import { bindLiveStock, MARK } from './components.js';

import * as home from './views/home.js';
import * as searchView from './views/search.js';
import * as product from './views/product.js';
import * as checkout from './views/checkout.js';
import * as order from './views/order.js';
import * as ledger from './views/ledger.js';


// ------------------------------------------------------------------- header
function renderHeader() {
  $('#header').innerHTML = `
    <div class="wrap header-row">
      <a class="logo" href="#/" aria-label="Haat home">${MARK}<span>Haat</span></a>
      <div class="searchbox">
        <form id="search-form" role="search" autocomplete="off">
          ${icon('search', 16).replace('class="icon"', 'class="icon lead"')}
          <input id="q" type="search" name="q" placeholder="Search" aria-label="Search products" role="combobox" aria-expanded="false" aria-controls="suggest" aria-autocomplete="list" maxlength="80" enterkeyhint="search">
          <span class="kbd" aria-hidden="true">/</span>
        </form>
        <div class="suggest" id="suggest" role="listbox" hidden></div>
      </div>
      <nav class="nav" aria-label="Main">
        <a class="btn btn-quiet nav-text" href="#/ledger">Ledger</a>
        <div class="nav-wrap">
          <button class="btn btn-quiet" id="city-btn" aria-haspopup="dialog" aria-expanded="false">${icon('map-pin', 16)}<span id="city-label"></span>${icon('chevron-down', 16)}</button>
          <div class="popover city-pop" id="city-pop" role="dialog" aria-label="Choose your city" hidden></div>
        </div>
        <button class="btn btn-quiet" id="cart-btn" aria-label="Open cart">${icon('shopping-bag', 16)}<span class="label-long">Cart</span><span class="cart-count num" id="cart-count">0</span></button>
      </nav>
    </div>`;
  paintCity();
  paintCount();
}

function paintCity() {
  const el = $('#city-label');
  if (el) el.textContent = state.city;
}
function paintCount() {
  const el = $('#cart-count');
  if (el) el.textContent = state.cart?.count ?? 0;
}

function renderFooter() {
  $('#footer').innerHTML = `<div class="wrap">
    <span>Haat, a retail chain's online store. Prices in rupees, pay on delivery.</span>
    <span class="mono">PostgreSQL · Kafka · OpenSearch on Aiven</span>
  </div>`;
}

// -------------------------------------------------------------- city picker
function setupCity() {
  const btn = $('#city-btn');
  const pop = $('#city-pop');
  const paint = () => {
    pop.innerHTML = `<h4>Where should we deliver?</h4><p class="muted">Stock and search results are shown for this city.</p>
      <div class="city-grid" role="radiogroup" aria-label="City">${state.meta.cities
        .map((c) => `<button class="city-opt" role="radio" aria-checked="${c === state.city}" data-city="${esc(c)}">${esc(c)}${c === state.city ? icon('check', 16) : ''}</button>`)
        .join('')}</div>`;
  };
  const close = () => {
    pop.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };
  const open = () => {
    paint();
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    pop.querySelector('[aria-checked="true"]')?.focus();
  };
  btn.addEventListener('click', () => (pop.hidden ? open() : close()));
  pop.addEventListener('click', async (e) => {
    const opt = e.target.closest('[data-city]');
    if (!opt) return;
    close();
    await setCity(opt.dataset.city);
    toast(`Showing ${opt.dataset.city}`);
  });
  document.addEventListener('click', (e) => {
    if (!pop.hidden && !e.target.closest('.nav-wrap')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !pop.hidden) {
      close();
      btn.focus();
    }
  });
  on('city', () => {
    paintCity();
  });
  window.openCityPicker = open;
}

// ------------------------------------------------------------------- search
function setupSearch() {
  const form = $('#search-form');
  const input = $('#q');
  const box = $('#suggest');
  let items = [];
  let active = -1;
  let seq = 0;

  const close = () => {
    box.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    active = -1;
  };
  const mark = (name, q) => {
    const i = name.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(name);
    return `${esc(name.slice(0, i))}<b style="font-weight:600">${esc(name.slice(i, i + q.length))}</b>${esc(name.slice(i + q.length))}`;
  };
  const paint = (res, q) => {
    items = res.hits;
    active = -1;
    if (!items.length) {
      box.innerHTML = `<div class="suggest-empty">No matches for “${esc(q)}”</div>`;
    } else {
      box.innerHTML = items
        .map((h, i) => `<a class="suggest-row" role="option" id="sg-${i}" aria-selected="false" href="#/product/${h.id}" data-i="${i}">
            <span class="thumb" style="width:40px;height:40px;border-radius:8px;overflow:hidden">${artSvg(h.art, h.color, '')}</span>
            <span style="min-width:0"><span class="name" style="display:block">${mark(h.name, q)}</span><span class="muted" style="font-size:13px">${esc(h.category)}</span></span>
            <span class="num secondary">${inr(h.price)}</span>
          </a>`)
        .join('') +
        `<div class="suggest-foot mono muted"><span>From OpenSearch${res.engine === 'local' ? ' (local stand-in)' : ''}</span><span>${res.took} ms</span></div>`;
    }
    box.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };
  const fetchSuggest = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 2) return close();
    const mine = ++seq;
    try {
      const res = await api.suggest(q);
      if (mine === seq && document.activeElement === input) paint(res, q);
    } catch {
      close();
    }
  }, 120);

  const highlight = (i) => {
    $$('.suggest-row', box).forEach((r, n) => r.setAttribute('aria-selected', String(n === i)));
    active = i;
    input.setAttribute('aria-activedescendant', i >= 0 ? `sg-${i}` : '');
  };

  input.addEventListener('input', fetchSuggest);
  input.addEventListener('focus', fetchSuggest);
  input.addEventListener('keydown', (e) => {
    if (box.hidden || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight((active + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight((active - 1 + items.length) % items.length); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); location.hash = `#/product/${items[active].id}`; close(); input.blur(); }
    else if (e.key === 'Escape') close();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    close();
    input.blur();
    location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/search';
  });
  box.addEventListener('mousedown', (e) => e.preventDefault());
  box.addEventListener('click', () => { close(); input.blur(); });
  input.addEventListener('blur', () => setTimeout(close, 120));
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
  window.syncSearchBox = (value) => { input.value = value || ''; };
}

// -------------------------------------------------------------- cart drawer
const drawer = $('#drawer');
const scrim = $('#scrim');
let lastFocus = null;

function openDrawer() {
  lastFocus = document.activeElement;
  renderDrawer();
  drawer.classList.add('open');
  scrim.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  drawer.querySelector('button, a')?.focus();
}
export function closeDrawer() {
  drawer.classList.remove('open');
  scrim.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  lastFocus?.focus?.();
}
window.openCart = openDrawer;

function renderDrawer() {
  const cart = state.cart;
  const empty = !cart || !cart.items.length;
  const toFree = cart ? state.meta.delivery.freeFrom - cart.subtotal : 0;
  drawer.innerHTML = `
    <div class="drawer-head">
      <h2>Cart <span class="muted num" style="font-size:15px">${cart?.count ?? 0}</span></h2>
      <button class="icon-btn" id="drawer-close" aria-label="Close cart">${icon('x', 18)}</button>
    </div>
    <div class="drawer-body">
      ${empty
        ? `<div class="drawer-empty"><h3>Your cart is empty</h3><p>Add something from the shelf and it will wait here.</p><a class="btn btn-secondary" href="#/search" data-close>Browse products</a></div>`
        : cart.items.map((i) => `
          <div class="line" data-id="${i.id}">
            <a class="thumb" href="#/product/${i.id}" data-close>${artSvg(i.art, i.color, i.name)}</a>
            <div>
              <a class="ln" href="#/product/${i.id}" data-close>${esc(i.name)}</a>
              <div class="muted" style="font-size:13px">${esc(i.brand)}</div>
              <div class="row">
                <div class="stepper sm" role="group" aria-label="Quantity">
                  <button data-dec aria-label="Decrease quantity">${icon('minus', 16)}</button>
                  <output aria-live="polite">${i.qty}</output>
                  <button data-inc aria-label="Increase quantity" ${i.qty >= Math.min(i.available, state.meta.maxPerItem) ? 'disabled' : ''}>${icon('plus', 16)}</button>
                </div>
                <span class="num" style="font-weight:500">${inr(i.lineTotal)}</span>
              </div>
              ${i.ok ? '' : `<div class="warn">${icon('circle-alert', 16)}<span>${i.available > 0 ? `Only ${i.available} left in ${esc(cart.city)}` : `Sold out in ${esc(cart.city)}`}</span></div>`}
              <button class="link" style="font-size:13px;margin-top:8px" data-remove>Remove</button>
            </div>
          </div>`).join('')}
    </div>
    ${empty ? '' : `<div class="drawer-foot">
      <div class="sum">
        <div class="r"><span>Subtotal</span><span>${inr(cart.subtotal)}</span></div>
        <div class="r"><span>Delivery to ${esc(cart.city)}</span><span>${cart.delivery ? inr(cart.delivery) : 'Free'}</span></div>
        ${cart.delivery ? `<div class="muted" style="font-size:13px;line-height:16px">Add ${inr(toFree)} more for free delivery</div>` : ''}
        <div class="r total"><span>Total</span><span>${inr(cart.total)}</span></div>
      </div>
      <a class="btn btn-primary btn-lg btn-block" href="#/checkout" data-close ${cart.ready ? '' : 'aria-disabled="true"'}>Checkout</a>
      ${cart.ready ? '' : `<p class="muted" style="font-size:13px;margin-top:8px">Remove items that are sold out to continue.</p>`}
    </div>`}`;
}

drawer.addEventListener('click', async (e) => {
  if (e.target.closest('#drawer-close') || e.target.closest('[data-close]')) {
    if (e.target.closest('a[aria-disabled="true"]')) return e.preventDefault();
    return closeDrawer();
  }
  const line = e.target.closest('.line');
  if (!line) return;
  const id = Number(line.dataset.id);
  const item = state.cart.items.find((i) => i.id === id);
  try {
    if (e.target.closest('[data-inc]')) await setCartQty(id, item.qty + 1);
    else if (e.target.closest('[data-dec]')) await setCartQty(id, item.qty - 1);
    else if (e.target.closest('[data-remove]')) await removeFromCart(id);
  } catch (err) {
    toast(err.message);
    await refreshCart();
  }
});
scrim.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
});

// ------------------------------------------------------------------- router
const routes = [
  [/^$/, 'home', home],
  [/^search$/, 'search', searchView],
  [/^product\/(\d+)$/, 'product', product],
  [/^checkout$/, 'checkout', checkout],
  [/^order\/([0-9a-f-]{36})$/i, 'order', order],
  [/^ledger$/, 'ledger', ledger],
];

let cleanups = [];
let token = 0;
let lastKey = null;

function makeCtx(params, query) {
  return {
    params,
    query,
    on(name, fn) {
      const off = on(name, fn);
      cleanups.push(off);
      return off;
    },
    cleanup(fn) { cleanups.push(fn); },
    isCurrent: (t) => t === token,
  };
}

async function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, queryString = ''] = raw.split('?');
  const query = new URLSearchParams(queryString);
  const main = $('#main');
  const mine = ++token;
  cleanups.forEach((fn) => { try { fn(); } catch { /* view already gone */ } });
  cleanups = [];

  let match = null;
  for (const [re, key, mod] of routes) {
    const m = path.match(re);
    if (m) { match = { key, mod, params: m.slice(1) }; break; }
  }
  if (!match) match = { key: 'home', mod: home, params: [] };

  const fresh = match.key !== lastKey;
  lastKey = match.key;
  main.classList.toggle('view', fresh);
  if (fresh) window.scrollTo(0, 0);
  if (match.key !== 'search') window.syncSearchBox?.('');

  const ctx = makeCtx(match.params, query);
  ctx.token = mine;
  try {
    await match.mod.render(main, ctx);
  } catch (err) {
    if (mine !== token) return;
    console.error(err);
    main.innerHTML = `<div class="wrap page"><div class="empty"><h3>That did not load</h3><p>${esc(err instanceof ApiError ? err.message : 'Something went wrong on our side. Try again in a moment.')}</p><a class="btn btn-secondary" href="#/">Back to the shop</a></div></div>`;
  }
}

export const refresh = () => route();

// --------------------------------------------------------------------- boot
async function start() {
  try {
    await init();
  } catch (err) {
    console.error(err);
    $('#main').innerHTML = `<div class="wrap page"><div class="empty"><h3>The store is not reachable</h3><p>Check that the server is running and try again.</p><button class="btn btn-secondary" onclick="location.reload()">Reload</button></div></div>`;
    return;
  }
  renderHeader();
  renderFooter();
  setupCity();
  setupSearch();
  bindLiveStock();
  $('#cart-btn').addEventListener('click', openDrawer);
  document.querySelector('[data-skip]').addEventListener('click', (e) => {
    e.preventDefault();
    $('#main').focus();
  });

  on('cart', () => {
    paintCount();
    if (drawer.classList.contains('open')) renderDrawer();
  });

  window.addEventListener('hashchange', route);
  route();
}

start();
