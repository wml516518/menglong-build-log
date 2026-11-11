import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

const storage = new Map<string, string>();

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    clear: () => storage.clear(),
    getItem: (key: string) => storage.get(key) ?? null,
    removeItem: (key: string) => storage.delete(key),
    setItem: (key: string, value: string) => storage.set(key, value)
  }
});

// Each test starts a new browsing session; remounts inside a test still restore.
beforeEach(() => localStorage.clear());
