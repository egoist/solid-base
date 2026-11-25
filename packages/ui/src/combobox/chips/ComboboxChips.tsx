import { omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createRefObject } from '@egoist/solid-base-utils/refObject';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import { ComboboxChipsContext } from './ComboboxChipsContext';
import {
  CompositeListContext,
  createCompositeList,
} from '../../internals/composite/list/CompositeList';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { handleInputPress } from '../utils/handleInputPress';

/**
 * A container for the chips in a multiselectable input.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxChips(componentProps: ComboboxChips.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const store = useComboboxRootContext();

  const chipsRef = createRefObject<Array<HTMLElement | null>>([]);
  const chipsList = createCompositeList({ elementsRef: chipsRef });

  let element: HTMLDivElement | null = null;
  onCleanup(() => {
    if (element && store.context.chipsContainerRef.current === element) {
      store.context.chipsContainerRef.current = null;
    }
  });

  // Created inside the providers: the children read them.
  const Element = () =>
    renderElement('div', componentProps, {
      ref: (el: HTMLDivElement) => {
        element = el;
        store.context.chipsContainerRef.current = el;
      },
      // NVDA enters browse mode instead of staying in focus mode when navigating with
      // arrow keys inside a container unless it has a toolbar role.
      props: [
        {
          get role() {
            return store.select('hasSelectionChips') ? 'toolbar' : undefined;
          },
          onMouseDown(event: MouseEvent) {
            handleInputPress(event, store, store.state.disabled);
          },
        },
        elementProps,
      ],
    });

  const contextValue: ComboboxChipsContext = { chipsRef };

  return (
    <ComboboxChipsContext value={contextValue}>
      <CompositeListContext value={chipsList}>
        <Element />
      </CompositeListContext>
    </ComboboxChipsContext>
  );
}

export interface ComboboxChipsState {}

export interface ComboboxChipsProps extends BaseUIComponentProps<'div', ComboboxChipsState> {}

export namespace ComboboxChips {
  export type State = ComboboxChipsState;
  export type Props = ComboboxChipsProps;
}
