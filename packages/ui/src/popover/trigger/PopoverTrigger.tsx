import { Show, createEffect, createMemo, createSignal, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { createButton } from '../../internals/use-button/createButton';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import {
  pressableTriggerOpenStateMapping,
  triggerOpenStateMapping,
} from '../../utils/popups/popupStateMapping';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { renderElement } from '../../internals/renderElement';
import { CLICK_TRIGGER_IDENTIFIER } from '../../internals/constants';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { createClick } from '../../utils/popups/interactions/click';
import { createHoverTriggerInteraction } from '../../utils/popups/interactions/hoverTriggerInteraction';
import { OPEN_DELAY } from '../utils/constants';
import type { PopoverHandle } from '../store/PopoverHandle';
import type { PopoverHandleStore, PopoverStore } from '../store/PopoverStore';
import { createBaseUiId } from '../../internals/baseUiId';
import { FocusGuard } from '../../utils/popups/focus/FocusGuard';
import {
  createDynamicPropsSource,
  createTriggerDataForwarding,
} from '../../utils/popups/popupStoreUtils';
import { createTriggerFocusGuards } from '../../utils/popups/triggerFocusGuards';
import { createOpenMethodTriggerProps } from '../../utils/popups/interactions/openInteractionType';
import type { PopupInteractionStore } from '../../utils/popups/types';

/**
 * A button that opens the popover.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Popover](https://base-ui.com/react/components/popover)
 */
export function PopoverTrigger<Payload = unknown>(
  componentProps: PopoverTrigger.Props<Payload>,
): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'nativeButton',
    'handle',
    'payload',
    'openOnHover',
    'delay',
    'closeDelay',
    'id',
  );

  const disabled = () => componentProps.disabled ?? false;
  const openOnHover = () => componentProps.openOnHover ?? false;
  const delay = () => componentProps.delay ?? OPEN_DELAY;
  const closeDelay = () => componentProps.closeDelay ?? 0;

  const rootStore = usePopoverRootContext(true);

  const store = (): PopoverHandleStore<Payload> => {
    const handle = componentProps.handle;
    if (handle) {
      return handle.store;
    }
    if (!rootStore) {
      throw new Error(
        'Base UI: <Popover.Trigger> must be either used within a <Popover.Root> component or provided with a handle.',
      );
    }
    return rootStore as unknown as PopoverHandleStore<Payload>;
  };
  // Throw eagerly when the trigger has neither a root nor a handle.
  untrack(store);

  const thisTriggerId = createBaseUiId(() => componentProps.id);
  const isTriggerActive = () => store().select('isTriggerActive', thisTriggerId()) as boolean;
  const isOpenedByThisTrigger = () =>
    store().select('isOpenedByTrigger', thisTriggerId()) as boolean;

  const { registerTrigger, isMountedByThisTrigger, triggerElement } = createTriggerDataForwarding(
    thisTriggerId,
    store,
    () => ({
      payload: componentProps.payload,
      disabled: disabled(),
      openOnHover: openOnHover(),
      closeDelay: closeDelay(),
    }),
  );

  const isPressOpenedByThisTrigger = () =>
    (store() as unknown as PopoverStore<Payload>).select(
      'isPressOpenedByTrigger',
      thisTriggerId(),
    ) as boolean;
  const isTouchPressOpen = () =>
    (store() as unknown as PopoverStore<Payload>).select(
      'isTouchPressOpen',
      openOnHover(),
    ) as boolean;
  const hasFocusGuards = () =>
    (store() as unknown as PopoverStore<Payload>).select(
      'hasTriggerFocusGuards',
      thisTriggerId(),
    ) as boolean;

  // The interactions bind to the store they are created with (its context, event emitter and
  // hover intent). A handle-backed trigger switches from the handle's fallback store to the
  // Root's store once a Root attaches, so they are created anew for each store.
  const interactions = createMemo(() => {
    const currentStore = store() as unknown as PopupInteractionStore;
    return untrack(() => createStoreInteractions(currentStore));
  });

  function createStoreInteractions(interactionStore: PopupInteractionStore) {
    const hover = createHoverTriggerInteraction(interactionStore, {
      get enabled() {
        return !disabled() && openOnHover() && !isTouchPressOpen();
      },
      mouseOnly: true,
      move: false,
      handleClose: safePolygon(),
      restMs: () => delay(),
      delay: () => ({ close: closeDelay() }),
      get triggerElement() {
        return triggerElement();
      },
      get isActiveTrigger() {
        return isTriggerActive();
      },
    });

    const click = createClick(interactionStore, {
      stickIfOpen: () => (interactionStore.context as PopoverStore<Payload>['context']).stickIfOpen,
    });

    return { hover, click: click.reference! };
  }

  const hoverProps = createDynamicPropsSource(() => interactions().hover);
  const clickProps = createDynamicPropsSource(() => interactions().click);

  const interactionTypeProps = createOpenMethodTriggerProps(
    () => store().select('open') as boolean,
    (interactionType) => {
      store().set('openMethod', interactionType);
    },
  );

  const rootTriggerProps = createDynamicPropsSource(
    () => store().select('triggerProps', isMountedByThisTrigger()) as Record<string, any>,
  );

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: () => componentProps.nativeButton ?? true,
  });

  const stateAttributesMapping: StateAttributesMapping<PopoverTrigger.State> = {
    open(value) {
      if (isPressOpenedByThisTrigger()) {
        return pressableTriggerOpenStateMapping.open(value);
      }
      return triggerOpenStateMapping.open(value);
    },
  };

  const focusGuardStore = {
    setOpen: (...args: Parameters<PopoverHandleStore<Payload>['setOpen']>) =>
      untrack(store).setOpen(...args),
    select: (key: 'positionerElement') => untrack(store).select(key),
    get context() {
      return untrack(store).context;
    },
  };

  const { handlePreFocusGuardFocus, handleFocusTargetFocus } = createTriggerFocusGuards(
    focusGuardStore as never,
    () => triggerElement() as HTMLElement | null,
  );

  const state: PopoverTrigger.State = {
    get disabled() {
      return disabled();
    },
    get open() {
      return isOpenedByThisTrigger();
    },
  };

  const element = renderElement('button', componentProps, {
    state,
    ref: [buttonRef, registerTrigger],
    props: [
      clickProps,
      hoverProps,
      rootTriggerProps,
      interactionTypeProps,
      {
        [CLICK_TRIGGER_IDENTIFIER]: '',
        get id() {
          return thisTriggerId();
        },
        'aria-haspopup': 'dialog',
        get 'aria-expanded'() {
          return isOpenedByThisTrigger();
        },
        get 'aria-controls'() {
          return store().select('triggerPopupId', thisTriggerId()) as string | undefined;
        },
      },
      elementProps,
      getButtonProps,
    ],
    stateAttributesMapping,
  });

  // Solid reconciles the trigger's siblings as one list: inserting nodes both before and after
  // the trigger in the same pass (the guards, and the portal's own focus guards when the popup
  // opens) replaces (moves) the trigger element, which drops its focus. The guard before the
  // trigger is therefore added in a later pass, once everything after it is in place.
  const guardsVisible = createMemo(hasFocusGuards);
  const [beforeGuardReady, setBeforeGuardReady] = createSignal(false, { ownedWrite: true });
  createEffect(guardsVisible, (visible) => {
    setBeforeGuardReady(visible);
  });

  return (
    <>
      <Show when={guardsVisible() && beforeGuardReady()}>
        <TriggerFocusGuard
          refObject={() => untrack(store).context.beforeTriggerFocusGuardRef}
          onFocus={handlePreFocusGuardFocus}
        />
      </Show>
      {element}
      <Show when={guardsVisible()}>
        <TriggerFocusGuard
          refObject={() => untrack(store).context.triggerFocusTargetRef}
          onFocus={handleFocusTargetFocus}
        />
      </Show>
    </>
  );
}

