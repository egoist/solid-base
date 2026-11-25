// Port of upstream `test/filterDropdown.tsx`: menu-shaped hosts for testing the filter engine
// without a floating popup or navigation.
import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { NOOP } from '@egoist/solid-base-utils/empty';
import { createBaseUiId } from '../internals/baseUiId';
import { mergeProps } from '../merge-props/mergeProps';
import { createMenuFilterPopup } from '../menu/filter-root/useMenuFilterPopup';
import { resolvePopupLabel } from '../menu/popup/MenuPopup';
import { useFilterDropdownRootContext } from './root/FilterDropdownRootContext';
import { FilterDropdownList } from './list/FilterDropdownList';
import { FilterDropdownRoot } from './root/FilterDropdownRoot';

export { FilterDropdownRoot as Root } from './root/FilterDropdownRoot';
export { FilterDropdownInput as Input } from './input/FilterDropdownInput';
export { FilterDropdownClear as Clear } from './clear/FilterDropdownClear';
export { FilterDropdownEmpty as Empty } from './empty/FilterDropdownEmpty';

export function Popup(props: JSX.HTMLAttributes<HTMLDivElement> & { id?: string | undefined }) {
  const otherProps = omit(props, 'id');
  const id = createBaseUiId(() => props.id);
  const context = useFilterDropdownRootContext();
  const interactionProps = createMenuFilterPopup(() => 'vertical');
  const merged = mergeProps(
    {
      get id() {
        return id();
      },
      role: 'dialog',
      get 'aria-labelledby'() {
        return context.triggerId;
      },
    },
    interactionProps,
    otherProps,
  );
  return <div {...merged} />;
}

export function List(props: FilterDropdownList.Props) {
  const context = useFilterDropdownRootContext();
  const merged = mergeProps<FilterDropdownList.Props>(
    {
      role: 'menu',
      get 'aria-labelledby'() {
        return resolvePopupLabel(props, null, context.triggerId ?? null);
      },
    },
    props,
  );
  return <FilterDropdownList {...merged} />;
}

/**
 * A filter root without a host list: nothing is ever highlighted.
 */
export function TestFilterDropdownRoot(
  props: Omit<FilterDropdownRoot.Props, 'listRef' | 'getActiveIndex' | 'setActiveIndex'>,
) {
  const listRef = { current: [] as Array<HTMLElement | null> };
  return (
    <FilterDropdownRoot
      {...props}
      listRef={listRef}
      getActiveIndex={getNoActiveIndex}
      setActiveIndex={NOOP}
    />
  );
}

function getNoActiveIndex() {
  return null;
}
