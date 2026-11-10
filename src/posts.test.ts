import { createPostCollection, filterPublishedPosts, parsePostFile } from './posts';

const validSource = `---
slug: example
draft: false
coverImage: /uploads/example.webp
date: 2026-06-05
title: Example
summary: A short example.
tags:
  - React
  - Vite
relatedProject: Example Project
---

## What changed

The article body.
`;

describe('Build Log posts', () => {
  it('derives language from localized folders and filters drafts', () => {
    const collection = createPostCollection({
      '/content/en/posts/public.md': validSource.replace('slug: example', 'slug: public'),
      '/content/en/posts/draft.md': validSource.replace('slug: example', 'slug: draft').replace('draft: false', 'draft: true'),
      '/content/zh/posts/example.md': validSource
    });
    expect(collection.map((post) => [post.language, post.slug, post.draft])).toEqual([
      ['en', 'draft', true], ['zh', 'example', false], ['en', 'public', false]
    ]);
    expect(filterPublishedPosts(collection, 'en').map((post) => post.slug)).toEqual(['public']);
    expect(filterPublishedPosts(collection, 'zh').map((post) => post.slug)).toEqual(['example']);
  });

  it.each(['/content/fr/posts/example.md', '/posts/example.en.md', '/content/en/posts/nested/example.md'])('rejects invalid localized path %s', (path) => {
    expect(() => parsePostFile(path, validSource)).toThrow('invalid localized post path');
  });

  it('validates draft, cover media, and optional generated metadata', () => {
    const path = '/content/en/posts/example.md';
    expect(() => parsePostFile(path, validSource.replace('draft: false', 'draft: "false"'))).toThrow('invalid draft');
    expect(() => parsePostFile(path, validSource.replace('coverImage: /uploads/example.webp', 'coverImage: 42'))).toThrow('invalid coverImage');
    const generated = validSource.replace('coverImage: /uploads/example.webp', 'coverImage: ""\n_translation:\n  sourceHash: abc\n  policyVersion: 1');
    expect(parsePostFile(path, generated).coverImage).toBe('');
    expect(parsePostFile(path, generated)).not.toHaveProperty('_translation');
    expect(parsePostFile(path, validSource.replace('coverImage: /uploads/example.webp\n', '')).coverImage).toBeUndefined();
    expect(() => parsePostFile(path, generated.replace('sourceHash: abc', 'sourceHash: 42'))).toThrow('_translation');
  });

  it('parses a valid Markdown article', () => {
    expect(parsePostFile('/content/en/posts/example.md', validSource)).toEqual({
      slug: 'example',
      language: 'en',
      draft: false,
      coverImage: '/uploads/example.webp',
      date: '2026-06-05',
      title: 'Example',
      summary: 'A short example.',
      tags: ['React', 'Vite'],
      relatedProject: 'Example Project',
      body: '## What changed\n\nThe article body.'
    });
  });

  it('reports the file and field when required metadata is invalid', () => {
    const missingTitle = validSource.replace('title: Example\n', '');

    expect(() => parsePostFile('/content/en/posts/broken.md', missingTitle)).toThrow(
      '/content/en/posts/broken.md: missing or invalid title'
    );
  });

  it('sorts articles newest first with a stable slug tie breaker', () => {
    const files = {
      '/content/en/posts/older.md': validSource.replace('slug: example', 'slug: older'),
      '/content/en/posts/zulu.md': validSource.replace('slug: example', 'slug: zulu'),
      '/content/en/posts/alpha.md': validSource.replace('slug: example', 'slug: alpha'),
      '/content/en/posts/newer.md': validSource
        .replace('slug: example', 'slug: newer')
        .replace('date: 2026-06-05', 'date: 2026-06-11')
    };

    expect(createPostCollection(files).map((post) => post.slug)).toEqual([
      'newer',
      'alpha',
      'older',
      'zulu'
    ]);
  });

  it('rejects duplicate language and slug combinations', () => {
    expect(() =>
      createPostCollection({
        '/content/en/posts/one.md': validSource,
        '/content/en/posts/two.md': validSource
      })
    ).toThrow('duplicate post: en/example');
  });

  it('rejects invalid dates and empty tag lists', () => {
    expect(() =>
      parsePostFile('/content/en/posts/date.md', validSource.replace('2026-06-05', 'June 5'))
    ).toThrow('/content/en/posts/date.md: missing or invalid date');
    expect(() =>
      parsePostFile('/content/en/posts/impossible-date.md', validSource.replace('2026-06-05', '2026-02-30'))
    ).toThrow('/content/en/posts/impossible-date.md: missing or invalid date');
    expect(() =>
      parsePostFile('/content/en/posts/tags.md', validSource.replace('tags:\n  - React\n  - Vite', 'tags: []'))
    ).toThrow('/content/en/posts/tags.md: missing or invalid tags');
  });
});
