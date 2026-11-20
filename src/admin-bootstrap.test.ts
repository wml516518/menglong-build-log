// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

interface DraftDiff {
  path: string;
  id: string;
  newFile?: boolean;
}

const createCms = (diffs: DraftDiff[]) => {
  const draft = { collection: 'site', slug: 'site', status: 'draft', diffs };
  class TurboBackend {
    static preloadConfig = async (config: unknown) => config;
    async unpublishedEntry() { return draft; }
    async unpublishedEntryDataFile(_collection: string, _slug: string, path: string) {
      return path.startsWith('content/zh/') ? '中文源内容' : 'Generated English';
    }
  }
  const turbo = {
    BackendClass: TurboBackend,
    init: (...args: unknown[]) => new TurboBackend(...args)
  };
  const backends = new Map<string, typeof turbo>([
    ['turbo-github', turbo]
  ]);
  let initArgs: unknown[] | undefined;
  let registeredName: string | undefined;
  const CMS = {
    getBackend: (name: string) => backends.get(name),
    registerBackend: (name: string, BackendClass: typeof TurboBackend) => {
      registeredName = name;
      backends.set(name, { BackendClass, init: (...args) => new BackendClass(...args) });
    },
    init: (...args: unknown[]) => { initArgs = args; }
  };
  runInNewContext(readFileSync('public/admin/bootstrap.js', 'utf8'), { CMS, window: { CMS } });
  const Backend = turbo.BackendClass;
  return {
    backend: new Backend(), Backend, TurboBackend, draft, turbo,
    get initArgs() { return initArgs; },
    get registeredName() { return registeredName; }
  };
};

describe('Chinese CMS draft loading', () => {
  it.each(['site.yml', 'resume.yml', 'posts/example.md'])(
    'loads the Chinese source when generated English is first in the %s draft',
    async (file) => {
      const { backend, draft } = createCms([
        { path: `content/en/${file}`, id: 'translated' },
        { path: `content/zh/${file}`, id: 'source', newFile: true }
      ]);

      const entry = await backend.unpublishedEntry();
      expect(entry.diffs).toEqual([
        { path: `content/zh/${file}`, id: 'source', newFile: true }
      ]);
      expect(await backend.unpublishedEntryDataFile('site', 'site', entry.diffs[0].path))
        .toBe('中文源内容');
      expect(draft.diffs).toHaveLength(2);
    }
  );

  it('retains uploaded assets and workflow metadata with the Chinese draft', async () => {
    const { backend } = createCms([
      { path: 'content/en/site.yml', id: 'translated' },
      { path: 'content/zh/site.yml', id: 'source' },
      { path: 'public/uploads/portrait.png', id: 'portrait' }
    ]);

    expect(await backend.unpublishedEntry()).toEqual({
      collection: 'site', slug: 'site', status: 'draft',
      diffs: [
        { path: 'content/zh/site.yml', id: 'source' },
        { path: 'public/uploads/portrait.png', id: 'portrait' }
      ]
    });
  });

  it('leaves no generated candidates when only English changed, allowing the source fallback', async () => {
    const { backend } = createCms([{ path: 'content/en/site.yml', id: 'translated' }]);
    expect((await backend.unpublishedEntry()).diffs).toEqual([]);
  });

  it('replaces the existing backend without bypassing config.yml loading', () => {
    const cms = createCms([]);

    expect(cms.Backend).not.toBe(cms.TurboBackend);
    expect(cms.Backend.prototype instanceof cms.TurboBackend).toBe(true);
    expect(cms.turbo.BackendClass).toBe(cms.Backend);
    expect(cms.initArgs).toEqual([]);
    expect(cms.registeredName).toBeUndefined();
  });
});
