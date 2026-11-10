// @vitest-environment node
import { realpathSync } from 'node:fs';
import { mkdir, writeFile, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir as systemTmpdir } from 'node:os';
const tmpdir = () => realpathSync(systemTmpdir());
import { join } from 'node:path';
import yaml from 'js-yaml';
import { expect, it } from 'vitest';
import { validSiteFixture } from '../../src/content/test-fixtures';
import { translateChangedContent } from './translate-content';
import { checkGeneratedContent } from './check-generated';

it('reports missing, valid, stale and extra output offline', async () => {
  const root = await mkdtemp(join(tmpdir(), 'translation-check-'));
  await mkdir(join(root, 'content/zh/posts'), { recursive: true });
  await writeFile(join(root, 'content/zh/site.yml'), yaml.dump(validSiteFixture));
  expect((await checkGeneratedContent({ root })).missing).toEqual(['content/en/site.yml']);
  await translateChangedContent({ root, changedPaths: ['content/zh/site.yml'], translator: { translate: async segments => new Map(segments.map(s => [s.id, s.text])) } });
  expect((await checkGeneratedContent({ root })).valid).toEqual(['content/en/site.yml']);
  await writeFile(join(root, 'content/en/site.yml'), (await readFile(join(root, 'content/en/site.yml'), 'utf8')).replace(/sourceHash: .*/, 'sourceHash: stale'));
  expect((await checkGeneratedContent({ root })).stale).toEqual(['content/en/site.yml']);
  await mkdir(join(root, 'content/en/posts'));
  await writeFile(join(root, 'content/en/posts/extra.md'), 'unused');
  expect((await checkGeneratedContent({ root })).extra).toEqual(['content/en/posts/extra.md']);
});
