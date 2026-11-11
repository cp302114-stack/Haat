import { EventEmitter } from 'node:events';

// The ledger is the running record of everything the three services do.
// It feeds the "Behind the counter" page and the live trail on an order.
const MAX = 400;
const entries = [];
const bus = new EventEmitter();
bus.setMaxListeners(0);
let seq = 0;
const counts = new Map();

export const ledger = {
  add({ service, action, detail, order = null, ms = null, meta = null }) {
    const entry = { seq: ++seq, at: new Date().toISOString(), service, action, detail, order, ms, meta };
    entries.push(entry);
    counts.set(`${service}.${action}`, (counts.get(`${service}.${action}`) || 0) + 1);
    if (entries.length > MAX) entries.shift();
    bus.emit('entry', entry);
    return entry;
  },
  count(key) {
    return counts.get(key) || 0;
  },
  recent({ order = null, limit = 80 } = {}) {
    const list = order ? entries.filter((e) => e.order === order) : entries;
    return list.slice(-limit);
  },
  onEntry(fn) {
    bus.on('entry', fn);
    return () => bus.off('entry', fn);
  },
  // Pushes a live stock change to every open page.
  stock(change) {
    bus.emit('stock', change);
  },
  onStock(fn) {
    bus.on('stock', fn);
    return () => bus.off('stock', fn);
  },
  order(change) {
    bus.emit('order', change);
  },
  onOrder(fn) {
    bus.on('order', fn);
    return () => bus.off('order', fn);
  },
};
