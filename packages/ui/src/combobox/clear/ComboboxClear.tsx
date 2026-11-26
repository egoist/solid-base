import { omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { createButton } from '../../internals/use-button/createButton';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { createTransitionStatus, type TransitionStatus } from '../../internals/transitionStatus';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { getHighlightReason } from '../../utils/getHighlightReason';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';

const stateAttributesMapping: StateAttributesMapping<ComboboxClearState> = {
  ...transitionStatusMapping,
  ...triggerOpenStateMapping,
};

/**
 * Clears the value when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Solid Base Combobox](https://base.egoist.dev/components/combobox)
 */
export function ComboboxClear(componentProps: ComboboxClear.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'nativeButton',
    'keepMounted',
  );

  const field = useFieldRootContext();
  const store = useComboboxRootContext();

  const selectionMode = () => store.select('selectionMode');

  const visible = () => {
    const mode = selectionMode();
    if (mode === 'none') {
      return String(store.select('inputValue') ?? '') !== '';
    }
    if (mode === 'single') {
      return store.select('selectedValue') != null;
    }
    return store.select('hasSelectionChips');
  };

  const disabled = () =>
    (field.disabled() ?? false) || store.select('disabled') || (componentProps.disabled ?? false);

  const { buttonRef, getButtonProps } = createButton({
    native: () => componentProps.nativeButton ?? true,
    disabled,
  });

  const { mounted, transitionStatus, setMounted } = createTransitionStatus(visible);

  const state: ComboboxClearState = {
    get disabled() {
      return disabled();
    },
    get visible() {
      return visible();
    },
    get open() {
      return store.select('open');
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  let clearElement: HTMLButtonElement | null = null;
  onCleanup(() => {
    if (clearElement && store.context.clearRef.current === clearElement) {
      store.context.clearRef.current = null;
    }
  });

  createOpenChangeComplete({
    open: visible,
    element: () => (mounted() ? clearElement : null),
    onComplete() {
      if (!visible()) {
        setMounted(false);
      }
    },
  });

  return renderElement('button', componentProps, {
    state,
    ref: [
      buttonRef,
      (el: HTMLButtonElement) => {
        clearElement = el;
        store.context.clearRef.current = el;
      },
    ],
    props: [
      {
        tabindex: -1,
        children: 'x',
        // Avoid stealing focus from the input.
        onMouseDown(event: MouseEvent) {
          event.preventDefault();
        },
        onClick(event: MouseEvent) {
          if (disabled() || store.state.readOnly) {
            return;
          }

          const type = getHighlightReason(event);

          store.context.setInputValue('', createChangeEventDetails(REASONS.clearPress, event));

          if (store.state.selectionMode !== 'none') {
            store.context.setSelectedValue(
              Array.isArray(store.state.selectedValue) ? [] : null,
              createChangeEventDetails(REASONS.clearPress, event),
            );
            store.context.setIndices({
              activeIndex: null,
              selectedIndex: null,
              type,
              event,
            });
          } else {
            store.context.setIndices({ activeIndex: null, type, event });
          }

          store.context.inputRef.current?.focus();
        },
      },
      elementProps,
      getButtonProps,
    ],
    stateAttributesMapping,
    enabled: () => (componentProps.keepMounted ?? false) || mounted(),
  });
}

export interface ComboboxClearState {
  /**
   * Whether the popup is open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the button is visible (there is a value to clear).
   */
  visible: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface ComboboxClearProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ComboboxClearState> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the component should remain mounted in the DOM when not visible.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace ComboboxClear {
  export type State = ComboboxClearState;
  export type Props = ComboboxClearProps;
}
