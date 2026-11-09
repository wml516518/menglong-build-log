import { Buffer } from 'buffer';
import matter from 'gray-matter';
import type { Language } from './content';

(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;

export type BuildLogPost = {
  slug: string;
  language: Language;
  date: string;
  title: string;
  summary: string;
  tags: string[];
  relatedProject: string;
  body: string;
};

type PostField = 'slug' | 'language' | 'date' | 'title' | 'summary' | 'tags' | 'relatedProject';

const markdownFiles = import.meta.glob('./posts/*.md', {
  eager: true,
  query: '?raw',
  import: 'default'
}) as Record<string, string>;

function invalid(path: string, field: PostField): never {
  throw new Error(`${path}: missing or invalid ${field}`);
}

function requiredString(path: string, field: PostField, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    invalid(path, field);
  }
  return value.trim();
}

export function parsePostFile(path: string, source: string): BuildLogPost {
  const parsed = matter(source);
  const slug = requiredString(path, 'slug', parsed.data.slug);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    invalid(path, 'slug');
  }

  const language = requiredString(path, 'language', parsed.data.language);
  if (language !== 'en' && language !== 'zh') {
    invalid(path, 'language');
  }

  const rawDate = parsed.data.date;
  const date = rawDate instanceof Date ? rawDate.toISOString().slice(0, 10) : rawDate;
  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`))
  ) {
    invalid(path, 'date');
  }

  const tags = parsed.data.tags;
  if (
    !Array.isArray(tags) ||
    tags.length === 0 ||
    tags.some((tag) => typeof tag !== 'string' || tag.trim() === '')
  ) {
    invalid(path, 'tags');
  }

  return {
    slug,
    language,
    date,
    title: requiredString(path, 'title', parsed.data.title),
    summary: requiredString(path, 'summary', parsed.data.summary),
    tags: tags.map((tag) => tag.trim()),
    relatedProject: requiredString(path, 'relatedProject', parsed.data.relatedProject),
    body: parsed.content.trim()
  };
}

export function createPostCollection(files: Record<string, string>): BuildLogPost[] {
  const posts = Object.entries(files).map(([path, source]) => parsePostFile(path, source));
  const identities = new Set<string>();

  for (const post of posts) {
    const identity = `${post.language}/${post.slug}`;
    if (identities.has(identity)) {
      throw new Error(`duplicate post: ${identity}`);
    }
    identities.add(identity);
  }

  return posts.sort((left, right) => {
    const dateOrder = right.date.localeCompare(left.date);
    return dateOrder || left.slug.localeCompare(right.slug);
  });
}

export const posts = createPostCollection(markdownFiles);

export function getPosts(language: Language): BuildLogPost[] {
  return posts.filter((post) => post.language === language);
}

export function getPost(language: Language, slug: string): BuildLogPost | undefined {
  return posts.find((post) => post.language === language && post.slug === slug);
}
