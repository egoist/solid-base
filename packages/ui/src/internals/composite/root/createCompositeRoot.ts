import { createEffect, createMemo, createSignal, untrack, type Accessor } from 'solid-js';
import { isElementDisabled } from '@egoist/solid-base-utils/isElementDisabled';
import { getTarget } from '@egoist/solid-base-utils/shadowDom';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type { TextDirection } from '../../direction-context/DirectionContext';
import {
  COMPOSITE_KEYS,
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  ARROW_UP,
  END,
  HOME,
  MODIFIER_KEYS,
  findNonDisabledListIndex,
  getMaxListIndex,
  getMinListIndex,
  isListIndexDisabled,
  isIndexOutOfListBounds,
  isNativeInput,
  scrollIntoViewIfNeeded,
} from '../composite';
import type { ModifierKey } from '../composite';
import { ACTIVE_COMPOSITE_ITEM } from '../constants';
import {
  createCompositeList,
  type CompositeListContextValue,
  type CompositeMetadata,
} from '../list/CompositeList';
import type { HTMLProps } from '../../types';
import type { CompositeGridNavigator } from './gridNavigation';

export type CompositeOnLoop = (
  event: KeyboardEvent,
  prevIndex: number,
  nextIndex: number,
  elementsRef: RefObject<Array<HTMLElement | null>>,
) => number;

export interface CreateCompositeRootParameters {
  orientation?: Accessor<'horizontal' | 'vertical' | 'both' | undefined> | undefined;
  grid?: Accessor<CompositeGridNavigator | undefined> | undefined;
  loopFocus?: Accessor<boolean | undefined> | undefined;
  onLoop?: CompositeOnLoop | undefined;
  /** Controlled highlighted index. */
  highlightedIndex?: Accessor<number | undefined> | undefined;
  onHighlightedIndexChange?: ((index: number) => void) | undefined;
  /**
   * The index the highlight should follow (e.g. the selected tab). Whenever it changes to a
   * defined value, the (uncontrolled) highlight moves to it; `undefined` leaves it in place.
   */
  syncHighlightedIndex?: Accessor<number | undefined> | undefined;
  direction: Accessor<TextDirection>;
  /**
   * When `true`, pressing the Home key moves focus to the first item,
   * and pressing the End key moves focus to the last item.
   * @default false
   */
  enableHomeAndEndKeys?: Accessor<boolean | undefined> | undefined;
  /**
   * When `true`, keypress events on Composite's navigation keys
   * be stopped with event.stopPropagation().
   * @default false
   */
  stopEventPropagation?: Accessor<boolean | undefined> | undefined;
  /**
   * Item indices to be considered disabled.
   * Used for composite items that are focusable when disabled.
   */
  disabledIndices?: Accessor<number[] | undefined> | undefined;
  /**
   * Modifier keys that should allow normal keyboard actions when pressed.
   * By default, all modifier keys prevent normal actions.
   */
  modifierKeys?: Accessor<ModifierKey[] | undefined> | undefined;
  /**
   * The list the items register with. Pass a list created with `createCompositeList` to derive
   * state from its `map()` outside of the root. Created by the root when omitted.
   */
  list?: CompositeListContextValue<any> | undefined;
  /**
   * Called when the registered items change.
   */
  onMapChange?: ((map: Map<HTMLElement, CompositeMetadata<any>>) => void) | undefined;
}

export interface CreateCompositeRootReturnValue {
  props: HTMLProps;
  rootRef: (element: HTMLElement) => void;
  highlightedIndex: Accessor<number>;
  onHighlightedIndexChange: (index: number, shouldScrollIntoView?: boolean) => void;
  /** A live view of the registered elements, ordered by index. */
  elementsRef: RefObject<Array<HTMLElement | null>>;
  list: CompositeListContextValue<any>;
  relayKeyboardEvent: (event: KeyboardEvent) => void;
}

interface HighlightState {
  index: number;
  /** The element highlighted when `index` was set: the highlight follows it when items move. */
  element: HTMLElement | null;
  /** Whether the default highlight was resolved against the registered items. */
  initialized: boolean;
  /** The `syncHighlightedIndex` value this state last followed. */
  synced: number | undefined;
  /**
   * Set when the highlight landed on an item without checking whether it's disabled (which reads
   * the DOM): `'default'` for the initial highlight, `'replaced'` when the highlighted item was
   * removed and another one took its index.
   */
  unchecked: 'default' | 'replaced' | null;
}

