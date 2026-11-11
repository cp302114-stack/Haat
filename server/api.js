import { Router } from 'express';
import { CATEGORIES, CITIES } from './config.js';
import { dbInfo, query } from './db.js';
import { busInfo, TOPICS } from './bus.js';
import { searchInfo, search } from './search.js';
import { ledger } from './ledger.js';
import { RACE_SKU } from './seed-data.js';
import {
  DELIVERY_FEE, FREE_DELIVERY_FROM, HttpError, MAX_PER_ITEM, counts, getOrder, getProduct,
  getProductByExactSku, placeOrder, raceForLastUnit, readCart, setCartQty,
} from './store.js';

export const api = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SORTS = ['relevance', 'price_asc', 'price_desc'];

const cityOf = (v) => (CITIES.includes(v) ? v : undefined);
const int = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};
const cartIdOf = (req) => {
  if (!UUID.test(req.params.cartId)) throw new HttpError(400, 'Invalid cart');
  return req.params.cartId;
};
const idOf = (v) => {
  const n = Number.parseInt(v, 10);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'Invalid product');
  return n;
};

// What the page needs to know about the three services.
api.get('/meta', async (_req, res) => {
  const raceId = await getProductByExactSku(RACE_SKU);
  res.json({
    cities: CITIES,
    categories: CATEGORIES,
    delivery: { freeFrom: FREE_DELIVERY_FROM, fee: DELIVERY_FEE },
    maxPerItem: MAX_PER_ITEM,
    race: { productId: raceId, city: 'Mumbai' },
    services: {
      postgres: { mode: dbInfo.mode, host: dbInfo.host },
      kafka: { mode: busInfo.mode, host: busInfo.brokers, topics: Object.values(TOPICS) },
      opensearch: { mode: searchInfo.mode, host: searchInfo.host, index: searchInfo.index },
    },
  });
});

api.get('/stats', async (_req, res) => {
  const c = await counts();
  res.json({
    ...c,
    indexed: await search.count(),
    produced: ledger.count('kafka.produced'),
    consumed: ledger.count('kafka.consumed'),
    searches: ledger.count('opensearch.searched'),
  });
});

// Search comes from OpenSearch, never from a SQL LIKE.
api.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  const city = cityOf(req.query.city);
  const category = CATEGORIES.includes(req.query.category) ? req.query.category : undefined;
  const size = Math.min(int(req.query.size) || 24, 48);
  const out = await search.search({
    q,
    category,
    city,
    inStock: req.query.inStock !== '0',
    min: int(req.query.min),
    max: int(req.query.max),
    sort: SORTS.includes(req.query.sort) ? req.query.sort : 'relevance',
    page: Math.max(int(req.query.page) || 1, 1),
    size,
  });
  if (q && !req.query.quiet) {
    ledger.add({
      service: 'opensearch',
      action: 'searched',
      detail: `“${q}”${city ? ` in ${city}` : ''} · ${out.total} ${out.total === 1 ? 'result' : 'results'}`,
      ms: out.took,
    });
  }
  res.json({
    q,
    total: out.total,
    took: out.took,
    engine: searchInfo.mode,
    categories: out.categories,
    hits: out.hits.map(({ all, score, stock, cities, ...p }) => ({ ...p, available: city ? stock?.[city] ?? 0 : null })),
  });
});

api.get('/suggest', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q.length < 2) return res.json({ took: 0, hits: [] });
  const out = await search.suggest(q);
  res.json({ ...out, engine: searchInfo.mode });
});

// Product detail and live stock come from PostgreSQL, the source of truth.
api.get('/products/:id', async (req, res) => {
  res.json(await getProduct(idOf(req.params.id), cityOf(req.query.city)));
});

api.get('/cart/:cartId', async (req, res) => {
  res.json(await readCart(cartIdOf(req), cityOf(req.query.city)));
});

api.put('/cart/:cartId/city', async (req, res) => {
  const city = cityOf(req.body?.city);
  if (!city) throw new HttpError(400, 'Choose a city');
  res.json(await readCart(cartIdOf(req), city));
});

api.post('/cart/:cartId/items', async (req, res) => {
  const city = cityOf(req.body?.city);
  const qty = Math.min(int(req.body?.qty) || 1, MAX_PER_ITEM);
  res.json(await setCartQty(cartIdOf(req), city, idOf(req.body?.productId), qty, { add: true }));
});

api.patch('/cart/:cartId/items/:productId', async (req, res) => {
  const qty = int(req.body?.qty);
  if (qty === undefined) throw new HttpError(400, 'Invalid quantity');
  res.json(await setCartQty(cartIdOf(req), cityOf(req.body?.city), idOf(req.params.productId), qty));
});

api.delete('/cart/:cartId/items/:productId', async (req, res) => {
  res.json(await setCartQty(cartIdOf(req), cityOf(req.query.city), idOf(req.params.productId), 0));
});

api.post('/orders', async (req, res) => {
  const b = req.body || {};
  if (!UUID.test(String(b.cartId))) throw new HttpError(400, 'Invalid cart');
  const order = await placeOrder({
    cartId: b.cartId,
    customer: { ...b.customer, address: b.address },
    payment: b.payment,
    city: cityOf(b.city),
  });
  res.status(201).json(order);
});

api.get('/orders/:id', async (req, res) => {
  if (!UUID.test(req.params.id)) throw new HttpError(404, 'Order not found');
  res.json(await getOrder(req.params.id));
});

api.get('/ledger', (req, res) => {
  const order = UUID.test(String(req.query.order)) ? req.query.order : null;
  res.json({ entries: ledger.recent({ order, limit: Math.min(int(req.query.limit) || 80, 200) }) });
});

api.post('/demo/race', async (req, res) => {
  const buyers = Math.min(Math.max(int(req.query.buyers) || 2, 2), 50);
  const units = Math.min(Math.max(int(req.query.units) || 1, 1), buyers - 1);
  res.json(await raceForLastUnit({ buyers, units }));
});

api.get('/health', async (_req, res) => {
  const checks = {};
  const run = async (name, fn) => {
    const t = Date.now();
    try {
      await fn();
      checks[name] = { ok: true, ms: Date.now() - t };
    } catch (e) {
      checks[name] = { ok: false, error: e.message };
    }
  };
  await run('postgres', () => query('SELECT 1'));
  await run('opensearch', () => search.count());
  res.status(Object.values(checks).every((c) => c.ok) ? 200 : 503).json({ checks });
});

// One stream for the whole site: ledger lines, live stock and order status.
api.get('/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send('hello', { ok: true });
  const offs = [
    ledger.onEntry((e) => send('ledger', e)),
    ledger.onStock((s) => send('stock', s)),
    ledger.onOrder((o) => send('order', o)),
  ];
  const beat = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => {
    clearInterval(beat);
    offs.forEach((off) => off());
  });
});
