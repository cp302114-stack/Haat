import { api } from './api.js';

const listeners = new Map();
export const on = (name, fn) => {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => listeners.get(name).delete(fn);
};
export const emit = (name, data) => listeners.get(name)?.forEach((fn) => fn(data));

const store = {
  get: (k) => {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set: (k, v) => {
    try { localStorage.setItem(k, v); } catch { /* private mode */ }
  },
};

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
}

export const state = {
  meta: null,
  city: store.get('haat.city') || 'Mumbai',
  cartId: store.get('haat.cart') || null,
  cart: null,
};

export async function init() {
  state.meta = await api.meta();
  if (!state.meta.cities.includes(state.city)) state.city = state.meta.cities[0];
  if (!state.cartId) {
    state.cartId = uuid();
    store.set('haat.cart', state.cartId);
  }
  await refreshCart();
  openStream();
}

export async function refreshCart() {
  state.cart = await api.cart(state.cartId, state.city);
  emit('cart', state.cart);
  return state.cart;
}

export function newCart() {
  state.cartId = uuid();
  store.set('haat.cart', state.cartId);
  state.cart = null;
}

export async function setCity(city) {
  if (city === state.city) return;
  state.city = city;
  store.set('haat.city', city);
  state.cart = await api.setCity(state.cartId, city);
  emit('city', city);
  emit('cart', state.cart);
}

// ------------------------------------------------------- live updates (SSE)
let stream;
export function openStream() {
  if (stream) return;
  stream = new EventSource('/api/stream');
  stream.addEventListener('stock', (e) => emit('stock', JSON.parse(e.data)));
  stream.addEventListener('ledger', (e) => emit('ledger', JSON.parse(e.data)));
  stream.addEventListener('order', (e) => emit('order', JSON.parse(e.data)));
  stream.addEventListener('open', () => emit('stream', true));
  stream.addEventListener('error', () => emit('stream', false));
}

export async function addToCart(productId, qty = 1) {
  state.cart = await api.addItem(state.cartId, productId, state.city, qty);
  emit('cart', state.cart);
  return state.cart;
}
export async function setCartQty(productId, qty) {
  state.cart = await api.setQty(state.cartId, productId, state.city, qty);
  emit('cart', state.cart);
  return state.cart;
}
export async function removeFromCart(productId) {
  state.cart = await api.removeItem(state.cartId, productId, state.city);
  emit('cart', state.cart);
  return state.cart;
}
