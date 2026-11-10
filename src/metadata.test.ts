import { applyRouteMetadata, getRouteMetadata } from './metadata';
import type { Route } from './routes';
import { content } from './content';

const portfolioDescription = "MengLong Wang's personal homepage, project portfolio, and public build log.";
const historyDescription = '历史星河是一条从唐朝延伸至1949年的3D交互式中国历史时间轴，可自由航行、拖拽事件星点并探索人物故事。';

describe('route metadata', () => {
  let originalHead: string;

  beforeEach(() => {
    originalHead = document.head.innerHTML;
    document.head.innerHTML = '<meta name="description" content=""><meta name="theme-color" content="">';
  });

  afterEach(() => {
    document.head.innerHTML = originalHead;
  });

  it.each<[Route, string]>([
    [{ view: 'home' }, 'MengLong Wang | Portfolio + Build Log'],
    [{ view: 'posts' }, 'Build Log | MengLong Wang'],
    [{ view: 'post', slug: 'example' }, 'Build Log | MengLong Wang'],
  ])('uses portfolio metadata for %j', (route, title) => {
    expect(getRouteMetadata(route, 'en')).toEqual({ title, description: portfolioDescription, themeColor: '#f6f4ef' });
  });

  it('uses the Chinese interactive timeline metadata for History Galaxy', () => {
    expect(getRouteMetadata({ view: 'history-galaxy' }, 'zh')).toEqual({
      title: '历史星河｜中国历史3D交互时间轴', description: historyDescription, themeColor: '#05070a',
    });
  });

  it('updates existing metadata and restores portfolio metadata on return', () => {
    applyRouteMetadata({ view: 'history-galaxy' }, 'en');
    expect(document.title).toBe('历史星河｜中国历史3D交互时间轴');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', historyDescription);
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#05070a');
    applyRouteMetadata({ view: 'home' }, 'en');
    expect(document.title).toBe('MengLong Wang | Portfolio + Build Log');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', portfolioDescription);
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#f6f4ef');
  });

  it('does not create missing meta nodes', () => {
    document.head.innerHTML = '';
    applyRouteMetadata({ view: 'history-galaxy' }, 'zh');
    expect(document.title).toBe('历史星河｜中国历史3D交互时间轴');
    expect(document.querySelectorAll('meta')).toHaveLength(0);
  });

  it('uses localized CMS metadata for home, index, and article routes', () => {
    expect(getRouteMetadata({ view: 'home' }, 'zh').title).toBe('王梦龙 | 作品集 + 构建日志');
    expect(getRouteMetadata({ view: 'posts' }, 'zh').title).toBe('构建日志 | 王梦龙');
    expect(getRouteMetadata({ view: 'post', slug: 'example' }, 'zh').description)
      .toBe('王梦龙的个人主页、项目作品集与公开构建日志。');
  });

  it('adds a configured social image and removes it for empty or History Galaxy metadata', () => {
    const original = content.en.seo?.socialImage;
    try {
      content.en.seo.socialImage = '/social.png';
      applyRouteMetadata({ view: 'home' }, 'en');
      expect(document.querySelector('meta[property="og:image"]')).toHaveAttribute('content', '/social.png');
      applyRouteMetadata({ view: 'posts' }, 'en');
      expect(document.querySelectorAll('meta[property="og:image"]')).toHaveLength(1);
      applyRouteMetadata({ view: 'history-galaxy' }, 'en');
      expect(document.querySelector('meta[property="og:image"]')).not.toBeInTheDocument();
      applyRouteMetadata({ view: 'home' }, 'en');
      content.en.seo.socialImage = '';
      applyRouteMetadata({ view: 'home' }, 'en');
      expect(document.querySelector('meta[property="og:image"]')).not.toBeInTheDocument();
    } finally {
      if (content.en.seo) content.en.seo.socialImage = original;
    }
  });
});
