import { ChevronDown, Eye, Star } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { HistoryEra, CategoryId } from '../history/content/schema';
import type { HistoryExplorerState } from '../history/explorer/state';
import type { SearchIndexes } from '../history/search/protocol';

const categoryNames: Record<CategoryId, string> = { politics: '政治', war: '战争', institution: '制度', economy: '经济', science: '科技', culture: '文化', thought: '思想', religion: '宗教', diplomacy: '外交', ethnicity: '民族', society: '社会' };
const toggle = (ids: readonly string[], id: string) => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id];
type ChangeFilters = (patch: Partial<Omit<HistoryExplorerState, 'text'>>) => void;

function YearInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (year: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const editing = useRef(false), expected = useRef(value);
  useEffect(() => {
    // A normalized intermediate digit must not overwrite the user's draft.
    // External URL restoration still replaces a draft with its restored year.
    if (!editing.current || value !== expected.current) setDraft(String(value));
    expected.current = value;
  }, [value]);
  return <input aria-label={label} type="number" min={-2070} max={1949} step={1} value={draft} onFocus={() => { editing.current = true; }} onBlur={() => { editing.current = false; setDraft(String(value)); }} onChange={event => {
    const raw = event.target.value; setDraft(raw);
    if (!raw || !Number.isFinite(Number(raw))) return;
    const year = Math.max(min, Math.min(max, Math.round(Number(raw)) || 1));
    expected.current = year; onChange(year);
  }} />;
}

function OptionMenu({ title, options, selected, onChange, initiallyOpen = false }: { title: string; options: { id: string; name: string }[]; selected: readonly string[]; onChange: (ids: string[]) => void; initiallyOpen?: boolean }) {
  return <details className="explorer-options" open={initiallyOpen}>
    <summary><span>{title}</span><small>{selected.length || '全部'}</small><ChevronDown size={14} aria-hidden="true" /></summary>
    <div className="explorer-option-list">
      {options.map(option => <label key={option.id} className="explorer-check"><input type="checkbox" checked={selected.includes(option.id)} onChange={() => onChange(toggle(selected, option.id))} /><span>{option.name}</span></label>)}
      {!options.length ? <p className="explorer-empty">暂无{title}索引</p> : null}
    </div>
  </details>;
}

export function ThemeOptions({ indexes, state, onChange }: { indexes: SearchIndexes; state: HistoryExplorerState; onChange: ChangeFilters }) {
  return <div className="explorer-themes">
    {(indexes.themes ?? []).map(theme => <label className="explorer-theme" key={theme.id}>
      <input type="checkbox" aria-label={theme.title} checked={state.themeIds.includes(theme.id)} onChange={() => onChange({ themeIds: toggle(state.themeIds, theme.id) })} />
      <span><strong>{theme.title}</strong><small>{theme.summary}</small><em>{theme.eventIds.length} 个事件</em></span>
    </label>)}
    {!indexes.themes?.length ? <p className="explorer-empty">暂无专题索引，可先通过事件或筛选探索。</p> : null}
  </div>;
}

export function FilterPanel({ indexes, eras, state, onChange, viewportAvailable = true, includeThemes = true }: { indexes: SearchIndexes; eras: readonly HistoryEra[]; state: HistoryExplorerState; onChange: ChangeFilters; viewportAvailable?: boolean; includeThemes?: boolean }) {
  const changeYear = (key: 'fromYear' | 'toYear', value: string) => {
    if (!value || !Number.isFinite(Number(value))) return;
    const year = Math.max(-2070, Math.min(1949, Math.round(Number(value)) || 1));
    onChange(key === 'fromYear' ? { fromYear: Math.min(year, state.toYear) } : { toYear: Math.max(year, state.fromYear) });
  };
  return <div className="explorer-filters" aria-label="历史筛选">
    <div className="explorer-modes">
      <label className="explorer-check"><input type="checkbox" checked={state.majorOnly} onChange={event => onChange({ majorOnly: event.target.checked })} /><Star size={14} aria-hidden="true" /><span>仅重大事件</span></label>
      <label className="explorer-check" title={viewportAvailable ? '只匹配当前相机视野中的事件' : '视野筛选需要三维场景'}><input type="checkbox" checked={state.viewportOnly} disabled={!viewportAvailable && !state.viewportOnly} onChange={event => onChange({ viewportOnly: event.target.checked })} /><Eye size={14} aria-hidden="true" /><span>仅当前视野</span></label>
    </div>
    {!viewportAvailable ? <p className="explorer-hint">视野筛选需要三维场景。</p> : null}
    <div className="explorer-years">
      <label><span>起始年份</span><YearInput label="起始年份" value={state.fromYear} min={-2070} max={state.toYear} onChange={fromYear => onChange({ fromYear })} /><input aria-label="起始年份范围" type="range" min={-2070} max={1949} value={state.fromYear} onChange={event => changeYear('fromYear', event.target.value)} /></label>
      <label><span>结束年份</span><YearInput label="结束年份" value={state.toYear} min={state.fromYear} max={1949} onChange={toYear => onChange({ toYear })} /><input aria-label="结束年份范围" type="range" min={-2070} max={1949} value={state.toYear} onChange={event => changeYear('toYear', event.target.value)} /></label>
    </div>
    <label className="explorer-influence"><span>最低影响力 <small>{state.minInfluence === 1 ? '不限' : `${state.minInfluence} 级起`}</small></span><input aria-label="最低影响力" type="range" min={1} max={5} step={1} value={state.minInfluence} onChange={event => onChange({ minInfluence: Number(event.target.value) as HistoryExplorerState['minInfluence'] })} /></label>
    <OptionMenu title="类别" options={Object.entries(categoryNames).map(([id, name]) => ({ id, name }))} selected={state.categories} onChange={ids => onChange({ categories: ids as CategoryId[] })} initiallyOpen />
    <OptionMenu title="时代" options={eras.map(era => ({ id: era.id, name: era.name }))} selected={state.eraIds} onChange={eraIds => onChange({ eraIds })} />
    <OptionMenu title="人物" options={indexes.people.map(person => ({ id: person.id, name: person.name }))} selected={state.personIds} onChange={personIds => onChange({ personIds })} />
    <OptionMenu title="地点" options={(indexes.places ?? []).map(place => ({ id: place.id, name: place.name }))} selected={state.placeIds} onChange={placeIds => onChange({ placeIds })} />
    {includeThemes ? <details className="explorer-options"><summary><span>专题</span><small>{state.themeIds.length || '全部'}</small><ChevronDown size={14} aria-hidden="true" /></summary><ThemeOptions indexes={indexes} state={state} onChange={onChange} /></details> : null}
  </div>;
}
