import { assertUniqueEditorialPeriods, generatedFiles, stableJson } from './history-content/generate';
import { mkdtemp, mkdir, readlink, realpath, lstat, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateContentQuality, type ContentQualityReport } from './history-content/quality';
import { markdownFiles, normalizeAliases, parseFrontmatter, readCatalog, readCoreDetails, readEventCatalogs, mergeEventArchives, validated } from './history-content/catalog';
import {
  eraSchema, personArchiveSchema,
  placeIndexSchema, politySchema, relationSchema, sourceSchema, themeArchiveSchema, editorialPeriodSchema,
  type HistoryEra, type PersonArchive
} from '../src/history/content/schema';

export interface CompileOptions {
  sourceRoot: string;
  publicOutputRoot: string;
  /** Its parent is a dedicated generated directory, replaced as a unit. */
  compatibilityOutputFile?: string;
  enforceFinalTargets?: boolean;
}
export interface CompileReport {
  eventCount: number;
  personCount: number;
  eraCount: number;
  sourceCount: number;
  themeCount: number;
  errorCount: 0;
  placeCount: number;
  contentQuality: ContentQualityReport;
}

const compareId = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const chronological = (a: { startYear: number; endYear: number; id: string }, b: { startYear: number; endYear: number; id: string }) =>
  a.startYear - b.startYear || a.endYear - b.endYear || compareId(a, b);
const peopleChronological = (a: PersonArchive, b: PersonArchive) =>
  (a.birthYear ?? Infinity) - (b.birthYear ?? Infinity) || (a.deathYear ?? Infinity) - (b.deathYear ?? Infinity) || compareId(a, b);
function unique<T extends { id: string }>(records: T[], label: string): Map<string, T> {
  const index = new Map<string, T>();
  for (const record of [...records].sort(compareId)) {
    if (index.has(record.id)) throw new Error(`重复${label} ID: ${record.id}`);
    index.set(record.id, record);
  }
  return index;
}
async function readPeople(sourceRoot: string, eras: Map<string, HistoryEra>) {
  const people: PersonArchive[] = [];
  const contentRoot = join(sourceRoot, 'content');
  for (const file of await markdownFiles(contentRoot)) {
    const parts = relative(contentRoot, file).split(sep);
    if (parts.length !== 3 || !['events', 'people'].includes(parts[1])) throw new Error(`档案路径无效: ${relative(sourceRoot, file)}`);
    if (parts[1] === 'events') continue;
    const parsed = await parseFrontmatter(file, '人物');
    const data = { ...parsed.data, aliases: normalizeAliases(parsed.data.aliases) };
    const id = parsed.data.id ?? basename(file, '.md');
    if ('summary' in data) throw new Error(`人物 ${id} 的 summary 必须写在 Markdown 正文`);
    const person = validated(personArchiveSchema, { ...data, summary: parsed.content.trim() }, `${file}: 人物 ${id}`);
    reference(eras, person.primaryEraId, `人物 ${id} 引用了不存在的时代`);
    if (person.primaryEraId !== parts[0]) throw new Error(`人物 ${id} 的目录时代 ${parts[0]} 与 primaryEraId ${person.primaryEraId} 不一致`);
    people.push(person);
  }
  return people;
}
function reference<T>(records: Map<string, T>, id: string, label: string): T {
  const record = records.get(id);
  if (!record) throw new Error(`${label} ${id}`);
  return record;
}

async function loadContent(sourceRoot: string, enforceFinalTargets: boolean) {
  const eras = await readCatalog(sourceRoot, 'eras', eraSchema, '时代');
  const sources = await readCatalog(sourceRoot, 'sources', sourceSchema, '来源');
  const themes = await readCatalog(sourceRoot, 'themes', themeArchiveSchema, '专题');
  // These schema-backed catalogs are optional until content authors use them.
  const places = await readCatalog(sourceRoot, 'places', placeIndexSchema, '地点', true);
  const polities = await readCatalog(sourceRoot, 'polities', politySchema, '政权');
  const relations = await readCatalog(sourceRoot, 'relations', relationSchema, '关系', true);
  const eraMap = unique(eras, '时代');
  const records = await readEventCatalogs(sourceRoot);
  const periods = await readCatalog(sourceRoot, 'editorial-periods', editorialPeriodSchema, '编辑时期', records.length === 0);
  assertUniqueEditorialPeriods(periods);
  const sourceMap = unique(sources, '来源');
  const placeMap = unique(places, '地点');
  const polityMap = unique(polities, '政权');
  // Validate located references before aggregate quality checks for precise diagnostics.
  for (const event of records) {
    const label = `${join(sourceRoot, 'catalog/events', `${event.editorialPeriodId}.json`)}: 事件 ${event.id}`;
    event.sourceRefs.forEach((ref, index) => reference(sourceMap, ref.sourceId, `${label} sourceRefs.${index}.sourceId 引用了不存在的来源`));
    event.placeIds.forEach((id, index) => reference(placeMap, id, `${label} placeIds.${index} 引用了不存在的地点`));
    event.polityIds.forEach((id, index) => reference(polityMap, id, `${label} polityIds.${index} 引用了不存在的政权`));
  }
  const contentQuality = validateContentQuality({ events: records, periods, sources }, { enforceFinalTargets });
  const events = mergeEventArchives(records, await readCoreDetails(sourceRoot));
  const people = await readPeople(sourceRoot, eraMap);
  const themeMap = unique(themes, '专题');
  const relationMap = unique(relations, '关系');
  const eventMap = unique(events, '事件');
  const personMap = unique(people, '人物');

  // Check referential existence before reciprocity so diagnostics identify the missing record.
  for (const event of events) {
    const era = reference(eraMap, event.eraId, `事件 ${event.id} 引用了不存在的时代`);
    if (event.startYear < era.startYear || event.endYear > era.endYear) throw new Error(`事件 ${event.id} 的年代超出时代 ${era.id}`);
    for (const id of event.personIds) reference(personMap, id, `事件 ${event.id} 引用了不存在的人物`);
    for (const id of event.themeIds) reference(themeMap, id, `事件 ${event.id} 引用了不存在的专题`);
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
    contentQuality, periods, eras: eras.sort(chronological), events: events.sort(chronological), people: people.sort(peopleChronological),
    polities: polities.sort(compareId), sources: sources.sort(compareId), themes: themes.sort(compareId), places: places.sort(compareId), relations: relations.sort(compareId)
  };
}

