import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// happy-dom does not faithfully implement cancelled Web Animations promises.
delete (Element.prototype as Partial<Element>).animate;
