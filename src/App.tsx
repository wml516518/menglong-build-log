import { lazy, Suspense, useEffect, useState } from 'react';
import { applyRouteMetadata } from './metadata';
import { isHistoryRoute, parseHash, rememberHistoryLocation } from './routes';
import type { HistoryContentLoader } from './history/content/loader';
import { PortfolioApp } from './PortfolioApp';

const HistoryRoutes = lazy(() => import('./HistoryRoutes'));

export default function App({ historyLoader }: { historyLoader?: HistoryContentLoader } = {}) {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    rememberHistoryLocation();
    const handleHashChange = (event: HashChangeEvent) => {
      rememberHistoryLocation(new URL(event.oldURL).hash);
      setRoute(parseHash(window.location.hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    applyRouteMetadata(route);
    document.body.classList.toggle('history-route', isHistoryRoute(route));
    return () => document.body.classList.remove('history-route');
  }, [route]);

  useEffect(() => {
    if (!isHistoryRoute(route)) return;
    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = 'zh-CN';
    return () => { document.documentElement.lang = previousLanguage; };
  }, [route.view]);

  if (isHistoryRoute(route)) {
    return (
      <Suspense fallback={<main className="history-route-loading"><p role="status">正在加载历史星河…</p><a href="#/history-galaxy">返回历史星河</a></main>}>
        <HistoryRoutes route={route} loader={historyLoader} />
      </Suspense>
    );
  }

  return <PortfolioApp route={route} />;
}
