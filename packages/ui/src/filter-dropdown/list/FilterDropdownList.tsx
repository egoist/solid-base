import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { getTarget } from '@egoist/solid-base-utils/shadowDom';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { useFilterDropdownRootContext } from '../root/FilterDropdownRootContext';
import { FilterDropdownGroupContext } from '../group/FilterDropdownGroupContext';
import { createRenderedId } from '../../internals/resolveRenderedId';
import { refocusOwner } from '../utils/refocusOwner';

/**
 * @internal
 */
export function FilterDropdownList(componentProps: FilterDropdownList.Props): JSX.Element {
  // `id` is resolved by `createRenderedId`.
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id');

  const context = useFilterDropdownRootContext();

  const [id, registerIdRef] = createRenderedId(
    componentProps,
    () => context.defaultListId,
    context.setRenderedListId,
  );

  const defaultProps: HTMLProps = {
    // Chromium includes scrollable elements in sequential focus navigation by default.
    tabindex: -1,
    get id() {
      return id();
    },
    onFocus(event: FocusEvent) {
      // A press on the list's own content, such as its background, a group, or a group label,
      // focuses the list.
      const owner = context.focusOwnerRef.current;
      if (owner && event.relatedTarget === owner && getTarget(event) === event.currentTarget) {
        refocusOwner(owner);
      }
    },
    onPointerMove() {
      context.setKeyboardModality(false);
    },
    onPointerDown() {
      context.setKeyboardModality(false);
    },
  };

  // A component boundary, so the children are created below the provider: the list's groups and
  // items belong to this root's query. A nested root's list renders inside an enclosing group,
  // which must not count them as its own members.
  const Element = () =>
    renderElement('div', componentProps, {
      ref: registerIdRef,
      props: [defaultProps, elementProps],
    });

  return (
    <FilterDropdownGroupContext value={null}>
      <Element />
    </FilterDropdownGroupContext>
  );
}

export interface FilterDropdownListState {}

export interface FilterDropdownListProps extends BaseUIComponentProps<
  'div',
  FilterDropdownListState
> {
  id?: string | undefined;
}

export namespace FilterDropdownList {
  export type Props = FilterDropdownListProps;
  export type State = FilterDropdownListState;
}
