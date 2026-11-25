import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
  useContext,
  type Accessor,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { RefObject } from '@egoist/solid-base-utils/refObject';

export type CompositeMetadata<CustomMetadata> = {
  index: number;
} & CustomMetadata;

export interface CompositeListRegistration<Metadata> {
  /** Metadata published with the item. Getters stay reactive. */
  metadata?: Metadata | null | undefined;
  /** The explicit index, or `null` to index the item by its document position. */
  index?: Accessor<number | null | undefined> | undefined;
  /** The text used for typeahead. Falls back to the element's text content. */
  label?: Accessor<string | null | undefined> | undefined;
}

interface Entry<Metadata> extends CompositeListRegistration<Metadata> {
  order: number;
  /** How many items registered this element (see `register`). */
  count: number;
}

export interface CompositeListContextValue<Metadata = any> {
  register: (element: HTMLElement, registration: CompositeListRegistration<Metadata>) => void;
  unregister: (element: HTMLElement) => void;
  /** The registered elements ordered by index (explicit indexes can leave empty slots). */
  elements: Accessor<Array<HTMLElement | null>>;
  /** Registered elements mapped to their index and metadata. */
  map: Accessor<Map<HTMLElement, CompositeMetadata<Metadata>>>;
  /** Returns the index of a registered element (reactive), or `-1`. */
  indexOf: (element: HTMLElement | null | undefined) => number;
  /**
   * Subscribes to changes of the ordered map. Subscribers run before `onMapChange`. Only lists
   * created with `onMapChange`, `elementsRef` or `labelsRef` notify them. Returns the unsubscribe
   * function.
   */
  subscribeMapChange?: ((listener: () => void) => () => void) | undefined;
}

export interface CreateCompositeListParameters<Metadata> {
  /**
   * Kept in sync with the ordered elements, for imperative consumers (list navigation).
   */
  elementsRef?: RefObject<Array<HTMLElement | null>> | undefined;
  /**
   * Kept in sync with the ordered labels, for typeahead.
   */
  labelsRef?: RefObject<Array<string | null>> | undefined;
  /**
   * Called whenever the ordered map changes.
   */
  onMapChange?: ((map: Map<HTMLElement, CompositeMetadata<Metadata>>) => void) | undefined;
}

/**
 * Tracks the items registered through the returned context and orders them by their explicit
 * index or their document position.
 */
