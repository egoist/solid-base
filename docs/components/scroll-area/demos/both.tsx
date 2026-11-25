import { For } from 'solid-js';
import { ScrollArea } from '@egoist/solid-base/scroll-area';
import styles from './both.module.css';

const items = Array.from({ length: 100 }, (_, index) => index + 1);

export default function ExampleScrollAreaBoth() {
  return (
    <ScrollArea.Root class={styles.ScrollArea}>
      <ScrollArea.Viewport class={styles.Viewport}>
        <ScrollArea.Content class={styles.Content}>
          <ul class={styles.Grid}>
            <For each={items}>{(item) => <li class={styles.Item}>{item}</li>}</For>
          </ul>
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar class={styles.Scrollbar}>
        <ScrollArea.Thumb class={styles.Thumb} />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar class={styles.Scrollbar} orientation="horizontal">
        <ScrollArea.Thumb class={styles.Thumb} />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner />
    </ScrollArea.Root>
  );
}
