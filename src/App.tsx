import { lazy, Suspense, useEffect, useState } from 'react';
import { applyRouteMetadata } from './metadata';
import { parseHash } from './routes';
import { PortfolioApp } from './PortfolioApp';

const HistoryGalaxyApp = lazy(() => import('./HistoryGalaxyApp'));

export default function App() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    const handleHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (route.view === 'history-galaxy') applyRouteMetadata(route, 'zh');
    document.body.classList.toggle('history-route', route.view === 'history-galaxy');
    return () => document.body.classList.remove('history-route');
  }, [route]);

  useEffect(() => {
    if (route.view !== 'history-galaxy') return;
    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = 'zh-CN';
    return () => { document.documentElement.lang = previousLanguage; };
  }, [route.view]);

  if (route.view === 'history-galaxy') {
    return (
      <Suspense fallback={<main className="history-route-loading" aria-label="正在加载历史星河" />}>
        <HistoryGalaxyApp />
      </Suspense>
    );
  }

  return <PortfolioApp route={route} />;
}
