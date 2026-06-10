import { vi } from 'vitest';

export function parseBody(response: { body?: string }) {
  return response.body ? JSON.parse(response.body) : undefined;
}

export function event({
  method = 'GET',
  query = {},
  body,
  headers = {}
}: {
  method?: string;
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
} = {}) {
  return {
    httpMethod: method,
    queryStringParameters: query,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  };
}

export function mockFetchJson(data: unknown, ok = true, status = 200) {
  globalThis.fetch = vi.fn(async () => ({
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data)
  })) as unknown as typeof fetch;
}
