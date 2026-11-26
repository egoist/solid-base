import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useFloatingTree } from '../../utils/popups/tree/FloatingTree';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { isOutsideMenuEvent } from '../utils/isOutsideMenuEvent';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

/**
 * A link in the navigation menu that can be used to navigate to a different page or section.
 * Renders an `<a>` element.
 *
 * Documentation: [Solid Base Navigation Menu](https://base.egoist.dev/components/navigation-menu)
 */
export function NavigationMenuLink(componentProps: NavigationMenuLink.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'active', 'closeOnClick');

  const context = useNavigationMenuRootContext();
  const nodeId = useNavigationMenuTreeContext();
  const tree = useFloatingTree();

  const active = () => componentProps.active ?? false;

  const state: NavigationMenuLinkState = {
    get active() {
      return active();
    },
  };

  const defaultProps: HTMLProps = {
    get 'aria-current'() {
      return active() ? 'page' : undefined;
    },
    tabindex: undefined,
    onClick(event: MouseEvent) {
      if (componentProps.closeOnClick ?? false) {
        context.setValue(null, createChangeEventDetails(REASONS.linkPress, event));
      }
    },
    onBlur(event: FocusEvent) {
      const positionerElement = context.positionerElement;
      const popupElement = context.popupElement;
      if (
        positionerElement &&
        popupElement &&
        isOutsideMenuEvent(
          {
            currentTarget: event.currentTarget as HTMLElement | null,
            relatedTarget: event.relatedTarget as HTMLElement | null,
          },
          { popupElement, rootRef: context.rootRef, tree, nodeId },
        )
      ) {
        context.setValue(null, createChangeEventDetails(REASONS.focusOut, event));
      }
    },
  };

  return (
    <CompositeItem
      tag="a"
      render={componentProps.render}
      class={componentProps.class}
      style={componentProps.style}
      state={state}
      props={[defaultProps, elementProps]}
    />
  );
}

export interface NavigationMenuLinkState {
  /**
   * Whether the link is the currently active page.
   */
  active: boolean;
}

export interface NavigationMenuLinkProps extends BaseUIComponentProps<
  'a',
  NavigationMenuLinkState,
  JSX.AnchorHTMLAttributes<HTMLAnchorElement>
> {
  /**
   * Whether the link is the currently active page.
   * @default false
   */
  active?: boolean | undefined;
  /**
   * Whether to close the navigation menu when the link is clicked.
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export namespace NavigationMenuLink {
  export type State = NavigationMenuLinkState;
  export type Props = NavigationMenuLinkProps;
}
