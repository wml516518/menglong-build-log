import { useEffect, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { useHistoryContent } from '../../history/content/store';
import { formatHistoryYear, type YearPrecision, type CategoryId } from '../../history/content/schema';
import { parseHash } from '../../routes';

export const categoryNames: Record<CategoryId, string> = { politics: '政治', war: '战争', institution: '制度', economy: '经济', science: '科技', culture: '文化', thought: '思想', religion: '宗教', diplomacy: '外交', ethnicity: '民族', society: '社会' };
export function MissingRecord() { return <span className="archive-missing">资料整理中</span>; }
export function historyDate(start: number, end = start, precision: YearPrecision = 'exact') {
  return start === end ? formatHistoryYear(start, precision) : `${formatHistoryYear(start, precision)} — ${formatHistoryYear(end, precision)}`;
}
export type ArchiveKind = 'event' | 'person' | 'theme';
export function ArchiveLink({ kind, id, children, className }: { kind: ArchiveKind; id: string; children: ReactNode; className?: string }) {
  // App's Task 5 click listener marks same-tab archive entries before hashchange,
  // including the exact current query written by the explorer with replaceState.
  return <a className={className} href={`#/history-galaxy/${kind}/${encodeURIComponent(id)}`}>{children}</a>;
}
export function EntityLink({ kind, id }: { kind: ArchiveKind; id: string }) {
  const { events, people, themes, manifest } = useHistoryContent();
  const name = kind === 'event' ? events.find(event => event.id === id)?.title : kind === 'person' ? people.find(person => person.id === id)?.name : themes.find(theme => theme.id === id)?.title;
  const mapping = kind === 'event' ? manifest?.eventEras : kind === 'person' ? manifest?.personEras : manifest?.themeArchives;
  return name && mapping && Object.hasOwn(mapping, id) ? <ArchiveLink kind={kind} id={id}>{name}</ArchiveLink> : <MissingRecord />;
}
export function EntityList({ ids, kind, label }: { ids: string[]; kind: ArchiveKind; label?: string }) {
  return ids.length ? <ul className="archive-entity-list" aria-label={label}>{ids.map(id => <li key={id}><EntityLink kind={kind} id={id} /></li>)}</ul> : <p><MissingRecord /></p>;
}
export function PlaceList({ ids }: { ids: string[] }) {
  const { places } = useHistoryContent();
  return ids.length ? <ul className="archive-entity-list">{ids.map(id => {
    const place = places.find(item => item.id === id);
    return <li key={id}>{place ? <><span>{place.name}</span><small>今 {place.modernName}</small></> : <MissingRecord />}</li>;
  })}</ul> : <p><MissingRecord /></p>;
}
export function ArchiveProse({ children }: { children: string }) {
  return <div className="archive-prose"><ReactMarkdown skipHtml urlTransform={url => url.startsWith('https://') || url.startsWith('#') ? url : ''} components={{
    a: ({ href, children }) => {
      if (!href) return <span>{children}</span>;
      const route = parseHash(href);
      if (route.view === 'history-event' || route.view === 'history-person' || route.view === 'history-theme') {
        return <ArchiveLink kind={route.view.replace('history-', '') as ArchiveKind} id={route.id}>{children}</ArchiveLink>;
      }
      return href.startsWith('https://') ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <a href={href}>{children}</a>;
    }
  }}>{children}</ReactMarkdown></div>;
}
export function ProseList({ items }: { items: string[] }) {
  return items.length ? <ul className="archive-prose-list">{items.map((item, index) => <li key={index}><ArchiveProse>{item}</ArchiveProse></li>)}</ul> : <p><MissingRecord /></p>;
}
export function ArchiveSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="archive-section"><h2>{title}</h2>{children}</section>;
}
export type ResourceState<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; value: T };
export function useArchiveResource<T>(load: () => Promise<T>, enabled = true) {
  const [state, setState] = useState<ResourceState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState({ status: 'loading' });
    void load().then(value => { if (active) setState({ status: 'ready', value }); }, () => { if (active) setState({ status: 'error' }); });
    return () => { active = false; };
  }, [load, enabled, attempt]);
  return { state, retry: () => setAttempt(value => value + 1) };
}
