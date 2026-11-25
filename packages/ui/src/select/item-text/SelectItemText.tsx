import { createEffect, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { useSelectRootContext } from '../root/SelectRootContext';
import { useSelectItemContext } from '../item/SelectItemContext';
import { renderElement } from '../../internals/renderElement';

/**
 * A text label of the select item.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItemText(componentProps: SelectItemText.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const item = useSelectItemContext();
  const store = useSelectRootContext();

  let textElement: HTMLElement | null = null;

  createEffect(
    () => [item.index, item.selectedByFocus] as const,
    ([index, selectedByFocus]) => {
      if (!textElement) {
        return;
      }
      if (index === 0) {
        store.context.firstItemTextRef.current = textElement;
      }
      // The text of the selected item aligns the popup with the trigger.
      if (selectedByFocus) {
        store.context.selectedItemTextRef.current = textElement;
      } else if (store.context.selectedItemTextRef.current === textElement) {
        store.context.selectedItemTextRef.current = null;
      }
    },
  );

  return renderElement('div', componentProps, {
    ref: (element: HTMLElement) => {
      textElement = element;
      item.textRef.current = element;
    },
    props: elementProps,
  });
}

export interface SelectItemTextState {}

export interface SelectItemTextProps extends BaseUIComponentProps<'div', SelectItemTextState> {}

export namespace SelectItemText {
  export type State = SelectItemTextState;
  export type Props = SelectItemTextProps;
}
