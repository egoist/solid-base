import { merge, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent } from '@solidjs/testing-library';
import { Menu } from '.';

export {
  act,
  createRef,
  flushMicrotasks,
  renderWithUser,
  wait,
  waitSingleFrame,
} from '../dialog/test-utils';

export type TestMenuProps = {
  rootProps?: Menu.Root.Props;
  portalProps?: Menu.Portal.Props;
  popupProps?: Menu.Popup.Props;
  triggerProps?: Menu.Trigger.Props;
  submenuProps?: Menu.SubmenuRoot.Props;
  submenuTriggerProps?: Menu.SubmenuTrigger.Props;
  children?: JSX.Element;
};

/**
 * A menu (with nested submenus) whose trigger is rendered inside `Menu.Root`.
 */
export function ContainedTriggerMenu(props: TestMenuProps) {
  const rest = omit(props, 'triggerProps');
  return (
    <TestMenuContents {...rest}>
      <Menu.Trigger {...props.triggerProps}>Toggle</Menu.Trigger>
    </TestMenuContents>
  );
}

/**
 * The same menu with a detached trigger connected through a handle.
 */
export function DetachedTriggerMenu(props: TestMenuProps) {
  const rest = omit(props, 'triggerProps', 'rootProps');
  const menuHandle = Menu.createHandle<unknown>();
  const rootProps = merge(() => props.rootProps ?? {}, { handle: menuHandle });

  return (
    <>
      <TestMenuContents {...rest} rootProps={rootProps} />
      <Menu.Trigger handle={menuHandle} {...props.triggerProps}>
        Toggle
      </Menu.Trigger>
    </>
  );
}

/**
 * The menu contents shared by `ContainedTriggerMenu` and `DetachedTriggerMenu`.
 */
export function TestMenuContents(props: TestMenuProps) {
  return (
    <Menu.Root {...props.rootProps}>
      {props.children}
      <Menu.Portal {...props.portalProps}>
        <Menu.Positioner data-testid="menu-positioner">
          <Menu.Popup data-testid="menu" {...props.popupProps}>
            {props.popupProps?.children ?? (
              <>
                <Menu.Item data-testid="item-1">Item 1</Menu.Item>
                <Menu.Item data-testid="item-2">Item 2</Menu.Item>
                <Menu.Item data-testid="item-3" disabled>
                  Item 3
                </Menu.Item>
                <Menu.SubmenuRoot {...props.submenuProps}>
                  <Menu.SubmenuTrigger data-testid="submenu-trigger" {...props.submenuTriggerProps}>
                    Item 4
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="submenu">
                        <Menu.Item data-testid="item-4_1">Item 4.1</Menu.Item>
                        <Menu.Item data-testid="item-4_2">Item 4.2</Menu.Item>
                        <Menu.SubmenuRoot {...props.submenuProps}>
                          <Menu.SubmenuTrigger
                            data-testid="nested-submenu-trigger"
                            {...props.submenuTriggerProps}
                          >
                            Item 4.3
                          </Menu.SubmenuTrigger>
                          <Menu.Portal>
                            <Menu.Positioner>
                              <Menu.Popup data-testid="nested-submenu">
                                <Menu.Item data-testid="item-4_3_1">Item 4.3.1</Menu.Item>
                                <Menu.Item data-testid="item-4_3_2">Item 4.3.2</Menu.Item>
                              </Menu.Popup>
                            </Menu.Positioner>
                          </Menu.Portal>
                        </Menu.SubmenuRoot>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
                <Menu.Item data-testid="item-5">Item 5</Menu.Item>
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

// Ports of upstream `test/pointer.ts`.

export function enterWithMouse(element: Element, init?: MouseEventInit) {
  fireEvent.pointerEnter(element, { pointerType: 'mouse', ...init });
  fireEvent.mouseEnter(element, init);
  fireEvent.mouseMove(element, init);
}

export function moveMouse(from: Element, to: Element) {
  fireEvent.pointerLeave(from, {
    pointerType: 'mouse',
    relatedTarget: to,
  });
  fireEvent.mouseLeave(from, { relatedTarget: to });
  fireEvent.pointerEnter(to, {
    pointerType: 'mouse',
    relatedTarget: from,
  });
  fireEvent.mouseEnter(to, { relatedTarget: from });
  fireEvent.mouseMove(to);
}

/**
 * Presses an element the way a touch screen does before the click: a touch `pointerdown`
 * followed by the compatibility `mousedown`.
 */
export function pressWithTouch(element: Element) {
  fireEvent.pointerDown(element, { pointerType: 'touch' });
  fireEvent.mouseDown(element);
}

/**
 * Presses an element the way Chrome performs a screen reader activation (TalkBack, VoiceOver,
 * NVDA): a zero-pressure 1x1 mouse press with no buttons, followed by a `detail: 0` click.
 */
export function pressWithScreenReader(element: Element) {
  const pointerInit = { pointerType: 'mouse', width: 1, height: 1, pressure: 0 };
  fireEvent.pointerDown(element, { ...pointerInit, detail: 0, buttons: 0 });
  fireEvent.mouseDown(element, { detail: 0 });
  fireEvent.pointerUp(element, pointerInit);
  fireEvent.mouseUp(element, { detail: 0 });
  fireEvent.click(element, { detail: 0 });
}
