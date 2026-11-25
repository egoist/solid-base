import type { Component } from 'solid-js';

/** Every playground demo and documentation demo: together they use every component. */
const modules = {
  ...import.meta.glob<{ default: Component }>('../../playground/src/demos/*.tsx', { eager: true }),
  ...import.meta.glob<{ default: Component }>('../../docs/**/demos/*.tsx', { eager: true }),
};

export const fixtures = Object.entries(modules).map(([path, module]) => ({
  name: path.replace(/^(\.\.\/)+/, '').replace(/\.tsx$/, ''),
  App: module.default,
}));
