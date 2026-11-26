import { omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { contains } from '@egoist/solid-base-utils/shadowDom';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import type { FieldRoot } from '../../field/root/FieldRoot';
import {
  extendFieldRootState,
  useFieldRootContext,
} from '../../internals/field-root-context/FieldRootContext';
import type { Side } from '../../internals/anchorPositioning';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { triggerStateAttributesMapping } from '../utils/stateAttributesMapping';
import { handleInputPress } from '../utils/handleInputPress';
import { useListEmpty, usePopupSide } from '../utils/parts';

/**
 * A wrapper for the input and its associated controls.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Combobox](https://base.egoist.dev/components/combobox)
 */
export function ComboboxInputGroup(componentProps: ComboboxInputGroup.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const field = useFieldRootContext();
  const store = useComboboxRootContext();

  const popupSide = usePopupSide(store);
  const listEmpty = useListEmpty();

  const state: ComboboxInputGroupState = extendFieldRootState(field.state, {
    get open() {
      return store.select('open');
    },
    get disabled() {
      return store.select('disabled');
    },
    get readOnly() {
      return store.select('readOnly');
    },
    get popupSide() {
      return popupSide();
    },
    get listEmpty() {
      return listEmpty();
    },
    get placeholder() {
      return store.select('selectionMode') === 'none' ? false : !store.select('hasSelectedValue');
    },
  });

  let element: HTMLDivElement | null = null;
  onCleanup(() => {
    if (element && store.state.inputGroupElement === element) {
      store.set('inputGroupElement', null);
    }
  });

  return renderElement('div', componentProps, {
    ref: (el: HTMLDivElement) => {
      element = el;
      store.set('inputGroupElement', el);
    },
    props: [
      {
        role: 'group',
        onMouseDown(event: MouseEvent) {
          handleInputPress(event, store, store.state.disabled, (target) =>
            contains(store.context.chipsContainerRef.current, target),
          );
        },
      },
      elementProps,
    ],
    state,
    stateAttributesMapping: triggerStateAttributesMapping,
  });
}

export interface ComboboxInputGroupState extends FieldRoot.State {
  /**
   * Whether the corresponding popup is open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the component should ignore user edits.
   */
  readOnly: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * Present when the corresponding items list is empty.
   */
  listEmpty: boolean;
  /**
   * Whether the combobox doesn't have a value.
   */
  placeholder: boolean;
}

export interface ComboboxInputGroupProps extends BaseUIComponentProps<
  'div',
  ComboboxInputGroupState
> {}

export namespace ComboboxInputGroup {
  export type State = ComboboxInputGroupState;
  export type Props = ComboboxInputGroupProps;
}
