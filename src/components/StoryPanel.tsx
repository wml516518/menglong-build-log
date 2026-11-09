import { useEffect, useRef } from 'react';
import type { HistoryEvent } from '../history/types';

interface StoryPanelProps {
  event: HistoryEvent;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export function StoryPanel({ event, onClose, onPrevious, onNext }: StoryPanelProps) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  return (
    <aside ref={panelRef} tabIndex={-1} className="story-panel" role="dialog" aria-modal="false" aria-labelledby="story-title">
      <div className="story-topline">
        <span>HISTORICAL ARCHIVE · {event.dynasty.toUpperCase()}</span>
        <button type="button" className="icon-button" aria-label="关闭故事" onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div className="story-year" aria-label={`${event.year}年`}>
        {event.year}
      </div>
      <h2 id="story-title">{event.title}</h2>
      <p className="story-summary">{event.summary}</p>

      <div className="story-people" aria-label="相关人物">
        {event.people.map((person) => (
          <span key={person}>{person}</span>
        ))}
      </div>

      <p className="story-copy">{event.story}</p>

      <div className="story-footer">
        <span>影响力</span>
        <div className="influence-meter" aria-label={`影响力 ${event.influence} 级`}>
          {Array.from({ length: 5 }, (_, index) => (
            <i key={index} data-active={index < event.influence} />
          ))}
        </div>
        <div className="story-nav">
          <button type="button" aria-label="上一个历史事件" onClick={onPrevious}>←</button>
          <button type="button" aria-label="下一个历史事件" onClick={onNext}>→</button>
        </div>
      </div>
    </aside>
  );
}
