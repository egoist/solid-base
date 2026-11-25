/**
 * Helpers for testing popup interactions in isolation (the Solid counterpart of Floating UI's
 * `useFloating` + `useInteractions` used by the upstream tests). Not exported publicly.
 */
import { createSignal, type Accessor } from 'solid-js';
import type { Placement } from '@floating-ui/dom';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { mergeProps } from '../../merge-props/mergeProps';
import type { HTMLProps } from '../../internals/types';
import { createFloatingRootStore } from './floating-root/createFloatingRootStore';
import type { FloatingRootStore } from './floating-root/FloatingRootStore';
import { createPositioningContext } from './positioning/positioningContext';
import type { FloatingTreeStore } from './tree/FloatingTreeStore';
import type { ElementProps, ItemPropsArg } from './types';

export interface CreateTestFloatingOptions {
  open: Accessor<boolean>;
  onOpenChange?: ((open: boolean, eventDetails: BaseUIChangeEventDetails<string>) => void) | undefined;
  /** Registers the popup in the floating tree under this node id. */
  nodeId?: string | undefined;
  externalTree?: FloatingTreeStore | undefined;
  /**
   * The placement exposed on the positioning context (what `createFloating` computes), read by
   * `safePolygon`. Left out unless given.
   */
  placement?: Placement | undefined;
}

export interface CreateTestFloatingReturnValue {
  store: FloatingRootStore;
  refs: {
    setReference: (element: Element | null) => void;
    setFloating: (element: HTMLElement | null) => void;
  };
  elements: {
    reference: Accessor<Element | null>;
    floating: Accessor<HTMLElement | null>;
  };
}

/**
 * Creates a `FloatingRootStore` whose anchor and floating elements come from ref callbacks.
 */
export function createTestFloating(options: CreateTestFloatingOptions): CreateTestFloatingReturnValue {
  const [reference, setReference] = createSignal<Element | null>(null, { ownedWrite: true });
  const [floating, setFloating] = createSignal<HTMLElement | null>(null, { ownedWrite: true });

  const store = createFloatingRootStore({
    open: options.open,
    onOpenChange: (open, details) => options.onOpenChange?.(open, details),
    anchor: reference,
    positionerElement: floating,
  });

  createPositioningContext(store, {
    nodeId: options.nodeId,
    externalTree: options.externalTree,
    extra: options.placement ? { placement: options.placement } : undefined,
  });

  return {
    store,
    refs: {
      setReference: (element) => setReference(() => element),
      setFloating: (element) => setFloating(() => element),
    },
    elements: { reference, floating },
  };
}

type PropsKey = 'reference' | 'floating' | 'trigger';

/**
 * Merges the props an interaction list returns for one element kind, plus user props (which
 * run first, like Floating UI's `getReferenceProps(userProps)`).
 */
export function getInteractionProps(
  list: Array<ElementProps | undefined>,
  key: PropsKey,
  userProps?: HTMLProps,
): HTMLProps {
  return mergeProps(...list.map((props) => props?.[key]).reverse(), userProps);
}

/**
 * Merges item props of an interaction list.
 */
export function getItemInteractionProps(
  list: Array<ElementProps | undefined>,
  userProps?: HTMLProps & ItemPropsArg,
): HTMLProps {
  return mergeProps(
    ...list
      .map((props) => {
        const item = props?.item;
        return typeof item === 'function' ? item(userProps ?? {}) : item;
      })
      .reverse(),
    userProps,
  );
}
