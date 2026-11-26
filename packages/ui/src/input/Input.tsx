import type { BaseUIComponentProps } from '../internals/types';
import {
  FieldControl,
  type FieldControlChangeEventDetails,
  type FieldControlChangeEventReason,
  type FieldControlProps,
  type FieldControlState,
} from '../field/control/FieldControl';

/**
 * A native input element that automatically works with [Field](https://base.egoist.dev/components/field).
 * Renders an `<input>` element.
 *
 * Documentation: [Solid Base Input](https://base.egoist.dev/components/input)
 */
export function Input(props: Input.Props) {
  return <FieldControl {...props} />;
}

export interface InputProps
  extends Omit<
    BaseUIComponentProps<'input', InputState>,
    'id' | 'name' | 'disabled' | 'value' | 'defaultValue'
  > {
  /**
   * The id of the input. A generated id is used by default.
   */
  id?: string | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Callback fired when the `value` changes. Use when controlled.
   */
  onValueChange?: ((value: string, eventDetails: Input.ChangeEventDetails) => void) | undefined;
  /**
   * The default value of the input. Use when uncontrolled.
   */
  defaultValue?: FieldControlProps['defaultValue'] | undefined;
  /**
   * The value of the input. Use when controlled.
   */
  value?: FieldControlProps['value'] | undefined;
}

export interface InputState extends FieldControlState {}

export type InputChangeEventReason = FieldControlChangeEventReason;
export type InputChangeEventDetails = FieldControlChangeEventDetails;

export namespace Input {
  export type Props = InputProps;
  export type State = InputState;
  export type ChangeEventReason = InputChangeEventReason;
  export type ChangeEventDetails = InputChangeEventDetails;
}
