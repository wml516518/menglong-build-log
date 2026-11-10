import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CMS_REPOSITORY, validateCmsPullRequest, type ScopeInput } from './validate-scope';

interface Identity { repo: string; pr: number; sha: string }
interface Run { workflow_id: number; event: string; conclusion: string; repository: { full_name: string } }
interface Pull { number: number; state: string; mergeable_state?: string; head: { ref: string; sha: string; repo: { full_name: string } }; base: { repo: { full_name: string }; ref: string; sha: string }; user: { login: string } }
interface Commit { sha: string; parents: { sha: string }[] }
interface Comparison { ahead_by: number; merge_base_commit: { sha: string } }
interface ChangedFile { filename: string; previous_filename?: string }
export function collectChangedPaths(files: ChangedFile[] | undefined) {
  // Compare responses cap their file list at 300; never trust a capped diff.
  if (!files || files.length >= 300) throw new Error('CMS comparison file list is missing or may be truncated');
  return files.flatMap(f => f.previous_filename ? [f.filename, f.previous_filename] : [f.filename]);
}
export function selectPullRequest<T extends Pick<Pull, 'state' | 'head'>>(pulls: T[], branch: string, sha: string, repo: string): T | undefined {
  const matching = pulls.filter(p => p.state === 'open' && p.head.ref === branch && p.head.sha === sha && p.head.repo?.full_name === repo);
  return matching.length === 1 ? matching[0] : undefined;
}
export function verifyProvenance(expected: Identity, payload: Identity, run: Run, workflowId: number) {
  return run.workflow_id === workflowId && run.event === 'workflow_run' && run.conclusion === 'success' && run.repository.full_name === expected.repo && payload.repo === expected.repo && payload.pr === expected.pr && payload.sha === expected.sha;
}
export function decidePublication(changed: boolean, conclusion: string) {
  if (changed) return 'push';
  if (conclusion === 'success') return 'merge';
  throw new Error('Generated content is current but CI did not succeed; PR remains open');
}
export function verifyBaseUpdate(oldHead: string, baseHead: string, commit: Commit) {
  if (!/^[a-f0-9]{40}$/.test(commit.sha) || commit.sha === oldHead || commit.parents.length !== 2) throw new Error('Invalid CMS base-update commit');
  const parents = new Set(commit.parents.map(parent => parent.sha));
  if (parents.size !== 2 || !parents.has(oldHead) || !parents.has(baseHead)) throw new Error('CMS base update has unexpected parents');
  return commit.sha;
}
export function needsBaseUpdate(baseHead: string, comparison: Comparison) {
  if (!Number.isSafeInteger(comparison.ahead_by) || comparison.ahead_by < 0 || !/^[a-f0-9]{40}$/.test(comparison.merge_base_commit.sha)) throw new Error('Invalid CMS base comparison');
  if (comparison.ahead_by === 0 && comparison.merge_base_commit.sha !== baseHead) throw new Error('Inconsistent CMS base comparison');
  return comparison.ahead_by > 0;
}
const command = (exe: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) => execFileSync(exe, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options });
const api = <T>(endpoint: string): T => JSON.parse(command('gh', ['api', endpoint]));
const putApi = <T>(endpoint: string, fields: string[]): T => JSON.parse(command('gh', ['api', '--method', 'PUT', endpoint, ...fields.flatMap(field => ['-f', field])]));
const pages = <T>(endpoint: string): T[] => JSON.parse(command('gh', ['api', '--paginate', '--slurp', endpoint])).flat();
const output = (name: string, value: string | number | boolean) => appendFileSync(process.env.GITHUB_OUTPUT!, `${name}=${value}\n`);
const statePath = () => join(process.env.RUNNER_TEMP!, 'cms-state.json');
interface State { identity: Identity; input: ScopeInput; scope: ReturnType<typeof validateCmsPullRequest>; conclusion: string; baseRef: string; baseSha: string }

