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

  it('returns 500 when admin token is missing', async () => {
    delete process.env.ADMIN_API_TOKEN;

    const response = await saveRecipe(event({
      method: 'POST',
      headers: { 'x-admin-token': 'admin-secret' },
      body: validRecipe
    }) as never);

    expect(response.statusCode).toBe(500);
    expect(parseBody(response).error).toBe('Missing environment variable: ADMIN_API_TOKEN');
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

  it('rejects invalid recipe update ids before calling Supabase', async () => {
    const response = await saveRecipe(event({
      method: 'POST',
      headers: { 'x-admin-token': 'admin-secret' },
      body: { ...validRecipe, id: 'abc&status=eq.published' }
    }) as never);

    expect(response.statusCode).toBe(422);
    expect(parseBody(response).errors.id).toBe('id must be a valid UUID');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns 502 when saving receives a malformed Supabase success response', async () => {
    mockFetchJson({ unexpected: true });

    const response = await saveRecipe(event({
      method: 'POST',
      headers: { 'x-admin-token': 'admin-secret' },
      body: validRecipe
    }) as never);

    expect(response.statusCode).toBe(502);
    expect(parseBody(response).error).toBe('Invalid recipe response');
  });

  it('updates recipe status', async () => {
    mockFetchJson([{ id: '00000000-0000-4000-8000-000000000001', status: 'published' }]);

    const response = await updateStatus(event({
      method: 'POST',
      headers: { 'x-admin-token': 'admin-secret' },
      body: { id: '00000000-0000-4000-8000-000000000001', status: 'published' }
    }) as never);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response).recipe.status).toBe('published');
  });

  it('rejects invalid status update ids before calling Supabase', async () => {
    const response = await updateStatus(event({
      method: 'POST',
      headers: { 'x-admin-token': 'admin-secret' },
      body: { id: 'abc&status=eq.published', status: 'published' }
    }) as never);

    expect(response.statusCode).toBe(422);
    expect(parseBody(response).errors.id).toBe('id must be a valid UUID');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rejects null status body with a controlled validation response', async () => {
    const response = await updateStatus(event({
      method: 'POST',
      headers: { 'x-admin-token': 'admin-secret' },
      body: null
    }) as never);

    expect(response.statusCode).toBe(422);
    expect(parseBody(response).errors.id).toBe('id is required');
  });

  it('returns 502 when status update receives a malformed Supabase success response', async () => {
    mockFetchJson({ unexpected: true });

    const response = await updateStatus(event({
      method: 'POST',
      headers: { 'x-admin-token': 'admin-secret' },
      body: { id: '00000000-0000-4000-8000-000000000001', status: 'published' }
    }) as never);

    expect(response.statusCode).toBe(502);
    expect(parseBody(response).error).toBe('Invalid recipe response');
  });
});
