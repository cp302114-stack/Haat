import { randomUUID } from 'node:crypto';
import { Kafka, logLevel } from 'kafkajs';
import { config } from './config.js';
import { ledger } from './ledger.js';

export const TOPICS = {
  orders: `${config.kafka.prefix}.orders`,
  inventory: `${config.kafka.prefix}.inventory`,
};

export const busInfo = { mode: 'unset', brokers: '' };

const MAX_ATTEMPTS = 3;
const subscriptions = []; // { name, topics, handler }

// Runs a handler with retries. A message that keeps failing is logged and
// skipped so one bad event cannot block the topic.
async function deliver(group, topic, event, meta, handler) {
  const started = Date.now();
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await handler(event, meta);
      ledger.add({
        service: 'kafka',
        action: 'consumed',
        detail: `${event.type} · ${group}`,
        order: event.data?.orderId || null,
        ms: Date.now() - started,
        meta: { topic, partition: meta.partition, offset: meta.offset },
      });
      return;
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        ledger.add({
          service: 'kafka',
          action: 'failed',
          detail: `${event.type} · ${group} gave up: ${err.message}`,
          order: event.data?.orderId || null,
        });
        console.error(`[${group}] ${event.type} failed`, err);
      } else {
        await new Promise((r) => setTimeout(r, 200 * attempt));
      }
    }
  }
}

// ---------------------------------------------------------------- Aiven Kafka
function createKafka() {
  const { brokers, ca, cert, key, sasl } = config.kafka;
  const ssl = ca ? { ca: [ca], ...(cert && key ? { cert, key } : {}) } : { rejectUnauthorized: false };
  return new Kafka({
    clientId: 'haat-store',
    brokers,
    ssl,
    ...(sasl ? { sasl } : {}),
    logLevel: logLevel.ERROR,
    connectionTimeout: 15000,
    retry: { retries: 6 },
  });
}

const aiven = {
  kafka: null,
  producer: null,
  consumers: [],

  async connect() {
    this.kafka = createKafka();
    const admin = this.kafka.admin();
    await admin.connect();
    await admin.createTopics({
      waitForLeaders: true,
      topics: Object.values(TOPICS).map((topic) => ({
        topic,
        numPartitions: 1,
        replicationFactor: config.kafka.replication,
      })),
    });
    await admin.disconnect();
    this.producer = this.kafka.producer({ allowAutoTopicCreation: false, idempotent: false });
    await this.producer.connect();
  },

  async publish(topic, event) {
    const res = await this.producer.send({
      topic,
      messages: [{ key: event.key, value: JSON.stringify(event), headers: { type: event.type } }],
    });
    const r = res[0];
    return { partition: r.partition, offset: Number(r.baseOffset) };
  },

  async start() {
    const joined = [];
    for (const sub of subscriptions) {
      const consumer = this.kafka.consumer({ groupId: `${config.kafka.prefix}-${sub.name}` });
      // Resolves once the group has partitions, so no event is produced before someone can read it.
      joined.push(new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Kafka consumer ${sub.name} did not join its group in 45s`)), 45000);
        consumer.on(consumer.events.GROUP_JOIN, () => { clearTimeout(timer); resolve(); });
      }));
      await consumer.connect();
      for (const topic of sub.topics) await consumer.subscribe({ topic, fromBeginning: false });
      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          let event;
          try {
            event = JSON.parse(message.value.toString());
          } catch {
            return;
          }
          await deliver(sub.name, topic, event, { partition, offset: Number(message.offset) }, sub.handler);
        },
      });
      this.consumers.push(consumer);
    }
    await Promise.all(joined);
  },

  async close() {
    await this.producer?.disconnect();
    await Promise.all(this.consumers.map((c) => c.disconnect()));
  },
};

// ------------------------------------------------------- local stand-in broker
const local = {
  offsets: new Map(),
  queues: new Map(),

  async connect() {},

  async publish(topic, event) {
    const offset = this.offsets.get(topic) ?? 0;
    this.offsets.set(topic, offset + 1);
    const meta = { partition: 0, offset };
    // Every group that subscribed to the topic gets its own copy, in order.
    for (const sub of subscriptions) {
      if (!sub.topics.includes(topic)) continue;
      const tail = this.queues.get(sub.name) ?? Promise.resolve();
      const next = tail.then(() => new Promise((r) => setTimeout(r, 30))).then(() =>
        deliver(sub.name, topic, JSON.parse(JSON.stringify(event)), meta, sub.handler),
      );
      this.queues.set(sub.name, next.catch(() => {}));
    }
    return meta;
  },

  async start() {},
  async close() {},
};

const impl = () => (config.kafka.brokers.length ? aiven : local);

// ----------------------------------------------------------------- public API
export const bus = {
  async connect() {
    busInfo.mode = config.kafka.brokers.length ? 'aiven' : 'local';
    busInfo.brokers = config.kafka.brokers.join(',') || 'in-process';
    await impl().connect();
  },

  subscribe(name, topics, handler) {
    subscriptions.push({ name, topics, handler });
  },

  async start() {
    await impl().start();
  },

  async publish(topic, type, key, data, extra = {}) {
    const event = { id: randomUUID(), type, key: String(key), ts: new Date().toISOString(), data };
    const started = Date.now();
    const meta = await impl().publish(topic, event);
    ledger.add({
      service: 'kafka',
      action: 'produced',
      detail: type,
      order: extra.order || data?.orderId || null,
      ms: Date.now() - started,
      meta: { topic, partition: meta.partition, offset: meta.offset },
    });
    return { event, ...meta };
  },

  async close() {
    await impl().close();
  },
};
