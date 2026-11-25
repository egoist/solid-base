import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';

/**
 * Solid dev builds report reactivity mistakes as `[CODE] message` diagnostics.
 * Treat any of them as a test failure so ports stay idiomatic.
 */
const diagnostics: string[] = [];
const DIAGNOSTIC_PATTERN = /\[[A-Z][A-Z0-9_]{3,}\]/;

for (const method of ['warn', 'error'] as const) {
  const original = console[method].bind(console);
  console[method] = (...args: unknown[]) => {
    const message = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    if (DIAGNOSTIC_PATTERN.test(message)) {
      diagnostics.push(message);
    }
    original(...args);
  };
}

beforeEach(() => {
  diagnostics.length = 0;
});

afterEach(() => {
  if (diagnostics.length > 0) {
    const reported = diagnostics.splice(0).join('\n\n');
    throw new Error(`Solid reported reactivity diagnostics:\n${reported}`);
  }
});
