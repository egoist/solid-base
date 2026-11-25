import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { attribution } from 'solid-js/attribution';

// The dev server enables attribution, which reports effect write cycles
// (`EFFECT_WRITES_OWN_SOURCE`, `EFFECT_RELAY_TEAR`, ...). Enable it here too.
// Opt in with `ATTRIBUTION=on` while the remaining reports are being fixed.
if (process.env.ATTRIBUTION === 'on') {
  attribution.enable({ log: false });
}

/**
 * Solid dev builds report reactivity mistakes as `[CODE] message` diagnostics.
 * Treat any of them as a test failure so ports stay idiomatic.
 */
const diagnostics: string[] = [];
const DIAGNOSTIC_PATTERN = /\[[A-Z][A-Z0-9_]{3,}\]/;
// Timing hints depend on machine load (jsdom's first style computation is slow), not on code.
const IGNORED_DIAGNOSTICS = /\[HOT_SCOPE_TIME\]/;

for (const method of ['warn', 'error'] as const) {
  const original = console[method].bind(console);
  console[method] = (...args: unknown[]) => {
    const message = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    if (DIAGNOSTIC_PATTERN.test(message) && !IGNORED_DIAGNOSTICS.test(message)) {
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