function isSameHighlight(a: HighlightState, b: HighlightState) {
  return (
    a.index === b.index &&
    a.element === b.element &&
    a.initialized === b.initialized &&
    a.synced === b.synced &&
    a.unchecked === b.unchecked
  );
}

/**
 * Roving focus over a list of composite items, driven by arrow keys.
 */
export function createCompositeRoot(
  params: CreateCompositeRootParameters,
): CreateCompositeRootReturnValue {
  const loopFocus = () => params.loopFocus?.() ?? true;
  const orientation = () => params.orientation?.() ?? 'both';
  const enableHomeAndEndKeys = () => params.enableHomeAndEndKeys?.() ?? false;
  const disabledIndices = () => params.disabledIndices?.();
  const isControlled = () => params.highlightedIndex?.() !== undefined;

  const list = params.list ?? createCompositeList<any>();

  let rootElement: HTMLElement | null = null;
  const elementsRef: RefObject<Array<HTMLElement | null>> = {
    // An imperative view (read by handlers, `onLoop`/`grid` and DOM checks), not a dependency.
    get current() {
      return untrack(list.elements);
    },
    set current(_value) {
      // The elements are derived from the list.
    },
  };

  // The uncontrolled highlight, derived from the registered items: it starts on the active item
  // and follows the highlighted element when items move. Navigation writes it directly (it's a
  // writable memo).
  const [highlight, setHighlight] = createSignal<HighlightState>(
    (prev) => {
      const elements = list.elements();
      const synced = params.syncHighlightedIndex?.();
      let state: HighlightState = prev ?? {
        index: 0,
        element: null,
        initialized: false,
        synced: undefined,
        unchecked: null,
      };

      if (synced !== state.synced) {
        state =
          synced === undefined
            ? { ...state, synced }
            : { ...state, index: synced, element: elements[synced] ?? null, synced };
      }

      return followHighlight(state, elements);
    },
    { name: 'createCompositeRoot.highlight', equals: isSameHighlight },
  );

  const highlightedIndex = createMemo(() => params.highlightedIndex?.() ?? highlight().index, {
    name: 'createCompositeRoot.highlightedIndex',
  });

  // Moves the highlight off disabled (or hidden) items. Whether an item is disabled is measured
  // in the DOM, once the items rendered: the check runs when the items or the disabled indices
  // change, and reads them through `elementsRef`.
  createEffect(
    () => [list.elements(), disabledIndices(), isControlled()] as const,
    () => {
      const elements = elementsRef.current;
      const indices = untrack(disabledIndices);
      const correctDisabled = !untrack(isControlled);
      setHighlight((prev) => checkHighlight(prev, elements, indices, correctDisabled));
    },
  );

  function onHighlightedIndexChange(index: number, shouldScrollIntoView = false) {
    if (params.onHighlightedIndexChange) {
      params.onHighlightedIndexChange(index);
    }
    if (!untrack(isControlled)) {
      const element = elementsRef.current[index] ?? null;
      setHighlight((prev) => ({ ...prev, index, element, unchecked: null }));
    }
    if (shouldScrollIntoView) {
      const newActiveItem = elementsRef.current[index];
      scrollIntoViewIfNeeded(
        rootElement,
        newActiveItem ?? null,
        untrack(params.direction),
        untrack(orientation),
      );
    }
  }

  // Once the items registered, reveal the active one.
  let didScrollActiveItem = false;
  createEffect(
    () => (didScrollActiveItem || !highlight().initialized ? null : list.elements()),
    (elements) => {
      if (!elements) {
        return;
      }
      didScrollActiveItem = true;
      const activeItem =
        elements.find((element) => element?.hasAttribute(ACTIVE_COMPOSITE_ITEM)) ?? null;
      scrollIntoViewIfNeeded(
        rootElement,
        activeItem,
        untrack(params.direction),
        untrack(orientation),
      );
    },
  );

  if (params.onMapChange) {
    const onMapChange = params.onMapChange;
    createEffect(list.map, (map) => {
      onMapChange(map);
    });
  }

  function onKeyDown(event: KeyboardEvent) {
    const isHomeOrEnd = event.key === HOME || event.key === END;
    if (!COMPOSITE_KEYS.has(event.key) || (!enableHomeAndEndKeys() && isHomeOrEnd)) {
      return;
    }

    if (isModifierKeySet(event, params.modifierKeys?.() ?? [])) {
      return;
    }

    if (!rootElement) {
      return;
    }

    const currentOrientation = orientation();
    const currentDisabledIndices = disabledIndices();
    const currentIndex = highlightedIndex();
    const grid = params.grid?.();
    const isRtl = params.direction() === 'rtl';

    const horizontalForwardKey = isRtl ? ARROW_LEFT : ARROW_RIGHT;
    const horizontalBackwardKey = isRtl ? ARROW_RIGHT : ARROW_LEFT;
    const forwardKey = currentOrientation === 'vertical' ? ARROW_DOWN : horizontalForwardKey;
    const backwardKey = currentOrientation === 'vertical' ? ARROW_UP : horizontalBackwardKey;

    const target = getTarget(event);
    if (target != null && isNativeInput(target) && !isElementDisabled(target)) {
      const selectionStart = target.selectionStart;
      const selectionEnd = target.selectionEnd;
      const textContent = target.value;
      if (selectionStart == null || event.shiftKey || selectionStart !== selectionEnd) {
        return;
      }
      if (event.key !== backwardKey && selectionStart < textContent.length) {
        return;
      }
      if (event.key !== forwardKey && selectionStart > 0) {
        return;
      }
    }

    let nextIndex = currentIndex;
    const minIndex = getMinListIndex(elementsRef, currentDisabledIndices);
    const maxIndex = getMaxListIndex(elementsRef, currentDisabledIndices);
    const onLoop = params.onLoop;

    if (grid != null) {
      nextIndex = grid({
        disabledIndices: currentDisabledIndices,
        elementsRef,
        event,
        highlightedIndex: currentIndex,
        loopFocus: loopFocus(),
        maxIndex,
        minIndex,
        onLoop: onLoop
          ? (loopEvent, prevIndex, loopNextIndex) =>
              onLoop(loopEvent, prevIndex, loopNextIndex, elementsRef)
          : undefined,
        orientation: currentOrientation,
        rtl: isRtl,
      });
    }

    const isForwardKey =
      (currentOrientation !== 'vertical' && event.key === horizontalForwardKey) ||
      (currentOrientation !== 'horizontal' && event.key === ARROW_DOWN);
    const isBackwardKey =
      (currentOrientation !== 'vertical' && event.key === horizontalBackwardKey) ||
      (currentOrientation !== 'horizontal' && event.key === ARROW_UP);

    if (enableHomeAndEndKeys()) {
      if (event.key === HOME) {
        nextIndex = minIndex;
      } else if (event.key === END) {
        nextIndex = maxIndex;
      }
    }

    if (nextIndex === currentIndex && (isForwardKey || isBackwardKey)) {
      if (loopFocus() && nextIndex === maxIndex && isForwardKey) {
        nextIndex = minIndex;
        if (onLoop) {
          nextIndex = onLoop(event, currentIndex, nextIndex, elementsRef);
        }
      } else if (loopFocus() && nextIndex === minIndex && isBackwardKey) {
        nextIndex = maxIndex;
        if (onLoop) {
          nextIndex = onLoop(event, currentIndex, nextIndex, elementsRef);
        }
      } else {
        nextIndex = findNonDisabledListIndex(elementsRef.current, {
          startingIndex: nextIndex,
          decrement: isBackwardKey,
          disabledIndices: currentDisabledIndices,
        });
      }
    }

    if (nextIndex !== currentIndex && !isIndexOutOfListBounds(elementsRef.current, nextIndex)) {
      if (params.stopEventPropagation?.()) {
        event.stopPropagation();
      }

      if (grid != null || isHomeOrEnd || isForwardKey || isBackwardKey) {
        event.preventDefault();
      }
      onHighlightedIndexChange(nextIndex, true);

      queueMicrotask(() => {
        elementsRef.current[nextIndex]?.focus();
      });
    }
  }

  const rootRef = (element: HTMLElement) => {
    rootElement = element;
  };

  const props: HTMLProps = {
    ref: rootRef,
    // `focusin` (React's `onFocus`): `focus` doesn't bubble from the items to the root.
    onFocusIn(event: FocusEvent) {
      const target = getTarget(event);
      if (!rootElement || target == null || !isNativeInput(target)) {
        return;
      }
      target.setSelectionRange(0, target.value.length);
    },
    onKeyDown,
  };

  return {
    props,
    rootRef,
    highlightedIndex,
    onHighlightedIndexChange,
    elementsRef,
    list,
    relayKeyboardEvent: onKeyDown,
  };
}

