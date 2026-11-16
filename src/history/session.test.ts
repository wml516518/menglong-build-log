import { parseExplorerState } from './explorer/state';
import { loadHistorySession, parseHistorySession, resolveSessionExplorer, sanitizeHistorySession, saveHistorySession } from './session';

const explorer = () => ({ ...parseExplorerState(new URLSearchParams()), text: '唐', eraIds: ['tang'], categories: ['war'] as const, minInfluence: 3, fromYear: 618, toYear: 907, majorOnly: true });
const session = () => ({ version: 2, camera: { target: [-12, 2, 1], distance: 24 }, explorer: explorer(), selectedId: 'zhenguan', fixedOffsets: { zhenguan: [1.2, -0.5] } });
const validIds = new Set(['zhenguan']);

it('round trips only the v2 local session fields, preserving no archive prose or indexes', () => {
  const storage = { getItem: vi.fn(() => ''), setItem: vi.fn() };
  expect(saveHistorySession({ ...session(), prose: 'must not persist', events: [{ id: 'other' }] }, storage, validIds)).toBe(true);
  expect(storage.setItem).toHaveBeenCalledTimes(1);
  const [key, value] = storage.setItem.mock.calls[0];
  expect(key).toBe('history-galaxy-session-v2');
  expect(JSON.parse(value)).toEqual(session());
  storage.getItem.mockReturnValue(value);
  expect(loadHistorySession(storage, validIds)).toEqual(session());
});

it.each([null, '', '{bad', 'null', '[]', '{"version":1}', '{"version":"2"}', '{"version":3}'])('rejects invalid or incompatible stored session %j', raw => {
  expect(parseHistorySession(raw, validIds)).toBeNull();
});

it('drops malformed fields and unknown IDs while clamping finite camera and released drag values', () => {
  expect(sanitizeHistorySession({ version: 2, camera: { target: [-999, 100, -100], distance: 999 }, selectedId: 'gone', fixedOffsets: { zhenguan: [100, -100], gone: [1, 1], broken: ['bad', 0] } }, validIds)).toEqual({ version: 2, camera: { target: [-32, 12, -12], distance: 90 }, fixedOffsets: { zhenguan: [2.6, -2.4] } });
  expect(sanitizeHistorySession({ version: 2, camera: { target: [NaN, 1, 2], distance: 1 }, selectedId: [], explorer: { text: 123, eraIds: ['tang', 3, '<invalid>'], categories: ['war', 'fake'], fromYear: -9999, toYear: 9999, minInfluence: 100, majorOnly: 'yes' }, fixedOffsets: { zhenguan: [Infinity, 0] } }, validIds)).toEqual({ version: 2, camera: { distance: 4 }, explorer: { ...parseExplorerState(new URLSearchParams()), eraIds: ['tang'], categories: ['war'], minInfluence: 5 }, fixedOffsets: {} });
});

it('keeps explicit URL keys authoritative, including empty or invalid values, and restores absent keys', () => {
  const state = resolveSessionExplorer(explorer(), new URLSearchParams('q=&cat=culture&era=unknown&min=bad&major=0&keep=ok'));
  expect(state).toEqual({ ...parseExplorerState(new URLSearchParams()), eraIds: ['unknown'], categories: ['culture'], fromYear: 618, toYear: 907 });
  expect(resolveSessionExplorer(explorer(), new URLSearchParams('keep=ok'))).toEqual(explorer());
});

it('round trips the elongated timeline camera without truncating it to legacy bounds', () => {
  const camera = { target: [1420, 2, -1], distance: 18, timelineLayout: 'spaced-v1' };
  expect(sanitizeHistorySession({ version: 2, camera })?.camera).toEqual(camera);
  expect(sanitizeHistorySession({ version: 2, camera: { ...camera, target: [1e8, 100, -100] } })?.camera?.target).toEqual([4096, 12, -12]);
  expect(sanitizeHistorySession({ version: 2, camera: { ...camera, timelineLayout: 'unknown' } })?.camera).toEqual({ target: [32, 2, -1], distance: 18 });
});

it('survives denied reads/writes, quota failures, and a denied localStorage getter', () => {
  const denied = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
  expect(loadHistorySession(denied)).toBeNull();
  expect(saveHistorySession(session(), denied)).toBe(false);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('disabled'); } });
  try { expect(loadHistorySession()).toBeNull(); expect(saveHistorySession(session())).toBe(false); }
  finally { Object.defineProperty(globalThis, 'localStorage', descriptor); }
});

const currentEntities = {
  eraIds: new Set(['tang', 'pre-qin']),
  personIds: new Set(['person-li-shimin']),
  placeIds: new Set(['changan']),
  themeIds: new Set(['institutions'])
};
const storedEntities = () => ({
  ...explorer(),
  eraIds: ['removed-era', 'tang', 'pre-qin'],
  personIds: ['person-li-shimin', 'removed-person'],
  placeIds: ['changan', 'removed-place'],
  themeIds: ['institutions', 'removed-theme']
});

it('drops stored entity IDs absent from the settled manifest/index sets before URL restoration', () => {
  const stored = storedEntities();
  expect(resolveSessionExplorer(stored, new URLSearchParams(), currentEntities)).toEqual({
    ...explorer(), eraIds: ['pre-qin', 'tang'], personIds: ['person-li-shimin'], placeIds: ['changan'], themeIds: ['institutions']
  });
  expect(stored.eraIds).toEqual(['removed-era', 'tang', 'pre-qin']);
});

it.each([
  ['era', 'eraIds', 'unknown-era'],
  ['person', 'personIds', 'unknown-person'],
  ['place', 'placeIds', 'unknown-place'],
  ['theme', 'themeIds', 'unknown-theme']
] as const)('preserves explicit unknown URL %s values while cleaning every stored entity dimension', (key, field, unknown) => {
  expect(resolveSessionExplorer(storedEntities(), new URLSearchParams(`${key}=${unknown}`), currentEntities)).toEqual({
    ...explorer(), eraIds: ['pre-qin', 'tang'], personIds: ['person-li-shimin'], placeIds: ['changan'], themeIds: ['institutions'], [field]: [unknown]
  });
});
