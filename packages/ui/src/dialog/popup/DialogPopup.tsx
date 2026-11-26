import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import {
  FloatingFocusManager,
  type FocusTargetProp,
} from '../../utils/popups/focus/FloatingFocusManager';
import { useDialogRootContext } from '../root/DialogRootContext';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { useDialogPortalContext } from '../portal/DialogPortalContext';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import {
  FOCUSABLE_POPUP_PROPS,
  createDefaultInitialFocus,
  createDynamicPropsSource,
} from '../../utils/popups/popupStoreUtils';
import * as DialogPopupCssVars from './DialogPopupCssVars';
import { dialogStateAttributesMapping } from '../utils/stateAttributesMapping';

/**
 * A container for the dialog contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Dialog](https://base.egoist.dev/components/dialog)
 */
export function DialogPopup(componentProps: DialogPopup.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'finalFocus',
    'initialFocus',
    'id',
  );

  const store = useDialogRootContext();

  useDialogPortalContext();

  const open = () => store.select('open');
  const mounted = () => store.select('mounted');
  const nestedOpenDialogCount = () => store.select('nestedOpenDialogCount');

  createOpenChangeComplete({
    open,
    element: () => store.select('popupElement'),
    onComplete() {
      if (store.state.openProp ?? store.state.open) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  const defaultInitialFocus = createDefaultInitialFocus(() => store.state.popupElement);

  const rootPopupProps = createDynamicPropsSource(() => store.select('popupProps'));

  const state: DialogPopup.State = {
    get open() {
      return open();
    },
    get nested() {
      return store.select('nested');
    },
    get transitionStatus() {
      return store.select('transitionStatus');
    },
    get nestedDialogOpen() {
      return nestedOpenDialogCount() > 0;
    },
  };

  const element = renderElement('div', componentProps, {
    state,
    props: [
      rootPopupProps,
      {
        get id() {
          return componentProps.id ?? store.select('defaultPopupId');
        },
        get 'aria-labelledby'() {
          return store.select('titleElementId');
        },
        get 'aria-describedby'() {
          return store.select('descriptionElementId');
        },
        get role() {
          return store.select('role');
        },
        ...FOCUSABLE_POPUP_PROPS,
        get hidden() {
          return !mounted();
        },
        onKeyDown(event: KeyboardEvent) {
          if (COMPOSITE_KEYS.has(event.key)) {
            event.stopPropagation();
          }
        },
        get style() {
          return {
            [DialogPopupCssVars.nestedDialogs]: String(nestedOpenDialogCount()),
          } as JSX.CSSProperties;
        },
      },
      elementProps,
    ],
    ref: (el: HTMLElement) => store.set('popupElement', el),
    stateAttributesMapping: dialogStateAttributesMapping,
  });

  return (
    <FloatingFocusManager
      store={store}
      openInteractionType={store.select('openMethod')}
      disabled={!mounted()}
      closeOnFocusOut={!store.select('disablePointerDismissal')}
      initialFocus={
        componentProps.initialFocus === undefined ? defaultInitialFocus : componentProps.initialFocus
      }
      returnFocus={componentProps.finalFocus}
      modal={store.select('modal') !== false}
      restoreFocus="popup"
    >
      {element}
    </FloatingFocusManager>
  );
}

export interface DialogPopupProps extends BaseUIComponentProps<'div', DialogPopupState> {
  /**
   * Determines the element to focus when the dialog is opened.
   * By default, focus moves to the first tabbable element inside the popup, except when the dialog
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
   * Determines the element to focus when the dialog is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - An element or a ref object (`{ current }`): Move focus to that element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?: FocusTargetProp;
}

export interface DialogPopupState {
  /**
   * Whether the dialog is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the dialog is nested within a parent dialog.
   */
  nested: boolean;
  /**
   * Whether the dialog has nested dialogs open.
   */
  nestedDialogOpen: boolean;
}

export namespace DialogPopup {
  export type Props = DialogPopupProps;
  export type State = DialogPopupState;
}
