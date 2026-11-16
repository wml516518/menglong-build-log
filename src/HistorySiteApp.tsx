import { lazy, Suspense, useEffect, useState } from 'react';
import { getHistoryReturnLocation, isHistoryRoute, parseHash, rememberHistoryLocation, restoreHistoryReturnLocation } from './routes';
import type { HistoryContentLoader } from './history/content/loader';
import { historySiteRoute } from './siteLocations';
import { applyHistoryMetadata } from './historyMetadata';

const HistoryRoutes = lazy(() => import('./HistoryRoutes'));

export default function HistorySiteApp({ historyLoader }: { historyLoader?: HistoryContentLoader } = {}) {
  const [route, setRoute] = useState(() => historySiteRoute(window.location.hash));

  useEffect(() => {
    if (!isHistoryRoute(parseHash(window.location.hash))) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#/history-galaxy`);
    }
    let entry = rememberHistoryLocation();
    let pendingArchiveLink: { from: string; to: string; entry: string } | undefined;
    const handleArchiveLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const target = new URL(link.href, window.location.href);
      if (target.origin !== window.location.origin || target.pathname !== window.location.pathname || target.search !== window.location.search) return;
      const destination = parseHash(target.hash);
      if (parseHash(window.location.hash).view === 'history-galaxy' && isHistoryRoute(destination) && destination.view !== 'history-galaxy') {
        pendingArchiveLink = { from: window.location.hash, to: target.hash, entry };
      }
    };
    const handleHashChange = (event: HashChangeEvent) => {
      if (new URL(event.newURL).hash !== window.location.hash) return;
      const previousHash = new URL(event.oldURL).hash;
      const predecessor = pendingArchiveLink?.from === previousHash && pendingArchiveLink.to === window.location.hash ? pendingArchiveLink.entry : undefined;
      pendingArchiveLink = undefined;
      entry = rememberHistoryLocation(previousHash, predecessor);
      setRoute(historySiteRoute(window.location.hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    document.addEventListener('click', handleArchiveLink);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      document.removeEventListener('click', handleArchiveLink);
    };
  }, []);

  useEffect(() => {
    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = 'zh-CN';
    document.body.classList.add('history-route');
    applyHistoryMetadata();
    return () => {
      document.documentElement.lang = previousLanguage;
      document.body.classList.remove('history-route');
    };
  }, []);

  return <Suspense fallback={<main className="history-route-loading"><p role="status">正在加载历史星河…</p><a href={getHistoryReturnLocation()} onClick={event => { event.preventDefault(); restoreHistoryReturnLocation(); }}>返回历史星河</a></main>}>
    <HistoryRoutes route={route} loader={historyLoader} />
  </Suspense>;
}
