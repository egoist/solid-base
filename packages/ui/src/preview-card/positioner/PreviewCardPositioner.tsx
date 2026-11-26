import { createEffect } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import { PreviewCardPositionerContext } from './PreviewCardPositionerContext';
import { FloatingNode, createFloatingNodeId } from '../../utils/popups/tree/FloatingTree';
import type {
  Side,
  Align,
  CreateAnchorPositioningSharedParameters,
} from '../../internals/anchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { usePreviewCardPortalContext } from '../portal/PreviewCardPortalContext';
import { createPopupPositioner } from '../../utils/popups/popupPositioner';
import { createInlineMiddleware } from '../../utils/popups/inlineRect';
import type { PreviewCardInstantType } from '../store/PreviewCardStore';

/**
 * Positions the popup against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Preview Card](https://base.egoist.dev/components/preview-card)
 */
export function PreviewCardPositioner(componentProps: PreviewCardPositioner.Props): JSX.Element {
  const store = usePreviewCardRootContext();
  const keepMounted = usePreviewCardPortalContext();
  const nodeId = createFloatingNodeId();

  const { element, positioning } = createPopupPositioner(store, componentProps, {
    get keepMounted() {
      return keepMounted();
    },
    positioning: {
      nodeId,
      inline: createInlineMiddleware(store.context.inlineRectCoordsRef),
    },
    // The children are created inside the positioner element: provide the contexts there.
    renderChildren: (value) => (
      <PreviewCardPositionerContext value={value}>
        <FloatingNode id={nodeId}>{componentProps.children}</FloatingNode>
      </PreviewCardPositionerContext>
    ),
  });

  createEffect(
    () => store.select('open') && store.select('mounted'),
    (shouldUpdate) => {
      if (shouldUpdate) {
        positioning.update();
      }
    },
  );

  return element;
}

export interface PreviewCardPositionerState {
  /**
   * Whether the preview card is currently open.
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
   * Whether transitions should be skipped.
   */
  instant: PreviewCardInstantType;
}

export interface PreviewCardPositionerProps
  extends
    CreateAnchorPositioningSharedParameters,
    BaseUIComponentProps<'div', PreviewCardPositionerState> {}

export namespace PreviewCardPositioner {
  export type State = PreviewCardPositionerState;
  export type Props = PreviewCardPositionerProps;
}
