import { MenuFilterPopup } from './MenuFilterPopup';
import { MenuFilterList } from './MenuFilterList';
import { MenuFilterGroup, MenuFilterRadioGroup } from './MenuFilterGroup';
import { createFilterDropdownItem } from '../../filter-dropdown/item/createFilterDropdownItem';
import { createMenuFilterSubmenuTrigger } from './useMenuFilterSubmenuTrigger';
import { createVirtualFocusParentHandoff } from './useVirtualFocusParentHandoff';
import type { MenuFilterImpl } from './MenuFilterContext';

export const MENU_FILTER_IMPL: MenuFilterImpl = {
  Popup: MenuFilterPopup,
  List: MenuFilterList,
  Group: MenuFilterGroup,
  RadioGroup: MenuFilterRadioGroup,
  useItem: createFilterDropdownItem,
  useSubmenuTrigger: createMenuFilterSubmenuTrigger,
  useParentHandoff: createVirtualFocusParentHandoff,
};
