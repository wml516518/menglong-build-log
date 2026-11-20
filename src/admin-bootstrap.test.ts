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
  const backends = new Map<string, { BackendClass: typeof TurboBackend }>([
    ['turbo-github', { BackendClass: TurboBackend }]
  ]);
  let initializedConfig: { backend: { name: string }; locale: string };
  const CMS = {
    getBackend: (name: string) => backends.get(name),
    registerBackend: (name: string, BackendClass: typeof TurboBackend) => {
      backends.set(name, { BackendClass });
    },
    init: ({ config }: { config: typeof initializedConfig }) => {
      initializedConfig = config;
    }
  };
  runInNewContext(readFileSync('public/admin/bootstrap.js', 'utf8'), { CMS, window: { CMS } });
  const Backend = backends.get(initializedConfig!.backend.name)!.BackendClass;
  return { backend: new Backend(), Backend, TurboBackend, draft, config: initializedConfig! };
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

  it('preserves Turbo configuration loading and initializes Chinese UI', () => {
    const { config, Backend, TurboBackend } = createCms([]);
    expect(Backend.preloadConfig).toBe(TurboBackend.preloadConfig);
    expect(config.locale).toBe('zh_Hans');
  });
});
