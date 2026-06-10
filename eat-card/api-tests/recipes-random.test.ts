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
});
