import { createEffect } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { createTimeout } from '@egoist/solid-base-utils/timeout';
import { EMPTY_ARRAY } from '@egoist/solid-base-utils/empty';
import { contains } from '@egoist/solid-base-utils/shadowDom';
import { isElementVisible, isListIndexDisabled } from '../../../internals/composite/listIndex';
import type { DisabledIndices } from '../../../internals/composite/listIndex';
import type { HTMLProps } from '../../../internals/types';
import type { ElementProps, PopupInteractionStore } from '../types';
import { stopEvent } from '../event';

/**
 * Options of `createTypeahead`. They are read lazily (when an event is handled or an effect
 * re-runs), so pass getters for reactive values:
 * `createTypeahead(store, { listRef, get activeIndex() { return activeIndex() } })`.
 */
export interface CreateTypeaheadOptions {
  /**
   * A ref which contains an array of strings whose indices match the HTML
   * elements of the list.
   * @default empty list
   */
  listRef: RefObject<Array<string | null>>;
  /**
   * The index of the active (focused or highlighted) item in the list.
   * @default null
   */
  activeIndex: number | null;
  /**
   * Callback invoked with the matching index if found as the user types.
   */
  onMatch?: ((index: number, event: KeyboardEvent) => void) | undefined;
  /**
   * Optional list of item elements that correspond to `listRef` indices.
   * When an element exists for an index, typeahead skips it if it is hidden by
   * `display: none`, `visibility: hidden|collapse`, other browser-reported
   * visibility checks, or native disabled state.
   */
  elementsRef?: RefObject<Array<HTMLElement | null>> | undefined;
  /**
   * Indices that are disabled, either as an array or a predicate (the same shape as
   * `createListNavigation`'s `disabledIndices`). Disabled items are skipped while matching,
   * so a single keypress advances to the next selectable item (matching native `<select>`
   * and arrow-key navigation). The explicit disabled check doesn't read `elementsRef`, so
   * consumers whose items stay mounted-but-hidden while closed can still skip disabled items
   * without passing `elementsRef`.
   */
  disabledIndices?: DisabledIndices | undefined;
  /**
   * Callback invoked with the current typing activity as the user types.
   */
  onTyping?: ((isTyping: boolean) => void) | undefined;
  /**
   * Whether the primitive is enabled, including all internal event handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * The number of milliseconds to wait before resetting the typed string.
   * @default 750
   */
  resetMs?: number | undefined;
  /**
   * The index of the selected item in the list, if available.
   * @default null
   */
  selectedIndex?: number | null | undefined;
}

/**
 * Provides a matching callback that can be used to focus an item as the user
 * types, often used in tandem with `createListNavigation()`.
 *
 * Returns `reference` and `floating` props (created once) whose `onKeyDown`/`onBlur` handlers
 * read the options when called.
 * @see https://floating-ui.com/docs/useTypeahead
 */
