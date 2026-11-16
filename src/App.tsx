import { lazy, Suspense, useEffect, useState } from 'react';
import { isHistoryRoute, parseHash } from './routes';
import { legacyHistoryLocation } from './siteLocations';
import { PortfolioApp } from './PortfolioApp';

const PlaygroundApp = lazy(() => import('./playground/PlaygroundApp'));

export default function App({ navigate = navigateToSite }: { navigate?: (url: string) => void } = {}) {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  const playground = /^\/playground\/?$/.test(window.location.pathname);

  useEffect(() => {
    const handleHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  useEffect(() => {
    if (!playground && isHistoryRoute(route)) {
      const target = legacyHistoryLocation(window.location.hash, window.location.search);
      if (target) navigate(target);
    }
  }, [route, playground, navigate]);

  if (playground) return <Suspense fallback={<p role="status">正在加载 AI 对话实验室…</p>}><PlaygroundApp /></Suspense>;
  if (isHistoryRoute(route)) {
    return <main><p role="status">正在前往历史星河…</p><a href={legacyHistoryLocation(window.location.hash, window.location.search) ?? '/apps/history-galaxy/'}>进入历史星河</a></main>;
  }

  return <PortfolioApp route={route} />;
}

function navigateToSite(url: string): void { window.location.replace(url); }
