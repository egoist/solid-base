import { createSignal, untrack, type Accessor } from 'solid-js';
import { EMPTY_ARRAY } from '@egoist/solid-base-utils/empty';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { BaseUIEventReasons } from '../internals/reasons';

type ChangeEventDetails = BaseUIChangeEventDetails<BaseUIEventReasons['none']>;

/**
 * The parent checkbox logic of a `CheckboxGroup` with `allValues`.
 */
export function createCheckboxGroupParent(
  params: CreateCheckboxGroupParentParameters,
): CheckboxGroupParent {
  const allValues = () => params.allValues() ?? EMPTY_ARRAY;
  const value = params.value;

  // The last value set by a child checkbox: the "mixed" state the parent cycles back to.
  let uncontrolledState = untrack(value);
  const disabledStates = new Map<string, boolean>();

  let status: 'on' | 'off' | 'mixed' = 'mixed';

  // A `Map` rather than an object: checkbox values are consumer data, and a value like
  // `constructor` would otherwise read straight off `Object.prototype`.
  const childIds = new Map<string, readonly string[]>();
  const [childIdsVersion, setChildIdsVersion] = createSignal(0);

  function registerChildId(childValue: string, childId: string) {
    childIds.set(childValue, (childIds.get(childValue) ?? EMPTY_ARRAY).concat(childId));
    setChildIdsVersion((version) => version + 1);

    return () => {
      const nextIds = (childIds.get(childValue) ?? EMPTY_ARRAY).filter((id) => id !== childId);
      if (nextIds.length === 0) {
        childIds.delete(childValue);
      } else {
        childIds.set(childValue, nextIds);
      }
      setChildIdsVersion((version) => version + 1);
    };
  }

  const parentProps: CheckboxGroupParentProps = {
    get indeterminate() {
      const length = value().length;
      return length !== allValues().length && length > 0;
    },
    get checked() {
      return value().length === allValues().length;
    },
    // Children report their own rendered id, so a custom `id` survives and no unmounted
    // element is named.
    get 'aria-controls'() {
      childIdsVersion();
      return (
        allValues()
          .flatMap((v) => childIds.get(v) ?? EMPTY_ARRAY)
          .join(' ') || undefined
      );
    },
    onCheckedChange(_checked, eventDetails) {
      untrack(() => {
        const values = allValues();
        // None except the disabled ones that are checked, which can't be changed.
        const none = values.filter(
          (v) => disabledStates.get(v) && uncontrolledState.includes(v),
        );
        // "All" that are valid:
        // - any that aren't disabled
        // - disabled ones that are checked
        const all = values.filter(
          (v) => !disabledStates.get(v) || uncontrolledState.includes(v),
        );

        const allOnOrOff =
          uncontrolledState.length === all.length || uncontrolledState.length === 0;

        if (allOnOrOff) {
          if (value().length === all.length) {
            params.onValueChange(none, eventDetails);
          } else {
            params.onValueChange(all, eventDetails);
          }
          return;
        }

        let nextStatus: 'on' | 'off' | 'mixed' = 'mixed';
        let nextValue = uncontrolledState;

        if (status === 'mixed') {
          nextStatus = 'on';
          nextValue = all;
        } else if (status === 'on') {
          nextStatus = 'off';
          nextValue = none;
        }

        params.onValueChange(nextValue, eventDetails);

        if (!eventDetails.isCanceled) {
          status = nextStatus;
        }
      });
    },
  };

  function getChildProps(childValue: string): CheckboxGroupChildProps {
    return {
      get checked() {
        return value().includes(childValue);
      },
      onCheckedChange(nextChecked, eventDetails) {
        const newValue = untrack(value).slice();
        if (nextChecked) {
          newValue.push(childValue);
        } else {
          newValue.splice(newValue.indexOf(childValue), 1);
        }

        params.onValueChange(newValue, eventDetails);

        if (!eventDetails.isCanceled) {
          uncontrolledState = newValue;
          status = 'mixed';
        }
      },
    };
  }

  return {
    getParentProps: () => parentProps,
    getChildProps,
    registerChildId,
    disabledStates,
  };
}

export interface CreateCheckboxGroupParentParameters {
  allValues: Accessor<string[] | undefined>;
  value: Accessor<string[]>;
  onValueChange: (value: string[], eventDetails: ChangeEventDetails) => void;
}

export interface CheckboxGroupParentProps {
  indeterminate: boolean;
  checked: boolean;
  'aria-controls': string | undefined;
  onCheckedChange: (checked: boolean, eventDetails: ChangeEventDetails) => void;
}

export interface CheckboxGroupChildProps {
  indeterminate?: undefined;
  'aria-controls'?: undefined;
  checked: boolean;
  onCheckedChange: (checked: boolean, eventDetails: ChangeEventDetails) => void;
}

export interface CheckboxGroupParent {
  /**
   * The disabled state of each child checkbox, by value.
   */
  disabledStates: Map<string, boolean>;
  /**
   * Reports the `id` of the element a child checkbox exposes.
   */
  registerChildId: (value: string, id: string) => () => void;
  /**
   * Returns the (live) props of the parent checkbox.
   */
  getParentProps: () => CheckboxGroupParentProps;
  /**
   * Returns the (live) props of the child checkbox with the given value.
   */
  getChildProps: (value: string) => CheckboxGroupChildProps;
}
