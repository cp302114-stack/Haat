import pg from 'pg';
import { newDb } from 'pg-mem';
import { config } from './config.js';
import { PRODUCTS, buildInventory } from './seed-data.js';
import { ledger } from './ledger.js';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS products (
    id          SERIAL PRIMARY KEY,
    sku         TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    brand       TEXT NOT NULL,
    category    TEXT NOT NULL,
    price       INTEGER NOT NULL CHECK (price > 0),
    mrp         INTEGER NOT NULL,
    art         TEXT NOT NULL,
    color       TEXT NOT NULL,
    description TEXT NOT NULL,
    tags        TEXT NOT NULL
  )`,
  // qty is what is on the shelf, reserved is what open orders have claimed.
  // The CHECKs are the last line of defence: the database refuses to oversell
  // even if application code has a bug.
  `CREATE TABLE IF NOT EXISTS inventory (
    product_id  INTEGER NOT NULL REFERENCES products(id),
    city        TEXT NOT NULL,
    qty         INTEGER NOT NULL CHECK (qty >= 0),
    reserved    INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (product_id, city),
    CHECK (reserved <= qty)
  )`,
  `CREATE TABLE IF NOT EXISTS customers (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    phone       TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS carts (
    id          TEXT PRIMARY KEY,
    city        TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS cart_items (
    cart_id     TEXT NOT NULL REFERENCES carts(id),
    product_id  INTEGER NOT NULL REFERENCES products(id),
    qty         INTEGER NOT NULL CHECK (qty > 0),
    PRIMARY KEY (cart_id, product_id)
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id              TEXT PRIMARY KEY,
    seq             SERIAL,
    customer_id     INTEGER NOT NULL REFERENCES customers(id),
    city            TEXT NOT NULL,
    status          TEXT NOT NULL,
    total           INTEGER NOT NULL,
    payment_method  TEXT NOT NULL,
    address         TEXT NOT NULL,
    published       BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at    TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    order_id    TEXT NOT NULL REFERENCES orders(id),
    product_id  INTEGER NOT NULL REFERENCES products(id),
    name        TEXT NOT NULL,
    price       INTEGER NOT NULL,
    qty         INTEGER NOT NULL CHECK (qty > 0),
    PRIMARY KEY (order_id, product_id)
  )`,
  // One row per (event, consumer group). Replays of a Kafka message do nothing.
  `CREATE TABLE IF NOT EXISTS processed_events (
    event_id      TEXT NOT NULL,
    consumer      TEXT NOT NULL,
    processed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, consumer)
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    order_id    TEXT NOT NULL REFERENCES orders(id),
    channel     TEXT NOT NULL,
    recipient   TEXT NOT NULL,
    subject     TEXT NOT NULL,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];

let pool;
let mem = null;
let local = false;
let txQueue = Promise.resolve();

export const dbInfo = { mode: 'unset', host: '' };

export async function connectDb() {
  if (config.pg.url) {
    const u = new URL(config.pg.url);
    // pg reads sslmode=require as full certificate verification, which fails against
    // Aiven's project CA. Drop it and pass the ssl options explicitly instead.
    u.searchParams.delete('sslmode');
    pool = new pg.Pool({
      connectionString: u.toString(),
      max: 10,
      ssl: config.pg.ca ? { ca: config.pg.ca } : { rejectUnauthorized: false },
    });
    await pool.query('SELECT 1');
    dbInfo.mode = 'aiven';
    dbInfo.host = u.hostname;
  } else {
    mem = newDb();
    pool = new (mem.adapters.createPg().Pool)();
    local = true;
    dbInfo.mode = 'local';
    dbInfo.host = 'in-memory';
  }
  for (const sql of SCHEMA) await pool.query(sql);
  await seed();
  return dbInfo;
}

export function query(text, params) {
  return pool.query(text, params);
}

// Runs fn inside one transaction. On PostgreSQL, row level locks and the
// conditional UPDATEs in store.js keep concurrent orders correct. The in-memory
// stand-in has one shared snapshot, so transactions there run one at a time.
export async function tx(fn) {
  const run = async () => {
    // pg-mem ignores ROLLBACK, so the stand-in restores a snapshot instead.
    const snapshot = local ? mem.backup() : null;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* connection already gone */ }
      snapshot?.restore();
      throw err;
    } finally {
      client.release();
    }
  };
  if (!local) return run();
  const next = txQueue.then(run, run);
  txQueue = next.catch(() => {});
  return next;
}

async function seed() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM products');
  if (rows[0].n > 0) return;

  for (const p of PRODUCTS) {
    await pool.query(
      `INSERT INTO products (sku, name, brand, category, price, mrp, art, color, description, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [p.sku, p.name, p.brand, p.category, p.price, p.mrp, p.art, p.color, p.description, p.tags.join('|')],
    );
  }
  const ids = new Map((await pool.query('SELECT id, sku FROM products')).rows.map((r) => [r.sku, r.id]));
  for (const row of buildInventory()) {
    await pool.query('INSERT INTO inventory (product_id, city, qty) VALUES ($1,$2,$3)', [
      ids.get(row.sku), row.city, row.qty,
    ]);
  }
  ledger.add({ service: 'postgres', action: 'seeded', detail: `${PRODUCTS.length} products across ${new Set(buildInventory().map((r) => r.city)).size} cities` });
}
