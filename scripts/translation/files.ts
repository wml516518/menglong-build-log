import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, parse, relative, resolve, dirname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import yaml from 'js-yaml';
import { z } from 'zod';
import { parseSiteDocument, parseResumeDocument, stripTranslationMetadata, type TranslationMetadata } from '../../src/content/schema';
import { collectSiteSegments, collectResumeSegments, applySiteTranslations, applyResumeTranslations } from './fields';
import { collectMarkdownSegments, applyMarkdownTranslations } from './markdown';
import { translationGlossary } from './hash';
import { validateTranslations, type TranslationSegment, type Translations } from './types';

export async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}

export async function assertNoSymlinks(path: string): Promise<void> {
  const absolute = resolve(path);
  let current = parse(absolute).root;
  for (const part of absolute.slice(current.length).split('/').filter(Boolean)) {
    current = join(current, part);
    if (await exists(current) && (await lstat(current)).isSymbolicLink()) throw new Error(`Symlink rejected: ${current}`);
  }
}

export async function mapSourcePath(root: string, source: string): Promise<string> {
  if (!isAbsolute(root)) throw new Error('Repository root must be absolute');
  if (!/^content\/zh\/(?:site\.yml|resume\.yml|posts\/[a-zA-Z0-9_-]+\.md)$/.test(source)) throw new Error(`Unsupported source path: ${source}`);
  const destination = resolve(root, source.replace('content/zh/', 'content/en/'));
  if (relative(root, destination).startsWith('..')) throw new Error('Path outside repository');
  await assertNoSymlinks(join(root, source));
  await assertNoSymlinks(destination);
  return destination;
}

