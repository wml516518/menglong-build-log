import { clusterEvents } from './cluster';
import { unpackProjection } from './protocol';
import type { ClusterRequest, ClusterResponse } from './protocol';

/** Shared by the module Worker entry point and transport boundary tests. */
export function createClusterWorkerHandler(send: (response: ClusterResponse) => void) {
  return (request: ClusterRequest): void => {
    try { send({ type: 'result', requestId: request.requestId, result: clusterEvents(unpackProjection(request.projection)) }); }
    catch (error) { send({ type: 'error', requestId: request.requestId, message: error instanceof Error ? error.message : String(error) }); }
  };
}
if (typeof self !== 'undefined' && typeof document === 'undefined') {
  const scope = self as unknown as { onmessage: ((event: MessageEvent<ClusterRequest>) => void) | null; postMessage(response: ClusterResponse): void };
  const handle = createClusterWorkerHandler(response => scope.postMessage(response));
  scope.onmessage = event => handle(event.data);
}
