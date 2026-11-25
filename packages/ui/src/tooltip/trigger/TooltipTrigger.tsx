import { createEffect, createMemo, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isElement } from '@floating-ui/utils/dom';
import { createTimeout } from '@egoist/solid-base-utils/timeout';
import { closest, contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { renderElement } from '../../internals/renderElement';
import {
  createDynamicPropsSource,
  createStoreProxy,
  createTriggerDataForwarding,
  registerTriggerState,
} from '../../utils/popups/popupStoreUtils';
import { createBaseUiId } from '../../internals/baseUiId';
import type { TooltipHandle } from '../store/TooltipHandle';
import type { TooltipHandleStore, TooltipStore } from '../store/TooltipStore';
import { useTooltipProviderContext } from '../provider/TooltipProviderContext';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { createDelayGroup } from '../../utils/popups/delay-group/FloatingDelayGroup';
import { createFocus } from '../../utils/popups/interactions/focus';
import { createHoverTriggerInteraction } from '../../utils/popups/interactions/hoverTriggerInteraction';
import { isMouseLikePointerType } from '../../utils/popups/event';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { getHoverIntent } from '../../utils/popups/interactions/hoverIntent';
import { getDelay } from '../../utils/popups/interactions/hoverShared';
import type { PopupInteractionStore } from '../../utils/popups/types';
import * as TooltipTriggerDataAttributes from './TooltipTriggerDataAttributes';
import { OPEN_DELAY } from '../utils/constants';

const TOOLTIP_TRIGGER_IDENTIFIER = 'data-base-ui-tooltip-trigger';

function getTargetElement(event: Event): Element | null {
  const target = getTarget(event);
  return isElement(target) ? target : null;
}

/**
 * An element to attach the tooltip to.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export function TooltipTrigger<Payload = unknown>(
  componentProps: TooltipTrigger.Props<Payload>,
): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'handle',
    'payload',
    'disabled',
    'delay',
    'closeOnClick',
    'closeDelay',
    'id',
  );

  const closeOnClick = () => componentProps.closeOnClick ?? true;
  const closeDelayWithDefault = () => componentProps.closeDelay ?? 0;

  const rootStore = useTooltipRootContext(true);

  const store = (): TooltipHandleStore<Payload> => {
    const handle = componentProps.handle;
    if (handle) {
      return handle.store;
    }
    if (!rootStore) {
      throw new Error(
        'Base UI: <Tooltip.Trigger> must be either used within a <Tooltip.Root> component or provided with a handle.',
      );
    }
    return rootStore as unknown as TooltipHandleStore<Payload>;
  };
  // Throw eagerly when the trigger has neither a root nor a handle.
  untrack(store);

  const select = (key: string, ...args: any[]) =>
    (store() as unknown as TooltipStore<Payload>).select(key as any, ...(args as [any]));

  const thisTriggerId = createBaseUiId(() => componentProps.id);
  const isTriggerActive = () => select('isTriggerActive', thisTriggerId()) as boolean;
  const isOpenedByThisTrigger = () => select('isOpenedByTrigger', thisTriggerId()) as boolean;

  const { registerTrigger, isMountedByThisTrigger, triggerElement } = createTriggerDataForwarding(
    thisTriggerId,
    store,
  );
  // What the tooltip reads from this trigger while it is the active one (see `TooltipRoot`).
  const triggerState = {
    get payload() {
      return componentProps.payload;
    },
    get closeOnClick() {
      return closeOnClick();
    },
    get closeDelay() {
      return closeDelayWithDefault();
    },
  };

  const interactionStore = createStoreProxy(store as unknown as () => PopupInteractionStore);

  const providerContext = useTooltipProviderContext();
  const providerDelay = () => providerContext?.delay;

  const { activeIdRef, delayRef, isInstantPhase, hasProvider } = createDelayGroup(
    Object.assign(Object.create(interactionStore) as PopupInteractionStore, {
      closeForSibling: () => untrack(store).closeForSibling(),
    }),
    {
      get open() {
        return isOpenedByThisTrigger();
      },
    },
  );

  createEffect(
    () => [store(), isInstantPhase()] as const,
    ([currentStore, value]) => {
      currentStore.set('isInstantPhase', value);
    },
  );

  const disabled = () => (componentProps.disabled ?? false) || (select('disabled') as boolean);

  let isNestedTriggerHovered = false;
  const nestedTriggerOpenTimeout = createTimeout();
  // Local copy so it can be cleared on mouseLeave without resetting the hover hook's own
  // pointerType.
  let pointerType: string | undefined;

  function getOpenDelay() {
    // Adjacent tooltips open instantly while the group is active.
    if (hasProvider && activeIdRef.current != null) {
      return 0;
    }
    return untrack(() => componentProps.delay ?? providerDelay() ?? OPEN_DELAY);
  }

  function isEnabledNestedTriggerTarget(target: Element | null) {
    const triggerEl = untrack(triggerElement);
    if (!triggerEl || !target) {
      return false;
    }

    const nearestTrigger = closest(target, `[${TOOLTIP_TRIGGER_IDENTIFIER}]`);
    return (
      nearestTrigger !== null && nearestTrigger !== triggerEl && contains(triggerEl, nearestTrigger)
    );
  }

  function detectNestedTriggerHover(target: Element | null) {
    const nestedTriggerHovered = isEnabledNestedTriggerTarget(target);

    isNestedTriggerHovered = nestedTriggerHovered;
    if (nestedTriggerHovered) {
      getHoverIntent(interactionStore).cancelPendingOpen();
      nestedTriggerOpenTimeout.clear();
    }
    return nestedTriggerHovered;
  }

  // The hover and focus interactions keep the store's event emitter and hover intent, which belong
  // to the store they were created with. A handle-backed trigger switches stores as its Root
  // attaches or detaches, so they are created again for every store.
  const storeInteractions = createMemo(() => {
    const currentStore = store() as unknown as PopupInteractionStore;
    return untrack(() => {
      const hoverProps = createHoverTriggerInteraction(currentStore, {
        get enabled() {
          return !disabled();
        },
        mouseOnly: true,
        move: false,
        get handleClose() {
          return !select('disableHoverablePopup') && select('trackCursorAxis') !== 'both'
            ? safePolygon()
            : null;
        },
        restMs: getOpenDelay,
        delay() {
          const closeDelay = untrack(() => componentProps.closeDelay);
          if (closeDelay == null && hasProvider) {
            return { close: getDelay(delayRef.current, 'close') };
          }
          return { close: closeDelay ?? 0 };
        },
        get triggerElement() {
          return triggerElement();
        },
        get isActiveTrigger() {
          return isTriggerActive();
        },
        shouldOpen() {
          return !isNestedTriggerHovered;
        },
      });

      const focusProps = createFocus(currentStore, {
        get enabled() {
          return !disabled();
        },
      }).reference;
      return { hoverProps, focusProps };
    });
  });
  const hoverProps = createDynamicPropsSource(() => storeInteractions().hoverProps);
  const focusProps = createDynamicPropsSource(() => storeInteractions().focusProps);

  function handleNestedTriggerHover(event: MouseEvent) {
    const currentStore = untrack(store);
    const wasNestedTriggerHovered = isNestedTriggerHovered;
    const target = getTargetElement(event);
    const nestedTriggerHovered = detectNestedTriggerHover(target);
    const triggerEl = untrack(triggerElement) as HTMLElement | null;
    const targetInsideTrigger = triggerEl && target && contains(triggerEl, target);

    // Only close hover-opened parents. Focus/click-like opens remain owned by
    // their original interaction and should not be clobbered by nested hover.
    if (
      nestedTriggerHovered &&
      currentStore.select('open') &&
      currentStore.select('lastOpenChangeReason') === REASONS.triggerHover
    ) {
      currentStore.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
      return;
    }

    if (
      wasNestedTriggerHovered &&
      !nestedTriggerHovered &&
      targetInsideTrigger &&
      !untrack(disabled) &&
      !currentStore.select('open') &&
      triggerEl &&
      // Match the hover hook's non-strict mouse fallback for mouse-only event sequences.
      isMouseLikePointerType(pointerType)
    ) {
      const open = () => {
        const latestStore = untrack(store);
        if (!isNestedTriggerHovered && !untrack(disabled) && !latestStore.select('open')) {
          latestStore.setOpen(
            true,
            createChangeEventDetails(REASONS.triggerHover, event, triggerEl),
          );
        }
      };

      const openDelay = getOpenDelay();

      // With `move: false`, the hover interaction only listens to mouseenter/mouseleave on the
      // parent trigger. Leaving a nested child for the parent area fires no event it can react
      // to, so reopen locally.
      if (openDelay === 0) {
        nestedTriggerOpenTimeout.clear();
        open();
      } else {
        nestedTriggerOpenTimeout.start(openDelay, open);
      }
    }
  }

  const rootTriggerProps = createDynamicPropsSource(
    () =>
      select(
        'appliedTriggerProps',
        isMountedByThisTrigger() || select('trackCursorAxis') !== 'none',
      ) as HTMLProps | undefined,
  );

  const state: TooltipTrigger.State = {
    get open() {
      return isOpenedByThisTrigger();
    },
  };

  return renderElement('button', componentProps, {
    state,
    ref: [(element: HTMLElement) => registerTriggerState(element, triggerState), registerTrigger],
    props: [
      hoverProps,
      focusProps,
      rootTriggerProps,
      {
        onMouseOver(event: MouseEvent) {
          handleNestedTriggerHover(event);
        },
        onMouseLeave() {
          isNestedTriggerHovered = false;
          nestedTriggerOpenTimeout.clear();
          pointerType = undefined;
        },
        onPointerEnter(event: PointerEvent) {
          pointerType = event.pointerType;
        },
        onPointerDown(event: PointerEvent) {
          pointerType = event.pointerType;
          const currentStore = untrack(store);
          const shouldCloseOnClick = untrack(closeOnClick);
          currentStore.set('closeOnClick', shouldCloseOnClick);
          if (shouldCloseOnClick && !currentStore.select('open')) {
            currentStore.cancelPendingOpen(event);
          }
        },
        onClick(event: MouseEvent) {
          const currentStore = untrack(store);
          if (untrack(closeOnClick) && !currentStore.select('open')) {
            currentStore.cancelPendingOpen(event);
          }
        },
        get id() {
          return thisTriggerId();
        },
        get [TooltipTriggerDataAttributes.triggerDisabled]() {
          return disabled() ? '' : undefined;
        },
        get [TOOLTIP_TRIGGER_IDENTIFIER]() {
          return disabled() ? undefined : '';
        },
      },
      elementProps,
    ],
    stateAttributesMapping: triggerOpenStateMapping,
  });
}

export interface TooltipTriggerState {
  /**
   * Whether the tooltip is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface TooltipTriggerProps<Payload = unknown>
  extends Omit<BaseUIComponentProps<'button', TooltipTriggerState>, 'disabled' | 'id'> {
  /**
   * A handle to associate the trigger with a tooltip.
   */
  handle?: TooltipHandle<Payload> | undefined;
  /**
   * A payload to pass to the tooltip when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * How long to wait before opening the tooltip on hover. Specified in milliseconds.
   * @default 600
   */
  delay?: number | undefined;
  /**
   * Whether the tooltip should close when this trigger is clicked.
   * @default true
   */
  closeOnClick?: boolean | undefined;
  /**
   * How long to wait before closing the tooltip. Specified in milliseconds.
   * @default 0
   */
  closeDelay?: number | undefined;
  /**
   * If `true`, the tooltip will not open when interacting with this trigger.
   * Note that this doesn't apply the `disabled` attribute to the trigger element.
   * If you want to disable the trigger element itself, you can pass the `disabled` prop to the trigger element via the `render` prop.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * ID of the trigger. In addition to being forwarded to the rendered element, it is also used to
   * specify the active trigger for the tooltip in controlled mode (with the TooltipRoot `triggerId` prop).
   */
  id?: string | undefined;
}

export namespace TooltipTrigger {
  export type State = TooltipTriggerState;
  export type Props<Payload = unknown> = TooltipTriggerProps<Payload>;
}
