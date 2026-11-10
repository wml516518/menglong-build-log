import matter from 'gray-matter';
import { mkdtemp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import {
  eraSchema, eventArchiveSchema, eventIndexSchema, personArchiveSchema, personIndexSchema,
  placeIndexSchema, relationSchema, sourceSchema, themeArchiveSchema,
  type HistoryEra, type HistoryEventArchive, type PersonArchive
} from '../src/history/content/schema';

export interface CompileOptions {
  sourceRoot: string;
  publicOutputRoot: string;
  /** Its parent is a dedicated generated directory, replaced as a unit. */
  compatibilityOutputFile?: string;
}
export interface CompileReport {
  eventCount: number;
  personCount: number;
  eraCount: number;
  sourceCount: number;
  themeCount: number;
  errorCount: 0;
}

const compareId = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const chronological = (a: { startYear: number; endYear: number; id: string }, b: { startYear: number; endYear: number; id: string }) =>
  a.startYear - b.startYear || a.endYear - b.endYear || compareId(a, b);
const peopleChronological = (a: PersonArchive, b: PersonArchive) =>
  (a.birthYear ?? Infinity) - (b.birthYear ?? Infinity) || (a.deathYear ?? Infinity) - (b.deathYear ?? Infinity) || compareId(a, b);
const normalizeAliases = (aliases: unknown) => Array.isArray(aliases)
  ? [...new Set(aliases.map(alias => typeof alias === 'string' ? alias.normalize('NFKC').trim().replace(/\s+/g, ' ') : alias))].sort()
  : aliases;

function validated<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(`${label}: ${result.error.issues.map(issue => `${issue.path.join('.') || '记录'} ${issue.message}`).join('; ')}`);
  return result.data;
}
async function readCatalog<T>(root: string, name: string, schema: z.ZodType<T>, label: string, optional = false): Promise<T[]> {
  let text: string;
  try { text = await readFile(join(root, 'manifest', `${name}.json`), 'utf8'); }
  catch (error) { if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  let records: unknown;
  try { records = JSON.parse(text); } catch { throw new Error(`清单 ${name}.json 不是有效 JSON`); }
  if (!Array.isArray(records)) throw new Error(`清单 ${name}.json 必须是数组`);
  return records.map(record => validated(schema, record && typeof record === 'object' && 'aliases' in record
    ? { ...record, aliases: normalizeAliases(record.aliases) } : record, `${label} ${record?.id ?? name}`));
}
function unique<T extends { id: string }>(records: T[], label: string): Map<string, T> {
  const index = new Map<string, T>();
  for (const record of records) {
    if (index.has(record.id)) throw new Error(`重复${label} ID: ${record.id}`);
    index.set(record.id, record);
  }
  return index;
}
async function markdownFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : 1)) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...await markdownFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.md')) result.push(path);
  }
  return result;
}
async function readArchives(sourceRoot: string, eras: Map<string, HistoryEra>) {
  const events: HistoryEventArchive[] = [];
  const people: PersonArchive[] = [];
  const contentRoot = join(sourceRoot, 'content');
  for (const file of await markdownFiles(contentRoot)) {
    const parts = relative(contentRoot, file).split(sep);
    if (parts.length !== 3 || !['events', 'people'].includes(parts[1])) throw new Error(`档案路径无效: ${relative(sourceRoot, file)}`);
    const isEvent = parts[1] === 'events';
    const label = isEvent ? '事件' : '人物';
    let parsed: ReturnType<typeof matter>;
    const markdown = await readFile(file, 'utf8');
    if (!/^(?:\uFEFF)?---\r?\n/.test(markdown)) throw new Error(`${label} ${basename(file, '.md')} 的 Frontmatter 仅支持 YAML`);
    try { parsed = matter(markdown); }
    catch (error) { throw new Error(`${label} ${basename(file, '.md')} 的 Frontmatter 无效: ${(error as Error).message}`); }
    const data = { ...parsed.data, aliases: normalizeAliases(parsed.data.aliases) };
    const id = parsed.data.id ?? basename(file, '.md');
    if (isEvent) {
      if ('background' in data) throw new Error(`事件 ${id} 的 background 必须写在 Markdown 正文`);
      const event = validated(eventArchiveSchema, { ...data, background: parsed.content.trim() }, `事件 ${id}`);
      reference(eras, event.eraId, `事件 ${id} 引用了不存在的时代`);
      if (event.eraId !== parts[0]) throw new Error(`事件 ${id} 的目录时代 ${parts[0]} 与 eraId ${event.eraId} 不一致`);
      events.push(event);
    } else {
      if ('summary' in data) throw new Error(`人物 ${id} 的 summary 必须写在 Markdown 正文`);
      const person = validated(personArchiveSchema, { ...data, summary: parsed.content.trim() }, `人物 ${id}`);
      reference(eras, person.primaryEraId, `人物 ${id} 引用了不存在的时代`);
      if (person.primaryEraId !== parts[0]) throw new Error(`人物 ${id} 的目录时代 ${parts[0]} 与 primaryEraId ${person.primaryEraId} 不一致`);
      people.push(person);
    }
  }
  return { events, people };
}
function reference<T>(records: Map<string, T>, id: string, label: string): T {
  const record = records.get(id);
  if (!record) throw new Error(`${label} ${id}`);
  return record;
}

