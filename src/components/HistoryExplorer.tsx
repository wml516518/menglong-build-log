import { BookOpen, ChevronLeft, ListFilter, PanelLeftOpen, RotateCcw, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { HistoryEra } from '../history/content/schema';
import type { HistoryExplorerController } from '../history/explorer/useHistoryExplorer';
import type { SearchIndexes } from '../history/search/protocol';
import { FilterPanel, ThemeOptions } from './FilterPanel';
import { SearchResults } from './SearchResults';

const views = [{ name: '事件', Icon: BookOpen }, { name: '搜索', Icon: Search }, { name: '筛选', Icon: ListFilter }, { name: '专题', Icon: BookOpen }] as const;
type View = typeof views[number]['name'];
function useMobileExplorer() {
  const [mobile, setMobile] = useState(() => window.matchMedia?.('(max-width: 820px)').matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.('(max-width: 820px)');
    const update = () => setMobile(query?.matches ?? false);
    query?.addEventListener('change', update);
    return () => query?.removeEventListener('change', update);
  }, []);
  return mobile;
}

export function HistoryExplorer({ explorer, indexes, eras, selectedId, onSelect, onOpen, viewportAvailable = true }: { explorer: HistoryExplorerController; indexes: SearchIndexes; eras: readonly HistoryEra[]; selectedId: string | null; onSelect: (id: string) => void; onOpen?: () => void; viewportAvailable?: boolean }) {
  const mobile = useMobileExplorer();
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [view, setView] = useState<View>('事件');
  const panel = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const tabs = useRef<Partial<Record<View, HTMLButtonElement | null>>>({});
  const enterPanel = useRef(true);
  const [activation, setActivation] = useState(0);
  const id = useId();
  const open = mobile ? drawerOpen : desktopOpen;
  const close = () => {
    if (mobile) { setDrawerOpen(false); tabs.current[view]?.focus(); }
    else { setDesktopOpen(false); toggle.current?.focus(); }
  };
  useEffect(() => {
    if (mobile && drawerOpen && enterPanel.current) panel.current?.querySelector<HTMLElement>(view === '搜索' ? 'input[type="search"]' : 'input, button')?.focus();
  }, [mobile, drawerOpen, view, activation]);
  useEffect(() => { if (selectedId) setDrawerOpen(false); }, [selectedId]);
  useEffect(() => { if (!mobile && !desktopOpen) toggle.current?.focus(); }, [mobile, desktopOpen]);
  const select = (eventId: string) => { if (mobile) close(); onSelect(eventId); };
  const matches = explorer.filtered.filter(item => item.match).map(item => item.event);
  const search = <>
    <label className="explorer-search"><Search aria-hidden="true" size={17} /><input type="search" aria-label="搜索历史" placeholder="事件、人物、地点…" value={explorer.state.text} onChange={event => explorer.changeText(event.target.value)} />{explorer.state.text ? <button type="button" aria-label="清除搜索" title="清除搜索" onClick={() => explorer.changeText('')}><X aria-hidden="true" size={15} /></button> : null}</label>
    {explorer.fallback ? <p className="explorer-hint" role="status">已切换为简易搜索，可按事件或人物名称前缀查找。</p> : null}
    {explorer.searchError ? <p className="explorer-error" role="alert">搜索暂时不可用。<button type="button" onClick={explorer.retrySearch}>重新搜索</button></p> : null}
    {explorer.state.text.trim() ? <SearchResults results={explorer.searchResults} count={explorer.searchResults.length} selectedId={selectedId} onSelect={select} busy={explorer.searching} /> : mobile ? <p className="explorer-empty">输入名称，寻找事件在星河中的位置。</p> : null}
  </>;
  return <div className={`history-explorer ${mobile ? 'is-mobile' : 'is-desktop'} ${open ? 'is-open' : 'is-closed'}`} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); }
  }}>
    {!mobile ? <button ref={toggle} type="button" className="explorer-toggle" aria-label="展开历史探索器" title="展开历史探索器" aria-expanded={open} aria-controls={id} hidden={open} onClick={() => setDesktopOpen(true)}><PanelLeftOpen size={18} aria-hidden="true" /><span>探索</span></button> : null}
    {open ? <aside ref={panel} id={id} className="explorer-panel" role={mobile ? 'dialog' : undefined} aria-modal={mobile ? false : undefined} aria-label={mobile ? '历史探索' : '历史探索器'}>
      <div className="explorer-topline"><span>{mobile ? view : '历史探索'}</span><div><button type="button" aria-label="清除全部筛选" title="清除全部筛选" onClick={explorer.clear}><RotateCcw size={15} aria-hidden="true" /></button><button type="button" aria-label={mobile ? '关闭探索抽屉' : '收起历史探索器'} title={mobile ? '关闭探索抽屉' : '收起历史探索器'} onClick={close}>{mobile ? <X size={18} aria-hidden="true" /> : <ChevronLeft size={18} aria-hidden="true" />}</button></div></div>
      <p className="explorer-total" role="status">全部事件 {indexes.events.length}</p>
      <div className="explorer-body" id={`${id}-panel`} role={mobile ? 'tabpanel' : undefined} aria-labelledby={mobile ? `${id}-${view}` : undefined}>
        {!mobile || view === '搜索' ? search : null}
        {!mobile || view === '筛选' ? <FilterPanel indexes={indexes} eras={eras} state={explorer.state} onChange={explorer.changeFilters} viewportAvailable={viewportAvailable} includeThemes={!mobile} /> : null}
        {mobile && view === '专题' ? <ThemeOptions indexes={indexes} state={explorer.state} onChange={explorer.changeFilters} /> : null}
        {(mobile && view === '事件') || (!mobile && !explorer.state.text.trim()) ? <SearchResults label="匹配事件" results={matches} count={matches.length} selectedId={selectedId} onSelect={select} /> : null}
      </div>
    </aside> : null}
    {mobile ? <div className="explorer-tabs" role="tablist" aria-label="历史探索视图">{views.map(({ name, Icon }) => <button ref={node => { tabs.current[name] = node; }} key={name} type="button" role="tab" id={`${id}-${name}`} aria-controls={`${id}-panel`} aria-selected={open && view === name} tabIndex={view === name ? 0 : -1} onClick={() => { enterPanel.current = true; onOpen?.(); setView(name); setDrawerOpen(true); setActivation(value => value + 1); }} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const index = views.findIndex(item => item.name === name);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + views.length) % views.length;
      const nextView = views[next].name; enterPanel.current = false; onOpen?.(); setView(nextView); setDrawerOpen(true); tabs.current[nextView]?.focus();
    }}><Icon size={17} aria-hidden="true" /><span>{name}</span></button>)}</div> : null}
  </div>;
}
