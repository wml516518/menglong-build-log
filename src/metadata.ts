import type { Route } from './routes';
import { content, type Language } from './content';

const historyDescription = '历史星河是一条从唐朝延伸至1949年的3D交互式中国历史时间轴，可自由航行、拖拽事件星点并探索人物故事。';

type RouteMetadata = { title: string; description: string; themeColor: string };

export function getRouteMetadata(route: Route, language: Language): RouteMetadata {
  const seo = content[language].seo;
  switch (route.view) {
    case 'history-event':
    case 'history-person':
    case 'history-theme':
    case 'history-galaxy':
      return { title: '历史星河｜中国历史3D交互时间轴', description: historyDescription, themeColor: '#05070a' };
    case 'posts':
    case 'post':
      return { title: seo.buildLogTitle, description: seo.description, themeColor: '#f6f4ef' };
    case 'home':
      return { title: seo.homeTitle, description: seo.description, themeColor: '#f6f4ef' };
    default: {
      const exhaustive: never = route;
      return exhaustive;
    }
  }
}

export function applyRouteMetadata(route: Route, language: Language): void {
  const metadata = getRouteMetadata(route, language);
  document.title = metadata.title;
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', metadata.description);
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', metadata.themeColor);
  const socialImage = route.view.startsWith('history-') ? '' : content[language].seo.socialImage;
  const existingImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
  if (socialImage) {
    const image = existingImage ?? document.createElement('meta');
    image.setAttribute('property', 'og:image');
    image.setAttribute('content', socialImage);
    if (!existingImage) document.head.appendChild(image);
  } else {
    existingImage?.remove();
  }
}
