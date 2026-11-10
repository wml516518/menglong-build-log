import { buildSearchDocuments, fallbackSearch } from './fallback';
import type { SearchDocument, SearchIndexes, SearchQuery, SearchResult, SearchResponse, SearchWorker, SearchWorkerFactory } from './protocol';

export interface HistorySearchClientOptions { indexes: SearchIndexes; workerFactory?: SearchWorkerFactory }
const abortError = () => new DOMException('Search query was superseded or disposed', 'AbortError');
const browserWorkerFactory: SearchWorkerFactory = () => new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });

export class HistorySearchClient {
  private readonly documents: SearchDocument[];
  private worker?: SearchWorker;
  private disposed = false;
  private requestId = 0;
  private pending?: { requestId: number; resolve: (results: SearchResult[]) => void; reject: (error: Error) => void };

  constructor({ indexes, workerFactory = browserWorkerFactory }: HistorySearchClientOptions) {
    this.documents = buildSearchDocuments(indexes);
    try {
      this.worker = workerFactory();
      this.worker.onmessage = event => this.receive(event.data);
      this.worker.onerror = event => this.fail(new Error(event.message || 'Search worker failed'));
      this.worker.postMessage({ type: 'init', requestId: 0, documents: this.documents });
    } catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); }
  }

  /** Only the latest in-flight query survives; superseded promises reject with AbortError. */
  query(query: SearchQuery): Promise<SearchResult[]> {
    if (this.disposed) return Promise.reject(abortError());
    this.pending?.reject(abortError());
    this.pending = undefined;
    const requestId = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending = { requestId, resolve, reject };
      if (!this.worker) {
        // Keep the same latest-query semantics even when fallback resolves in a microtask.
        queueMicrotask(() => {
          if (this.pending?.requestId !== requestId) return;
          this.pending = undefined;
          try { resolve(fallbackSearch(this.documents, query)); }
          catch (error) { reject(error); }
        });
      } else {
        try { this.worker.postMessage({ type: 'query', requestId, query }); }
        catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); }
      }
    });
  }

  private receive(response: SearchResponse): void {
    if (this.disposed || !this.worker || response.type === 'ready') return;
    if (response.type === 'error') {
      // Even a stale query's worker error is unrecoverable for this session.
      this.fail(new Error(response.message));
    } else if (this.pending?.requestId === response.requestId) {
      const pending = this.pending;
      this.pending = undefined;
      pending.resolve(response.results);
    }
  }

  private stopWorker(): void {
    const worker = this.worker;
    this.worker = undefined;
    if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); }
  }
  private fail(error: Error): void {
    this.stopWorker();
    this.pending?.reject(error);
    this.pending = undefined;
  }
  dispose(): void {
    this.disposed = true;
    this.stopWorker();
    this.pending?.reject(abortError());
    this.pending = undefined;
  }
}
