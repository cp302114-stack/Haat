import { api } from '../api.js';
import { icon } from '../icons.js';
import { artSvg } from '../art.js';
import { esc, inr, setTitle, toast } from '../util.js';
import { state, addToCart } from '../state.js';
import { bindAddButtons, priceBlock, productCard, stockTag } from '../components.js';

export async function render(root, ctx) {
  const id = Number(ctx.params[0]);
  let p;
  let qty = 1;
  let available = 0;

  const paint = async () => {
    p = await api.product(id, state.city);
    if (!ctx.isCurrent(ctx.token)) return;
    available = p.available ?? 0;
    qty = Math.min(qty, Math.max(available, 1));
    setTitle(p.name);

    const max = Math.min(available, state.meta.maxPerItem);
    root.innerHTML = `
      <div class="wrap page">
        <nav class="crumbs" aria-label="Breadcrumb">
          <a href="#/">Home</a>${icon('chevron-right', 16)}
          <a href="#/search?category=${encodeURIComponent(p.category)}">${esc(p.category)}</a>${icon('chevron-right', 16)}
          <span>${esc(p.name)}</span>
        </nav>
        <div class="pdp">
          <div class="pdp-art">${artSvg(p.art, p.color, p.name)}</div>
          <div class="pdp-info">
            <div>
              <span class="muted">${esc(p.brand)}</span>
              <h1>${esc(p.name)}</h1>
            </div>
            ${priceBlock(p, true)}
            <div>${stockTag(p.id, state.city, available, 'lg')}<span class="muted" style="margin-left:12px">in ${esc(state.city)}</span></div>
            <p class="pdp-desc">${esc(p.description)}</p>
            <div class="buy-row">
              <div class="stepper" role="group" aria-label="Quantity">
                <button id="dec" aria-label="Decrease quantity" ${qty <= 1 ? 'disabled' : ''}>${icon('minus', 18)}</button>
                <output id="qty" aria-live="polite">${qty}</output>
                <button id="inc" aria-label="Increase quantity" ${qty >= max ? 'disabled' : ''}>${icon('plus', 18)}</button>
              </div>
              <button class="btn btn-primary btn-lg" id="add" style="flex:1" data-add="${p.id}" data-label="Add to cart" ${available <= 0 ? 'disabled' : ''}>${available <= 0 ? 'Sold out' : 'Add to cart'}</button>
            </div>
            <div class="facts">
              <div class="fact">${icon('truck', 18)}<span>Delivery to ${esc(state.city)}, ${state.meta.delivery.fee ? inr(state.meta.delivery.fee) : 'free'} or free over ${inr(state.meta.delivery.freeFrom)}</span></div>
              <div class="fact">${icon('banknote', 18)}<span>Pay on delivery, cash or UPI</span></div>
            </div>
            <div class="cities-list">
              <h3>Stock by city</h3>
              ${state.meta.cities.map((c) => `<div class="city-row ${c === state.city ? 'is-current' : ''}"><span class="cn">${esc(c)}</span>${stockTag(p.id, c, p.stock[c] ?? 0)}</div>`).join('')}
            </div>
          </div>
        </div>
        <section class="section" style="padding-top:64px" id="related"></section>
      </div>`;

    const inc = root.querySelector('#inc');
    const dec = root.querySelector('#dec');
    const out = root.querySelector('#qty');
    const sync = () => {
      out.textContent = qty;
      dec.disabled = qty <= 1;
      inc.disabled = qty >= Math.min(available, state.meta.maxPerItem);
    };
    inc.addEventListener('click', () => { qty += 1; sync(); });
    dec.addEventListener('click', () => { qty -= 1; sync(); });

    loadRelated();
  };

  const loadRelated = async () => {
    const res = await api.search({ category: p.category, city: state.city, size: 8 });
    if (!ctx.isCurrent(ctx.token)) return;
    const more = res.hits.filter((h) => h.id !== p.id).slice(0, 4);
    const el = root.querySelector('#related');
    if (!el || !more.length) return;
    el.innerHTML = `<div class="section-head"><div><h2>More in ${esc(p.category)}</h2></div></div><div class="grid">${more.map((h) => productCard(h, state.city)).join('')}</div>`;
  };

  bindAddButtons(root, async (pid, btn) => {
    if (pid !== p.id || btn.id !== 'add') {
      const cart = await addToCart(pid, 1);
      toast(`Added ${cart.items.find((i) => i.id === pid)?.name ?? 'item'}`, { href: '#/checkout', label: 'Checkout' });
      return;
    }
    const cart = await addToCart(p.id, qty);
    const inCart = cart.items.find((i) => i.id === p.id)?.qty ?? qty;
    toast(inCart < qty + 0 ? `Only ${inCart} available, cart updated` : `Added ${p.name}`, { href: '#/checkout', label: 'Checkout' });
  });

  // Stock for this product changed somewhere: keep the stepper honest.
  ctx.on('stock', (s) => {
    if (s.productId !== id || s.city !== state.city) return;
    available = s.available;
    const max = Math.min(available, state.meta.maxPerItem);
    qty = Math.min(qty, Math.max(max, 1));
    const out = root.querySelector('#qty');
    if (out) {
      out.textContent = qty;
      root.querySelector('#inc').disabled = qty >= max;
      root.querySelector('#dec').disabled = qty <= 1;
    }
  });
  ctx.on('city', paint);
  await paint();
}
