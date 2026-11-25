import { createUniqueId, type Accessor } from 'solid-js';
import type { BaseUIChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { PopupTriggerMap } from '../popupTriggerMap';
import { useFloatingParentNodeId } from '../tree/FloatingTree';
import { FloatingRootStore } from './FloatingRootStore';

/**
 * What `createFloatingRootStore` binds into its store. Every option is read lazily, so pass
 * getters (or accessors) to keep them reactive.
 */
export interface CreateFloatingRootStoreOptions {
  /**
   * Whether the popup is open.
   * @default () => false
   */
  open?: Accessor<boolean> | undefined;
  /**
   * Called when an interaction requests an open change.
   */
  onOpenChange?: ((open: boolean, eventDetails: BaseUIChangeEventDetails<string>) => void) | undefined;
  /**
   * The DOM element the popup is anchored to.
   */
  anchor?: Accessor<Element | null | undefined> | undefined;
  /**
   * The popup's positioner element, or the popup itself when it has no positioner.
   */
  positionerElement?: Accessor<HTMLElement | null | undefined> | undefined;
}

/**
 * Creates a `FloatingRootStore` for components that manage their open state without a popup
 * store (Navigation Menu, Toast). The open state, anchor and positioner element are bound to the
 * given accessors, so they are always current.
 */
export function createFloatingRootStore(
  options: CreateFloatingRootStoreOptions,
): FloatingRootStore {
  const defaultPopupId = `base-ui-${createUniqueId()}`;
  const nested = useFloatingParentNodeId() != null;

  const store = new FloatingRootStore({
    open: false,
    onOpenChange: (open, details) => options.onOpenChange?.(open, details),
    anchorElement: null,
    positionerElement: null,
    triggerElements: new PopupTriggerMap(),
    defaultPopupId,
    nested,
  });

  store.bind('open', () => options.open?.() ?? false);
  if (options.anchor) {
    const anchor = options.anchor;
    store.bind('anchorElement', () => anchor() ?? null);
  }
  if (options.positionerElement) {
    const positionerElement = options.positionerElement;
    store.bind('positionerElement', () => positionerElement() ?? null);
  }

  return store;
}
