import { createMemo, createSignal, For, Show } from 'solid-js';
import { Combobox } from '@egoist/solid-base/combobox';
import styles from './virtualized.module.css';

const ITEM_HEIGHT = 32;
const PADDING = 4;
const VIEWPORT_HEIGHT = 352;
const OVERSCAN = 10;

export default function ExampleVirtualizedCombobox() {
  // Set by the list once it mounts: scrolls the given index into view.
  let scrollToIndex: ((index: number) => void) | undefined;

  return (
    <Combobox.Root
      virtualized
      items={virtualizedItems}
      itemToStringLabel={getItemLabel}
      onItemHighlighted={(item, { reason, index }) => {
        if (item && (reason === 'keyboard' || reason === 'none')) {
          queueMicrotask(() => scrollToIndex?.(index));
        }
      }}
    >
      <label class={styles.Label}>
        Search 10,000 items
        <Combobox.Input class={styles.Input} />
      </label>

      <Combobox.Portal>
        <Combobox.Positioner class={styles.Positioner} sideOffset={4}>
          <Combobox.Popup class={styles.Popup}>
            <Combobox.Empty class={styles.Empty}>No items found.</Combobox.Empty>
            <Combobox.List class={styles.List}>
              <VirtualizedList
                onReady={(scroll) => {
                  scrollToIndex = scroll;
                }}
              />
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

/**
 * A minimal fixed-height windowing list: only the rows in (and near) the visible range are
 * rendered, each positioned absolutely and given its `index` in the filtered items.
 */
function VirtualizedList(props: { onReady: (scrollToIndex: (index: number) => void) => void }) {
  const filteredItems = Combobox.useFilteredItems<VirtualizedItem>();
  const [scrollTop, setScrollTop] = createSignal(0);
  let scroller: HTMLDivElement | undefined;

  const totalSize = () => filteredItems().length * ITEM_HEIGHT + PADDING * 2;

  const range = createMemo(
    () => {
      const count = filteredItems().length;
      const start = Math.max(0, Math.floor((scrollTop() - PADDING) / ITEM_HEIGHT) - OVERSCAN);
      const end = Math.min(
        count,
        Math.ceil((scrollTop() + VIEWPORT_HEIGHT - PADDING) / ITEM_HEIGHT) + OVERSCAN,
      );
      return { start, end };
    },
    { equals: (a, b) => a.start === b.start && a.end === b.end },
  );

  const visibleItems = () => filteredItems().slice(range().start, range().end);

  props.onReady((index) => {
    if (!scroller) {
      return;
    }
    const top = PADDING + index * ITEM_HEIGHT;
    const bottom = top + ITEM_HEIGHT;
    if (top < scroller.scrollTop + PADDING) {
      scroller.scrollTop = top - PADDING;
    } else if (bottom > scroller.scrollTop + scroller.clientHeight - PADDING) {
      scroller.scrollTop = bottom - scroller.clientHeight + PADDING;
    }
  });

  return (
    <Show when={filteredItems().length > 0}>
      <div
        role="presentation"
        ref={(el) => {
          scroller = el;
        }}
        class={styles.Scroller}
        style={{ height: `${Math.min(VIEWPORT_HEIGHT, totalSize())}px` }}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div role="presentation" class={styles.Placeholder} style={{ height: `${totalSize()}px` }}>
          <For each={visibleItems()}>
            {(item, offset) => {
              const index = () => range().start + offset();
              return (
                <Combobox.Item
                  index={index()}
                  value={item}
                  class={styles.Item}
                  aria-setsize={filteredItems().length}
                  aria-posinset={index() + 1}
                  style={{
                    height: `${ITEM_HEIGHT}px`,
                    transform: `translateY(${PADDING + index() * ITEM_HEIGHT}px)`,
                  }}
                >
                  <Combobox.ItemIndicator class={styles.ItemIndicator}>
                    <CheckIcon />
                  </Combobox.ItemIndicator>
                  <span class={styles.ItemText}>{item.name}</span>
                </Combobox.Item>
              );
            }}
          </For>
        </div>
      </div>
    </Show>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style={{ display: 'block' }}>
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}

interface VirtualizedItem {
  id: string;
  name: string;
}

function getItemLabel(item: VirtualizedItem | null) {
  return item ? item.name : '';
}

const virtualizedItems: VirtualizedItem[] = Array.from({ length: 10000 }, (_, index) => {
  const id = String(index + 1);
  return { id, name: `Item ${id.padStart(4, '0')}` };
});
