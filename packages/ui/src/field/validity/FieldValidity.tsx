import { createMemo } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { getCombinedFieldValidityData } from '../utils/getCombinedFieldValidityData';
import type { FieldValidityData } from '../root/FieldRoot';
import {
  createTransitionStatus,
  type TransitionStatus,
} from '../../internals/transitionStatus';

/**
 * Used to display a custom message based on the field's validity.
 * Requires `children` to be a function that accepts field validity state as an argument.
 *
 * Documentation: [Solid Base Field](https://base.egoist.dev/components/field)
 */
export function FieldValidity(props: FieldValidity.Props) {
  const field = useFieldRootContext(false);

  const combined = createMemo(() =>
    getCombinedFieldValidityData(field.validityData(), field.invalid()),
  );
  const isInvalid = () => combined().state.valid === false;
  const { transitionStatus } = createTransitionStatus(isInvalid);

  // A live object: read its properties in JSX (or a tracking scope) to stay up to date.
  const state: FieldValidityState = {
    get validity() {
      return combined().state;
    },
    get errors() {
      return combined().errors;
    },
    get error() {
      return combined().error;
    },
    get value() {
      return combined().value;
    },
    get initialValue() {
      return combined().initialValue;
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  return <>{props.children(state)}</>;
}

export interface FieldValidityState extends Omit<FieldValidityData, 'state'> {
  /**
   * The validity state.
   */
  validity: FieldValidityData['state'];
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface FieldValidityProps {
  /**
   * A function that accepts the field validity state as an argument.
   * The state is a live object: read its properties in JSX to stay up to date.
   *
   * ```jsx
   * <Field.Validity>
   *   {(validity) => <div>{validity.error}</div>}
   * </Field.Validity>
   * ```
   */
  children: (state: FieldValidityState) => JSX.Element;
}

export namespace FieldValidity {
  export type State = FieldValidityState;
  export type Props = FieldValidityProps;
}
