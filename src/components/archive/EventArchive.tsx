import type { HistoryEventArchive } from '../../history/content/schema';
import { ArchiveProse, ArchiveSection, EntityList, PlaceList, ProseList, categoryNames, historyDate } from './ArchivePrimitives';
import { EventRelationships } from './EventRelationships';
import { SourcesList } from './SourcesList';

export function EventArchive({ event }: { event: HistoryEventArchive }) {
  return <article className="archive-reading">
    <header className="archive-header"><p className="archive-kicker">事件档案 · {event.period}</p><h1>{event.title}</h1><p className="archive-date">{historyDate(event.startYear, event.endYear, event.yearPrecision)}</p></header>
    <ArchiveSection title="事件概览"><ArchiveProse>{event.summary}</ArchiveProse><dl className="archive-facts"><div><dt>时代</dt><dd>{event.period}</dd></div><div><dt>类别</dt><dd>{event.categories.map(id => categoryNames[id]).join('、')}</dd></div><div><dt>影响力</dt><dd>{event.influence} 级</dd></div>{event.aliases.length ? <div><dt>别称</dt><dd>{event.aliases.join('、')}</dd></div> : null}</dl>{event.themeIds.length ? <><h3>相关主题</h3><EntityList kind="theme" ids={event.themeIds} label="相关主题" /></> : null}</ArchiveSection>
    <ArchiveSection title="历史背景"><ArchiveProse>{event.background}</ArchiveProse></ArchiveSection>
    <ArchiveSection title="原因"><ProseList items={event.causes} /></ArchiveSection>
    <ArchiveSection title="发展过程"><ol className="archive-timeline" aria-label="发展过程">{[...event.course].sort((a, b) => a.year - b.year).map((entry, index) => <li key={index}><time>{historyDate(entry.year)}</time><div><h3>{entry.title}</h3><ArchiveProse>{entry.description}</ArchiveProse></div></li>)}</ol></ArchiveSection>
    <ArchiveSection title="结果"><ProseList items={event.results} /></ArchiveSection>
    <ArchiveSection title="影响">{event.impacts.map((impact, index) => <div key={index} className="archive-impact"><h3>{categoryNames[impact.dimension]}</h3><ArchiveProse>{impact.text}</ArchiveProse></div>)}</ArchiveSection>
    <ArchiveSection title="人物"><EntityList kind="person" ids={event.personIds} label="相关人物" /></ArchiveSection>
    <ArchiveSection title="地点"><PlaceList ids={event.placeIds} /></ArchiveSection>
    <ArchiveSection title="关系图"><p className="archive-note">沿事件之间已记录的联系继续阅读。</p><EventRelationships event={event} /></ArchiveSection>
    <ArchiveSection title="史学说明"><ArchiveProse>{event.historiography}</ArchiveProse></ArchiveSection>
    <ArchiveSection title="参考资料"><SourcesList sourceIds={event.sourceIds} /></ArchiveSection>
  </article>;
}
