import { connectDb, dbInfo } from './db.js';
import { bus, busInfo } from './bus.js';
import { search, searchInfo, toDoc } from './search.js';
import { registerConsumers } from './consumers.js';
import { listAllProducts, stockMap } from './store.js';
import { ledger } from './ledger.js';

const label = { aiven: 'Aiven', local: 'local stand-in' };

// Connects PostgreSQL, Kafka and OpenSearch, rebuilds the search index from the
// database and starts the three consumer groups.
export async function startServices({ log = console.log } = {}) {
  await connectDb();
  log(`PostgreSQL  ${label[dbInfo.mode]} (${dbInfo.host})`);

  registerConsumers();
  await bus.connect();
  log(`Kafka       ${label[busInfo.mode]} (${busInfo.brokers})`);

  await search.connect();
  log(`OpenSearch  ${label[searchInfo.mode]} (${searchInfo.host})`);

  // The index is rebuilt from PostgreSQL on every start, so it can never drift for long.
  const docs = [];
  for (const p of await listAllProducts()) docs.push(toDoc(p, await stockMap(p.id)));
  await search.indexDocs(docs);
  ledger.add({ service: 'opensearch', action: 'indexed', detail: `${docs.length} products from PostgreSQL` });

  await bus.start();
}
