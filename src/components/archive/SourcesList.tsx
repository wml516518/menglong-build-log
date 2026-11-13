import type { SourceReference } from '../../history/content/schema';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { useHistoryContent } from '../../history/content/store';
import { MissingRecord, useArchiveResource } from './ArchivePrimitives';

type SourcesListProps = { references: readonly (string | SourceReference)[]; sourceIds?: never }
  | { /** @deprecated Person/theme compatibility until their callers migrate. */ sourceIds: readonly string[]; references?: never };
export function SourcesList(props: SourcesListProps) {
  const references = props.references ?? props.sourceIds;
  const { getSources } = useHistoryContent();
  const { state, retry } = useArchiveResource(getSources, references.length > 0);
  if (!references.length) return <p><MissingRecord /></p>;
  if (state.status === 'loading') return <p role="status">正在加载参考资料…</p>;
  if (state.status === 'error') return <div role="alert"><p>参考资料加载失败。</p><button type="button" onClick={retry}><RotateCcw size={16} aria-hidden="true" />重试参考资料</button></div>;
  return <ol className="archive-sources" aria-label="参考资料">{references.map((reference, index) => {
    const id = typeof reference === 'string' ? reference : reference.sourceId;
    const source = state.value.find(item => item.id === id);
    if (!source) return <li key={`${id}:${index}`}><MissingRecord /></li>;
    return <li key={`${id}:${index}`}>
      {source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ExternalLink size={13} aria-hidden="true" /></a> : <span>{source.title}</span>}
      <p>{[source.authors?.join('、'), source.publisher, source.edition, source.chapter].filter(Boolean).join(' · ')}{source.accessedAt ? ` · 查阅于 ${source.accessedAt}` : ''}</p>
      {typeof reference === 'string' ? null : <><p className="archive-source-locator">{reference.locator}</p>{reference.note ? <p className="archive-note">{reference.note}</p> : null}</>}
    </li>;
  })}</ol>;
}
