import { historyEventArchiveSchema, eventIndexSchema, personIndexSchema, type HistoryEventArchiveRecord, type PersonArchive, type HistoryEra, type EditorialPeriod, type SourceRecord, type PlaceIndex, type ThemeArchive, type HistoryRelation } from '../../src/history/content/schema';
import { validated } from './catalog';
import type { ContentQualityReport } from './quality';
export function assertUniqueEditorialPeriods(periods: EditorialPeriod[]): void {
  const seen = new Set<string>();
  for (const period of periods) {
    if (seen.has(period.id)) throw new Error(`重复编辑时期 ID: ${period.id}`);
    seen.add(period.id);
  }
}
export interface GeneratedContent {
  events: Array<HistoryEventArchiveRecord>;
  people: PersonArchive[]; eras: HistoryEra[]; periods: EditorialPeriod[];
  sources: SourceRecord[]; places: PlaceIndex[]; themes: ThemeArchive[]; relations: HistoryRelation[];
  contentQuality: ContentQualityReport;
}
function baseReport(content: GeneratedContent) {
  return { eventCount: content.events.length, personCount: content.people.length, eraCount: content.eras.length, sourceCount: content.sources.length, themeCount: content.themes.length, errorCount: 0 as const };
}
function compactEvent(event: HistoryEventArchiveRecord) {
  const metadata = Object.fromEntries(Object.entries(event).filter(([key]) => !['background', 'causes', 'course', 'results', 'impacts', 'historiography', 'sourceRefs'].includes(key)));
  metadata.sourceIds = [...new Set(event.sourceRefs.map(ref => ref.sourceId))];
  return validated(eventIndexSchema, { ...metadata, year: event.startYear }, `事件索引 ${event.id}`);
}
function compactPerson(person: PersonArchive) {
  const { id, name, aliases, primaryEraId, birthYear, deathYear, roleIds, eventIds, sourceIds } = person;
  return validated(personIndexSchema, { id, name, aliases, primaryEraId, birthYear, deathYear, roleIds, eventIds, sourceIds }, `人物索引 ${id}`);
}

/** Object keys are lexical; arrays retain their editorial order or explicit record chronology. */
export function stableJson(value: unknown): string {
  return `${JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item, 2)}\n`;
}
const compatibilityEraIds = new Set(['tang', 'five-dynasties', 'song', 'yuan', 'ming', 'qing', 'modern']);
function legacyEraId(event: HistoryEventArchiveRecord, eras: HistoryEra[]): string {
  if (compatibilityEraIds.has(event.eraId)) return event.eraId;
  // Future editorial eras can overlap the existing navigation without changing its contract.
  return eras.filter(era => compatibilityEraIds.has(era.id) && event.startYear >= era.startYear && event.startYear <= era.endYear).at(-1)?.id ?? event.eraId;
}
export function generatedFiles(content: GeneratedContent): { publicFiles: Map<string, unknown>; compatibility: unknown } {
  assertUniqueEditorialPeriods(content.periods);
  for (const event of content.events) validated(historyEventArchiveSchema, event, `事件 ${event.id}: legacy 档案已停用`);
  const { events, people, eras, sources, places, themes, relations } = content;
  const personNames = new Map(people.map(person => [person.id, person.name]));
  const indexes = { events: 'indexes/events.compact.json', people: 'indexes/people.compact.json', places: 'indexes/places.compact.json', themes: 'indexes/themes.compact.json' };
  const legacyEventIds = [] as string[];
  const legacyEventCount = 0;
  const structuredEventCount = events.length;
  const basicEventCount = events.filter(event => event.detailLevel === 'basic').length;
  const periodCounts = Object.fromEntries(content.periods.map(period => [period.id, events.filter(event => event.editorialPeriodId === period.id).length]));
  if (Object.values(periodCounts).reduce((sum, count) => sum + count, 0) !== structuredEventCount) throw new Error('periodCounts must partition structuredEventCount');
  const manifest = {
    // All production events are catalog-backed basic/core archives.
    version: 2, ...baseReport(content), structuredEventCount, legacyEventCount, basicEventCount, coreEventCount: events.length - basicEventCount,
    editorialPeriods: content.periods, periodCounts, legacyEventIds, eras, indexes,
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
      story: 'background' in event ? [...new Set([event.background, ...event.course.map(entry => entry.description), ...event.results, ...event.impacts.map(impact => impact.text)])].join('') : event.summary,
      offset: event.layout.offset
    }))
  };
  return { publicFiles, compatibility };
}
