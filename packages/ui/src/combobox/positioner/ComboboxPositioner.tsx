import { Show, createEffect } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { ComboboxPositionerContext } from './ComboboxPositionerContext';
import { useListEmpty } from '../utils/parts';
import type {
  Side,
  Align,
  CreateAnchorPositioningSharedParameters,
} from '../../internals/anchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { useComboboxPortalContext } from '../portal/ComboboxPortalContext';
import { DROPDOWN_COLLISION_AVOIDANCE } from '../../internals/constants';
import { InternalBackdrop } from '../../utils/popups/InternalBackdrop';
import { createPopupPositioner } from '../../utils/popups/popupPositioner';
import { createAnchoredPopupScrollLock } from '../../utils/popups/anchoredPopupScrollLock';

/**
 * Positions the popup against the input or trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxPositioner(componentProps: ComboboxPositioner.Props): JSX.Element {
  const store = useComboboxRootContext();
  const keepMounted = useComboboxPortalContext();

  const empty = useListEmpty();

  const { element, positioning } = createPopupPositioner<ComboboxPositionerInternalState>(
    store,
    componentProps,
    {
      get keepMounted() {
        return keepMounted();
      },
      positioning: {
        get anchor() {
          return (
            componentProps.anchor ??
            (store.select('inputInsidePopup')
              ? store.select('triggerElement')
              : (store.select('inputGroupElement') ?? store.select('inputElement')))
          );
        },
        get collisionAvoidance() {
          return componentProps.collisionAvoidance ?? DROPDOWN_COLLISION_AVOIDANCE;
        },
        lazyFlip: true,
      },
      state: {
        get empty() {
          return empty();
        },
      },
      // The children are created inside the positioner element: provide the context there.
      renderChildren: (positioning) => (
        <ComboboxPositionerContext value={positioning}>
          {componentProps.children}
        </ComboboxPositionerContext>
      ),
    },
  );

  createAnchoredPopupScrollLock(
    () => store.select('open') && store.select('modal'),
    () => store.select('openMethod') === 'touch',
    () => store.select('positionerElement'),
    () => store.select('triggerElement'),
  );

  createEffect(
    () => positioning.side,
    (side) => {
      store.set('popupSide', side);
    },
  );

  return (
    <>
      <Show when={store.select('mounted') && store.select('modal')}>
        <InternalBackdrop
          inert={!store.select('open')}
          cutout={
            store.select('inputGroupElement') ??
            store.select('inputElement') ??
            store.select('triggerElement')
          }
        />
      </Show>
      {element}
    </>
  );
}

// The shared positioner state also carries `instant`, which a combobox never sets.
type ComboboxPositionerInternalState = ComboboxPositionerState & {
  instant: string | undefined;
};

export interface ComboboxPositionerState {
  /**
   * Whether the component is open.
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
   * Whether there are no items to display.
   */
  empty: boolean;
}

export interface ComboboxPositionerProps
  extends
    CreateAnchorPositioningSharedParameters,
    BaseUIComponentProps<'div', ComboboxPositionerState> {}

export namespace ComboboxPositioner {
  export type State = ComboboxPositionerState;
  export type Props = ComboboxPositionerProps;
}
