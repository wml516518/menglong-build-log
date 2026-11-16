import { isHistoryRoute, parseHash, type HistoryRoute } from './routes';

export const historySitePath = '/apps/history-galaxy/';

export function legacyHistoryLocation(hash: string, search = ''): string | null {
  return isHistoryRoute(parseHash(hash)) ? `${historySitePath}${search}${hash}` : null;
}

export function historySiteRoute(hash: string): HistoryRoute {
  const route = parseHash(hash);
  return isHistoryRoute(route) ? route : { view: 'history-galaxy' };
}