type Content = Awaited<ReturnType<typeof loadContent>>;
function baseReport(content: Content) {
  return { eventCount: content.events.length, personCount: content.people.length, eraCount: content.eras.length, sourceCount: content.sources.length, themeCount: content.themes.length, errorCount: 0 as const };
}
function report(content: Content): CompileReport {
  return { ...baseReport(content), placeCount: content.places.length, contentQuality: content.contentQuality };
}
/** Resolve aliases even when only an ancestor (or a dangling symlink) exists. */
async function filesystemRoot(path: string): Promise<string> {
  try { return await realpath(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const entry = await lstat(path).catch(statError => {
      if ((statError as NodeJS.ErrnoException).code !== 'ENOENT') throw statError;
      return undefined;
    });
    if (entry?.isSymbolicLink()) return filesystemRoot(resolve(dirname(path), await readlink(path)));
    const parent = dirname(path);
    if (parent === path) throw error;
    return join(await filesystemRoot(parent), basename(path));
  }
}
function overlaps(a: string, b: string) { return a === b || a.startsWith(`${b}${sep}`) || b.startsWith(`${a}${sep}`); }
async function exists(path: string) { try { await stat(path); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; } }

/** Stage every root first; recover each failed swap independently and retain unrestored backups. */
async function replaceOutputs(outputs: Array<{ root: string; files: Map<string, unknown> }>) {
  const staged: Array<{ root: string; temporary: string; backup: string; backedUp: boolean; installed: boolean }> = [];
  const failures: unknown[] = [];
  let swapFailed = false;
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
    swapFailed = true;
    failures.push(error);
    for (const entry of [...staged].reverse()) {
      try {
        if (entry.installed) { await rm(entry.root, { recursive: true, force: true }); entry.installed = false; }
        if (entry.backedUp) { await rename(entry.backup, entry.root); entry.backedUp = false; }
      } catch (recoveryError) {
        const retained = entry.backedUp ? `原始输出保留于 ${entry.backup}` : '未完成的新输出仍需清理';
        failures.push(new Error(`输出恢复失败: ${entry.root}; ${retained}; ${(recoveryError as Error).message}`, { cause: recoveryError }));
      }
    }
  }
  // Cleanup must neither remove an unrestored original nor prevent recovery/cleanup of another root.
  for (const entry of staged) {
    try { await rm(entry.temporary, { recursive: true, force: true }); }
    catch (error) { failures.push(new Error(`临时输出清理失败: ${entry.temporary}; ${(error as Error).message}`, { cause: error })); }
    if (!swapFailed && entry.backedUp) {
      try { await rm(entry.backup, { recursive: true, force: true }); }
      catch (error) { failures.push(new Error(`旧输出清理失败，保留于 ${entry.backup}; ${(error as Error).message}`, { cause: error })); }
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, failures.map(error => (error as Error).message).join('\n'));
}

export async function compileHistoryContent(options: CompileOptions): Promise<CompileReport> {
  const sourceRoot = await filesystemRoot(resolve(options.sourceRoot));
  const publicRoot = await filesystemRoot(resolve(options.publicOutputRoot));
  const compatibilityRoot = options.compatibilityOutputFile ? await filesystemRoot(dirname(resolve(options.compatibilityOutputFile))) : undefined;
  if (overlaps(sourceRoot, publicRoot) || (compatibilityRoot && (overlaps(sourceRoot, compatibilityRoot) || overlaps(publicRoot, compatibilityRoot)))) throw new Error('源目录和生成目录必须互不包含');
  const content = await loadContent(sourceRoot, options.enforceFinalTargets ?? true);
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
    ? report(await loadContent(sourceRoot, true))
    : await compileHistoryContent({ sourceRoot, publicOutputRoot: resolve('public/history-content/generated'), compatibilityOutputFile: resolve('src/history/generated/compat-index.json'), enforceFinalTargets: true });
  process.stdout.write(stableJson(result));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error((error as Error).message); process.exitCode = 1; });
}
