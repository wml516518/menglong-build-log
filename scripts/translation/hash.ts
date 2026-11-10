import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

export const translationGlossary = yaml.load(readFileSync(new URL('../../config/translation-glossary.yml', import.meta.url), 'utf8')) as {
  policyVersion: number;
  protected: string[];
  preferred: Record<string, string>;
};

function normalize(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/\r\n?/g, '\n');
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => [key, normalize(entry)])
  );
  return value;
}

/** Pass parsed YAML or { frontmatter, body } for Markdown; presentation never enters the hash. */
export function computeSourceHash(source: unknown, policyVersion: number, glossary = translationGlossary): string {
  return createHash('sha256').update(JSON.stringify(normalize({ source, policyVersion, glossary }))).digest('hex');
}
