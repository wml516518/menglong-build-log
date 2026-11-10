import { describe, expect, it } from 'vitest';
import { validateCmsPullRequest } from './validate-scope';

const valid = { baseRepo: 'wml516518/menglong-build-log', headRepo: 'wml516518/menglong-build-log', headRef: 'cms/posts/portfolio-update', author: 'decap-turbo[bot]', changedPaths: ['content/zh/posts/portfolio-update.md'] };
describe('CMS scope boundary', () => {
  it.each(['wml516518', 'decap-turbo[bot]'])('allows %s and sorts/deduplicates data groups', author => {
    expect(validateCmsPullRequest({ ...valid, author, changedPaths: ['public/uploads/z.png', 'content/zh/profile.json', ...valid.changedPaths, 'public/uploads/z.png'] })).toEqual({ sourcePaths: ['content/zh/posts/portfolio-update.md', 'content/zh/profile.json'], generatedPaths: [], mediaPaths: ['public/uploads/z.png'] });
  });
  it.each([{ headRepo: 'attacker/fork' }, { baseRepo: 'other/repo' }, { headRef: 'feature/foo' }, { author: 'stranger' }, { headRef: 'cms/x\nINJECT=true' }])('rejects metadata %j', patch => expect(() => validateCmsPullRequest({ ...valid, ...patch })).toThrow());
  it.each(['.github/workflows/ci.yml', 'package.json', 'package-lock.json', 'public/admin/config.yml', 'scripts/translation/glossary.json', 'src/main.tsx', 'netlify.toml', '/content/zh/a.json', 'content/zh/../en/a.json', 'content//zh/a.json', './content/zh/a.json', 'content/zh/a/../../b', 'content/zh/a\\b.json', 'content/zh/a\nb.json', 'content/zh/', 'content/en/profile.json'])('rejects %s', path => expect(() => validateCmsPullRequest({ ...valid, changedPaths: [path] })).toThrow());
  it('rejects symlinks and submodules', () => {
    for (const mode of ['120000', '160000']) expect(() => validateCmsPullRequest({ ...valid, tree: [{ path: valid.changedPaths[0], mode }] })).toThrow();
  });
  it('requires an existing source counterpart for generated rechecks', () => {
    const input = { ...valid, changedPaths: ['content/en/profile.json'], generatedRecheck: true };
    expect(() => validateCmsPullRequest(input)).toThrow();
    expect(validateCmsPullRequest({ ...input, tree: [{ path: 'content/zh/profile.json', mode: '100644' }] }).generatedPaths).toEqual(['content/en/profile.json']);
  });
  it('allows paired source and English deletions', () => {
    expect(validateCmsPullRequest({ ...valid, generatedRecheck: true, changedPaths: ['content/zh/profile.json', 'content/en/profile.json'], tree: [] }).generatedPaths).toEqual(['content/en/profile.json']);
  });
});
