// @vitest-environment node
import { realpathSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir as systemTmpdir } from 'node:os';
const tmpdir = () => realpathSync(systemTmpdir());
import { join } from 'node:path';
import yaml from 'js-yaml';
import { expect, it, vi } from 'vitest';
import { validSiteFixture } from '../../src/content/test-fixtures';
import { translateChangedContent } from './translate-content';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseContent, assertParity } from './files';

export async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'translation-lifecycle-'));
  await mkdir(join(root, 'content/zh/posts'), { recursive: true });
  await writeFile(join(root, 'content/zh/site.yml'), yaml.dump(validSiteFixture));
  const translator = { translate: vi.fn(async (segments: { id: string; text: string }[]) => new Map(segments.map(s => [s.id, s.text]))) };
  return { root, translator, changedPaths: ['content/zh/site.yml'], policy: { policyVersion: 1 } };
}

it('writes only matching output, skips current files without writes or calls, and regenerates on policy change', async () => {
  const options = await fixture();
  expect((await translateChangedContent(options)).written).toEqual(['content/en/site.yml']);
  const path = join(options.root, 'content/en/site.yml');
  const before = await stat(path);
  expect(yaml.load(await readFile(path, 'utf8'))).toHaveProperty('_translation.sourceHash');
  expect((await translateChangedContent(options)).written).toEqual([]);
  expect((await stat(path)).mtimeMs).toBe(before.mtimeMs);
  expect(options.translator.translate).toHaveBeenCalledTimes(1);
  await translateChangedContent({ ...options, policy: { policyVersion: 2 } });
  expect(options.translator.translate).toHaveBeenCalledTimes(2);
});

it('creates posts and deletes counterparts without translator calls', async () => {
  const options = await fixture();
  const post = 'content/zh/posts/new.md';
  await writeFile(join(options.root, post), '---\nslug: new\ndraft: false\ndate: 2026-06-05\ntitle: 标题\nsummary: 摘要\ntags: [React]\nrelatedProject: 项目\n---\n\n## 标题\n\n正文 `code` [链接](https://example.com)\n');
  await translateChangedContent({ ...options, changedPaths: [post] });
  const output = join(options.root, 'content/en/posts/new.md');
  expect(await readFile(output, 'utf8')).toContain('_translation:');
  await rm(join(options.root, post));
  expect((await translateChangedContent({ ...options, changedPaths: [post] })).deleted).toEqual(['content/en/posts/new.md']);
  expect(options.translator.translate).toHaveBeenCalledTimes(1);
  await expect(stat(output)).rejects.toThrow();
});

it('leaves existing output untouched on a shape mismatch', async () => {
  const options = await fixture();
  await translateChangedContent(options);
  const output = join(options.root, 'content/en/site.yml');
  const before = await readFile(output, 'utf8');
  options.translator.translate.mockResolvedValueOnce(new Map([['wrong', 'x']]));
  await expect(translateChangedContent({ ...options, policy: { policyVersion: 2 } })).rejects.toThrow();
  expect(await readFile(output, 'utf8')).toBe(before);
});

it('adopts existing copy offline but refuses missing or protected-value mismatches before writing', async () => {
  const options = await fixture();
  await expect(translateChangedContent({ ...options, adoptExisting: true })).rejects.toThrow(/missing/i);
  await mkdir(join(options.root, 'content/en'), { recursive: true });
  const candidate = structuredClone(validSiteFixture);
  candidate.profile.headline = 'Reviewed English copy';
  await writeFile(join(options.root, 'content/en/site.yml'), yaml.dump(candidate));
  await translateChangedContent({ ...options, adoptExisting: true });
  expect(options.translator.translate).not.toHaveBeenCalled();
  expect(await readFile(join(options.root, 'content/en/site.yml'), 'utf8')).toContain('Reviewed English copy');
  candidate.profile.avatar = '/tampered.png';
  await writeFile(join(options.root, 'content/en/site.yml'), yaml.dump(candidate));
  await expect(translateChangedContent({ ...options, adoptExisting: true })).rejects.toThrow(/protected|shape/i);
});