export function createCompositeList<Metadata = {}>(
  params: CreateCompositeListParameters<Metadata> = {},
): CompositeListContextValue<Metadata> {
  const entries = new Map<HTMLElement, Entry<Metadata>>();
  const mapChangeListeners = new Set<() => void>();
  const [version, setVersion] = createSignal(0);
  let order = 0;
  let scheduled = false;

  // Positions can only be compared once the elements are attached, which happens after the ref
  // callbacks ran. Re-sort in a microtask, outside of the reactive scopes registering items.
  function scheduleUpdate() {
    if (scheduled) {
      return;
    }
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      setVersion((v) => v + 1);
    });
  }

  const sorted = createMemo(() => {
    version();
    const list = [...entries.entries()];
    list.sort(([a, entryA], [b, entryB]) => {
      if (a.isConnected && b.isConnected && a !== b) {
        const position = a.compareDocumentPosition(b);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
          return -1;
        }
        if (position & Node.DOCUMENT_POSITION_PRECEDING) {
          return 1;
        }
      }
      return entryA.order - entryB.order;
    });
    return list;
  });

  const map = createMemo(() => {
    const result = new Map<HTMLElement, CompositeMetadata<Metadata>>();
    let nextIndex = 0;
    for (const [element, entry] of sorted()) {
      const explicit = entry.index?.();
      const index = explicit ?? nextIndex;
      nextIndex = Math.max(nextIndex, index) + 1;
      result.set(
        element,
        Object.create((entry.metadata ?? null) as object | null, {
          index: { value: index, enumerable: true },
        }),
      );
    }
    return result;
  });

  const elements = createMemo(() => {
    const result: Array<HTMLElement | null> = [];
    for (const [element, metadata] of map()) {
      result[metadata.index] = element;
    }
    for (let i = 0; i < result.length; i += 1) {
      result[i] ??= null;
    }
    return result;
  });

  const syncRefs = createMemo(() => {
    const currentElements = elements();
    const currentMap = map();
    if (params.elementsRef) {
      params.elementsRef.current = currentElements;
    }
    if (params.labelsRef) {
      const labels: Array<string | null> = [];
      for (const [element, metadata] of currentMap) {
        const entry = entries.get(element);
        labels[metadata.index] = untrack(() => entry?.label?.()) ?? element.textContent ?? null;
      }
      params.labelsRef.current = labels;
    }
    return currentMap;
  });

  const context: CompositeListContextValue<Metadata> = {
    register(element, registration) {
      const existing = entries.get(element);
      if (existing) {
        // Composed items (e.g. `<Toolbar.Button render={(props) => <Toggle {...props} />} />`)
        // register the same element twice. The outer item's ref runs first: its registration
        // wins, like upstream where the parent's layout effect registers last.
        existing.count += 1;
        return;
      }
      entries.set(element, { ...registration, order: (order += 1), count: 1 });
      scheduleUpdate();
    },
    unregister(element) {
      const existing = entries.get(element);
      if (existing && existing.count > 1) {
        existing.count -= 1;
        return;
      }
      if (entries.delete(element)) {
        scheduleUpdate();
      }
    },
    elements: () => {
      syncRefs();
      return elements();
    },
    map: syncRefs,
    indexOf(element) {
      if (!element) {
        return -1;
      }
      return syncRefs().get(element)?.index ?? -1;
    },
    subscribeMapChange(listener) {
      mapChangeListeners.add(listener);
      return () => {
        mapChangeListeners.delete(listener);
      };
    },
  };

  if (params.onMapChange || params.elementsRef || params.labelsRef) {
    // Keep the refs in sync even when nothing reads the list reactively.
    createEffect(syncRefs, (currentMap) => {
      mapChangeListeners.forEach((listener) => listener());
      params.onMapChange?.(currentMap);
    });
  }

  return context;
}

export const CompositeListContext = createContext<CompositeListContextValue<any> | null>(null);

export function useCompositeListContext<Metadata = any>() {
  return useContext(CompositeListContext) as CompositeListContextValue<Metadata> | null;
}

/**
 * Provides context for a list of items in a composite component.
 */
export function CompositeList<Metadata>(props: {
  list: CompositeListContextValue<Metadata>;
  children?: JSX.Element;
}) {
  return <CompositeListContext value={props.list}>{props.children}</CompositeListContext>;
}

export interface UseCompositeListItemParameters<Metadata> {
  /** An explicit index, bypassing document-position ordering. */
  index?: Accessor<number | null | undefined> | undefined;
  /** Text for typeahead. */
  label?: Accessor<string | null | undefined> | undefined;
  /** Metadata published with the item. Getters stay reactive. */
  metadata?: Metadata | undefined;
  /** The list to register with, in place of the one provided through context. */
  list?: CompositeListContextValue<Metadata> | null | undefined;
}

export interface UseCompositeListItemReturnValue {
  /** Pass to the item element. */
  ref: (element: HTMLElement) => void;
  /** The item's index in the list, `-1` until it's resolved. */
  index: Accessor<number>;
}

/**
 * Registers a list item and its index (DOM position) in the closest `CompositeList`.
 */
export function useCompositeListItem<Metadata>(
  params: UseCompositeListItemParameters<Metadata> = {},
): UseCompositeListItemReturnValue {
  const list = params.list ?? useCompositeListContext<Metadata>();
  const [element, setElement] = createSignal<HTMLElement | null>(null);

  onCleanup(() => {
    const current = untrack(element);
    if (current) {
      list?.unregister(current);
    }
  });

  return {
    ref(node) {
      const previous = untrack(element);
      if (previous === node) {
        return;
      }
      if (previous) {
        list?.unregister(previous);
      }
      setElement(node);
      list?.register(node, {
        metadata: params.metadata,
        index: params.index,
        label: params.label,
      });
    },
    index: () => {
      const explicit = params.index?.();
      if (explicit != null) {
        return explicit;
      }
      return list?.indexOf(element()) ?? -1;
    },
  };
}
