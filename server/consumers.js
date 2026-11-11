import { bus, TOPICS } from './bus.js';
import { ledger } from './ledger.js';
import { search } from './search.js';
import { confirmOrder, recordNotification, stockMap } from './store.js';

// Three independent consumer groups. Each one sees every message on its topics,
// so each service can fail, restart or be scaled on its own.
export function registerConsumers() {
  // order.placed -> take the units off the shelf, then announce what changed.
  bus.subscribe('inventory-service', [TOPICS.orders], async (event) => {
    if (event.type === 'order.placed') await confirmOrder(event);
  });

  // order.confirmed -> send the customer their confirmation.
  bus.subscribe('notification-service', [TOPICS.orders], async (event) => {
    if (event.type === 'order.confirmed') await recordNotification(event);
  });

  // inventory.changed -> refresh the OpenSearch documents and open pages.
  bus.subscribe('search-sync', [TOPICS.inventory], async (event) => {
    if (event.type !== 'inventory.changed') return;
    const started = Date.now();
    const changes = event.data.changes || [];
    const ids = [...new Set(changes.map((c) => c.productId))];
    for (const id of ids) {
      const stock = await stockMap(id);
      await search.updateStock(id, stock);
      for (const c of changes.filter((x) => x.productId === id)) {
        ledger.stock({ productId: id, city: c.city, available: stock[c.city] ?? 0 });
      }
    }
    const names = [...new Set(changes.map((c) => c.name))].join(', ');
    ledger.add({
      service: 'opensearch',
      action: 'index updated',
      detail: `${names} · stock in sync`,
      order: event.data.orderId || null,
      ms: Date.now() - started,
    });
  });
}
