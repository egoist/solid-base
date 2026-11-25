import type { JSX } from '@solidjs/web';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import { TooltipPositionerContext } from './TooltipPositionerContext';
import type {
  Side,
  Align,
  CreateAnchorPositioningSharedParameters,
} from '../../internals/anchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { useTooltipPortalContext } from '../portal/TooltipPortalContext';
import { createPopupPositioner } from '../../utils/popups/popupPositioner';

/**
 * Positions the tooltip against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export function TooltipPositioner(componentProps: TooltipPositioner.Props): JSX.Element {
  const store = useTooltipRootContext();
  const keepMounted = useTooltipPortalContext();

  const trackCursorAxis = () => store.select('trackCursorAxis');

  const { element } = createPopupPositioner<TooltipPositioner.State>(store, componentProps, {
    get keepMounted() {
      return keepMounted();
    },
    positioning: {
      get side() {
        return componentProps.side ?? 'top';
      },
    },
    state: {
      get instant() {
        return trackCursorAxis() !== 'none' ? 'tracking-cursor' : store.select('instantType');
      },
    },
    get inert() {
      return (
        !store.select('open') || trackCursorAxis() === 'both' || store.select('disableHoverablePopup')
      );
    },
    // The children are created inside the positioner element: provide the context there.
    renderChildren: (positioning) => (
      <TooltipPositionerContext value={positioning}>{componentProps.children}</TooltipPositionerContext>
    ),
  });

  return element;
}

export interface TooltipPositionerState {
  /**
   * Whether the tooltip is currently open.
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

export interface TooltipPositionerProps
  extends
    BaseUIComponentProps<'div', TooltipPositionerState>,
    Omit<CreateAnchorPositioningSharedParameters, 'side'> {
  /**
   * Which side of the anchor element to align the popup against.
   * May automatically change to avoid collisions.
   * @default 'top'
   */
  side?: Side | undefined;
}

export namespace TooltipPositioner {
  export type State = TooltipPositionerState;
  export type Props = TooltipPositionerProps;
}
