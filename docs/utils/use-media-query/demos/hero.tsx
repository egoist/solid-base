import { For } from 'solid-js';
import { useMediaQuery } from '@egoist/solid-base/unstable-use-media-query';
import styles from './hero.module.css';

const queries = [
  '(min-width: 768px)',
  '(prefers-color-scheme: dark)',
  '(prefers-reduced-motion: reduce)',
  '(hover: hover)',
];

export default function ExampleUseMediaQuery() {
  return (
    <ul class={styles.List}>
      <For each={queries}>{(query) => <QueryRow query={query} />}</For>
    </ul>
  );
}

function QueryRow(props: { query: string }) {
  const matches = useMediaQuery(() => props.query);

  return (
    <li class={styles.Row} data-matches={matches() ? '' : undefined}>
      <code class={styles.Query}>{props.query}</code>
      <span class={styles.Status}>{matches() ? 'matches' : 'no match'}</span>
    </li>
  );
}
