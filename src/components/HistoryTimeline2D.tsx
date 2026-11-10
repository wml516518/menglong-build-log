import { useEffect, useId, useMemo, useRef } from 'react';
import type { CompactHistoryEventIndex, HistoryEra } from '../history/content/schema';
import type { HistoryExplorerState } from '../history/explorer/state';
import { categoryNames, historyDate } from './archive/ArchivePrimitives';

interface TimelineItem { event: CompactHistoryEventIndex; match: boolean; opacity: number }
interface HistoryTimeline2DProps {
  events: readonly TimelineItem[];
  eras: readonly HistoryEra[];
  state: HistoryExplorerState;
  selectedId: string | null;
  onSelect: (id: string) => void;
  focusEventId?: string;
  searchTargetIds?: readonly string[];
}

/** The scene's filtered compact rows, with the same identity and selection model. */
export function HistoryTimeline2D({ events, eras, state, selectedId, onSelect, focusEventId, searchTargetIds = [] }: HistoryTimeline2DProps) {
  const id = useId();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const ordered = useMemo(() => [...events].sort((a, b) => a.event.startYear - b.event.startYear || a.event.endYear - b.event.endYear || a.event.id.localeCompare(b.event.id)), [events]);
  const groups = useMemo(() => {
    const byEra = new Map<string, { name: string; items: TimelineItem[]; periods: { label: string; items: TimelineItem[] }[] }>();
    for (const item of ordered) {
      const event = item.event;
      if (!byEra.has(event.eraId)) byEra.set(event.eraId, { name: eras.find(era => era.id === event.eraId)?.name ?? event.period, items: [], periods: [] });
      const era = byEra.get(event.eraId)!;
      era.items.push(item);
      const label = `${event.period} · ${categoryNames[event.categories[0]]}`;
      if (era.periods.at(-1)?.label !== label) era.periods.push({ label, items: [] });
      era.periods.at(-1)!.items.push(item);
    }
    return [...byEra.entries()];
  }, [ordered, eras]);
  useEffect(() => {
    const target = selectedId ?? focusEventId;
    if (target) buttons.current.get(target)?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedId, focusEventId]);
  const matches = events.filter(item => item.match).length;

  return <section className="history-timeline-2d is-fallback" role="region" aria-label="二维历史时间轴" aria-describedby={`${id}-help`} tabIndex={0} onKeyDown={event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || !ordered.length) return;
    event.preventDefault(); event.stopPropagation();
    const focused = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-event-id]')?.dataset.eventId : undefined;
    const index = ordered.findIndex(item => item.event.id === (focused ?? selectedId));
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = index < 0 ? (step === 1 ? 0 : ordered.length - 1) : (index + step + ordered.length) % ordered.length;
    const next = ordered[nextIndex].event;
    buttons.current.get(next.id)?.focus(); onSelect(next.id);
  }}>
    <header className="timeline-2d-intro"><span>年表阅读</span><p>{matches} / {events.length} 个事件匹配</p><p id={`${id}-help`}>按时代与历史阶段展开 · 左右方向键浏览 · 回车或空格阅读</p>{state.text.trim() ? <p>搜索「{state.text}」</p> : null}</header>
    {!events.length ? <p className="timeline-2d-empty">历史索引加载后，事件将在此按时间展开。</p> : null}
    {events.length > 0 && matches === 0 ? <p className="timeline-2d-empty" role="status">没有匹配事件，可调整探索器中的搜索或筛选。年表仍保留全部事件供浏览。</p> : null}
    {groups.map(([eraId, era]) => <section className="timeline-2d-era" aria-labelledby={`${id}-${eraId}`} key={eraId}>
      <h2 id={`${id}-${eraId}`}>{era.name}<small>{era.items.length} 个事件</small></h2>
      {era.periods.map((period, index) => <div className="timeline-2d-period" key={`${period.label}-${index}`}>
        <h3>{period.label}</h3>
        <ol>{period.items.map(({ event, match, opacity }) => {
          const date = historyDate(event.startYear, event.endYear, event.yearPrecision);
          const accessibleDate = date;
          return <li key={event.id}><button ref={node => { if (node) buttons.current.set(event.id, node); else buttons.current.delete(event.id); }} type="button" data-event-id={event.id} data-match={match} data-opacity={opacity} data-search-target={searchTargetIds.includes(event.id)} aria-pressed={selectedId === event.id} aria-describedby={`${id}-${event.id}-metadata`} aria-label={`查看历史事件：${accessibleDate} ${event.title}`} onClick={() => onSelect(event.id)}>
            <time>{date}</time><span className="timeline-2d-event"><strong>{event.title}</strong><span id={`${id}-${event.id}-metadata`}>{event.categories.map(category => categoryNames[category]).join(' · ')}<i aria-hidden="true"> / </i>影响力 {event.influence} 级{!match ? <em>未匹配</em> : null}{selectedId === event.id ? <em>已选择</em> : null}</span></span><span className="timeline-2d-arrow" aria-hidden="true">↗</span>
          </button></li>;
        })}</ol>
      </div>)}
    </section>)}
  </section>;
}
