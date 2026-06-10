import { describe, expect, it } from 'vitest';
import { buildRecipePayload } from './app.js';

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
});
