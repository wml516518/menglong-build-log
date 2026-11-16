import { EXPLORER_QUERY_KEYS, parseExplorerState, serializeExplorerState, type HistoryExplorerState } from './explorer/state';
import { CAMERA_TARGET_BOUNDS, MAX_CAMERA_DISTANCE, MIN_CAMERA_DISTANCE, STAR_OFFSET_LIMITS } from './sceneLimits';
import { TIMELINE_LAYOUT_VERSION } from './timelineLayout';

export const HISTORY_SESSION_KEY = 'history-galaxy-session-v2';
export interface HistoryCameraState { target: readonly [number, number, number]; distance: number; timelineLayout?: typeof TIMELINE_LAYOUT_VERSION }
export type HistoryExplorerEntityIds = Record<'eraIds' | 'personIds' | 'placeIds' | 'themeIds', ReadonlySet<string>>;
export type HistoryFixedOffsets = Readonly<Record<string, readonly [number, number]>>;
export interface HistorySession {
  version: 2;
  camera?: Partial<HistoryCameraState>;
  explorer?: HistoryExplorerState;
  selectedId?: string | null;
  fixedOffsets?: HistoryFixedOffsets;
}
type SessionStorage = Pick<Storage, 'getItem' | 'setItem'>;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const tuple = (value: unknown, length: number): value is number[] => Array.isArray(value) && value.length === length && value.every(finite);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

function sanitizeExplorer(value: Record<string, unknown>, entityIds?: HistoryExplorerEntityIds): HistoryExplorerState {
  const state = parseExplorerState(new URLSearchParams());
  if (typeof value.text === 'string') state.text = value.text;
  for (const key of ['eraIds', 'categories', 'personIds', 'placeIds', 'themeIds'] as const) {
    if (Array.isArray(value[key])) (state[key] as string[]) = value[key].filter(validId);
  }
  if (entityIds) for (const key of ['eraIds', 'personIds', 'placeIds', 'themeIds'] as const) {
    state[key] = state[key].filter(id => entityIds[key].has(id));
  }
  for (const key of ['minInfluence', 'fromYear', 'toYear'] as const) {
    if (finite(value[key])) (state[key] as number) = Math.round(value[key]);
  }
  for (const key of ['majorOnly', 'viewportOnly'] as const) if (typeof value[key] === 'boolean') state[key] = value[key];
  return parseExplorerState(serializeExplorerState(state));
}

/** Whitelist serializable view state. Valid IDs are supplied only after indexes settle. */
export function sanitizeHistorySession(value: unknown, validIds?: ReadonlySet<string>): HistorySession | null {
  if (!record(value) || value.version !== 2) return null;
  const result: HistorySession = { version: 2 };
  if (record(value.camera)) {
    const camera: Partial<HistoryCameraState> = {};
    if (value.camera.timelineLayout === TIMELINE_LAYOUT_VERSION) camera.timelineLayout = TIMELINE_LAYOUT_VERSION;
    if (tuple(value.camera.target, 3)) camera.target = value.camera.target.map((number, index) => index === 0 && camera.timelineLayout
      ? clamp(number, -4096, 4096)
      : clamp(number, CAMERA_TARGET_BOUNDS[index][0], CAMERA_TARGET_BOUNDS[index][1])) as [number, number, number];
    if (finite(value.camera.distance)) camera.distance = clamp(value.camera.distance, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
    if (Object.keys(camera).length) result.camera = camera;
  }
  if (record(value.explorer)) result.explorer = sanitizeExplorer(value.explorer);
  if (value.selectedId === null || (validId(value.selectedId) && (!validIds || validIds.has(value.selectedId)))) result.selectedId = value.selectedId;
  if (record(value.fixedOffsets)) {
    result.fixedOffsets = Object.fromEntries(Object.entries(value.fixedOffsets).flatMap(([id, offset]) => validId(id) && (!validIds || validIds.has(id)) && tuple(offset, 2)
      ? [[id, [clamp(offset[0], -STAR_OFFSET_LIMITS[0], STAR_OFFSET_LIMITS[0]), clamp(offset[1], -STAR_OFFSET_LIMITS[1], STAR_OFFSET_LIMITS[1])]]]
      : []));
  }
  return result;
}

export function parseHistorySession(raw: string | null, validIds?: ReadonlySet<string>): HistorySession | null {
  try { return raw ? sanitizeHistorySession(JSON.parse(raw), validIds) : null; } catch { return null; }
}
export function loadHistorySession(storage?: SessionStorage, validIds?: ReadonlySet<string>): HistorySession | null {
  try { return parseHistorySession((storage ?? globalThis.localStorage).getItem(HISTORY_SESSION_KEY), validIds); } catch { return null; }
}
export function saveHistorySession(value: unknown, storage?: SessionStorage, validIds?: ReadonlySet<string>): boolean {
  try {
    const session = sanitizeHistorySession(value, validIds);
    if (!session) return false;
    (storage ?? globalThis.localStorage).setItem(HISTORY_SESSION_KEY, JSON.stringify(session));
    return true;
  } catch { return false; }
}

/** Clean stored references first; even an unknown or empty explicit URL value wins. */
export function resolveSessionExplorer(stored: unknown, params: URLSearchParams, entityIds?: HistoryExplorerEntityIds): HistoryExplorerState {
  const restored = record(stored) ? serializeExplorerState(sanitizeExplorer(stored, entityIds)) : new URLSearchParams();
  for (const key of EXPLORER_QUERY_KEYS) if (params.has(key)) {
    restored.delete(key);
    params.getAll(key).forEach(value => restored.append(key, value));
  }
  return parseExplorerState(restored);
}
