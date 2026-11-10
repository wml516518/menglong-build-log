import { ExternalLink, RotateCcw } from 'lucide-react';
import { useHistoryContent } from '../../history/content/store';
import { MissingRecord, useArchiveResource } from './ArchivePrimitives';

export function SourcesList({ sourceIds }: { sourceIds: string[] }) {
  const { getSources } = useHistoryContent();
  const { state, retry } = useArchiveResource(getSources, sourceIds.length > 0);
  if (!sourceIds.length) return <p><MissingRecord /></p>;
  if (state.status === 'loading') return <p role="status">正在加载参考资料…</p>;
  if (state.status === 'error') return <div role="alert"><p>参考资料加载失败。</p><button type="button" onClick={retry}><RotateCcw size={16} aria-hidden="true" />重试参考资料</button></div>;
  return <ol className="archive-sources" aria-label="参考资料">{sourceIds.map(id => {
    const source = state.value.find(item => item.id === id);
    if (!source) return <li key={id}><MissingRecord /></li>;
    return <li key={id}>
      {source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ExternalLink size={13} aria-hidden="true" /></a> : <span>{source.title}</span>}
      <p>{[source.authors?.join('、'), source.publisher, source.edition, source.chapter].filter(Boolean).join(' · ')}{source.accessedAt ? ` · 查阅于 ${source.accessedAt}` : ''}</p>
    </li>;
  })}</ol>;
}
