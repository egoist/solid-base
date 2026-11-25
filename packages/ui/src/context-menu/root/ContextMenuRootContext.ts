import { createContext, useContext } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type { ContextMenuRoot } from './ContextMenuRoot';

export interface ContextMenuRootContext {
  /** The virtual element the menu is anchored to (the cursor position). Reactive. */
  readonly anchor: { getBoundingClientRect: () => DOMRect };
  setAnchor: (anchor: { getBoundingClientRect: () => DOMRect }) => void;
  readonly backdropRef: RefObject<HTMLDivElement | null>;
  readonly internalBackdropRef: RefObject<HTMLDivElement | null>;
  readonly actionsRef: RefObject<{
    setOpen: (nextOpen: boolean, eventDetails: ContextMenuRoot.ChangeEventDetails) => void;
  } | null>;
  readonly positionerRef: RefObject<HTMLElement | null>;
  readonly allowMouseUpTriggerRef: RefObject<boolean>;
  readonly initialCursorPointRef: RefObject<{ x: number; y: number } | null>;
  readonly rootId: string | undefined;
}

export const ContextMenuRootContext = createContext<ContextMenuRootContext | null>(null);

export function useContextMenuRootContext(optional: false): ContextMenuRootContext;
export function useContextMenuRootContext(optional?: true): ContextMenuRootContext | undefined;
export function useContextMenuRootContext(optional = true) {
  const context = useContext(ContextMenuRootContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: ContextMenuRootContext is missing. ContextMenu parts must be placed within <ContextMenu.Root>.',
    );
  }
  return context ?? undefined;
}
