import { merge, omit } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type { MenuFilterProviderOptions } from '../filter-provider/MenuFilterProviderOptions';
import type { MenuFilterDropdownProps } from './MenuFilterDropdown';

const FILTER_KEYS = [
  'children',
  'value',
  'defaultValue',
  'onValueChange',
  'filter',
  'autoHighlight',
  'locale',
] as const;

/**
 * Splits a filterable root's props between the menu root and the filter below it. The returned
 * objects are live views of `props`.
 */
export function splitMenuFilterRootProps<Props extends MenuFilterProviderOptions & { children?: unknown }>(
  props: Props,
) {
  const virtualFocusRef: RefObject<HTMLElement | null> = { current: null };
  const autoHighlight = () => props.autoHighlight ?? false;

  const rootProps = merge(omit(props, ...FILTER_KEYS), {
    virtualFocus: true,
    virtualFocusRef,
    get allowEscape() {
      return !autoHighlight();
    },
    get resetOnPointerLeave() {
      return autoHighlight() !== 'always';
    },
  }) as Omit<Props, (typeof FILTER_KEYS)[number]> & {
    virtualFocus: true;
    virtualFocusRef: RefObject<HTMLElement | null>;
    allowEscape: boolean;
    resetOnPointerLeave: boolean;
  };

  const dropdownProps: Omit<MenuFilterDropdownProps, 'children'> = {
    get value() {
      return props.value;
    },
    get defaultValue() {
      return props.defaultValue;
    },
    get onValueChange() {
      return props.onValueChange;
    },
    get filter() {
      return props.filter;
    },
    get autoHighlight() {
      return autoHighlight();
    },
    get locale() {
      return props.locale;
    },
  };

  return { rootProps, dropdownProps };
}
