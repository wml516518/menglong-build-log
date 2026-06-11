import { beforeEach, describe, expect, it, vi } from 'vitest';
import { event, parseBody } from './helpers';
import { handler } from '../api/ai-meal.js';

const validInput = {
  budgetCents: 2000,
  cookMinutes: 15,
  servings: 1,
  preferences: ['清淡', '下饭'],
  ingredients: '鸡蛋、番茄、米饭',
  restrictions: '不要辣'
};

function mockDeepSeekResponse(content: string, ok = true, status = 200) {
  globalThis.fetch = vi.fn(async () => ({
    ok,
    status,
    text: async () => JSON.stringify({
      choices: [
        {
          message: {
            content
          }
        }
      ]
    })
  })) as unknown as typeof fetch;
}

describe('ai-meal function', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.DEEPSEEK_API_KEY = 'deepseek-key';
    process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';
  });

  it('generates a structured meal suggestion through DeepSeek', async () => {
    mockDeepSeekResponse(JSON.stringify({
      title: '番茄鸡蛋盖饭',
      reason: '符合预算、快手、一人食',
      budgetCents: 1500,
      cookMinutes: 12,
      servings: 1,
      difficulty: 'easy',
      tags: ['一人食', '清淡'],
      ingredients: ['鸡蛋2个', '番茄1个', '米饭1碗'],
      steps: ['番茄切块', '炒鸡蛋', '合炒后盖饭'],
      tips: '不吃辣可以不放辣椒'
    }));

    const response = await handler(event({ method: 'POST', body: validInput }) as never);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response).meal.title).toBe('番茄鸡蛋盖饭');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer deepseek-key'
        })
      })
    );
  });

  it('rejects overlong free-text input before calling DeepSeek', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const response = await handler(event({
      method: 'POST',
      body: {
        ...validInput,
        ingredients: '番茄'.repeat(200)
      }
    }) as never);

    expect(response.statusCode).toBe(422);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps missing DeepSeek API key to controlled 500', async () => {
    delete process.env.DEEPSEEK_API_KEY;

    const response = await handler(event({ method: 'POST', body: validInput }) as never);

    expect(response.statusCode).toBe(500);
    expect(parseBody(response).error).toContain('DEEPSEEK_API_KEY');
  });

  it('maps malformed DeepSeek JSON content to 502', async () => {
    mockDeepSeekResponse('今天可以吃番茄鸡蛋饭');

    const response = await handler(event({ method: 'POST', body: validInput }) as never);

    expect(response.statusCode).toBe(502);
  });
});