export async function atomicWrite(destination: string, content: string, validate: (path: string) => Promise<void>): Promise<void> {
  await assertNoSymlinks(destination);
  await mkdir(dirname(destination), { recursive: true });
  const temporary = join(dirname(destination), `.${basename(destination)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, content.replace(/\r\n?/g, '\n'), { flag: 'wx' });
    await validate(temporary);
    await assertNoSymlinks(destination);
    await rename(temporary, destination);
  } finally { await rm(temporary, { force: true }); }
}

export async function listContentPaths(root: string, locale: 'zh' | 'en'): Promise<string[]> {
  const prefix = `content/${locale}`;
  const paths: string[] = [];
  for (const file of ['site.yml', 'resume.yml']) if (await exists(join(root, prefix, file))) paths.push(`${prefix}/${file}`);
  const posts = join(root, prefix, 'posts');
  await assertNoSymlinks(posts);
  if (await exists(posts)) for (const name of (await readdir(posts)).sort()) {
    if (!/^[a-zA-Z0-9_-]+\.md$/.test(name)) throw new Error(`Unsupported content entry: ${prefix}/posts/${name}`);
    paths.push(`${prefix}/posts/${name}`);
  }
  for (const path of paths) await assertNoSymlinks(join(root, path));
  return paths;
}

export const serializeYaml = (value: unknown) => yaml.dump(value, { sortKeys: true, lineWidth: -1, noRefs: true });
const metadata = z.object({ sourceHash: z.string().trim().min(1), policyVersion: z.number() }).strict();
const copy = z.string().trim().min(1);
const postSchema = z.object({
  slug: copy.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), draft: z.boolean(), coverImage: z.string().optional(),
  date: copy.regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value),
  title: copy, summary: copy, tags: z.array(copy).min(1), relatedProject: copy, _translation: metadata.optional()
}).strict();

export interface ContentDocument {
  value: unknown;
  metadata?: TranslationMetadata;
  segments: TranslationSegment[];
  render(translations: Translations, stamp?: TranslationMetadata): string;
  adopt(stamp: TranslationMetadata): string;
}

export function parseContent(path: string, raw: string): ContentDocument {
  if (path.endsWith('.md')) {
    // PR checkouts are data: never let a frontmatter language select an
    // executable engine (gray-matter includes a JavaScript eval engine).
    const block = raw.match(/^(?:\uFEFF)?---[\t ]*\r?\n([\s\S]*?)\r?\n---[\t ]*(?:\r?\n|$)/);
    if (!block) throw new Error(`Expected plain YAML frontmatter: ${path}`);
    const validated = postSchema.parse(yaml.load(block[1], { schema: yaml.JSON_SCHEMA }));
    const frontmatter = stripTranslationMetadata(validated);
    const body = raw.slice(block[0].length).replace(/\r\n?/g, '\n');
    const markdown = collectMarkdownSegments(body);
    const segments = [
      ...['title', 'summary', 'relatedProject'].map(id => ({ id: `frontmatter.${id}`, text: frontmatter[id as 'title'], context: `Post ${id}` })),
      ...frontmatter.tags.flatMap((text, index) => translationGlossary.protected.includes(text) ? [] : [{ id: `frontmatter.tags.${index}`, text, context: 'Post tag' }]),
      ...markdown.segments
    ];
    return { value: { frontmatter, body }, metadata: validated._translation, segments,
      adopt: stamp => `---\n${serializeYaml({ ...frontmatter, _translation: stamp })}---\n${body}`,
      render(translations, stamp) {
      // The Markdown primitive validates its own subset; validate the full request separately.
      const translated = structuredClone(frontmatter);
      for (const key of ['title', 'summary', 'relatedProject'] as const) translated[key] = translations.get(`frontmatter.${key}`)!;
      translated.tags = frontmatter.tags.map((text, index) => translationGlossary.protected.includes(text) ? text : translations.get(`frontmatter.tags.${index}`)!);
      const bodyTranslations = new Map(markdown.segments.map(s => [s.id, translations.get(s.id)!]));
      return `---\n${serializeYaml({ ...translated, ...(stamp ? { _translation: stamp } : {}) })}---\n${applyMarkdownTranslations(markdown, bodyTranslations)}`;
    } };
  }
  const rawValue = yaml.load(raw, { schema: yaml.JSON_SCHEMA });
  if (path.endsWith('/site.yml')) {
    const parsed = parseSiteDocument(rawValue, path);
    const source = stripTranslationMetadata(parsed);
    return { value: source, metadata: parsed._translation, segments: collectSiteSegments(source), adopt: stamp => serializeYaml({ ...source, _translation: stamp }), render: (translations, stamp) => serializeYaml({ ...applySiteTranslations(source, translations), ...(stamp ? { _translation: stamp } : {}) }) };
  }
  const parsed = parseResumeDocument(rawValue, path);
  const source = stripTranslationMetadata(parsed);
  return { value: source, metadata: parsed._translation, segments: collectResumeSegments(source), adopt: stamp => serializeYaml({ ...source, _translation: stamp }), render: (translations, stamp) => serializeYaml({ ...applyResumeTranslations(source, translations), ...(stamp ? { _translation: stamp } : {}) }) };
}

function canonical(document: ContentDocument): unknown {
  if (document.value && typeof document.value === 'object' && 'body' in document.value) {
    const value = document.value as { frontmatter: unknown; body: string };
    const tree = collectMarkdownSegments(value.body).tree;
    return JSON.parse(JSON.stringify({ frontmatter: value.frontmatter, tree }, (key, item) => key === 'position' ? undefined : key === 'referenceType' ? 'full' : item));
  }
  return document.value;
}

export function assertParity(path: string, source: ContentDocument, target: ContentDocument): Translations {
  // Source values decide which exact glossary tokens are protected. An English
  // label may itself become a glossary token without removing its source ID.
  const targetSegments = new Map(target.segments.map(segment => [segment.id, segment.text]));
  const translations = new Map(source.segments.map(segment => {
    const value = !path.endsWith('.md') || segment.id.startsWith('frontmatter.')
      ? segment.id.split('.').reduce<unknown>((node, key) => node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined, target.value)
      : targetSegments.get(segment.id);
    return [segment.id, value as string];
  }));
  validateTranslations(source.segments, translations);
  const restored = parseContent(path, source.render(translations));
  if (!isDeepStrictEqual(canonical(restored), canonical(target))) throw new Error(`Protected values or shape changed: ${path}`);
  return translations;
}

export async function readContent(root: string, path: string) { return parseContent(path, await readFile(join(root, path), 'utf8')); }
