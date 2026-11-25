import { For, Show, createMemo, createSignal } from 'solid-js';
import { Autocomplete } from '@egoist/solid-base/autocomplete';
import styles from './virtualized.module.css';

const ROW_HEIGHT = 32;
const OVERSCAN = 10;
// The scroller's height (20rem) in pixels, used to size the rendered window.
const VIEWPORT_HEIGHT = 320;

export default function ExampleVirtualizedAutocomplete() {
  let scroller: HTMLDivElement | undefined;

  // Keeps the highlighted row inside the scroller. Rows outside the window aren't rendered, so
  // keyboard navigation can't rely on the browser scrolling them into view.
  function scrollToIndex(index: number) {
    if (!scroller) {
      return;
    }
    const top = index * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    if (top < scroller.scrollTop) {
      scroller.scrollTop = top;
    } else if (bottom > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = bottom - scroller.clientHeight;
    }
  }

  return (
    <Autocomplete.Root
      virtualized
      items={virtualizedItems}
      openOnInputClick
      itemToStringValue={getItemLabel}
      onItemHighlighted={(item, eventDetails) => {
        if (!item || eventDetails.reason === 'pointer') {
          return;
        }
        queueMicrotask(() => scrollToIndex(eventDetails.index));
      }}
    >
      <label class={styles.Label}>
        Search 10,000 items
        <Autocomplete.Input class={styles.Input} />
      </label>

      <Autocomplete.Portal>
        <Autocomplete.Positioner class={styles.Positioner} sideOffset={4}>
          <Autocomplete.Popup class={styles.Popup}>
            <Autocomplete.Empty>
              <div class={styles.Empty}>No items found.</div>
            </Autocomplete.Empty>
            <Autocomplete.List class={styles.List}>
              <VirtualizedList ref={(element) => (scroller = element)} />
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}

function VirtualizedList(props: { ref: (element: HTMLDivElement) => void }) {
  const filteredItems = Autocomplete.useFilteredItems<VirtualizedItem>();
  const [scrollTop, setScrollTop] = createSignal(0);

  const totalSize = () => filteredItems().length * ROW_HEIGHT;
  const start = () => Math.max(0, Math.floor(scrollTop() / ROW_HEIGHT) - OVERSCAN);
  const visibleItems = createMemo(
    () => {
      const end = Math.ceil((scrollTop() + VIEWPORT_HEIGHT) / ROW_HEIGHT) + OVERSCAN;
      return filteredItems().slice(start(), end);
    },
    {
      equals: (a, b) => a.length === b.length && a.every((item, index) => item === b[index]),
    },
  );

  return (
    <Show when={filteredItems().length > 0}>
      <div
        role="presentation"
        ref={props.ref}
        class={styles.Scroller}
        style={{ '--total-size': `${totalSize() + 8}px` }}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div
          role="presentation"
          class={styles.VirtualizedPlaceholder}
          style={{ height: `${totalSize()}px` }}
        >
          <For each={visibleItems()}>
            {(item, offset) => {
              const index = () => start() + offset();
              return (
                <Autocomplete.Item
                  index={index()}
                  value={item}
                  class={styles.Item}
                  aria-setsize={filteredItems().length}
                  aria-posinset={index() + 1}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${ROW_HEIGHT}px`,
                    transform: `translateY(${index() * ROW_HEIGHT}px)`,
                  }}
                >
                  {item.name}
                </Autocomplete.Item>
              );
            }}
          </For>
        </div>
      </div>
    </Show>
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
  const indexLabel = id.padStart(4, '0');
  return { id, name: `Item ${indexLabel}` };
});
