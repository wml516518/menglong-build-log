// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';
import { execFileSync } from 'node:child_process';
import { computeSourceHash, translationGlossary } from './hash';

describe('source hash', () => {
  it('loads the glossary and hashes in the Node translation runtime', () => {
    const output = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval',
      'import { computeSourceHash } from "./scripts/translation/hash.ts"; console.log(computeSourceHash({ title: "中文" }, 1));'
    ], { encoding: 'utf8' });
    expect(output.trim()).toBe(computeSourceHash({ title: '中文' }, 1));
  });
  it('normalizes parsed YAML key ordering and all string newlines', () => {
    expect(computeSourceHash(load('title: 中文\nsummary: |\n  第一行\n  第二行\n'), 1)).toBe(
      computeSourceHash({ summary: '第一行\r\n第二行\r\n', title: '中文' }, 1));
    expect(computeSourceHash({ text: 'a\rb' }, 1)).toBe(computeSourceHash({ text: 'a\nb' }, 1));
    expect(computeSourceHash({}, 1)).toMatch(/^[a-f0-9]{64}$/);
  });
  it('includes Chinese copy, array ordering, full glossary and explicit policy version', () => {
    const hash = computeSourceHash({ title: '中文', tags: ['A', 'B'] }, 1);
    expect(hash).not.toBe(computeSourceHash({ title: '修改', tags: ['A', 'B'] }, 1));
    expect(hash).not.toBe(computeSourceHash({ title: '中文', tags: ['B', 'A'] }, 1));
    expect(hash).not.toBe(computeSourceHash({ title: '中文', tags: ['A', 'B'] }, 2));
    expect(hash).not.toBe(computeSourceHash({ title: '中文', tags: ['A', 'B'] }, 1, { ...translationGlossary, preferred: { 新词: 'New term' } }));
  });
});
