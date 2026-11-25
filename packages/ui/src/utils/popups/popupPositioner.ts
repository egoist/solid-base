import { merge, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createAnchorPositioning } from '../../internals/anchorPositioning';
import { POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import type {
  Align,
  CreateAnchorPositioningParameters,
  CreateAnchorPositioningReturnValue,
  CreateAnchorPositioningSharedParameters,
  Side,
} from '../../internals/anchorPositioning';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import type { TransitionStatus } from '../../internals/transitionStatus';
import type { AdaptiveOriginMiddleware } from './positioning/adaptiveOriginConstants';
import { renderPositioner } from './positioning/positioner';
import type { PositioningInteractionStore } from './types';

/**
 * The state every popup Positioner shares.
 */
export interface PopupPositionerState {
  open: boolean;
  side: Side;
  align: Align;
  anchorHidden: boolean;
  instant: string | undefined;
}

/**
 * What `createPopupPositioner` needs from a popup store (a `BasePopupStore` subclass whose state
 * includes `instantType` and `adaptiveOrigin`).
 */
export type PopupPositionerStore = PositioningInteractionStore & {
  select(key: 'mounted'): boolean;
  select(key: 'transitionStatus'): TransitionStatus;
  select(key: 'instantType'): string | undefined;
  select(key: 'adaptiveOrigin'): AdaptiveOriginMiddleware | undefined;
  set(key: 'positionerElement', value: HTMLElement | null): void;
  readonly state: { readonly positionerElement: HTMLElement | null };
};

type PositioningOverrides = Partial<
  Omit<
    CreateAnchorPositioningParameters,
    'interactionStore' | 'mounted' | 'keepMounted' | 'adaptiveOrigin'
  >
>;

export interface CreatePopupPositionerOptions<State extends PopupPositionerState> {
  /**
   * Whether the popup stays mounted while closed. Read lazily.
   */
  keepMounted: boolean;
  /**
   * Positioning parameters that replace the props, such as values derived from the popup's parent.
   * A key that is present replaces the prop, even when its value is `undefined`. Read lazily, so
   * pass getters for reactive values. `nodeId` and `externalTree` are read once.
   */
  positioning?: PositioningOverrides | undefined;
  /**
   * State that the part adds to or changes in the shared state: an object of getters. Read once.
   */
  state?: (Omit<State, keyof PopupPositionerState> & Partial<PopupPositionerState>) | undefined;
  /**
   * Whether the positioner ignores pointer events. Read lazily.
   * @default !open
   */
  inert?: boolean | undefined;
  /**
   * Renders the positioner's children, such as the component's children wrapped in contexts that
   * provide the positioning to the parts inside. Called when the children are created, which is
   * before `createPopupPositioner` returns: contexts rendered around the returned element don't
   * reach them. Read once.
   * @default the component's children
   */
  renderChildren?: ((positioning: CreateAnchorPositioningReturnValue) => JSX.Element) | undefined;
}

export interface CreatePopupPositionerReturnValue {
  element: JSX.Element;
  positioning: CreateAnchorPositioningReturnValue;
  readonly open: boolean;
  readonly mounted: boolean;
}

export type PopupPositionerProps<State> = BaseUIComponentProps<'div', State> &
  CreateAnchorPositioningSharedParameters;

const POSITIONING_PROP_KEYS = [
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
 * Runs what every popup Positioner does: it positions the popup against its anchor, registers the
 * positioner element, and renders it with the shared state.
 * The part adds what is specific to its popup, such as a backdrop or a scroll lock.
 *
 * The component props are read like Solid props (lazily); the user's `ref` flows through them.
 */
export function createPopupPositioner<State extends PopupPositionerState>(
  store: PopupPositionerStore,
  componentProps: PopupPositionerProps<State>,
  options: CreatePopupPositionerOptions<State>,
): CreatePopupPositionerReturnValue {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    ...POSITIONING_PROP_KEYS,
  ) as HTMLProps;

  const open = () => store.select('open');
  const mounted = () => store.select('mounted');

  function positioningValue<Key extends keyof PositioningOverrides>(
    key: Key,
    fallback: () => PositioningOverrides[Key],
  ): PositioningOverrides[Key] {
    const overrides = options.positioning;
    if (overrides && key in overrides) {
      return overrides[key];
    }
    return fallback();
  }

  const positioningParams: CreateAnchorPositioningParameters = {
    interactionStore: store,
    get anchor() {
      return positioningValue('anchor', () => componentProps.anchor);
    },
    get positionMethod() {
      return positioningValue('positionMethod', () => componentProps.positionMethod);
    },
    get mounted() {
      return mounted();
    },
    get side() {
      return positioningValue('side', () => componentProps.side);
    },
    get sideOffset() {
      return positioningValue('sideOffset', () => componentProps.sideOffset);
    },
    get align() {
      return positioningValue('align', () => componentProps.align);
    },
    get alignOffset() {
      return positioningValue('alignOffset', () => componentProps.alignOffset);
    },
    get arrowPadding() {
      return positioningValue('arrowPadding', () => componentProps.arrowPadding);
    },
    get collisionBoundary() {
      return positioningValue('collisionBoundary', () => componentProps.collisionBoundary);
    },
    get collisionPadding() {
      return positioningValue('collisionPadding', () => componentProps.collisionPadding);
    },
    get sticky() {
      return positioningValue('sticky', () => componentProps.sticky);
    },
    get disableAnchorTracking() {
      return positioningValue('disableAnchorTracking', () => componentProps.disableAnchorTracking);
    },
    get keepMounted() {
      return options.keepMounted;
    },
    get collisionAvoidance() {
      return (
        positioningValue(
          'collisionAvoidance',
          () => componentProps.collisionAvoidance ?? POPUP_COLLISION_AVOIDANCE,
        ) ?? POPUP_COLLISION_AVOIDANCE
      );
    },
    get adaptiveOrigin() {
      return store.select('adaptiveOrigin');
    },
    get shift() {
      return options.positioning?.shift;
    },
    get lazyFlip() {
      return options.positioning?.lazyFlip;
    },
    get inline() {
      return options.positioning?.inline;
    },
    // Read once by `createAnchorPositioning`.
    get nodeId() {
      return options.positioning?.nodeId;
    },
    get externalTree() {
      return options.positioning?.externalTree;
    },
  };

  const positioning = createAnchorPositioning(positioningParams);

  const state = {
    get open() {
      return open();
    },
    get side() {
      return positioning.side;
    },
    get align() {
      return positioning.align;
    },
    get anchorHidden() {
      return positioning.anchorHidden;
    },
    get instant() {
      return store.select('instantType');
    },
  } as State;

  // The part's state is an object of getters: copy them so they stay live.
  const partState = untrack(() => options.state);
  if (partState) {
    Object.defineProperties(state, Object.getOwnPropertyDescriptors(partState));
  }

  let positionerElement: HTMLElement | null = null;

  onCleanup(() => {
    if (positionerElement && store.state.positionerElement === positionerElement) {
      store.set('positionerElement', null);
    }
  });

  const renderChildren = options.renderChildren;

  const element = renderPositioner(componentProps, state, {
    get styles() {
      return positioning.positionerStyles;
    },
    get transitionStatus() {
      return store.select('transitionStatus');
    },
    props: renderChildren
      ? (merge(elementProps, {
          get children() {
            return renderChildren(positioning);
          },
        }) as HTMLProps)
      : elementProps,
    ref: (element: HTMLDivElement) => {
      positionerElement = element;
      store.set('positionerElement', element);
    },
    get hidden() {
      return !mounted();
    },
    get inert() {
      return options.inert ?? !open();
    },
  });

  return {
    element,
    positioning,
    get open() {
      return open();
    },
    get mounted() {
      return mounted();
    },
  };
}
