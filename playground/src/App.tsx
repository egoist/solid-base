import { For, Show, createMemo, createSignal, onSettled } from 'solid-js';
import { dynamic } from '@solidjs/web';
import type { Component } from 'solid-js';

interface DemoModule {
  title: string;
  default: Component;
}

const modules = import.meta.glob<DemoModule>('./demos/*.tsx', { eager: true });

const demos = Object.entries(modules)
  .map(([path, mod]) => ({
    slug: path.replace('./demos/', '').replace('.tsx', ''),
    title: mod.title,
    component: mod.default,
  }))
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
                <Demo />
              </section>
            </>
          )}
        </Show>
      </main>
    </div>
  );
}
