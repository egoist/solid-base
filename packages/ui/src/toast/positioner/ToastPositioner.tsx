import { createSignal, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isElement } from '@floating-ui/utils/dom';
import { createAnchorPositioning } from '../../internals/anchorPositioning';
import type {
  Align,
  CreateAnchorPositioningSharedParameters,
  Side,
} from '../../internals/anchorPositioning';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import { ToastPositionerContext } from './ToastPositionerContext';
import { createFloatingRootStore } from '../../utils/popups/floating-root/createFloatingRootStore';
import { renderPositioner } from '../../utils/popups/positioning/positioner';
import type { ToastObject, ToastManagerPositionerProps } from '../useToastManager';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import * as ToastRootCssVars from '../root/ToastRootCssVars';

const POSITIONING_PROP_KEYS = [
  'toast',
  'anchor',
  'positionMethod',
  'side',
  'align',
  'sideOffset',
  'alignOffset',
  'collisionBoundary',
  'collisionPadding',
  'arrowPadding',
  'sticky',
  'disableAnchorTracking',
  'collisionAvoidance',
] as const;

/**
 * Positions the toast against the anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastPositioner(componentProps: ToastPositioner.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    ...POSITIONING_PROP_KEYS,
  ) as HTMLProps;

  const store = useToastProviderContext();

  const toast = () => componentProps.toast;
  const positionerProps = (): ToastManagerPositionerProps => toast().positionerProps ?? {};

  // Each positioning prop falls back to the toast's `positionerProps`.
  function positioningValue<Key extends keyof ToastManagerPositionerProps>(
    key: Key,
  ): ToastManagerPositionerProps[Key] {
    const value = (componentProps as ToastManagerPositionerProps)[key];
    return value === undefined ? positionerProps()[key] : value;
  }

  const [positionerElement, setPositionerElement] = createSignal<HTMLDivElement | null>(null);

  const domIndex = () => store.select('toastIndex', toast().id);
  const visibleIndex = () => store.select('toastVisibleIndex', toast().id);

  const anchor = () => {
    const anchorProp = positioningValue('anchor');
    return isElement(anchorProp) ? (anchorProp as Element) : null;
  };

  const floatingRootStore = createFloatingRootStore({
    open: () => true,
    anchor,
    positionerElement,
  });

  const positioning = createAnchorPositioning({
    interactionStore: floatingRootStore,
    mounted: true,
    keepMounted: true,
    get anchor() {
      return anchor();
    },
    get positionMethod() {
      return positioningValue('positionMethod');
    },
    get side() {
      return positioningValue('side') ?? 'top';
    },
    get align() {
      return positioningValue('align') ?? 'center';
    },
    get sideOffset() {
      return positioningValue('sideOffset');
    },
    get alignOffset() {
      return positioningValue('alignOffset');
    },
    get collisionBoundary() {
      return positioningValue('collisionBoundary');
    },
    get collisionPadding() {
      return positioningValue('collisionPadding');
    },
    get sticky() {
      return positioningValue('sticky');
    },
    get arrowPadding() {
      return positioningValue('arrowPadding');
    },
    get disableAnchorTracking() {
      return positioningValue('disableAnchorTracking');
    },
    get collisionAvoidance() {
      return positioningValue('collisionAvoidance') ?? POPUP_COLLISION_AVOIDANCE;
    },
  });

  const state: ToastPositioner.State = {
    get side() {
      return positioning.side;
    },
    get align() {
      return positioning.align;
    },
    get anchorHidden() {
      return positioning.anchorHidden;
    },
  };

  const positionerOptions = {
    get styles() {
      return {
        ...positioning.positionerStyles,
        [ToastRootCssVars.index]: String(
          toast().transitionStatus === 'ending' ? domIndex() : visibleIndex(),
        ),
      };
    },
    get transitionStatus() {
      return toast().transitionStatus;
    },
    props: elementProps,
    ref: setPositionerElement,
  };

  // Rendered inside the context so the children (created by the element) can read it.
  return (
    <ToastPositionerContext value={positioning}>
      {renderPositioner(componentProps, state, positionerOptions)}
    </ToastPositionerContext>
  );
}

export interface ToastPositionerState {
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
}

export interface ToastPositionerProps
  extends
    BaseUIComponentProps<'div', ToastPositionerState>,
    Omit<CreateAnchorPositioningSharedParameters, 'side' | 'anchor'> {
  /**
   * An element to position the toast against.
   */
  anchor?: Element | null | undefined;
  /**
   * Which side of the anchor element to align the toast against.
   * May automatically change to avoid collisions.
   * @default 'top'
   */
  side?: Side | undefined;
  /**
   * The toast object associated with the positioner.
   */
  toast: ToastObject<any>;
}

export namespace ToastPositioner {
  export type State = ToastPositionerState;
  export type Props = ToastPositionerProps;
}
