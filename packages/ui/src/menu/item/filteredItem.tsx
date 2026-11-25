import { Show, type Component } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { mergeProps } from '../../merge-props/mergeProps';
import { useMenuFilterItem, type MenuFilterPartScope } from '../filter-root/MenuFilterContext';

/**
 * Renders an item part through the filter of the menu it belongs to: a plain menu renders the
 * item as is, a filterable menu renders it only while it matches the query.
 * @internal
 */
export function renderFilteredItem<P extends { label?: string | undefined }>(
  props: P,
  Plain: Component<P>,
  scope: MenuFilterPartScope = 'root',
): JSX.Element {
  const filterItem = useMenuFilterItem(props, scope);

  if (filterItem.ref == null && filterItem.props == null) {
    return (
      <Show when={filterItem.visible()}>
        <Plain {...props} />
      </Show>
    );
  }

  // `mergeProps` calls every ref.
  const merged = mergeProps(filterItem.props, props, { ref: filterItem.ref }) as P;

  return (
    <Show when={filterItem.visible()}>
      <Plain {...merged} />
    </Show>
  );
}
