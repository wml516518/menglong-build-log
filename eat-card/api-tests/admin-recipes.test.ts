import { beforeEach, describe, expect, it, vi } from 'vitest';
import { event, mockFetchJson, parseBody } from './helpers';
import { handler as saveRecipe } from '../api/admin-recipes.js';
import { handler as updateStatus } from '../api/admin-recipes-status.js';

const validRecipe = {
  title: '番茄肥牛饭',
  description: '15分钟的一人食下饭菜',
  budgetCents: 2200,
  cookMinutes: 15,
  servings: 1,
  difficulty: 'easy',
  tags: ['一人食'],
  ingredients: ['肥牛卷150g'],
  steps: ['番茄切块炒软'],
  tips: '肥牛可以换成鸡蛋',
  status: 'draft'
};

describe('admin recipe functions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.ADMIN_API_TOKEN = 'admin-secret';
  });

  it('rejects invalid admin token', async () => {
    const response = await saveRecipe(event({
      method: 'POST',
      headers: { 'x-admin-token': 'wrong' },
      body: validRecipe
    }) as never);

    expect(response.statusCode).toBe(401);
  });

  it('rejects missing title with field errors', async () => {
    const response = await saveRecipe(event({
      method: 'POST',
      headers: { 'x-admin-token': 'admin-secret' },
      body: { ...validRecipe, title: '' }
    }) as never);

    expect(response.statusCode).toBe(422);
    expect(parseBody(response).errors.title).toBe('Title is required');
  });

  it('rejects null body with a controlled validation response', async () => {
    const response = await saveRecipe(event({
      method: 'POST',
      headers: { 'x-admin-token': 'admin-secret' },
      body: null
    }) as never);

    expect(response.statusCode).toBe(422);
    expect(parseBody(response).errors.title).toBe('Title is required');
  });

  it('creates a valid recipe', async () => {
    mockFetchJson([{ id: 'recipe-1', title: '番茄肥牛饭' }]);

    const response = await saveRecipe(event({
      method: 'POST',
      headers: { 'x-admin-token': 'admin-secret' },
      body: validRecipe
    }) as never);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response).recipe.id).toBe('recipe-1');
  });

  it('updates recipe status', async () => {
    mockFetchJson([{ id: 'recipe-1', status: 'published' }]);

    const response = await updateStatus(event({
      method: 'POST',
      headers: { 'x-admin-token': 'admin-secret' },
      body: { id: 'recipe-1', status: 'published' }
    }) as never);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response).recipe.status).toBe('published');
  });
});