export function createTypeahead(
  store: PopupInteractionStore,
  options: CreateTypeaheadOptions,
): ElementProps {
  const timeout = createTimeout();
  let typedString = '';
  // Seeded on the first keystroke of each typing session (see `isNewSession`).
  let prevIndex: number | null = -1;
  let matchIndex: number | null = null;

  const enabled = () => options.enabled ?? true;
  const selectedIndex = () => options.selectedIndex ?? null;
  const onTyping = (isTyping: boolean) => options.onTyping?.(isTyping);

  function onKeyDown(event: KeyboardEvent) {
    if (!enabled()) {
      return;
    }

    const { elementsRef, disabledIndices, activeIndex } = options;
    const resetMs = options.resetMs ?? 750;
    const open = store.select('open');

    function getElement(index: number) {
      return elementsRef?.current[index];
    }

    function isItemAvailable(index: number) {
      const element = getElement(index);
      if ((element && !isElementVisible(element)) || element?.matches(':disabled')) {
        return false;
      }
      // Visibility and native disabled state are handled above; pass an empty
      // element list so `isListIndexDisabled` resolves only the explicit
      // `disabledIndices` (array/predicate) and skips its own fallbacks.
      // Consumers that don't pass `disabledIndices` keep matching every visible
      // item except native disabled elements provided through `elementsRef`.
      return disabledIndices == null || !isListIndexDisabled(EMPTY_ARRAY, index, disabledIndices);
    }

    function getMatchingIndex(list: Array<string | null>, string: string, startIndex = 0) {
      if (list.length === 0) {
        return -1;
      }

      const normalizedStartIndex = ((startIndex % list.length) + list.length) % list.length;
      const lowerString = string.toLowerCase();

      for (let offset = 0; offset < list.length; offset += 1) {
        const index = (normalizedStartIndex + offset) % list.length;
        const text = list[index];
        if (!text?.toLowerCase().startsWith(lowerString) || !isItemAvailable(index)) {
          continue;
        }
        return index;
      }
      return -1;
    }

    const listContent = options.listRef.current;

    if (typedString.length > 0 && event.key === ' ') {
      // Space should continue the in-progress typeahead session.
      stopEvent(event);
      onTyping(true);
    }

    if (typedString.length > 0 && typedString[0] !== ' ') {
      if (getMatchingIndex(listContent, typedString) === -1 && event.key !== ' ') {
        onTyping(false);
      }
    }

    if (
      listContent == null ||
      // Character key.
      event.key.length !== 1 ||
      // Modifier key.
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }

    if (open && event.key !== ' ') {
      stopEvent(event);
      onTyping(true);
    }

    // Capture whether this is a new typing session before mutating the string.
    const isNewSession = typedString === '';
    if (isNewSession) {
      prevIndex = selectedIndex() ?? activeIndex ?? -1;
    }

    // Bail out if the list contains a word like "llama" or "aaron". TODO:
    // allow it in this case, too. Unavailable items are skipped while matching, so
    // they must be ignored here as well — otherwise a hidden or disabled double-letter
    // label would block rapid cycling through the available items.
    const allowRapidSuccessionOfFirstLetter = listContent.every((text, index) =>
      text && isItemAvailable(index) ? text[0]?.toLowerCase() !== text[1]?.toLowerCase() : true,
    );

    // Allows the user to cycle through items that start with the same letter
    // in rapid succession.
    if (allowRapidSuccessionOfFirstLetter && typedString === event.key) {
      typedString = '';
      prevIndex = matchIndex;
    }

    typedString += event.key;
    timeout.start(resetMs, () => {
      typedString = '';
      prevIndex = matchIndex;
      onTyping(false);
    });

    // Compute the starting index for this search.
    // If this is a new typing session (string is empty), base it on the current
    // selection/active item; otherwise continue from the last matched index.
    const searchFrom = isNewSession ? (selectedIndex() ?? activeIndex ?? -1) : prevIndex;
    const startIndex = (searchFrom ?? 0) + 1;

    const index = getMatchingIndex(listContent, typedString, startIndex);

    if (index !== -1) {
      options.onMatch?.(index, event);
      matchIndex = index;
    } else if (event.key !== ' ') {
      typedString = '';
      onTyping(false);
    }
  }

  function onBlur(event: FocusEvent) {
    if (!enabled()) {
      return;
    }

    const next = event.relatedTarget as Element | null;
    const currentDomReferenceElement = store.select('anchorElement');
    const currentFloatingElement = store.select('positionerElement');
    const withinComposite =
      contains(currentDomReferenceElement, next) || contains(currentFloatingElement, next);

    // Keep the session if focus moves within the composite (reference <-> floating).
    if (withinComposite) {
      return;
    }

    // End the current typing session when focus leaves the composite entirely.
    timeout.clear();
    typedString = '';
    prevIndex = matchIndex;
    onTyping(false);
  }

  createEffect(
    () => ({ open: store.select('open'), selectedIndex: selectedIndex() }),
    ({ open, selectedIndex: currentSelectedIndex }) => {
      if (!open && currentSelectedIndex !== null) {
        return;
      }

      timeout.clear();
      matchIndex = null;

      if (typedString !== '') {
        typedString = '';
        onTyping(false);
      }
    },
  );

  const sharedProps: HTMLProps = { onKeyDown, onBlur };

  return { reference: sharedProps, floating: sharedProps };
}
