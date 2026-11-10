import { useEffect, useState } from 'react';
import { getHistoryReturnLocation, restoreHistoryReturnLocation, type ArchiveRoute } from '../../routes';
import { useHistoryContent } from '../../history/content/store';
import { ArchiveNotFound } from './ArchiveNotFound';

type ArchiveState = { status: 'loading' | 'error' | 'missing' | 'ready'; title?: string };
export function ArchiveShell({ route }: { route: ArchiveRoute }) {
  const { loading, error, manifest, getEventArchive, getPersonArchive, retry } = useHistoryContent();
  const [state, setState] = useState<ArchiveState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // Query parsing is kept separate from the validated ID used for manifest lookups.
  const query = new URLSearchParams(route.query);
  useEffect(() => {
    if (loading || error || !manifest) return;
    let active = true;
    setState({ status: 'loading' });
    if (route.view === 'history-theme') {
      setState(Object.hasOwn(manifest.themeArchives, route.id) ? { status: 'ready', title: '主题档案' } : { status: 'missing' });
      return;
    }
    const pending = route.view === 'history-event' ? getEventArchive(route.id).then(value => value?.title) : getPersonArchive(route.id).then(value => value?.name);
    void pending.then(title => {
      if (active) setState(title ? { status: 'ready', title } : { status: 'missing' });
    }, () => { if (active) setState({ status: 'error' }); });
    return () => { active = false; };
  }, [loading, error, manifest, route.view, route.id, getEventArchive, getPersonArchive, attempt]);
  const failed = Boolean(error) || state.status === 'error';
  return <main className="history-archive" aria-label="历史档案" data-search={query.get('q') ?? undefined}>
    <a href={getHistoryReturnLocation()} onClick={event => { event.preventDefault(); restoreHistoryReturnLocation(); }}>返回历史星河</a>
    {failed ? <div role="alert"><p>历史档案加载失败，请重试。</p><button type="button" onClick={() => {
      if (error) void retry().catch(() => {});
      else setAttempt(value => value + 1);
    }}>重试</button></div> : loading || state.status === 'loading' ? <p role="status">正在加载历史档案…</p>
      : state.status === 'missing' ? <ArchiveNotFound /> : <section><h1>{state.title}</h1><p>历史档案内容正在整理中。</p></section>}
  </main>;
}
