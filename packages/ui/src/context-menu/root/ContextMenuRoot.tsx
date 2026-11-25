import { createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ContextMenuRootContext } from './ContextMenuRootContext';
import { MenuRoot } from '../../menu/root/MenuRoot';
import { MenuRootContext } from '../../menu/root/MenuRootContext';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { MenuRoot as MenuRootTypes } from '../../menu/root/MenuRoot';
import { createBaseUiId } from '../../internals/baseUiId';

type Anchor = { getBoundingClientRect: () => DOMRect };

/**
 * A component that creates a context menu activated by right clicking or long pressing.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Context Menu](https://base-ui.com/react/components/context-menu)
 */
export function ContextMenuRoot(props: ContextMenuRoot.Props): JSX.Element {
  const [anchor, setAnchor] = createSignal<Anchor>(
    {
      getBoundingClientRect() {
        return DOMRect.fromRect({ width: 0, height: 0, x: 0, y: 0 });
      },
    },
  );

  const id = createBaseUiId()();

  const contextValue: ContextMenuRootContext = {
    get anchor() {
      return anchor();
    },
    setAnchor: (next) => setAnchor(() => next),
    actionsRef: { current: null },
    backdropRef: { current: null },
    internalBackdropRef: { current: null },
    positionerRef: { current: null },
    allowMouseUpTriggerRef: { current: true },
    initialCursorPointRef: { current: null },
    rootId: id,
  };

  return (
    <ContextMenuRootContext value={contextValue}>
      <MenuRootContext value={null}>
        <MenuRoot {...(props as MenuRootTypes.Props)} />
      </MenuRootContext>
    </ContextMenuRootContext>
  );
}

export interface ContextMenuRootState {}

export interface ContextMenuRootProps extends Omit<
  MenuRootTypes.Props,
  // Context Menu has no detached-trigger support (it opens from a right-click/long-press
  // area, not a registered trigger), so these inherited props are not applicable.
  | 'handle'
  | 'triggerId'
  | 'defaultTriggerId'
  | 'modal'
  | 'openOnHover'
  | 'delay'
  | 'closeDelay'
  | 'closeParentOnEsc'
  | 'onOpenChange'
  | 'actionsRef'
  // Context Menu opens from a pointer position rather than a registered trigger, so the
  // render-function form of `children` (which receives the active trigger's payload) is not applicable.
  | 'children'
> {
  /**
   * Event handler called when the menu is opened or closed.
   */
  onOpenChange?:
    | ((open: boolean, eventDetails: ContextMenuRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Ends the closing phase of the menu after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `onOpenChange` first, otherwise the menu completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   * - `close`: Closes the menu imperatively when called.
   */
  actionsRef?: MenuRootTypes.Props['actionsRef'];
  /**
   * @ignore
   * @deprecated This prop has no effect on Context Menu.
   */
  closeParentOnEsc?: MenuRootTypes.Props['closeParentOnEsc'];
  children?: JSX.Element | undefined;
}

export type ContextMenuRootActions = MenuRootTypes.Actions;
export type ContextMenuRootChangeEventReason = MenuRootTypes.ChangeEventReason;
export type ContextMenuRootChangeEventDetails =
  BaseUIChangeEventDetails<ContextMenuRoot.ChangeEventReason>;

export namespace ContextMenuRoot {
  export type State = ContextMenuRootState;
  export type Props = ContextMenuRootProps;
  export type Actions = ContextMenuRootActions;
  export type ChangeEventReason = ContextMenuRootChangeEventReason;
  export type ChangeEventDetails = ContextMenuRootChangeEventDetails;
}
