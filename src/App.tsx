import { lazy, Suspense, useEffect, useState } from 'react';
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

  if (route.view === 'history-galaxy') {
    return (
      <Suspense fallback={<main className="history-route-loading" aria-label="正在加载历史星河" />}>
        <HistoryGalaxyApp />
      </Suspense>
    );
  }

  return <PortfolioApp route={route} />;
}
