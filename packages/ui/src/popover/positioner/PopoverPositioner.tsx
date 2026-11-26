import { Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { FloatingNode, createFloatingNodeId } from '../../utils/popups/tree/FloatingTree';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { PopoverPositionerContext } from './PopoverPositionerContext';
import type {
  Side,
  Align,
  CreateAnchorPositioningSharedParameters,
} from '../../internals/anchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { usePopoverPortalContext } from '../portal/PopoverPortalContext';
import { InternalBackdrop } from '../../utils/popups/InternalBackdrop';
import { REASONS } from '../../internals/reasons';
import { createTriggerSwitchTransition } from '../../internals/triggerSwitchTransition';
import { createPopupPositioner } from '../../utils/popups/popupPositioner';
import { createAnchoredPopupScrollLock } from '../../utils/popups/anchoredPopupScrollLock';

/**
 * Positions the popover against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Popover](https://base.egoist.dev/components/popover)
 */
export function PopoverPositioner(componentProps: PopoverPositioner.Props): JSX.Element {
  const store = usePopoverRootContext();
  const keepMounted = usePopoverPortalContext();
  const nodeId = createFloatingNodeId();

  const { element } = createPopupPositioner(store, componentProps, {
    get keepMounted() {
      return keepMounted();
    },
    positioning: { nodeId },
    // The children are created inside the positioner element: provide the contexts there.
    renderChildren: (positioning) => (
      <PopoverPositionerContext value={positioning}>
        <FloatingNode id={nodeId}>{componentProps.children}</FloatingNode>
      </PopoverPositionerContext>
    ),
  });

  const open = () => store.select('open');
  const triggerElement = () => store.select('activeTriggerElement');

  createTriggerSwitchTransition({
    store,
    get domReference() {
      return store.select('anchorElement');
    },
    get positionerElement() {
      return store.select('positionerElement');
    },
    get open() {
      return open();
    },
  });

  const trueModalNonHover = () =>
    store.select('modal') === true && store.select('openChangeReason') !== REASONS.triggerHover;

  createAnchoredPopupScrollLock(
    () => open() && trueModalNonHover(),
    () => store.select('openMethod') === 'touch',
    () => store.select('positionerElement'),
    triggerElement,
  );

  return (
    <>
      <Show when={store.select('mounted') && trueModalNonHover()}>
        <InternalBackdrop inert={!open()} cutout={triggerElement()} />
      </Show>
      {element}
    </>
  );
}

export interface PopoverPositionerState {
  /**
   * Whether the popover is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
  /**
   * Whether CSS transitions should be disabled.
   */
  instant: string | undefined;
}

export interface PopoverPositionerProps
  extends
    CreateAnchorPositioningSharedParameters,
    BaseUIComponentProps<'div', PopoverPositionerState> {}

export namespace PopoverPositioner {
  export type State = PopoverPositionerState;
  export type Props = PopoverPositionerProps;
}
