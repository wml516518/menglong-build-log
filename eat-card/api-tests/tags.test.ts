import { beforeEach, describe, expect, it, vi } from 'vitest';
import { event, mockFetchJson, parseBody } from './helpers';
import { handler } from '../api/tags.js';

describe('tags function', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });

  it('returns tags in a stable shape', async () => {
    mockFetchJson([
      { id: 'tag-1', name: '清淡', type: 'taste', sort_order: 10 },
      { id: 'tag-2', name: '一人食', type: 'scenario', sort_order: 10 }
    ]);

    const response = await handler(event() as never);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response).tags).toEqual([
      { id: 'tag-1', name: '清淡', type: 'taste', sortOrder: 10 },
      { id: 'tag-2', name: '一人食', type: 'scenario', sortOrder: 10 }
    ]);
  });
});
