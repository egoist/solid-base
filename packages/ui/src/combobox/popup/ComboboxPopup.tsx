import { Show, createEffect, omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import {
  FloatingFocusManager,
  type FocusTargetProp,
} from '../../utils/popups/focus/FloatingFocusManager';
import type { InteractionType } from '../../utils/popups/interactions/enhancedClickHandler';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { useComboboxPositionerContext } from '../positioner/ComboboxPositionerContext';
import type { Side, Align } from '../../internals/anchorPositioning';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import { createDynamicPropsSource } from '../../utils/popups/popupStoreUtils';
import { ComboboxInternalDismissButton } from '../utils/ComboboxInternalDismissButton';
import { getComboboxPopupId } from '../root/utils';
import { useListEmpty } from '../utils/parts';

/**
 * A container for the list.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxPopup(componentProps: ComboboxPopup.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'initialFocus',
    'finalFocus',
  );

  const store = useComboboxRootContext();
  const positioning = useComboboxPositionerContext();

  const open = () => store.select('open');
  const mounted = () => store.select('mounted');
  const transitionStatus = () => store.select('transitionStatus');
  const inputInsidePopup = () => store.select('inputInsidePopup');

  const empty = useListEmpty();
  const popupId = (): string | undefined =>
    (componentProps.id as string | undefined) ??
    (inputInsidePopup() ? getComboboxPopupId(store.select('id')) : undefined);

  let popupElement: HTMLDivElement | null = null;

  createEffect(
    () => [popupId(), store.select('popupElement')] as const,
    ([id, element]) => {
      // Prefer the rendered DOM id, which a `render` prop element or function may override.
      store.set('popupElementId', element?.id || id);
      return () => {
        store.set('popupElementId', undefined);
      };
    },
  );

  onCleanup(() => {
    if (popupElement && store.context.popupRef.current === popupElement) {
      store.context.popupRef.current = null;
    }
    if (popupElement && store.state.popupElement === popupElement) {
      store.set('popupElement', null);
    }
  });

  createOpenChangeComplete({
    open,
    element: () => store.select('popupElement'),
    onComplete() {
      if (store.select('open')) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  const state: ComboboxPopupState = {
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
    get transitionStatus() {
      return transitionStatus();
    },
    get empty() {
      return empty();
    },
  };

  const element = renderElement('div', componentProps, {
    state,
    ref: (el: HTMLDivElement) => {
      popupElement = el;
      store.context.popupRef.current = el;
      store.set('popupElement', el);
    },
    props: [
      createDynamicPropsSource(() => store.select('popupProps')),
      {
        get id() {
          return popupId();
        },
        get role() {
          return inputInsidePopup() ? 'dialog' : 'presentation';
        },
        onFocusIn(event: FocusEvent) {
          const target = getTarget(event) as Element | null;
          if (
            store.state.openMethod !== 'touch' &&
            (contains(store.state.listElement, target) || target === event.currentTarget)
          ) {
            store.context.inputRef.current?.focus();
          }
        },
      } as HTMLProps,
      createDynamicPropsSource(() => getDisabledMountTransitionStyles(transitionStatus())),
      elementProps,
    ],
    stateAttributesMapping: popupTransitionStateMapping,
  });

  // Default initial focus logic:
  // If opened by touch, focus the popup element to prevent the virtual keyboard from opening
  // (this is required for Android specifically as iOS handles this automatically).
  const initialFocus = (): FocusTargetProp => {
    if (componentProps.initialFocus !== undefined) {
      return componentProps.initialFocus;
    }
    if (!inputInsidePopup()) {
      return false;
    }
    return (interactionType: InteractionType) =>
      interactionType === 'touch' ? store.context.popupRef.current : store.state.inputElement;
  };

  const finalFocus = (): FocusTargetProp => {
    if (componentProps.finalFocus != null) {
      return componentProps.finalFocus;
    }
    return inputInsidePopup() ? undefined : false;
  };

  const focusManagerModal = () => !inputInsidePopup() || store.select('modal');

  return (
    <FloatingFocusManager
      store={store.interactions}
      disabled={!mounted()}
      modal={focusManagerModal()}
      openInteractionType={store.select('openMethod')}
      initialFocus={initialFocus()}
      returnFocus={finalFocus()}
      getInsideElements={() => [
        store.context.startDismissRef.current,
        store.context.endDismissRef.current,
      ]}
    >
      <>
        {element}
        <Show when={focusManagerModal()}>
          <ComboboxInternalDismissButton
            ref={(el) => {
              store.context.endDismissRef.current = el;
            }}
          />
        </Show>
      </>
    </FloatingFocusManager>
  );
}

export interface ComboboxPopupState {
  /**
   * Whether the corresponding popup is open.
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
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether there are no items to display.
   */
  empty: boolean;
}

export interface ComboboxPopupProps extends BaseUIComponentProps<'div', ComboboxPopupState> {
  /**
   * Determines the element to focus when the popup is opened.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - An element or a ref object (`{ current }`): Move focus to that element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?: FocusTargetProp;
  /**
   * Determines the element to focus when the popup is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - An element or a ref object (`{ current }`): Move focus to that element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?: FocusTargetProp;
}

export namespace ComboboxPopup {
  export type State = ComboboxPopupState;
  export type Props = ComboboxPopupProps;
}
