import { icon } from './icons.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// One number format everywhere: whole rupees, Indian grouping.
export const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');

export const percentOff = (price, mrp) => (mrp > price ? Math.round((1 - price / mrp) * 100) : 0);

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function clock(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function longDate(iso) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

let toastTimer;
export function toast(message, action) {
  const el = $('#toast');
  el.innerHTML = `${icon('check', 16)}<span>${esc(message)}</span>${action ? `<a class="link" style="color:#f4ddd0" href="${esc(action.href)}">${esc(action.label)}</a>` : ''}`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

export function setTitle(title) {
  document.title = title ? `${title} · Haat` : 'Haat';
}
