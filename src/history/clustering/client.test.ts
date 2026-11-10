import { describe, expect, it } from 'vitest';
import { HistoryClusterClient } from './client';
import { createClusterWorkerHandler } from './cluster.worker';
import type { ClusterInput, ClusterRequest, ClusterResponse, ClusterWorker, FrameScheduler } from './protocol';

function fixture() {
  const frames = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  const scheduler: FrameScheduler = { request: callback => { frames.set(++sequence, callback); return sequence; }, cancel: id => { frames.delete(id); } };
  const sent: { request: ClusterRequest; transfer: Transferable[] }[] = [];
  let terminated = false;
  const worker: ClusterWorker = { onmessage: null, onerror: null, postMessage: (request, transfer) => { sent.push({ request, transfer }); }, terminate: () => { terminated = true; } };
  const client = new HistoryClusterClient({ workerFactory: () => worker, scheduler });
  const handle = createClusterWorkerHandler(response => worker.onmessage?.({ data: response } as MessageEvent<ClusterResponse>));
  return { client, worker, sent, frames, get terminated() { return terminated; }, flush() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb(0)); }, respond(index: number) { handle(sent[index].request); } };
}
const projection = (revision: number): ClusterInput => ({ revision, events: [{ id: 'a', x: 100, y: 100, semanticGroup: 'period/theme', visible: true }, { id: 'b', x: 140, y: 100, semanticGroup: 'period/theme', visible: true }], level: 'period', mobile: false, viewport: { width: 800, height: 600 }, protectedIds: [], previousClusters: [] });

describe('clustering Worker bridge', () => {
  it('coalesces to latest projection per frame and transfers compact numeric data through the real handler', async () => {
    const f = fixture();
    const first = f.client.project(projection(1));
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    const second = f.client.project(projection(2));
    await rejected;
    expect(f.sent).toHaveLength(0);
    expect(f.frames.size).toBe(1);
    f.flush();
    expect(f.sent).toHaveLength(1);
    const { request, transfer } = f.sent[0];
    expect(request.projection.positions).toBeInstanceOf(Float32Array);
    expect([...request.projection.positions]).toEqual([100, 100, 140, 100]);
    expect(request.projection.semanticGroups).toEqual(['period/theme']);
    expect([...request.projection.groupIndices]).toEqual([0, 0]);
    expect(transfer).toContain(request.projection.positions.buffer);
    expect(transfer).toContain(request.projection.groupIndices.buffer);
    expect(transfer).toContain(request.projection.visibility.buffer);
    f.respond(0);
    expect(await second).toMatchObject({ revision: 2, clusters: [{ memberIds: ['a', 'b'], count: 2 }], singles: [] });
    f.client.dispose();
  });
  it('applies newest reply and rejects stale pending revisions rather than hanging', async () => {
    const f = fixture();
    const old = f.client.project(projection(1));
    const oldRejected = expect(old).rejects.toMatchObject({ name: 'AbortError' });
    f.flush();
    const newest = f.client.project(projection(3));
    f.flush();
    f.respond(1);
    expect((await newest).revision).toBe(3);
    await oldRejected;
    f.respond(0);
    const stale = f.client.project(projection(2));
    await expect(stale).rejects.toMatchObject({ name: 'AbortError' });
    expect(f.frames.size).toBe(0);
    f.client.dispose();
  });
  it('allows ordered in-flight replies and ignores unsolicited future responses', async () => {
    const f = fixture();
    const a = f.client.project(projection(1)); f.flush();
    const b = f.client.project(projection(2)); f.flush();
    f.worker.onmessage?.({ data: { type: 'result', requestId: 999, result: { revision: 100, clusters: [], singles: [] } } } as MessageEvent<ClusterResponse>);
    f.respond(0); expect((await a).revision).toBe(1);
    f.respond(1); expect((await b).revision).toBe(2);
    f.client.dispose();
  });
  it('cancels scheduled work and settles queued/in-flight promises on dispose', async () => {
    const f = fixture();
    const a = f.client.project(projection(1));
    const ar = expect(a).rejects.toMatchObject({ name: 'AbortError' });
    f.flush();
    const b = f.client.project(projection(2));
    const br = expect(b).rejects.toMatchObject({ name: 'AbortError' });
    f.client.dispose();
    await Promise.all([ar, br]);
    expect(f.frames.size).toBe(0);
    expect(f.terminated).toBe(true);
    expect(f.worker.onmessage).toBeNull();
    expect(f.worker.onerror).toBeNull();
    await expect(f.client.project(projection(3))).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('settles transport failures and Worker errors without leaving scheduled work', async () => {
    const f = fixture();
    const p = f.client.project(projection(1));
    const rejected = expect(p).rejects.toThrow('crashed');
    f.worker.onerror?.({ message: 'crashed' } as ErrorEvent);
    await rejected;
    expect(f.frames.size).toBe(0);
    expect(f.terminated).toBe(true);
    await expect(f.client.project(projection(2))).rejects.toThrow('crashed');
  });
  it('preserves visibility, protected IDs and prior membership across serialization', async () => {
    const f = fixture();
    const value = projection(5);
    value.events = [...value.events, { id: 'clipped', x: 110, y: 100, semanticGroup: 'period/theme', visible: false }];
    value.events[1].x = 152;
    value.previousClusters = [{ id: 'old', memberIds: ['a', 'b'] }];
    const p = f.client.project(value); f.flush(); f.respond(0);
    expect((await p).clusters[0].memberIds).toEqual(['a', 'b']);
    value.protectedIds = ['a'];
    const next = f.client.project({ ...value, revision: 6 }); f.flush(); f.respond(1);
    expect((await next).singles.map(point => point.id)).toEqual(['a', 'b']);
    f.client.dispose();
  });
  it('rejects startup and postMessage failures deterministically', async () => {
    const scheduler: FrameScheduler = { request: () => 1, cancel: () => {} };
    const unavailable = new HistoryClusterClient({ scheduler, workerFactory: () => { throw new Error('unavailable'); } });
    await expect(unavailable.project(projection(1))).rejects.toThrow('unavailable');
    unavailable.dispose();
    const f = fixture();
    f.worker.postMessage = () => { throw new Error('transfer failed'); };
    const p = f.client.project(projection(1));
    const rejected = expect(p).rejects.toThrow('transfer failed');
    f.flush();
    await rejected;
    expect(f.terminated).toBe(true);
    expect(f.frames.size).toBe(0);
  });
  it('reports handler errors to the matching promise and continues with the next revision', async () => {
    const f = fixture();
    const bad = f.client.project(projection(1));
    const rejected = expect(bad).rejects.toThrow();
    f.flush();
    f.sent[0].request.projection.positions = null as unknown as Float32Array;
    f.respond(0);
    await rejected;
    const good = f.client.project(projection(2)); f.flush(); f.respond(1);
    expect((await good).clusters[0].count).toBe(2);
    f.client.dispose();
  });
  it('snapshots caller data and remains usable after actual transferable detachment', async () => {
    const f = fixture();
    const value = projection(1);
    const p = f.client.project(value);
    value.events[0].x = 700;
    value.protectedIds = ['a'];
    f.flush();
    const sent = f.sent[0];
    const wire = structuredClone(sent.request, { transfer: sent.transfer });
    expect(sent.request.projection.positions.byteLength).toBe(0);
    const handle = createClusterWorkerHandler(response => f.worker.onmessage?.({ data: response } as MessageEvent<ClusterResponse>));
    handle(wire);
    expect((await p).clusters[0].memberIds).toEqual(['a', 'b']);
    expect(value.events[0].x).toBe(700);
    f.client.dispose();
  });

});
