import { api } from '../api.js';
import { icon } from '../icons.js';
import { esc, inr, longDate, setTitle } from '../util.js';
import { feedRow, MARK } from '../components.js';

const PAYMENT = { cod: 'Cash on delivery', upi_on_delivery: 'UPI on delivery' };

export async function render(root, ctx) {
  const id = ctx.params[0];
  const o = await api.order(id);
  if (!ctx.isCurrent(ctx.token)) return;
  setTitle(o.number);

  let status = o.status;
  let note = o.notifications[0] || null;

  root.innerHTML = `
    <div class="wrap page">
      <div class="page-head"><div><h1 class="page-title">Order ${esc(o.number)}</h1><p class="lede">Placed ${longDate(o.createdAt)} <i class="dot"></i> ${esc(o.city)}</p></div><a class="btn btn-secondary" href="#/search">Keep shopping</a></div>
      <div class="order-grid">
        <div class="receipt-wrap">
          <div class="receipt">
            <div class="rh">
              <a class="logo" href="#/">${MARK}<span>Haat</span></a>
              <div class="mono">${esc(o.city)} · ${longDate(o.createdAt)}</div>
              <div class="rn">${esc(o.number)}</div>
            </div>
            <div class="ri">
              ${o.items.map((i) => `<div class="rl"><div><div style="font-weight:500">${esc(i.name)}</div><div class="q">${i.qty} × ${inr(i.price)}</div></div><div class="num">${inr(i.qty * i.price)}</div></div>`).join('')}
            </div>
            <div class="rt">
              <div class="r"><span>Subtotal</span><span>${inr(o.subtotal)}</span></div>
              <div class="r"><span>Delivery</span><span>${o.delivery ? inr(o.delivery) : 'Free'}</span></div>
              <div class="r total"><span>To pay</span><span>${inr(o.total)}</span></div>
            </div>
            <div class="rf">${esc(PAYMENT[o.payment] || o.payment)}<br>${esc(o.customer.name)}<br>${esc(o.address)}</div>
          </div>
        </div>

        <div class="trail">
          <div class="status" id="status" role="status"></div>
          <h2>What just happened</h2>
          <p class="lede">Each line is a real event from PostgreSQL, Kafka or OpenSearch for this order.</p>
          <div class="feed compact" id="trail"><div class="feed-empty">Waiting for the first event</div></div>
          <div id="note"></div>
        </div>
      </div>
    </div>`;

  const paintStatus = () => {
    const confirmed = status === 'confirmed';
    root.querySelector('#status').innerHTML = `
      <span class="step done"><span class="sd">${icon('check', 12)}</span>Placed</span>
      <span class="step-bar"></span>
      <span class="step ${confirmed ? 'done' : ''}"><span class="sd">${confirmed ? icon('check', 12) : ''}</span>${confirmed ? 'Confirmed, stock updated' : 'Confirming'}</span>`;
  };
  const paintNote = () => {
    root.querySelector('#note').innerHTML = note
      ? `<div class="msg"><div class="mh">${icon('mail', 16)}<span class="mono">To ${esc(note.recipient)}</span></div><div class="ms">${esc(note.subject)}</div><p>${esc(note.body)}</p></div>`
      : '';
  };

  const trail = root.querySelector('#trail');
  const seen = new Set();
  const add = (entries) => {
    const fresh = entries.filter((e) => !seen.has(e.seq));
    if (!fresh.length) return;
    if (!seen.size) trail.innerHTML = '';
    for (const e of fresh) {
      seen.add(e.seq);
      trail.insertAdjacentHTML('beforeend', feedRow(e));
    }
  };

  paintStatus();
  paintNote();
  add((await api.ledger({ order: id })).entries);

  ctx.on('ledger', (e) => { if (e.order === id) add([e]); });
  ctx.on('order', async (e) => {
    if (e.orderId !== id) return;
    if (e.status) status = e.status;
    paintStatus();
    if (e.notified) {
      const fresh = await api.order(id);
      note = fresh.notifications[0] || null;
      paintNote();
    }
  });
}
