import { expect, it } from 'vitest';
import { collectChangedPaths, decidePublication, verifyProvenance, selectPullRequest } from './publish';
const identity = { repo: 'wml516518/menglong-build-log', pr: 12, sha: 'a'.repeat(40) };
const run = { workflow_id: 7, event: 'workflow_run', conclusion: 'success', repository: { full_name: identity.repo } };
it('includes both sides of renames and refuses capped or missing comparison files', () => {
  expect(collectChangedPaths([{ filename: 'content/zh/new.md', previous_filename: 'scripts/evil.ts' }])).toEqual(['content/zh/new.md', 'scripts/evil.ts']);
  expect(() => collectChangedPaths(undefined)).toThrow();
  expect(() => collectChangedPaths(Array.from({ length: 300 }, () => ({ filename: 'content/zh/a.md' })))).toThrow();
});
it('binds provenance to workflow, successful event, repo, PR and exact head', () => {
  expect(verifyProvenance(identity, identity, run, 7)).toBe(true);
  for (const patch of [{ sha: 'b'.repeat(40) }, { pr: 13 }, { repo: 'evil/fork' }]) expect(verifyProvenance(identity, { ...identity, ...patch }, run, 7)).toBe(false);
  for (const patch of [{ workflow_id: 8 }, { event: 'pull_request' }, { conclusion: 'failure' }, { repository: { full_name: 'evil/fork' } }]) expect(verifyProvenance(identity, identity, { ...run, ...patch }, 7)).toBe(false);
});
it('selects exactly one open PR matching the run head', () => {
  const pr = { number: 12, state: 'open', head: { ref: 'cms/a', sha: identity.sha, repo: { full_name: identity.repo } } };
  expect(selectPullRequest([pr], 'cms/a', identity.sha, identity.repo)).toEqual(pr);
  expect(selectPullRequest([pr, pr], 'cms/a', identity.sha, identity.repo)).toBeUndefined();
  expect(selectPullRequest([pr], 'cms/a', 'b'.repeat(40), identity.repo)).toBeUndefined();
  expect(selectPullRequest([{ ...pr, state: 'closed' }], 'cms/a', identity.sha, identity.repo)).toBeUndefined();
});
it('pushes generated updates, merges only green unchanged heads and fails otherwise', () => {
  expect(decidePublication(true, 'failure')).toBe('push');
  expect(decidePublication(false, 'success')).toBe('merge');
  expect(() => decidePublication(false, 'failure')).toThrow('CI');
  expect(() => decidePublication(false, 'cancelled')).toThrow('CI');
});
