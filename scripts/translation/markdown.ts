import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { visit, SKIP } from 'unist-util-visit';
import type { Root, RootContent } from 'mdast';
import { validateTranslations, type TranslationSegment, type Translations } from './types';

export interface MarkdownTranslationDocument {
  tree: Root;
  segments: TranslationSegment[];
}

const processor = unified().use(remarkParse).use(remarkStringify);
const snapshots = new WeakMap<MarkdownTranslationDocument, { fingerprint: string; frontmatter: string }>();

function targets(tree: Root) {
  const result: { segment: TranslationSegment; node: RootContent; key: 'value' | 'alt' }[] = [];
  visit(tree, (node, _index, parent) => {
    if (['code', 'inlineCode', 'html', 'yaml', 'definition'].includes(node.type)) return SKIP;
    if (node.type === 'link' && node.children.length === 1 && node.children[0].type === 'text') {
      const label = node.children[0].value;
      if (label === node.url || `mailto:${label}` === node.url) return SKIP;
    }
    const key = node.type === 'text' ? 'value' : ['image', 'imageReference'].includes(node.type) ? 'alt' : undefined;
    if (!key) return;
    const text = (node as unknown as Record<string, unknown>)[key];
    if (typeof text !== 'string' || !text.trim()) return;
    const kind = key === 'alt' ? 'imageAlt' : parent?.type ?? 'text';
    result.push({ node: node as RootContent, key, segment: { id: `${kind}.${result.length}`, text, context: `Markdown ${kind}` } });
  });
  return result;
}

// Ignore source positions and approved copy, retain all other node attributes and order.
function fingerprint(tree: Root): string {
  const copy = structuredClone(tree);
  for (const { node, key } of targets(copy)) (node as unknown as Record<string, unknown>)[key] = '';
  return JSON.stringify(copy, (key, value) => key === 'position' ? undefined : value);
}

export function collectMarkdownSegments(markdown: string): MarkdownTranslationDocument {
  // remark-parse deliberately has no frontmatter extension. Isolate the initial
  // YAML block before parsing so no metadata can become prose segments.
  const frontmatter = markdown.match(/^(?:\uFEFF)?---[^\S\r\n]*\r?\n(?:[\s\S]*?\r?\n)?(?:---|\.\.\.)[^\S\r\n]*(?:\r?\n|$)/)?.[0] ?? '';
  const tree = processor.parse(markdown.slice(frontmatter.length));
  const document = { tree, segments: targets(tree).map(item => item.segment) };
  snapshots.set(document, { fingerprint: fingerprint(tree), frontmatter });
  return document;
}

export function applyMarkdownTranslations(document: MarkdownTranslationDocument, translations: Translations): string {
  const expected = snapshots.get(document);
  if (expected === undefined || fingerprint(document.tree) !== expected.fingerprint) throw new Error('Protected Markdown structure changed');
  const tree = structuredClone(document.tree);
  const entries = targets(tree);
  validateTranslations(entries.map(item => item.segment), translations);
  for (const { segment, node, key } of entries) (node as unknown as Record<string, unknown>)[key] = translations.get(segment.id)!;
  const markdown = processor.stringify(tree);
  if (fingerprint(processor.parse(markdown)) !== expected.fingerprint) throw new Error('Protected Markdown structure changed after restoration');
  return expected.frontmatter + markdown;
}
