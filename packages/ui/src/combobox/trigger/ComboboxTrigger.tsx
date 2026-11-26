import { omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createTimeout } from '@egoist/solid-base-utils/timeout';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import type { BaseUIComponentProps, HTMLProps, NativeButtonProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { createButton } from '../../internals/use-button/createButton';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { triggerStateAttributesMapping } from '../utils/stateAttributesMapping';
import {
  extendFieldRootState,
  useFieldRootContext,
} from '../../internals/field-root-context/FieldRootContext';
import { createSetFieldFocused } from '../../internals/field-root-context/createSetFieldFocused';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { createLabelableId } from '../../internals/labelable-provider/createLabelableId';
import { stopEvent } from '../../utils/popups/event';
import { isMouseWithinBounds } from '../../utils/getPseudoElementBounds';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { createClick } from '../../utils/popups/interactions/click';
import { createTypeahead } from '../../utils/popups/interactions/typeahead';
import type { Side } from '../../internals/anchorPositioning';
import { resolveAriaLabelledBy } from '../../utils/resolveAriaLabelledBy';
import { createDynamicPropsSource } from '../../utils/popups/popupStoreUtils';
import { getComboboxPopupId } from '../root/utils';
import { useListEmpty, usePopupSide } from '../utils/parts';

/**
 * A button that opens the popup.
 * Renders a `<button>` element.
 *
 * Documentation: [Solid Base Combobox](https://base.egoist.dev/components/combobox)
 */
export function ComboboxTrigger(componentProps: ComboboxTrigger.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'nativeButton',
    'disabled',
    'id',
  );

  const field = useFieldRootContext();
  const { validation } = field;
  const { labelId: fieldLabelId } = useLabelableContext();
  const store = useComboboxRootContext();

  const selectionMode = () => store.select('selectionMode');
  const comboboxDisabled = () => store.select('disabled');
  const readOnly = () => store.select('readOnly');
  const inputInsidePopup = () => store.select('inputInsidePopup');
  const open = () => store.select('open');

  const focusTimeout = createTimeout();

  const disabled = () =>
    (field.disabled() ?? false) || comboboxDisabled() || (componentProps.disabled ?? false);
  const listEmpty = useListEmpty();
  const popupSide = usePopupSide(store);

  let triggerElement: HTMLElement | null = null;
  const setFocused = createSetFieldFocused(disabled, () => triggerElement);
  onCleanup(() => {
    if (triggerElement && store.state.triggerElement === triggerElement) {
      store.set('triggerElement', null);
    }
  });

  createLabelableId({
    id: () => (inputInsidePopup() ? (componentProps.id as string | undefined) : undefined),
    enabled: inputInsidePopup,
  });
  const id = () =>
    inputInsidePopup() ? (componentProps.id ?? store.select('id')) : componentProps.id;
  const ariaLabelledBy = () => resolveAriaLabelledBy(fieldLabelId(), store.select('labelId'));

  const ariaControls = () => {
    if (open() && inputInsidePopup()) {
      // Fall back to the default id while the popup registers its own, so `aria-controls` is set
      // as soon as `open` becomes `true`.
      return store.select('popupElementId') ?? getComboboxPopupId(store.select('id'));
    }
    if (open()) {
      return store.select('listElement')?.id || undefined;
    }
    return undefined;
  };

  let currentPointerType: string = '';

  function trackPointerType(event: PointerEvent) {
    currentPointerType = event.pointerType;
  }

  const typeahead = createTypeahead(store.interactions, {
    // Typeahead on a closed trigger commits a value rather than moving a highlight, so it stays
    // gated on `readOnly`.
    get enabled() {
      return !open() && !readOnly() && !comboboxDisabled() && selectionMode() === 'single';
    },
    listRef: store.context.labelsRef,
    get activeIndex() {
      return store.select('activeIndex');
    },
    get selectedIndex() {
      return store.select('selectedIndex');
    },
    onMatch(index) {
      const nextSelectedValue = store.context.valuesRef.current[index];
      if (nextSelectedValue !== undefined) {
        store.context.setSelectedValue(nextSelectedValue, createChangeEventDetails(REASONS.none));
      }
    },
  });

  const click = createClick(store.interactions, {
    get enabled() {
      return !comboboxDisabled();
    },
    event: 'mousedown',
    // A Combobox never opens on hover or focus, so a press always toggles it, even when a key
    // press, such as typing or an arrow key, opened it.
    stickIfOpen: false,
  });

  const { buttonRef, getButtonProps } = createButton({
    native: () => componentProps.nativeButton ?? true,
    disabled,
  });

  const state: ComboboxTriggerState = extendFieldRootState(field.state, {
    get readOnly() {
      return readOnly();
    },
    get open() {
      return open();
    },
    get disabled() {
      return disabled();
    },
    get popupSide() {
      return popupSide();
    },
    get listEmpty() {
      return listEmpty();
    },
    get placeholder() {
      return selectionMode() === 'none' ? false : !store.select('hasSelectedValue');
    },
  });

  const ownProps: HTMLProps = {
    get id() {
      return id();
    },
    get tabindex() {
      return inputInsidePopup() ? 0 : -1;
    },
    get role() {
      return inputInsidePopup() ? 'combobox' : undefined;
    },
    get 'aria-expanded'() {
      return open() ? 'true' : 'false';
    },
    get 'aria-haspopup'() {
      return inputInsidePopup() ? 'dialog' : 'listbox';
    },
    get 'aria-controls'() {
      return ariaControls();
    },
    get 'aria-required'() {
      return inputInsidePopup() ? store.select('required') || undefined : undefined;
    },
    // Only valid alongside the `combobox` role; without it the trigger is a plain button, and
    // the `Combobox.Input` outside the popup already carries `aria-readonly`.
    get 'aria-readonly'() {
      return inputInsidePopup() ? readOnly() || undefined : undefined;
    },
    get 'aria-labelledby'() {
      return ariaLabelledBy();
    },
    onPointerDown: trackPointerType,
    onPointerEnter: trackPointerType,
    onFocus() {
      setFocused(true);

      if (untrack(disabled)) {
        return;
      }

      focusTimeout.start(0, store.context.forceMount);
    },
    onBlur(event: FocusEvent) {
      // If focus is moving into the popup, don't count it as a blur.
      if (contains(store.state.positionerElement, event.relatedTarget as Element | null)) {
        return;
      }

      field.setTouched(true);
      setFocused(false);

      if (untrack(field.validationMode) === 'onBlur') {
        const valueToValidate =
          store.state.selectionMode === 'none' ? store.state.inputValue : store.state.selectedValue;
        validation.commit(valueToValidate);
      }
    },
    onMouseDown(event: MouseEvent) {
      if (untrack(disabled)) {
        return;
      }

      const isInputInsidePopup = store.state.inputInsidePopup;

      if (!isInputInsidePopup) {
        store.interactions.set('anchorElement', event.currentTarget as Element);
      }

      // Ensure items are registered for initial selection highlight.
      store.context.forceMount();

      if (currentPointerType !== 'touch') {
        store.context.inputRef.current?.focus();

        if (!isInputInsidePopup) {
          event.preventDefault();
        }
      }

      if (store.select('open')) {
        return;
      }

      const doc = ownerDocument(event.currentTarget as Element);

      function handleMouseUp(mouseEvent: MouseEvent) {
        const currentTriggerElement = store.state.triggerElement as HTMLElement | null;
        if (!currentTriggerElement) {
          return;
        }

        const mouseUpTarget = getTarget(mouseEvent) as Element | null;
        const positioner = store.state.positionerElement;
        const list = store.state.listElement;

        if (
          contains(currentTriggerElement, mouseUpTarget) ||
          contains(positioner, mouseUpTarget) ||
          contains(list, mouseUpTarget)
        ) {
          return;
        }

        if (isMouseWithinBounds(mouseEvent, currentTriggerElement)) {
          return;
        }

        store.setOpen(false, createChangeEventDetails(REASONS.cancelOpen, mouseEvent));
      }

      if (isInputInsidePopup) {
        doc.addEventListener('mouseup', handleMouseUp, { once: true });
      }
    },
    onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        stopEvent(event);
        store.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event));
        store.context.inputRef.current?.focus();
      }
    },
  };

  return renderElement('button', componentProps, {
    ref: [
      buttonRef,
      (element: HTMLElement) => {
        triggerElement = element;
        store.set('triggerElement', element);
      },
    ],
    state,
    props: [
      createDynamicPropsSource(() => store.select('triggerProps', true)),
      click.reference!,
      typeahead.reference!,
      ownProps,
      validation.getValidationProps(disabled, elementProps as HTMLProps),
      getButtonProps,
    ],
    stateAttributesMapping: triggerStateAttributesMapping,
  });
}

export interface ComboboxTriggerState extends FieldRootState {
  /**
   * Whether the popup is open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the component should ignore user edits.
   */
  readOnly: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * Present when the corresponding items list is empty.
   */
  listEmpty: boolean;
  /**
   * Whether the combobox doesn't have a value.
   */
  placeholder: boolean;
}

export interface ComboboxTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ComboboxTriggerState> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace ComboboxTrigger {
  export type State = ComboboxTriggerState;
  export type Props = ComboboxTriggerProps;
}
