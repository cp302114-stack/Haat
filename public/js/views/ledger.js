import { api } from '../api.js';
import { icon } from '../icons.js';
import { esc, setTitle, inr } from '../util.js';
import { state } from '../state.js';
import { feedRow } from '../components.js';

const ROLE = {
  postgres: ['PostgreSQL', 'Holds products, carts, orders and the stock count. Refuses to sell the same last unit twice.'],
  kafka: ['Apache Kafka', 'Carries every order and stock change as an event. Three consumers react to them.'],
  opensearch: ['OpenSearch', 'Powers search and suggestions, forgives typos, filters by category, price and city.'],
};

function modeLine(svc) {
  return svc.mode === 'aiven'
    ? `<span class="mode live">Aiven</span> <span class="where mono">${esc(svc.host)}</span>`
    : `<span class="mode">Local stand-in</span> <span class="where mono">${esc(svc.host)}</span>`;
}

export async function render(root, ctx) {
  setTitle('Ledger');
  const [stats, led] = await Promise.all([api.stats(), api.ledger({ limit: 60 })]);
  if (!ctx.isCurrent(ctx.token)) return;
  const s = state.meta.services;
  const local = Object.entries(s).filter(([, v]) => v.mode === 'local').map(([k]) => ROLE[k][0]);

  const big = {
    postgres: [stats.orders, stats.orders === 1 ? 'order saved' : 'orders saved', `${stats.products} products in the catalogue`],
    kafka: [stats.produced, 'events produced', `${stats.consumed} consumed across 3 consumer groups`],
    opensearch: [stats.indexed, 'products indexed', `${stats.searches} ${stats.searches === 1 ? 'search' : 'searches'} served`],
  };

  root.innerHTML = `
    <div class="wrap page">
      <div class="page-head"><div><h1 class="page-title">The ledger</h1><p class="lede">What PostgreSQL, Kafka and OpenSearch are doing right now, as it happens</p></div><span class="mono muted" id="stream">connecting</span></div>
      ${local.length ? `<div class="banner" style="margin-bottom:24px">${icon('circle-alert', 18)}<div>Using local stand-ins for ${esc(local.join(', '))}. Add the Aiven connection details to <span class="mono">.env</span> and restart to run on the real services.</div></div>` : ''}
      <div class="services">
        ${Object.keys(ROLE).map((k) => `
          <div class="svc-card">
            <div class="top"><h3><i style="background:var(--dot-${k})"></i>${ROLE[k][0]}</h3></div>
            <p class="role">${ROLE[k][1]}</p>
            <div><div class="big num" id="big-${k}">${big[k][0]}</div><div class="muted">${big[k][1]}</div></div>
            <div class="muted" style="font-size:13px" id="sub-${k}">${big[k][2]}</div>
            <div>${modeLine(s[k])}</div>
          </div>`).join('')}
      </div>
      <div class="ledger-grid">
        <div>
          <div class="section-head" style="margin-bottom:12px"><div><h2 style="font-size:20px">Live feed</h2></div></div>
          <div class="feed" id="feed"></div>
        </div>
        <aside class="race">
          <h3>The last unit</h3>
          <p>One Kora Fit Smartwatch is left in Mumbai. Several buyers check out in the same instant.</p>
          <div style="display:flex;gap:8px;align-items:center">
            <label class="visually-hidden" for="buyers">Buyers</label>
            <select class="select" id="buyers" style="width:auto"><option value="2">2 buyers</option><option value="10">10 buyers</option><option value="50">50 buyers</option></select>
            <button class="btn btn-primary" id="run" style="flex:1">${icon('timer', 16)}Run the race</button>
          </div>
          <div class="race-res" id="race-res"></div>
          <p class="race-note">Each buyer's order tries to reserve the unit with one conditional update in PostgreSQL. The second one finds nothing left and is turned away, and the database would refuse an oversell even if the code did not.</p>
        </aside>
      </div>
    </div>`;

  const feed = root.querySelector('#feed');
  const seen = new Set();
  let produced = stats.produced;
  let consumed = stats.consumed;
  let searches = stats.searches;
  let orders = stats.orders;

  const counters = () => {
    root.querySelector('#big-postgres').textContent = orders;
    root.querySelector('#big-kafka').textContent = produced;
    root.querySelector('#sub-kafka').textContent = `${consumed} consumed across 3 consumer groups`;
    root.querySelector('#sub-opensearch').textContent = `${searches} ${searches === 1 ? 'search' : 'searches'} served`;
  };

  const place = (e, live) => {
    if (seen.has(e.seq)) return;
    seen.add(e.seq);
    if (live) {
      if (e.service === 'kafka' && e.action === 'produced') produced += 1;
      if (e.service === 'kafka' && e.action === 'consumed') consumed += 1;
      if (e.service === 'opensearch' && e.action === 'searched') searches += 1;
      if (e.service === 'postgres' && e.action === 'order saved') orders += 1;
      counters();
    }
    feed.querySelector('.feed-empty')?.remove();
    feed.insertAdjacentHTML('afterbegin', feedRow(e));
    while (feed.children.length > 80) feed.lastElementChild.remove();
  };

  feed.innerHTML = '<div class="feed-empty">Nothing yet. Place an order or run the race.</div>';
  for (const e of led.entries) place(e, false);

  ctx.on('ledger', (e) => place(e, true));
  ctx.on('stream', (ok) => {
    const el = root.querySelector('#stream');
    if (el) el.textContent = ok ? 'live' : 'reconnecting';
  });
  root.querySelector('#stream').textContent = 'live';

  const run = root.querySelector('#run');
  const out = root.querySelector('#race-res');
  run.addEventListener('click', async () => {
    run.disabled = true;
    out.innerHTML = '';
    try {
      const r = await api.race(Number(root.querySelector('#buyers').value));
      const winners = r.results.filter((x) => x.outcome === 'got it');
      const turned = r.results.length - winners.length;
      const shown = r.results.length <= 2 ? r.results : winners;
      out.innerHTML = shown
        .map((x) => `<div class="race-line ${x.outcome === 'got it' ? 'win' : ''}">
            <span class="who">${esc(x.buyer)}</span>
            ${x.order ? `<a class="o link" href="#/order/${x.order.id}">${esc(x.order.number)} · ${inr(x.order.total)}</a>` : `<span class="o muted">Sold out</span>`}
          </div>`)
        .join('') +
        (r.results.length > 2 ? `<div class="race-line"><span class="who">${turned} other ${turned === 1 ? 'buyer' : 'buyers'}</span><span class="o muted">Sold out</span></div>` : '') +
        `<div class="race-note mono">${r.results.length} requests settled in ${r.ms} ms, ${winners.length} unit${winners.length === 1 ? '' : 's'} sold</div>`;
    } catch (err) {
      out.innerHTML = `<div class="race-note" style="color:var(--neg)">${esc(err.message)}</div>`;
    } finally {
      run.disabled = false;
    }
  });
}
