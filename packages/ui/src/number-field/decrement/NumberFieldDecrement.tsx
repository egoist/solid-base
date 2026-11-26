import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { createNumberFieldStepperButton } from '../root/createNumberFieldStepperButton';
import type { NumberFieldRootState } from '../root/NumberFieldRoot';

/**
 * A stepper button that decreases the field value when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Solid Base Number Field](https://base.egoist.dev/components/number-field)
 */
export function NumberFieldDecrement(componentProps: NumberFieldDecrement.Props) {
  return createNumberFieldStepperButton(componentProps, false);
}

export interface NumberFieldDecrementState extends NumberFieldRootState {}

export interface NumberFieldDecrementProps
  extends NativeButtonProps, BaseUIComponentProps<'button', NumberFieldDecrementState> {}

export namespace NumberFieldDecrement {
  export type State = NumberFieldDecrementState;
  export type Props = NumberFieldDecrementProps;
}
