import { ArrowLeft, ArrowRight, ArrowUpRight, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import type { CompactHistoryEventIndex } from '../history/content/schema';
import { useHistoryContent } from '../history/content/store';
import { ArchiveLink, ArchiveProse, EntityList, MissingRecord, ProseList, categoryNames, historyDate, useArchiveResource } from './archive/ArchivePrimitives';
import { EventRelationships } from './archive/EventRelationships';

interface QuickEventPanelProps {
  event: CompactHistoryEventIndex;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}
export function QuickEventPanel({ event, onClose, onPrevious, onNext }: QuickEventPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const { getEventArchive } = useHistoryContent();
  const load = useCallback(() => getEventArchive(event.id), [getEventArchive, event.id]);
  const { state, retry } = useArchiveResource(load);
  const archive = state.status === 'ready' ? state.value : undefined;
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  return <aside ref={panelRef} tabIndex={-1} className="story-panel quick-event-panel" role="dialog" aria-modal="false" aria-labelledby="story-title">
    <div className="story-topline"><span>事件速览 · {event.period}</span><button type="button" className="icon-button" aria-label="关闭故事" title="关闭故事" onClick={onClose}><X size={20} aria-hidden="true" /></button></div>
    <div className="story-year" aria-label={`${event.startYear}年`}>{historyDate(event.startYear, event.endYear, event.yearPrecision)}</div>
    <h2 id="story-title">{event.title}</h2>
    <div className="story-summary"><ArchiveProse>{event.summary}</ArchiveProse></div>
    <div className="quick-influence" aria-label={`影响力 ${event.influence} 级`}><span>影响力 {event.influence} 级</span><div className="influence-meter" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <i key={index} data-active={index < event.influence} />)}</div></div>
    <nav className="story-people" aria-label="核心人物"><EntityList kind="person" ids={event.personIds.slice(0, 6)} /></nav>
    {state.status === 'loading' ? <p role="status">正在加载档案…</p> : null}
    {state.status === 'error' ? <div role="alert"><p>档案加载失败。</p><button type="button" onClick={retry}><RotateCcw size={16} aria-hidden="true" />重试档案</button></div> : null}
    {state.status === 'ready' && !archive ? <p><MissingRecord /></p> : null}
    {archive ? <div className="quick-details">
      <section><h3>原因</h3><ProseList items={archive.causes} /></section>
      <section><h3>结果</h3><ProseList items={archive.results} /></section>
      <section><h3>影响</h3>{archive.impacts.map((impact, index) => <div key={index}><span className="quick-dimension">{categoryNames[impact.dimension]}</span><ArchiveProse>{impact.text}</ArchiveProse></div>)}</section>
    </div> : null}
    <nav className="quick-related" aria-label="相关事件"><h3>相关事件</h3><EventRelationships event={archive ?? event} quick /></nav>
    <footer className="story-footer"><ArchiveLink className="quick-full-link" kind="event" id={event.id}>阅读完整档案<ArrowUpRight size={16} aria-hidden="true" /></ArchiveLink><div className="story-nav"><button type="button" aria-label="上一个历史事件" title="上一个历史事件" onClick={onPrevious}><ArrowLeft size={18} aria-hidden="true" /></button><button type="button" aria-label="下一个历史事件" title="下一个历史事件" onClick={onNext}><ArrowRight size={18} aria-hidden="true" /></button></div></footer>
  </aside>;
}
