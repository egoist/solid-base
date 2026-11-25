import { createEffect, createSignal, untrack, type Accessor } from 'solid-js';
import { isElementDisabled } from '@egoist/solid-base-utils/isElementDisabled';
import { getTarget } from '@egoist/solid-base-utils/shadowDom';
import { createRefObject } from '@egoist/solid-base-utils/refObject';
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
   * Called when the registered items change.
   */
  onMapChange?: ((map: Map<HTMLElement, CompositeMetadata<any>>) => void) | undefined;
}

export interface CreateCompositeRootReturnValue {
  props: HTMLProps;
  rootRef: (element: HTMLElement) => void;
  highlightedIndex: Accessor<number>;
  onHighlightedIndexChange: (index: number, shouldScrollIntoView?: boolean) => void;
  elementsRef: RefObject<Array<HTMLElement | null>>;
  list: CompositeListContextValue<any>;
  relayKeyboardEvent: (event: KeyboardEvent) => void;
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

  const [internalHighlightedIndex, setInternalHighlightedIndex] = createSignal(0);
  const highlightedIndex = () => params.highlightedIndex?.() ?? internalHighlightedIndex();

  let rootElement: HTMLElement | null = null;
  const elementsRef = createRefObject<Array<HTMLElement | null>>([]);
  let hasSetDefaultIndex = false;
  let highlightedElement: HTMLElement | null = null;

  function onHighlightedIndexChange(index: number, shouldScrollIntoView = false) {
    highlightedElement = elementsRef.current[index] ?? null;
    if (params.onHighlightedIndexChange) {
      params.onHighlightedIndexChange(index);
    }
    if (untrack(() => params.highlightedIndex?.()) === undefined) {
      setInternalHighlightedIndex(index);
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

  function onMapChange(map: Map<HTMLElement, CompositeMetadata<any>>) {
    params.onMapChange?.(map);

    if (map.size === 0) {
      return;
    }

    const currentIndex = untrack(highlightedIndex);
    const currentDisabledIndices = untrack(disabledIndices);

    if (hasSetDefaultIndex) {
      const elements = elementsRef.current;
      const nextIndex = highlightedElement ? elements.indexOf(highlightedElement) : -1;

      if (nextIndex === -1) {
        const replacement = elements[currentIndex];
        if (
          !replacement ||
          isListIndexDisabled(elements, currentIndex, currentDisabledIndices)
        ) {
          onHighlightedIndexChange(getFallbackIndex(elements, currentDisabledIndices));
        } else {
          highlightedElement = replacement;
        }
      } else if (nextIndex !== currentIndex) {
        onHighlightedIndexChange(nextIndex);
      }
      return;
    }

    hasSetDefaultIndex = true;

    const sortedElements = elementsRef.current;
    const activeItem =
      sortedElements.find((element) => element?.hasAttribute(ACTIVE_COMPOSITE_ITEM)) ?? null;
    const activeIndex = activeItem ? (map.get(activeItem)?.index ?? -1) : -1;

    if (activeIndex !== -1) {
      onHighlightedIndexChange(activeIndex);
    } else if (isListIndexDisabled(sortedElements, currentIndex, currentDisabledIndices)) {
      const firstEnabledIndex = findNonDisabledListIndex(sortedElements, {
        disabledIndices: currentDisabledIndices,
      });
      if (!isIndexOutOfListBounds(sortedElements, firstEnabledIndex)) {
        onHighlightedIndexChange(firstEnabledIndex);
      }
    } else {
      highlightedElement = sortedElements[currentIndex] ?? null;
    }

    scrollIntoViewIfNeeded(
      rootElement,
      activeItem as HTMLElement | null,
      untrack(params.direction),
      untrack(orientation),
    );
  }

  const list = createCompositeList<any>({ elementsRef, onMapChange });

  createEffect(
    () => [disabledIndices(), highlightedIndex()] as const,
    ([indices, index]) => {
      if (indices == null || params.highlightedIndex?.() != null || !hasSetDefaultIndex) {
        return;
      }
      const elements = elementsRef.current;
      if (isListIndexDisabled(elements, index, indices)) {
        const firstEnabledIndex = findNonDisabledListIndex(elements, { disabledIndices: indices });
        if (!isIndexOutOfListBounds(elements, firstEnabledIndex)) {
          onHighlightedIndexChange(firstEnabledIndex);
        }
      }
    },
  );

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
    onFocus(event: FocusEvent) {
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