it('keeps all outputs unchanged when a later document fails translation', async () => {
  const options = await fixture();
  await translateChangedContent(options);
  const output = join(options.root, 'content/en/site.yml');
  const before = await readFile(output, 'utf8');
  await writeFile(join(options.root, 'content/zh/posts/bad.md'), 'invalid');
  await expect(translateChangedContent({ ...options, policy: { policyVersion: 2 }, changedPaths: [...options.changedPaths, 'content/zh/posts/bad.md'] })).rejects.toThrow();
  expect(await readFile(output, 'utf8')).toBe(before);
});

it('runs CLI against a separate root without a key when current and rejects invalid invocation modes', async () => {
  const options = await fixture();
  await translateChangedContent(options);
  const script = fileURLToPath(new URL('./translate-content.ts', import.meta.url));
  const env = { ...process.env, DEEPSEEK_API_KEY: '' };
  const run = (...args: string[]) => execFileSync(process.execPath, ['--import', 'tsx', script, '--root', options.root, ...args], { encoding: 'utf8', env, stdio: 'pipe' });
  expect(JSON.parse(run('--all')).skipped).toEqual(['content/en/site.yml']);
  expect(JSON.parse(run('--changed-file', 'content/zh/site.yml', '--changed-file', 'content/zh/site.yml')).written).toEqual([]);
  for (const args of [[], ['--adopt-existing'], ['--all', '--changed-file', 'content/zh/site.yml'], ['--root', 'relative'], ['--changed-file'], ['--unknown']]) expect(() => run(...args)).toThrow();
});

it('localizes tags preserving count, order and exact protected glossary tokens', () => {
  const raw = '---\nslug: new\ndraft: false\ndate: 2026-06-05\ntitle: 标题\nsummary: 摘要\ntags: [React, 对话, FastAPI]\nrelatedProject: 项目\n---\n正文\n';
  const source = parseContent('content/zh/posts/new.md', raw);
  expect(source.segments.map(segment => segment.id)).toContain('frontmatter.tags.1');
  expect(source.segments.map(segment => segment.id)).not.toContain('frontmatter.tags.0');
  const translations = new Map(source.segments.map(segment => [segment.id, segment.text]));
  translations.set('frontmatter.tags.1', 'Chat');
  const output = source.render(translations);
  expect((parseContent('content/en/posts/new.md', output).value as { frontmatter: { tags: string[] } }).frontmatter.tags).toEqual(['React', 'Chat', 'FastAPI']);
  expect(() => assertParity('content/zh/posts/new.md', source, parseContent('content/en/posts/new.md', output.replace('- React', '- Vue')))).toThrow();
});

it('adopts a post without changing its reviewed Markdown body bytes', async () => {
  const options = await fixture();
  const path = 'content/zh/posts/existing.md';
  const raw = '---\nslug: existing\ndraft: false\ndate: 2026-06-05\ntitle: Reviewed\nsummary: Reviewed\ntags: [React]\nrelatedProject: Reviewed\n---\n\n## Heading\n\n- Reviewed bullet\n';
  await writeFile(join(options.root, path), raw);
  await mkdir(join(options.root, 'content/en/posts'), { recursive: true });
  await writeFile(join(options.root, 'content/en/posts/existing.md'), raw);
  await translateChangedContent({ ...options, changedPaths: [path], adoptExisting: true });
  expect((await readFile(join(options.root, 'content/en/posts/existing.md'), 'utf8')).split('---\n')[2]).toBe(raw.split('---\n')[2]);
});

it('uses source allowlists when translated labels become exact glossary tokens', () => {
  const site = structuredClone(validSiteFixture);
  site.historyGalaxy.stack = ['前端框架'];
  const source = parseContent('content/zh/site.yml', yaml.dump(site));
  const translations = new Map(source.segments.map(segment => [segment.id, segment.text]));
  translations.set('historyGalaxy.stack.0', 'React');
  expect(() => assertParity('content/zh/site.yml', source, parseContent('content/en/site.yml', source.render(translations)))).not.toThrow();
});
