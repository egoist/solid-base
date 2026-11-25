import { createEffect, merge, type Accessor } from 'solid-js';
import { isDev } from '@solidjs/web';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { error } from '@egoist/solid-base-utils/error';
import {
  createMergedView,
  makeEventPreventable,
  mergeProps,
} from '../../merge-props/mergeProps';
import { useCompositeRootContext } from '../composite/root/CompositeRootContext';
import type { BaseUIEvent, HTMLProps } from '../types';
import { createFocusableWhenDisabled } from '../../utils/focusableWhenDisabled';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';

const BUTTON_HANDLER_KEYS = [
  'onClick',
  'onMouseDown',
  'onKeyUp',
  'onKeyDown',
  'onPointerDown',
] as const;
const BUTTON_HANDLER_KEYS_SET: ReadonlySet<PropertyKey> = new Set(BUTTON_HANDLER_KEYS);

export interface CreateButtonParameters {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: Accessor<boolean | undefined> | undefined;
  /**
   * Whether the button may receive focus even if it is disabled.
   * @default false
   */
  focusableWhenDisabled?: Accessor<boolean | undefined> | undefined;
  tabIndex?: Accessor<number | undefined> | undefined;
  /**
   * Whether the component is being rendered as a native button.
   * @default true
   */
  native?: Accessor<boolean | undefined> | undefined;
  /**
   * Whether the button is part of a composite widget.
   * When `true`, keyboard activation for Space occurs on keydown rather than keyup.
   * @default inferred from CompositeRoot context
   */
  composite?: Accessor<boolean | undefined> | undefined;
}

export interface CreateButtonReturnValue {
  /**
   * Wraps the given props with button behavior. Use it as the last (function) props source of
   * `renderElement`: it receives the props merged so far.
   */
  getButtonProps: (externalProps?: HTMLProps) => HTMLProps;
  /**
   * A ref to pass to the rendered element.
   */
  buttonRef: (element: HTMLElement) => void;
}

/**
 * Gives an element button semantics and keyboard behavior, whether or not it renders a native
 * `<button>`.
 */
