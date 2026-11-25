import { afterEach } from 'vitest';
import { OBSERVE } from 'solid-js';

/**
 * Fail a server-rendering test on any Solid diagnostic (e.g. `SERVER_WRITE`). The diagnostics
 * channel delivers every event (the config makes Solid report every server write, not only the
 * first one); the console only shows the first of each code.
 */
const diagnostics: string[] = [];

OBSERVE?.diagnostics.subscribe((event) => {
  if (event.severity === 'info' || event.code === 'HOT_SCOPE_TIME') {
    return;
  }
  const where = event.ownerPath?.join(' › ') ?? '';
  // The library frames that led to the finding (e.g. the setter call for SERVER_WRITE).
  const frames = (new Error().stack ?? '')
    .split('\n')
    .filter((line) => line.includes('/packages/') && !line.includes('node_modules'))
    .slice(0, 4)
    .join('\n');
  diagnostics.push(
    `${event.message}\n  in ${where}${event.loc ? `\n  at ${event.loc}` : ''}${frames ? `\n${frames}` : ''}`,
  );
});

afterEach(() => {
  if (diagnostics.length > 0) {
    const reported = diagnostics.splice(0).join('\n\n');
    throw new Error(`Solid reported diagnostics during server rendering:\n${reported}`);
  }
});
