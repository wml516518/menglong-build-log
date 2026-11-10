// @vitest-environment node
import { realpathSync } from 'node:fs';
import { cp, mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
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

it('reuses reviewed baseline translations and sends only changed source segments to the translator', async () => {
  const baseline = await fixture();
  baseline.translator.translate.mockImplementationOnce(async segments => new Map(segments.map(segment => [segment.id, `Reviewed ${segment.id}`])));
  await translateChangedContent(baseline);
  const root = await mkdtemp(join(tmpdir(), 'translation-current-'));
  await cp(join(baseline.root, 'content'), join(root, 'content'), { recursive: true });
  const changed = structuredClone(validSiteFixture);
  changed.about = '只修改这一段中文';
  await writeFile(join(root, 'content/zh/site.yml'), yaml.dump(changed));
  const translator = { translate: vi.fn(async (segments: { id: string; text: string }[]) => new Map(segments.map(segment => [segment.id, `Translated ${segment.text}`]))) };

  await translateChangedContent({ root, baselineRoot: baseline.root, changedPaths: baseline.changedPaths, policy: baseline.policy, translator });

  expect(translator.translate).toHaveBeenCalledTimes(1);
  expect(translator.translate.mock.calls[0][0].map(segment => segment.id)).toEqual(['about']);
  const output = yaml.load(await readFile(join(root, 'content/en/site.yml'), 'utf8')) as typeof validSiteFixture;
  expect(output.about).toBe('Translated 只修改这一段中文');
  expect(output.profile.secondaryAction).toBe('Reviewed profile.secondaryAction');
  expect(output.historyGalaxy.action).toBe('Reviewed historyGalaxy.action');
});

it('reconciles current-stamped drift against the trusted baseline and retranslates only the changed segment', async () => {
  const baseline = await fixture();
  baseline.translator.translate.mockImplementationOnce(async segments => new Map(segments.map(segment => [segment.id, `Reviewed ${segment.id}`])));
  await translateChangedContent(baseline);
  const root = await mkdtemp(join(tmpdir(), 'translation-current-drifted-'));
  await cp(join(baseline.root, 'content'), join(root, 'content'), { recursive: true });
  const changed = structuredClone(validSiteFixture);
  changed.about = '只修改这一段中文';
  await writeFile(join(root, 'content/zh/site.yml'), yaml.dump(changed));
  const driftTranslator = { translate: vi.fn(async (segments: { id: string; text: string }[]) => new Map(segments.map(segment => [segment.id, `Drifted ${segment.id}`]))) };
  await translateChangedContent({ root, changedPaths: baseline.changedPaths, policy: baseline.policy, translator: driftTranslator });
  const repairTranslator = { translate: vi.fn(async (segments: { id: string; text: string }[]) => new Map(segments.map(segment => [segment.id, `Repaired ${segment.text}`]))) };

  const result = await translateChangedContent({ root, baselineRoot: baseline.root, changedPaths: baseline.changedPaths, policy: baseline.policy, translator: repairTranslator });

  expect(result.written).toEqual(['content/en/site.yml']);
  expect(result.skipped).toEqual([]);
  expect(repairTranslator.translate.mock.calls[0][0].map(segment => segment.id)).toEqual(['about']);
  const output = yaml.load(await readFile(join(root, 'content/en/site.yml'), 'utf8')) as typeof validSiteFixture;
  expect(output.about).toBe('Repaired 只修改这一段中文');
  expect(output.profile.secondaryAction).toBe('Reviewed profile.secondaryAction');
  expect(output.historyGalaxy.action).toBe('Reviewed historyGalaxy.action');
});

it('rejects a stale baseline instead of reusing unverified translations', async () => {
  const baseline = await fixture();
  await translateChangedContent(baseline);
  const root = await mkdtemp(join(tmpdir(), 'translation-current-'));
  await cp(join(baseline.root, 'content'), join(root, 'content'), { recursive: true });
  const baselineTargetPath = join(baseline.root, 'content/en/site.yml');
  const stale = yaml.load(await readFile(baselineTargetPath, 'utf8')) as Record<string, unknown>;
  (stale._translation as Record<string, unknown>).sourceHash = 'stale';
  await writeFile(baselineTargetPath, yaml.dump(stale));
  const changed = structuredClone(validSiteFixture);
  changed.about = '只修改这一段中文';
  await writeFile(join(root, 'content/zh/site.yml'), yaml.dump(changed));
  const before = await readFile(join(root, 'content/en/site.yml'), 'utf8');
  const translator = { translate: vi.fn() };

  await expect(translateChangedContent({ root, baselineRoot: baseline.root, changedPaths: baseline.changedPaths, policy: baseline.policy, translator })).rejects.toThrow(/baseline.*stale/i);
  expect(translator.translate).not.toHaveBeenCalled();
  expect(await readFile(join(root, 'content/en/site.yml'), 'utf8')).toBe(before);
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
  const post = (slug: string) => `---\nslug: ${slug}\ndraft: false\ndate: 2026-06-05\ntitle: ${slug}\nsummary: Summary\ntags: [React]\nrelatedProject: Project\n---\n\nReviewed body\n`;
  const changedPaths = ['content/zh/posts/a-valid.md', 'content/zh/posts/z-failing.md'];
  for (const [index, path] of changedPaths.entries()) await writeFile(join(options.root, path), post(index === 0 ? 'a-valid' : 'z-failing'));
  await translateChangedContent({ ...options, changedPaths });
  const outputs = changedPaths.map(path => join(options.root, path.replace('content/zh/', 'content/en/')));
  const before = await Promise.all(outputs.map(path => readFile(path, 'utf8')));
  options.translator.translate.mockClear();
  options.translator.translate.mockImplementationOnce(async segments => new Map(segments.map(segment => [segment.id, segment.id === 'frontmatter.title' ? 'Staged new title' : segment.text])));
  options.translator.translate.mockResolvedValueOnce(new Map([['wrong-id', 'Failure']]));
  await expect(translateChangedContent({ ...options, policy: { policyVersion: 2 }, changedPaths: [...changedPaths].reverse() })).rejects.toThrow(/extra|missing/i);
  expect(options.translator.translate.mock.calls.map(([segments]) => segments.find(segment => segment.id === 'frontmatter.title')?.text)).toEqual(['a-valid', 'z-failing']);
  expect(await Promise.all(outputs.map(path => readFile(path, 'utf8')))).toEqual(before);
});

it('runs CLI against a separate root without a key when current and rejects invalid invocation modes', async () => {
  const options = await fixture();
  await translateChangedContent(options);
  const script = fileURLToPath(new URL('./translate-content.ts', import.meta.url));
  const env = { ...process.env, DEEPSEEK_API_KEY: '' };
  const run = (...args: string[]) => execFileSync(process.execPath, ['--import', 'tsx', script, '--root', options.root, ...args], { encoding: 'utf8', env, stdio: 'pipe' });
  expect(JSON.parse(run('--all')).skipped).toEqual(['content/en/site.yml']);
  expect(JSON.parse(run('--baseline-root', options.root, '--changed-file', 'content/zh/site.yml')).skipped).toEqual(['content/en/site.yml']);
  expect(JSON.parse(run('--changed-file', 'content/zh/site.yml', '--changed-file', 'content/zh/site.yml')).written).toEqual([]);
  for (const args of [[], ['--adopt-existing'], ['--all', '--changed-file', 'content/zh/site.yml'], ['--baseline-root', options.root, '--all'], ['--root', 'relative'], ['--baseline-root', 'relative', '--changed-file', 'content/zh/site.yml'], ['--baseline-root'], ['--changed-file'], ['--unknown']]) expect(() => run(...args)).toThrow();
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
