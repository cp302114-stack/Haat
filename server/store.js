import { randomUUID } from 'node:crypto';
import { query, tx } from './db.js';
import { bus, TOPICS } from './bus.js';
import { ledger } from './ledger.js';
import { CITIES } from './config.js';
import { RACE_SKU } from './seed-data.js';

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const MAX_PER_ITEM = 10;
export const FREE_DELIVERY_FROM = 999;
export const DELIVERY_FEE = 49;

export const deliveryFor = (subtotal) => (subtotal === 0 || subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE);
export const orderNumber = (seq) => `HT-${10000 + Number(seq)}`;

const shape = (r) => ({
  id: r.id,
  sku: r.sku,
  name: r.name,
  brand: r.brand,
  category: r.category,
  price: r.price,
  mrp: r.mrp,
  art: r.art,
  color: r.color,
  description: r.description,
  tags: String(r.tags || '').split('|').filter(Boolean),
});

// Available units per city for one product: on the shelf minus what open orders hold.
export async function stockMap(productId, client = { query }) {
  const { rows } = await client.query('SELECT city, qty, reserved FROM inventory WHERE product_id = $1', [productId]);
  const map = Object.fromEntries(CITIES.map((c) => [c, 0]));
  for (const r of rows) map[r.city] = r.qty - r.reserved;
  return map;
}

export async function listAllProducts() {
  const { rows } = await query('SELECT * FROM products ORDER BY id');
  return rows.map(shape);
}

export async function getProduct(id, city) {
  const { rows } = await query('SELECT * FROM products WHERE id = $1', [id]);
  if (!rows.length) throw new HttpError(404, 'Product not found');
  const stock = await stockMap(id);
  return { ...shape(rows[0]), stock, available: city ? stock[city] ?? 0 : null };
}

export async function getProductByExactSku(sku) {
  const { rows } = await query('SELECT id FROM products WHERE sku = $1', [sku]);
  return rows[0]?.id;
}

