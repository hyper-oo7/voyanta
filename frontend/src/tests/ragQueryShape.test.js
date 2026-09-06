import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

// Service modules touch localStorage at import time; this suite runs without a DOM.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

let executeRAGQuery;

beforeAll(async () => {
  ({ executeRAGQuery } = await import('../services/api.js'));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('executeRAGQuery response shape', () => {
  it('unwraps the envelope so ragRes.data.chunks is the chunk list', async () => {
    // The regression: the endpoint responds {status, data:{chunks}}, callers
    // read ragRes.data.chunks — one level short. Chunks were always undefined,
    // so every generate showed "no matching documents" whatever the backend found.
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      status: 'success',
      data: { query: 'Sri Lanka travel itinerary', chunks: [{ id: 'c1' }, { id: 'c2' }] },
    })));

    const ragRes = await executeRAGQuery({ destination: 'Sri Lanka', duration_days: 6 });

    expect(ragRes.data.chunks).toHaveLength(2);
    expect(ragRes.data.query).toContain('Sri Lanka');
  });

  it('tolerates a flat body with no envelope', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ query: 'q', chunks: [{ id: 'c1' }] })));
    const ragRes = await executeRAGQuery({ destination: 'Manali' });
    expect(ragRes.data.chunks).toHaveLength(1);
  });
});
