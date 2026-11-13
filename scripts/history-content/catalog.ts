import matter from 'gray-matter';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';
import { z } from 'zod';
import {
  basicEventRecordSchema, coreEventDetailsSchema, historyEventArchiveSchema,
  type BasicEventRecord, type CoreEventDetails, type HistoryEventArchiveRecord
} from '../../src/history/content/schema';

export const eventCatalogIds = ['pre-qin', 'qin-han', 'wei-jin', 'sui-tang-five-dynasties', 'song-liao-jin-xia', 'yuan', 'ming', 'qing', 'modern'] as const;
const locations = new WeakMap<object, string>();
const detailEras = new WeakMap<CoreEventDetails, string>();
export const normalizeAliases = (aliases: unknown) => Array.isArray(aliases)
  ? [...new Set(aliases.map(alias => typeof alias === 'string' ? alias.normalize('NFKC').trim().replace(/\s+/g, ' ') : alias))].sort()
  : aliases;
export function validated<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(`${label}: ${result.error.issues.map(issue => `${issue.path.join('.') || '记录'} ${issue.message}`).join('; ')}`);
  return result.data;
}
async function jsonArray(file: string): Promise<unknown[]> {
  const text = await readFile(file, 'utf8');
  let records: unknown;
  try { records = JSON.parse(text); } catch (error) { throw new Error(`${file} 不是有效 JSON: ${(error as Error).message}`); }
  if (!Array.isArray(records)) throw new Error(`${file} 必须是数组`);
  return records;
}
export async function readCatalog<T>(root: string, name: string, schema: z.ZodType<T>, label: string, optional = false): Promise<T[]> {
  const file = join(root, 'manifest', `${name}.json`);
  let records: unknown[];
  try { records = await jsonArray(file); }
  catch (error) { if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  return records.map((record, index) => {
    const value = record as Record<string, unknown> | null;
    return validated(schema, value && typeof value === 'object' && 'aliases' in value
      ? { ...value, aliases: normalizeAliases(value.aliases) } : value, `${file} [${index}] ${label} ${value?.id ?? name}`);
  });
}
export async function markdownFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...await markdownFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.md')) result.push(path);
  }
  return result;
}
export async function parseFrontmatter(file: string, label: string) {
  const markdown = await readFile(file, 'utf8');
  if (!/^(?:\uFEFF)?---\r?\n/.test(markdown)) throw new Error(`${file}: ${label} ${basename(file, '.md')} 的 Frontmatter 仅支持 YAML`);
  try { return matter(markdown); }
  catch (error) { throw new Error(`${file}: ${label} ${basename(file, '.md')} 的 Frontmatter 无效: ${(error as Error).message}`); }
}
/** Validate the explicit ID before either reader decides catalog ownership. */
export function eventMarkdownId(data: Record<string, unknown>, file: string): string {
  return validated(coreEventDetailsSchema.pick({ id: true }), { id: data.id }, `${file}: 事件 ${basename(file, '.md')}`).id;
}

export async function readEventCatalogs(sourceRoot: string): Promise<BasicEventRecord[]> {
  const root = join(sourceRoot, 'catalog/events');
  try { await readdir(root); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const records: BasicEventRecord[] = [];
  const ids = new Map<string, string>();
  for (const name of [...eventCatalogIds].sort()) {
    const file = join(root, `${name}.json`);
    for (const [index, value] of (await jsonArray(file)).entries()) {
      const data = value as Record<string, unknown> | null;
      const label = `${file} [${index}] 事件 ${data?.id ?? '未知'}`;
      const record = validated(basicEventRecordSchema, data && typeof data === 'object' ? { ...data, aliases: normalizeAliases(data.aliases) } : data, label);
      if (ids.has(record.id)) throw new Error(`重复事件 ID: ${record.id}; ${ids.get(record.id)}; ${file}`);
      ids.set(record.id, file); locations.set(record, label); records.push(record);
    }
  }
  return records;
}
export async function readCoreDetails(sourceRoot: string): Promise<Map<string, CoreEventDetails>> {
  const details = new Map<string, CoreEventDetails>();
  const root = join(sourceRoot, 'content');
  for (const file of await markdownFiles(root)) {
    const parts = relative(root, file).split(sep);
    if (parts.length !== 3 || !['events', 'people'].includes(parts[1])) throw new Error(`档案路径无效: ${file}`);
    if (parts[1] !== 'events') continue;
    const parsed = await parseFrontmatter(file, '事件');
    const id = eventMarkdownId(parsed.data, file);
    const allowed = new Set(['id', 'causes', 'course', 'results', 'impacts', 'historiography']);
    const forbidden = Object.keys(parsed.data).filter(key => !allowed.has(key));
    if (forbidden.length) throw new Error(`${file}: 事件 ${parsed.data.id ?? basename(file, '.md')} 禁止在核心 Markdown 重复目录元数据: ${forbidden.join(', ')}`);
    const detail = validated(coreEventDetailsSchema, { ...parsed.data, background: parsed.content.trim() }, `${file}: 事件 ${parsed.data.id ?? basename(file, '.md')}`);
    const previous = details.get(detail.id);
    if (previous) throw new Error(`重复核心 Markdown ID: ${detail.id}; ${locations.get(previous)}; ${file}`);
    locations.set(detail, file); detailEras.set(detail, parts[0]); details.set(detail.id, detail);
  }
  return details;
}
export function mergeEventArchives(records: BasicEventRecord[], details: Map<string, CoreEventDetails>): HistoryEventArchiveRecord[] {
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) throw new Error(`重复事件 ID: ${record.id}; ${locations.get(record) ?? 'catalog'}`);
    ids.add(record.id);
  }
  for (const [id, detail] of details) if (!ids.has(id)) throw new Error(`${locations.get(detail) ?? id}: 核心 Markdown ${id} 没有目录记录`);
  return records.map(record => {
    const label = locations.get(record) ?? `事件 ${record.id}`;
    const detail = details.get(record.id);
    if (record.detailLevel === 'core' && !detail) throw new Error(`${label}: 缺少核心 Markdown`);
    if (record.detailLevel === 'basic' && detail) throw new Error(`${locations.get(detail) ?? record.id}: basic 事件不能包含核心 Markdown`);
    if (detail && detailEras.has(detail) && detailEras.get(detail) !== record.eraId) throw new Error(`${locations.get(detail)}: 目录时代 ${detailEras.get(detail)} 与 eraId ${record.eraId} 不一致`);
    return validated(historyEventArchiveSchema, { ...record, ...detail }, `${label}${detail ? `; ${locations.get(detail) ?? detail.id}` : ''}`);
  });
}
