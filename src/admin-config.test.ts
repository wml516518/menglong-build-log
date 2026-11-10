// @vitest-environment node
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

interface CmsCollection {
  name: string;
  publish: boolean;
  file?: string;
  folder?: string;
  fields?: CmsField[];
  files?: Array<{ file: string; fields: CmsField[] }>;
}

interface CmsField {
  name: string;
  widget: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  field?: CmsField;
  fields?: CmsField[];
}

interface CmsConfig {
  backend: {
    name: string;
    branch: string;
    turbo_site_id: string;
  };
  publish_mode: string;
  locale: string;
  media_folder: string;
  public_folder: string;
  collections: CmsCollection[];
}

const collectContentPaths = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(collectContentPaths);
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const ownPath = (key === 'file' || key === 'folder') && typeof child === 'string'
      ? [child]
      : [];
    return [...ownPath, ...collectContentPaths(child)];
  });
};

describe('Decap CMS configuration', () => {
  it('edits only Chinese source content', () => {
    const config = load(readFileSync('public/admin/config.yml', 'utf8')) as CmsConfig;

    expect(config.backend.name).toBe('turbo-github');
    expect(config.backend.branch).toBe('main');
    expect(config.backend.turbo_site_id).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/);
    expect(config.publish_mode).toBe('editorial_workflow');
    expect(config.locale).toBe('zh_Hans');
    expect(config.media_folder).toBe('public/uploads');
    expect(config.public_folder).toBe('/uploads');
    expect(JSON.stringify(config.collections)).not.toContain('content/en');
    expect(config.collections.map((item) => item.name)).toEqual(['site', 'resume', 'posts']);
    expect(config.collections.every((item) => item.publish === false)).toBe(true);
    expect([...new Set(collectContentPaths(config.collections))].sort()).toEqual([
      'content/zh/posts',
      'content/zh/resume.yml',
      'content/zh/site.yml',
    ]);
  });

  it('exposes every top-level Chinese document field without translation metadata', () => {
    const config = load(readFileSync('public/admin/config.yml', 'utf8')) as CmsConfig;
    const [site, resume, posts] = config.collections;

    expect(site.files?.[0].fields.map((field) => field.name)).toEqual([
      'nav',
      'profile',
      'sections',
      'about',
      'historyGalaxy',
      'projects',
      'contact',
      'homeSectionOrder',
      'seo',
    ]);
    expect(resume.files?.[0].fields.map((field) => field.name)).toEqual([
      'basics',
      'summary',
      'education',
      'experience',
      'projects',
      'skills',
      'certifications',
      'languages',
    ]);
    expect(posts.fields?.map((field) => field.name)).toEqual([
      'slug',
      'date',
      'draft',
      'title',
      'summary',
      'tags',
      'relatedProject',
      'coverImage',
      'body',
    ]);
    expect(JSON.stringify(config)).not.toContain('_translation');
  });

  it('restricts homepage ordering to the seven supported section ids', () => {
    const config = load(readFileSync('public/admin/config.yml', 'utf8')) as CmsConfig;
    const field = config.collections[0].files?.[0].fields
      .find((candidate) => candidate.name === 'homeSectionOrder');

    expect(field).toMatchObject({ widget: 'list', required: true });
    expect(field?.field).toMatchObject({ widget: 'select' });
    expect(field?.field?.options?.map((option) => option.value)).toEqual([
      'buildLog',
      'projects',
      'resume',
      'experience',
      'resumeProjects',
      'about',
      'contact',
    ]);
  });

  it('requires the related project field needed by the post parser', () => {
    const config = load(readFileSync('public/admin/config.yml', 'utf8')) as CmsConfig;
    const posts = config.collections.find((collection) => collection.name === 'posts');
    const relatedProject = posts?.fields?.find((field) => field.name === 'relatedProject');

    expect(relatedProject).toMatchObject({ widget: 'string', required: true });
  });

  it('requires both project URLs needed by the site schema', () => {
    const config = load(readFileSync('public/admin/config.yml', 'utf8')) as CmsConfig;
    const projectFields = config.collections[0].files?.[0].fields
      .find((field) => field.name === 'projects')?.fields;

    expect(projectFields?.find((field) => field.name === 'githubUrl'))
      .toMatchObject({ widget: 'string', required: true });
    expect(projectFields?.find((field) => field.name === 'liveUrl'))
      .toMatchObject({ widget: 'string', required: true });
  });
});
