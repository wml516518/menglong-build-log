import { parseResumeDocument, parseSiteDocument, type ResumeDocument, type SiteDocument } from '../../src/content/schema';
import { validateTranslations, type TranslationSegment, type Translations } from './types';
import { translationGlossary } from './hash';

// Explicit field allowlists; label lists additionally preserve exact glossary tokens.
const navKeys = ['projects', 'buildLog', 'resume', 'about', 'contact'];
const sectionKeys = [...navKeys, 'latestBuildLog', 'allPosts', 'backToPosts', 'postNotFound', 'readArticle', 'tags', 'education', 'skills', 'certifications', 'languages', 'experience', 'selectedProjects'];
const profileKeys = ['name', 'role', 'eyebrow', 'headline', 'intro', 'primaryAction', 'secondaryAction'];
const basicKeys = ['name', 'gender', 'birthDate', 'location', 'email', 'github', 'role'];

const localizedItems = (items: string[], prefix: string) => items.flatMap((item, index) =>
  translationGlossary.protected.includes(item) ? [] : [`${prefix}.${index}`]
);

function sitePaths(source: SiteDocument): string[] {
  return [
    ...navKeys.map(key => `nav.${key}`),
    ...profileKeys.map(key => `profile.${key}`),
    ...sectionKeys.map(key => `sections.${key}`), 'about',
    ...['title', 'status', 'summary', 'action', 'imageAlt'].map(key => `historyGalaxy.${key}`),
    ...localizedItems(source.historyGalaxy.stack, 'historyGalaxy.stack'),
    ...source.projects.flatMap((_, index) => ['title', 'status', 'summary'].map(key => `projects.${index}.${key}`)),
    ...source.contact.map((_, index) => `contact.${index}.label`),
    ...['homeTitle', 'buildLogTitle', 'description'].map(key => `seo.${key}`)
  ];
}

function resumePaths(source: ResumeDocument): string[] {
  return [
    ...basicKeys.map(key => `basics.${key}.label`),
    ...['name', 'gender', 'location', 'role'].map(key => `basics.${key}.value`), 'summary',
    ...source.education.flatMap((_, index) => ['school', 'detail'].map(key => `education.${index}.${key}`)),
    ...source.experience.flatMap((item, index) => [
      `experience.${index}.company`, `experience.${index}.role`, `experience.${index}.period`,
      ...item.highlights.map((_, n) => `experience.${index}.highlights.${n}`)
    ]),
    ...source.projects.flatMap((item, index) => [
      `projects.${index}.name`, `projects.${index}.description`, `projects.${index}.period`,
      ...item.highlights.map((_, n) => `projects.${index}.highlights.${n}`),
      ...localizedItems(item.stack, `projects.${index}.stack`)
    ]),
    ...source.skills.flatMap((item, index) => [`skills.${index}.group`, ...localizedItems(item.items, `skills.${index}.items`)]),
    ...source.certifications.map((_, index) => `certifications.${index}`),
    ...source.languages.map((_, index) => `languages.${index}`)
  ];
}

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], source);
}

function writePath(source: unknown, path: string, value: string): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const parent = keys.reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], source);
  (parent as Record<string, unknown>)[last] = value;
}

function collect(source: unknown, paths: string[]): TranslationSegment[] {
  return paths.map(id => ({ id, text: readPath(source, id) as string, context: `Structured content: ${id}` }));
}

function apply<T>(source: T, segments: TranslationSegment[], translations: Translations): T {
  validateTranslations(segments, translations);
  for (const segment of segments.filter(item => item.id.endsWith('.period'))) {
    const tokens = (value: string) => value.match(/\d+(?:[./]\d+)*/g) ?? [];
    if (JSON.stringify(tokens(segment.text)) !== JSON.stringify(tokens(translations.get(segment.id)!))) throw new Error(`Period date tokens changed: ${segment.id}`);
  }
  const result = structuredClone(source);
  for (const { id } of segments) writePath(result, id, translations.get(id)!);
  // Mask approved copy only; every protected value and list shape must remain identical.
  const before = structuredClone(source);
  const after = structuredClone(result);
  for (const { id } of segments) {
    writePath(before, id, '');
    writePath(after, id, '');
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Protected values or list lengths changed');
  return result;
}

export function collectSiteSegments(source: SiteDocument): TranslationSegment[] {
  const validated = parseSiteDocument(source, 'site');
  return collect(validated, sitePaths(validated));
}

export function collectResumeSegments(source: ResumeDocument): TranslationSegment[] {
  const validated = parseResumeDocument(source, 'resume');
  return collect(validated, resumePaths(validated));
}

export function applySiteTranslations(source: SiteDocument, translations: Translations): SiteDocument {
  return parseSiteDocument(apply(source, collectSiteSegments(source), translations), 'translated site');
}

export function applyResumeTranslations(source: ResumeDocument, translations: Translations): ResumeDocument {
  return parseResumeDocument(apply(source, collectResumeSegments(source), translations), 'translated resume');
}
