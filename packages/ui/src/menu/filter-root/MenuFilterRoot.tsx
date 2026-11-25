import { untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { MenuRootInternal } from '../root/MenuRoot';
import type { MenuRoot } from '../root/MenuRoot';
import type { MenuFilterProviderOptions } from '../filter-provider/MenuFilterProviderOptions';
import { MenuFilterDropdown } from './MenuFilterDropdown';
import { splitMenuFilterRootProps } from './useMenuFilterRoot';

/**
 * The filterable implementation of `Menu.Root`, rendered in its place when the root sits inside
 * `Menu.FilterProvider`. Reached through the provider only.
 *
 * @internal
 */
export function MenuFilterRoot<Payload>(props: MenuFilterRootProps<Payload>): JSX.Element {
  const { rootProps, dropdownProps } = splitMenuFilterRootProps(props);

  return (
    <MenuRootInternal<Payload> {...(rootProps as MenuRoot.Props<Payload>)}>
      {(arg: { readonly payload: Payload | undefined }) => {
        // Created under the dropdown's providers. Read once: reading the children creates them.
        const content = () =>
          untrack(() => {
            const children = props.children;
            return typeof children === 'function' && children.length > 0
              ? (children as (arg: { readonly payload: Payload | undefined }) => JSX.Element)(arg)
              : (children as JSX.Element);
          });
        return <MenuFilterDropdown {...dropdownProps}>{content()}</MenuFilterDropdown>;
      }}
    </MenuRootInternal>
  );
}

export type MenuFilterRootProps<Payload = unknown> = MenuRoot.Props<Payload> &
  MenuFilterProviderOptions;
