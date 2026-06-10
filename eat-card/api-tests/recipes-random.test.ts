import { describe, expect, it, vi, beforeEach } from 'vitest';
import { event, mockFetchJson, parseBody } from './helpers';
import { handler } from '../api/recipes-random.js';

describe('recipes-random function', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });

  it('returns a published recipe that matches filters', async () => {
    mockFetchJson([
      {
        id: 'recipe-1',
        title: '番茄肥牛饭',
        description: '15分钟的一人食下饭菜',
        budget_cents: 2200,
        cook_minutes: 15,
        servings: 1,
        difficulty: 'easy',
        tags: ['一人食', '下饭'],
        tips: '肥牛可以换成鸡蛋'
      }
    ]);

    const response = await handler(event({
      query: {
        maxBudgetCents: '2500',
        maxCookMinutes: '20',
        servings: '1',
        tags: '一人食,下饭'
      }
    }) as never);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response).recipe.title).toBe('番茄肥牛饭');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/recipes'),
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'service-key',
          authorization: 'Bearer service-key'
        })
      })
    );
  });

  it('returns 404 when no recipe matches the filters', async () => {
    mockFetchJson([]);

    const response = await handler(event() as never);

    expect(response.statusCode).toBe(404);
    expect(parseBody(response).error).toBe('No matching recipe found');
  });

  it('returns 400 for invalid numeric query parameters', async () => {
    const response = await handler(event({
      query: {
        maxBudgetCents: 'cheap'
      }
    }) as never);

    expect(response.statusCode).toBe(400);
    expect(parseBody(response).error).toBe('maxBudgetCents must be a non-negative integer');
  });

  it('maps Supabase failures to upstream errors instead of validation errors', async () => {
    mockFetchJson({ message: 'database is unavailable' }, false, 503);

    const response = await handler(event() as never);

    expect(response.statusCode).toBe(502);
    expect(parseBody(response).error).toBe('database is unavailable');
  });

  it('maps malformed Supabase JSON to a server error instead of a validation error', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => 'temporarily unavailable'
    })) as unknown as typeof fetch;

    const response = await handler(event() as never);

    expect(response.statusCode).toBe(502);
    expect(parseBody(response).error).toBe('Supabase returned malformed JSON');
  });

  it('returns 500 when Supabase service role key is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await handler(event() as never);

    expect(response.statusCode).toBe(500);
    expect(parseBody(response).error).toBe('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
  });

  it('returns 502 when the recipe service cannot be reached', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const response = await handler(event() as never);

    expect(response.statusCode).toBe(502);
    expect(parseBody(response).error).toBe('Unable to reach recipe service');
  });

  it('includes tag filters for non-ASCII tags in the Supabase URL', async () => {
    mockFetchJson([
      {
        id: 'recipe-1',
        title: '番茄肥牛饭',
        description: '15分钟的一人食下饭菜',
        budget_cents: 2200,
        cook_minutes: 15,
        servings: 1,
        difficulty: 'easy',
        tags: ['一人食', '下饭'],
        tips: '肥牛可以换成鸡蛋'
      }
    ]);

    await handler(event({
      query: {
        tags: '一人食,下饭'
      }
    }) as never);

    const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.searchParams.getAll('tags')).toEqual(['cs.{一人食}', 'cs.{下饭}']);
  });
});
