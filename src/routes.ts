export type ArchiveRoute = { view: 'history-event' | 'history-person' | 'history-theme'; id: string; query: string };
export type HistoryRoute = { view: 'history-galaxy' } | ArchiveRoute;
export type Route =
  | ArchiveRoute
  | { view: 'home' }
  | { view: 'history-galaxy' }
  | { view: 'posts' }
  | { view: 'post'; slug: string };

const postPrefix = '#/build-log/';
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseHash(hash: string): Route {
  const [pathname] = hash.split('?');
  if (pathname === '#/history-galaxy') {
    return { view: 'history-galaxy' };
  }

  const archive = /^#\/history-galaxy\/(event|person|theme)\/(.*)$/.exec(pathname);
  if (archive) {
    try {
      const id = decodeURIComponent(archive[2]);
      if (!slugPattern.test(id)) return { view: 'home' };
      return { view: `history-${archive[1]}` as ArchiveRoute['view'], id, query: hash.slice(pathname.length) };
    } catch { return { view: 'home' }; }
  }

  if (hash === '#/build-log' || hash === postPrefix) {
    return { view: 'posts' };
  }

  if (!hash.startsWith(postPrefix)) {
    return { view: 'home' };
  }

  try {
    const slug = decodeURIComponent(hash.slice(postPrefix.length));
    return slugPattern.test(slug) ? { view: 'post', slug } : { view: 'posts' };
  } catch {
    return { view: 'posts' };
  }
}


export function isHistoryRoute(route: Route): route is HistoryRoute {
  return route.view === 'history-galaxy' || route.view === 'history-event' || route.view === 'history-person' || route.view === 'history-theme';
}
const returnKey = 'history-galaxy-return';
const stateKey = 'historyGalaxyReturn';
const entryKey = 'historyGalaxyEntry';
function validGalaxyHash(hash: unknown): hash is string {
  return typeof hash === 'string' && parseHash(hash).view === 'history-galaxy';
}
export function getHistoryReturnLocation(): string {
  if (validGalaxyHash(window.location.hash)) return window.location.hash;
  try {
    const stored = window.sessionStorage.getItem(returnKey);
    if (validGalaxyHash(stored)) return stored;
  } catch { /* A direct link still has a safe default when storage is unavailable. */ }
  return '#/history-galaxy';
}
// A predecessor is supplied only after an explicit same-tab archive-link activation.
// Hashchange oldURL/newURL alone cannot distinguish a new entry from Back/Forward.
export function rememberHistoryLocation(previousHash?: string, predecessorEntry?: string): string {
  const current = window.location.hash;
  const fromGalaxy = validGalaxyHash(previousHash);
  const returnHash = validGalaxyHash(current) ? current : fromGalaxy ? previousHash : undefined;
  if (returnHash) {
    try { window.sessionStorage.setItem(returnKey, returnHash); } catch { /* Storage may be unavailable. */ }
  }
  const entry = window.history.state?.[entryKey] ?? crypto.randomUUID();
  const marker = predecessorEntry && fromGalaxy && isHistoryRoute(parseHash(current)) && !validGalaxyHash(current)
    ? { archive: current, returnHash: previousHash, entry, predecessorEntry }
    : window.history.state?.[stateKey];
  window.history.replaceState({ ...window.history.state, [entryKey]: entry, [stateKey]: marker }, '', window.location.href);
  return entry;
}
export function restoreHistoryReturnLocation(): void {
  const saved = window.history.state?.[stateKey];
  if (saved?.entry === window.history.state?.[entryKey] && typeof saved?.predecessorEntry === 'string' && saved?.archive === window.location.hash && validGalaxyHash(saved?.returnHash) && window.history.length > 1) {
    window.history.back();
  } else {
    window.location.hash = getHistoryReturnLocation();
  }
}
