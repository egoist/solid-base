import { Show, createEffect, createSignal, merge, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createRefObject } from '@egoist/solid-base-utils/refObject';
import { useSelectRootContext } from '../root/SelectRootContext';
import {
  CompositeList,
  createCompositeList,
  type CompositeMetadata,
} from '../../internals/composite/list/CompositeList';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import {
  createAnchorPositioning,
  type Align,
  type CreateAnchorPositioningSharedParameters,
  type Side,
} from '../../internals/anchorPositioning';
import { SelectPositionerContext } from './SelectPositionerContext';
import { InternalBackdrop } from '../../utils/popups/InternalBackdrop';
import { DROPDOWN_COLLISION_AVOIDANCE } from '../../internals/constants';
import { clearStyles } from '../popup/utils';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { findItemIndex } from '../../internals/itemEquality';
import { renderPositioner } from '../../utils/popups/positioning/positioner';
import { createAnchoredPopupScrollLock } from '../../utils/popups/anchoredPopupScrollLock';

const FIXED: JSX.CSSProperties = { position: 'fixed' };

/**
 * Positions the select popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectPositioner(componentProps: SelectPositioner.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'children',
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
    'alignItemWithTrigger',
    'collisionAvoidance',
  );

  const store = useSelectRootContext();

  const open = () => store.select('open');
  const mounted = () => store.select('mounted');
  const modal = () => store.select('modal');
  const openMethod = () => store.select('openMethod');
  const triggerElement = () => store.select('triggerElement');

  const scrollUpArrowRef = createRefObject<HTMLDivElement | null>(null);
  const scrollDownArrowRef = createRefObject<HTMLDivElement | null>(null);

  const alignItemWithTrigger = () => componentProps.alignItemWithTrigger ?? true;

  const [controlledAlignItemWithTrigger, setControlledAlignItemWithTrigger] = createSignal(
    untrack(alignItemWithTrigger),
  );

  // The prop applies again once the popup has unmounted.
  createEffect(
    () => [mounted(), alignItemWithTrigger()] as const,
    ([isMounted, value]) => {
      if (!isMounted) {
        setControlledAlignItemWithTrigger(value);
      }
    },
  );

  const alignItemWithTriggerActive = () =>
    mounted() && controlledAlignItemWithTrigger() && openMethod() !== 'touch';

  createEffect(alignItemWithTriggerActive, (active) => {
    store.context.alignItemWithTriggerActiveRef.current = active;
  });

  createAnchoredPopupScrollLock(
    () => (alignItemWithTriggerActive() || modal()) && open(),
    () => openMethod() === 'touch',
    () => store.select('positionerElement'),
    triggerElement,
  );

  const positioning = createAnchorPositioning({
    interactionStore: store,
    get anchor() {
      return componentProps.anchor;
    },
    get positionMethod() {
      return componentProps.positionMethod;
    },
    get mounted() {
      return mounted();
    },
    get side() {
      return componentProps.side;
    },
    get sideOffset() {
      return componentProps.sideOffset;
    },
    get align() {
      return componentProps.align;
    },
    get alignOffset() {
      return componentProps.alignOffset;
    },
    get arrowPadding() {
      return componentProps.arrowPadding;
    },
    get collisionBoundary() {
      return componentProps.collisionBoundary;
    },
    get collisionPadding() {
      return componentProps.collisionPadding;
    },
    get sticky() {
      return componentProps.sticky;
    },
    get disableAnchorTracking() {
      return componentProps.disableAnchorTracking ?? alignItemWithTriggerActive();
    },
    get collisionAvoidance() {
      return componentProps.collisionAvoidance ?? DROPDOWN_COLLISION_AVOIDANCE;
    },
    keepMounted: true,
  });

  const renderedSide = (): Side | 'none' =>
    alignItemWithTriggerActive() ? 'none' : positioning.side;

  const state: SelectPositionerState = {
    get open() {
      return open();
    },
    get side() {
      return renderedSide();
    },
    get align() {
      return positioning.align;
    },
    get anchorHidden() {
      return positioning.anchorHidden;
    },
  };

  createEffect(
    () => positioning.side,
    (side) => {
      store.set('popupSide', side);
    },
  );

  let prevMapSize = 0;

  // The items write their values (`valuesRef`) in their own effects, which run after the list's
  // map change is reported (upstream's item layout effects run first). Wait for them.
  function onMapChange(map: Map<HTMLElement, CompositeMetadata<unknown>>) {
    const size = map.size;
    queueMicrotask(() => handleMapChange(size));
  }

  function handleMapChange(mapSize: number) {
    if (store.context.valuesRef.current.length === 0) {
      return;
    }

    const prevSize = prevMapSize;
    prevMapSize = mapSize;

    const value = store.state.selectedValue;
    const multiple = store.state.selectionMode === 'multiple';
    const { isItemEqualToValue } = store.context;
    const eventDetails = createChangeEventDetails(REASONS.none);

    if (prevSize !== 0 && !multiple && value != null) {
      const selectedValueIndex = findItemIndex(
        store.context.valuesRef.current,
        value,
        isItemEqualToValue,
      );
      if (selectedValueIndex === -1) {
        const initialSelectedValue = store.context.initialValueRef.current;
        const hasInitial =
          initialSelectedValue != null &&
          findItemIndex(store.context.valuesRef.current, initialSelectedValue, isItemEqualToValue) !==
            -1;
        const nextValue = hasInitial ? initialSelectedValue : null;
        store.context.setValue(nextValue, eventDetails);

        if (nextValue === null) {
          store.set('selectedIndex', null);
          store.context.selectedItemTextRef.current = null;
        }
      }
    }

    if (prevSize !== 0 && multiple && Array.isArray(value)) {
      const nextValue = value.filter(
        (selectedItemValue) =>
          findItemIndex(store.context.valuesRef.current, selectedItemValue, isItemEqualToValue) !==
          -1,
      );
      if (nextValue.length !== value.length) {
        store.context.setValue(nextValue, eventDetails);

        if (nextValue.length === 0) {
          store.set('selectedIndex', null);
          store.context.selectedItemTextRef.current = null;
        }
      }
    }

    if (store.state.open && store.context.alignItemWithTriggerActiveRef.current) {
      store.update({
        scrollUpArrowVisible: false,
        scrollDownArrowVisible: false,
      });

      const stylesToClear = { height: '' };
      clearStyles(store.state.positionerElement, stylesToClear);
      clearStyles(store.state.popupElement, stylesToClear);
    }
  }

  const list = createCompositeList({
    elementsRef: store.context.listRef,
    labelsRef: store.context.labelsRef,
    onMapChange,
  });

  const contextValue: SelectPositionerContext = {
    get side() {
      return renderedSide();
    },
    get align() {
      return positioning.align;
    },
    get arrowStyles() {
      return positioning.arrowStyles;
    },
    arrowRef: positioning.arrowRef,
    get arrowUncentered() {
      return positioning.arrowUncentered;
    },
    get isPositioned() {
      return positioning.isPositioned;
    },
    get alignItemWithTriggerActive() {
      return alignItemWithTriggerActive();
    },
    setControlledAlignItemWithTrigger,
    scrollUpArrowRef,
    scrollDownArrowRef,
  };

  let positionerElement: HTMLElement | null = null;
  onCleanup(() => {
    if (positionerElement && store.state.positionerElement === positionerElement) {
      store.set('positionerElement', null);
    }
  });

  // The children are created inside the positioner element: provide the contexts there.
  const childrenProps: HTMLProps = {
    get children() {
      return (
        <CompositeList list={list}>
          <SelectPositionerContext value={contextValue}>
            {componentProps.children}
          </SelectPositionerContext>
        </CompositeList>
      );
    },
  };

  const element = renderPositioner(componentProps, state, {
    get styles() {
      return alignItemWithTriggerActive() ? FIXED : positioning.positionerStyles;
    },
    get transitionStatus() {
      return store.select('transitionStatus');
    },
    props: merge(elementProps, childrenProps) as HTMLProps,
    ref: (el: HTMLDivElement) => {
      positionerElement = el;
      store.set('positionerElement', el);
    },
    get hidden() {
      return !mounted();
    },
    get inert() {
      return !open();
    },
  });

  return (
    <>
      <Show when={mounted() && modal()}>
        <InternalBackdrop inert={!open()} cutout={triggerElement()} />
      </Show>
      {element}
    </>
  );
}

export interface SelectPositionerState {
  /**
   * Whether the component is open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | 'none';
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
}

export interface SelectPositionerProps
  extends CreateAnchorPositioningSharedParameters,
    BaseUIComponentProps<'div', SelectPositionerState> {
  /**
   * Whether the positioner overlaps the trigger so the selected item's text is aligned with the trigger's value text. This only applies to mouse input and is automatically disabled if there is not enough space.
   * @default true
   */
  alignItemWithTrigger?: boolean | undefined;
}

export namespace SelectPositioner {
  export type State = SelectPositionerState;
  export type Props = SelectPositionerProps;
}
