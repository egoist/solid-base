import { createSignal, omit, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isHTMLElement } from '@floating-ui/utils/dom';
import {
  FloatingFocusManager,
  type FocusTargetProp,
} from '../../utils/popups/focus/FloatingFocusManager';
import { createHoverPopupInteraction } from '../../utils/popups/interactions/hoverPopupInteraction';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { usePopoverPositionerContext } from '../positioner/PopoverPositionerContext';
import type { Side, Align } from '../../internals/anchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';
import { renderElement } from '../../internals/renderElement';
import { REASONS } from '../../internals/reasons';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { useToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import { ClosePartContext, createClosePartCount } from '../utils/closePart';
import {
  FOCUSABLE_POPUP_PROPS,
  createDefaultInitialFocus,
  createDynamicPropsSource,
} from '../../utils/popups/popupStoreUtils';
import type { PopoverInstantType } from '../store/PopoverStore';
import type { PopupInteractionStore } from '../../utils/popups/types';

/**
 * A container for the popover contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Popover](https://base.egoist.dev/components/popover)
 */
export function PopoverPopup(componentProps: PopoverPopup.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'initialFocus',
    'finalFocus',
    'id',
    'children',
  );

  const store = usePopoverRootContext();
  const positioner = usePopoverPositionerContext();
  const insideToolbar = useToolbarRootContext(true) != null;
  const { context: closePartContext, hasClosePart } = createClosePartCount();

  const open = () => store.select('open');
  const mounted = () => store.select('mounted');
  const transitionStatus = () => store.select('transitionStatus');

  createOpenChangeComplete({
    open,
    element: () => store.select('popupElement'),
    onComplete() {
      if (store.state.openProp ?? store.state.open) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  createHoverPopupInteraction(store, {
    get enabled() {
      return store.select('openOnHover') && !store.select('disabled');
    },
    closeDelay: () => store.select('closeDelay'),
  });

  const defaultInitialFocus = createDefaultInitialFocus(() => store.state.popupElement);

  const focusManagerModal = () => store.select('modal') !== false && hasClosePart();
  store.syncValue('focusManagerModal', focusManagerModal);

  const rootPopupProps = createDynamicPropsSource(() => store.select('popupProps'));

  const state: PopoverPopup.State = {
    get open() {
      return open();
    },
    get side() {
      return positioner.side;
    },
    get align() {
      return positioner.align;
    },
    get instant() {
      return store.select('instantType');
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  const element = renderElement('div', componentProps, {
    state,
    ref: (el: HTMLElement) => store.set('popupElement', el),
    props: [
      rootPopupProps,
      {
        get id() {
          return componentProps.id ?? store.select('defaultPopupId');
        },
        role: 'dialog',
        ...FOCUSABLE_POPUP_PROPS,
        get 'aria-labelledby'() {
          return store.select('titleElementId');
        },
        get 'aria-describedby'() {
          return store.select('descriptionElementId');
        },
        onKeyDown(event: KeyboardEvent) {
          if (insideToolbar && COMPOSITE_KEYS.has(event.key)) {
            event.stopPropagation();
          }
        },
      },
      {
        get style() {
          return getDisabledMountTransitionStyles(transitionStatus()).style;
        },
      },
      elementProps,
      {
        // The children are created inside the popup element, after it: wrap them in the context
        // that counts the `Close` parts there.
        get children() {
          return (
            <ClosePartContext value={closePartContext}>{componentProps.children}</ClosePartContext>
          );
        },
      },
    ],
    stateAttributesMapping: popupTransitionStateMapping,
  });

  // The positioner registers its element before the popup is attached inside it, so the focus
  // manager would resolve the positioner (and its focus guards) as the element to focus. Hide the
  // positioner from it until the popup has been attached.
  const [popupAttached, setPopupAttached] = createSignal(false, { ownedWrite: true });
  onSettled(() => {
    setPopupAttached(true);
  });
  const focusManagerStore: PopupInteractionStore = {
    select: ((key: string, ...args: unknown[]) =>
      key === 'positionerElement' && !popupAttached()
        ? null
        : (store.select as (...a: unknown[]) => unknown)(key, ...args)) as PopupInteractionStore['select'],
    set: ((key: 'anchorOverride', value: null) => store.set(key, value)) as PopupInteractionStore['set'],
    setOpen: (open, eventDetails) => store.setOpen(open, eventDetails as never),
    get context() {
      return store.context;
    },
  };

  return (
    <FloatingFocusManager
      store={focusManagerStore}
      openInteractionType={store.select('openMethod')}
      modal={focusManagerModal()}
      disabled={!mounted() || store.select('openChangeReason') === REASONS.triggerHover}
      initialFocus={
        componentProps.initialFocus === undefined ? defaultInitialFocus : componentProps.initialFocus
      }
      returnFocus={componentProps.finalFocus}
      restoreFocus="popup"
      getInsideElements={() => [store.context.beforeTriggerFocusGuardRef.current]}
      previousFocusableElement={(() => {
        const trigger = store.select('activeTriggerElement');
        return isHTMLElement(trigger) ? trigger : undefined;
      })()}
      nextFocusableElement={store.context.triggerFocusTargetRef}
      beforeContentFocusGuardRef={(el: HTMLSpanElement) => {
        store.context.beforeContentFocusGuardRef.current = el;
      }}
    >
      {element}
    </FloatingFocusManager>
  );
}

export interface PopoverPopupState {
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
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether transitions should be skipped.
   */
  instant: PopoverInstantType;
}

export interface PopoverPopupProps extends BaseUIComponentProps<'div', PopoverPopupState> {
  /**
   * Determines the element to focus when the popover is opened.
   * By default, focus moves to the first tabbable element inside the popup, except when the popover
   * is opened by touch — then the popup itself is focused to avoid opening the virtual keyboard.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - An element or a ref object (`{ current }`): Move focus to that element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?: FocusTargetProp;
  /**
   * Determines the element to focus when the popover is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - An element or a ref object (`{ current }`): Move focus to that element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?: FocusTargetProp;
}

export namespace PopoverPopup {
  export type State = PopoverPopupState;
  export type Props = PopoverPopupProps;
}
