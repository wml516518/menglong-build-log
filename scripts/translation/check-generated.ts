import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertParity, exists, listContentPaths, mapSourcePath, readContent } from './files';
import { computeSourceHash, translationGlossary } from './hash';
import { parseCliArgs, type TranslationPolicy } from './translate-content';

export async function checkGeneratedContent(options: { root: string; sourceOnly?: boolean; policy?: TranslationPolicy }) {
  const policy = options.policy ?? translationGlossary;
  const result = { missing: [] as string[], stale: [] as string[], extra: [] as string[], valid: [] as string[] };
  const sources = await listContentPaths(options.root, 'zh');
  const expected = new Set<string>();
  const slugs = new Set<string>();
  for (const sourcePath of sources) {
    const destination = await mapSourcePath(options.root, sourcePath);
    const targetPath = relative(options.root, destination);
    expected.add(targetPath);
    const source = await readContent(options.root, sourcePath);
    if (sourcePath.endsWith('.md')) {
      const slug = (source.value as { frontmatter: { slug: string } }).frontmatter.slug;
      if (slugs.has(slug)) throw new Error(`Duplicate source post slug: ${slug}`);
      slugs.add(slug);
    }
    if (options.sourceOnly) continue;
    if (!await exists(destination)) { result.missing.push(targetPath); continue; }
    try {
      const target = await readContent(options.root, targetPath);
      assertParity(sourcePath, source, target);
      if (target.metadata?.sourceHash !== computeSourceHash(source.value, policy.policyVersion) || target.metadata.policyVersion !== policy.policyVersion) result.stale.push(targetPath);
      else result.valid.push(targetPath);
    } catch { result.stale.push(targetPath); }
  }
  if (!options.sourceOnly) for (const path of await listContentPaths(options.root, 'en')) if (!expected.has(path)) result.extra.push(path);
  return result;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2), true);
  if (args.all || args.adoptExisting || args.changedPaths.length) throw new Error('Checker accepts only --root and --source-only');
  const result = await checkGeneratedContent(args);
  console.log(JSON.stringify(result, null, 2));
  if (result.missing.length || result.stale.length || result.extra.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error instanceof Error ? error.message : 'Content check failed'); process.exitCode = 1; });
