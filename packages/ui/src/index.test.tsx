import * as BaseUI from './index';

const PRIVATE_MODULES = new Set(['internals', 'utils', 'types']);

const modules = import.meta.glob<Record<string, unknown>>('./*/index.ts');

const publicModules = Object.entries(modules).filter(([path]) => {
  const name = path.split('/')[1]!;
  return !PRIVATE_MODULES.has(name) && !name.startsWith('unstable-');
});

describe('@egoist/solid-base', () => {
  it('re-exports every public module from the root entry', async () => {
    expect(publicModules.length).toBeGreaterThan(40);
    await Promise.all(
      publicModules.map(async ([path, load]) => {
        const module = await load();
        for (const exportKey of Object.keys(module)) {
          expect(
            (BaseUI as Record<string, unknown>)[exportKey],
            `${path} export \`${exportKey}\` is missing from the root entry`,
          ).not.toBeUndefined();
        }
      }),
    );
  });
});