// ------------------------------------------------------------------- carts
async function ensureCart(cartId, city) {
  const found = await query('SELECT id, city FROM carts WHERE id = $1', [cartId]);
  if (found.rows.length) {
    if (city && found.rows[0].city !== city) {
      await query('UPDATE carts SET city = $1, updated_at = now() WHERE id = $2', [city, cartId]);
    }
    return city || found.rows[0].city;
  }
  const use = city || CITIES[0];
  await query('INSERT INTO carts (id, city) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [cartId, use]);
  return use;
}

export async function readCart(cartId, city) {
  const cartCity = await ensureCart(cartId, city);
  const { rows } = await query(
    `SELECT ci.qty AS cart_qty, p.*, COALESCE(i.qty - i.reserved, 0) AS available
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN inventory i ON i.product_id = ci.product_id AND i.city = $2
      WHERE ci.cart_id = $1
      ORDER BY p.id`,
    [cartId, cartCity],
  );
  const items = rows.map((r) => ({
    ...shape(r),
    qty: r.cart_qty,
    available: r.available,
    lineTotal: r.price * r.cart_qty,
    ok: r.cart_qty <= r.available,
  }));
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const delivery = deliveryFor(subtotal);
  return {
    id: cartId,
    city: cartCity,
    items,
    count: items.reduce((s, i) => s + i.qty, 0),
    subtotal,
    delivery,
    total: subtotal + delivery,
    ready: items.length > 0 && items.every((i) => i.ok),
  };
}

async function availableIn(productId, city) {
  const { rows } = await query('SELECT qty, reserved FROM inventory WHERE product_id = $1 AND city = $2', [productId, city]);
  return rows.length ? rows[0].qty - rows[0].reserved : 0;
}

export async function setCartQty(cartId, city, productId, wanted, { add = false } = {}) {
  const cartCity = await ensureCart(cartId, city);
  const exists = await query('SELECT 1 FROM products WHERE id = $1', [productId]);
  if (!exists.rows.length) throw new HttpError(404, 'Product not found');

  const current = await query('SELECT qty FROM cart_items WHERE cart_id = $1 AND product_id = $2', [cartId, productId]);
  const have = current.rows[0]?.qty ?? 0;
  let next = add ? have + wanted : wanted;

  if (next <= 0) {
    await query('DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2', [cartId, productId]);
  } else {
    const available = await availableIn(productId, cartCity);
    if (available <= 0) throw new HttpError(409, `Out of stock in ${cartCity}`, { available });
    next = Math.min(next, available, MAX_PER_ITEM);
    await query(
      `INSERT INTO cart_items (cart_id, product_id, qty) VALUES ($1,$2,$3)
       ON CONFLICT (cart_id, product_id) DO UPDATE SET qty = EXCLUDED.qty`,
      [cartId, productId, next],
    );
  }
  await query('UPDATE carts SET updated_at = now() WHERE id = $1', [cartId]);
  return readCart(cartId, cartCity);
}

// ------------------------------------------------------------------ orders
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAYMENTS = ['cod', 'upi_on_delivery'];

function cleanCustomer(c = {}) {
  const name = String(c.name || '').trim().slice(0, 80);
  const email = String(c.email || '').trim().toLowerCase().slice(0, 120);
  const phone = String(c.phone || '').replace(/[^\d+]/g, '').slice(0, 15);
  const address = String(c.address || '').trim().slice(0, 240);
  if (name.length < 2) throw new HttpError(400, 'Enter your name');
  if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email');
  if (phone.replace(/\D/g, '').length < 10) throw new HttpError(400, 'Enter a 10 digit phone number');
  if (address.length < 8) throw new HttpError(400, 'Enter a delivery address');
  return { name, email, phone, address };
}

async function orderEventData(orderId) {
  const o = await query(
    `SELECT o.*, c.name AS customer_name, c.email AS customer_email
       FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = $1`,
    [orderId],
  );
  if (!o.rows.length) return null;
  const items = await query('SELECT product_id, name, price, qty FROM order_items WHERE order_id = $1 ORDER BY product_id', [orderId]);
  const r = o.rows[0];
  return {
    orderId: r.id,
    number: orderNumber(r.seq),
    city: r.city,
    total: r.total,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    items: items.rows.map((i) => ({ productId: i.product_id, name: i.name, price: i.price, qty: i.qty })),
  };
}

// Reads the stock that other services need to see after a change.
async function changesFor(items, city) {
  const out = [];
  for (const i of items) {
    const { rows } = await query('SELECT qty, reserved FROM inventory WHERE product_id = $1 AND city = $2', [i.productId, city]);
    out.push({ productId: i.productId, name: i.name, city, onShelf: rows[0].qty, available: rows[0].qty - rows[0].reserved });
  }
  return out;
}

async function publishPlaced(data) {
  await bus.publish(TOPICS.orders, 'order.placed', data.orderId, data);
  await query('UPDATE orders SET published = true WHERE id = $1', [data.orderId]);
}

export async function placeOrder({ cartId, customer, payment, city }) {
  const who = cleanCustomer(customer);
  if (!PAYMENTS.includes(payment)) throw new HttpError(400, 'Choose a payment method');
  const cart = await readCart(cartId, city);
  if (!cart.items.length) throw new HttpError(400, 'Your cart is empty');

  const started = Date.now();
  const orderId = randomUUID();

  // One transaction: claim the stock, save the order, empty the cart.
  // The conditional UPDATE is the whole trick. Two buyers going for the last unit
  // both try it, PostgreSQL runs them one after the other, and the second one
  // finds qty - reserved < 1 and touches zero rows.
  const saved = await tx(async (db) => {
    const short = [];
    const ordered = [...cart.items].sort((a, b) => a.id - b.id); // same lock order for everyone
    for (const item of ordered) {
      const res = await db.query(
        `UPDATE inventory
            SET reserved = reserved + $1::int, updated_at = now()
          WHERE product_id = $2 AND city = $3 AND qty - reserved >= $1::int`,
        [item.qty, item.id, cart.city],
      );
      if (res.rowCount === 0) {
        const now = await db.query('SELECT qty, reserved FROM inventory WHERE product_id = $1 AND city = $2', [item.id, cart.city]);
        short.push({ productId: item.id, name: item.name, available: now.rows[0] ? now.rows[0].qty - now.rows[0].reserved : 0 });
      }
    }
    if (short.length) throw new HttpError(409, 'Some items are no longer available', { code: 'out_of_stock', items: short });

    const cust = await db.query(
      `INSERT INTO customers (name, email, phone) VALUES ($1,$2,$3)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone
       RETURNING id`,
      [who.name, who.email, who.phone],
    );
    const ord = await db.query(
      `INSERT INTO orders (id, customer_id, city, status, total, payment_method, address)
       VALUES ($1,$2,$3,'placed',$4,$5,$6) RETURNING seq`,
      [orderId, cust.rows[0].id, cart.city, cart.total, payment, who.address],
    );
    for (const item of ordered) {
      await db.query('INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES ($1,$2,$3,$4,$5)', [
        orderId, item.id, item.name, item.price, item.qty,
      ]);
    }
    await db.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
    return ord.rows[0].seq;
  });

  const number = orderNumber(saved);
  ledger.add({
    service: 'postgres',
    action: 'order saved',
    detail: `${number} · ${cart.items.length} ${cart.items.length === 1 ? 'item' : 'items'} reserved in ${cart.city}`,
    order: orderId,
    ms: Date.now() - started,
  });

  const data = await orderEventData(orderId);
  try {
    await publishPlaced(data);
    // Reserved stock changes what can be sold, so tell the search index right away.
    await bus.publish(TOPICS.inventory, 'inventory.changed', orderId, {
      orderId, number, reason: 'reserved', changes: await changesFor(data.items, cart.city),
    });
  } catch (err) {
    // The order is safe in PostgreSQL. The outbox sweeper will publish it.
    console.error('publish failed, outbox will retry:', err.message);
    ledger.add({ service: 'kafka', action: 'failed', detail: `${number} not published yet, will retry`, order: orderId });
  }
  return { id: orderId, number, total: cart.total, city: cart.city };
}

// Orders saved in PostgreSQL whose event never reached Kafka get published here.
export async function sweepOutbox() {
  const { rows } = await query(
    `SELECT id FROM orders WHERE published = false AND status = 'placed' AND created_at < $1 ORDER BY seq LIMIT 20`,
    [new Date(Date.now() - 5000)],
  );
  for (const r of rows) {
    try {
      const data = await orderEventData(r.id);
      await publishPlaced(data);
      ledger.add({ service: 'kafka', action: 'retried', detail: `${data.number} published from outbox`, order: r.id });
    } catch (err) {
      console.error('outbox retry failed:', err.message);
    }
  }
}

export async function getOrder(id) {
  const o = await query(
    `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
       FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = $1`,
    [id],
  );
  if (!o.rows.length) throw new HttpError(404, 'Order not found');
  const r = o.rows[0];
  const items = await query(
    `SELECT oi.*, p.art, p.color, p.brand FROM order_items oi JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = $1 ORDER BY oi.product_id`,
    [id],
  );
  const note = await query('SELECT channel, recipient, subject, body, created_at FROM notifications WHERE order_id = $1 ORDER BY id', [id]);
  const subtotal = items.rows.reduce((s, i) => s + i.price * i.qty, 0);
  return {
    id: r.id,
    number: orderNumber(r.seq),
    status: r.status,
    city: r.city,
    total: r.total,
    subtotal,
    delivery: r.total - subtotal,
    payment: r.payment_method,
    address: r.address,
    createdAt: r.created_at,
    confirmedAt: r.confirmed_at,
    customer: { name: r.customer_name, email: r.customer_email, phone: r.customer_phone },
    items: items.rows.map((i) => ({
      productId: i.product_id, name: i.name, brand: i.brand, price: i.price, qty: i.qty, art: i.art, color: i.color,
    })),
    notifications: note.rows,
  };
}

// ------------------------------------------------- work done by Kafka consumers
// Commits the shelf count for a placed order. Safe to run twice for the same event.
export async function confirmOrder(event) {
  const orderId = event.data.orderId;
  const started = Date.now();
  const result = await tx(async (db) => {
    const seen = await db.query(
      'INSERT INTO processed_events (event_id, consumer) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [event.id, 'inventory-service'],
    );
    if (seen.rowCount === 0) return null;

    const flipped = await db.query(
      `UPDATE orders SET status = 'confirmed', confirmed_at = now() WHERE id = $1 AND status = 'placed'`,
      [orderId],
    );
    if (flipped.rowCount === 0) return null;

    const items = await db.query('SELECT product_id, name, qty FROM order_items WHERE order_id = $1 ORDER BY product_id', [orderId]);
    const city = (await db.query('SELECT city FROM orders WHERE id = $1', [orderId])).rows[0].city;
    for (const i of items.rows) {
      await db.query(
        `UPDATE inventory SET qty = qty - $1::int, reserved = reserved - $1::int, updated_at = now()
          WHERE product_id = $2 AND city = $3`,
        [i.qty, i.product_id, city],
      );
    }
    return { city, items: items.rows.map((i) => ({ productId: i.product_id, name: i.name, qty: i.qty })) };
  });
  if (!result) return;

  ledger.add({
    service: 'postgres',
    action: 'stock committed',
    detail: `${event.data.number} · ${result.items.map((i) => `${i.name} −${i.qty}`).join(', ')}`,
    order: orderId,
    ms: Date.now() - started,
  });
  ledger.order({ orderId, status: 'confirmed' });

  await bus.publish(TOPICS.inventory, 'inventory.changed', orderId, {
    orderId, number: event.data.number, reason: 'committed', changes: await changesFor(result.items, result.city),
  });
  await bus.publish(TOPICS.orders, 'order.confirmed', orderId, event.data);
}

export async function recordNotification(event) {
  const d = event.data;
  const seen = await query(
    'INSERT INTO processed_events (event_id, consumer) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [event.id, 'notification-service'],
  );
  if (seen.rowCount === 0) return;
  const lines = d.items.map((i) => `${i.qty} × ${i.name}`).join(', ');
  const subject = `Order ${d.number} is confirmed`;
  const body = `Hi ${d.customerName.split(' ')[0]}, we have your order ${d.number}: ${lines}. Total ₹${d.total.toLocaleString('en-IN')} to pay on delivery in ${d.city}.`;
  await query(
    'INSERT INTO notifications (order_id, channel, recipient, subject, body) VALUES ($1,$2,$3,$4,$5)',
    [d.orderId, 'email', d.customerEmail, subject, body],
  );
  ledger.add({ service: 'notify', action: 'confirmation recorded', detail: `${subject} · ${d.customerEmail}`, order: d.orderId });
  ledger.order({ orderId: d.orderId, status: 'confirmed', notified: true });
}

// ------------------------------------------------------------------ demo race
// Puts one unit on the shelf and sends two buyers after it at the same moment.
export async function raceForLastUnit({ buyers: count = 2, units = 1 } = {}) {
  const city = 'Mumbai';
  const productId = await getProductByExactSku(RACE_SKU);
  await query('UPDATE inventory SET qty = $1::int, reserved = 0, updated_at = now() WHERE product_id = $2 AND city = $3', [units, productId, city]);
  const product = await getProduct(productId, city);
  await bus.publish(TOPICS.inventory, 'inventory.changed', `race-${Date.now()}`, {
    reason: 'demo reset', changes: [{ productId, name: product.name, city, onShelf: units, available: units }],
  });

  const named = [
    { name: 'Asha Rao', address: '14 Linking Road, Bandra West, Mumbai 400050' },
    { name: 'Vikram Shah', address: '7 Marine Drive, Churchgate, Mumbai 400020' },
  ];
  const buyers = Array.from({ length: count }, (_, i) => ({
    name: named[i]?.name ?? `Buyer ${i + 1}`,
    email: `buyer${i + 1}.demo@example.com`,
    phone: `98200${String(10000 + i).slice(-5)}`,
    address: named[i]?.address ?? `${i + 1} Demo Lane, Mumbai 400001`,
  }));
  const attempts = [];
  for (const b of buyers) {
    const cartId = randomUUID();
    await setCartQty(cartId, city, productId, 1, { add: true });
    attempts.push({ buyer: b, cartId });
  }

  const started = Date.now();
  const settled = await Promise.allSettled(
    attempts.map((a) => placeOrder({ cartId: a.cartId, customer: a.buyer, payment: 'cod', city })),
  );
  const results = settled.map((s, i) => {
    const buyer = attempts[i].buyer.name;
    if (s.status === 'fulfilled') return { buyer, outcome: 'got it', order: s.value };
    return { buyer, outcome: 'sold out', reason: s.reason.message };
  });
  return { product: { id: productId, name: product.name, city }, results, ms: Date.now() - started };
}

export async function counts() {
  const p = await query('SELECT COUNT(*)::int AS n FROM products');
  const o = await query('SELECT COUNT(*)::int AS n FROM orders');
  return { products: p.rows[0].n, orders: o.rows[0].n };
}
