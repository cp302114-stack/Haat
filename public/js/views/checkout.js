import { api, ApiError } from '../api.js';
import { icon } from '../icons.js';
import { artSvg } from '../art.js';
import { esc, inr, setTitle } from '../util.js';
import { state, refreshCart, newCart, emit } from '../state.js';

const FIELDS = {
  name: (v) => (v.trim().length < 2 ? 'Enter your name' : ''),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter a valid email'),
  phone: (v) => (v.replace(/\D/g, '').length >= 10 ? '' : 'Enter a 10 digit phone number'),
  address: (v) => (v.trim().length < 8 ? 'Enter a delivery address' : ''),
};

const saved = () => {
  try { return JSON.parse(localStorage.getItem('haat.customer') || '{}'); } catch { return {}; }
};

export async function render(root, ctx) {
  setTitle('Checkout');

  const paint = async () => {
    const cart = await refreshCart();
    if (!ctx.isCurrent(ctx.token)) return;
    if (!cart.items.length) {
      root.innerHTML = `<div class="wrap page"><div class="empty"><h3>Your cart is empty</h3><p>Add something from the shelf to check out.</p><a class="btn btn-primary" href="#/search">Browse products</a></div></div>`;
      return;
    }
    const me = saved();
    const toFree = state.meta.delivery.freeFrom - cart.subtotal;

    root.innerHTML = `
      <div class="wrap page">
        <div class="page-head"><div><h1 class="page-title">Checkout</h1><p class="lede">Delivering to ${esc(cart.city)} <i class="dot"></i> <button class="link" id="change-city">Change city</button></p></div></div>
        <div class="checkout">
          <form class="form" id="form" novalidate>
            <div id="problem"></div>
            <div class="fieldset">
              <h2>Contact</h2>
              <div>
                <label class="field-label" for="name">Full name</label>
                <input class="input" id="name" name="name" autocomplete="name" value="${esc(me.name || '')}" required>
                <div class="err" data-for="name" hidden></div>
              </div>
              <div class="two">
                <div>
                  <label class="field-label" for="email">Email</label>
                  <input class="input" id="email" name="email" type="email" autocomplete="email" value="${esc(me.email || '')}" required>
                  <div class="err" data-for="email" hidden></div>
                </div>
                <div>
                  <label class="field-label" for="phone">Phone</label>
                  <input class="input" id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" value="${esc(me.phone || '')}" required>
                  <div class="err" data-for="phone" hidden></div>
                </div>
              </div>
            </div>
            <div class="fieldset">
              <h2>Delivery address in ${esc(cart.city)}</h2>
              <div>
                <label class="field-label" for="address">Address</label>
                <textarea class="textarea" id="address" name="address" autocomplete="street-address" required>${esc(me.address || '')}</textarea>
                <div class="err" data-for="address" hidden></div>
              </div>
            </div>
            <div class="fieldset">
              <h2>Payment</h2>
              <div class="radios" role="radiogroup" aria-label="Payment method">
                <label class="radio"><input type="radio" name="payment" value="cod" checked><span><span class="rt">Cash on delivery</span><br><span class="muted" style="font-size:13px">Pay the courier when it arrives</span></span></label>
                <label class="radio"><input type="radio" name="payment" value="upi_on_delivery"><span><span class="rt">UPI on delivery</span><br><span class="muted" style="font-size:13px">Scan the courier's QR code when it arrives</span></span></label>
              </div>
            </div>
            <button class="btn btn-primary btn-lg" type="submit" id="place" ${cart.ready ? '' : 'disabled'}>Place order · ${inr(cart.total)}</button>
          </form>

          <aside class="summary" aria-label="Order summary">
            <h2>Summary</h2>
            <div style="display:flex;flex-direction:column;gap:12px">
              ${cart.items.map((i) => `
                <div class="sline">
                  <span class="thumb">${artSvg(i.art, i.color, '')}</span>
                  <div style="min-width:0"><div class="n">${esc(i.name)}</div><div class="muted num" style="font-size:13px">${i.qty} × ${inr(i.price)}</div>${i.ok ? '' : `<div style="color:var(--accent-text);font-size:13px">${i.available > 0 ? `Only ${i.available} left` : 'Sold out'} in ${esc(cart.city)}</div>`}</div>
                  <span class="num">${inr(i.lineTotal)}</span>
                </div>`).join('')}
            </div>
            <div class="sum" style="border-top:1px solid var(--line);padding-top:16px">
              <div class="r"><span>Subtotal</span><span>${inr(cart.subtotal)}</span></div>
              <div class="r"><span>Delivery</span><span>${cart.delivery ? inr(cart.delivery) : 'Free'}</span></div>
              ${cart.delivery ? `<div class="muted" style="font-size:13px;line-height:16px">Add ${inr(toFree)} more for free delivery</div>` : ''}
              <div class="r total"><span>Total</span><span>${inr(cart.total)}</span></div>
            </div>
          </aside>
        </div>
      </div>`;

    if (!cart.ready) showStockProblem(cart.items.filter((i) => !i.ok).map((i) => ({ name: i.name, available: i.available })), cart.city);

    root.querySelector('#change-city').addEventListener('click', () => window.openCityPicker?.());
    wire(cart);
  };

  function showStockProblem(items, city) {
    const el = root.querySelector('#problem');
    if (!el) return;
    el.innerHTML = `<div class="banner" role="alert">${icon('circle-alert', 18)}<div><strong style="font-weight:500">Some items changed while you were shopping</strong><br>${items.map((i) => `${esc(i.name)}: ${i.available > 0 ? `only ${i.available} left` : 'sold out'} in ${esc(city)}`).join('<br>')}<br><a class="link" href="#" id="open-cart">Update your cart</a></div></div>`;
    el.querySelector('#open-cart').addEventListener('click', (e) => { e.preventDefault(); window.openCart?.(); });
  }

  function wire(cart) {
    const form = root.querySelector('#form');
    const err = (name, msg) => {
      const el = form.querySelector(`.err[data-for="${name}"]`);
      const input = form.elements[name];
      el.hidden = !msg;
      el.textContent = msg || '';
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    };
    for (const name of Object.keys(FIELDS)) {
      form.elements[name].addEventListener('blur', () => err(name, FIELDS[name](form.elements[name].value)));
      form.elements[name].addEventListener('input', () => { if (form.elements[name].getAttribute('aria-invalid') === 'true') err(name, FIELDS[name](form.elements[name].value)); });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let first = null;
      for (const name of Object.keys(FIELDS)) {
        const msg = FIELDS[name](form.elements[name].value);
        err(name, msg);
        if (msg && !first) first = form.elements[name];
      }
      if (first) return first.focus();

      const btn = form.querySelector('#place');
      btn.disabled = true;
      btn.textContent = 'Placing order';
      const customer = { name: form.elements.name.value, email: form.elements.email.value, phone: form.elements.phone.value };
      const address = form.elements.address.value;
      try {
        const order = await api.placeOrder({
          cartId: state.cartId,
          city: cart.city,
          customer,
          address,
          payment: form.elements.payment.value,
        });
        try { localStorage.setItem('haat.customer', JSON.stringify({ ...customer, address })); } catch { /* private mode */ }
        newCart();
        await refreshCart();
        location.hash = `#/order/${order.id}`;
      } catch (ex) {
        btn.disabled = false;
        btn.textContent = `Place order · ${inr(cart.total)}`;
        if (ex instanceof ApiError && ex.body.code === 'out_of_stock') {
          showStockProblem(ex.body.items, cart.city);
          await refreshCart();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          const el = root.querySelector('#problem');
          el.innerHTML = `<div class="banner" role="alert">${icon('circle-alert', 18)}<div>${esc(ex.message)}</div></div>`;
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    });
  }

  ctx.on('city', paint);
  await paint();
}
