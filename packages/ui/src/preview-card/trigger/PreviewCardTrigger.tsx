import { createMemo, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { renderElement } from '../../internals/renderElement';
import { createBaseUiId } from '../../internals/baseUiId';
import type { PreviewCardHandle } from '../store/PreviewCardHandle';
import type { PreviewCardHandleStore } from '../store/PreviewCardStore';
import { getInlineRectTriggerProps } from '../../utils/popups/inlineRect';
import {
  createDynamicPropsSource,
  createTriggerDataForwarding,
} from '../../utils/popups/popupStoreUtils';
import { CLOSE_DELAY, OPEN_DELAY } from '../utils/constants';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { createFocus } from '../../utils/popups/interactions/focus';
import { createHoverTriggerInteraction } from '../../utils/popups/interactions/hoverTriggerInteraction';
import type { PopupInteractionStore } from '../../utils/popups/types';

/**
 * A link that opens the preview card.
 * Renders an `<a>` element.
 *
 * Documentation: [Base UI Preview Card](https://base-ui.com/react/components/preview-card)
 */
export function PreviewCardTrigger<Payload = unknown>(
  componentProps: PreviewCardTrigger.Props<Payload>,
): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'delay',
    'closeDelay',
    'id',
    'payload',
    'handle',
  );

  const rootStore = usePreviewCardRootContext(true);

  const store = (): PreviewCardHandleStore<Payload> => {
    const handle = componentProps.handle;
    if (handle) {
      return handle.store;
    }
    if (!rootStore) {
      throw new Error(
        'Base UI: <PreviewCard.Trigger> must be either used within a <PreviewCard.Root> component or provided with a handle.',
      );
    }
    return rootStore as unknown as PreviewCardHandleStore<Payload>;
  };
  // Throw eagerly when the trigger has neither a root nor a handle.
  untrack(store);

  const thisTriggerId = createBaseUiId(() => componentProps.id);
  const isTriggerActive = () => store().select('isTriggerActive', thisTriggerId()) as boolean;
  const isOpenedByThisTrigger = () =>
    store().select('isOpenedByTrigger', thisTriggerId()) as boolean;

  const delayWithDefault = () => componentProps.delay ?? OPEN_DELAY;
  const closeDelayWithDefault = () => componentProps.closeDelay ?? CLOSE_DELAY;

  const { registerTrigger, isMountedByThisTrigger, triggerElement } = createTriggerDataForwarding(
    thisTriggerId,
    store,
    () => ({
      payload: componentProps.payload,
      closeDelay: closeDelayWithDefault(),
    }),
  );

  // The interactions bind to the store they are created with (its context, event emitter and
  // hover intent). A handle-backed trigger switches from the handle's fallback store to the
  // Root's store once a Root attaches, so they are created anew for each store.
  const interactions = createMemo(() => {
    const interactionStore = store() as unknown as PopupInteractionStore;
    return untrack(() => ({
      hover: createHoverTriggerInteraction(interactionStore, {
        mouseOnly: true,
        move: false,
        handleClose: safePolygon(),
        delay: () => untrack(() => ({ open: delayWithDefault(), close: closeDelayWithDefault() })),
        get triggerElement() {
          return triggerElement();
        },
        get isActiveTrigger() {
          return isTriggerActive();
        },
      }),
      focus: createFocus(interactionStore, {
        get delay() {
          return delayWithDefault();
        },
      }).reference,
    }));
  });

  const hoverProps = createDynamicPropsSource(() => interactions().hover);
  const focusProps = createDynamicPropsSource(() => interactions().focus);

  const rootTriggerProps = createDynamicPropsSource(
    () => store().select('triggerProps', isMountedByThisTrigger()) as Record<string, any>,
  );

  const inlineRectTriggerProps = getInlineRectTriggerProps(
    {
      get current() {
        return untrack(store).context.inlineRectCoordsRef.current;
      },
      set current(value) {
        untrack(store).context.inlineRectCoordsRef.current = value;
      },
    },
    () => untrack(isOpenedByThisTrigger),
  );

  const state: PreviewCardTrigger.State = {
    get open() {
      return isOpenedByThisTrigger();
    },
  };

  return renderElement('a', componentProps, {
    state,
    ref: registerTrigger,
    props: [
      hoverProps,
      focusProps,
      rootTriggerProps,
      inlineRectTriggerProps,
      {
        get id() {
          return thisTriggerId();
        },
      },
      elementProps,
    ],
    stateAttributesMapping: triggerOpenStateMapping,
  });
}

export interface PreviewCardTriggerState {
  /**
   * Whether the preview card is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface PreviewCardTriggerProps<Payload = unknown>
  extends Omit<BaseUIComponentProps<'a', PreviewCardTriggerState>, 'id'> {
  /**
   * A handle to associate the trigger with a preview card.
   */
  handle?: PreviewCardHandle<Payload> | undefined;
  /**
   * A payload to pass to the preview card when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * How long to wait before the preview card opens. Specified in milliseconds.
   * @default 600
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the preview card. Specified in milliseconds.
   * @default 300
   */
  closeDelay?: number | undefined;
  /**
   * ID of the trigger. In addition to being forwarded to the rendered element, it is also used to
   * specify the active trigger for the preview card in controlled mode (with the PreviewCardRoot
   * `triggerId` prop).
   */
  id?: string | undefined;
}

export namespace PreviewCardTrigger {
  export type State = PreviewCardTriggerState;
  export type Props<Payload = unknown> = PreviewCardTriggerProps<Payload>;
}
