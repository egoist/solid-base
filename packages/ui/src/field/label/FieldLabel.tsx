import { createEffect, omit } from 'solid-js';
import { isDev } from '@solidjs/web';
import { error } from '@egoist/solid-base-utils/error';
import type { FieldRootState } from '../root/FieldRoot';
import {
  extendFieldRootState,
  useFieldRootContext,
} from '../../internals/field-root-context/FieldRootContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { createLabel } from '../../internals/labelable-provider/createLabel';
import { useFieldItemContext } from '../item/FieldItemContext';

/**
 * An accessible label that is automatically associated with the field control.
 * Renders a `<label>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldLabel(componentProps: FieldLabel.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id', 'nativeLabel');

  const field = useFieldRootContext(false);
  const fieldItem = useFieldItemContext();
  const { labelId } = useLabelableContext();

  const nativeLabel = () => componentProps.nativeLabel ?? true;

  const state: FieldLabelState = extendFieldRootState(field.state, {
    get disabled() {
      return (field.disabled() ?? false) || fieldItem.disabled();
    },
  });

  let labelElement: HTMLElement | undefined;

  const labelProps = createLabel({
    id: () => labelId() ?? componentProps.id,
    native: nativeLabel,
  });

  if (isDev) {
    createEffect(nativeLabel, (native) => {
      if (!labelElement) {
        return;
      }

      const isLabelTag = labelElement.tagName === 'LABEL';

      if (native) {
        if (!isLabelTag) {
          error(
            '<Field.Label> expected a <label> element because the `nativeLabel` prop is true. ' +
              'Rendering a non-<label> disables native label association, so `for` will not ' +
              'work. Use a real <label> in the `render` prop, or set `nativeLabel` to `false`.',
          );
        }
      } else if (isLabelTag) {
        error(
          '<Field.Label> expected a non-<label> element because the `nativeLabel` prop is false. ' +
            'Rendering a <label> assumes native label behavior while Base UI treats it as ' +
            'non-native, which can cause unexpected pointer behavior. Use a non-<label> in the ' +
            '`render` prop, or set `nativeLabel` to `true`.',
        );
      }
    });
  }

  return renderElement('label', componentProps, {
    ref: (element: HTMLElement) => {
      labelElement = element;
    },
    state,
    props: [labelProps, elementProps],
    stateAttributesMapping: fieldValidityMapping,
  });
}

export interface FieldLabelState extends FieldRootState {}

export interface FieldLabelProps
  extends Omit<BaseUIComponentProps<'label', FieldLabelState>, 'id'> {
  /**
   * The id of the element. A generated id is used by default.
   */
  id?: string | undefined;
  /**
   * Whether the component renders a native `<label>` element when replacing it via the `render` prop.
   * Set to `false` if the rendered element is not a label (for example, `<div>`).
   *
   * This is useful to avoid inheriting label behaviors on `<button>` controls (such as `<Select.Trigger>` and `<Combobox.Trigger>`), including avoiding `:hover` on the button when hovering the label, and preventing clicks on the label from firing on the button.
   * @default true
   */
  nativeLabel?: boolean | undefined;
}

export namespace FieldLabel {
  export type State = FieldLabelState;
  export type Props = FieldLabelProps;
}
