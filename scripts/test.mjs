// End to end checks against the in-process services. Always runs on the local
// stand-ins, never on your Aiven services: npm test
process.env.DATABASE_URL = '';
process.env.KAFKA_BROKERS = '';
process.env.OPENSEARCH_URL = '';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startServices } from '../server/services.js';
import { query } from '../server/db.js';
import { search } from '../server/search.js';
import { confirmOrder, getOrder, placeOrder, setCartQty, stockMap, getProduct } from '../server/store.js';
import { bus, TOPICS } from '../server/bus.js';

await startServices({ log: () => {} });

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push([true, name]);
    console.log(`  ok   ${name}`);
  } catch (e) {
    results.push([false, name]);
    console.log(`  FAIL ${name}\n       ${e.message}`);
  }
}
const until = async (fn, ms = 4000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error('timed out waiting');
};
const buyer = (n) => ({ name: `Test Buyer ${n}`, email: `t${n}@example.com`, phone: '9876543210', address: '1 Test Street, Pune 411001' });
const q = (p) => search.search({ q: '', page: 1, size: 48, sort: 'relevance', inStock: true, ...p });

console.log('\nSearch');
await test('finds Bluetooth earphones from the typo "bluetoth earphnes"', async () => {
  const r = await q({ q: 'bluetoth earphnes', city: 'Mumbai' });
  assert.ok(r.hits.some((h) => h.name === 'Air Bluetooth Earphones'));
});
await test('filters by category', async () => {
  const r = await q({ category: 'Fashion', city: 'Mumbai' });
  assert.ok(r.hits.length > 0 && r.hits.every((h) => h.category === 'Fashion'));
});
await test('filters by price', async () => {
  const r = await q({ min: 300, max: 600, city: 'Mumbai' });
  assert.ok(r.hits.length > 0 && r.hits.every((h) => h.price >= 300 && h.price <= 600));
});
await test('filters by city: sold out products are hidden, then shown when stock filter is off', async () => {
  const { rows } = await query(`SELECT product_id, city FROM inventory WHERE qty = 0 LIMIT 1`);
  const { product_id, city } = rows[0];
  const hidden = await q({ city });
  assert.ok(!hidden.hits.some((h) => h.id === product_id));
  const shown = await q({ city, inStock: false });
  assert.ok(shown.hits.some((h) => h.id === product_id));
});

console.log('\nCart');
await test('cart quantity is capped at what is in stock', async () => {
  await query('UPDATE inventory SET qty = 2, reserved = 0 WHERE product_id = 3 AND city = $1', ['Delhi']);
  const cart = await setCartQty(randomUUID(), 'Delhi', 3, 9, { add: true });
  assert.equal(cart.items[0].qty, 2);
});

console.log('\nOrder flow');
await test('an order is saved, goes through Kafka, and every service reacts', async () => {
  const before = (await stockMap(1)).Mumbai;
  const cartId = randomUUID();
  await setCartQty(cartId, 'Mumbai', 1, 2, { add: true });
  const placed = await placeOrder({ cartId, city: 'Mumbai', payment: 'cod', customer: buyer(1), address: buyer(1).address });

  const order = await until(async () => {
    const o = await getOrder(placed.id);
    return o.status === 'confirmed' && o.notifications.length ? o : null;
  });
  assert.equal(order.items[0].qty, 2);
  assert.equal(order.notifications[0].recipient, 't1@example.com');

  const inv = (await query('SELECT qty, reserved FROM inventory WHERE product_id = 1 AND city = $1', ['Mumbai'])).rows[0];
  assert.equal(inv.reserved, 0);
  assert.equal(inv.qty, before - 2);

  const doc = await until(async () => {
    const r = await q({ q: 'Air Bluetooth Earphones', city: 'Mumbai' });
    const d = r.hits.find((h) => h.id === 1);
    return d && d.stock.Mumbai === before - 2 ? d : null;
  });
  assert.equal(doc.stock.Mumbai, before - 2);
});

await test('replaying the same Kafka event does not take stock twice', async () => {
  const cartId = randomUUID();
  await setCartQty(cartId, 'Mumbai', 2, 1, { add: true });
  const placed = await placeOrder({ cartId, city: 'Mumbai', payment: 'cod', customer: buyer(2), address: buyer(2).address });
  await until(async () => (await getOrder(placed.id)).status === 'confirmed');
  const after = (await query('SELECT qty FROM inventory WHERE product_id = 2 AND city = $1', ['Mumbai'])).rows[0].qty;
  const { rows } = await query('SELECT event_id FROM processed_events WHERE consumer = $1', ['inventory-service']);
  await confirmOrder({ id: rows[0].event_id, type: 'order.placed', data: { orderId: placed.id, number: placed.number } });
  await confirmOrder({ id: randomUUID(), type: 'order.placed', data: { orderId: placed.id, number: placed.number } });
  const again = (await query('SELECT qty FROM inventory WHERE product_id = 2 AND city = $1', ['Mumbai'])).rows[0].qty;
  assert.equal(again, after);
});

await test('an empty cart cannot be ordered', async () => {
  await assert.rejects(placeOrder({ cartId: randomUUID(), city: 'Mumbai', payment: 'cod', customer: buyer(3), address: buyer(3).address }), /cart is empty/);
});

console.log('\nStock accuracy');
await test('20 buyers race for 3 units: exactly 3 win, stock ends at 0, never below', async () => {
  await query('UPDATE inventory SET qty = 3, reserved = 0 WHERE product_id = 7 AND city = $1', ['Pune']);
  const carts = [];
  for (let i = 0; i < 20; i++) {
    const id = randomUUID();
    await setCartQty(id, 'Pune', 7, 1, { add: true });
    carts.push(id);
  }
  // Someone else buys the stock between "add to cart" and "checkout", the realistic case.
  const settled = await Promise.allSettled(
    carts.map((cartId, i) => placeOrder({ cartId, city: 'Pune', payment: 'cod', customer: buyer(100 + i), address: buyer(100 + i).address })),
  );
  const won = settled.filter((s) => s.status === 'fulfilled');
  const lost = settled.filter((s) => s.status === 'rejected');
  assert.equal(won.length, 3);
  assert.equal(lost.length, 17);
  assert.ok(lost.every((l) => l.reason.status === 409));

  await until(async () => {
    const o = await Promise.all(won.map((w) => getOrder(w.value.id)));
    return o.every((x) => x.status === 'confirmed');
  });
  const inv = (await query('SELECT qty, reserved FROM inventory WHERE product_id = 7 AND city = $1', ['Pune'])).rows[0];
  assert.deepEqual(inv, { qty: 0, reserved: 0 });
  const p = await getProduct(7, 'Pune');
  assert.equal(p.available, 0);
});

await test('the database itself refuses an oversell', async () => {
  await query('UPDATE inventory SET qty = 1, reserved = 0 WHERE product_id = 8 AND city = $1', ['Chennai']);
  await assert.rejects(query('UPDATE inventory SET reserved = 2 WHERE product_id = 8 AND city = $1', ['Chennai']));
});

await bus.close();
const failed = results.filter(([ok]) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
