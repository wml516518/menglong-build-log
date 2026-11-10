import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import { collectMarkdownSegments, applyMarkdownTranslations } from './markdown';

const markdown = '# 标题\n\n查看 [项目主页](https://example.com?q=中文) 中的 `ActionID`。\n\n> 保留引用结构。\n\n```ts\nconst actionId = \'climate.open\';\n```\n\n![架构图](/uploads/architecture.webp)\n\n- 列表 **强调**\n\n<div>原始 HTML</div>\n\n[文档][ref]\n\n[ref]: https://example.com/docs "固定标题"\n';
function structure(source: string) {
  const nodes: unknown[] = [];
  visit(unified().use(remarkParse).parse(source), node => {
    const { position, children, value, alt, ...rest } = node as unknown as Record<string, unknown>;
    nodes.push(node.type === 'text' ? { type: 'text' } : { ...rest, ...(['code', 'inlineCode', 'html'].includes(node.type) ? { value } : {}) });
  });
  return nodes;
}

describe('Markdown translation', () => {
  it.each([
    ['shortcut link', '[文档]', '[English label][文档]', 'linkReference'],
    ['collapsed link', '[文档][]', '[English label][文档]', 'linkReference'],
    ['shortcut image', '![文档]', '![English label][文档]', 'imageReference']
  ])('translates %s labels while preserving their reference binding', (_name, input, expected, kind) => {
    const document = collectMarkdownSegments(`${input}\n\n[文档]: https://example.com "固定标题"\n`);
    expect(document.segments.map(s => s.text)).toEqual(['文档']);
    const result = applyMarkdownTranslations(document, new Map([[document.segments[0].id, 'English label']]));
    expect(result).toContain(expected);
    const tree = unified().use(remarkParse).parse(result);
    const references: unknown[] = [];
    const definitions: unknown[] = [];
    visit(tree, node => {
      if (node.type === kind) references.push(node);
      if (node.type === 'definition') definitions.push(node);
    });
    expect(references).toEqual([expect.objectContaining({ type: kind, identifier: '文档', label: '文档' })]);
    expect(definitions).toEqual([expect.objectContaining({ identifier: '文档', label: '文档', url: 'https://example.com', title: '固定标题' })]);
  });

  it.each(['identifier', 'label', 'definition identifier', 'destination', 'definition title'])('still rejects changed %s for shortcut references', property => {
    const document = collectMarkdownSegments('[文档]\n\n[文档]: https://example.com "固定标题"\n');
    const translations = new Map([[document.segments[0].id, 'English label']]);
    visit(document.tree, node => {
      if (node.type === 'linkReference' && property === 'identifier') node.identifier = 'changed';
      if (node.type === 'linkReference' && property === 'label') node.label = 'changed';
      if (node.type === 'definition' && property === 'definition identifier') node.identifier = 'changed';
      if (node.type === 'definition' && property === 'destination') node.url = 'https://changed.example.com';
      if (node.type === 'definition' && property === 'definition title') node.title = 'Changed title';
    });
    expect(() => applyMarkdownTranslations(document, translations)).toThrow(/protected/i);
  });

  it('preserves URL and email autolinks rather than collecting them as labels', () => {
    const source = '查看 <https://example.com> 和 <hello@example.com>。\n';
    const document = collectMarkdownSegments(source);
    expect(document.segments.map(s => s.text)).toEqual(['查看 ', ' 和 ', '。']);
    const translated = applyMarkdownTranslations(document, new Map(document.segments.map(s => [s.id, s.text])));
    expect(translated).toContain('<https://example.com>');
    expect(translated).toContain('<hello@example.com>');
  });
  it('preserves empty YAML frontmatter', () => {
    const source = '---\n---\n# 标题\n';
    const document = collectMarkdownSegments(source);
    expect(applyMarkdownTranslations(document, new Map(document.segments.map(s => [s.id, s.text])))).toBe(source);
  });
  it('copies YAML frontmatter byte-for-byte without collecting its strings', () => {
    const yaml = '---\ntitle: 原始标题\ntags: [React]\n---\n';
    const document = collectMarkdownSegments(yaml + '# 正文\n');
    expect(document.segments.map(s => s.text)).toEqual(['正文']);
    expect(applyMarkdownTranslations(document, new Map([[document.segments[0].id, 'Body']]))).toBe(yaml + '# Body\n');
  });
  it('collects readable text and labels but never code, URLs, definitions or HTML', () => {
    const document = collectMarkdownSegments(markdown);
    const texts = document.segments.map(s => s.text);
    expect(texts).toEqual(expect.arrayContaining(['标题', '查看 ', '项目主页', ' 中的 ', '保留引用结构。', '架构图', '列表 ', '强调', '文档']));
    expect(texts.join('')).not.toMatch(/climate.open|ActionID|https:|architecture.webp|原始 HTML|固定标题/);
    expect(new Set(document.segments.map(s => s.id)).size).toBe(texts.length);
    expect(document.segments).toEqual(collectMarkdownSegments(markdown).segments);
  });

  it('round-trips structure and protected values even for Markdown-like translated text', () => {
    const document = collectMarkdownSegments(markdown);
    const translations = new Map(document.segments.map((s, i) => [s.id, i === 0 ? 'English title' : 'Text * [literal] `code`']));
    const result = applyMarkdownTranslations(document, translations);
    expect(result).toContain('# English title');
    expect(structure(result)).toEqual(structure(markdown));
    expect(result).toContain("const actionId = 'climate.open';");
    expect(result).toContain('https://example.com?q=中文');
    expect(result).toContain('/uploads/architecture.webp');
    expect(document.segments[0].text).toBe('标题');
  });

  it('rejects incomplete, extra and blank results and tampered protected nodes', () => {
    const document = collectMarkdownSegments(markdown);
    const translations = new Map(document.segments.map(s => [s.id, s.text]));
    translations.delete(document.segments[0].id);
    expect(() => applyMarkdownTranslations(document, translations)).toThrow(/missing/i);
    translations.set(document.segments[0].id, 'Title');
    translations.set('unknown', 'extra');
    expect(() => applyMarkdownTranslations(document, translations)).toThrow(/extra/i);
    translations.delete('unknown');
    translations.set(document.segments[0].id, ' ');
    expect(() => applyMarkdownTranslations(document, translations)).toThrow(/blank/i);
    translations.set(document.segments[0].id, 'Title');
    visit(document.tree, 'inlineCode', node => { node.value = 'changed'; });
    expect(() => applyMarkdownTranslations(document, translations)).toThrow(/protected/i);
  });
});
