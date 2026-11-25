import { createEffect, omit } from 'solid-js';
import type { FieldRootState } from '../root/FieldRoot';
import {
  extendFieldRootState,
  useFieldRootContext,
} from '../../internals/field-root-context/FieldRootContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { BaseUIComponentProps } from '../../internals/types';
import { createBaseUiId } from '../../internals/baseUiId';
import { renderElement } from '../../internals/renderElement';
import { useFieldItemContext } from '../item/FieldItemContext';

/**
 * A paragraph with additional information about the field.
 * Renders a `<p>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldDescription(componentProps: FieldDescription.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id');

  const id = createBaseUiId(() => componentProps.id);

  const field = useFieldRootContext(false);
  const fieldItem = useFieldItemContext();
  const { setMessageIds } = useLabelableContext();

  const state: FieldDescriptionState = extendFieldRootState(field.state, {
    get disabled() {
      return (field.disabled() ?? false) || fieldItem.disabled();
    },
  });

  createEffect(id, (currentId) => {
    if (!currentId) {
      return undefined;
    }

    setMessageIds((ids) => ids.concat(currentId));

    return () => {
      setMessageIds((ids) => ids.filter((item) => item !== currentId));
    };
  });

  return renderElement('p', componentProps, {
    state,
    props: [
      {
        get id() {
          return id();
        },
      },
      elementProps,
    ],
    stateAttributesMapping: fieldValidityMapping,
  });
}

export interface FieldDescriptionState extends FieldRootState {}

export interface FieldDescriptionProps
  extends Omit<BaseUIComponentProps<'p', FieldDescriptionState>, 'id'> {
  /**
   * The id of the element. A generated id is used by default.
   */
  id?: string | undefined;
}

export namespace FieldDescription {
  export type State = FieldDescriptionState;
  export type Props = FieldDescriptionProps;
}
