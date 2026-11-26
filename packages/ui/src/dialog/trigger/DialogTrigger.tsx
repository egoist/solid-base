import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useDialogRootContext } from '../root/DialogRootContext';
import { createButton } from '../../internals/use-button/createButton';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { CLICK_TRIGGER_IDENTIFIER } from '../../internals/constants';
import type { DialogHandle } from '../store/DialogHandle';
import type { DialogHandleStore } from '../store/DialogStore';
import {
  createDynamicPropsSource,
  createStoreProxy,
  createTriggerDataForwarding,
} from '../../utils/popups/popupStoreUtils';
import { createBaseUiId } from '../../internals/baseUiId';
import { createClick } from '../../utils/popups/interactions/click';
import { createOpenMethodTriggerProps } from '../../utils/popups/interactions/openInteractionType';
import type { PopupInteractionStore } from '../../utils/popups/types';

/**
 * A button that opens the dialog.
 * Renders a `<button>` element.
 *
 * Documentation: [Solid Base Dialog](https://base.egoist.dev/components/dialog)
 */
export function DialogTrigger<Payload = unknown>(
  componentProps: DialogTrigger.Props<Payload>,
): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'nativeButton',
    'id',
    'payload',
    'handle',
  );

  const disabled = () => componentProps.disabled ?? false;

  const dialogRootStore = useDialogRootContext(true);

  const store = (): DialogHandleStore<Payload> => {
    const handle = componentProps.handle;
    if (handle) {
      return handle.store;
    }
    if (!dialogRootStore) {
      throw new Error(
        'Base UI: <Dialog.Trigger> must be used within <Dialog.Root> or provided with a handle.',
      );
    }
    return dialogRootStore as unknown as DialogHandleStore<Payload>;
  };

  const thisTriggerId = createBaseUiId(() => componentProps.id);
  const isOpenedByThisTrigger = () =>
    store().select('isOpenedByTrigger', thisTriggerId()) as boolean;

  const { registerTrigger, isMountedByThisTrigger } = createTriggerDataForwarding(
    thisTriggerId,
    store,
    () => ({ payload: componentProps.payload }),
  );

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: () => componentProps.nativeButton ?? true,
  });

  const interactionStore = createStoreProxy(store as () => DialogHandleStore<Payload> & PopupInteractionStore);
  const click = createClick(interactionStore);
  const interactionTypeProps = createOpenMethodTriggerProps(
    () => store().select('open'),
    (interactionType) => {
      store().set('openMethod', interactionType);
    },
  );

  const rootTriggerProps = createDynamicPropsSource(
    () => store().select('triggerProps', isMountedByThisTrigger()) as Record<string, any>,
  );

  const state: DialogTrigger.State = {
    get disabled() {
      return disabled();
    },
    get open() {
      return isOpenedByThisTrigger();
    },
  };

  return renderElement('button', componentProps, {
    state,
    ref: [buttonRef, registerTrigger],
    props: [
      click.reference,
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
    stateAttributesMapping: triggerOpenStateMapping,
  });
}

export interface DialogTriggerProps<Payload = unknown>
  extends NativeButtonProps, Omit<BaseUIComponentProps<'button', DialogTriggerState>, 'disabled' | 'id'> {
  /**
   * Whether the component ignores user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A handle to associate the trigger with a dialog.
   * Can be created with the Dialog.createHandle() method.
   */
  handle?: DialogHandle<Payload> | undefined;
  /**
   * A payload to pass to the dialog when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * ID of the trigger. In addition to being forwarded to the rendered element,
   * it is also used to specify the active trigger for the dialog in controlled mode (with the DialogRoot `triggerId` prop).
   */
  id?: string | undefined;
}

export interface DialogTriggerState {
  /**
   * Whether the trigger is currently disabled.
   */
  disabled: boolean;
  /**
   * Whether the dialog is currently open and was opened by this trigger.
   */
  open: boolean;
}

export namespace DialogTrigger {
  export type Props<Payload = unknown> = DialogTriggerProps<Payload>;
  export type State = DialogTriggerState;
}
