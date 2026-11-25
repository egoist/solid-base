import { createMemo, For, omit, onSettled, Show, untrack } from 'solid-js';
import type { FieldRootState } from '../root/FieldRoot';
import {
  extendFieldRootState,
  useFieldRootContext,
} from '../../internals/field-root-context/FieldRootContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import { useFormContext } from '../../internals/form-context/FormContext';
import type { BaseUIComponentProps } from '../../internals/types';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { renderElement } from '../../internals/renderElement';
import { createBaseUiId } from '../../internals/baseUiId';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import {
  createTransitionStatus,
  type TransitionStatus,
} from '../../internals/transitionStatus';

const stateAttributesMapping: StateAttributesMapping<FieldErrorState> = {
  ...fieldValidityMapping,
  ...transitionStatusMapping,
};

type ErrorValue = string | string[] | null | undefined;

function FieldErrorMessage(props: { error: ErrorValue }) {
  const list = () => (Array.isArray(props.error) && props.error.length > 1 ? props.error : null);
  const text = () => (Array.isArray(props.error) ? props.error[0] : props.error);
  return (
    <Show when={list()} fallback={<>{text()}</>}>
      {(messages) => (
        <ul>
          <For each={messages()}>{(message) => <li>{message}</li>}</For>
        </ul>
      )}
    </Show>
  );
}

/**
 * An error message displayed if the field control fails validation.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldError(componentProps: FieldError.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id', 'match');

  const id = createBaseUiId(() => componentProps.id);

  const field = useFieldRootContext(false);
  const { registerMessageId } = useLabelableContext();
  const { errors } = useFormContext();

  const formError = () => {
    const name = field.name();
    const currentErrors = errors();
    return name && Object.hasOwn(currentErrors, name) ? currentErrors[name] : null;
  };
  const hasFormError = () => {
    const error = formError();
    return !!(Array.isArray(error) ? error.length : error);
  };

  const rendered = createMemo(() => {
    const match = componentProps.match;
    if (match === true) {
      return true;
    }
    if (field.state.disabled) {
      return false;
    }
    if (typeof match === 'string') {
      return Boolean(field.validityData().state[match as keyof FieldValidityState]);
    }
    return hasFormError() || field.validityData().state.valid === false;
  });

  const { mounted, transitionStatus, setMounted } = createTransitionStatus(rendered);

  // The message describes the control while it is rendered: derived, so `aria-describedby`
  // updates in the same flush as the validity.
  onSettled(() => registerMessageId(() => (rendered() ? id() : undefined)));

  const error = createMemo((): ErrorValue => {
    const data = field.validityData();
    if (typeof componentProps.match !== 'string' && hasFormError()) {
      return formError();
    }
    if (data.errors.length > 1) {
      return data.errors;
    }
    return data.error;
  });

  // Keep showing the last message while the error animates out.
  const displayedError = createMemo((previous: ErrorValue) =>
    rendered() ? error() : previous,
  );

  let errorElement: HTMLElement | null = null;

  createOpenChangeComplete({
    open: rendered,
    // Read when `rendered` changes; the element exists by then.
    element: () => errorElement,
    onComplete() {
      if (!untrack(rendered)) {
        setMounted(false);
      }
    },
  });

  const state: FieldErrorState = extendFieldRootState(field.state, {
    get transitionStatus() {
      return transitionStatus();
    },
  });

  return renderElement('div', componentProps, {
    ref: (element: HTMLElement) => {
      errorElement = element;
    },
    state,
    props: [
      {
        get id() {
          return id();
        },
        get children() {
          return <FieldErrorMessage error={displayedError()} />;
        },
      },
      elementProps,
    ],
    stateAttributesMapping,
    enabled: mounted,
  });
}

type FieldValidityState = Omit<ValidityState, 'valid'>;

export interface FieldErrorState extends FieldRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface FieldErrorProps
  extends Omit<BaseUIComponentProps<'div', FieldErrorState>, 'id'> {
  /**
   * The id of the element. A generated id is used by default.
   */
  id?: string | undefined;
  /**
   * Determines whether to show the error message according to the field's
   * [ValidityState](https://developer.mozilla.org/en-US/docs/Web/API/ValidityState).
   * Specifying `true` will always show the error message, and lets external libraries
   * control the visibility.
   */
  match?: boolean | keyof ValidityState | undefined;
}

export namespace FieldError {
  export type State = FieldErrorState;
  export type Props = FieldErrorProps;
}
