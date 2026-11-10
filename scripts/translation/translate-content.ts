import { readFile, rm } from 'node:fs/promises';
import { join, relative, resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDeepSeekTranslator } from './deepseek';
import { computeSourceHash, translationGlossary } from './hash';
import { assertParity, atomicWrite, exists, listContentPaths, mapSourcePath, parseContent, readContent } from './files';
import { validateTranslations, type Translator } from './types';

export interface TranslationResult { written: string[]; deleted: string[]; skipped: string[] }
export interface TranslationPolicy { policyVersion: number }

export async function translateChangedContent(options: {
  root: string; baselineRoot?: string; changedPaths: readonly string[]; translator?: Translator; policy?: TranslationPolicy; adoptExisting?: boolean;
}): Promise<TranslationResult> {
  const { root } = options;
  const policy = options.policy ?? translationGlossary;
  const result: TranslationResult = { written: [], deleted: [], skipped: [] };
  const writes: { sourcePath: string; destination: string; content: string }[] = [];
  const deletions: string[] = [];
  for (const sourcePath of [...new Set(options.changedPaths)].sort()) {
    const destination = await mapSourcePath(root, sourcePath);
    const targetPath = relative(root, destination);
    if (!await exists(join(root, sourcePath))) {
      if (options.adoptExisting) throw new Error(`Missing source: ${sourcePath}`);
      if (await exists(destination)) deletions.push(destination);
      continue;
    }
    const source = await readContent(root, sourcePath);
    const stamp = { sourceHash: computeSourceHash(source.value, policy.policyVersion), policyVersion: policy.policyVersion };
    const target = await exists(destination) ? parseContent(targetPath, await readFile(destination, 'utf8')) : undefined;
    if (!options.adoptExisting && target?.metadata?.sourceHash === stamp.sourceHash && target.metadata.policyVersion === stamp.policyVersion) {
      assertParity(sourcePath, source, target);
      result.skipped.push(targetPath);
      continue;
    }
    let content: string;
    if (options.adoptExisting) {
      if (!target) throw new Error(`Missing English counterpart: ${targetPath}`);
      assertParity(sourcePath, source, target);
      // Preserve the existing English prose, including Markdown presentation.
      content = target.adopt(stamp);
    } else {
      const reused = new Map<string, string>();
      if (options.baselineRoot) {
        const baselineDestination = await mapSourcePath(options.baselineRoot, sourcePath);
        const baselineSourceExists = await exists(join(options.baselineRoot, sourcePath));
        const baselineTargetExists = await exists(baselineDestination);
        if (baselineSourceExists !== baselineTargetExists) throw new Error(`Baseline source/translation pair is incomplete: ${sourcePath}`);
        if (baselineSourceExists) {
          const baselineSource = await readContent(options.baselineRoot, sourcePath);
          const baselineTargetPath = relative(options.baselineRoot, baselineDestination);
          const baselineTarget = await readContent(options.baselineRoot, baselineTargetPath);
          const baselineHash = computeSourceHash(baselineSource.value, policy.policyVersion);
          if (baselineTarget.metadata?.sourceHash !== baselineHash || baselineTarget.metadata.policyVersion !== policy.policyVersion) {
            throw new Error(`Baseline translation is stale: ${baselineTargetPath}`);
          }
          const baselineTranslations = assertParity(sourcePath, baselineSource, baselineTarget);
          const baselineSegments = new Map(baselineSource.segments.map(segment => [segment.id, segment.text]));
          for (const segment of source.segments) {
            if (baselineSegments.get(segment.id) === segment.text) reused.set(segment.id, baselineTranslations.get(segment.id)!);
          }
        }
      }
      const changedSegments = source.segments.filter(segment => !reused.has(segment.id));
      const translated = changedSegments.length
        ? await (options.translator ?? createDeepSeekTranslator({ apiKey: process.env.DEEPSEEK_API_KEY ?? '' })).translate(changedSegments)
        : new Map<string, string>();
      validateTranslations(changedSegments, translated);
      const translations = new Map([...reused, ...translated]);
      validateTranslations(source.segments, translations);
      content = source.render(translations, stamp);
    }
    assertParity(sourcePath, source, parseContent(sourcePath, content));
    writes.push({ sourcePath, destination, content });
  }
  // No existing file changes until every requested translation has passed validation.
  for (const write of writes) {
    await mapSourcePath(root, write.sourcePath);
    await atomicWrite(write.destination, write.content, async temporary => { parseContent(write.sourcePath, await readFile(temporary, 'utf8')); });
    result.written.push(relative(root, write.destination));
  }
  for (const destination of deletions) {
    await mapSourcePath(root, relative(root, destination).replace('content/en/', 'content/zh/'));
    await rm(destination);
    result.deleted.push(relative(root, destination));
  }
  return result;
}

export function parseCliArgs(args: string[], allowSourceOnly = false) {
  let root = process.cwd();
  let baselineRoot: string | undefined;
  let all = false;
  let adoptExisting = false;
  let sourceOnly = false;
  const changedPaths: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--all') all = true;
    else if (argument === '--adopt-existing') adoptExisting = true;
    else if (argument === '--source-only' && allowSourceOnly) sourceOnly = true;
    else if (argument === '--root' || argument === '--baseline-root' || argument === '--changed-file') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
      if (argument === '--root') { if (!isAbsolute(value)) throw new Error('--root must be absolute'); root = resolve(value); }
      else if (argument === '--baseline-root') { if (!isAbsolute(value)) throw new Error('--baseline-root must be absolute'); baselineRoot = resolve(value); }
      else changedPaths.push(value);
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (all && changedPaths.length) throw new Error('--all and --changed-file are mutually exclusive');
  if (baselineRoot && (all || !changedPaths.length)) throw new Error('--baseline-root requires --changed-file');
  if (adoptExisting && !all) throw new Error('--adopt-existing requires --all');
  if (adoptExisting && baselineRoot) throw new Error('--adopt-existing and --baseline-root are mutually exclusive');
  return { root, baselineRoot, all, adoptExisting, sourceOnly, changedPaths };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (!args.all && !args.changedPaths.length) throw new Error('Specify --all or --changed-file <path>');
  const changedPaths = args.all ? await listContentPaths(args.root, 'zh') : args.changedPaths;
  console.log(JSON.stringify(await translateChangedContent({ ...args, changedPaths }), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error instanceof Error ? error.message : 'Translation failed'); process.exitCode = 1; });
