import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

function loadFormatModule() {
  const code = readFileSync(join(process.cwd(), 'eat-card/miniprogram/utils/format.js'), 'utf8');
  const module = { exports: {} };
  const wrapper = vm.runInNewContext(`(function (module, exports) { ${code}\n })`);
  wrapper(module, module.exports);
  return module.exports as {
    recipeDetail(recipe: Record<string, unknown>): {
      steps: Array<{ orderText: string; text: string }>;
    };
  };
}

const format = loadFormatModule();

describe('mini program recipe formatting', () => {
  it('keeps already formatted steps readable when opening saved AI meals', () => {
    const recipe = format.recipeDetail({
      id: 'ai-1',
      title: '番茄鸡蛋盖饭',
      steps: ['番茄切块', '炒鸡蛋']
    });

    const savedRecipe = format.recipeDetail(recipe);

    expect(savedRecipe.steps).toEqual([
      { orderText: '1.', text: '番茄切块' },
      { orderText: '2.', text: '炒鸡蛋' }
    ]);
  });
});
