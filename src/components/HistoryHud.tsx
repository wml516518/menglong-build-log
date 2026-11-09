import type { DynastyId } from '../history/types';
import { dynasties } from '../history/events';
import { getDynastyForYear } from '../history/space';
import { LocateFixed } from 'lucide-react';

interface HistoryHudProps {
  currentYear: number;
  activeDynastyId: DynastyId;
  onSelectDynasty: (id: DynastyId) => void;
  onReset: () => void;
}

export function HistoryHud({ currentYear, activeDynastyId, onSelectDynasty, onReset }: HistoryHudProps) {
  const currentDynasty = dynasties.find((dynasty) => dynasty.id === activeDynastyId) ?? getDynastyForYear(currentYear);

  return (
    <>
      <header className="history-brand">
        <p>中国历史 · 三维年表</p>
        <h1>历史星河</h1>
        <div className="brand-period">
          <span>公元 618 - 1949</span>
          <i aria-hidden="true" />
          <span className="current-year">当前 {currentYear}</span>
          <i aria-hidden="true" />
          <span>{currentDynasty.inscription}</span>
        </div>
      </header>

      <nav className="era-navigation" aria-label="时代导航">
        {dynasties.map((dynasty) => (
          <button
            key={dynasty.id}
            type="button"
            aria-label={dynasty.name}
            aria-pressed={currentDynasty.id === dynasty.id}
            onClick={() => onSelectDynasty(dynasty.id)}
          >
            <span>{dynasty.name}</span>
            <small>{dynasty.start}</small>
          </button>
        ))}
      </nav>

      <div className="scene-tools">
        <button type="button" aria-label="归位时间轴" title="归位时间轴" onClick={onReset}>
          <LocateFixed aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
