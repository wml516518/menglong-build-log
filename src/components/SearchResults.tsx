import { Crosshair } from 'lucide-react';

export interface ExplorerResult { id: string; title: string; year: number; influence: number }
export function SearchResults({ results, selectedId, onSelect, label = '搜索结果', busy = false }: { results: readonly ExplorerResult[]; selectedId: string | null; onSelect: (id: string) => void; label?: string; busy?: boolean }) {
  return <div className="explorer-results" aria-busy={busy}>
    <div className="explorer-results-meta" role="status">{busy ? '正在查找…' : `${results.length} 个匹配事件`}</div>
    <ol className="explorer-result-list" aria-label={label}>
      {results.map(result => <li key={result.id}>
        <button type="button" aria-label={`聚焦历史事件：${result.year}年 ${result.title}`} aria-pressed={selectedId === result.id} onClick={() => onSelect(result.id)}>
          <time>{result.year < 0 ? `前${-result.year}` : result.year}</time><span><strong>{result.title}</strong><small>影响力 {result.influence} 级</small></span><Crosshair aria-hidden="true" size={15} />
        </button>
      </li>)}
    </ol>
    {!busy && !results.length ? <p className="explorer-empty">没有匹配事件，试试其他关键词或放宽筛选。</p> : null}
  </div>;
}
