import { basicEventRecordSchema, categoryIds, type BasicEventRecord, type EditorialPeriod, type SourceRecord } from '../../src/history/content/schema';

export interface ContentQualityReport {
  eventCount: number;
  basicEventCount: number;
  coreEventCount: number;
  periodCounts: Record<string, number>;
  corePeriodCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  influenceCounts: Record<string, number>;
  suspectedDuplicates: Array<{ eventIds: [string, string]; similarity: number }>;
  finalTargetsEnforced: boolean;
  warnings: string[];
}

const normalizeTitle = (value: string) => value.normalize('NFKC').replace(/[\s\p{P}]/gu, '').replace(/\p{Script=Latin}/gu, char => char.toLowerCase());
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const counts = (keys: readonly string[]) => Object.fromEntries([...keys].sort(compare).map(key => [key, 0]));

// Release contract from the design, deliberately independent of the editable manifest.
const finalPeriodTargets = [
  { id: 'pre-qin', startYear: -2070, endYear: -221, eventQuota: 170, coreQuota: 25 },
  { id: 'qin-han', startYear: -221, endYear: 220, eventQuota: 130, coreQuota: 22 },
  { id: 'wei-jin', startYear: 220, endYear: 589, eventQuota: 120, coreQuota: 18 },
  { id: 'sui-tang-five-dynasties', startYear: 581, endYear: 960, eventQuota: 160, coreQuota: 30 },
  { id: 'song-liao-jin-xia', startYear: 907, endYear: 1279, eventQuota: 170, coreQuota: 30 },
  { id: 'yuan', startYear: 1271, endYear: 1368, eventQuota: 70, coreQuota: 12 },
  { id: 'ming', startYear: 1368, endYear: 1644, eventQuota: 130, coreQuota: 22 },
  { id: 'qing', startYear: 1644, endYear: 1840, eventQuota: 130, coreQuota: 21 },
  { id: 'modern', startYear: 1840, endYear: 1949, eventQuota: 120, coreQuota: 20 }
] as const;

/** Normalized Levenshtein similarity over Unicode code points, with no locale-dependent operations. */
function similarity(a: string, b: string): number {
  const left = [...a];
  const right = [...b];
  if (!left.length || !right.length) return a === b ? 1 : 0;
  let row = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 0; i < left.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < right.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + Number(left[i] !== right[j])));
    row = next;
  }
  return 1 - row[right.length] / Math.max(left.length, right.length);
}

