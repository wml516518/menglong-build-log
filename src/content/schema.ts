import { z } from 'zod';

export const languages = ['en', 'zh'] as const;
export type Language = (typeof languages)[number];

export const homeSectionIds = [
  'buildLog', 'projects', 'resume', 'experience', 'resumeProjects', 'about', 'contact'
] as const;
export type HomeSectionId = (typeof homeSectionIds)[number];

export type TranslationMetadata = { sourceHash: string; policyVersion: number };

const copy = z.string().trim().min(1);
const media = z.string().trim().optional();
const httpUrl = z.string().trim().url().refine(
  (value) => /^https?:/i.test(value),
  { message: 'Expected an HTTP or HTTPS URL' }
);
const href = z.union([httpUrl, z.string().trim().regex(/^mailto:[^\s]+$/)]);
const translationMetadataSchema = z.object({
  sourceHash: copy,
  policyVersion: z.number()
}).strict();

const homeSectionOrderSchema = z.array(z.enum(homeSectionIds)).superRefine((value, context) => {
  if (value.length !== homeSectionIds.length || new Set(value).size !== homeSectionIds.length) {
    context.addIssue({ code: 'custom', message: 'Expected each homepage section exactly once' });
  }
});

export const siteDocumentSchema = z.object({
  nav: z.object({
    projects: copy, buildLog: copy, resume: copy, about: copy, contact: copy
  }).strict(),
  profile: z.object({
    name: copy, role: copy, eyebrow: copy, headline: copy, intro: copy,
    primaryAction: copy, secondaryAction: copy, avatar: media, resumeDownload: media
  }).strict(),
  sections: z.object({
    projects: copy, buildLog: copy, resume: copy, about: copy, contact: copy,
    latestBuildLog: copy, allPosts: copy, backToPosts: copy, postNotFound: copy,
    readArticle: copy, tags: copy, education: copy, skills: copy, certifications: copy,
    languages: copy, experience: copy, selectedProjects: copy
  }).strict(),
  about: copy,
  homeSectionOrder: homeSectionOrderSchema,
  historyGalaxy: z.object({
    title: copy, status: copy, summary: copy, stack: z.array(copy), action: copy, imageAlt: copy
  }).strict(),
  projects: z.array(z.object({
    title: copy, status: copy, summary: copy, stack: z.array(copy), githubUrl: httpUrl, liveUrl: httpUrl
  }).strict()),
  contact: z.array(z.object({ label: copy, value: copy, href }).strict()),
  seo: z.object({
    homeTitle: copy, buildLogTitle: copy, description: copy, socialImage: media
  }).strict(),
  _translation: translationMetadataSchema.optional()
}).strict();

const resumeFieldSchema = z.object({ label: copy, value: copy }).strict();

export const resumeDocumentSchema = z.object({
  basics: z.object({
    name: resumeFieldSchema, gender: resumeFieldSchema, birthDate: resumeFieldSchema,
    location: resumeFieldSchema, email: resumeFieldSchema, github: resumeFieldSchema,
    role: resumeFieldSchema
  }).strict(),
  summary: copy,
  education: z.array(z.object({ school: copy, detail: copy }).strict()),
  experience: z.array(z.object({
    company: copy, role: copy, period: copy, highlights: z.array(copy)
  }).strict()),
  projects: z.array(z.object({
    name: copy, period: copy, description: copy, highlights: z.array(copy), stack: z.array(copy)
  }).strict()),
  skills: z.array(z.object({ group: copy, items: z.array(copy) }).strict()),
  certifications: z.array(copy),
  languages: z.array(copy),
  _translation: translationMetadataSchema.optional()
}).strict();

export type SiteDocument = z.infer<typeof siteDocumentSchema>;
export type ResumeDocument = z.infer<typeof resumeDocumentSchema>;
export type SiteContent = Omit<SiteDocument, '_translation'> & { resume: Omit<ResumeDocument, '_translation'> };

function parseDocument<T>(schema: z.ZodType<T>, value: unknown, path: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) =>
      `${path}: ${issue.path.join('.')} ${issue.message}`
    ).join('\n'));
  }
  return result.data;
}

export function parseSiteDocument(value: unknown, path: string): SiteDocument {
  return parseDocument(siteDocumentSchema, value, path);
}

export function parseResumeDocument(value: unknown, path: string): ResumeDocument {
  return parseDocument(resumeDocumentSchema, value, path);
}

export function stripTranslationMetadata<T extends { _translation?: TranslationMetadata }>(value: T): Omit<T, '_translation'> {
  const { _translation, ...document } = value;
  return document;
}
