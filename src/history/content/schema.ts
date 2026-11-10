import { z } from 'zod';

export const categoryIds = ['politics', 'war', 'institution', 'economy', 'science', 'culture', 'thought', 'religion', 'diplomacy', 'ethnicity', 'society'] as const;
export const relationTypes = ['cause', 'consequence', 'parallel', 'contrast', 'part-of'] as const;
export const yearPrecisions = ['exact', 'circa', 'decade', 'century', 'range'] as const;

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const prose = z.string().trim().min(1).refine(value => !/<[a-zA-Z/]/.test(value), 'Raw HTML is forbidden');
const ids = z.array(id);
const year = z.number().int().refine(value => value !== 0, 'There is no historical year zero');
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const offset = z.tuple([z.number(), z.number()]);
const category = z.enum(categoryIds);
const precision = z.enum(yearPrecisions);
const influence = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const layout = z.strictObject({ lane: category, offset });
const timelineEntry = z.strictObject({ year, title: prose, description: prose });

export const sourceSchema = z.strictObject({
  id, title: prose, kind: z.enum(['textbook', 'book', 'institution', 'article', 'website']),
  authors: z.array(prose).optional(), publisher: prose.optional(), edition: prose.optional(),
  chapter: prose.optional(), url: z.string().url().startsWith('https://').optional(),
  accessedAt: z.iso.date().optional()
});

const eventFields = {
  id, title: prose, aliases: z.array(prose), startYear: year, endYear: year,
  yearPrecision: precision, eraId: id, polityIds: ids, period: prose,
  categories: z.array(category).min(1), themeIds: ids, influence, summary: prose,
  personIds: ids, placeIds: ids, parentId: id.nullable(), childIds: ids, relationIds: ids,
  sourceIds: ids.min(1), color, layout
};

function validateEvent(value: { id: string; startYear: number; endYear: number; parentId: string | null; childIds: string[] }, ctx: z.RefinementCtx) {
  if (value.startYear > value.endYear) ctx.addIssue({ code: 'custom', path: ['endYear'], message: 'End precedes start' });
  if (value.parentId === value.id) ctx.addIssue({ code: 'custom', path: ['parentId'], message: 'An event cannot parent itself' });
  if (value.childIds.includes(value.id)) ctx.addIssue({ code: 'custom', path: ['childIds'], message: 'An event cannot contain itself' });
}

export const eventArchiveSchema = z.strictObject({
  ...eventFields, background: prose, causes: z.array(prose).min(1), course: z.array(timelineEntry).min(1),
  results: z.array(prose).min(1), impacts: z.array(z.strictObject({ dimension: category, text: prose })).min(1),
  historiography: prose
}).superRefine((value, ctx) => {
  validateEvent(value, ctx);
  value.course.forEach((entry, index) => {
    if (entry.year < value.startYear || entry.year > value.endYear) {
      ctx.addIssue({ code: 'custom', path: ['course', index, 'year'], message: 'Course year is outside the event' });
    }
  });
});

/** A range needs both endpoints; this helper formats its individual endpoints. */
export function formatHistoryYear(value: number, yearPrecision: z.infer<typeof precision>): string {
  year.parse(value);
  const before = value < 0 ? '公元前 ' : '';
  const magnitude = Math.abs(value);
  if (yearPrecision === 'century') return `${before}${Math.ceil(magnitude / 100)} 世纪`;
  if (yearPrecision === 'decade') return `${before}${Math.floor(magnitude / 10) * 10} 年代`;
  if (yearPrecision === 'circa') return value < 0 ? `约公元前 ${magnitude} 年` : `约 ${magnitude} 年`;
  return `${before}${magnitude} 年`;
}

export const eventIndexSchema = z.strictObject({ ...eventFields, year }).superRefine((value, ctx) => {
  validateEvent(value, ctx);
  if (value.year !== value.startYear) ctx.addIssue({ code: 'custom', path: ['year'], message: 'Representative year must equal startYear' });
});

export const eraSchema = z.strictObject({ id, name: prose, startYear: year, endYear: year, color, inscription: prose })
  .refine(value => value.startYear <= value.endYear, { path: ['endYear'], message: 'End precedes start' });

