import { RotateCcw } from 'lucide-react';
import { useHistoryContent } from '../../history/content/store';
import type { CompactHistoryEventIndex, HistoryEventArchive, RelationType } from '../../history/content/schema';
import { EntityLink, MissingRecord, useArchiveResource } from './ArchivePrimitives';

const relationNames: Record<RelationType, [string, string]> = {
  cause: ['促成', '起因于'], consequence: ['后续结果', '前序事件'], parallel: ['同时期事件', '同时期事件'], contrast: ['对照事件', '对照事件'], 'part-of': ['隶属事件', '包含事件']
};
export function EventRelationships({ event, quick = false }: { event: CompactHistoryEventIndex | HistoryEventArchive; quick?: boolean }) {
  const { getRelations } = useHistoryContent();
  const { state, retry } = useArchiveResource(getRelations, event.relationIds.length > 0);
  const hasRelations = event.parentId || event.childIds.length || event.relationIds.length;
  if (!hasRelations) return <p><MissingRecord /></p>;
  return <>
    <ul className="archive-relations" aria-label={quick ? '相关事件列表' : '事件关系'}>
      {event.parentId ? <li><span className="relation-label">隶属事件</span><EntityLink kind="event" id={event.parentId} /></li> : null}
      {event.childIds.map(id => <li key={`child:${id}`}><span className="relation-label">包含事件</span><EntityLink kind="event" id={id} /></li>)}
      {state.status === 'ready' ? event.relationIds.map(id => {
        const relation = state.value.find(item => item.id === id);
        if (!relation || (relation.fromId !== event.id && relation.toId !== event.id)) return <li key={id}><MissingRecord /></li>;
        const outgoing = relation.fromId === event.id;
        return <li key={id}><span className="relation-label">{relationNames[relation.type][outgoing ? 0 : 1]}</span><EntityLink kind="event" id={outgoing ? relation.toId : relation.fromId} /></li>;
      }) : null}
    </ul>
    {event.relationIds.length && state.status === 'loading' ? <p role="status">正在加载事件关系…</p> : null}
    {event.relationIds.length && state.status === 'error' ? <div role="alert"><p>事件关系加载失败。</p><button type="button" onClick={retry}><RotateCcw size={16} aria-hidden="true" />重试事件关系</button></div> : null}
  </>;
}