/** Catalog integrity and optional exact production release targets. */
export function validateContentQuality(
  input: { events: BasicEventRecord[]; periods: EditorialPeriod[]; sources: SourceRecord[] },
  options: { enforceFinalTargets: boolean }
): ContentQualityReport {
  const events = [...input.events].sort((a, b) => compare(a.id, b.id));
  const periods = [...input.periods].sort((a, b) => compare(a.id, b.id));
  const report: ContentQualityReport = {
    eventCount: events.length, basicEventCount: 0, coreEventCount: 0,
    periodCounts: counts(periods.map(period => period.id)), corePeriodCounts: counts(periods.map(period => period.id)),
    categoryCounts: counts(categoryIds), influenceCounts: counts(['1', '2', '3', '4', '5']),
    suspectedDuplicates: [], finalTargetsEnforced: options.enforceFinalTargets, warnings: []
  };
  const errors: string[] = [];
  if (options.enforceFinalTargets) {
    const requiredIds = new Set<string>(finalPeriodTargets.map(period => period.id));
    const seen = new Set<string>();
    for (const period of periods) {
      if (seen.has(period.id)) errors.push(`最终编辑时期重复: ${period.id}`);
      seen.add(period.id);
      if (!requiredIds.has(period.id)) errors.push(`最终编辑时期额外 ID: ${period.id}`);
    }
    for (const target of finalPeriodTargets) {
      const matches = periods.filter(period => period.id === target.id);
      if (!matches.length) errors.push(`最终编辑时期缺少: ${target.id}`);
      for (const period of matches) for (const field of ['startYear', 'endYear', 'eventQuota', 'coreQuota'] as const) {
        if (period[field] !== target[field]) errors.push(`最终编辑时期 ${target.id} ${field} 必须为 ${target[field]}，实际 ${period[field]}`);
      }
    }
  }
  const eventMap = new Map<string, BasicEventRecord>();
  const periodMap = new Map(periods.map(period => [period.id, period]));
  const sourceIds = new Set(input.sources.map(source => source.id));
  const names = new Map<string, { id: string; title: boolean }[]>();
  for (const event of events) {
    if (eventMap.has(event.id)) errors.push(`重复事件 ID: ${event.id}`);
    eventMap.set(event.id, event);
    const parsed = basicEventRecordSchema.safeParse(event);
    if (!parsed.success) errors.push(...parsed.error.issues.map(issue => `事件 ${event.id} ${issue.path.join('.')}: ${issue.message}`));
    const refs = event.sourceRefs ?? [];
    if (new Set(refs.map(ref => ref.sourceId)).size !== refs.length) errors.push(`事件 ${event.id} sourceRefs 重复来源 ID`);
    if (event.detailLevel === 'core' && new Set(refs.map(ref => ref.sourceId)).size < 2) errors.push(`事件 ${event.id} sourceRefs 核心事件至少需要两个不同来源`);
    for (const ref of refs) if (!sourceIds.has(ref.sourceId)) errors.push(`事件 ${event.id} sourceRefs 引用了不存在的来源 ${ref.sourceId}`);
    const period = periodMap.get(event.editorialPeriodId);
    if (!period) errors.push(`事件 ${event.id} editorialPeriodId 引用了不存在的编辑时期 ${event.editorialPeriodId}`);
    else {
      report.periodCounts[period.id]++;
      if (event.detailLevel === 'core') report.corePeriodCounts[period.id]++;
      if (event.startYear < period.startYear || event.endYear > period.endYear) errors.push(`事件 ${event.id} 年代超出编辑时期 ${period.id}`);
    }
    if (event.detailLevel === 'core') report.coreEventCount++; else report.basicEventCount++;
    for (const category of new Set(event.categories)) report.categoryCounts[category]++;
    report.influenceCounts[event.influence]++;
    for (const [index, name] of [event.title, ...event.aliases].entries()) {
      const normalized = normalizeTitle(name);
      if (!normalized) { errors.push(`事件 ${event.id} ${index ? 'aliases' : 'title'} 规范化后为空`); continue; }
      const owners = names.get(normalized) ?? [];
      for (const owner of owners) if (owner.id !== event.id) errors.push(`${!index && owner.title ? '规范化标题重复' : '别名冲突'}: ${owner.id}, ${event.id}`);
      owners.push({ id: event.id, title: index === 0 }); names.set(normalized, owners);
    }
  }
  // Validate every relationship before it can exempt a duplicate candidate.
  for (const event of events) {
    if (event.parentId) {
      const parent = eventMap.get(event.parentId);
      if (!parent || !parent.childIds.includes(event.id)) errors.push(`事件 ${event.id} 与父事件 ${event.parentId} 未双向声明`);
      else if (event.startYear < parent.startYear || event.endYear > parent.endYear) errors.push(`事件 ${event.id} 超出父事件年代 ${parent.id}`);
    }
    for (const id of event.childIds) if (eventMap.get(id)?.parentId !== event.id) errors.push(`事件 ${event.id} 与子事件 ${id} 未双向声明`);
    const chain = new Set<string>();
    let current: BasicEventRecord | undefined = event;
    while (current) {
      if (chain.has(current.id)) { errors.push(`父事件循环: ${event.id}`); break; }
      chain.add(current.id); current = current.parentId ? eventMap.get(current.parentId) : undefined;
    }
  }
  const validParent = (parent: BasicEventRecord, child: BasicEventRecord) => parent.id !== child.id && child.parentId === parent.id
    && parent.childIds.includes(child.id) && child.startYear >= parent.startYear && child.endYear <= parent.endYear;
  for (let i = 0; i < events.length; i++) for (let j = i + 1; j < events.length; j++) {
    const a = events[i]; const b = events[j];
    if (a.editorialPeriodId !== b.editorialPeriodId || a.startYear > b.endYear || b.startYear > a.endYear) continue;
    if (validParent(a, b) || validParent(b, a)) continue;
    let score = 0;
    for (const left of [a.title, ...a.aliases]) for (const right of [b.title, ...b.aliases]) score = Math.max(score, similarity(normalizeTitle(left), normalizeTitle(right)));
    if (score >= 0.88) {
      report.suspectedDuplicates.push({ eventIds: [a.id, b.id], similarity: score });
      errors.push(`疑似重复: ${a.id}, ${b.id} (${score})`);
    }
  }
  const targets: string[] = [];
  if (report.eventCount !== 1200 || report.coreEventCount !== 200) targets.push(`最终目标: 事件 ${report.eventCount}/1200, 核心 ${report.coreEventCount}/200`);
  if (report.basicEventCount !== 1000) targets.push(`最终目标: 基础 ${report.basicEventCount}/1000`);
  for (const period of periods) {
    if (report.periodCounts[period.id] !== period.eventQuota || report.corePeriodCounts[period.id] !== period.coreQuota) targets.push(`时期 ${period.id}: 事件 ${report.periodCounts[period.id]}/${period.eventQuota}, 核心 ${report.corePeriodCounts[period.id]}/${period.coreQuota}`);
    const categories = new Set(events.filter(event => event.editorialPeriodId === period.id).flatMap(event => event.categories));
    if (categories.size && [...categories].every(category => category === 'politics' || category === 'war')) targets.push(`时期 ${period.id} 只有政治、战争分类`);
  }
  for (const category of categoryIds) if (!report.categoryCounts[category]) targets.push(`分类 ${category} 数量为零`);
  if (events.filter(event => event.categories.some(category => category === 'politics' || category === 'war')).length > events.length * 0.6) targets.push('政治与战争事件占比超过 60%');
  if (report.influenceCounts['5'] > events.length * 0.15) targets.push('影响力 5 事件占比超过 15%');
  if (options.enforceFinalTargets) errors.push(...targets); else report.warnings = targets;
  if (errors.length) throw Object.assign(new Error([...new Set(errors)].join('\n')), { report });
  return report;
}
