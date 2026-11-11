export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || 'Request failed');
    this.status = status;
    this.body = body || {};
  }
}

async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

const qs = (params) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : '';
};

export const api = {
  meta: () => call('GET', '/api/meta'),
  stats: () => call('GET', '/api/stats'),
  search: (p) => call('GET', `/api/search${qs(p)}`),
  suggest: (q) => call('GET', `/api/suggest${qs({ q })}`),
  product: (id, city) => call('GET', `/api/products/${id}${qs({ city })}`),
  cart: (id, city) => call('GET', `/api/cart/${id}${qs({ city })}`),
  setCity: (id, city) => call('PUT', `/api/cart/${id}/city`, { city }),
  addItem: (id, productId, city, qty = 1) => call('POST', `/api/cart/${id}/items`, { productId, city, qty }),
  setQty: (id, productId, city, qty) => call('PATCH', `/api/cart/${id}/items/${productId}`, { city, qty }),
  removeItem: (id, productId, city) => call('DELETE', `/api/cart/${id}/items/${productId}${qs({ city })}`),
  placeOrder: (payload) => call('POST', '/api/orders', payload),
  order: (id) => call('GET', `/api/orders/${id}`),
  ledger: (p = {}) => call('GET', `/api/ledger${qs(p)}`),
  race: (buyers = 2) => call('POST', `/api/demo/race?buyers=${buyers}&units=1`),
};
