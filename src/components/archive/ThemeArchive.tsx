import type { ThemeArchive as ThemeArchiveData } from '../../history/content/schema';
import { ArchiveProse, ArchiveSection, EntityList } from './ArchivePrimitives';
import { SourcesList } from './SourcesList';

export function ThemeArchive({ theme }: { theme: ThemeArchiveData }) {
  return <article className="archive-reading">
    <header className="archive-header"><p className="archive-kicker">主题档案 · {theme.eventIds.length} 个事件</p><h1>{theme.title}</h1><ArchiveProse>{theme.summary}</ArchiveProse></header>
    <ArchiveSection title="主题旅程"><ol className="archive-journey" aria-label="主题旅程">{theme.chapters.map((chapter, index) => <li key={index}><h3>{chapter.title}</h3><ArchiveProse>{chapter.description}</ArchiveProse><EntityList kind="event" ids={chapter.eventIds} /></li>)}</ol></ArchiveSection>
    <ArchiveSection title="相关事件"><EntityList kind="event" ids={theme.eventIds} /></ArchiveSection>
    <ArchiveSection title="参考资料"><SourcesList sourceIds={theme.sourceIds} /></ArchiveSection>
  </article>;
}
