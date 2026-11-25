import { createEffect, createSignal, flush, getObserver, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { computePosition } from '@floating-ui/dom';
import type {
  ComputePositionConfig,
  Middleware,
  MiddlewareData,
  Placement,
  Platform,
  Strategy,
  VirtualElement,
} from '@floating-ui/dom';
import { isElement } from '@floating-ui/utils/dom';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type { FloatingTreeStore } from '../tree/FloatingTreeStore';
import type {
  ExtendedElements,
  ExtendedRefs,
  PopupInteractionStore,
  PopupPositioningContext,
  ReferenceType,
} from '../types';
import { createPositioningContext } from './positioningContext';

export interface CreateFloatingOptions {
  /**
   * The store that owns the reference (`anchor`) and floating (`positionerElement`) elements.
   * Read once.
   */
  rootStore: PopupInteractionStore;
  /**
   * Whether the floating element is open. When `false`, `isPositioned` is reset. Leave it
   * `undefined` when the floating element unmounts while closed.
   */
  open?: boolean | undefined;
  /**
   * Where to place the floating element relative to the reference element.
   * @default 'bottom'
   */
  placement?: Placement | undefined;
  /**
   * The CSS `position` strategy.
   * @default 'absolute'
   */
  strategy?: Strategy | undefined;
  /**
   * Middleware to modify the positioning coordinates. A change (a new array) recomputes the
   * position, so build it in a memo from the values it depends on.
   */
  middleware?: Array<Middleware | null | undefined | false> | undefined;
  /**
   * Custom or extended platform object.
   */
  platform?: Platform | undefined;
  /**
   * Whether to use `transform` instead of `top` and `left` styles to position the floating element
   * (`floatingStyles`).
   * @default true
   */
  transform?: boolean | undefined;
  /**
   * Called while both the reference and floating elements are present, such as `autoUpdate`.
   * Must return a cleanup function.
   */
  whileElementsMounted?:
    | ((reference: ReferenceType, floating: HTMLElement, update: () => void) => () => void)
    | undefined;
  /**
   * Unique node id when using `FloatingTree`. Read once.
   */
  nodeId?: string | undefined;
  /**
   * External FloatingTree to use when the one provided by context can't be used. Read once.
   */
  externalTree?: FloatingTreeStore | undefined;
}

export interface FloatingRefs extends ExtendedRefs {
  /** The reference element positioning currently measures. */
  readonly reference: RefObject<ReferenceType | null>;
  /** The floating element positioning currently measures. */
  readonly floating: RefObject<HTMLElement | null>;
  /** The last DOM element the popup was anchored to. */
  readonly domReference: RefObject<Element | null>;
}

export interface FloatingData {
  x: number;
  y: number;
  strategy: Strategy;
  placement: Placement;
  middlewareData: MiddlewareData;
  isPositioned: boolean;
}

export interface CreateFloatingReturnValue extends Readonly<FloatingData> {
  /**
   * Styles to apply to the floating element to position it.
   */
  readonly floatingStyles: JSX.CSSProperties;
  /**
   * Recomputes the position.
   */
  update: () => void;
  refs: FloatingRefs;
  elements: ExtendedElements;
  context: PopupPositioningContext;
  rootStore: PopupInteractionStore;
}

/**
 * Provides data to position a floating element and context to add interactions: the Solid
 * counterpart of Base UI's `useBaseUIFloating` (Floating UI's `useFloating` from
 * `@floating-ui/react-dom` included).
 *
 * The caller supplies the root store, which owns the reference and floating elements. Options are
 * read lazily: pass getters for reactive values. The return value is a live object whose getters
 * are tracked.
 * @see https://floating-ui.com/docs/useFloating
 */
export function createFloating(options: CreateFloatingOptions): CreateFloatingReturnValue {
  const store = options.rootStore;
  const { nodeId, externalTree } = options;

  // Elements set through `refs` (Floating UI's own state) and the Positioner's `anchor`.
  const [localReference, setLocalReference] = createSignal<ReferenceType | null>(null, {
    ownedWrite: true,
  });
  const [localFloating, setLocalFloating] = createSignal<HTMLElement | null>(null, {
    ownedWrite: true,
  });
  const [positionerAnchor, setPositionerAnchor] = createSignal<ReferenceType | null>(null, {
    ownedWrite: true,
  });

  const initialData: FloatingData = {
    x: 0,
    y: 0,
    get strategy() {
      return options.strategy ?? 'absolute';
    },
    get placement() {
      return options.placement ?? 'bottom';
    },
    middlewareData: {},
    isPositioned: false,
  };

  // `dataRef` always holds the latest data (signal reads lag writes).
  let dataRef: FloatingData = initialData;
  const [data, setData] = createSignal<FloatingData>(initialData, { ownedWrite: true });

  function commitData(next: FloatingData) {
    dataRef = next;
    setData(() => next);
  }

  const referenceRef: RefObject<ReferenceType | null> = { current: null };
  const floatingRef: RefObject<HTMLElement | null> = { current: null };
  const domReferenceRef: RefObject<Element | null> = { current: null };

  let disposed = false;
  // Synced by the effect below, which runs before the first position update.
  let openRef: boolean | undefined;

  const referenceEl = () =>
    positionerAnchor() || store.select('anchor') || localReference() || null;
  const floatingEl = () => store.select('positionerElement') || localFloating() || null;

  function update() {
    const reference = referenceRef.current;
    const floating = floatingRef.current;
    if (!reference || !floating) {
      return;
    }

    const config = untrack(() => {
      const result: Partial<ComputePositionConfig> = {
        placement: options.placement ?? 'bottom',
        strategy: options.strategy ?? 'absolute',
        middleware: options.middleware ?? [],
      };
      if (options.platform) {
        result.platform = options.platform;
      }
      return result;
    });

    computePosition(reference, floating, config).then((result) => {
      const fullData: FloatingData = {
        ...result,
        // The floating element can be measured before it's opened (`keepMounted`): it's only
        // positioned once it's open.
        isPositioned: openRef !== false,
      };
      if (!disposed && !deepEqual(dataRef, fullData)) {
        commitData(fullData);
        flush();
      }
    });
  }

  createEffect(
    () => options.open,
    (open) => {
      openRef = open;
      if (open === false && dataRef.isPositioned) {
        commitData({ ...dataRef, isPositioned: false });
      }
    },
  );

  createEffect(
    () => store.select('anchorElement'),
    (anchorElement) => {
      if (anchorElement) {
        domReferenceRef.current = anchorElement;
      }
    },
  );

  createEffect(
    () => ({
      reference: referenceEl(),
      floating: floatingEl(),
      // Recompute and resubscribe when the positioning inputs change.
      placement: options.placement,
      strategy: options.strategy,
      middleware: options.middleware,
      platform: options.platform,
      whileElementsMounted: options.whileElementsMounted,
    }),
    ({ reference, floating, whileElementsMounted }) => {
      if (reference) {
        referenceRef.current = reference;
      }
      if (floating) {
        floatingRef.current = floating;
      }
      if (reference && floating) {
        if (whileElementsMounted) {
          return whileElementsMounted(reference, floating, update);
        }
        update();
      }
      return undefined;
    },
  );

  onCleanup(() => {
    disposed = true;
  });

  function setReference(node: ReferenceType | null) {
    if (node !== referenceRef.current) {
      referenceRef.current = node;
      setLocalReference(() => node);
    }
  }

  function setFloating(node: HTMLElement | null) {
    if (node !== floatingRef.current) {
      floatingRef.current = node;
      setLocalFloating(() => node);
    }
  }

  function setPositionReference(node: ReferenceType | null) {
    const computedPositionReference = isElement(node)
      ? ({
          getBoundingClientRect: () => node.getBoundingClientRect(),
          getClientRects: () => node.getClientRects(),
          contextElement: node,
        } satisfies VirtualElement)
      : node;
    // Keep the Positioner's anchor separately from the store's anchor, so the store's doesn't
    // replace it when it changes.
    setPositionerAnchor(() => computedPositionReference);
    setReference(computedPositionReference);
  }

  const refs: FloatingRefs = {
    reference: referenceRef,
    floating: floatingRef,
    domReference: domReferenceRef,
    setReference,
    setFloating,
    setPositionReference,
  };

  // Like `store.select`, reads outside a tracking scope (e.g. focus checks in effect cleanups that
  // walk the floating tree) are intentional snapshots.
  const elements: ExtendedElements = {
    get reference() {
      return getObserver() ? referenceEl() : untrack(referenceEl);
    },
    get floating() {
      return getObserver() ? floatingEl() : untrack(floatingEl);
    },
    get domReference() {
      return store.select('anchorElement');
    },
  };

  const floatingStyles = (): JSX.CSSProperties => {
    const strategy = options.strategy ?? 'absolute';
    const initialStyles: JSX.CSSProperties = { position: strategy, left: '0px', top: '0px' };
    const floating = elements.floating;
    if (!floating) {
      return initialStyles;
    }

    const current = data();
    const x = roundByDPR(floating, current.x);
    const y = roundByDPR(floating, current.y);

    if (options.transform ?? true) {
      return {
        ...initialStyles,
        transform: `translate(${x}px, ${y}px)`,
        ...(getDPR(floating) >= 1.5 && { 'will-change': 'transform' }),
      };
    }

    return { position: strategy, left: `${x}px`, top: `${y}px` };
  };

  const positionData = {
    get x() {
      return data().x;
    },
    get y() {
      return data().y;
    },
    get strategy() {
      return data().strategy;
    },
    get placement() {
      return data().placement;
    },
    get middlewareData() {
      return data().middlewareData;
    },
    get isPositioned() {
      return data().isPositioned;
    },
    get floatingStyles() {
      return floatingStyles();
    },
    update,
  };

  const context = createPositioningContext(store, {
    nodeId,
    externalTree,
    extra: Object.defineProperties(
      { refs, elements },
      Object.getOwnPropertyDescriptors(positionData),
    ),
  });

  return Object.defineProperties(
    { refs, elements, context, rootStore: store },
    Object.getOwnPropertyDescriptors(positionData),
  ) as CreateFloatingReturnValue;
}

function getDPR(element: Element): number {
  if (typeof window === 'undefined') {
    return 1;
  }
  const win = element.ownerDocument.defaultView || window;
  return win.devicePixelRatio || 1;
}

function roundByDPR(element: Element, value: number) {
  const dpr = getDPR(element);
  return Math.round(value * dpr) / dpr;
}

/**
 * The deep equality Floating UI uses to skip updates that don't change the position.
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a === 'function' && a.toString() === b.toString()) {
    return true;
  }

  if (a && b && typeof a === 'object') {
    if (Array.isArray(a)) {
      if (a.length !== b.length) {
        return false;
      }
      for (let i = a.length; i-- !== 0; ) {
        if (!deepEqual(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }

    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) {
      return false;
    }
    for (let i = keys.length; i-- !== 0; ) {
      if (!Object.prototype.hasOwnProperty.call(b, keys[i])) {
        return false;
      }
    }
    for (let i = keys.length; i-- !== 0; ) {
      const key = keys[i];
      if (!deepEqual(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }

  // eslint-disable-next-line no-self-compare
  return a !== a && b !== b;
}
