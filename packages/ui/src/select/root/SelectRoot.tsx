import { For, createMemo, createSignal, flush, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createControllableSignal } from '@egoist/solid-base-utils/controlled';
import { applyRef, type RefProp } from '@egoist/solid-base-utils/refs';
import { EMPTY_ARRAY } from '@egoist/solid-base-utils/empty';
import { isElementDisabled } from '@egoist/solid-base-utils/isElementDisabled';
import {
  visuallyHiddenInput,
  visuallyHiddenInputPinned,
} from '@egoist/solid-base-utils/visuallyHidden';
import { createClick } from '../../utils/popups/interactions/click';
import { createDismiss } from '../../utils/popups/interactions/dismiss';
import { createListNavigation } from '../../utils/popups/interactions/listNavigation';
import { createTypeahead } from '../../utils/popups/interactions/typeahead';
import { createOpenMethodTriggerProps } from '../../utils/popups/interactions/openInteractionType';
import type { InteractionType } from '../../utils/popups/interactions/enhancedClickHandler';
import { SelectRootContext } from './SelectRootContext';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { createRegisterFieldControl } from '../../internals/field-register-control/createRegisterFieldControl';
import { createFieldValueChanged } from '../../internals/field-register-control/createFieldValueChanged';
import { createLabelableId } from '../../internals/labelable-provider/createLabelableId';
import {
  SelectStore,
  createSelectStoreContext,
  selectors,
  type SelectItems,
  type SelectPositionerSource,
} from '../store';
import {
  createChangeEventDetails,
  type BaseUIChangeEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { FOCUSABLE_POPUP_PROPS } from '../../utils/popups/popupStoreUtils';
import { useFormContext } from '../../internals/form-context/FormContext';
import { stringifyAsLabel, stringifyAsValue } from '../../internals/resolveValueLabel';
import {
  defaultItemEquality,
  findSelectionIndex,
  isSelectedValueDirty,
} from '../../internals/itemEquality';
import { getMaxScrollOffset, normalizeScrollOffset } from '../../utils/scrollEdges';
import { mergeProps } from '../../merge-props/mergeProps';
import { NOOP } from '../../internals/noop';
import { getHiddenInputType } from '../../internals/getHiddenInputType';
import { createPopupRoot, type ActionsRef } from '../../utils/popups/popupRoot';
import { createInitialPopupStoreState } from '../../utils/popups/store';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import { renderElement } from '../../internals/renderElement';
import type { HTMLProps } from '../../internals/types';

/**
 * Groups all parts of the select.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectRoot<Value, Multiple extends boolean | undefined = false>(
  props: SelectRoot.Props<Value, Multiple>,
): JSX.Element {
  const form = useFormContext();
  const field = useFieldRootContext();
  const { validation } = field;

  const generatedId = createLabelableId({ id: () => props.id });

  const disabled = () => (field.disabled() ?? false) || (props.disabled ?? false);
  const readOnly = () => props.readOnly ?? false;
  const required = () => props.required ?? false;
  const modal = () => props.modal ?? true;
  const multiple = () => (props.multiple ?? false) as boolean;
  const highlightItemOnHover = () => props.highlightItemOnHover ?? true;
  const name = () => field.name() ?? props.name;
  const isItemEqualToValue = (): ((itemValue: any, value: any) => boolean) =>
    (props.isItemEqualToValue as ((itemValue: any, value: any) => boolean) | undefined) ??
    defaultItemEquality;

  const [value, setValueUnwrapped] = createControllableSignal<any>({
    value: () => props.value,
    // `default*` props are initial values by contract: read once.
    defaultValue: () =>
      props.multiple ? (props.defaultValue ?? EMPTY_ARRAY) : (props.defaultValue ?? null),
  });

  // Calls `onOpenChange` for every open change that isn't ignored, then applies the select's own
  // handling of an accepted change before the store commits it.
  function handleOpenChange(nextOpen: boolean, eventDetails: SelectRoot.OpenChangeEventDetails) {
    untrack(() => props.onOpenChange)?.(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    if (
      !nextOpen &&
      (eventDetails.reason === REASONS.focusOut || eventDetails.reason === REASONS.outsidePress)
    ) {
      field.setTouched(true);
      field.setFocused(false);

      if (untrack(field.validationMode) === 'onBlur') {
        validation.commit(untrack(value));
      }
    }
  }

  const { store, open } = createPopupRoot(
    {
      get open() {
        return props.open;
      },
      get defaultOpen() {
        return props.defaultOpen;
      },
      onOpenChange: handleOpenChange,
      get onOpenChangeComplete() {
        return props.onOpenChangeComplete;
      },
      get actionsRef() {
        return props.actionsRef;
      },
    },
    (initialState, defaultPopupId) =>
      new SelectStore(
        {
          ...createInitialPopupStoreState(defaultPopupId),
          ...initialState,
          id: undefined,
          labelId: undefined,
          modal: true,
          selectionMode: 'single',
          disabled: false,
          readOnly: false,
          required: false,
          highlightItemOnHover: true,
          itemToStringLabel: undefined,
          itemToStringValue: undefined,
          isItemEqualToValue: defaultItemEquality,
          selectedValue: null,
          items: undefined,
          forceMounted: false,
          openMethod: null,
          activeIndex: null,
          selectedIndex: null,
          triggerElement: null,
          listElement: null,
          popupSide: null,
          scrollUpArrowVisible: false,
          scrollDownArrowVisible: false,
          hasScrollArrows: false,
        },
        createSelectStoreContext(untrack(value)),
        selectors,
      ),
  );

  // The interaction type that opened the popup most recently. It is kept once the popup closes,
  // so the closing popup keeps the presentation it opened with.
  const [openMethod, setOpenMethod] = createSignal<InteractionType | null>(null, {
    name: 'SelectRoot.openMethod',
  });
  const interactionTypeProps = createOpenMethodTriggerProps(open, setOpenMethod);

  // The store reads every bound value whenever it's written, including from ref callbacks, where
  // reading a prop compiled to a lazy memo (e.g. a ternary) can't create it: read them in memos
  // created here.
  const bindMemo = <Key extends Parameters<typeof store.bind>[0]>(
    key: Key,
    accessor: () => any,
  ) => store.bind(key, createMemo(accessor) as any);
  bindMemo('id', generatedId);
  bindMemo('modal', modal);
  bindMemo('selectionMode', () => (multiple() ? 'multiple' : 'single'));
  bindMemo('disabled', disabled);
  bindMemo('readOnly', readOnly);
  bindMemo('required', required);
  bindMemo('highlightItemOnHover', highlightItemOnHover);
  bindMemo('selectedValue', value);
  bindMemo('items', () => props.items as SelectItems);
  bindMemo('itemToStringLabel', () => props.itemToStringLabel as any);
  bindMemo('itemToStringValue', () => props.itemToStringValue as any);
  bindMemo('isItemEqualToValue', isItemEqualToValue);
  store.bind('openMethod', openMethod);

  const serializedValue = createMemo(() => {
    // In multiple mode the shared input is nameless; per-value entries are submitted via
    // the extra hidden inputs. Its value is therefore irrelevant, and passing the whole array to
    // `stringifyAsValue` would invoke a user `itemToStringValue` with an array it doesn't expect.
    if (multiple()) {
      return '';
    }
    return stringifyAsValue(value(), props.itemToStringValue as any);
  });

  const fieldStringValue = () => {
    const currentValue = value();
    const itemToStringValue = props.itemToStringValue as ((item: any) => string) | undefined;
    if (multiple() && Array.isArray(currentValue)) {
      return currentValue.map((v) => stringifyAsValue(v, itemToStringValue));
    }
    return stringifyAsValue(currentValue, itemToStringValue);
  };

  // Mirror the `hasSelectedValue` store selector so the Field's filled state agrees with the
  // trigger/value placeholder semantics (a value serializing to `''` counts as empty).
  const hasSelectedValue = createMemo(
    () => {
      const currentValue = value();
      return multiple()
        ? Array.isArray(currentValue) && currentValue.length > 0
        : currentValue != null && serializedValue() !== '';
    },
    { name: 'SelectRoot.hasSelectedValue' },
  );

  createRegisterFieldControl({
    controlRef: {
      get current() {
        return store.state.triggerElement;
      },
      set current(_value) {
        // The trigger registers itself in the store.
      },
    },
    id: generatedId,
    value,
    getValue: () => untrack(fieldStringValue),
    enabled: () => !disabled(),
    name: () => props.name,
    dirty: () =>
      isSelectedValueDirty(value(), field.validityData().initialValue, isItemEqualToValue()),
    filled: hasSelectedValue,
  });

  createFieldValueChanged(value, (currentValue) => {
    form.clearErrors(name());
    validation.change(currentValue);
  });

  // The mounted positioner, which publishes the rendered item values and the popup side.
  const [positioner, setPositioner] = createSignal<SelectPositionerSource | null>(null, {
    name: 'SelectRoot.positioner',
  });
  const itemValues = () => positioner()?.itemValues() ?? EMPTY_ARRAY;
  store.bind('popupSide', () => positioner()?.side() ?? null);

  // The value the selected index points at. The open popup keeps the index it opened with: in
  // multiple mode the value changes while items are toggled, and moving the index would move the
  // highlight with it.
  const anchorValue = createMemo<{ readonly value: unknown }>(
    (previous) => (previous !== undefined && open() ? previous : { value: value() }),
    { name: 'SelectRoot.anchorValue', equals: (a, b) => Object.is(a.value, b.value) },
  );

  // The index of the selected item (the first one in list order in multiple mode), or `null`.
  const selectedIndex = createMemo(
    () =>
      findSelectionIndex(itemValues(), anchorValue().value, isItemEqualToValue(), multiple()),
    { name: 'SelectRoot.selectedIndex' },
  );
  store.bind('selectedIndex', selectedIndex);

  function setValue(nextValue: any, eventDetails: SelectRoot.ChangeEventDetails) {
    untrack(() => props.onValueChange)?.(nextValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValueUnwrapped(nextValue);
  }

  function handleScrollArrowVisibility(scroller: HTMLElement) {
    const maxScrollTop = getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
    const scrollTop = normalizeScrollOffset(scroller.scrollTop, maxScrollTop);
    const shouldShowUp = scrollTop > 0;
    const shouldShowDown = scrollTop < maxScrollTop;

    store.update({
      scrollUpArrowVisible: shouldShowUp,
      scrollDownArrowVisible: shouldShowDown,
    });
  }

  // `readOnly` locks the value, not the interaction: the popup can be opened and browsed so the
  // user can see the available options and which one is selected. Committing a value is blocked
  // separately in `SelectItem` and in the hidden input's autofill handler.
  const click = createClick(store, {
    get enabled() {
      return !disabled();
    },
    event: 'mousedown',
  });

  const dismiss = createDismiss(store);

  const listNavigation = createListNavigation(store, {
    get enabled() {
      return !disabled();
    },
    listRef: store.context.listRef,
    get activeIndex() {
      return store.select('activeIndex');
    },
    get selectedIndex() {
      return store.select('selectedIndex');
    },
    disabledIndices: EMPTY_ARRAY,
    onNavigate(nextActiveIndex) {
      // Retain the highlight while transitioning out.
      if (nextActiveIndex === null && !untrack(open)) {
        return;
      }

      store.set('activeIndex', nextActiveIndex);
    },
    get focusItemOnHover() {
      return highlightItemOnHover();
    },
  });

  const typeahead = createTypeahead(store, {
    // Typeahead on an open popup only moves the highlight, so it remains available while
    // `readOnly`. The closed-trigger variant commits a value instead, so it doesn't.
    get enabled() {
      return !disabled() && (open() || (!readOnly() && !multiple()));
    },
    listRef: store.context.labelsRef,
    get activeIndex() {
      return store.select('activeIndex');
    },
    get selectedIndex() {
      return store.select('selectedIndex');
    },
    // Skip disabled items while matching so typeahead advances to the next selectable item
    // (a click can never select a disabled item and native `<select>` skips them too).
    disabledIndices: (index: number) => isElementDisabled(store.context.listRef.current[index]),
    onMatch(index) {
      if (untrack(open)) {
        store.set('activeIndex', index);
      } else {
        setValue(store.context.valuesRef.current[index], createChangeEventDetails(REASONS.none));
      }
    },
    onTyping(typing) {
      store.context.typingRef.current = typing;
    },
  });

  // `Select.Trigger` applies the id itself from the store, so it's deliberately not merged here.
  const mergedTriggerProps = mergeProps<HTMLProps>(
    typeahead.reference,
    listNavigation.reference,
    dismiss.reference,
    click.reference,
    interactionTypeProps as HTMLProps,
  );

  const popupProps = mergeProps<HTMLProps>(
    FOCUSABLE_POPUP_PROPS,
    typeahead.floating,
    listNavigation.floating,
    dismiss.floating,
  );

  store.context.itemProps = listNavigation.item;
  store.context.registerPositioner = (source) => {
    setPositioner(() => source);
    return () => {
      setPositioner((current) => (current === source ? null : current));
    };
  };
  store.context.isItemEqualToValue = (itemValue, selectedValue) =>
    untrack(isItemEqualToValue)(itemValue, selectedValue);
  store.context.setValue = setValue;
  store.context.handleScrollArrowVisibility = handleScrollArrowVisibility;

  store.update({
    popupProps,
    activeTriggerProps: mergedTriggerProps,
  });

  const hiddenInputName = () => (multiple() ? undefined : name());

  const hiddenInputValues = createMemo(() => {
    const currentValue = value();
    if (!multiple() || !Array.isArray(currentValue) || !name()) {
      return EMPTY_ARRAY as string[];
    }
    const itemToStringValue = props.itemToStringValue as ((item: any) => string) | undefined;
    return currentValue.map((v) => stringifyAsValue(v, itemToStringValue));
  });

  let inputElement: HTMLInputElement | null = null;
  onCleanup(() => {
    if (inputElement && validation.inputRef.current === inputElement) {
      validation.inputRef.current = null;
    }
  });

  const inputProps = validation.getValidationProps(disabled, {
    onFocus() {
      // Move focus to the trigger element when the hidden input is focused.
      store.state.triggerElement?.focus({
        // Supported in Chrome from 144 (January 2026)
        focusVisible: true,
      } as FocusOptions);
    },
    // Handle browser autofill.
    onChange(event: Event & { currentTarget: HTMLInputElement }) {
      const input = event.currentTarget;
      // The input mirrors the select's value: undo a write the select doesn't accept (React
      // restores controlled inputs after `onChange`; the binding here only writes changes).
      const restoreInputValue = () => {
        const serialized = untrack(serializedValue);
        if (input.value !== serialized) {
          input.value = serialized;
        }
      };

      if (event.defaultPrevented || untrack(disabled) || untrack(readOnly)) {
        restoreInputValue();
        return;
      }

      const nextValue = input.value;
      const details = createChangeEventDetails(REASONS.none, event);

      function handleChange() {
        if (untrack(multiple)) {
          // Browser autofill only writes a single scalar value.
          return;
        }

        const itemToStringValue = untrack(() => props.itemToStringValue) as
          | ((item: any) => string)
          | undefined;
        const itemToStringLabel = untrack(() => props.itemToStringLabel) as
          | ((item: any) => string)
          | undefined;
        const values = store.context.valuesRef.current;
        const labels = store.context.labelsRef.current;

        // Preserve the original serialized matching, then fall back to rendered text,
        // which browsers can autofill for primitive values like
        // `value="US">United States`.
        const nextValueLower = nextValue.toLowerCase();
        let matchingIndex = values.findIndex(
          (candidate) =>
            stringifyAsValue(candidate, itemToStringValue).toLowerCase() === nextValueLower ||
            stringifyAsLabel(candidate, itemToStringLabel).toLowerCase() === nextValueLower,
        );

        if (matchingIndex === -1) {
          matchingIndex = values.findIndex((_, index) => {
            const renderedLabel = labels[index];
            return renderedLabel != null && renderedLabel.toLowerCase() === nextValueLower;
          });
        }

        const matchingValue = values[matchingIndex];
        if (matchingValue != null) {
          // `setValue` may be canceled by `onValueChange`; the field derives `dirty` from the
          // value and runs validation only when the value actually changes.
          setValue(matchingValue, details);
        }
      }

      store.set('forceMounted', true);
      // Force-mounting the items registers them over several microtasks (mount, then list
      // ordering): match once they are all registered.
      setTimeout(() => {
        handleChange();
        flush();
        restoreInputValue();
      });
    },
  });

  const HiddenInput = () =>
    renderElement(
      'input',
      {},
      {
        props: [
          inputProps,
          {
            get id() {
              const id = generatedId();
              return id && hiddenInputName() == null ? `${id}-hidden-input` : undefined;
            },
            get form() {
              return props.form;
            },
            get name() {
              return hiddenInputName();
            },
            get type() {
              return getHiddenInputType(
                field.setValidityData !== NOOP,
                name(),
                props.autoComplete,
                required(),
                props.inputRef,
              );
            },
            get autocomplete() {
              return props.autoComplete;
            },
            get value() {
              return serializedValue();
            },
            get disabled() {
              return disabled();
            },
            get required() {
              return required() && !(multiple() && hasSelectedValue());
            },
            get readonly() {
              return readOnly();
            },
            get style() {
              return name() ? visuallyHiddenInput : visuallyHiddenInputPinned;
            },
            onInvalid: handleHiddenInputInvalid,
            tabindex: -1,
            'aria-hidden': 'true',
            ref(element: HTMLInputElement) {
              inputElement = element;
              validation.inputRef.current = element;
              applyRef(untrack(() => props.inputRef), element);
            },
          },
        ],
      },
    );

  return (
    <SelectRootContext value={store}>
      {props.children}
      <HiddenInput />
      <For each={hiddenInputValues()}>
        {(serialized) => (
          <input
            type="hidden"
            form={props.form}
            name={name()}
            value={serialized}
            disabled={disabled()}
          />
        )}
      </For>
    </SelectRootContext>
  );
}

type SelectInputValue<Value, Multiple extends boolean | undefined> = Multiple extends true
  ? readonly Value[]
  : Value;

type SelectOutputValue<Value, Multiple extends boolean | undefined> = Multiple extends true
  ? Value[]
  : Value;

export interface SelectRootProps<Value, Multiple extends boolean | undefined = false> {
  children?: JSX.Element;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?: RefProp<HTMLInputElement>;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the select is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Provides a hint to the browser for autofill.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
   */
  autoComplete?: string | undefined;
  /**
   * The id of the Select.
   */
  id?: string | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to choose a different option from the select popup.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether multiple items can be selected.
   * @default false
   */
  multiple?: Multiple | undefined;
  /**
   * Whether moving the pointer over items should highlight them.
   * Disabling this prop allows CSS `:hover` to be differentiated from the `:focus` (`data-highlighted`) state.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * Whether the select popup is initially open.
   *
   * To render a controlled select popup, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Event handler called when the select popup is opened or closed.
   */
  onOpenChange?:
    | ((open: boolean, eventDetails: SelectRootOpenChangeEventDetails) => void)
    | undefined;
  /**
   * Event handler called after any animations complete when the select popup is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether the select popup is currently open.
   */
  open?: boolean | undefined;
  /**
   * Determines if the select enters a modal state when open.
   * - `true`: user interaction is limited to the select: document page scroll is locked and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   *
   * On touch devices, a `true` modal blocks outside taps but leaves the page scrollable unless the popup spans nearly the full viewport width, matching native iOS behavior.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * A ref to imperative actions: a ref object (`{ current: null }`) or a callback receiving them (and `null` on unmount).
   * - `unmount`: Ends the closing phase of the select after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `onOpenChange` first, otherwise the select completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   * - `close`: Closes the select imperatively when called.
   */
  actionsRef?: ActionsRef<SelectRootActions> | undefined;
  /**
   * Data structure of the items rendered in the select popup.
   * When specified, `<Select.Value>` renders the label of the selected item instead of the raw value.
   * @example
   * ```tsx
   * const items = {
   *   sans: 'Sans-serif',
   *   serif: 'Serif',
   *   mono: 'Monospace',
   *   cursive: 'Cursive',
   * };
   * <Select.Root items={items} />
   * ```
   */
  items?: SelectItems;
  /**
   * When the item values are objects (`<Select.Item value={object}>`), this function converts the object value to a string representation for display in the trigger.
   * If the shape of the object is `{ value, label }`, the label will be used automatically without needing to specify this prop.
   */
  itemToStringLabel?: ((itemValue: Value) => string) | undefined;
  /**
   * When the item values are objects (`<Select.Item value={object}>`), this function converts the object value to a string representation for form submission.
   * If the shape of the object is `{ value, label }`, the value will be used automatically without needing to specify this prop.
   */
  itemToStringValue?: ((itemValue: Value) => string) | undefined;
  /**
   * Custom comparison logic used to determine if a select item value matches the current selected value. Useful when item values are objects without matching referentially.
   * Defaults to `Object.is` comparison.
   */
  isItemEqualToValue?: ((itemValue: Value, value: Value) => boolean) | undefined;
  /**
   * The uncontrolled value of the select when it's initially rendered.
   *
   * To render a controlled select, use the `value` prop instead.
   */
  defaultValue?: SelectInputValue<Value, Multiple> | null | undefined;
  /**
   * The value of the select. Use when controlled.
   */
  value?: SelectInputValue<Value, Multiple> | null | undefined;
  /**
   * Event handler called when the value of the select changes.
   */
  onValueChange?:
    | ((
        value: SelectOutputValue<Value, Multiple> | (Multiple extends true ? never : null),
        eventDetails: SelectRootChangeEventDetails,
      ) => void)
    | undefined;
}

export interface SelectRootState {}

export interface SelectRootActions {
  unmount: () => void;
  close: () => void;
}

export type SelectRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.windowResize
  | typeof REASONS.itemPress
  | typeof REASONS.focusOut
  | typeof REASONS.listNavigation
  | typeof REASONS.cancelOpen
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type SelectRootOpenChangeEventDetails = SelectRootChangeEventDetails & {
  /** Prevents the popup from unmounting until the `unmount` action is called. */
  preventUnmountOnClose: () => void;
};

export type SelectRootChangeEventDetails = BaseUIChangeEventDetails<SelectRootChangeEventReason>;

export namespace SelectRoot {
  export type Props<Value, Multiple extends boolean | undefined = false> = SelectRootProps<
    Value,
    Multiple
  >;
  export type State = SelectRootState;
  export type Actions = SelectRootActions;
  export type ChangeEventReason = SelectRootChangeEventReason;
  export type ChangeEventDetails = SelectRootChangeEventDetails;
  export type OpenChangeEventDetails = SelectRootOpenChangeEventDetails;
}
