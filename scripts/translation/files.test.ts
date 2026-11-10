// @vitest-environment node
import { realpathSync } from 'node:fs';
import { mkdtemp, mkdir, symlink, readFile, readdir } from 'node:fs/promises';
import { tmpdir as systemTmpdir } from 'node:os';
const tmpdir = () => realpathSync(systemTmpdir());
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { mapSourcePath, atomicWrite, parseContent } from './files';

it('maps only approved source files and rejects traversal and outside paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'translation-files-'));
  expect(await mapSourcePath(root, 'content/zh/site.yml')).toBe(join(root, 'content/en/site.yml'));
  expect(await mapSourcePath(root, 'content/zh/posts/new.md')).toBe(join(root, 'content/en/posts/new.md'));
  for (const path of ['../content/zh/site.yml', 'content/zh/../zh/site.yml', '/tmp/content/zh/site.yml', 'content/zh/posts/nested/a.md', 'content/zh/posts/a.txt', 'content/en/site.yml']) await expect(mapSourcePath(root, path)).rejects.toThrow();
});

it('rejects symlinks in source and destination ancestors', async () => {
  for (const locale of ['zh', 'en']) {
    const root = await mkdtemp(join(tmpdir(), 'translation-symlink-'));
    await mkdir(join(root, 'content'));
    await symlink(tmpdir(), join(root, 'content', locale));
    await expect(mapSourcePath(root, 'content/zh/site.yml')).rejects.toThrow(/symlink/i);
  }
});

it('validates a sibling temporary file before replacing the destination and cleans failed writes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'translation-atomic-'));
  const destination = join(root, 'site.yml');
  await atomicWrite(destination, 'old\n', async () => {});
  await expect(atomicWrite(destination, 'bad\n', async path => { expect(await readFile(path, 'utf8')).toBe('bad\n'); throw new Error('invalid'); })).rejects.toThrow('invalid');
  expect(await readFile(destination, 'utf8')).toBe('old\n');
  expect(await readdir(root)).toEqual(['site.yml']);
});

it('rejects executable frontmatter engines before parsing checkout data', () => {
  const input = '---javascript\n({slug:"new",draft:false,date:"2026-06-05",title:"Title",summary:"Summary",tags:["React"],relatedProject:"Project"})\n---\nBody\n';
  expect(() => parseContent('content/zh/posts/new.md', input)).toThrow(/frontmatter/i);
});
