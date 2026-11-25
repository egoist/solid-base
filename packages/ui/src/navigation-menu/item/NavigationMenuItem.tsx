import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import type { NavigationMenuItemContextValue } from './NavigationMenuItemContext';
import { NavigationMenuItemContext } from './NavigationMenuItemContext';
import { createBaseUiId } from '../../internals/baseUiId';

/**
 * An individual navigation menu item.
 * Renders a `<li>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuItem(componentProps: NavigationMenuItem.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'value');

  const fallbackValue = createBaseUiId();

  const contextValue: NavigationMenuItemContextValue = {
    get value() {
      return componentProps.value ?? fallbackValue();
    },
  };

  return (
    <NavigationMenuItemContext value={contextValue}>
      {renderElement('li', componentProps, {
        props: elementProps,
      })}
    </NavigationMenuItemContext>
  );
}

export interface NavigationMenuItemState {}

export interface NavigationMenuItemProps extends BaseUIComponentProps<
  'li',
  NavigationMenuItemState
> {
  /**
   * A unique value that identifies this navigation menu item.
   * If no value is provided, a unique ID will be generated automatically.
   * Use when controlling the navigation menu programmatically.
   */
  value?: any;
}

export namespace NavigationMenuItem {
  export type State = NavigationMenuItemState;
  export type Props = NavigationMenuItemProps;
}
