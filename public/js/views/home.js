import { api } from '../api.js';
import { icon } from '../icons.js';
import { shelfScene } from '../art.js';
import { esc, inr, setTitle, toast } from '../util.js';
import { state, addToCart } from '../state.js';
import { bindAddButtons, productCard, skeletonGrid, stockTag } from '../components.js';

// The same four products the shelf is drawn from, in the colours the catalogue gives them.
const SHELF = [
  { art: 'bottle', color: '#2d6a6a' },
  { art: 'lamp', color: '#d9a63b' },
  { art: 'kettle', color: '#9aa3a8' },
  { art: 'mug', color: '#3b5c8a' },
];

function pickFromEveryAisle(hits, categories) {
  const by = new Map(categories.map((c) => [c, []]));
  for (const h of hits) by.get(h.category)?.push(h);
  const out = [];
  for (let round = 0; out.length < 8 && round < 3; round++) {
    for (const list of by.values()) if (list[round] && out.length < 8) out.push(list[round]);
  }
  return out;
}

export async function render(root, ctx) {
  setTitle('');
  root.innerHTML = `
    <section class="hero">
      <div class="wrap hero-grid">
        <div class="hero-copy stagger">
          <h1>Your city's shelves, online</h1>
          <p class="sub">Browse what our shops in eight cities have in stock today. The count on every tag is live, so what you see is what you can buy.</p>
          <div class="hero-actions">
            <a class="btn btn-primary btn-lg" href="#/search">Shop all products</a>
            <a class="btn btn-secondary btn-lg" href="#/ledger">See how it works</a>
          </div>
          <p class="hero-note">${icon('truck', 16)}<span>Pay on delivery. Free delivery over ${inr(state.meta.delivery.freeFrom)}.</span></p>
        </div>
        <div class="hero-visual" id="hero-visual">${shelfScene(SHELF)}<div id="hang-slot"></div></div>
      </div>
    </section>
    <div id="home-rest"></div>`;

  const rest = root.querySelector('#home-rest');
  rest.innerHTML = `<section class="section"><div class="wrap">${skeletonGrid(8)}</div></section>`;

  const paint = async () => {
    const city = state.city;
    const [all, tagHit] = await Promise.all([
      api.search({ city, size: 48 }),
      api.search({ city, q: 'insulated steel bottle', size: 1, quiet: 1 }),
    ]);
    if (!ctx.isCurrent(ctx.token)) return;

    const bottle = tagHit.hits[0];
    root.querySelector('#hang-slot').innerHTML = bottle
      ? `<div class="hang">
           <div class="hang-string"></div>
           <a class="hang-card" href="#/product/${bottle.id}" style="display:block">
             <div class="hn">${esc(bottle.name)}</div>
             <div class="hp num">${inr(bottle.price)}</div>
             <div class="hm mono muted">${esc(bottle.brand)} · ${esc(city)}</div>
             ${stockTag(bottle.id, city, bottle.available ?? 0)}
           </a>
         </div>`
      : '';

    const names = state.meta.categories;
    const counts = new Map(all.categories.map((c) => [c.name, c.count]));
    const featured = pickFromEveryAisle(all.hits, names);
    const lastFew = all.hits.filter((h) => h.available > 0 && h.available <= 4).slice(0, 4);

    rest.innerHTML = `
      <section class="section">
        <div class="wrap">
          <div class="section-head"><div><h2>Shop by category</h2><p>${all.total} products available in ${esc(city)}</p></div></div>
          <div class="cats stagger">
            ${names.map((n) => `<a class="cat" href="#/search?category=${encodeURIComponent(n)}"><div><div class="t">${esc(n)}</div><div class="c mono muted">${counts.get(n) ?? 0} products</div></div>${icon('arrow-right', 18)}</a>`).join('')}
          </div>
        </div>
      </section>
      <section class="section">
        <div class="wrap">
          <div class="section-head">
            <div><h2>From every aisle</h2></div>
            <a class="link" href="#/search">View all</a>
          </div>
          <div class="grid" id="featured">${featured.map((p) => productCard(p, city)).join('')}</div>
        </div>
      </section>
      ${lastFew.length ? `
      <section class="section">
        <div class="wrap">
          <div class="section-head"><div><h2>Last few in ${esc(city)}</h2><p>These tags change the moment someone checks out</p></div></div>
          <div class="grid" id="lastfew">${lastFew.map((p) => productCard(p, city)).join('')}</div>
        </div>
      </section>` : ''}`;
  };

  bindAddButtons(root, async (id) => {
    const cart = await addToCart(id, 1);
    const item = cart.items.find((i) => i.id === id);
    toast(`Added ${item?.name ?? 'item'}`, { href: '#/checkout', label: 'Checkout' });
  });

  ctx.on('city', paint);
  await paint();
}