async function hasProvenance(identity: Identity) {
  const workflow = api<{ id: number }>(`repos/${identity.repo}/actions/workflows/cms-publish.yml`);
  const listing = api<{ artifacts: { id: number; expired: boolean; workflow_run: { id: number }; name: string }[] }>(`repos/${identity.repo}/actions/artifacts?name=cms-generated-${identity.sha}&per_page=100`);
  for (const artifact of listing.artifacts) {
    if (artifact.expired || artifact.name !== `cms-generated-${identity.sha}`) continue;
    const run = api<Run>(`repos/${identity.repo}/actions/runs/${artifact.workflow_run.id}`);
    if (!verifyProvenance(identity, identity, run, workflow.id)) continue;
    const temp = mkdtempSync(join(tmpdir(), 'cms-provenance-'));
    try {
      const archive = execFileSync('gh', ['api', `repos/${identity.repo}/actions/artifacts/${artifact.id}/zip`], { maxBuffer: 1024 * 1024 });
      const file = join(temp, 'proof.zip'); writeFileSync(file, archive);
      // Read one fixed entry as JSON; never extract or execute an artifact.
      const payload = JSON.parse(command('unzip', ['-p', file, 'provenance.json']));
      if (verifyProvenance(identity, payload, run, workflow.id)) return true;
    } finally { rmSync(temp, { recursive: true, force: true }); }
  }
  return false;
}
async function prepare() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!, 'utf8'));
  const run = event.workflow_run;
  if (event.repository.full_name !== CMS_REPOSITORY || run.event !== 'pull_request' || !run.head_branch?.startsWith('cms/') || run.head_repository?.full_name !== CMS_REPOSITORY) throw new Error('Not a same-repository CMS PR run');
  const pulls = pages<Pull>(`repos/${CMS_REPOSITORY}/pulls?state=open&per_page=100`);
  const pr = selectPullRequest(pulls, run.head_branch, run.head_sha, CMS_REPOSITORY);
  if (!pr || String(pr.number) !== process.env.CMS_PR || pr.base.ref !== event.repository.default_branch || !/^[a-f0-9]{40}$/.test(pr.head.sha)) throw new Error('CMS PR changed or is ambiguous');
  const baseRef = api<{ object: { sha: string } }>(`repos/${CMS_REPOSITORY}/git/ref/heads/${encodeURIComponent(pr.base.ref)}`);
  if (!/^[a-f0-9]{40}$/.test(baseRef.object.sha)) throw new Error('Invalid base SHA');
  // Both endpoints are immutable: PR files pagination could race head changes.
  const comparison = api<{ files?: ChangedFile[] }>(`repos/${CMS_REPOSITORY}/compare/${baseRef.object.sha}...${pr.head.sha}`);
  const tree = api<{ truncated: boolean; tree: { path: string; mode: string }[] }>(`repos/${CMS_REPOSITORY}/git/trees/${pr.head.sha}?recursive=1`);
  if (tree.truncated) throw new Error('CMS tree is truncated');
  const identity = { repo: CMS_REPOSITORY, pr: pr.number, sha: pr.head.sha };
  const changedPaths = collectChangedPaths(comparison.files);
  const generatedRecheck = changedPaths.some(p => p.startsWith('content/en/')) ? await hasProvenance(identity) : false;
  const input = { baseRepo: pr.base.repo.full_name, headRepo: pr.head.repo.full_name, headRef: pr.head.ref, author: pr.user.login, changedPaths, generatedRecheck, tree: tree.tree };
  const scope = validateCmsPullRequest(input);
  writeFileSync(statePath(), JSON.stringify({ identity, input, scope, conclusion: run.conclusion, baseRef: pr.base.ref, baseSha: baseRef.object.sha } satisfies State));
  output('sha', identity.sha);
}
async function publish() {
  const state = JSON.parse(readFileSync(statePath(), 'utf8')) as State;
  const root = resolve(process.env.GITHUB_WORKSPACE!, 'cms-data');
  // Disable hooks/fsmonitor even for trusted Git operations on the data checkout.
  const gitArgs = ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-C', root];
  const git = (...args: string[]) => command('git', [...gitArgs, ...args]);
  if (git('rev-parse', 'HEAD').trim() !== state.identity.sha) throw new Error('Checkout does not match guarded head');
  validateCmsPullRequest(state.input);
  const tsx = resolve('node_modules/.bin/tsx');
  const cli = (script: string, args: string[]) => command(tsx, ['--tsconfig', resolve('tsconfig.json'), resolve('scripts/translation', script), '--root', root, ...args]);
  if (state.scope.sourcePaths.length) cli('translate-content.ts', ['--baseline-root', resolve('.'), ...state.scope.sourcePaths.flatMap(p => ['--changed-file', p])]);
  cli('check-generated.ts', []);
  // Only generated English can be staged. Refuse any other translator side effect.
  const modified = git('status', '--porcelain=v1', '-z').split('\0').filter(Boolean);
  if (modified.some(line => !line.slice(3).startsWith('content/en/'))) throw new Error('Translation modified a path outside English content');
  const decision = decidePublication(modified.length > 0, state.conclusion);
  const current = api<Pull>(`repos/${state.identity.repo}/pulls/${state.identity.pr}`);
  if (current.state !== 'open' || current.head.sha !== state.identity.sha || current.head.ref !== state.input.headRef || current.head.repo.full_name !== state.identity.repo) throw new Error('PR head changed during publication');
  if (decision === 'push') {
    git('add', '--all', '--', 'content/en');
    git('-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', 'commit', '-m', 'chore: generate English CMS content');
    // Credential lives in the process environment, never checkout config or argv.
    const auth = Buffer.from(`x-access-token:${process.env.CMS_TRANSLATION_TOKEN}`).toString('base64');
    command('git', [...gitArgs, 'push', `https://github.com/${state.identity.repo}.git`, `HEAD:refs/heads/${state.input.headRef}`], { env: { ...process.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader', GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${auth}` } });
    const sha = git('rev-parse', 'HEAD').trim();
    writeFileSync(join(process.env.RUNNER_TEMP!, 'provenance.json'), JSON.stringify({ ...state.identity, sha }));
    output('sha', sha); output('changed', true);
  } else {
    const latestBase = api<{ object: { sha: string } }>(`repos/${state.identity.repo}/git/ref/heads/${encodeURIComponent(state.baseRef)}`).object.sha;
    if (latestBase !== state.baseSha) throw new Error('Base branch changed during publication; PR remains open');
    const comparison = api<Comparison>(`repos/${state.identity.repo}/compare/${state.identity.sha}...${state.baseSha}`);
    if (needsBaseUpdate(state.baseSha, comparison)) {
      putApi(`repos/${state.identity.repo}/pulls/${state.identity.pr}/update-branch`, [`expected_head_sha=${state.identity.sha}`]);
      let updated: Pull | undefined;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        updated = api<Pull>(`repos/${state.identity.repo}/pulls/${state.identity.pr}`);
        if (updated.head.sha !== state.identity.sha) break;
        await new Promise(resolveDelay => setTimeout(resolveDelay, 1_000));
      }
      if (!updated || updated.state !== 'open' || updated.head.sha === state.identity.sha || updated.head.ref !== state.input.headRef || updated.head.repo.full_name !== state.identity.repo || updated.base.ref !== state.baseRef) throw new Error('CMS base update did not produce the expected PR head');
      const sha = verifyBaseUpdate(state.identity.sha, state.baseSha, api<Commit>(`repos/${state.identity.repo}/git/commits/${updated.head.sha}`));
      const confirmed = api<Pull>(`repos/${state.identity.repo}/pulls/${state.identity.pr}`);
      if (confirmed.state !== 'open' || confirmed.head.sha !== sha || confirmed.head.ref !== state.input.headRef || confirmed.head.repo.full_name !== state.identity.repo) throw new Error('PR head changed after the guarded base update');
      writeFileSync(join(process.env.RUNNER_TEMP!, 'provenance.json'), JSON.stringify({ ...state.identity, sha }));
      output('sha', sha); output('changed', true);
      return;
    }
    // A one-shot expected-SHA merge cannot remain armed for a later, unproven head.
    const result = JSON.parse(command('gh', ['api', '--method', 'PUT', `repos/${state.identity.repo}/pulls/${state.identity.pr}/merge`, '-f', `sha=${state.identity.sha}`, '-f', 'merge_method=squash'])) as { merged?: boolean };
    if (result.merged !== true) throw new Error('Exact-head merge was refused; PR remains open without auto-merge authorization');
    output('changed', false);
  }
}
async function main() {
  if (process.argv[2] === 'prepare') await prepare();
  else if (process.argv[2] === 'publish') await publish();
  else throw new Error('Usage: publish.ts prepare|publish');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error instanceof Error ? error.message : 'CMS publication failed'); process.exitCode = 1; });
