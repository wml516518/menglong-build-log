import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getHistoryReturnLocation, restoreHistoryReturnLocation, type ArchiveRoute } from '../../routes';
import { useHistoryContent } from '../../history/content/store';
import type { PersonArchive as PersonArchiveData, ThemeArchive as ThemeArchiveData } from '../../history/content/schema';
import { ArchiveNotFound } from './ArchiveNotFound';
import { EventArchive, type EventArchiveData } from './EventArchive';
import { PersonArchive } from './PersonArchive';
import { ThemeArchive } from './ThemeArchive';

type ArchiveState = { status: 'loading' | 'error' | 'missing' } | { status: 'ready'; kind: 'event'; archive: EventArchiveData } | { status: 'ready'; kind: 'person'; archive: PersonArchiveData } | { status: 'ready'; kind: 'theme'; archive: ThemeArchiveData };
export function ArchiveShell({ route }: { route: ArchiveRoute }) {
  const { loading, error, manifest, getEventArchiveRecord, getPersonArchive, getThemeArchive, retry } = useHistoryContent();
  const [state, setState] = useState<ArchiveState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    if (state.status !== 'ready') return;
    const heading = main.current?.querySelector('h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }, [state]);
  const query = new URLSearchParams(route.query);
  useEffect(() => {
    if (loading || error || !manifest) return;
    let active = true;
    setState({ status: 'loading' });
    const load = async (): Promise<ArchiveState> => {
      if (route.view === 'history-event') {
        const archive = await getEventArchiveRecord(route.id);
        return archive ? { status: 'ready', kind: 'event', archive } : { status: 'missing' };
      }
      if (route.view === 'history-person') {
        const archive = await getPersonArchive(route.id);
        return archive ? { status: 'ready', kind: 'person', archive } : { status: 'missing' };
      }
      const archive = await getThemeArchive(route.id);
      return archive ? { status: 'ready', kind: 'theme', archive } : { status: 'missing' };
    };
    void load().then(value => { if (active) setState(value); }, () => { if (active) setState({ status: 'error' }); });
    return () => { active = false; };
  }, [loading, error, manifest, route.view, route.id, getEventArchiveRecord, getPersonArchive, getThemeArchive, attempt]);
  const failed = Boolean(error) || state.status === 'error';
  return <main ref={main} className="history-archive" aria-label="历史档案" data-search={query.get('q') ?? undefined}>
    <div className="archive-layout">
      <a className="archive-back" href={getHistoryReturnLocation()} onClick={event => { event.preventDefault(); restoreHistoryReturnLocation(); }}><ArrowLeft size={17} aria-hidden="true" />返回历史星河</a>
      {failed ? <div role="alert"><p>历史档案加载失败，请重试。</p><button type="button" onClick={() => {
        if (error) void retry().catch(() => {});
        else setAttempt(value => value + 1);
      }}><RotateCcw size={16} aria-hidden="true" />重试</button></div> : loading || state.status === 'loading' ? <p role="status">正在加载历史档案…</p>
        : state.status === 'missing' ? <ArchiveNotFound /> : state.status === 'ready' ? state.kind === 'event' ? <EventArchive event={state.archive} /> : state.kind === 'person' ? <PersonArchive person={state.archive} /> : <ThemeArchive theme={state.archive} /> : null}
    </div>
  </main>;
}
