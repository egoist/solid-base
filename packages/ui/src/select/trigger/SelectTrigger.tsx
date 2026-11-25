import { createEffect, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { createTimeout } from '@egoist/solid-base-utils/timeout';
import { contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import { useSelectRootContext } from '../root/SelectRootContext';
import type { BaseUIComponentProps, HTMLProps, NativeButtonProps } from '../../internals/types';
import {
  extendFieldRootState,
  useFieldRootContext,
} from '../../internals/field-root-context/FieldRootContext';
import { createSetFieldFocused } from '../../internals/field-root-context/createSetFieldFocused';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { createLabelableId } from '../../internals/labelable-provider/createLabelableId';
import { pressableTriggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import { renderElement } from '../../internals/renderElement';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { isMouseWithinBounds } from '../../utils/getPseudoElementBounds';
import { getFloatingFocusElement } from '../../utils/popups/element';
import { createDynamicPropsSource } from '../../utils/popups/popupStoreUtils';
import { createButton } from '../../internals/use-button/createButton';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { resolveAriaLabelledBy } from '../../utils/resolveAriaLabelledBy';
import type { Side } from '../../internals/anchorPositioning';
import * as SelectTriggerDataAttributes from './SelectTriggerDataAttributes';

const SELECTED_DELAY = 400;

const stateAttributesMapping: StateAttributesMapping<SelectTriggerState> = {
  ...pressableTriggerOpenStateMapping,
  ...fieldValidityMapping,
  popupSide: (side: Side | null) =>
    side ? { [SelectTriggerDataAttributes.popupSide]: side } : null,
  value: () => null,
} as StateAttributesMapping<SelectTriggerState>;

/**
 * A button that opens the select popup.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectTrigger(componentProps: SelectTrigger.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'id',
    'disabled',
    'nativeButton',
  );

  const field = useFieldRootContext();
  const { validation } = field;
  const labelable = useLabelableContext();
  const store = useSelectRootContext();

  const readOnly = () => store.select('readOnly');
  const required = () => store.select('required');
  const disabled = () =>
    (field.disabled() ?? false) || store.select('disabled') || (componentProps.disabled ?? false);
  const open = () => store.select('open');

  const popupSide = () =>
    store.select('mounted') && store.select('positionerElement') ? store.select('popupSide') : null;

  const id = () => (componentProps.id as string | undefined) ?? store.select('id');

  createLabelableId({ id: () => componentProps.id as string | undefined });

  let triggerElement: HTMLElement | null = null;
  onCleanup(() => {
    if (triggerElement && store.state.triggerElement === triggerElement) {
      store.set('triggerElement', null);
    }
  });
  const setFocused = createSetFieldFocused(disabled, () => triggerElement);

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: () => componentProps.nativeButton ?? true,
  });

  const timeoutFocus = createTimeout();
  const selectedDelayTimeout = createTimeout();

  createEffect(open, (isOpen) => {
    if (isOpen) {
      // A mousedown on the trigger can open the popup under the cursor. Keep mouseup selection
      // disabled briefly so releasing over either the selected item or a neighboring item doesn't
      // commit an accidental selection. SelectItem can still opt into unselected mouseup sooner
      // after a real drag over the item.
      selectedDelayTimeout.start(SELECTED_DELAY, () => {
        store.context.selectionRef.current.allowUnselectedMouseUp = true;
        store.context.selectionRef.current.allowSelectedMouseUp = true;
      });

      return () => {
        selectedDelayTimeout.clear();
      };
    }

    store.context.selectionRef.current = {
      allowSelectedMouseUp: false,
      allowUnselectedMouseUp: false,
      dragY: 0,
    };

    return undefined;
  });

  const triggerProps = createDynamicPropsSource(() => store.select('triggerProps', true));

  const ownProps: HTMLProps = {
    get id() {
      return id();
    },
    role: 'combobox',
    get 'aria-expanded'() {
      return open() ? 'true' : 'false';
    },
    'aria-haspopup': 'listbox',
    get 'aria-controls'() {
      if (!open()) {
        return undefined;
      }
      return (
        store.select('listElement')?.id ??
        getFloatingFocusElement(store.select('positionerElement'))?.id
      );
    },
    get 'aria-labelledby'() {
      return resolveAriaLabelledBy(labelable.labelId(), store.select('labelId'));
    },
    get 'aria-readonly'() {
      return readOnly() || undefined;
    },
    get 'aria-required'() {
      return required() || undefined;
    },
    get tabindex() {
      return disabled() ? -1 : 0;
    },
    onFocus(event: FocusEvent) {
      setFocused(true);

      // The popup element shouldn't obscure the focused trigger.
      if (store.select('open') && store.context.alignItemWithTriggerActiveRef.current) {
        store.setOpen(false, createChangeEventDetails(REASONS.none, event));
      }

      // Saves a re-render on initial click: `forceMounted === true` mounts
      // the items before `open === true`.
      timeoutFocus.start(0, () => {
        store.set('forceMounted', true);
      });
    },
    onBlur(event: FocusEvent) {
      // If focus is moving into the popup, don't count it as a blur.
      if (contains(store.state.positionerElement, event.relatedTarget as Element | null)) {
        return;
      }

      field.setTouched(true);
      setFocused(false);

      if (untrack(field.validationMode) === 'onBlur') {
        validation.commit(store.state.selectedValue);
      }
    },
    onMouseDown(event: MouseEvent) {
      if (store.select('open')) {
        return;
      }

      const doc = ownerDocument(event.currentTarget as Element);

      function handleMouseUp(mouseEvent: MouseEvent) {
        if (!triggerElement) {
          return;
        }

        const mouseUpTarget = getTarget(mouseEvent) as Element | null;

        // Don't treat the release as an outside press when it lands on the trigger or inside
        // the popup positioner (or their children).
        if (
          contains(triggerElement, mouseUpTarget) ||
          contains(store.state.positionerElement, mouseUpTarget)
        ) {
          return;
        }

        if (isMouseWithinBounds(mouseEvent, triggerElement)) {
          return;
        }

        store.setOpen(false, createChangeEventDetails(REASONS.cancelOpen, mouseEvent));
      }

      doc.addEventListener('mouseup', handleMouseUp, { once: true });
    },
  };

  const state: SelectTriggerState = extendFieldRootState(field.state, {
    get open() {
      return open();
    },
    get disabled() {
      return disabled();
    },
    get value() {
      return store.select('selectedValue');
    },
    get readOnly() {
      return readOnly();
    },
    get popupSide() {
      return popupSide();
    },
    get placeholder() {
      return !store.select('hasSelectedValue');
    },
  });

  return renderElement('button', componentProps, {
    state,
    ref: [
      (element: HTMLElement) => {
        triggerElement = element;
        store.set('triggerElement', element);
      },
      buttonRef,
    ],
    props: [
      triggerProps,
      ownProps,
      elementProps,
      getButtonProps,
      (props: HTMLProps) => validation.getValidationProps(disabled, props),
      // Ensure a nested button does not overwrite the combobox role:
      // <Toolbar.Button render={(props) => <Select.Trigger {...props} />} />
      { role: 'combobox' },
    ],
    stateAttributesMapping,
  });
}

export interface SelectTriggerState extends FieldRootState {
  /**
   * Whether the select popup is currently open.
   */
  open: boolean;
  /**
   * Whether the select popup is readonly.
   */
  readOnly: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * The value of the currently selected item.
   */
  value: any;
  /**
   * Whether the select doesn't have a value.
   */
  placeholder: boolean;
}

export interface SelectTriggerProps
  extends NativeButtonProps, Omit<BaseUIComponentProps<'button', SelectTriggerState>, 'disabled'> {
  children?: JSX.Element;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled?: boolean | undefined;
}

export namespace SelectTrigger {
  export type State = SelectTriggerState;
  export type Props = SelectTriggerProps;
}
