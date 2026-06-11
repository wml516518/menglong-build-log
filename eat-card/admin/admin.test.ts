import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildRecipePayload, formatFieldErrors, submitRecipe } from './app.js';

afterEach(() => {
  vi.restoreAllMocks();
  delete window.EAT_CARD_API_BASE_URL;
  document.body.innerHTML = '';
});

describe('admin recipe payload', () => {
  it('converts textarea lines into arrays', () => {
    const payload = buildRecipePayload({
      title: '番茄肥牛饭',
      description: '下饭菜',
      budgetCents: '2200',
      cookMinutes: '15',
      servings: '1',
      difficulty: 'easy',
      tags: '一人食,下饭',
      ingredients: '肥牛卷150g\n番茄1个',
      steps: '番茄切块\n肥牛煮熟',
      tips: '可换鸡蛋',
      status: 'draft'
    });

    expect(payload.ingredients).toEqual(['肥牛卷150g', '番茄1个']);
    expect(payload.tags).toEqual(['一人食', '下饭']);
    expect(payload.budgetCents).toBe(2200);
  });

  it('trims blank lines and converts numeric fields', () => {
    const payload = buildRecipePayload({
      title: '  快手蛋炒饭  ',
      description: '  ',
      budgetCents: '1200',
      cookMinutes: '10',
      servings: '2',
      difficulty: 'normal',
      tags: ' 快手, , 主食 ',
      ingredients: ' 米饭1碗 \n\n 鸡蛋2个 ',
      steps: '\n炒鸡蛋\n加入米饭\n',
      tips: '',
      status: 'published'
    });

    expect(payload.title).toBe('快手蛋炒饭');
    expect(payload.description).toBe('');
    expect(payload.cookMinutes).toBe(10);
    expect(payload.servings).toBe(2);
    expect(payload.tags).toEqual(['快手', '主食']);
    expect(payload.ingredients).toEqual(['米饭1碗', '鸡蛋2个']);
    expect(payload.steps).toEqual(['炒鸡蛋', '加入米饭']);
  });

  it('includes an id when editing but omits the admin token from the recipe payload', () => {
    const payload = buildRecipePayload({
      id: '00000000-0000-4000-8000-000000000001',
      adminToken: 'secret-token',
      title: '  快手蛋炒饭  ',
      description: '下饭菜',
      budgetCents: '1200',
      cookMinutes: '10',
      servings: '2',
      difficulty: 'normal',
      tags: '快手',
      ingredients: '米饭1碗',
      steps: '炒鸡蛋',
      tips: '',
      status: 'draft'
    });

    expect(payload.id).toBe('00000000-0000-4000-8000-000000000001');
    expect(payload).not.toHaveProperty('adminToken');
  });

  it('formats field validation errors for display', () => {
    expect(formatFieldErrors({
      title: 'Title is required',
      ingredients: 'Add at least one ingredient'
    })).toBe('Title: Title is required\nIngredients: Add at least one ingredient');
  });

  it('posts recipes to the admin functions endpoint with the admin token header', async () => {
    document.body.innerHTML = `
      <form id="recipeForm">
        <input id="adminToken" name="adminToken" value=" secret-token ">
        <input name="title" value="番茄肥牛饭">
        <input name="description" value="下饭菜">
        <input name="budgetCents" value="2200">
        <input name="cookMinutes" value="15">
        <input name="servings" value="1">
        <select name="difficulty"><option value="easy" selected>Easy</option></select>
        <input name="tags" value="一人食,下饭">
        <textarea name="ingredients">肥牛卷150g
番茄1个</textarea>
        <textarea name="steps">番茄切块
肥牛煮熟</textarea>
        <textarea name="tips">可换鸡蛋</textarea>
        <select name="status"><option value="draft" selected>Draft</option></select>
      </form>
      <p id="status" role="status"></p>
    `;

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ title: '番茄肥牛饭' })
    } as Response);

    const form = document.querySelector('#recipeForm') as HTMLFormElement;
    await submitRecipe({
      preventDefault: vi.fn(),
      currentTarget: form
    } as unknown as SubmitEvent);

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body));

    expect(fetchMock).toHaveBeenCalledWith('/.netlify/functions/admin-recipes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': 'secret-token'
      },
      body: expect.any(String)
    });
    expect(body).not.toHaveProperty('adminToken');
    expect(document.querySelector('#status')?.textContent).toBe('Saved 番茄肥牛饭');
  });

  it('posts recipes to the configured Render API base URL', async () => {
    window.EAT_CARD_API_BASE_URL = 'https://eat-card-api.onrender.com/api/';
    document.body.innerHTML = `
      <form id="recipeForm">
        <input id="adminToken" name="adminToken" value=" secret-token ">
        <input name="title" value="番茄肥牛饭">
        <input name="description" value="下饭菜">
        <input name="budgetCents" value="2200">
        <input name="cookMinutes" value="15">
        <input name="servings" value="1">
        <select name="difficulty"><option value="easy" selected>Easy</option></select>
        <input name="tags" value="一人食,下饭">
        <textarea name="ingredients">肥牛卷150g</textarea>
        <textarea name="steps">番茄切块</textarea>
        <textarea name="tips">可换鸡蛋</textarea>
        <select name="status"><option value="draft" selected>Draft</option></select>
      </form>
      <p id="status" role="status"></p>
    `;

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ recipe: { title: '番茄肥牛饭' } })
    } as Response);

    const form = document.querySelector('#recipeForm') as HTMLFormElement;
    await submitRecipe({
      preventDefault: vi.fn(),
      currentTarget: form
    } as unknown as SubmitEvent);

    expect(fetchMock.mock.calls[0][0]).toBe('https://eat-card-api.onrender.com/api/admin-recipes');
  });

  it('displays API field validation errors returned from submit', async () => {
    document.body.innerHTML = `
      <form id="recipeForm">
        <input id="adminToken" name="adminToken" value=" secret-token ">
        <input name="title" value="">
        <input name="description" value="下饭菜">
        <input name="budgetCents" value="2200">
        <input name="cookMinutes" value="15">
        <input name="servings" value="1">
        <select name="difficulty"><option value="easy" selected>Easy</option></select>
        <input name="tags" value="一人食,下饭">
        <textarea name="ingredients">肥牛卷150g</textarea>
        <textarea name="steps">番茄切块</textarea>
        <textarea name="tips">可换鸡蛋</textarea>
        <select name="status"><option value="draft" selected>Draft</option></select>
      </form>
      <p id="status" role="status"></p>
    `;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ errors: { title: 'Title is required' } })
    } as Response);

    const form = document.querySelector('#recipeForm') as HTMLFormElement;
    await submitRecipe({
      preventDefault: vi.fn(),
      currentTarget: form
    } as unknown as SubmitEvent);

    expect(document.querySelector('#status')?.textContent).toBe('Title: Title is required');
  });
});
