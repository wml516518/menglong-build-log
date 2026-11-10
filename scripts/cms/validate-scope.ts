import { readFile } from 'node:fs/promises';
import { posix, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CMS_REPOSITORY = 'wml516518/menglong-build-log';
export interface ScopeInput {
  baseRepo: string; headRepo: string; headRef: string; author: string;
  changedPaths: string[];
  // Only the trusted caller may set this after verifying publisher provenance.
  generatedRecheck?: boolean;
  tree?: { path: string; mode: string }[];
}
export function validateCmsPullRequest(input: ScopeInput) {
  if (input.baseRepo !== CMS_REPOSITORY || input.headRepo !== input.baseRepo) throw new Error('CMS requires the configured same-repository PR');
  if (!/^cms\/[A-Za-z0-9_./-]+$/.test(input.headRef) || input.headRef.includes('..') || input.headRef.endsWith('/') || input.headRef.endsWith('.lock')) throw new Error('Invalid CMS branch');
  if (!['wml516518', 'decap-turbo[bot]'].includes(input.author)) throw new Error('Untrusted CMS author');
  if (!Array.isArray(input.changedPaths)) throw new Error('Missing changed paths');
  const result = { sourcePaths: [] as string[], generatedPaths: [] as string[], mediaPaths: [] as string[] };
  for (const entry of input.tree ?? []) {
    if (entry.mode === '120000' || entry.mode === '160000') throw new Error('Symlinks and submodules are forbidden in CMS data');
  }
  for (const path of [...new Set(input.changedPaths)].sort()) {
    if (typeof path !== 'string' || /[\\\x00-\x1f\x7f]/.test(path) || posix.isAbsolute(path) || posix.normalize(path) !== path || path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Non-normal CMS path');
    if (path.startsWith('content/zh/')) result.sourcePaths.push(path);
    else if (path.startsWith('public/uploads/')) result.mediaPaths.push(path);
    else if (path.startsWith('content/en/') && input.generatedRecheck) {
      const source = path.replace('content/en/', 'content/zh/');
      const sourceExists = input.tree?.some(e => e.path === source && e.mode === '100644');
      const pairedDeletion = input.tree && !input.tree.some(e => e.path === path || e.path === source) && input.changedPaths.includes(source);
      if (!sourceExists && !pairedDeletion) throw new Error('Generated path lacks Chinese source');
      result.generatedPaths.push(path);
    } else throw new Error(`Path outside CMS scope: ${path}`);
  }
  return result;
}
async function main() {
  const [eventFile, pathsFile] = process.argv.slice(2);
  if (!eventFile || !pathsFile) throw new Error('Usage: validate-scope.ts event.json paths.json');
  const input = JSON.parse(await readFile(eventFile, 'utf8')) as ScopeInput;
  console.log(JSON.stringify(validateCmsPullRequest({ ...input, changedPaths: JSON.parse(await readFile(pathsFile, 'utf8')) })));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error instanceof Error ? error.message : 'Scope validation failed'); process.exitCode = 1; });
