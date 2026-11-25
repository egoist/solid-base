import { For, Loading, Show, createMemo, createSignal, lazy, onSettled } from 'solid-js';
import { dynamic } from '@solidjs/web';
import type { Component } from 'solid-js';

// Each demo is its own chunk, loaded when selected.
const modules = import.meta.glob<{ default: Component }>('./demos/*.tsx');

const ACRONYMS = new Set(['otp']);

function toTitle(slug: string) {
  return slug
    .split('-')
    .map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word[0]!.toUpperCase() + word.slice(1)))
    .join(' ');
}

const demos = Object.entries(modules)
  .map(([path, load]) => {
    const slug = path.replace('./demos/', '').replace('.tsx', '');
    return { slug, title: toTitle(slug), component: lazy(load) };
  })
  .sort((a, b) => a.title.localeCompare(b.title));

function currentSlug() {
  return window.location.hash.slice(1) || demos[0]?.slug;
}

export function App() {
  const [slug, setSlug] = createSignal(currentSlug());

  onSettled(() => {
    const onHashChange = () => setSlug(currentSlug());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  });

  const active = createMemo(() => demos.find((demo) => demo.slug === slug()) ?? demos[0]);
  const Demo = dynamic(() => active()?.component);

  return (
    <div class="layout">
      <nav class="sidebar">
        <h1 class="brand">solid-base</h1>
        <p class="tagline">Base UI for Solid 2</p>
        <ul>
          <For each={demos}>
            {(demo) => (
              <li>
                <a href={`#${demo.slug}`} class={{ active: slug() === demo.slug }}>
                  {demo.title}
                </a>
              </li>
            )}
          </For>
        </ul>
      </nav>
      <main class="content">
        <Show when={active()}>
          {(demo) => (
            <>
              <h2>{demo().title}</h2>
              <section class="stage">
                <Loading fallback={<p class="loading">Loading…</p>}>
                  <Demo />
                </Loading>
              </section>
            </>
          )}
        </Show>
      </main>
    </div>
  );
}
