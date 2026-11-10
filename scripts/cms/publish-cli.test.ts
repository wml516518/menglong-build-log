// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
function fixture(changed: string, conclusion = 'success', moved = false) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'cms-cli-'))); roots.push(root);
  const trusted = join(root, 'trusted'); const bin = join(root, 'bin');
  mkdirSync(join(trusted, 'node_modules/.bin'), { recursive: true }); mkdirSync(bin);
  const sha = 'a'.repeat(40); const repo = 'wml516518/menglong-build-log';
  writeFileSync(join(root, 'cms-state.json'), JSON.stringify({ identity: { repo, pr: 12, sha }, input: { baseRepo: repo, headRepo: repo, headRef: 'cms/a', author: 'wml516518', changedPaths: ['content/zh/site.yml'] }, scope: { sourcePaths: ['content/zh/site.yml'], generatedPaths: [], mediaPaths: [] }, conclusion }));
  const program = `#!${process.execPath}\nconst fs=require('fs'); const a=process.argv.slice(2); const name=require('path').basename(process.argv[1]); fs.appendFileSync(process.env.LOG,JSON.stringify({name,args:a,cwd:process.cwd()})+'\\n'); if(name==='git'){if(a.includes('rev-parse'))process.stdout.write('${sha}');if(a.includes('status'))process.stdout.write(${JSON.stringify(changed)});} if(name==='gh'&&a[0]==='api')process.stdout.write(${JSON.stringify(JSON.stringify({ state: 'open', head: { sha: moved ? 'b'.repeat(40) : sha, ref: 'cms/a', repo: { full_name: repo } } }))});`;
  for (const file of [join(bin, 'git'), join(bin, 'gh'), join(trusted, 'node_modules/.bin/tsx')]) writeFileSync(file, program, { mode: 0o755 });
  writeFileSync(join(root, 'outputs'), '');
  const execute = () => execFileSync(process.execPath, ['--import', resolve('node_modules/tsx/dist/loader.mjs'), resolve('scripts/cms/publish.ts'), 'publish'], { cwd: trusted, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: root, GITHUB_WORKSPACE: root, GITHUB_OUTPUT: join(root, 'outputs'), LOG: join(root, 'log'), CMS_TRANSLATION_TOKEN: 'test-token' }, stdio: 'pipe' });
  const calls = () => readFileSync(join(root, 'log'), 'utf8').trim().split('\n').map(s => JSON.parse(s) as { name: string; args: string[]; cwd: string });
  return { execute, calls, root, trusted, sha };
}
it('uses trusted absolute CLIs against data and stages/pushes only English', () => {
  const f = fixture(' M content/en/site.yml\0', 'failure'); f.execute();
  const calls = f.calls();
  for (const call of calls) expect(call.cwd).toBe(f.trusted);
  const clis = calls.filter(c => c.name === 'tsx');
  expect(clis.map(c => c.args.slice(0, 3))).toEqual(['translate-content.ts', 'check-generated.ts'].map(s => ['--tsconfig', join(f.trusted, 'tsconfig.json'), join(f.trusted, 'scripts/translation', s)]));
  expect(clis[0].args.slice(3)).toEqual(['--root', join(f.root, 'cms-data'), '--changed-file', 'content/zh/site.yml']);
  expect(calls.find(c => c.args.includes('add'))?.args.slice(-4)).toEqual(['add', '--all', '--', 'content/en']);
  expect(calls.find(c => c.args.includes('push'))?.args.slice(-1)).toEqual(['HEAD:refs/heads/cms/a']);
  expect(calls.some(c => c.args.includes('merge'))).toBe(false);
  expect(JSON.parse(readFileSync(join(f.root, 'provenance.json'), 'utf8'))).toEqual({ repo: 'wml516518/menglong-build-log', pr: 12, sha: f.sha });
});
it('auto-merges unchanged green output with an exact head condition', () => {
  const f = fixture(''); f.execute();
  expect(f.calls().find(c => c.args.includes('merge'))?.args).toEqual(['pr', 'merge', '12', '--repo', 'wml516518/menglong-build-log', '--auto', '--squash', '--match-head-commit', f.sha]);
});
it.each([[' M src/evil.ts\0', 'success', false], ['', 'failure', false], [' M content/en/site.yml\0', 'success', true]])('fails closed without a push or merge (%s, %s, moved=%s)', (changed, conclusion, moved) => {
  const f = fixture(changed, conclusion, moved); expect(f.execute).toThrow();
  expect(f.calls().some(c => c.args.includes('push') || c.args.includes('merge'))).toBe(false);
});
