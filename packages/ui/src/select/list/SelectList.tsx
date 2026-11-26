import { omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useSelectRootContext } from '../root/SelectRootContext';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import { renderElement } from '../../internals/renderElement';
import { styleDisableScrollbar } from '../../utils/styles';
import { LIST_FUNCTIONAL_STYLES } from '../popup/utils';

/**
 * A container for the select items.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Select](https://base.egoist.dev/components/select)
 */
export function SelectList(componentProps: SelectList.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const store = useSelectRootContext();
  const positioner = useSelectPositionerContext();

  const defaultProps: HTMLProps = {
    get id() {
      return `${store.select('id')}-list`;
    },
    role: 'listbox',
    get 'aria-multiselectable'() {
      return store.select('multiple') || undefined;
    },
    get 'aria-readonly'() {
      return store.select('readOnly') || undefined;
    },
    onScroll(event: Event & { currentTarget: HTMLDivElement }) {
      store.context.scrollHandlerRef.current?.(event.currentTarget);
    },
    get style() {
      return positioner.alignItemWithTriggerActive ? LIST_FUNCTIONAL_STYLES : undefined;
    },
    get class() {
      return store.select('hasScrollArrows') && store.select('openMethod') !== 'touch'
        ? styleDisableScrollbar.class
        : undefined;
    },
  };

  let listElement: HTMLDivElement | null = null;
  onCleanup(() => {
    if (listElement && store.state.listElement === listElement) {
      store.set('listElement', null);
    }
  });

  return renderElement('div', componentProps, {
    ref: (element: HTMLDivElement) => {
      listElement = element;
      store.set('listElement', element);
    },
    props: [defaultProps, elementProps],
  });
}

export interface SelectListProps extends BaseUIComponentProps<'div', SelectListState> {}

export interface SelectListState {}

export namespace SelectList {
  export type Props = SelectListProps;
  export type State = SelectListState;
}