async function loadContent(sourceRoot: string) {
  const eras = await readCatalog(sourceRoot, 'eras', eraSchema, '时代');
  const sources = await readCatalog(sourceRoot, 'sources', sourceSchema, '来源');
  const themes = await readCatalog(sourceRoot, 'themes', themeArchiveSchema, '专题');
  // These schema-backed catalogs are optional until content authors use them.
  const places = await readCatalog(sourceRoot, 'places', placeIndexSchema, '地点', true);
  const relations = await readCatalog(sourceRoot, 'relations', relationSchema, '关系', true);
  const eraMap = unique(eras, '时代');
  const { events, people } = await readArchives(sourceRoot, eraMap);
  const sourceMap = unique(sources, '来源');
  const themeMap = unique(themes, '专题');
  const placeMap = unique(places, '地点');
  const relationMap = unique(relations, '关系');
  const eventMap = unique(events, '事件');
  const personMap = unique(people, '人物');

  // Check referential existence before reciprocity so diagnostics identify the missing record.
  for (const event of events) {
    const era = reference(eraMap, event.eraId, `事件 ${event.id} 引用了不存在的时代`);
    if (event.startYear < era.startYear || event.endYear > era.endYear) throw new Error(`事件 ${event.id} 的年代超出时代 ${era.id}`);
    for (const id of event.personIds) reference(personMap, id, `事件 ${event.id} 引用了不存在的人物`);
    for (const id of event.sourceIds) reference(sourceMap, id, `事件 ${event.id} 引用了不存在的来源`);
    for (const id of event.themeIds) reference(themeMap, id, `事件 ${event.id} 引用了不存在的专题`);
    for (const id of event.placeIds) reference(placeMap, id, `事件 ${event.id} 引用了不存在的地点`);
    for (const id of event.relationIds) {
      const relation = reference(relationMap, id, `事件 ${event.id} 引用了不存在的关系`);
      if (relation.fromId !== event.id && relation.toId !== event.id) throw new Error(`事件 ${event.id} 不是关系 ${id} 的端点`);
    }
    if (event.parentId) reference(eventMap, event.parentId, `事件 ${event.id} 引用了不存在的父事件`);
    for (const id of event.childIds) reference(eventMap, id, `事件 ${event.id} 引用了不存在的子事件`);
  }
  for (const person of people) {
    const era = reference(eraMap, person.primaryEraId, `人物 ${person.id} 引用了不存在的时代`);
    if ((person.birthYear !== null && person.birthYear > era.endYear) || (person.deathYear !== null && person.deathYear < era.startYear)) throw new Error(`人物 ${person.id} 的生平与时代 ${era.id} 不相交`);
    for (const id of person.eventIds) reference(eventMap, id, `人物 ${person.id} 引用了不存在的事件`);
    for (const id of person.sourceIds) reference(sourceMap, id, `人物 ${person.id} 引用了不存在的来源`);
    for (const id of person.placeIds) reference(placeMap, id, `人物 ${person.id} 引用了不存在的地点`);
    if (person.birthplaceId) reference(placeMap, person.birthplaceId, `人物 ${person.id} 引用了不存在的出生地点`);
    for (const relation of person.relations) reference(personMap, relation.personId, `人物 ${person.id} 引用了不存在的关联人物`);
  }
  for (const theme of themes) {
    for (const id of theme.eventIds) reference(eventMap, id, `专题 ${theme.id} 引用了不存在的事件`);
    for (const id of theme.sourceIds) reference(sourceMap, id, `专题 ${theme.id} 引用了不存在的来源`);
    for (const chapter of theme.chapters) for (const id of chapter.eventIds) {
      reference(eventMap, id, `专题 ${theme.id} 的章节引用了不存在的事件`);
      if (!theme.eventIds.includes(id)) throw new Error(`专题 ${theme.id} 的章节事件 ${id} 未列入专题`);
    }
  }
  for (const place of places) for (const id of place.eventIds) reference(eventMap, id, `地点 ${place.id} 引用了不存在的事件`);
  for (const relation of relations) for (const id of [relation.fromId, relation.toId]) reference(eventMap, id, `关系 ${relation.id} 引用了不存在的事件`);

  for (const event of events) {
    for (const id of event.personIds) if (!personMap.get(id)!.eventIds.includes(event.id)) throw new Error(`事件 ${event.id} 与人物 ${id} 的关联未双向声明`);
    for (const id of event.themeIds) if (!themeMap.get(id)!.eventIds.includes(event.id)) throw new Error(`事件 ${event.id} 与专题 ${id} 的关联未双向声明`);
    for (const id of event.placeIds) if (!placeMap.get(id)!.eventIds.includes(event.id)) throw new Error(`事件 ${event.id} 与地点 ${id} 的关联未双向声明`);
    if (event.parentId && !eventMap.get(event.parentId)!.childIds.includes(event.id)) throw new Error(`事件 ${event.id} 与父事件 ${event.parentId} 的关联未双向声明`);
    for (const id of event.childIds) if (eventMap.get(id)!.parentId !== event.id) throw new Error(`事件 ${event.id} 与子事件 ${id} 的关联未双向声明`);
  }
  for (const person of people) for (const id of person.eventIds) if (!eventMap.get(id)!.personIds.includes(person.id)) throw new Error(`人物 ${person.id} 与事件 ${id} 的关联未双向声明`);
  for (const theme of themes) for (const id of theme.eventIds) if (!eventMap.get(id)!.themeIds.includes(theme.id)) throw new Error(`专题 ${theme.id} 与事件 ${id} 的关联未双向声明`);
  for (const place of places) for (const id of place.eventIds) if (!eventMap.get(id)!.placeIds.includes(place.id)) throw new Error(`地点 ${place.id} 与事件 ${id} 的关联未双向声明`);
  for (const relation of relations) for (const id of [relation.fromId, relation.toId]) if (!eventMap.get(id)!.relationIds.includes(relation.id)) throw new Error(`关系 ${relation.id} 未在事件 ${id} 中声明`);

  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error(`父事件循环: ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    const parentId = eventMap.get(id)!.parentId;
    if (parentId) visit(parentId);
    visiting.delete(id);
    visited.add(id);
  }
  for (const event of [...events].sort(compareId)) visit(event.id);

  return {
    eras: eras.sort(chronological), events: events.sort(chronological), people: people.sort(peopleChronological),
    sources: sources.sort(compareId), themes: themes.sort(compareId), places: places.sort(compareId), relations: relations.sort(compareId)
  };
}

type Content = Awaited<ReturnType<typeof loadContent>>;
function report(content: Content): CompileReport {
  return { eventCount: content.events.length, personCount: content.people.length, eraCount: content.eras.length, sourceCount: content.sources.length, themeCount: content.themes.length, errorCount: 0 };
}
function compactEvent(event: HistoryEventArchive) {
  const { background: _b, causes: _c, course: _co, results: _r, impacts: _i, historiography: _h, ...metadata } = event;
  return validated(eventIndexSchema, { ...metadata, year: event.startYear }, `事件索引 ${event.id}`);
}
function compactPerson(person: PersonArchive) {
  const { id, name, aliases, primaryEraId, birthYear, deathYear, roleIds, eventIds, sourceIds } = person;
  return validated(personIndexSchema, { id, name, aliases, primaryEraId, birthYear, deathYear, roleIds, eventIds, sourceIds }, `人物索引 ${id}`);
}

/** Object keys are lexical; arrays retain their editorial order or explicit record chronology. */
function stableJson(value: unknown): string {
  return `${JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item, 2)}\n`;
}
const compatibilityEraIds = new Set(['tang', 'five-dynasties', 'song', 'yuan', 'ming', 'qing', 'modern']);
function legacyEraId(event: HistoryEventArchive, eras: HistoryEra[]): string {
  if (compatibilityEraIds.has(event.eraId)) return event.eraId;
  // Future editorial eras can overlap the existing navigation without changing its contract.
  return eras.filter(era => compatibilityEraIds.has(era.id) && event.startYear >= era.startYear && event.startYear <= era.endYear).at(-1)?.id ?? event.eraId;
}
function generatedFiles(content: Content): { publicFiles: Map<string, unknown>; compatibility: unknown } {
  const { events, people, eras, sources, places, themes, relations } = content;
  const personNames = new Map(people.map(person => [person.id, person.name]));
  const indexes = { events: 'indexes/events.compact.json', people: 'indexes/people.compact.json', places: 'indexes/places.compact.json', themes: 'indexes/themes.compact.json' };
  const manifest = {
    version: 1, ...report(content), eras, indexes,
    sources: 'sources.json', relations: 'relations.json',
    eraBundles: Object.fromEntries(eras.map(era => [era.id, `eras/${era.id}.json`])),
    eventEras: Object.fromEntries(events.map(event => [event.id, event.eraId])),
    personEras: Object.fromEntries(people.map(person => [person.id, person.primaryEraId])),
    themeArchives: Object.fromEntries(themes.map(theme => [theme.id, `themes/${theme.id}.json`]))
  };
  const compactEvents = events.map(compactEvent);
  const publicFiles = new Map<string, unknown>([
    ['manifest.json', manifest], [indexes.events, compactEvents], [indexes.people, people.map(compactPerson)],
    [indexes.places, places], [indexes.themes, themes.map(({ id, title, summary, eventIds }) => ({ id, title, summary, eventIds }))],
    ['sources.json', sources], ['relations.json', relations]
  ]);
  for (const era of eras) publicFiles.set(`eras/${era.id}.json`, { eraId: era.id, events: events.filter(event => event.eraId === era.id), people: people.filter(person => person.primaryEraId === era.id) });
  for (const theme of themes) publicFiles.set(`themes/${theme.id}.json`, theme);
  const compatibility = {
    dynasties: eras.filter(era => compatibilityEraIds.has(era.id)).map(({ id, name, startYear, endYear, color, inscription }) => ({ id, name, start: startYear, end: endYear, color, inscription })),
    historyEvents: events.map((event, index) => ({
      ...compactEvents[index], dynasty: legacyEraId(event, eras), people: event.personIds.map(id => personNames.get(id)!),
      story: [...new Set([event.background, ...event.course.map(entry => entry.description), ...event.results, ...event.impacts.map(impact => impact.text)])].join(''),
      offset: event.layout.offset
    }))
  };
  return { publicFiles, compatibility };
}

function overlaps(a: string, b: string) { return a === b || a.startsWith(`${b}${sep}`) || b.startsWith(`${a}${sep}`); }
async function exists(path: string) { try { await stat(path); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; } }

/** Stage every root first, then swap with backups; roll back both roots if any rename fails. */
async function replaceOutputs(outputs: Array<{ root: string; files: Map<string, unknown> }>) {
  const staged: Array<{ root: string; temporary: string; backup: string; backedUp: boolean; installed: boolean }> = [];
  try {
    for (const output of outputs) {
      await mkdir(dirname(output.root), { recursive: true });
      if (await exists(output.root) && !(await stat(output.root)).isDirectory()) throw new Error(`输出根必须是目录: ${output.root}`);
      const temporary = await mkdtemp(join(dirname(output.root), `.${basename(output.root)}-`));
      const entry = { root: output.root, temporary, backup: `${temporary}.previous`, backedUp: false, installed: false };
      staged.push(entry);
      for (const [path, value] of output.files) {
        await mkdir(dirname(join(temporary, path)), { recursive: true });
        await writeFile(join(temporary, path), stableJson(value));
      }
    }
    for (const entry of staged) {
      if (await exists(entry.root)) { await rename(entry.root, entry.backup); entry.backedUp = true; }
      await rename(entry.temporary, entry.root);
      entry.installed = true;
    }
  } catch (error) {
    for (const entry of [...staged].reverse()) {
      if (entry.installed) await rm(entry.root, { recursive: true, force: true });
      if (entry.backedUp) await rename(entry.backup, entry.root);
    }
    throw error;
  } finally {
    for (const entry of staged) {
      await rm(entry.temporary, { recursive: true, force: true });
      await rm(entry.backup, { recursive: true, force: true });
    }
  }
}

export async function compileHistoryContent(options: CompileOptions): Promise<CompileReport> {
  const sourceRoot = resolve(options.sourceRoot);
  const publicRoot = resolve(options.publicOutputRoot);
  const compatibilityRoot = options.compatibilityOutputFile ? dirname(resolve(options.compatibilityOutputFile)) : undefined;
  if (overlaps(sourceRoot, publicRoot) || (compatibilityRoot && (overlaps(sourceRoot, compatibilityRoot) || overlaps(publicRoot, compatibilityRoot)))) throw new Error('源目录和生成目录必须互不包含');
  const content = await loadContent(sourceRoot);
  const { publicFiles, compatibility } = generatedFiles(content);
  const outputs = [{ root: publicRoot, files: publicFiles }];
  if (compatibilityRoot) outputs.push({ root: compatibilityRoot, files: new Map([[basename(options.compatibilityOutputFile!), compatibility]]) });
  await replaceOutputs(outputs);
  return report(content);
}

async function main() {
  const command = process.argv[2];
  if (command !== 'compile' && command !== 'check') throw new Error('用法: tsx scripts/history-content.ts <check|compile>');
  const sourceRoot = resolve('history-content');
  const result = command === 'check'
    ? report(await loadContent(sourceRoot))
    : await compileHistoryContent({ sourceRoot, publicOutputRoot: resolve('public/history-content/generated'), compatibilityOutputFile: resolve('src/history/generated/compat-index.json') });
  console.log(JSON.stringify(result));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error((error as Error).message); process.exitCode = 1; });
}
