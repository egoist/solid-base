import { createSignal, For, onSettled, Show } from 'solid-js';
import type { TocEntry } from '../lib/docs';
import { ListIcon } from './icons';

/** "On this page", highlighting the section being read. */
export function Toc(props: { entries: TocEntry[] }) {
  const [active, setActive] = createSignal<string>();

  onSettled(() => {
    const headings = props.entries
      .map((entry) => document.getElementById(entry.id))
      .filter((element): element is HTMLElement => element != null);
    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((record) => record.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -65% 0px' },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  });

  return (
    <Show when={props.entries.length > 0}>
      <nav class="toc" aria-label="On this page">
        <p class="eyebrow toc-title">
          <ListIcon />
          On this page
        </p>
        <ul>
          <For each={props.entries}>
            {(entry) => (
              <li data-depth={entry.depth}>
                <a href={`#${entry.id}`} data-active={active() === entry.id ? '' : undefined}>
                  {entry.text}
                </a>
              </li>
            )}
          </For>
        </ul>
      </nav>
    </Show>
  );
}