export function createButton(parameters: CreateButtonParameters = {}): CreateButtonReturnValue {
  const disabled = () => parameters.disabled?.() ?? false;
  const isNativeButton = () => parameters.native?.() ?? true;

  const compositeRootContext = useCompositeRootContext(true);
  const isCompositeItem = () => parameters.composite?.() ?? compositeRootContext != null;

  let element: HTMLElement | null = null;

  const focusableWhenDisabledProps = createFocusableWhenDisabled({
    focusableWhenDisabled: parameters.focusableWhenDisabled,
    disabled,
    composite: isCompositeItem,
    tabIndex: parameters.tabIndex,
    isNativeButton,
  });

  // Handles a disabled composite button rendering another button, e.g.
  // <Toolbar.Button disabled render={(props) => <Menu.Trigger {...props} />} />:
  // the `disabled` attribute must be removed from the DOM so the item stays focusable.
  function updateDisabled() {
    if (!isButtonElement(element)) {
      return;
    }
    if (
      isCompositeItem() &&
      disabled() &&
      (focusableWhenDisabledProps as { disabled?: boolean }).disabled === undefined &&
      element.disabled
    ) {
      element.disabled = false;
    }
  }

  createEffect(
    () => [disabled(), isCompositeItem(), (focusableWhenDisabledProps as any).disabled] as const,
    () => updateDisabled(),
  );

  if (isDev) {
    createEffect(isNativeButton, (native) => {
      if (!element) {
        return;
      }
      const isButtonTag = isButtonElement(element);
      if (native && !isButtonTag) {
        error(
          'A component that acts as a button expected a native <button> because the ' +
            '`nativeButton` prop is true. Rendering a non-<button> removes native button ' +
            'semantics, which can impact forms and accessibility. Use a real <button> in the ' +
            '`render` prop, or set `nativeButton` to `false`.',
        );
      } else if (!native && isButtonTag) {
        error(
          'A component that acts as a button expected a non-<button> because the `nativeButton` ' +
            'prop is false. Rendering a <button> keeps native behavior while Base UI applies ' +
            'non-native attributes and handlers, which can add unintended extra attributes (such ' +
            'as `role` or `aria-disabled`). Use a non-<button> in the `render` prop, or set ' +
            '`nativeButton` to `true`.',
        );
      }
    });
  }

  function getButtonProps(externalProps: HTMLProps = {}): HTMLProps {
    const external = externalProps as Record<string, any>;
    const call = (key: string, event: Event) => {
      const handler = external[key];
      if (typeof handler === 'function') {
        handler(event);
      } else if (Array.isArray(handler)) {
        handler[0](handler[1], event);
      }
    };

    const handlers = {
      onClick(event: MouseEvent) {
        if (disabled()) {
          event.preventDefault();
          return;
        }
        call('onClick', event);
      },
      onMouseDown(event: MouseEvent) {
        if (!disabled()) {
          call('onMouseDown', event);
        }
      },
      onKeyDown(event: KeyboardEvent) {
        if (disabled()) {
          return;
        }

        const baseUIEvent = makeEventPreventable(event as BaseUIEvent<KeyboardEvent>);
        call('onKeyDown', event);
        if (baseUIEvent.baseUIHandlerPrevented) {
          return;
        }

        const native = isNativeButton();
        const composite = isCompositeItem();
        const isCurrentTarget = event.target === event.currentTarget;
        const currentTarget = event.currentTarget as Element;
        const isButton = isButtonElement(currentTarget);
        const isLink = !native && isValidLinkElement(currentTarget);
        const shouldClick = isCurrentTarget && (native ? isButton : !isLink);
        const isEnterKey = event.key === 'Enter';
        const isSpaceKey = event.key === ' ';
        const role = currentTarget.getAttribute('role');
        const isTextNavigationRole =
          role?.startsWith('menuitem') || role === 'option' || role === 'gridcell';

        if (isCurrentTarget && composite && isSpaceKey) {
          if (event.defaultPrevented && isTextNavigationRole) {
            return;
          }

          event.preventDefault();

          // Only a native-mode item that isn't a real <button> is excluded.
          if (!native || isButton) {
            baseUIEvent.preventBaseUIHandler();
            dispatchClickWithModifiers(currentTarget, event);
          }

          return;
        }

        // Keyboard accessibility for native and non-native elements.
        if (!shouldClick || native || (!isSpaceKey && !isEnterKey)) {
          // Space activates links on keyup (`role="button"` semantics); prevent the page scroll
          // Space would otherwise trigger. Enter is left to the browser's native link activation.
          if (isCurrentTarget && isLink && isSpaceKey) {
            event.preventDefault();
          }
          return;
        }

        // Match native buttons: preventing the keydown's default cancels activation.
        if (event.defaultPrevented) {
          return;
        }

        event.preventDefault();

        if (isEnterKey) {
          baseUIEvent.preventBaseUIHandler();
          dispatchClickWithModifiers(currentTarget, event);
        }
      },
      onKeyUp(event: KeyboardEvent) {
        if (disabled()) {
          return;
        }

        // Calling preventDefault in keyup on a <button> will not dispatch a click event if
        // Space is pressed.
        const baseUIEvent = makeEventPreventable(event as BaseUIEvent<KeyboardEvent>);
        call('onKeyUp', event);

        const native = isNativeButton();
        const composite = isCompositeItem();

        if (
          event.target === event.currentTarget &&
          native &&
          composite &&
          isButtonElement(event.currentTarget as HTMLElement) &&
          event.key === ' '
        ) {
          event.preventDefault();
          return;
        }

        if (baseUIEvent.baseUIHandlerPrevented) {
          return;
        }

        // Keyboard accessibility for non interactive elements.
        if (
          event.target === event.currentTarget &&
          !native &&
          !composite &&
          !event.defaultPrevented &&
          event.key === ' '
        ) {
          baseUIEvent.preventBaseUIHandler();
          dispatchClickWithModifiers(event.currentTarget as Element, event);
        }
      },
      onPointerDown(event: PointerEvent) {
        if (disabled()) {
          event.preventDefault();
          return;
        }
        call('onPointerDown', event);
      },
    };

    return mergeProps(
      handlers,
      merge(() => (isNativeButton() ? { type: 'button' } : { role: 'button' })),
      focusableWhenDisabledProps,
      createMergedView([external], BUTTON_HANDLER_KEYS_SET),
    );
  }

  const buttonRef = (node: HTMLElement) => {
    element = node;
    updateDisabled();
  };

  return { getButtonProps, buttonRef };
}

function isButtonElement(elem: Element | null): elem is HTMLButtonElement {
  return isHTMLElement(elem) && elem.tagName === 'BUTTON';
}

function isValidLinkElement(elem: Element | null): elem is HTMLAnchorElement {
  return isHTMLElement(elem) && elem.tagName === 'A' && Boolean((elem as HTMLAnchorElement).href);
}