const personFields = {
  id, name: prose, aliases: z.array(prose), primaryEraId: id,
  birthYear: year.nullable(), deathYear: year.nullable(), roleIds: ids,
  eventIds: ids.min(1), sourceIds: ids.min(1)
};
function validateLifespan(value: { birthYear: number | null; deathYear: number | null }, ctx: z.RefinementCtx) {
  if (value.birthYear !== null && value.deathYear !== null && value.birthYear > value.deathYear) {
    ctx.addIssue({ code: 'custom', path: ['deathYear'], message: 'Death precedes birth' });
  }
}
export const personIndexSchema = z.strictObject(personFields).superRefine(validateLifespan);
export const personArchiveSchema = z.strictObject({
  ...personFields, yearPrecision: precision, birthplaceId: id.nullable(), placeIds: ids,
  summary: prose, timeline: z.array(timelineEntry).min(1),
  identities: z.array(z.strictObject({ startYear: year, endYear: year, roleId: id, description: prose })
    .refine(value => value.startYear <= value.endYear, { path: ['endYear'], message: 'End precedes start' })),
  contributions: z.array(prose), relations: z.array(z.strictObject({ personId: id, type: prose, description: prose })),
  evaluation: prose, legacy: prose, works: z.array(prose), relics: z.array(prose), historiography: prose
}).superRefine((value, ctx) => {
  validateLifespan(value, ctx);
  value.timeline.forEach((entry, index) => {
    if ((value.birthYear !== null && entry.year < value.birthYear) || (value.deathYear !== null && entry.year > value.deathYear)) {
      ctx.addIssue({ code: 'custom', path: ['timeline', index, 'year'], message: 'Timeline year is outside lifespan' });
    }
  });
  value.identities.forEach((identity, index) => {
    if ((value.birthYear !== null && identity.startYear < value.birthYear) || (value.deathYear !== null && identity.endYear > value.deathYear)) {
      ctx.addIssue({ code: 'custom', path: ['identities', index], message: 'Identity dates are outside lifespan' });
    }
  });
  value.relations.forEach((relation, index) => {
    if (relation.personId === value.id) ctx.addIssue({ code: 'custom', path: ['relations', index, 'personId'], message: 'A person cannot relate to themselves' });
  });
});

export const placeIndexSchema = z.strictObject({
  id, name: prose, modernName: prose, aliases: z.array(prose),
  historicalNames: z.array(z.strictObject({ name: prose, startYear: year, endYear: year })
    .refine(value => value.startYear <= value.endYear, { path: ['endYear'], message: 'End precedes start' })),
  // Longitude, latitude, in degrees.
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]), eventIds: ids
});
export const themeArchiveSchema = z.strictObject({
  id, title: prose, summary: prose, eventIds: ids.min(1),
  chapters: z.array(z.strictObject({ title: prose, description: prose, eventIds: ids.min(1) })).min(1),
  camera: z.strictObject({ position: z.tuple([z.number(), z.number(), z.number()]), target: z.tuple([z.number(), z.number(), z.number()]) }).optional(),
  sourceIds: ids
});
export const themeIndexSchema = themeArchiveSchema.pick({ id: true, title: true, summary: true, eventIds: true });
export const relationSchema = z.strictObject({ id, fromId: id, toId: id, type: z.enum(relationTypes) })
  .refine(value => value.fromId !== value.toId, { path: ['toId'], message: 'An event cannot relate to itself' });

export type HistoryEra = z.infer<typeof eraSchema>;
export type HistoryEventArchive = z.infer<typeof eventArchiveSchema>;
export type CompactHistoryEventIndex = z.infer<typeof eventIndexSchema>;
export type PersonIndex = z.infer<typeof personIndexSchema>;
export type PersonArchive = z.infer<typeof personArchiveSchema>;
export type PlaceIndex = z.infer<typeof placeIndexSchema>;
export type ThemeArchive = z.infer<typeof themeArchiveSchema>;
export type ThemeIndex = z.infer<typeof themeIndexSchema>;
export type SourceRecord = z.infer<typeof sourceSchema>;
export type HistoryRelation = z.infer<typeof relationSchema>;
export type CategoryId = typeof categoryIds[number];
export type RelationType = typeof relationTypes[number];
export type YearPrecision = typeof yearPrecisions[number];
