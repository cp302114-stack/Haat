import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

// A value can be a path to a PEM file or the PEM text itself.
function pem(value) {
  if (!value) return undefined;
  if (value.includes('-----BEGIN')) return value.replace(/\\n/g, '\n');
  const file = path.resolve(value);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined;
}

const env = process.env;

export const config = {
  port: Number(env.PORT || 3000),

  pg: {
    url: env.DATABASE_URL || '',
    ca: pem(env.PG_CA),
  },

  kafka: {
    brokers: (env.KAFKA_BROKERS || '').split(',').map((s) => s.trim()).filter(Boolean),
    ca: pem(env.KAFKA_CA),
    cert: pem(env.KAFKA_CERT),
    key: pem(env.KAFKA_KEY),
    sasl: env.KAFKA_SASL_MECHANISM
      ? {
          mechanism: env.KAFKA_SASL_MECHANISM,
          username: env.KAFKA_SASL_USERNAME,
          password: env.KAFKA_SASL_PASSWORD,
        }
      : null,
    prefix: env.KAFKA_TOPIC_PREFIX || 'haat',
    replication: Number(env.KAFKA_REPLICATION || 1),
  },

  opensearch: {
    url: env.OPENSEARCH_URL || '',
    ca: pem(env.OPENSEARCH_CA),
    index: env.OPENSEARCH_INDEX || 'haat-products',
  },
};

export const CITIES = [
  'Mumbai',
  'Delhi',
  'Bengaluru',
  'Hyderabad',
  'Chennai',
  'Pune',
  'Kolkata',
  'Ahmedabad',
];

export const CATEGORIES = [
  'Electronics',
  'Fashion',
  'Home and Kitchen',
  'Beauty and Care',
  'Sports and Fitness',
  'Books and Stationery',
];
