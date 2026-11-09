import { applyRouteMetadata, getRouteMetadata } from './metadata';
import type { Route } from './routes';

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
    expect(getRouteMetadata(route)).toEqual({ title, description: portfolioDescription, themeColor: '#f6f4ef' });
  });

  it('uses the Chinese interactive timeline metadata for History Galaxy', () => {
    expect(getRouteMetadata({ view: 'history-galaxy' })).toEqual({
      title: '历史星河｜中国历史3D交互时间轴', description: historyDescription, themeColor: '#05070a',
    });
  });

  it('updates existing metadata and restores portfolio metadata on return', () => {
    applyRouteMetadata({ view: 'history-galaxy' });
    expect(document.title).toBe('历史星河｜中国历史3D交互时间轴');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', historyDescription);
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#05070a');
    applyRouteMetadata({ view: 'home' });
    expect(document.title).toBe('MengLong Wang | Portfolio + Build Log');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', portfolioDescription);
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#f6f4ef');
  });

  it('does not create missing meta nodes', () => {
    document.head.innerHTML = '';
    applyRouteMetadata({ view: 'history-galaxy' });
    expect(document.title).toBe('历史星河｜中国历史3D交互时间轴');
    expect(document.querySelectorAll('meta')).toHaveLength(0);
  });
});
