import { Client } from '@opensearch-project/opensearch';
import { config } from './config.js';

export const searchInfo = { mode: 'unset', host: '', index: config.opensearch.index };

const INDEX = config.opensearch.index;

const MAPPING = {
  settings: { number_of_shards: 1, number_of_replicas: 0 },
  mappings: {
    properties: {
      sku: { type: 'keyword' },
      name: { type: 'search_as_you_type' },
      brand: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      category: { type: 'keyword' },
      tags: { type: 'text' },
      description: { type: 'text' },
      all: { type: 'search_as_you_type' },
      price: { type: 'integer' },
      mrp: { type: 'integer' },
      art: { type: 'keyword', index: false },
      color: { type: 'keyword', index: false },
      cities: { type: 'keyword' },
      stock: { type: 'object', dynamic: true },
    },
  },
};

// Builds the searchable document from a product row and its stock by city.
export function toDoc(product, stock) {
  const tags = String(product.tags || '').split('|').filter(Boolean);
  const cities = Object.entries(stock).filter(([, n]) => n > 0).map(([c]) => c);
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    category: product.category,
    price: product.price,
    mrp: product.mrp,
    art: product.art,
    color: product.color,
    description: product.description,
    tags,
    all: [product.name, product.brand, product.category, tags.join(' '), product.description].join(' '),
    stock,
    cities,
  };
}

// ------------------------------------------------------------- Aiven OpenSearch
const aiven = {
  client: null,

  async connect() {
    const u = new URL(config.opensearch.url);
    this.client = new Client({
      node: config.opensearch.url,
      ssl: config.opensearch.ca ? { ca: config.opensearch.ca } : { rejectUnauthorized: false },
    });
    await this.client.ping();
    searchInfo.host = u.hostname;
  },

  async ensureIndex() {
    const exists = await this.client.indices.exists({ index: INDEX });
    if (!exists.body) await this.client.indices.create({ index: INDEX, body: MAPPING });
  },

  async indexDocs(docs) {
    if (!docs.length) return;
    const body = docs.flatMap((d) => [{ index: { _index: INDEX, _id: String(d.id) } }, d]);
    const res = await this.client.bulk({ refresh: true, body });
    if (res.body.errors) {
      const bad = res.body.items.find((i) => i.index?.error);
      throw new Error(`OpenSearch bulk failed: ${JSON.stringify(bad?.index?.error)}`);
    }
  },

  async updateStock(id, stock) {
    const cities = Object.entries(stock).filter(([, n]) => n > 0).map(([c]) => c);
    await this.client.update({
      index: INDEX,
      id: String(id),
      refresh: true,
      body: { doc: { stock, cities } },
    });
  },

  async search({ q, category, city, inStock, min, max, sort, page, size }) {
    const filter = [];
    if (city && inStock) filter.push({ term: { cities: city } });
    if (min != null || max != null) {
      filter.push({ range: { price: { ...(min != null ? { gte: min } : {}), ...(max != null ? { lte: max } : {}) } } });
    }

    let must = [{ match_all: {} }];
    let should = [];
    if (q) {
      must = [{
        bool: {
          minimum_should_match: 1,
          should: [
            // Typo tolerant: "bluetoth" still finds Bluetooth.
            { match: { all: { query: q, fuzziness: 'AUTO', minimum_should_match: '2<75%' } } },
            // Partial words while typing: "blue" finds Bluetooth.
            { multi_match: { query: q, type: 'bool_prefix', fields: ['all', 'all._2gram', 'all._3gram'] } },
          ],
        },
      }];
      should = [
        { multi_match: { query: q, fields: ['name^4', 'tags^3', 'brand^2', 'category'], fuzziness: 'AUTO' } },
        { match_phrase: { name: { query: q, boost: 4 } } },
      ];
    }

    const sorts = {
      price_asc: [{ price: 'asc' }],
      price_desc: [{ price: 'desc' }],
      relevance: [{ _score: 'desc' }, { price: 'asc' }],
    };

    const res = await this.client.search({
      index: INDEX,
      body: {
        track_total_hits: true,
        from: (page - 1) * size,
        size,
        query: { bool: { must, should, filter } },
        post_filter: category ? { term: { category } } : undefined,
        aggs: { categories: { terms: { field: 'category', size: 20 } } },
        sort: sorts[sort] || sorts.relevance,
      },
    });
    const b = res.body;
    return {
      total: b.hits.total.value,
      took: b.took,
      hits: b.hits.hits.map((h) => ({ ...h._source, score: h._score })),
      categories: b.aggregations.categories.buckets.map((x) => ({ name: x.key, count: x.doc_count })),
    };
  },

  async suggest(q) {
    const res = await this.client.search({
      index: INDEX,
      body: {
        size: 6,
        _source: ['id', 'name', 'category', 'price', 'art', 'color'],
        query: {
          bool: {
            minimum_should_match: 1,
            should: [
              { multi_match: { query: q, type: 'bool_prefix', fields: ['name', 'name._2gram', 'name._3gram'] } },
              { match: { name: { query: q, fuzziness: 'AUTO' } } },
              { match: { all: { query: q, fuzziness: 'AUTO', minimum_should_match: '2<75%' } } },
            ],
          },
        },
      },
    });
    return { took: res.body.took, hits: res.body.hits.hits.map((h) => h._source) };
  },

  async count() {
    const res = await this.client.count({ index: INDEX });
    return res.body.count;
  },
};

