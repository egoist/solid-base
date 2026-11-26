import { createEffect, omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useMenuFilterImpl } from '../filter-root/MenuFilterContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import { renderElement } from '../../internals/renderElement';
import { createBaseUiId } from '../../internals/baseUiId';
import type { BaseUIComponentProps } from '../../internals/types';
import { resolvePopupLabel } from '../popup/MenuPopup';

function MenuListPlain(componentProps: MenuList.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id');

  const rootContext = useMenuRootContext();
  const { store } = rootContext;

  const id = createBaseUiId(() => componentProps.id);

  let listElement: HTMLElement | null = null;

  // The trigger reads `aria-controls` off the stored element, which an id change alone leaves in
  // place, so subscribers are told to read it again. Mounting publishes the element itself.
  createEffect(
    id,
    () => {
      store.notifyAll();
    },
    { defer: true },
  );

  onCleanup(() => {
    if (listElement && store.state.listElement === listElement) {
      store.set('listElement', null);
    }
  });

  return renderElement('div', componentProps, {
    ref: (element: HTMLElement) => {
      listElement = element;
      store.set('listElement', element);
    },
    props: [
      {
        get id() {
          return id();
        },
        role: 'menu',
        // The popup focuses the list on a pointer open in place of itself.
        tabindex: -1,
        // `menu` is implicitly vertical, so only the non-default value needs to be rendered.
        get 'aria-orientation'() {
          return rootContext.orientation === 'horizontal' ? 'horizontal' : undefined;
        },
        get 'aria-labelledby'() {
          return resolvePopupLabel(
            componentProps,
            store.select('activeTriggerElement'),
            store.select('activeTriggerId'),
          );
        },
      },
      elementProps,
    ],
  });
}

/**
 * Groups menu items so other content, such as a filter input, can share the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Menu](https://base.egoist.dev/components/menu)
 */
export function MenuList(props: MenuList.Props): JSX.Element {
  const impl = useMenuFilterImpl();
  if (impl) {
    const List = impl.List;
    return <List {...props} />;
  }
  return <MenuListPlain {...props} />;
}

export interface MenuListState {}

export interface MenuListProps extends BaseUIComponentProps<'div', MenuListState> {
  /**
   * @ignore
   */
  id?: string | undefined;
}

export namespace MenuList {
  export type Props = MenuListProps;
  export type State = MenuListState;
}
