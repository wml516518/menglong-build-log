import type { Route } from './routes';

const portfolioDescription = "MengLong Wang's personal homepage, project portfolio, and public build log.";
const historyDescription = '历史星河是一条从唐朝延伸至1949年的3D交互式中国历史时间轴，可自由航行、拖拽事件星点并探索人物故事。';

type RouteMetadata = { title: string; description: string; themeColor: string };

export function getRouteMetadata(route: Route): RouteMetadata {
  switch (route.view) {
    case 'history-galaxy':
      return { title: '历史星河｜中国历史3D交互时间轴', description: historyDescription, themeColor: '#05070a' };
    case 'posts':
    case 'post':
      return { title: 'Build Log | MengLong Wang', description: portfolioDescription, themeColor: '#f6f4ef' };
    case 'home':
      return { title: 'MengLong Wang | Portfolio + Build Log', description: portfolioDescription, themeColor: '#f6f4ef' };
    default: {
      const exhaustive: never = route;
      return exhaustive;
    }
  }
}

export function applyRouteMetadata(route: Route): void {
  const metadata = getRouteMetadata(route);
  document.title = metadata.title;
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', metadata.description);
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', metadata.themeColor);
}
