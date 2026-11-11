import type { HistoryRoute } from './routes';
import type { HistoryContentLoader } from './history/content/loader';
import { HistoryContentProvider } from './history/content/store';
import { HistoryGalaxyExperience } from './HistoryGalaxyApp';
import { ArchiveShell } from './components/archive/ArchiveShell';

export default function HistoryRoutes({ route, loader }: { route: HistoryRoute; loader?: HistoryContentLoader }) {
  return <HistoryContentProvider loader={loader}>
    {route.view === 'history-galaxy' ? <HistoryGalaxyExperience /> : <ArchiveShell key={`${route.view}:${route.id}`} route={route} />}
  </HistoryContentProvider>;
}