/**
 * A focus guard that publishes its element to a ref object of the store while mounted.
 */
function TriggerFocusGuard(props: {
  refObject: () => { current: HTMLElement | null };
  onFocus: (event: FocusEvent) => void;
}) {
  let element: HTMLElement | null = null;
  onCleanup(() => {
    const refObject = props.refObject();
    if (refObject.current === element) {
      refObject.current = null;
    }
  });
  return (
    <FocusGuard
      ref={(el: HTMLElement) => {
        element = el;
        props.refObject().current = el;
      }}
      onFocus={(event) => props.onFocus(event)}
    />
  );
}

export interface PopoverTriggerState {
  /**
   * Whether the trigger is currently disabled.
   */
  disabled: boolean;
  /**
   * Whether the popover is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface PopoverTriggerProps<Payload = unknown>
  extends
    NativeButtonProps,
    Omit<BaseUIComponentProps<'button', PopoverTriggerState>, 'disabled' | 'id'> {
  /**
   * Whether the component ignores user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A handle to associate the trigger with a popover.
   */
  handle?: PopoverHandle<Payload> | undefined;
  /**
   * A payload to pass to the popover when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * ID of the trigger. In addition to being forwarded to the rendered element,
   * it is also used to specify the active trigger for the popover in controlled mode (with the PopoverRoot `triggerId` prop).
   */
  id?: string | undefined;
  /**
   * Whether the popover should also open when the trigger is hovered.
   * @default false
   */
  openOnHover?: boolean | undefined;
  /**
   * How long to wait before the popover may be opened on hover. Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 300
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the popover that was opened on hover.
   * Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 0
   */
  closeDelay?: number | undefined;
}

export namespace PopoverTrigger {
  export type State = PopoverTriggerState;
  export type Props<Payload = unknown> = PopoverTriggerProps<Payload>;
}
