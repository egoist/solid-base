import { For, Show, createEffect, createMemo, createSignal, createUniqueId } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { createTestFloating, getInteractionProps, getItemInteractionProps } from '../../testUtils';
import { FloatingFocusManager } from '../../focus/FloatingFocusManager';
import { FloatingPortal } from '../../portal/FloatingPortal';
import type { ElementProps } from '../../types';
import { createClick } from '../click';
import { createDismiss } from '../dismiss';
import { createListNavigation } from '../listNavigation';
import { gridNavigationWithColumns } from './gridNavigationWithColumns';
import { cleanupRef, getFloatingTestProps } from './helpers';

const grid = gridNavigationWithColumns(3);

const emojis = [
  { name: 'apple', emoji: '🍎' },
  { name: 'orange', emoji: '🍊' },
  { name: 'watermelon', emoji: '🍉' },
  { name: 'strawberry', emoji: '🍓' },
  { name: 'pear', emoji: '🍐' },
  { name: 'banana', emoji: '🍌' },
  { name: 'pineapple', emoji: '🍍' },
  { name: 'cherry', emoji: '🍒' },
  { name: 'peach', emoji: '🍑' },
];

interface OptionProps {
  name: string;
  active: boolean;
  selected: boolean;
  ref: (element: HTMLElement) => void;
  itemProps: Record<string, any>;
  children: JSX.Element;
}

/** @internal */
function Option(props: OptionProps) {
  const id = createUniqueId();
  return (
    <button
      {...props.itemProps}
      ref={props.ref}
      id={id}
      role="option"
      aria-selected={props.selected ? 'true' : 'false'}
      disabled={props.name === 'orange'}
      aria-label={props.name}
      tabindex={-1}
      data-active={props.active ? '' : undefined}
      type="button"
    >
      {props.children}
    </button>
  );
}

/**
 * An emoji picker: a grid listbox navigated with virtual focus from a search input (port of
 * Floating UI's `EmojiPicker` fixture, without positioning).
 * @internal
 */
export function Main() {
  const [open, setOpen] = createSignal(false);
  const [search, setSearch] = createSignal('');
  const [selectedEmoji, setSelectedEmoji] = createSignal<string | null>(null);
  const [activeIndex, setActiveIndex] = createSignal<number | null>(null);

  const listRef: RefObject<Array<HTMLElement | null>> = { current: [] };
  const optionElements = new Map<string, HTMLElement>();

  const noResultsId = createUniqueId();

  const { store, refs } = createTestFloating({
    open,
    onOpenChange: (value) => setOpen(value),
  });

  // Handles opening the floating element via the Choose Emoji button.
  const menuRoleProps: ElementProps = {
    reference: {
      'aria-haspopup': 'menu',
      get 'aria-expanded'() {
        return open();
      },
      get 'aria-controls'() {
        return open() ? store.select('defaultPopupId') : undefined;
      },
    },
    floating: {
      get id() {
        return store.select('defaultPopupId');
      },
      role: 'menu',
    },
  };

  const buttonInteractions = [createClick(store), createDismiss(store), menuRoleProps];

  // Handles the list navigation where the reference is the inner input, not
  // the button that opens the floating element.
  const listInteractions = [
    createListNavigation(store, {
      listRef,
      onNavigate: (index) => {
        if (open()) {
          setActiveIndex(index);
        }
      },
      get activeIndex() {
        return activeIndex();
      },
      orientation: 'horizontal',
      loopFocus: true,
      focusItemOnOpen: false,
      virtual: true,
      allowEscape: true,
      grid,
    }),
  ];

  createEffect(open, (isOpen) => {
    if (!isOpen) {
      setSearch('');
      setActiveIndex(null);
    }
  });

  const filteredEmojis = createMemo(() =>
    emojis.filter(({ name }) => name.toLocaleLowerCase().includes(search().toLocaleLowerCase())),
  );

  // React calls the items' ref callbacks again when their index changes; keep `listRef` in the
  // order of the filtered list instead.
  let currentList = emojis;
  const syncListRef = () => {
    listRef.current = currentList.map(({ name }) => optionElements.get(name) ?? null);
  };
  createEffect(filteredEmojis, (list) => {
    currentList = list;
    syncListRef();
  });

  const handleEmojiClick = () => {
    const index = activeIndex();
    if (index !== null) {
      setSelectedEmoji(filteredEmojis()[index].emoji);
      setOpen(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleEmojiClick();
    }
  };

  const handleInput = (event: InputEvent & { currentTarget: HTMLInputElement }) => {
    setActiveIndex(null);
    setSearch(event.currentTarget.value);
  };

  return (
    <>
      <h1>Emoji Picker</h1>
      <div>
        <div class="text-center">
          <button
            type="button"
            aria-label="Choose emoji"
            aria-describedby="emoji-label"
            data-open={open() ? '' : undefined}
            {...getInteractionProps(buttonInteractions, 'reference', {
              ref: refs.setReference,
            })}
          >
            ☻
          </button>
          <br />
          <Show when={selectedEmoji()}>
            {(emoji) => (
              <span id="emoji-label">
                <span
                  style={{ 'font-size': '30px' }}
                  aria-label={emojis.find((item) => item.emoji === emoji())?.name}
                >
                  {emoji()}
                </span>{' '}
                selected
              </span>
            )}
          </Show>
          <FloatingPortal>
            <Show when={open()}>
              <FloatingFocusManager store={store} modal={false}>
                <div
                  {...getFloatingTestProps(
                    buttonInteractions,
                    getInteractionProps(listInteractions, 'floating', {
                      ref: cleanupRef(refs.setFloating),
                    }),
                  )}
                >
                  <span>Emoji Picker</span>
                  <input
                    placeholder="Search emoji"
                    value={search()}
                    aria-controls={filteredEmojis().length === 0 ? noResultsId : undefined}
                    {...getInteractionProps(listInteractions, 'reference', {
                      onInput: handleInput,
                      onKeyDown: handleKeyDown,
                    })}
                  />
                  <Show when={filteredEmojis().length === 0}>
                    <p id={noResultsId} role="region" aria-atomic="true" aria-live="assertive">
                      No results.
                    </p>
                  </Show>
                  <Show when={filteredEmojis().length > 0}>
                    <div role="listbox">
                      <For each={filteredEmojis()}>
                        {(item, index) => (
                          <Option
                            name={item.name}
                            ref={cleanupRef<HTMLElement>((node) => {
                              if (node) {
                                optionElements.set(item.name, node);
                              } else {
                                optionElements.delete(item.name);
                              }
                              syncListRef();
                            })}
                            selected={selectedEmoji() === item.emoji}
                            active={activeIndex() === index()}
                            itemProps={getItemInteractionProps(listInteractions, {
                              onClick: handleEmojiClick,
                            })}
                          >
                            {item.emoji}
                          </Option>
                        )}
                      </For>
                    </div>
                  </Show>
                  <span
                    data-testid="emoji-picker-active-index"
                    data-active-index={activeIndex() ?? ''}
                    style={{ display: 'none' }}
                  />
                </div>
              </FloatingFocusManager>
            </Show>
          </FloatingPortal>
        </div>
      </div>
    </>
  );
}
