import { merge } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createFilterDropdownGroup } from '../../filter-dropdown/group/createFilterDropdownGroup';
import { FilterDropdownGroupContext } from '../../filter-dropdown/group/FilterDropdownGroupContext';
import { MenuGroupPlain } from '../group/MenuGroup';
import type { MenuGroupProps } from '../group/MenuGroup';
import { MenuRadioGroupPlain } from '../radio-group/MenuRadioGroup';
import type { MenuRadioGroupProps } from '../radio-group/MenuRadioGroup';

function withHidden<P extends { hidden?: unknown }>(props: P, hidden: () => boolean): P {
  return merge(props, {
    get hidden() {
      return hidden() || (props.hidden as boolean | undefined) || undefined;
    },
  }) as P;
}

/**
 * `Menu.Group` in a filterable menu: hidden, label included, once the query filters out all of
 * its items.
 *
 * @internal
 */
export function MenuFilterGroup(props: MenuGroupProps): JSX.Element {
  const { hidden, context } = createFilterDropdownGroup();

  return (
    <FilterDropdownGroupContext value={context}>
      <MenuGroupPlain {...withHidden(props, hidden)} />
    </FilterDropdownGroupContext>
  );
}

/**
 * `Menu.RadioGroup` in a filterable menu, hidden like `MenuFilterGroup`.
 *
 * @internal
 */
export function MenuFilterRadioGroup(props: MenuRadioGroupProps): JSX.Element {
  const { hidden, context } = createFilterDropdownGroup();

  return (
    <FilterDropdownGroupContext value={context}>
      <MenuRadioGroupPlain {...withHidden(props, hidden)} />
    </FilterDropdownGroupContext>
  );
}
