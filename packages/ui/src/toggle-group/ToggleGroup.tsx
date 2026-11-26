import { omit } from 'solid-js';
import { EMPTY_ARRAY } from '@egoist/solid-base-utils/empty';
import { createControllableSignal } from '@egoist/solid-base-utils/controlled';
import { renderElement } from '../internals/renderElement';
import type { BaseUIComponentProps, HTMLProps, Orientation } from '../internals/types';
import { CompositeRoot } from '../internals/composite/root/CompositeRoot';
import { useToolbarRootContext } from '../toolbar/root/ToolbarRootContext';
import { useToolbarGroupContext } from '../toolbar/group/ToolbarGroupContext';
import { ToggleGroupContext, type ToggleGroupContextValue } from './ToggleGroupContext';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { REASONS } from '../internals/reasons';

/**
 * Provides a shared state to a series of toggle buttons.
 *
 * Documentation: [Solid Base Toggle Group](https://base.egoist.dev/components/toggle-group)
 */
export function ToggleGroup<Value extends string>(componentProps: ToggleGroup.Props<Value>) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'defaultValue',
    'disabled',
    'loopFocus',
    'onValueChange',
    'orientation',
    'multiple',
    'value',
  );

  const toolbarContext = useToolbarRootContext(true);
  const toolbarGroupContext = useToolbarGroupContext();

  const disabled = () =>
    (toolbarContext?.disabled ?? false) ||
    (toolbarGroupContext?.disabled ?? false) ||
    (componentProps.disabled ?? false);
  const orientation = () => componentProps.orientation ?? 'horizontal';
  const multiple = () => componentProps.multiple ?? false;

  const [groupValue, setValueState] = createControllableSignal<readonly Value[]>({
    value: () => componentProps.value,
    defaultValue: () => componentProps.defaultValue ?? (EMPTY_ARRAY as readonly Value[]),
  });

  function setGroupValue(
    newValue: Value,
    nextPressed: boolean,
    eventDetails: BaseUIChangeEventDetails<typeof REASONS.none>,
  ) {
    const currentValue = groupValue();
    let newGroupValue: Value[];
    if (multiple()) {
      newGroupValue = currentValue.slice();
      if (nextPressed) {
        newGroupValue.push(newValue);
      } else {
        newGroupValue.splice(currentValue.indexOf(newValue), 1);
      }
    } else {
      newGroupValue = nextPressed ? [newValue] : [];
    }

    componentProps.onValueChange?.(newGroupValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValueState(newGroupValue);
  }

  const state: ToggleGroupState = {
    get disabled() {
      return disabled();
    },
    get multiple() {
      return multiple();
    },
    get orientation() {
      return orientation();
    },
  };

  const contextValue: ToggleGroupContextValue<Value> = {
    get disabled() {
      return disabled();
    },
    setGroupValue,
    get value() {
      return groupValue();
    },
    get isValueInitialized() {
      // Use the raw props to distinguish an omitted value from the empty default.
      return componentProps.value !== undefined || componentProps.defaultValue !== undefined;
    },
  };

  const defaultProps: HTMLProps = {
    role: 'group',
  };

  return (
    <ToggleGroupContext value={contextValue}>
      {toolbarContext
        ? renderElement('div', componentProps, {
            state,
            props: [defaultProps, elementProps],
          })
        : (
            <CompositeRoot
              render={componentProps.render}
              class={componentProps.class}
              style={componentProps.style}
              state={state}
              props={[defaultProps, elementProps]}
              loopFocus={componentProps.loopFocus ?? true}
              enableHomeAndEndKeys
              orientation={orientation()}
            />
          )}
    </ToggleGroupContext>
  );
}

export interface ToggleGroupState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * When `false` only one item in the group can be pressed. If any item in
   * the group becomes pressed, the others will become unpressed.
   * When `true` multiple items can be pressed.
   * @default false
   */
  multiple: boolean;
  /**
   * The orientation of the toggle group.
   */
  orientation: Orientation;
}

export interface ToggleGroupProps<Value extends string = string>
  extends Omit<BaseUIComponentProps<'div', ToggleGroupState>, 'defaultValue'> {
  /**
   * The pressed state of the toggle group represented by an array of
   * the values of all pressed toggle buttons.
   * This is the controlled counterpart of `defaultValue`.
   */
  value?: readonly Value[] | undefined;
  /**
   * The pressed state of the toggle group represented by an array of
   * the values of all pressed toggle buttons.
   * This is the uncontrolled counterpart of `value`.
   */
  defaultValue?: readonly Value[] | undefined;
  /**
   * Callback fired when the pressed states of the toggle group changes.
   */
  onValueChange?:
    | ((groupValue: Value[], eventDetails: ToggleGroup.ChangeEventDetails) => void)
    | undefined;
  /**
   * Whether the toggle group should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * When `false` only one item in the group can be pressed. If any item in
   * the group becomes pressed, the others will become unpressed.
   * When `true` multiple items can be pressed.
   * @default false
   */
  multiple?: boolean | undefined;
}

export type ToggleGroupChangeEventReason = typeof REASONS.none;

export type ToggleGroupChangeEventDetails = BaseUIChangeEventDetails<ToggleGroup.ChangeEventReason>;

export namespace ToggleGroup {
  export type State = ToggleGroupState;
  export type Props<Value extends string = string> = ToggleGroupProps<Value>;
  export type ChangeEventReason = ToggleGroupChangeEventReason;
  export type ChangeEventDetails = ToggleGroupChangeEventDetails;
}
