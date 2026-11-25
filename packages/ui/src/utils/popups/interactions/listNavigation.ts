import { createEffect, createMemo, untrack } from 'solid-js';
import { isDev } from '@solidjs/web';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { createAnimationFrame } from '@egoist/solid-base-utils/animationFrame';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { platform } from '@egoist/solid-base-utils/platform';
import { activeElement, contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import { isElement, isHTMLElement } from '@floating-ui/utils/dom';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import type { HTMLProps } from '../../../internals/types';
import { useFloatingParentNodeId, useFloatingTree } from '../tree/FloatingTree';
import type { FloatingTreeStore } from '../tree/FloatingTreeStore';
import type { ElementProps, PopupInteractionStore } from '../types';
import {
  getMaxListIndex,
  getMinListIndex,
  getNextListIndex,
  isIndexOutOfListBounds,
} from '../../../internals/composite/listIndex';
import type { DisabledIndices } from '../../../internals/composite/listIndex';
import type { gridNavigation } from './gridNavigation';
import { ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT, ARROW_UP } from '../constants';
import { getFloatingFocusElement, isTypeableCombobox, isTypeableElement } from '../element';
import { enqueueFocus } from '../focus/enqueueFocus';
import { isVirtualClick, isVirtualPointerEvent, stopEvent } from '../event';

export type ListNavigationOrientation = 'vertical' | 'horizontal' | 'both';

// WebKit fires zero-delta `mousemove`/`pointermove` events when the list scrolls
// beneath a stationary pointer, moving the highlight during keyboard navigation.
// https://github.com/mui/base-ui/issues/4002
function isStationaryWebKitPointer(event: MouseEvent | PointerEvent) {
  return platform.engine.webkit && event.movementX === 0 && event.movementY === 0;
}

function doSwitch(
  orientation: ListNavigationOrientation | undefined,
  vertical: boolean,
  horizontal: boolean,
) {
  switch (orientation) {
    case 'vertical':
      return vertical;
    case 'horizontal':
      return horizontal;
    default:
      return vertical || horizontal;
  }
}

/**
 * Whether `key` moves along the list's main axis (`ArrowUp`/`ArrowDown` for a vertical list,
 * `ArrowLeft`/`ArrowRight` for a horizontal one, all arrows for `both`).
 */
export function isMainOrientationKey(
  key: string,
  orientation: ListNavigationOrientation | undefined,
) {
  const vertical = key === ARROW_UP || key === ARROW_DOWN;
  const horizontal = key === ARROW_LEFT || key === ARROW_RIGHT;
  return doSwitch(orientation, vertical, horizontal);
}

/**
 * Whether `key` moves toward the end of the list on its main axis (or is `Enter`/`Space`).
 */
export function isMainOrientationToEndKey(
  key: string,
  orientation: ListNavigationOrientation | undefined,
  rtl: boolean,
) {
  const vertical = key === ARROW_DOWN;
  const horizontal = rtl ? key === ARROW_LEFT : key === ARROW_RIGHT;
  return (
    doSwitch(orientation, vertical, horizontal) || key === 'Enter' || key === ' ' || key === ''
  );
}

/**
 * Whether `key` opens a nested list from its parent list item (the cross axis "forward" key).
 */
export function isCrossOrientationOpenKey(
  key: string,
  orientation: ListNavigationOrientation | undefined,
  rtl: boolean,
) {
  const vertical = rtl ? key === ARROW_LEFT : key === ARROW_RIGHT;
  const horizontal = key === ARROW_DOWN;
  return doSwitch(orientation, vertical, horizontal);
}

/**
 * Whether `key` closes a nested list (the cross axis "backward" key, or `Escape` for 2D lists).
 */
export function isCrossOrientationCloseKey(
  key: string,
  orientation: ListNavigationOrientation | undefined,
  rtl: boolean,
  grid: boolean,
) {
  const vertical = rtl ? key === ARROW_RIGHT : key === ARROW_LEFT;
  const horizontal = key === ARROW_UP;
  if (orientation === 'both' || (orientation === 'horizontal' && grid)) {
    return key === 'Escape';
  }
  return doSwitch(orientation, vertical, horizontal);
}

/**
 * Options of `createListNavigation`. They are read lazily (when an event is handled or an
 * effect re-runs), so pass getters for reactive values such as `activeIndex` and
 * `selectedIndex`:
 *
 * ```ts
 * createListNavigation(store, {
 *   listRef,
 *   get activeIndex() { return activeIndex(); },
 *   onNavigate: setActiveIndex,
 * });
 * ```
 */
export interface CreateListNavigationOptions {
  /**
   * A ref that holds an array of list items. Items write themselves into it (usually from a
   * ref callback, or through `CompositeList`'s `elementsRef`).
   * @default empty list
   */
  listRef: RefObject<Array<HTMLElement | null>>;
  /**
   * The index of the currently active (focused or highlighted) item, which may
   * or may not be selected.
   * @default null
   */
  activeIndex: number | null;
  /**
   * A callback that is called when the user navigates to a new active item,
   * passed in a new `activeIndex`.
   */
  onNavigate?: ((activeIndex: number | null, event: Event | undefined) => void) | undefined;
  /**
   * Whether the primitive is enabled, including all internal effects and event
   * handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * The currently selected item index, which may or may not be active.
   * @default null
   */
  selectedIndex?: number | null | undefined;
  /**
   * Whether to focus the item upon opening the floating element. 'auto' infers
   * what to do based on the input type (keyboard vs. pointer), while a boolean
   * value will force the value.
   * @default 'auto'
   */
  focusItemOnOpen?: boolean | 'auto' | undefined;
  /**
   * Whether hovering an item synchronizes the focus.
   * @default true
   */
  focusItemOnHover?: boolean | undefined;
  /**
   * Whether pressing an arrow key on the navigation's main axis opens the
   * floating element.
   * @default true
   */
  openOnArrowKeyDown?: boolean | undefined;
  /**
   * By default elements with either a `disabled` or `aria-disabled` attribute
   * are skipped in the list navigation — however, this requires the items to
   * be rendered.
   * This prop allows you to manually specify indices which should be disabled,
   * overriding the default logic.
   * For Windows-style select popups, where the menu does not open when
   * navigating via arrow keys, specify an empty array.
   * @default undefined
   */
  disabledIndices?: DisabledIndices | undefined;
  /**
   * Determines whether focus can escape the list, such that nothing is selected
   * after navigating beyond the boundary of the list. In some
   * autocomplete/combobox components, this may be desired, as screen
   * readers will return to the input.
   * `loopFocus` must be `true`.
   * @default false
   */
  allowEscape?: boolean | undefined;
  /**
   * Determines whether focus should loop around when navigating past the first
   * or last item.
   * @default false
   */
  loopFocus?: boolean | undefined;
  /**
   * If the list is nested within another one (e.g. a nested submenu), the
   * navigation semantics change.
   * @default false
   */
  nested?: boolean | undefined;
  /**
   * Allows to specify the orientation of the parent list, which is used to
   * determine the direction of the navigation.
   * This is useful when list navigation is used within a Composite,
   * as the primitive can't determine the orientation of the parent list automatically.
   * Otherwise it is read from the parent popup's `store.context.orientation` (through the
   * floating tree).
   */
  parentOrientation?: ListNavigationOrientation | undefined;
  /**
   * Whether the direction of the floating element's navigation is in RTL
   * layout.
   * @default false
   */
  rtl?: boolean | undefined;
  /**
   * Whether the focus is virtual (using `aria-activedescendant`).
   * Use this if you need focus to remain on the reference element
   * (such as an input), but allow arrow keys to navigate list items.
   * This is common in autocomplete listbox components.
   * Your virtually-focused list items must have a unique `id` set on them.
   * @default false
   */
  virtual?: boolean | undefined;
  /**
   * The orientation in which navigation occurs.
   * @default 'vertical'
   */
  orientation?: ListNavigationOrientation | undefined;
  /**
   * The orientation used to open the list from its trigger.
   * @default orientation
   */
  triggerOrientation?: ListNavigationOrientation | undefined;
  /**
   * The id of the root component. With `virtual`, `aria-activedescendant` is set to
   * `${id}-${activeIndex}`.
   */
  id?: string | undefined;
  /**
   * Whether to clear the active index when the pointer leaves an item.
   * @default true
   */
  resetOnPointerLeave?: boolean | undefined;
  /**
   * External FloatingTree to use when the one provided by context can't be used.
   * Read once, when the primitive is created.
   */
  externalTree?: FloatingTreeStore | undefined;
  /**
   * Focus target used when a nested list returns to a virtually focused parent.
   */
  nestedReturnFocusRef?: RefObject<HTMLElement | null> | undefined;
  /**
   * Computes two-dimensional list navigation for grid-capable consumers (see
   * `gridNavigation`). Injected so that non-grid consumers don't bundle the grid helpers.
   */
  grid?: typeof gridNavigation | null | undefined;
  /**
   * Whether Tab closes the open list the same way Shift+Tab does.
   * @default false
   */
  closeOnTab?: boolean | undefined;
}

interface EffectSnapshot {
  enabled: boolean;
  open: boolean;
  positionerElement: HTMLElement | null;
  anchorElement: Element | null;
  selectedIndex: number | null;
  activeIndex: number | null;
  focusItemOnOpen: boolean | 'auto';
  orientation: ListNavigationOrientation;
  triggerOrientation: ListNavigationOrientation;
  nested: boolean;
  rtl: boolean;
  virtual: boolean;
}

/**
 * Adds arrow key-based navigation of a list of items, either using real DOM
 * focus or virtual focus.
 *
 * Returns `ElementProps` created once:
 * - `reference`: for the element the popup is anchored to (`aria-activedescendant` with
 *   `virtual`, and the trigger key handlers that open the list or navigate it).
 * - `trigger`: the reference key/pointer handlers alone, for inactive triggers.
 * - `floating`: for the popup (key handling, `aria-activedescendant` with `virtual`).
 * - `item`: for each list item (syncs the active index on focus and hover).
 *
 * The list's `orientation` is published on `store.context.orientation` so nested lists can
 * read their parent's orientation.
 * @see https://floating-ui.com/docs/useListNavigation
 */
export function createListNavigation(
  store: PopupInteractionStore,
  options: CreateListNavigationOptions,
): ElementProps {
  const listRef = options.listRef;
  const enabled = () => options.enabled ?? true;
  const selectedIndexOption = () => options.selectedIndex ?? null;
  const allowEscape = () => options.allowEscape ?? false;
  const loopFocus = () => options.loopFocus ?? false;
  const nested = () => options.nested ?? false;
  const rtl = () => options.rtl ?? false;
  const virtual = () => options.virtual ?? false;
  const focusItemOnOpenOption = () => options.focusItemOnOpen ?? 'auto';
  const focusItemOnHover = () => options.focusItemOnHover ?? true;
  const openOnArrowKeyDown = () => options.openOnArrowKeyDown ?? true;
  const orientation = (): ListNavigationOrientation => options.orientation ?? 'vertical';
  const triggerOrientation = (): ListNavigationOrientation =>
    options.triggerOrientation ?? orientation();
  const resetOnPointerLeave = () => options.resetOnPointerLeave ?? true;
  const closeOnTab = () => options.closeOnTab ?? false;
  const isGrid = () => options.grid != null;

  const storeContext = store.context;

  const parentId = useFloatingParentNodeId();
  // `externalTree` is read once, like the tree context.
  const tree = useFloatingTree(untrack(() => options.externalTree));

  if (isDev) {
    createEffect(
      () => ({
        allowEscape: allowEscape(),
        loopFocus: loopFocus(),
        virtual: virtual(),
        orientation: orientation(),
        isGrid: isGrid(),
      }),
      (current) => {
        if (current.allowEscape) {
          if (!current.loopFocus) {
            console.warn('`createListNavigation` looping must be enabled to allow escaping.');
          }

          if (!current.virtual) {
            console.warn('`createListNavigation` must be virtual to allow escaping.');
          }
        }

        if (current.orientation === 'vertical' && current.isGrid) {
          console.warn(
            'In grid list navigation mode, the `orientation` should',
            'be either "horizontal" or "both".',
          );
        }
      },
    );
  }

  const getFloatingFocusEl = () => getFloatingFocusElement(store.select('positionerElement'));

  // Imperative state (React refs upstream).
  let focusItemOnOpenValue: boolean | 'auto' = 'auto';
  // Initial values are read once, as on the first render upstream.
  let index = untrack(() => options.selectedIndex ?? -1) as number;
  let key: string | null = null;
  let isPointerModality = true;
  let previousMounted = untrack(() => !!store.select('positionerElement'));
  let previousOpen = untrack(() => store.select('open'));
  let forceSyncFocus = false;
  let forceScrollIntoView = false;
  let cancelQueuedFocus: (() => void) | null = null;

  const focusFrame = createAnimationFrame();
  const waitForListPopulatedFrame = createAnimationFrame();
  const waitForActiveItemFrame = createAnimationFrame();

  function onNavigate(event?: Event) {
    options.onNavigate?.(index === -1 ? null : index, event);
  }

  function focusItem() {
    // Synchronous navigation must also supersede any deferred focus from an earlier update.
    focusFrame.cancel();

    const isVirtual = virtual();

    function runFocus(item: HTMLElement) {
      if (!isVirtual) {
        cancelQueuedFocus = enqueueFocus(item, {
          sync: forceSyncFocus,
          preventScroll: true,
        });
      }
    }

    const initialItem = listRef.current[index];
    const shouldForceScrollIntoView = forceScrollIntoView;

    if (initialItem) {
      runFocus(initialItem);
    }

    const scheduler = forceSyncFocus
      ? (callback: () => void) => callback()
      : (callback: () => void) => focusFrame.request(callback);

    scheduler(() => {
      const waitedItem = listRef.current[index] || initialItem;

      if (!waitedItem) {
        return;
      }

      if (!initialItem) {
        runFocus(waitedItem);
      }

      const shouldScrollIntoView = shouldForceScrollIntoView || !isPointerModality;

      if (shouldScrollIntoView) {
        // JSDOM doesn't support `.scrollIntoView()` but it's widely supported
        // by all browsers.
        waitedItem.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      }
    });
  }

  let lastSnapshot: EffectSnapshot | undefined;

  // The upstream layout effects, run in their declaration order. Each block only runs when one of
  // its upstream dependencies changed (all of them run on the first pass).
  //
  // Opening, closing and mounting the list write the active index (`onNavigate`), so this effect
  // doesn't track it: it takes the active index current when the list changes, and the effect
  // below follows later changes. Tracking it here would re-run this effect for its own writes.
  const listState = createMemo(
    (): Omit<EffectSnapshot, 'activeIndex'> => ({
      enabled: enabled(),
      open: store.select('open'),
      positionerElement: store.select('positionerElement'),
      anchorElement: store.select('anchorElement'),
      selectedIndex: selectedIndexOption(),
      focusItemOnOpen: focusItemOnOpenOption(),
      orientation: orientation(),
      triggerOrientation: triggerOrientation(),
      nested: nested(),
      rtl: rtl(),
      virtual: virtual(),
    }),
    { name: 'createListNavigation.listState', equals: shallowEqual },
  );

  // The blocks read options, the store, the floating tree and the rendered list (`listRef`, focus)
  // imperatively, like upstream's effects reading refs, and the active index they write follows
  // from that DOM state: the apply half reads the list state as of this run instead of taking it
  // as an argument, and runs untracked.
  createEffect(listState, () =>
    untrack(() => applyEffects({ ...listState(), activeIndex: options.activeIndex ?? null })),
    { name: 'createListNavigation.sync' },
  );

  // Moves focus to the active item when the active index changes (including the writes above).
  createEffect(
    () => options.activeIndex ?? null,
    (activeIndex) =>
      untrack(() => {
        if (lastSnapshot !== undefined && lastSnapshot.activeIndex !== activeIndex) {
          applyEffects({ ...lastSnapshot, activeIndex });
        }
      }),
    { name: 'createListNavigation.syncActiveIndex' },
  );

  function applyEffects(current: EffectSnapshot) {
    const prev = lastSnapshot;
    lastSnapshot = current;
    const changed = (...keys: Array<keyof EffectSnapshot>) =>
      prev === undefined || keys.some((k) => prev[k] !== current[k]);

    const { open, positionerElement } = current;

    if (changed('orientation')) {
      storeContext.orientation = current.orientation;
    }

    // Reset on its own: an explicit `focusItemOnOpen` can change one render before `open` does,
    // which must not discard the key the trigger just recorded.
    if (changed('open') && !open) {
      key = null;
    }

    // Explicit values can change with the opening interaction. Keep an inferred 'auto' value
    // from the trigger event, but apply a boolean before the initial highlight is synchronized.
    if (changed('open', 'focusItemOnOpen')) {
      if (!open || current.focusItemOnOpen !== 'auto') {
        focusItemOnOpenValue = current.focusItemOnOpen;
      }
    }

    // Sync `selectedIndex` to be the `activeIndex` upon opening the floating
    // element. Also, reset `activeIndex` upon closing the floating element.
    if (changed('enabled', 'open', 'positionerElement', 'selectedIndex') && current.enabled) {
      if (open && positionerElement) {
        index = current.selectedIndex ?? -1;
        if (focusItemOnOpenValue && current.selectedIndex != null) {
          // Regardless of the pointer modality, we want to ensure the selected
          // item comes into view when the floating element is opened.
          forceScrollIntoView = true;
          onNavigate();
        }
      } else if (previousMounted) {
        // Reset the active index when the list is no longer open and mounted (closing or
        // unmounting).
        index = -1;
        onNavigate();
      }
    }

    // Sync `activeIndex` to be the focused item while the floating element is
    // open.
    if (
      changed(
        'enabled',
        'open',
        'positionerElement',
        'activeIndex',
        'nested',
        'triggerOrientation',
        'rtl',
      ) &&
      current.enabled
    ) {
      syncActiveIndex(current);
    }

    // Ensure the parent floating element has focus when a nested child closes
    // to allow arrow key navigation to work after the pointer leaves the child.
    if (changed('enabled', 'positionerElement', 'anchorElement', 'virtual')) {
      focusParentOnNestedClose(current);
    }

    previousOpen = open;
    previousMounted = !!positionerElement;
  }

  function syncActiveIndex(current: EffectSnapshot) {
    const { open, positionerElement, activeIndex } = current;

    if (!open) {
      forceSyncFocus = false;
      return;
    }
    if (!positionerElement) {
      return;
    }

    if (activeIndex == null) {
      forceSyncFocus = false;

      if (selectedIndexOption() != null) {
        return;
      }

      // Reset while the floating element was open (e.g. the list changed).
      if (previousMounted) {
        index = -1;
        focusItem();
      }

      // Initial sync.
      if (
        (!previousOpen || !previousMounted) &&
        focusItemOnOpenValue &&
        (key != null || (focusItemOnOpenValue === true && key == null))
      ) {
        let runs = 0;
        const waitForListPopulated = () => {
          if (listRef.current[0] == null) {
            // Avoid letting the browser paint if possible on the first try,
            // otherwise use rAF. Don't try more than twice, since something
            // is wrong otherwise.
            if (runs < 2) {
              const scheduler = runs
                ? (callback: () => void) => waitForListPopulatedFrame.request(callback)
                : queueMicrotask;
              scheduler(waitForListPopulated);
            }
            runs += 1;
          } else {
            // Initially focus the first non-disabled item. `disabledIndices` is deliberately
            // omitted here so attribute-disabled items (`disabled`/`aria-disabled`) are skipped
            // on open even when the consumer passes an empty `disabledIndices` array. Passing it
            // would regress that behavior (see mui/base-ui#2604).
            // The key came from the trigger, so it is read on the trigger's orientation.
            index =
              key == null ||
              isMainOrientationToEndKey(key, current.triggerOrientation, current.rtl) ||
              current.nested
                ? getMinListIndex(listRef)
                : getMaxListIndex(listRef);
            key = null;
            onNavigate();
          }
        };

        waitForListPopulated();
      }
    } else {
      const syncFocusedItem = () => {
        index = activeIndex;
        focusItem();
        forceScrollIntoView = false;
      };

      if (!isIndexOutOfListBounds(listRef.current, activeIndex)) {
        syncFocusedItem();
        return;
      }

      // Solid-specific: items registered through `CompositeList` are indexed after a microtask,
      // so unlike upstream (where children's refs and layout effects run before this effect) the
      // list can still be empty here. Wait for it the same way the initial sync does.
      let runs = 0;
      const waitForActiveItem = () => {
        if (lastSnapshot !== current) {
          // Superseded by a newer update.
          return;
        }
        if (!isIndexOutOfListBounds(listRef.current, activeIndex)) {
          syncFocusedItem();
        } else if (runs < 2) {
          const scheduler = runs
            ? (callback: () => void) => waitForActiveItemFrame.request(callback)
            : queueMicrotask;
          runs += 1;
          scheduler(waitForActiveItem);
        }
      };
      waitForActiveItem();
    }
  }

  function focusParentOnNestedClose(current: EffectSnapshot) {
    if (
      !current.enabled ||
      current.positionerElement ||
      !tree ||
      current.virtual ||
      !previousMounted
    ) {
      return;
    }

    const nodes = tree.nodesRef.current;
    const parent = nodes.find((node) => node.id === parentId)?.context?.elements.floating;
    // `positionerElement` is null here (see the guard above), so resolve the owner document
    // from an in-DOM element for realm-safety (shadow DOM/iframes): the reference element, falling
    // back to the parent floating element when the reference is virtual (`anchorElement` is null).
    const activeEl = activeElement(ownerDocument(current.anchorElement ?? parent ?? null));
    const treeContainsActiveEl = nodes.some(
      (node) => node.context && contains(node.context.elements.floating, activeEl),
    );

    if (parent && !treeContainsActiveEl && isPointerModality) {
      parent.focus({ preventScroll: true });
    }
  }

  function syncCurrentTarget(event: Event) {
    if (!store.select('open')) {
      return;
    }

    const targetIndex = listRef.current.indexOf(event.currentTarget as HTMLElement);
    if (targetIndex !== -1 && (index !== targetIndex || options.activeIndex !== targetIndex)) {
      index = targetIndex;
      onNavigate(event);
    }
  }

  function getParentOrientation() {
    return (
      options.parentOrientation ??
      tree?.nodesRef.current.find((node) => node.id === parentId)?.context?.rootStore.context
        .orientation
    );
  }

  function getMinEnabledIndex() {
    return getMinListIndex(listRef, options.disabledIndices);
  }

  function getAnchorElement() {
    return store.select('anchorElement');
  }

  function commonOnKeyDown(event: KeyboardEvent) {
    isPointerModality = false;
    forceSyncFocus = true;

    // When composing a character, Chrome fires ArrowDown twice. Firefox/Safari
    // don't appear to suffer from this. `event.isComposing` is avoided due to
    // Safari not supporting it properly (although it's not needed in the first
    // place for Safari, just avoiding any possible issues).
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (event.which === 229) {
      return;
    }

    const open = store.select('open');

    // If the floating element is animating out, ignore navigation. Otherwise,
    // the `activeIndex` gets set to 0 despite not being open so the next time
    // the user ArrowDowns, the first item won't be focused.
    if (!open && event.currentTarget === getFloatingFocusEl()) {
      return;
    }

    const currentOrientation = orientation();
    const isRtl = rtl();
    const isVirtual = virtual();
    const disabledIndices = options.disabledIndices;
    const activeIndex = options.activeIndex ?? null;

    if (nested() && isCrossOrientationCloseKey(event.key, currentOrientation, isRtl, isGrid())) {
      // If the nested list's close key is also the parent navigation key,
      // let the parent navigate. Otherwise, stop propagating the event.
      if (!isMainOrientationKey(event.key, getParentOrientation())) {
        stopEvent(event);
      }

      store.setOpen(false, createChangeEventDetails(REASONS.listNavigation, event));

      const returnElement = options.nestedReturnFocusRef?.current ?? getAnchorElement();
      if (isHTMLElement(returnElement)) {
        returnElement.focus();
      }

      return;
    }

    // The consumer owns `activeIndex` and may decline a navigation this primitive proposed, such
    // as a virtual list keeping its highlight when the reference is refocused. Declining produces
    // no update, so reconcile here: otherwise the cursor drifts from the rendered highlight and
    // this key moves from the wrong position.
    if (
      activeIndex != null &&
      activeIndex !== index &&
      !isIndexOutOfListBounds(listRef.current, activeIndex)
    ) {
      index = activeIndex;
    }

    const currentIndex = index;
    const minIndex = getMinListIndex(listRef, disabledIndices);
    const maxIndex = getMaxListIndex(listRef, disabledIndices);

    if (!isTypeableCombobox(getAnchorElement())) {
      if (event.key === 'Home') {
        stopEvent(event);
        index = minIndex;
        onNavigate(event);
      }

      if (event.key === 'End') {
        stopEvent(event);
        index = maxIndex;
        onNavigate(event);
      }
    }

    // Grid navigation is injected by grid-capable consumers so non-grid
    // consumers (menu, select) tree-shake the grid helpers out.
    const navigateGrid = options.grid;
    if (navigateGrid != null) {
      const gridIndex = navigateGrid(
        event,
        index,
        listRef,
        currentOrientation,
        loopFocus(),
        isRtl,
        disabledIndices,
        minIndex,
        maxIndex,
      );

      // The grid navigator returns the unchanged index for keys it does not handle, and
      // reporting that as a navigation would re-emit the current highlight on every keydown.
      if (gridIndex != null && gridIndex !== index) {
        index = gridIndex;
        onNavigate(event);
      }

      if (currentOrientation === 'both') {
        return;
      }
    }

    if (isMainOrientationKey(event.key, currentOrientation)) {
      stopEvent(event);

      // Reset the index if no item is focused. Focus can also rest on a container inside the
      // popup, such as a list that holds the `menu` role. Keys bubbling from a portaled nested
      // popup are not in this popup's DOM, so they navigate from the current index.
      const currentTarget = event.currentTarget as Element;
      const focusedElement = activeElement(currentTarget.ownerDocument);
      if (
        open &&
        !isVirtual &&
        contains(currentTarget, focusedElement) &&
        !listRef.current.some((item) => item != null && contains(item, focusedElement))
      ) {
        index = isMainOrientationToEndKey(event.key, currentOrientation, isRtl)
          ? minIndex
          : maxIndex;
        onNavigate(event);
        // The boundary item may already be highlighted, so `activeIndex` won't change and the
        // effect that moves focus to the highlighted item won't run.
        if (activeIndex === index) {
          focusItem();
        }
        return;
      }

      const next = getNextListIndex(listRef.current, currentIndex, {
        decrement: !isMainOrientationToEndKey(event.key, currentOrientation, isRtl),
        loopFocus: loopFocus(),
        allowEscape: allowEscape(),
        disabledIndices,
        minIndex,
        maxIndex,
      });
      if (next.wrapped) {
        // Give time for virtualizers to update the listRef.
        forceSyncFocus = false;
      }
      index = next.index;

      onNavigate(event);
    }
  }

  const item: HTMLProps = {
    onFocusIn(event: FocusEvent) {
      if (!enabled()) {
        return;
      }
      forceSyncFocus = true;
      syncCurrentTarget(event);
    },
    onMouseMove(event: MouseEvent) {
      if (!enabled() || isStationaryWebKitPointer(event)) {
        return;
      }
      forceSyncFocus = true;
      forceScrollIntoView = false;
      if (focusItemOnHover()) {
        syncCurrentTarget(event);
      }
    },
    onPointerLeave(event: PointerEvent) {
      if (
        !enabled() ||
        !store.select('open') ||
        !isPointerModality ||
        event.pointerType === 'touch'
      ) {
        return;
      }

      forceSyncFocus = true;

      if (!resetOnPointerLeave()) {
        return;
      }

      const relatedTarget = isElement(event.relatedTarget) ? event.relatedTarget : null;
      if (
        !focusItemOnHover() ||
        listRef.current.some((listItem) => contains(listItem, relatedTarget))
      ) {
        return;
      }

      cancelQueuedFocus?.();
      cancelQueuedFocus = null;

      index = -1;
      onNavigate(event);

      if (!virtual()) {
        const floatingFocusEl = getFloatingFocusEl();
        const activeEl = activeElement(ownerDocument(floatingFocusEl));
        if (floatingFocusEl && contains(floatingFocusEl, activeEl)) {
          floatingFocusEl.focus({ preventScroll: true });
        }
      }
    },
  };

  function getAriaActiveDescendant() {
    if (!enabled() || !virtual() || !store.select('open')) {
      return undefined;
    }
    const activeIndex = options.activeIndex;
    return activeIndex != null ? `${options.id}-${activeIndex}` : undefined;
  }

  const floating: HTMLProps = {
    get 'aria-activedescendant'() {
      return !isTypeableCombobox(store.select('anchorElement'))
        ? getAriaActiveDescendant()
        : undefined;
    },
    onKeyDown(event: KeyboardEvent) {
      if (!enabled()) {
        return;
      }

      // Close on Shift+Tab, and on Tab when `closeOnTab` is set.
      if (
        event.key === 'Tab' &&
        (event.shiftKey || closeOnTab()) &&
        store.select('open') &&
        !virtual()
      ) {
        // If the event originated from within a nested element (e.g., a Dialog opened from
        // within the menu), don't close the menu. The nested element has its own focus
        // management and should handle the Tab key.
        const target = getTarget(event) as Element | null;
        if (target && !contains(getFloatingFocusEl(), target)) {
          return;
        }

        stopEvent(event);
        const details = createChangeEventDetails(REASONS.focusOut, event);
        store.setOpen(false, details);

        const returnElement = options.nestedReturnFocusRef?.current ?? getAnchorElement();
        if (!details.isCanceled && isHTMLElement(returnElement)) {
          returnElement.focus();
        }

        return;
      }

      commonOnKeyDown(event);
    },
    onPointerMove(event: PointerEvent) {
      if (!enabled() || isStationaryWebKitPointer(event)) {
        return;
      }
      isPointerModality = true;
    },
  };

  function openOnNavigationKeyDown(event: KeyboardEvent) {
    store.setOpen(
      true,
      createChangeEventDetails(REASONS.listNavigation, event, event.currentTarget as HTMLElement),
    );
  }

  function checkVirtualMouse(event: MouseEvent) {
    if (!enabled()) {
      return;
    }
    if (focusItemOnOpenOption() === 'auto' && isVirtualClick(event)) {
      focusItemOnOpenValue = !virtual();
    }
  }

  function checkVirtualPointer(event: PointerEvent) {
    if (!enabled()) {
      return;
    }
    // `pointerdown` fires first, reset the state then perform the checks.
    const focusItemOnOpen = focusItemOnOpenOption();
    focusItemOnOpenValue = focusItemOnOpen;
    if (focusItemOnOpen === 'auto' && isVirtualPointerEvent(event)) {
      focusItemOnOpenValue = true;
    }
  }

  const trigger: HTMLProps = {
    onKeyDown(event: KeyboardEvent) {
      if (!enabled()) {
        return undefined;
      }

      const currentOpen = store.select('open');
      isPointerModality = false;

      const isNested = nested();
      const isVirtual = virtual();
      const isRtl = rtl();
      const isArrowKey = event.key.startsWith('Arrow');
      const isParentCrossOpenKey = isCrossOrientationOpenKey(
        event.key,
        getParentOrientation(),
        isRtl,
      );
      const isMainKey = isMainOrientationKey(
        event.key,
        currentOpen ? orientation() : triggerOrientation(),
      );
      const isNavigationKey =
        (isNested ? isParentCrossOpenKey : isMainKey) ||
        event.key === 'Enter' ||
        event.key.trim() === '';

      if (isVirtual && currentOpen && (!isNested || isTypeableElement(event.currentTarget))) {
        return commonOnKeyDown(event);
      }

      // If a floating element should not open on arrow key down, avoid
      // setting `activeIndex` while it's closed.
      if (!currentOpen && !openOnArrowKeyDown() && isArrowKey) {
        return undefined;
      }

      if (isNavigationKey) {
        const isParentMainKey = isMainOrientationKey(event.key, getParentOrientation());
        key = isNested && isParentMainKey ? null : event.key;
      }

      if (isNested) {
        if (isParentCrossOpenKey) {
          stopEvent(event);

          if (currentOpen) {
            index = getMinEnabledIndex();
            onNavigate(event);
            if (isVirtual) {
              getFloatingFocusEl()?.focus();
            }
          } else {
            openOnNavigationKeyDown(event);
          }
        }

        return undefined;
      }

      if (isMainKey) {
        const selectedIndex = selectedIndexOption();
        if (selectedIndex != null) {
          index = selectedIndex;
        }

        stopEvent(event);

        if (!currentOpen && openOnArrowKeyDown()) {
          openOnNavigationKeyDown(event);
        } else {
          commonOnKeyDown(event);
        }

        if (currentOpen) {
          onNavigate(event);
        }
      }

      return undefined;
    },
    onFocusIn(event: FocusEvent) {
      if (!enabled() || event.target !== event.currentTarget) {
        return;
      }

      if (store.select('open') && !virtual()) {
        index = -1;
        onNavigate(event);
      }
    },
    onPointerDown: checkVirtualPointer,
    onPointerEnter: checkVirtualPointer,
    onMouseDown: checkVirtualMouse,
    onClick: checkVirtualMouse,
  };

  const reference: HTMLProps = {
    get 'aria-activedescendant'() {
      return getAriaActiveDescendant();
    },
    ...trigger,
  };

  return { reference, floating, item, trigger };
}

function shallowEqual<T extends object>(a: T, b: T) {
  for (const key of Object.keys(a) as Array<keyof T>) {
    if (!Object.is(a[key], b[key])) {
      return false;
    }
  }
  return true;
}