/**
 * Follows the highlighted item in the registered items (`elements`, ordered by index), and
 * resolves the initial highlight. Doesn't read the DOM besides the active item attribute.
 */
function followHighlight(state: HighlightState, elements: Array<HTMLElement | null>) {
  if (elements.length === 0) {
    return state;
  }

  if (!state.initialized) {
    const activeIndex = elements.findIndex((item) => item?.hasAttribute(ACTIVE_COMPOSITE_ITEM));
    const index = activeIndex === -1 ? state.index : activeIndex;
    return {
      ...state,
      index,
      element: elements[index] ?? null,
      initialized: true,
      unchecked: activeIndex === -1 ? ('default' as const) : null,
    };
  }

  const nextIndex = state.element ? elements.indexOf(state.element) : -1;
  if (nextIndex === -1) {
    // The highlighted item was removed: the item taking its index (if any) is checked once the
    // DOM settled.
    const replacement = elements[state.index] ?? null;
    return state.unchecked === 'replaced' && replacement === state.element
      ? state
      : { ...state, element: replacement, unchecked: 'replaced' as const };
  }

  return nextIndex === state.index ? state : { ...state, index: nextIndex };
}

/**
 * Moves the highlight off missing and disabled items (reads the DOM).
 */
function checkHighlight(
  state: HighlightState,
  elements: Array<HTMLElement | null>,
  disabledIndices: number[] | undefined,
  correctDisabled: boolean,
): HighlightState {
  if (!state.initialized || elements.length === 0) {
    return state;
  }

  let { index } = state;

  if (state.unchecked === 'default') {
    if (isListIndexDisabled(elements, index, disabledIndices)) {
      const firstEnabledIndex = findNonDisabledListIndex(elements, { disabledIndices });
      if (!isIndexOutOfListBounds(elements, firstEnabledIndex)) {
        index = firstEnabledIndex;
      }
    }
  } else if (state.unchecked === 'replaced') {
    if (!elements[index] || isListIndexDisabled(elements, index, disabledIndices)) {
      index = getFallbackIndex(elements, disabledIndices);
    }
  } else if (
    correctDisabled &&
    disabledIndices != null &&
    isListIndexDisabled(elements, index, disabledIndices)
  ) {
    const firstEnabledIndex = findNonDisabledListIndex(elements, { disabledIndices });
    if (!isIndexOutOfListBounds(elements, firstEnabledIndex)) {
      index = firstEnabledIndex;
    }
  }

  if (index === state.index && state.unchecked === null) {
    return state;
  }

  return { ...state, index, element: elements[index] ?? null, unchecked: null };
}

function getFallbackIndex(elements: Array<HTMLElement | null>, disabledIndices?: number[]) {
  let fallbackIndex = -1;

  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];

    if (!element || isListIndexDisabled(elements, index, disabledIndices)) {
      continue;
    }

    if (element.hasAttribute(ACTIVE_COMPOSITE_ITEM)) {
      return index;
    }

    if (fallbackIndex === -1) {
      fallbackIndex = index;
    }
  }

  return Math.max(fallbackIndex, 0);
}

function isModifierKeySet(event: KeyboardEvent, ignoredModifierKeys: ModifierKey[]) {
  for (const key of MODIFIER_KEYS) {
    if (ignoredModifierKeys.includes(key)) {
      continue;
    }
    if (event.getModifierState(key)) {
      return true;
    }
  }
  return false;
}
