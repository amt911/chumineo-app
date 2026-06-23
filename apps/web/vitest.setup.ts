import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom does not implement IntersectionObserver — stub it for tests that render
// components with infinite-scroll sentinels.
const mockIntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

Object.defineProperty(globalThis, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: mockIntersectionObserver,
});
