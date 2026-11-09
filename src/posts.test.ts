import { createPostCollection, parsePostFile } from './posts';

const validSource = `---
slug: example
language: en
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
  it('parses a valid Markdown article', () => {
    expect(parsePostFile('/posts/example.en.md', validSource)).toEqual({
      slug: 'example',
      language: 'en',
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

    expect(() => parsePostFile('/posts/broken.md', missingTitle)).toThrow(
      '/posts/broken.md: missing or invalid title'
    );
  });

  it('sorts articles newest first with a stable slug tie breaker', () => {
    const files = {
      '/posts/older.en.md': validSource.replace('slug: example', 'slug: older'),
      '/posts/zulu.en.md': validSource.replace('slug: example', 'slug: zulu'),
      '/posts/alpha.en.md': validSource.replace('slug: example', 'slug: alpha'),
      '/posts/newer.en.md': validSource
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
        '/posts/one.en.md': validSource,
        '/posts/two.en.md': validSource
      })
    ).toThrow('duplicate post: en/example');
  });

  it('rejects invalid dates and empty tag lists', () => {
    expect(() =>
      parsePostFile('/posts/date.md', validSource.replace('2026-06-05', 'June 5'))
    ).toThrow('/posts/date.md: missing or invalid date');
    expect(() =>
      parsePostFile('/posts/tags.md', validSource.replace('tags:\n  - React\n  - Vite', 'tags: []'))
    ).toThrow('/posts/tags.md: missing or invalid tags');
  });
});
