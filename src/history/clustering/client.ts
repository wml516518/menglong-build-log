import { packProjection } from './protocol';
import type { ClusterInput, ClusterResponse, ClusterResult, ClusterWorker, FrameScheduler, PackedProjection } from './protocol';

export interface HistoryClusterClientOptions { workerFactory?: () => ClusterWorker; scheduler?: FrameScheduler }
interface Pending { revision: number; resolve: (result: ClusterResult) => void; reject: (error: Error) => void }
const abortError = () => new DOMException('Projection was superseded, stale or disposed', 'AbortError');
const browserWorkerFactory = (): ClusterWorker => new Worker(new URL('./cluster.worker.ts', import.meta.url), { type: 'module' });
const browserScheduler: FrameScheduler = { request: callback => requestAnimationFrame(callback), cancel: handle => cancelAnimationFrame(handle) };

export class HistoryClusterClient {
  private worker?: ClusterWorker;
  private readonly scheduler: FrameScheduler;
  private pending = new Map<number, Pending>();
  private queued?: { requestId: number; projection: PackedProjection };
  private frame?: number;
  private requestId = 0;
  private lastAppliedRevision = -Infinity;
  private disposed = false;
  private failure?: Error;

  constructor({ workerFactory = browserWorkerFactory, scheduler = browserScheduler }: HistoryClusterClientOptions = {}) {
    this.scheduler = scheduler;
    try {
      this.worker = workerFactory();
      this.worker.onmessage = event => this.receive(event.data);
      this.worker.onerror = event => this.fail(new Error(event.message || 'Clustering worker failed'));
    } catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); }
  }

  project(input: ClusterInput): Promise<ClusterResult> {
    if (this.disposed) return Promise.reject(abortError());
    if (this.failure) return Promise.reject(this.failure);
    if (input.revision <= this.lastAppliedRevision) return Promise.reject(abortError());
    if (this.queued) { this.pending.get(this.queued.requestId)?.reject(abortError()); this.pending.delete(this.queued.requestId); }
    const requestId = ++this.requestId;
    return new Promise((resolve, reject) => {
      try {
        const projection = packProjection(input);
        this.pending.set(requestId, { revision: input.revision, resolve, reject });
        this.queued = { requestId, projection };
        if (this.frame === undefined) this.frame = this.scheduler.request(() => this.flush());
      } catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); reject(error); }
    });
  }

  private flush(): void {
    this.frame = undefined;
    const queued = this.queued;
    this.queued = undefined;
    if (!queued || !this.worker) return;
    try {
      const { projection } = queued;
      this.worker.postMessage({ type: 'cluster', ...queued }, [projection.positions.buffer, projection.groupIndices.buffer, projection.visibility.buffer]);
    } catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); }
  }

  private receive(response: ClusterResponse): void {
    const pending = this.pending.get(response.requestId);
    if (!pending || this.disposed || this.failure) return;
    this.pending.delete(response.requestId);
    if (response.type === 'error') { pending.reject(new Error(response.message)); return; }
    if (response.result.revision !== pending.revision || pending.revision <= this.lastAppliedRevision) { pending.reject(abortError()); return; }
    this.lastAppliedRevision = pending.revision;
    pending.resolve(response.result);
    // A newer result makes all earlier unresolved projections obsolete, including
    // a queued request that has not reached the Worker yet.
    for (const [id, earlier] of this.pending) {
      if (earlier.revision <= this.lastAppliedRevision) {
        earlier.reject(abortError()); this.pending.delete(id);
        if (this.queued?.requestId === id) { this.queued = undefined; this.cancelFrame(); }
      }
    }
  }
  private cancelFrame(): void { if (this.frame !== undefined) { this.scheduler.cancel(this.frame); this.frame = undefined; } }
  private stop(error: Error): void {
    this.cancelFrame(); this.queued = undefined;
    if (this.worker) { this.worker.onmessage = null; this.worker.onerror = null; this.worker.terminate(); this.worker = undefined; }
    this.pending.forEach(pending => pending.reject(error)); this.pending.clear();
  }
  private fail(error: Error): void { this.failure = error; this.stop(error); }
  dispose(): void { this.disposed = true; this.stop(abortError()); }
}
