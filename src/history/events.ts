import compatibility from './generated/compat-index.json';
import type { Dynasty, HistoryEvent } from './types';

// Temporary synchronous view; the compiler validates these records and tuple fields.
export const dynasties = compatibility.dynasties as Dynasty[];
export const historyEvents = compatibility.historyEvents as unknown as HistoryEvent[];
