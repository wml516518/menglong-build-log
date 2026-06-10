import { beforeEach, describe, expect, it, vi } from 'vitest';
import { event, mockFetchJson, parseBody } from './helpers';
import { handler } from '../api/recipes-detail.js';

describe('recipes-detail function', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });

  it('returns recipe detail for a published recipe', async () => {
    mockFetchJson([
      {
        id: 'recipe-1',
        title: '鸡蛋豆腐盖饭',
        description: '便宜清淡',
        budget_cents: 1200,
        cook_minutes: 12,
        servings: 1,
        difficulty: 'easy',
        tags: ['清淡'],
        ingredients: ['鸡蛋2个'],
        steps: ['鸡蛋打散'],
        tips: '加香油',
        status: 'published'
      }
    ]);

    const response = await handler(event({ query: { id: 'recipe-1' } }) as never);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response).recipe.ingredients).toEqual(['鸡蛋2个']);
  });

  it('returns 404 when recipe is missing', async () => {
    mockFetchJson([]);

    const response = await handler(event({ query: { id: 'missing' } }) as never);

    expect(response.statusCode).toBe(404);
  });
});