// ------------------------------------------------------- local stand-in engine
const tokens = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

function distance(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

// Same rule as OpenSearch fuzziness AUTO.
const allowedEdits = (t) => (t.length <= 2 ? 0 : t.length <= 5 ? 1 : 2);

function termScore(term, docTokens, isLast) {
  let best = 0;
  const edits = allowedEdits(term);
  for (const d of docTokens) {
    if (d === term) return 1;
    if (isLast && d.startsWith(term)) best = Math.max(best, 0.8);
    else if (edits && distance(term, d, edits) <= edits) best = Math.max(best, 0.6);
  }
  return best;
}

const local = {
  docs: new Map(),

  async connect() { searchInfo.host = 'in-memory'; },
  async ensureIndex() {},

  async indexDocs(docs) {
    for (const d of docs) this.docs.set(d.id, JSON.parse(JSON.stringify(d)));
  },

  async updateStock(id, stock) {
    const d = this.docs.get(id);
    if (!d) return;
    d.stock = stock;
    d.cities = Object.entries(stock).filter(([, n]) => n > 0).map(([c]) => c);
  },

  score(doc, qTokens) {
    if (!qTokens.length) return 1;
    const fields = [
      [tokens(doc.name), 4],
      [doc.tags.flatMap(tokens), 3],
      [tokens(doc.brand), 2],
      [tokens(doc.category), 1.5],
      [tokens(doc.description), 1],
    ];
    let matched = 0;
    let score = 0;
    qTokens.forEach((t, i) => {
      let top = 0;
      for (const [toks, weight] of fields) top = Math.max(top, termScore(t, toks, i === qTokens.length - 1) * weight);
      if (top > 0) matched += 1;
      score += top;
    });
    const n = qTokens.length;
    const needed = n <= 2 ? n : Math.ceil(n * 0.75);
    return matched >= needed ? score : 0;
  },

  async search({ q, category, city, inStock, min, max, sort, page, size }) {
    const started = performance.now();
    const qTokens = tokens(q);
    let list = [];
    for (const doc of this.docs.values()) {
      if (city && inStock && !doc.cities.includes(city)) continue;
      if (min != null && doc.price < min) continue;
      if (max != null && doc.price > max) continue;
      const score = this.score(doc, qTokens);
      if (score > 0) list.push({ ...doc, score });
    }
    const counts = new Map();
    for (const d of list) counts.set(d.category, (counts.get(d.category) || 0) + 1);
    if (category) list = list.filter((d) => d.category === category);

    if (sort === 'price_asc') list.sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') list.sort((a, b) => b.price - a.price);
    else list.sort((a, b) => b.score - a.score || a.price - b.price);

    return {
      total: list.length,
      took: Math.max(1, Math.round(performance.now() - started)),
      hits: list.slice((page - 1) * size, page * size),
      categories: [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    };
  },

  async suggest(q) {
    const started = performance.now();
    const res = await this.search({ q, page: 1, size: 6, sort: 'relevance' });
    return {
      took: Math.max(1, Math.round(performance.now() - started)),
      hits: res.hits.map(({ id, name, category, price, art, color }) => ({ id, name, category, price, art, color })),
    };
  },

  async count() { return this.docs.size; },
};

const impl = () => (config.opensearch.url ? aiven : local);

export const search = {
  async connect() {
    searchInfo.mode = config.opensearch.url ? 'aiven' : 'local';
    await impl().connect();
    await impl().ensureIndex();
  },
  indexDocs: (docs) => impl().indexDocs(docs),
  updateStock: (id, stock) => impl().updateStock(id, stock),
  search: (params) => impl().search(params),
  suggest: (q) => impl().suggest(q),
  count: () => impl().count(),
};
