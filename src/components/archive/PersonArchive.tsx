import type { PersonArchive as PersonArchiveData } from '../../history/content/schema';
import { ArchiveProse, ArchiveSection, EntityLink, EntityList, MissingRecord, PlaceList, ProseList, historyDate } from './ArchivePrimitives';
import { SourcesList } from './SourcesList';

export function PersonArchive({ person }: { person: PersonArchiveData }) {
  const lifespan = person.birthYear !== null && person.deathYear !== null ? historyDate(person.birthYear, person.deathYear, person.yearPrecision) : person.birthYear !== null ? `${historyDate(person.birthYear, person.birthYear, person.yearPrecision)}出生 · 卒年不详` : person.deathYear !== null ? `生年不详 · ${historyDate(person.deathYear, person.deathYear, person.yearPrecision)}逝世` : '生卒年不详';
  return <article className="archive-reading">
    <header className="archive-header"><p className="archive-kicker">人物档案</p><h1>{person.name}</h1><p className="archive-date">{lifespan}</p></header>
    <ArchiveSection title="人物概览"><ArchiveProse>{person.summary}</ArchiveProse>{person.aliases.length ? <p className="archive-note">别称：{person.aliases.join('、')}</p> : null}{person.birthplaceId ? <><h3>出生地</h3><PlaceList ids={[person.birthplaceId]} /></> : null}{person.placeIds.length ? <><h3>相关地点</h3><PlaceList ids={person.placeIds} /></> : null}</ArchiveSection>
    <ArchiveSection title="生平年表"><ol className="archive-timeline" aria-label="生平年表">{[...person.timeline].sort((a, b) => a.year - b.year).map((entry, index) => <li key={index}><time>{historyDate(entry.year)}</time><div><h3>{entry.title}</h3><ArchiveProse>{entry.description}</ArchiveProse></div></li>)}</ol></ArchiveSection>
    <ArchiveSection title="身份变化">{person.identities.length ? <ol className="archive-timeline">{[...person.identities].sort((a, b) => a.startYear - b.startYear).map((identity, index) => <li key={index}><time>{historyDate(identity.startYear, identity.endYear)}</time><ArchiveProse>{identity.description}</ArchiveProse></li>)}</ol> : <p><MissingRecord /></p>}</ArchiveSection>
    <ArchiveSection title="贡献"><ProseList items={person.contributions} /></ArchiveSection>
    <ArchiveSection title="著作与遗迹"><h3>著作</h3><ProseList items={person.works} /><h3>遗迹</h3><ProseList items={person.relics} /></ArchiveSection>
    <ArchiveSection title="人物关系">{person.relations.length ? <ul className="archive-person-relations">{person.relations.map((relation, index) => <li key={index}><div><EntityLink kind="person" id={relation.personId} /><span className="relation-label">{relation.type}</span></div><ArchiveProse>{relation.description}</ArchiveProse></li>)}</ul> : <p><MissingRecord /></p>}</ArchiveSection>
    <ArchiveSection title="相关事件"><EntityList kind="event" ids={person.eventIds} label="人物相关事件" /></ArchiveSection>
    <ArchiveSection title="评价"><ArchiveProse>{person.evaluation}</ArchiveProse></ArchiveSection>
    <ArchiveSection title="后世影响"><ArchiveProse>{person.legacy}</ArchiveProse></ArchiveSection>
    <ArchiveSection title="史学说明"><ArchiveProse>{person.historiography}</ArchiveProse></ArchiveSection>
    <ArchiveSection title="参考资料"><SourcesList sourceIds={person.sourceIds} /></ArchiveSection>
  </article>;
}
