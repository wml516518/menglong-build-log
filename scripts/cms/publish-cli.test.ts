// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';
const roots: string[] = [];
const isMergeCall = (call: { name: string; args: string[] }) => call.name === 'gh' && (
  (call.args[0] === 'pr' && call.args[1] === 'merge') ||
  (call.args[0] === 'api' && call.args.some((arg, index) => (arg === '--method' || arg === '-X') && call.args[index + 1] === 'PUT') && call.args.some(arg => /^\/?repos\/[^/]+\/[^/]+\/pulls\/\d+\/merge$/.test(arg)))
);
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
it.each([
  ['gh', ['api', '--method', 'PUT', 'repos/owner/repo/pulls/12/merge'], true],
  ['gh', ['api', '/repos/owner/repo/pulls/12/merge', '-X', 'PUT'], true],
  ['gh', ['pr', 'merge', '12', '--auto'], true],
  ['gh', ['api', '--method', 'GET', 'repos/owner/repo/pulls/12/merge'], false],
  ['gh', ['api', '--method', 'PUT', 'repos/owner/repo/pulls/12'], false],
  ['git', ['commit', '-m', 'merge'], false],
] as const)('recognizes merge calls: %s %j', (name, args, expected) => {
  expect(isMergeCall({ name, args: [...args] })).toBe(expected);
});
function fixture(changed: string, conclusion = 'success', moved = false, mergeResult: boolean | number = true) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'cms-cli-'))); roots.push(root);
  const trusted = join(root, 'trusted'); const bin = join(root, 'bin');
  mkdirSync(join(trusted, 'node_modules/.bin'), { recursive: true }); mkdirSync(bin);
  const sha = 'a'.repeat(40); const repo = 'wml516518/menglong-build-log';
  writeFileSync(join(root, 'cms-state.json'), JSON.stringify({ identity: { repo, pr: 12, sha }, input: { baseRepo: repo, headRepo: repo, headRef: 'cms/a', author: 'wml516518', changedPaths: ['content/zh/site.yml'] }, scope: { sourcePaths: ['content/zh/site.yml'], generatedPaths: [], mediaPaths: [] }, conclusion }));
  const program = `#!${process.execPath}\nconst fs=require('fs'); const a=process.argv.slice(2); const name=require('path').basename(process.argv[1]); fs.appendFileSync(process.env.LOG,JSON.stringify({name,args:a,cwd:process.cwd()})+'\\n'); if(name==='git'){if(a.includes('rev-parse'))process.stdout.write('${sha}');if(a.includes('status'))process.stdout.write(${JSON.stringify(changed)});} if(name==='gh'&&a[0]==='api')process.stdout.write(${JSON.stringify(JSON.stringify({ state: 'open', head: { sha: moved ? 'b'.repeat(40) : sha, ref: 'cms/a', repo: { full_name: repo } } }))});`;
  const mergeStub = `if(name==='gh'&&a.includes('PUT')){ ${typeof mergeResult === 'number' ? `process.stderr.write('HTTP ${mergeResult}: merge refused');process.exit(1);` : `process.stdout.write(JSON.stringify({merged:${mergeResult}}));process.exit(0);`} }`;
  const finalProgram = program.replace("if(name==='git')", mergeStub + "if(name==='git')");
  for (const file of [join(bin, 'git'), join(bin, 'gh'), join(trusted, 'node_modules/.bin/tsx')]) writeFileSync(file, finalProgram, { mode: 0o755 });
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
  expect(clis[0].args.slice(3)).toEqual(['--root', join(f.root, 'cms-data'), '--baseline-root', f.trusted, '--changed-file', 'content/zh/site.yml']);
  expect(calls.find(c => c.args.includes('add'))?.args.slice(-4)).toEqual(['add', '--all', '--', 'content/en']);
  expect(calls.find(c => c.args.includes('push'))?.args.slice(-1)).toEqual(['HEAD:refs/heads/cms/a']);
  expect(calls.some(isMergeCall)).toBe(false);
  expect(JSON.parse(readFileSync(join(f.root, 'provenance.json'), 'utf8'))).toEqual({ repo: 'wml516518/menglong-build-log', pr: 12, sha: f.sha });
});
it('immediately merges unchanged green output with an atomic exact SHA condition and no persistent authorization', () => {
  const f = fixture(''); f.execute();
  expect(f.calls().find(isMergeCall)?.args).toEqual(['api', '--method', 'PUT', 'repos/wml516518/menglong-build-log/pulls/12/merge', '-f', `sha=${f.sha}`, '-f', 'merge_method=squash']);
  expect(f.calls().some(c => c.args.includes('--auto'))).toBe(false);
});
it.each([false, 409, 405])('fails when merge boundary rejects the exact SHA or protections (%s)', result => {
  const f = fixture('', 'success', false, result); expect(f.execute).toThrow();
  expect(f.calls().filter(isMergeCall)).toHaveLength(1);
  expect(f.calls().some(c => c.args.includes('--auto'))).toBe(false);
  expect(readFileSync(join(f.root, 'outputs'), 'utf8')).toBe('');
});
it.each([[' M src/evil.ts\0', 'success', false], ['', 'failure', false], [' M content/en/site.yml\0', 'success', true]])('fails closed without a push or merge (%s, %s, moved=%s)', (changed, conclusion, moved) => {
  const f = fixture(changed, conclusion, moved); expect(f.execute).toThrow();
  expect(f.calls().some(c => c.args.includes('push') || isMergeCall(c))).toBe(false);
});
it.each(['wrong-payload', 'untrusted-run', 'valid'])('checks real prepare flow artifact provenance before producing guarded state: %s', variant => {
  const f = fixture(''); rmSync(join(f.root, 'cms-state.json'));
  const repo = 'wml516518/menglong-build-log';
  const pr = { number: 12, state: 'open', head: { ref: 'cms/a', sha: f.sha, repo: { full_name: repo } }, base: { ref: 'main', sha: 'b'.repeat(40), repo: { full_name: repo } }, user: { login: 'wml516518' } };
  const event = { repository: { full_name: repo, default_branch: 'main' }, workflow_run: { event: 'pull_request', head_branch: 'cms/a', head_sha: f.sha, head_repository: { full_name: repo }, conclusion: 'success' } };
  writeFileSync(join(f.root, 'event.json'), JSON.stringify(event));
  const payloadDir = join(f.root, 'payload'); mkdirSync(payloadDir);
  writeFileSync(join(payloadDir, 'provenance.json'), JSON.stringify({ repo, pr: variant === 'wrong-payload' ? 13 : 12, sha: f.sha }));
  execFileSync('zip', ['-q', join(f.root, 'proof.zip'), 'provenance.json'], { cwd: payloadDir });
  const responses: Record<string, unknown> = {
    [`repos/${repo}/pulls?state=open&per_page=100`]: [[pr]],
    [`repos/${repo}/compare/${pr.base.sha}...${f.sha}`]: { files: [{ filename: 'content/en/site.yml' }] },
    [`repos/${repo}/git/trees/${f.sha}?recursive=1`]: { truncated: false, tree: [{ path: 'content/zh/site.yml', mode: '100644' }] },
    [`repos/${repo}/actions/workflows/cms-publish.yml`]: { id: 7 },
    [`repos/${repo}/actions/artifacts?name=cms-generated-${f.sha}&per_page=100`]: { artifacts: [{ id: 9, name: `cms-generated-${f.sha}`, expired: false, workflow_run: { id: 8 } }] },
    [`repos/${repo}/actions/runs/8`]: { workflow_id: variant === 'untrusted-run' ? 99 : 7, event: 'workflow_run', conclusion: 'success', repository: { full_name: repo } },
  };
  const program = `#!${process.execPath}\nconst fs=require('fs');const a=process.argv.slice(2);fs.appendFileSync(process.env.LOG,JSON.stringify({name:'gh',args:a})+'\\n');const endpoint=a.at(-1);const responses=${JSON.stringify(responses)};if(endpoint.endsWith('/zip'))process.stdout.write(fs.readFileSync(${JSON.stringify(join(f.root, 'proof.zip'))}));else if(endpoint in responses)process.stdout.write(JSON.stringify(responses[endpoint]));else process.exit(1);`;
  writeFileSync(join(f.root, 'bin/gh'), program, { mode: 0o755 });
  const prepare = () => execFileSync(process.execPath, ['--import', resolve('node_modules/tsx/dist/loader.mjs'), resolve('scripts/cms/publish.ts'), 'prepare'], { cwd: f.trusted, encoding: 'utf8', env: { ...process.env, PATH: `${join(f.root, 'bin')}:${process.env.PATH}`, RUNNER_TEMP: f.root, GITHUB_EVENT_PATH: join(f.root, 'event.json'), GITHUB_OUTPUT: join(f.root, 'outputs'), CMS_PR: '12', LOG: join(f.root, 'log') }, stdio: 'pipe' });
  if (variant === 'valid') {
    prepare(); expect(JSON.parse(readFileSync(join(f.root, 'cms-state.json'), 'utf8')).input.generatedRecheck).toBe(true);
  } else {
    expect(prepare).toThrow(); expect(existsSync(join(f.root, 'cms-state.json'))).toBe(false);
    expect(readFileSync(join(f.root, 'outputs'), 'utf8')).toBe('');
    expect(f.calls().some(isMergeCall)).toBe(false);
  }
  if (variant === 'untrusted-run') expect(f.calls().some(c => c.args.some(a => a.endsWith('/zip')))).toBe(false);
});
