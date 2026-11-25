import { flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen, waitFor, within } from '@solidjs/testing-library';
import { NavigationMenu } from '..';
import { Dialog } from '../../dialog';
import { DirectionProvider, type TextDirection } from '../../direction-provider';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { OPEN_DELAY } from '../utils/constants';
import { act, flushMicrotasks, renderWithProps, renderWithUser } from '../test-utils';
import {
  TestNavigationMenu,
  TestNavigationMenuWithTopLevelLink,
  TestNavigationMenuOrientationAttributes,
  TestNavigationMenuWithDisabledTrigger,
  TestNavigationMenuWithNestedPopup,
  TestNestedNavigationMenu,
  TestInlineNestedNavigationMenu,
  TestNestedNavigationMenuWithCloseOnClick,
  TestDeeplyNestedNavigationMenuWithCloseOnClick,
  TestDeeplyNestedNavigationMenu,
  TestInlineNestedNavigationMenuWithDynamicContent,
  TestInlineNestedNavigationMenuTabForwardBoundary,
  TestInlineNestedNavigationMenuTabFlow,
  TestNavigationMenuWithKeepMountedContent,
  TestNavigationMenuWithKeepMountedContentClosed,
  TestNavigationMenuWithTopLevelLinkScopedPopupAnimation,
  getPopupSizeVars,
  mockResizeObserver,
  primeOpenPopupSize,
  mockAnimations,
  mockBoundingClientRect,
} from './test-fixtures';

const FALSY_VALUE_CASES = [
  ['0', 0],
  ['empty string', ''],
  ['false', false],
] as const;

function tick(ms: number) {
  vi.advanceTimersByTime(ms);
  flush();
}

describe('<NavigationMenu.Root />', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('conformance', () => {
    it('renders a <nav> and forwards ref, class, style and render', async () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <>
          <NavigationMenu.Root
            data-testid="root"
            ref={(element) => {
              ref = element;
            }}
            class={(state) => (state.open ? 'open' : 'closed')}
            style={{ color: 'red' }}
          />
          <NavigationMenu.Root data-testid="rendered" render="section" />
        </>
      ));
      await flushMicrotasks();

      const root = screen.getByTestId('root');
      expect(root.tagName).toBe('NAV');
      expect(ref).toBe(root);
      expect(root).toHaveClass('closed');
      expect(root).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(screen.getByTestId('rendered').tagName).toBe('SECTION');
    });

    it('renders a <div> when nested', async () => {
      render(() => <TestNavigationMenuOrientationAttributes />);
      await flushMicrotasks();
      expect(screen.getByTestId('top-level-root').tagName).toBe('NAV');
      expect(screen.getByTestId('nested-root').tagName).toBe('DIV');
    });
  });

  it('does not apply aria-orientation to the top-level list or root element', async () => {
    render(() => <TestNavigationMenuOrientationAttributes />);
    await flushMicrotasks();

    expect(screen.getByTestId('top-level-root')).not.toHaveAttribute('aria-orientation');
    expect(screen.getByTestId('top-level-list')).not.toHaveAttribute('aria-orientation');
  });

  it('does not apply aria-orientation to nested lists or root elements', async () => {
    render(() => <TestNavigationMenuOrientationAttributes />);
    await flushMicrotasks();

    expect(screen.getByTestId('nested-root')).not.toHaveAttribute('aria-orientation');
    expect(screen.getByTestId('nested-list')).not.toHaveAttribute('aria-orientation');
  });

  describe('interactions', () => {
    it('opens on hover with mouse input', async () => {
      render(() => <TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      tick(50);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('blocks pointer events on the list while traversing from a top-level trigger to the popup', async () => {
      render(() => <TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');
      const siblingTrigger = screen.getByTestId('trigger-2');
      const topLevelList = trigger.closest('ul') as HTMLElement;

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      tick(50);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(topLevelList.style.pointerEvents).toBe('none');
      expect(document.body.style.pointerEvents).toBe('');
      expect(getComputedStyle(siblingTrigger).pointerEvents).toBe('none');

      fireEvent.mouseEnter(screen.getByTestId('top-level-positioner'));
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('');
    });

    it('reapplies top-level safePolygon pointer events after returning from the popup and switching triggers', async () => {
      render(() => <TestNavigationMenuWithTopLevelLink />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');
      const topLevelLink = screen.getByTestId('top-level-link');
      const topLevelList = trigger1.closest('ul') as HTMLElement;

      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      const positioner = screen.getByTestId('top-level-positioner');

      expect(topLevelList.style.pointerEvents).toBe('none');
      expect(document.body.style.pointerEvents).toBe('');
      expect(getComputedStyle(topLevelLink).pointerEvents).toBe('none');

      fireEvent.mouseEnter(positioner);
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('');

      fireEvent.mouseLeave(positioner, { relatedTarget: trigger1 });
      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('none');
      expect(document.body.style.pointerEvents).toBe('');
      expect(getComputedStyle(topLevelLink).pointerEvents).toBe('none');

      fireEvent.mouseEnter(positioner);
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('');

      fireEvent.mouseLeave(positioner, { relatedTarget: trigger2 });
      fireEvent.mouseEnter(trigger2);
      fireEvent.mouseMove(trigger2);
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('none');
      expect(document.body.style.pointerEvents).toBe('');
      expect(getComputedStyle(topLevelLink).pointerEvents).toBe('none');
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByTestId('popup-2')).not.toBe(null);
    });

    it('keeps top-level safePolygon pointer events active when switching directly to a different trigger', async () => {
      render(() => <TestNavigationMenuWithTopLevelLink />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');
      const topLevelLink = screen.getByTestId('top-level-link');
      const topLevelList = trigger1.closest('ul') as HTMLElement;

      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      fireEvent.mouseEnter(trigger2);
      fireEvent.mouseMove(trigger2);
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('none');
      expect(document.body.style.pointerEvents).toBe('');
      expect(getComputedStyle(trigger1).pointerEvents).toBe('none');
      expect(getComputedStyle(topLevelLink).pointerEvents).toBe('none');
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByTestId('popup-2')).not.toBe(null);
    });

    it('clears top-level safePolygon pointer events on trigger pointerdown', async () => {
      render(() => <TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');
      const topLevelList = trigger.closest('ul') as HTMLElement;

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('none');

      fireEvent.pointerDown(trigger, { pointerType: 'mouse' });

      expect(topLevelList.style.pointerEvents).toBe('');
    });

    it('scopes safePolygon pointer events to the document for a custom list element', async () => {
      render(() => (
        <NavigationMenu.Root>
          <NavigationMenu.List
            render={(props) => (
              <div {...(props as JSX.HTMLAttributes<HTMLDivElement>)} data-testid="custom-list" />
            )}
          >
            <NavigationMenu.Item value="item">
              <NavigationMenu.Trigger>Trigger 1</NavigationMenu.Trigger>
              <NavigationMenu.Content>Content 1</NavigationMenu.Content>
            </NavigationMenu.Item>
            <NavigationMenu.Item value="item-2">
              <NavigationMenu.Trigger>Trigger 2</NavigationMenu.Trigger>
              <NavigationMenu.Content>Content 2</NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup>
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>
      ));

      const trigger = screen.getByText('Trigger 1');
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(document.body.style.pointerEvents).toBe('none');
      expect(screen.getByTestId('custom-list').style.pointerEvents).toBe('');

      fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
      expect(document.body.style.pointerEvents).toBe('');

      const secondTrigger = screen.getByText('Trigger 2');
      fireEvent.mouseEnter(secondTrigger);
      await flushMicrotasks();

      expect(secondTrigger).toHaveAttribute('aria-expanded', 'true');
      expect(document.body.style.pointerEvents).toBe('none');

      fireEvent.pointerDown(secondTrigger, { pointerType: 'mouse' });
      expect(document.body.style.pointerEvents).toBe('');
    });

    // Skipped (jsdom): blocking pointer events on sibling triggers through real hover needs real
    // pointer movement.

    it('opens on click with mouse input', async () => {
      render(() => <TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('does not open on hover with touch input', async () => {
      render(() => <TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.pointerEnter(trigger, { pointerType: 'touch' });
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it.each([
      ['horizontal', 'right', 'left'],
      ['vertical', 'down', 'up'],
    ] as const)(
      'reports %s activation direction when switching in either direction',
      async (orientation, forwardDirection, backwardDirection) => {
        render(() => <TestNavigationMenu orientation={orientation} />);
        const trigger1 = screen.getByTestId('trigger-1');
        const trigger2 = screen.getByTestId('trigger-2');

        if (orientation === 'horizontal') {
          mockBoundingClientRect(trigger1, { x: 0, y: 0, width: 80, height: 32 });
          mockBoundingClientRect(trigger2, { x: 120, y: 0, width: 80, height: 32 });
        } else {
          mockBoundingClientRect(trigger1, { x: 0, y: 0, width: 80, height: 32 });
          mockBoundingClientRect(trigger2, { x: 0, y: 80, width: 80, height: 32 });
        }

        fireEvent.click(trigger1);
        await flushMicrotasks();

        fireEvent.click(trigger2);
        await flushMicrotasks();

        expect(screen.getByTestId('popup-2')).toHaveAttribute(
          'data-activation-direction',
          forwardDirection,
        );

        fireEvent.click(trigger1);
        await flushMicrotasks();

        expect(screen.getByTestId('popup-1')).toHaveAttribute(
          'data-activation-direction',
          backwardDirection,
        );
      },
    );

    it('opens on click with touch input', async () => {
      render(() => <TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      fireEvent.pointerUp(trigger, { pointerType: 'touch' });
      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    // Skipped (jsdom): restoring hover open after a touch click closes outside (top-level and
    // nested submenu variants) relies on real pointer sequences.

    it('restores hover open after a quick click then trigger switch', async () => {
      const { user } = renderWithUser(() => <TestNavigationMenu />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      await user.hover(trigger1);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });

      await user.click(trigger1);
      await flushMicrotasks();

      await user.hover(trigger2);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-2')).not.toBe(null);
      });

      await user.unhover(trigger2);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-2')).toBe(null);
      });

      await user.hover(trigger1);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });
    });

    it('closes after pointerdown on a link in a hover-open popup when pointer leaves', async () => {
      const { user } = renderWithUser(() => <TestNavigationMenu />);
      const trigger1 = screen.getByTestId('trigger-1');

      await user.hover(trigger1);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });

      const popup1 = screen.getByTestId('popup-1');
      const link1 = within(popup1).getByText('Link 1');

      await user.hover(link1);
      fireEvent.pointerDown(link1, { pointerType: 'mouse' });
      await user.unhover(link1);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).toBe(null);
      });
    });

    it('does not close menu when clicking a different trigger with mouse', async () => {
      render(() => <TestNavigationMenu />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      fireEvent.click(trigger1);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(trigger2);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-2')).not.toBe(null);
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
    });

    it('does not close menu when clicking a different trigger on touch', async () => {
      render(() => <TestNavigationMenu />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      fireEvent.click(trigger1);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');

      fireEvent.pointerDown(trigger2, { pointerType: 'touch' });
      fireEvent.pointerUp(trigger2, { pointerType: 'touch' });
      fireEvent.click(trigger2);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-2')).not.toBe(null);
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
    });

    it('returns focus to trigger when closing menu', async () => {
      const { user } = renderWithUser(() => (
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
          <button data-testid="last" />
        </div>
      ));

      const trigger = screen.getByTestId('trigger-1');

      await user.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);

      const link = screen.getByRole('link', { name: 'Link 1' });
      await act(async () => link.focus());
      expect(link).toHaveFocus();

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).toBe(null);
      });
      expect(trigger).toHaveFocus();
    });

    it('respects focus outside when clicking menu', async () => {
      const { user } = renderWithUser(() => (
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
          <button data-testid="last" />
        </div>
      ));

      const trigger = screen.getByTestId('trigger-1');
      const last = screen.getByTestId('last');

      await user.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveFocus();

      await user.click(screen.getByTestId('last'));
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(last).toHaveFocus();
    });

    it('does not restore focus to the trigger when closed via hover', async () => {
      render(() => <TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      tick(OPEN_DELAY);

      const popup = await screen.findByTestId('popup-1');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      fireEvent.mouseLeave(trigger);
      fireEvent.mouseLeave(popup);
      tick(50);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveFocus();
    });

    it('does not restore focus to the trigger when focus moves outside', async () => {
      const { user } = renderWithUser(() => (
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
          <button data-testid="last" />
        </div>
      ));

      const trigger = screen.getByTestId('trigger-1');
      const last = screen.getByTestId('last');

      await act(async () => trigger.focus());

      await user.click(trigger);
      await user.tab();
      await user.tab();
      await user.tab();
      await user.tab();

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).toBe(null);
      });
      expect(last).toHaveFocus();
      expect(trigger).not.toHaveFocus();
    });
  });

  describe('patient click threshold', () => {
    it('stays open if hovered then clicked within the patient threshold', async () => {
      render(() => <TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes if hovered then clicked after the patient threshold', async () => {
      render(() => <TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      tick(PATIENT_CLICK_THRESHOLD);

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('prop: defaultValue', () => {
    it('should respect defaultValue', async () => {
      render(() => <TestNavigationMenu defaultValue="item-1" />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      tick(OPEN_DELAY);
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('disables popup and arrow transitions while a kept portal opens', async () => {
      render(() => (
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item value="item-1">
              <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal keepMounted>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup data-testid="popup-root">
                <NavigationMenu.Arrow data-testid="arrow" />
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>
      ));

      fireEvent.click(screen.getByTestId('trigger-1'));
      flush();

      expect(screen.getByTestId('popup-root')).toHaveStyle({
        transition: 'none',
      });
      expect(screen.getByTestId('arrow')).toHaveStyle({
        transition: 'none',
      });

      await waitFor(() => {
        expect(screen.getByTestId('popup-root')).not.toHaveStyle({
          transition: 'none',
        });
      });
      expect(screen.getByTestId('arrow')).not.toHaveStyle({
        transition: 'none',
      });
    });
  });

  describe('prop: onValueChange', () => {
    it('should call onValueChange when value changes', async () => {
      const onValueChange = vi.fn();
      render(() => <TestNavigationMenu onValueChange={onValueChange} />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      fireEvent.click(trigger1);
      await flushMicrotasks();
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.lastCall?.[0]).toBe('item-1');

      fireEvent.click(trigger2);
      await flushMicrotasks();
      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.lastCall?.[0]).toBe('item-2');
    });

    it('does not open when onValueChange cancels the interaction', async () => {
      const onValueChange = vi.fn(
        (_nextValue: unknown, eventDetails: NavigationMenu.Root.ChangeEventDetails) => {
          eventDetails.cancel();
        },
      );
      render(() => <TestNavigationMenu onValueChange={onValueChange} />);

      fireEvent.click(screen.getByTestId('trigger-1'));
      await flushMicrotasks();

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(screen.getByTestId('trigger-1')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-1')).toBe(null);
    });

    it('does not emit a duplicate onValueChange when switching items via keyboard', async () => {
      const onValueChange = vi.fn();
      const { user } = renderWithUser(() => <TestNavigationMenu onValueChange={onValueChange} />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      await user.click(trigger1);
      await flushMicrotasks();
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.lastCall?.[0]).toBe('item-1');

      await act(async () => {
        trigger1.focus();
      });
      await user.keyboard('{ArrowRight}');
      await flushMicrotasks();
      expect(trigger2).toHaveFocus();
      expect(onValueChange.mock.calls.filter((call) => call[0] === 'item-2')).toHaveLength(0);

      await user.keyboard('{ArrowDown}');
      await flushMicrotasks();

      expect(onValueChange.mock.calls.filter((call) => call[0] === 'item-2')).toHaveLength(1);
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
    });

    it.each([
      ['0', 0],
      ['empty string', ''],
      ['false', false],
    ] as const)('treats a falsy item value (%s) as a valid open value', async (_label, itemValue) => {
      const onValueChange = vi.fn();
      render(() => (
        <NavigationMenu.Root onValueChange={onValueChange}>
          <NavigationMenu.List>
            <NavigationMenu.Item value={itemValue}>
              <NavigationMenu.Trigger data-testid="trigger-0">Zero</NavigationMenu.Trigger>
              <NavigationMenu.Content data-testid="popup-0">
                <NavigationMenu.Link href="#link-0">Zero link</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup>
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger-0');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.lastCall?.[0]).toBe(itemValue);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByTestId('popup-0')).not.toBe(null);
    });

    it('should be controlled by value prop', async () => {
      const { setProps } = renderWithProps(
        (props: { value: string | null }) => <TestNavigationMenu value={props.value} />,
        { value: 'item-1' },
      );

      let trigger1 = screen.getByTestId('trigger-1');
      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      tick(OPEN_DELAY);
      await flushMicrotasks();
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');

      await setProps({ value: 'item-2' });

      const trigger2 = screen.getByTestId('trigger-2');
      fireEvent.mouseLeave(trigger1);
      fireEvent.mouseEnter(trigger2);
      fireEvent.mouseMove(trigger2);
      await flushMicrotasks();

      trigger1 = screen.getByTestId('trigger-1');
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
    });

    async function expectPopupSizePreservedWhenControlledValueClosesExternally(
      keepMountedPortal = false,
    ) {
      const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
      const originalOffsetWidth = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'offsetWidth',
      );
      const originalOffsetHeight = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'offsetHeight',
      );
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      try {
        function isPopupOpen() {
          return screen.queryByTestId('popup-1')?.hasAttribute('data-open') ?? false;
        }

        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
          configurable: true,
          get() {
            if (this.getAttribute('data-testid') === 'popup-root') {
              return isPopupOpen() ? 675 : 0;
            }

            return originalOffsetWidth?.get?.call(this) ?? 0;
          },
        });
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
          configurable: true,
          get() {
            if (this.getAttribute('data-testid') === 'popup-root') {
              return isPopupOpen() ? 220 : 0;
            }

            return originalOffsetHeight?.get?.call(this) ?? 0;
          },
        });

        const { setProps } = renderWithProps(
          (props: { value: string | null }) => (
            <TestNavigationMenu value={props.value} keepMountedPortal={keepMountedPortal} />
          ),
          { value: 'item-1' as string | null },
        );
        await flushMicrotasks();

        const positioner = screen.getByTestId('top-level-positioner');
        const popupRoot = screen.getByTestId('popup-root');
        const animations = mockAnimations(popupRoot);

        animations.start();
        await setProps({ value: null });
        await flushMicrotasks();

        expect(popupRoot).toHaveAttribute('data-ending-style');
        expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('675px');
        expect(popupRoot.style.getPropertyValue('--popup-height')).toBe('220px');
        expect(positioner.style.getPropertyValue('--positioner-width')).toBe('675px');
        expect(positioner.style.getPropertyValue('--positioner-height')).toBe('220px');

        await act(async () => {
          animations.finish();
          await flushMicrotasks();
        });
      } finally {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
        if (originalOffsetWidth) {
          Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
        } else {
          Reflect.deleteProperty(HTMLElement.prototype, 'offsetWidth');
        }
        if (originalOffsetHeight) {
          Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
        } else {
          Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight');
        }
      }
    }

    it('preserves popup size when controlled value closes externally', async () => {
      await expectPopupSizePreservedWhenControlledValueClosesExternally();
    });

    it('preserves popup size when controlled value closes externally with keepMounted portal', async () => {
      await expectPopupSizePreservedWhenControlledValueClosesExternally(true);
    });

    it('clears activation direction when controlled value closes externally after switching triggers', async () => {
      const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      try {
        const { setProps } = renderWithProps(
          (props: { value: string | null }) => <TestNavigationMenu value={props.value} />,
          { value: 'item-1' as string | null },
        );
        await flushMicrotasks();

        const trigger1 = screen.getByTestId('trigger-1');
        const trigger2 = screen.getByTestId('trigger-2');

        mockBoundingClientRect(trigger1, { x: 0, y: 0, width: 80, height: 32 });
        mockBoundingClientRect(trigger2, { x: 120, y: 0, width: 80, height: 32 });

        fireEvent.click(trigger2);
        await setProps({ value: 'item-2' });

        expect(screen.getByTestId('popup-2')).toHaveAttribute('data-activation-direction', 'right');

        const exitingContent = screen.getByTestId('popup-2');
        const animations = mockAnimations(exitingContent);

        animations.start();
        await setProps({ value: null });

        expect(exitingContent).toHaveAttribute('data-ending-style');
        expect(exitingContent).not.toHaveAttribute('data-activation-direction');

        await act(async () => {
          animations.finish();
          await flushMicrotasks();
        });
      } finally {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
      }
    });
  });

  describe('prop: delay', () => {
    it('respects custom delay value', async () => {
      const customDelay = 100;
      render(() => <TestNavigationMenu delay={customDelay} />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      tick(customDelay - 25);
      await flushMicrotasks();

      // Menu shouldn't be open yet since we're before the delay
      expect(screen.queryByTestId('popup-1')).toBe(null);

      tick(50);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('prop: closeDelay', () => {
    it('respects custom closeDelay value', async () => {
      const customCloseDelay = 100;
      render(() => <TestNavigationMenu closeDelay={customCloseDelay} />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      tick(OPEN_DELAY);
      await flushMicrotasks();
      expect(screen.queryByTestId('popup-1')).not.toBe(null);

      fireEvent.mouseLeave(trigger);
      tick(customCloseDelay - 25);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);

      // Complete the closeDelay
      tick(50);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('prop: disabled', () => {
    it('does not open on hover when the trigger is disabled', async () => {
      const onValueChange = vi.fn();
      render(() => <TestNavigationMenuWithDisabledTrigger onValueChange={onValueChange} />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not open on click when the trigger is disabled', async () => {
      const onValueChange = vi.fn();
      render(() => <TestNavigationMenuWithDisabledTrigger onValueChange={onValueChange} />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not open on touch when the trigger is disabled', async () => {
      const onValueChange = vi.fn();
      render(() => <TestNavigationMenuWithDisabledTrigger onValueChange={onValueChange} />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      fireEvent.pointerUp(trigger, { pointerType: 'touch' });
      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not open via keyboard when the trigger is disabled', async () => {
      const onValueChange = vi.fn();
      const { user } = renderWithUser(() => (
        <TestNavigationMenuWithDisabledTrigger onValueChange={onValueChange} />
      ));
      const trigger = screen.getByTestId('trigger-1');

      await act(async () => {
        trigger.focus();
      });
      await user.keyboard('{ArrowDown}');
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('prop: actionsRef', () => {
    function createActionsRef(): { current: NavigationMenu.Root.Actions | null } {
      return { current: null };
    }

    it('automatically unmounts with an actions ref and completes closing once', async () => {
      const actionsRef = createActionsRef();
      const onOpenChangeComplete = vi.fn();

      const { setProps } = renderWithProps(
        (props: { value: string | null }) => (
          <TestNavigationMenu
            value={props.value}
            actionsRef={actionsRef}
            onOpenChangeComplete={onOpenChangeComplete}
          />
        ),
        { value: 'item-1' as string | null },
      );
      await flushMicrotasks();

      expect(actionsRef.current?.unmount).toBeTypeOf('function');
      expect(screen.queryByTestId('popup-root')).not.toBe(null);

      await setProps({ value: null });
      await waitFor(() => {
        expect(screen.queryByTestId('popup-root')).toBe(null);
      });
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);

      // Calling the action after the automatic unmount must not repeat the completion.
      await act(async () => {
        actionsRef.current?.unmount();
      });
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
    });

    it('keeps the popup mounted until the unmount action completes closing', async () => {
      const actionsRef = createActionsRef();
      const onOpenChangeComplete = vi.fn();

      const { setProps } = renderWithProps(
        (props: { value: string | null }) => (
          <TestNavigationMenu
            value={props.value}
            actionsRef={actionsRef}
            onOpenChangeComplete={onOpenChangeComplete}
            onValueChange={(value, details) => {
              if (value == null) {
                details.preventUnmountOnClose();
              }
            }}
          />
        ),
        { value: 'item-1' as string | null },
      );
      await flushMicrotasks();
      expect(screen.queryByTestId('popup-root')).not.toBe(null);

      // The controlled close never runs `onValueChange`, so it doesn't opt out on its own.
      await act(async () => {
        actionsRef.current?.close();
      });
      await flushMicrotasks();
      expect(screen.queryByTestId('popup-root')).not.toBe(null);

      await setProps({ value: null });
      await flushMicrotasks();
      expect(screen.queryByTestId('popup-root')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

      await act(async () => {
        actionsRef.current?.unmount();
      });
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-root')).toBe(null);
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
    });

    it('closes through the `close` action so `onValueChange` can opt out', async () => {
      const actionsRef = createActionsRef();
      const onValueChange = vi.fn();

      render(() => (
        <TestNavigationMenu
          defaultValue="item-1"
          actionsRef={actionsRef}
          onValueChange={onValueChange}
        />
      ));
      await flushMicrotasks();
      expect(screen.getByTestId('trigger-1')).toHaveAttribute('aria-expanded', 'true');

      await act(async () => {
        actionsRef.current?.close();
      });

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0][0]).toBe(null);
      expect(onValueChange.mock.calls[0][1].reason).toBe('imperative-action');
      expect(screen.getByTestId('trigger-1')).toHaveAttribute('aria-expanded', 'false');
    });

    it('keeps the opt-out when the `close` action is called again while closed', async () => {
      const actionsRef = createActionsRef();
      const onOpenChangeComplete = vi.fn();

      render(() => (
        <TestNavigationMenu
          defaultValue="item-1"
          actionsRef={actionsRef}
          onOpenChangeComplete={onOpenChangeComplete}
          onValueChange={(value, details) => {
            if (value == null) {
              details.preventUnmountOnClose();
            }
          }}
        />
      ));
      await flushMicrotasks();

      await act(async () => {
        actionsRef.current?.close();
      });
      await act(async () => {
        actionsRef.current?.close();
      });
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-root')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

      await act(async () => {
        actionsRef.current?.unmount();
      });
      expect(screen.queryByTestId('popup-root')).toBe(null);
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
    });

    it('keeps the opt-out when focus leaves the trigger during a manual exit', async () => {
      const actionsRef = createActionsRef();
      const onOpenChangeComplete = vi.fn();

      const { user } = renderWithUser(() => (
        <div>
          <TestNavigationMenu
            defaultValue="item-1"
            actionsRef={actionsRef}
            onOpenChangeComplete={onOpenChangeComplete}
            onValueChange={(value, details) => {
              if (value == null) {
                details.preventUnmountOnClose();
              }
            }}
          />
          <button data-testid="outside">Outside</button>
        </div>
      ));
      await flushMicrotasks();

      const trigger = screen.getByTestId('trigger-1');
      await act(async () => trigger.focus());
      await act(async () => {
        actionsRef.current?.close();
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-root')).not.toBe(null);

      // The trigger's blur requests another close while the popup is still exiting.
      await user.click(screen.getByTestId('outside'));
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-root')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

      await act(async () => {
        actionsRef.current?.unmount();
      });
      expect(screen.queryByTestId('popup-root')).toBe(null);
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
    });

    it('ignores `unmount` while the popup is open', async () => {
      const actionsRef = createActionsRef();
      const onOpenChangeComplete = vi.fn();
      render(() => (
        <TestNavigationMenu
          defaultValue="item-1"
          actionsRef={actionsRef}
          onOpenChangeComplete={onOpenChangeComplete}
        />
      ));
      await flushMicrotasks();
      const popup = screen.getByTestId('popup-root');

      await act(async () => {
        actionsRef.current?.unmount();
      });

      expect(screen.getByTestId('popup-root')).toBe(popup);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      expect(screen.getByTestId('trigger-1')).toHaveAttribute('aria-expanded', 'true');
    });

    it('still unmounts on a later close after `unmount` was called while open', async () => {
      const actionsRef = createActionsRef();
      const onOpenChangeComplete = vi.fn();

      const { setProps } = renderWithProps(
        (props: { value: string | null }) => (
          <TestNavigationMenu
            value={props.value}
            actionsRef={actionsRef}
            onOpenChangeComplete={onOpenChangeComplete}
          />
        ),
        { value: 'item-1' as string | null },
      );
      await flushMicrotasks();

      // A stale exit-animation callback can call `unmount()` after a quick reopen.
      await act(async () => {
        actionsRef.current?.unmount();
      });
      expect(screen.queryByTestId('popup-root')).not.toBe(null);

      await setProps({ value: null });
      await waitFor(() => {
        expect(screen.queryByTestId('popup-root')).toBe(null);
      });
      expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
    });

    it('unmounts immediately when called while the popup is closing', async () => {
      const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      try {
        const actionsRef = createActionsRef();

        const { setProps } = renderWithProps(
          (props: { value: string | null }) => (
            <TestNavigationMenu
              value={props.value}
              actionsRef={actionsRef}
              onValueChange={(value, details) => {
                if (value == null) {
                  details.preventUnmountOnClose();
                }
              }}
            />
          ),
          { value: 'item-1' as string | null },
        );
        await flushMicrotasks();

        const popupRoot = screen.getByTestId('popup-root');
        const animations = mockAnimations(popupRoot);
        const closingAnimation = animations.start();

        await setProps({ value: null });
        await flushMicrotasks();

        expect(popupRoot).toHaveAttribute('data-ending-style');

        await act(async () => {
          actionsRef.current?.unmount();
        });
        await flushMicrotasks();

        expect(screen.queryByTestId('popup-root')).toBe(null);

        await act(async () => {
          animations.finish(closingAnimation);
          await flushMicrotasks();
        });
      } finally {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
      }
    });
  });

  describe('prop: side', () => {
    it.each([
      ['left in LTR', 'ltr', 'left'],
      ['inline-start in LTR', 'ltr', 'inline-start'],
      ['inline-end in RTL', 'rtl', 'inline-end'],
    ] as const)(
      'pins the popup to the right edge when side is %s so it grows leftward',
      async (_label, direction, side) => {
        render(() => (
          <DirectionProvider direction={direction as TextDirection}>
            <NavigationMenu.Root>
              <NavigationMenu.List>
                <NavigationMenu.Item value="item-1">
                  <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>
                  <NavigationMenu.Content>
                    <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>
              <NavigationMenu.Portal>
                <NavigationMenu.Positioner side={side}>
                  <NavigationMenu.Popup data-testid="popup-root">
                    <NavigationMenu.Viewport />
                  </NavigationMenu.Popup>
                </NavigationMenu.Positioner>
              </NavigationMenu.Portal>
            </NavigationMenu.Root>
          </DirectionProvider>
        ));

        const trigger = screen.getByTestId('trigger-1');
        fireEvent.click(trigger);
        await flushMicrotasks();

        const popup = screen.getByTestId('popup-root');
        expect(popup).toHaveAttribute('data-side', side);
        expect(popup).toHaveStyle({ position: 'absolute', top: '0px', right: '0px' });
      },
    );
  });

  describe('tabbing', () => {
    it('moves focus through the menu correctly', async () => {
      const { user } = renderWithUser(() => (
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
        </div>
      ));
      const trigger1 = screen.getByTestId('trigger-1');

      await act(async () => trigger1.focus());

      fireEvent.click(trigger1);
      await flushMicrotasks();

      expect(screen.getByTestId('popup-1')).not.toBe(null);
      expect(trigger1).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Link 1')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Link 2')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('trigger-2')).toHaveFocus();

      fireEvent.click(screen.getByTestId('trigger-2'));
      await flushMicrotasks();

      expect(screen.getByTestId('popup-2')).not.toBe(null);

      await user.tab();
      expect(screen.getByText('Link 3')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Link 4')).toHaveFocus();

      await user.tab({ shift: true });
      await user.tab({ shift: true });
      await user.tab({ shift: true });

      expect(trigger1).toHaveFocus();
    });

    it('closes the menu when tabbing forward out', async () => {
      const { user } = renderWithUser(() => (
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
          <button data-testid="last" />
        </div>
      ));
      const trigger = screen.getByTestId('trigger-1');

      await act(async () => trigger.focus());
      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveFocus();

      await user.tab(); // Link 1
      await user.tab(); // Link 2
      await user.tab(); // trigger 2
      await user.tab(); // last

      expect(screen.queryByTestId('popup-1')).toBe(null);
    });

    it('closes after tabbing out of arbitrary tabbable content', async () => {
      const { user } = renderWithUser(() => (
        <div>
          <NavigationMenu.Root>
            <NavigationMenu.List>
              <NavigationMenu.Item value="item">
                <NavigationMenu.Trigger>Trigger</NavigationMenu.Trigger>
                <NavigationMenu.Content>
                  <button>Action</button>
                </NavigationMenu.Content>
              </NavigationMenu.Item>
            </NavigationMenu.List>
            <NavigationMenu.Portal>
              <NavigationMenu.Positioner>
                <NavigationMenu.Popup data-testid="popup">
                  <NavigationMenu.Viewport />
                </NavigationMenu.Popup>
              </NavigationMenu.Positioner>
            </NavigationMenu.Portal>
          </NavigationMenu.Root>
          <button>After menu</button>
        </div>
      ));

      const trigger = screen.getByText('Trigger');
      await act(async () => trigger.focus());
      fireEvent.click(trigger);
      await flushMicrotasks();

      await user.tab();
      expect(screen.getByText('Action')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('After menu')).toHaveFocus();
      await flushMicrotasks();
      expect(screen.queryByTestId('popup')).toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('returns focus to the trigger when no viewport focus guard is rendered', async () => {
      render(() => (
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item value="item">
              <NavigationMenu.Trigger>Trigger</NavigationMenu.Trigger>
              <NavigationMenu.Content>Content</NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup>Popup</NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>
      ));

      const trigger = screen.getByText('Trigger');
      await act(async () => trigger.focus());
      fireEvent.click(trigger);
      await flushMicrotasks();

      const guards = trigger.parentElement?.querySelectorAll('[data-base-ui-focus-guard]');
      const afterTriggerGuard = guards?.[1] as HTMLElement;
      await act(async () => afterTriggerGuard.focus());

      expect(trigger).toHaveFocus();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('returns to the last submenu item when shift+tabbing after tabbing out of it', async () => {
      const { user } = renderWithUser(() => (
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
          <button data-testid="last" />
        </div>
      ));
      const trigger = screen.getByTestId('trigger-1');

      await act(async () => trigger.focus());
      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Link 1')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Link 2')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('trigger-2')).toHaveFocus();

      await user.tab({ shift: true });
      expect(screen.getByText('Link 2')).toHaveFocus();
    });

    it('closes the menu when tabbing back out', async () => {
      const { user } = renderWithUser(() => (
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
        </div>
      ));
      const trigger = screen.getByTestId('trigger-1');

      await act(async () => trigger.focus());
      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Link 1')).toHaveFocus();

      await user.tab({ shift: true }); // trigger 1
      await user.tab({ shift: true }); // first
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
    });
  });

  describe('nested popups', () => {
    function TestNavigationMenuWithDialog() {
      return (
        <TestNavigationMenuWithNestedPopup>
          <Dialog.Root>
            <Dialog.Trigger data-testid="dialog-trigger">Open dialog</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup
                data-testid="dialog-popup"
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <button type="button" data-testid="dialog-button">
                  Dialog button
                </button>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </TestNavigationMenuWithNestedPopup>
      );
    }

    it('keeps a hover-open menu open when pointerdown happens on a nested dialog trigger', async () => {
      const { user } = renderWithUser(() => <TestNavigationMenuWithDialog />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      const popup = screen.getByTestId('popup-1');
      const dialogTrigger = screen.getByTestId('dialog-trigger');

      fireEvent.pointerDown(dialogTrigger, { pointerType: 'mouse' });
      fireEvent.mouseLeave(popup);

      await user.click(dialogTrigger);

      expect(await screen.findByTestId('dialog-popup')).not.toBe(null);
      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('keeps the menu open when interacting with a nested dialog', async () => {
      const { user } = renderWithUser(() => <TestNavigationMenuWithDialog />);
      const trigger = screen.getByTestId('trigger-1');

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      const dialogTrigger = screen.getByTestId('dialog-trigger');
      await user.click(dialogTrigger);

      expect(await screen.findByTestId('dialog-popup')).not.toBe(null);

      await user.click(screen.getByTestId('dialog-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    // Skipped: the nested Popover case. Popover is ported separately; the Dialog cases above cover
    // the same nested-popup dismissal paths.
  });

  describe('nested menus', () => {
    it('opens nested menu on hover and stays open when hovering over nested popup', async () => {
      render(() => <TestNestedNavigationMenu />);
      const trigger1 = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      const popup1 = screen.getByTestId('popup-1');
      expect(popup1).not.toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');

      const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');

      fireEvent.mouseEnter(nestedTrigger1);
      fireEvent.mouseMove(nestedTrigger1);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      const nestedPopup1 = screen.getByTestId('nested-popup-1');
      expect(nestedPopup1).not.toBe(null);
      expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');

      fireEvent.mouseEnter(nestedPopup1);
      fireEvent.mouseMove(nestedPopup1);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(screen.queryByTestId('nested-popup-1')).not.toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');
      expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');
    });

    it('handles inline nested menu without positioner/popup correctly', async () => {
      render(() => <TestInlineNestedNavigationMenu />);
      const trigger1 = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      const popup1 = screen.getByTestId('popup-1');
      expect(popup1).not.toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');

      const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');

      fireEvent.mouseEnter(nestedTrigger1);
      fireEvent.mouseMove(nestedTrigger1);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      const nestedPopup1 = screen.getByTestId('nested-popup-1');
      expect(nestedPopup1).not.toBe(null);
      expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');

      fireEvent.mouseEnter(nestedPopup1);
      fireEvent.mouseMove(nestedPopup1);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(screen.queryByTestId('nested-popup-1')).not.toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');
      expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');

      const nestedTrigger2 = within(popup1).getByTestId('nested-trigger-2');
      fireEvent.mouseEnter(nestedTrigger2);
      fireEvent.mouseMove(nestedTrigger2);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      const nestedPopup2 = screen.getByTestId('nested-popup-2');
      expect(nestedPopup2).not.toBe(null);
      expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'true');
      expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'false');
    });

    it('keeps parent menu open when hovering inline nested triggers without defaultValue', async () => {
      render(() => <TestInlineNestedNavigationMenu nestedDefaultValue={null} />);
      const trigger1 = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      const popup1 = screen.getByTestId('popup-1');
      const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');
      expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'false');

      fireEvent.mouseEnter(nestedTrigger1);
      fireEvent.mouseMove(nestedTrigger1);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('nested-popup-1')).not.toBe(null);
      expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');

      const nestedTrigger2 = within(popup1).getByTestId('nested-trigger-2');
      fireEvent.mouseEnter(nestedTrigger2);
      fireEvent.mouseMove(nestedTrigger2);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('nested-popup-2')).not.toBe(null);
      expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes the parent menu after a nested submenu closes on delayed hover-out', async () => {
      const closeDelay = 200;

      render(() => <TestNestedNavigationMenu closeDelay={closeDelay} />);
      const trigger1 = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      const popup1 = screen.getByTestId('popup-1');
      const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');
      const topLevelPositioner = screen.getByTestId('top-level-positioner');

      fireEvent.mouseEnter(nestedTrigger1);
      fireEvent.mouseMove(nestedTrigger1);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      const nestedPopup1 = screen.getByTestId('nested-popup-1');
      const nestedPositioner = screen.getByTestId('nested-positioner');
      expect(nestedPopup1).not.toBe(null);

      fireEvent.mouseLeave(nestedTrigger1);
      fireEvent.mouseLeave(nestedPositioner);
      fireEvent.mouseLeave(topLevelPositioner);
      tick(closeDelay);
      await flushMicrotasks();

      expect(screen.queryByTestId('nested-popup-1')).toBe(null);
      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes the parent menu when a nested link with closeOnClick is clicked', async () => {
      const { user } = renderWithUser(() => <TestNestedNavigationMenuWithCloseOnClick />);
      const trigger1 = screen.getByTestId('trigger-1');

      await user.click(trigger1);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });

      const popup1 = screen.getByTestId('popup-1');
      const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');

      fireEvent.mouseEnter(nestedTrigger1);
      fireEvent.mouseMove(nestedTrigger1);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(screen.queryByTestId('nested-popup-1')).not.toBe(null);

      const nestedLink = screen.getByTestId('nested-link-1');
      await user.click(nestedLink);

      await waitFor(() => {
        expect(screen.queryByTestId('nested-popup-1')).toBe(null);
      });
      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
    });

    it('calls onValueChange on the parent root when nested closeOnClick link is clicked', async () => {
      const onValueChange = vi.fn();
      const { user } = renderWithUser(() => (
        <TestNestedNavigationMenuWithCloseOnClick onValueChange={onValueChange} />
      ));
      const trigger1 = screen.getByTestId('trigger-1');

      await user.click(trigger1);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });

      const popup1 = screen.getByTestId('popup-1');
      const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');

      fireEvent.mouseEnter(nestedTrigger1);
      fireEvent.mouseMove(nestedTrigger1);
      tick(OPEN_DELAY);
      await flushMicrotasks();

      const nestedLink = screen.getByTestId('nested-link-1');
      await user.click(nestedLink);

      await waitFor(() => {
        expect(onValueChange.mock.lastCall?.[0]).toBe(null);
      });
    });

    it('closes all levels when a deeply nested link with closeOnClick is clicked', async () => {
      const { user } = renderWithUser(() => <TestDeeplyNestedNavigationMenuWithCloseOnClick />);
      const trigger1 = screen.getByTestId('trigger-1');

      await user.click(trigger1);

      await waitFor(() => {
        expect(screen.queryByTestId('content-1')).not.toBe(null);
      });

      expect(screen.queryByTestId('level2-content-1')).not.toBe(null);
      expect(screen.queryByTestId('level3-content-1')).not.toBe(null);

      const level3Link = screen.getByTestId('level3-link-1');
      await user.click(level3Link);

      await waitFor(() => {
        expect(screen.queryByTestId('level3-content-1')).toBe(null);
      });
      expect(screen.queryByTestId('level2-content-1')).toBe(null);
      expect(screen.queryByTestId('content-1')).toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
    });

    describe('inline nested viewport', () => {
      it('renders viewport content correctly for inline nested menu', async () => {
        render(() => <TestInlineNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.mouseEnter(trigger1);
        fireEvent.mouseMove(trigger1);
        tick(OPEN_DELAY);
        await flushMicrotasks();

        const popup1 = screen.getByTestId('popup-1');
        expect(popup1).not.toBe(null);

        const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');
        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');

        const nestedPopup1 = screen.getByTestId('nested-popup-1');
        expect(nestedPopup1).not.toBe(null);
        expect(screen.getByText('Nested Link 1')).not.toBe(null);
      });

      it('switches content in viewport when hovering different nested triggers', async () => {
        render(() => <TestInlineNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.mouseEnter(trigger1);
        fireEvent.mouseMove(trigger1);
        tick(OPEN_DELAY);
        await flushMicrotasks();

        const popup1 = screen.getByTestId('popup-1');
        const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');
        const nestedTrigger2 = within(popup1).getByTestId('nested-trigger-2');

        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByTestId('nested-popup-1')).not.toBe(null);

        fireEvent.mouseEnter(nestedTrigger2);
        fireEvent.mouseMove(nestedTrigger2);
        tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'true');
        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByTestId('nested-popup-2')).not.toBe(null);
        expect(screen.queryByTestId('nested-popup-1')).toBe(null);

        fireEvent.mouseEnter(nestedTrigger1);
        fireEvent.mouseMove(nestedTrigger1);
        tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');
        expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByTestId('nested-popup-1')).not.toBe(null);
        expect(screen.queryByTestId('nested-popup-2')).toBe(null);
      });

      it('scopes inline safePolygon pointer events to the submenu list while traversing to the viewport', async () => {
        render(() => <TestInlineNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.mouseEnter(trigger1);
        fireEvent.mouseMove(trigger1);
        tick(OPEN_DELAY);
        await flushMicrotasks();

        const nestedList = screen.getByTestId('inline-nested-list');
        const nestedTrigger1 = screen.getByTestId('nested-trigger-1');
        const nestedViewport = screen.getByTestId('inline-nested-viewport');

        mockBoundingClientRect(nestedTrigger1, { x: 0, y: 40, width: 100, height: 40 });
        mockBoundingClientRect(nestedViewport, { x: 200, y: 0, width: 300, height: 300 });
        fireEvent.mouseEnter(nestedTrigger1);

        expect(nestedList.style.pointerEvents).toBe('none');

        fireEvent.mouseLeave(nestedTrigger1, {
          clientX: 98,
          clientY: 60,
        });

        expect(nestedList.style.pointerEvents).toBe('none');
        expect(document.body.style.pointerEvents).toBe('');

        fireEvent.mouseMove(document, { clientX: 150, clientY: 80 });
        await flushMicrotasks();

        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByTestId('nested-popup-1')).not.toBe(null);
        expect(nestedList.style.pointerEvents).toBe('none');

        fireEvent.mouseEnter(nestedViewport);
        await flushMicrotasks();

        expect(nestedList.style.pointerEvents).toBe('');
      });

      it.each([
        [
          'right',
          { x: 0, y: 0, width: 100, height: 100 },
          { x: 120, y: 0, width: 100, height: 100 },
          { clientX: 100, clientY: 50 },
          { clientX: 110, clientY: 50 },
        ],
        [
          'left',
          { x: 0, y: 0, width: 100, height: 100 },
          { x: -120, y: 0, width: 100, height: 100 },
          { clientX: 0, clientY: 50 },
          { clientX: -10, clientY: 50 },
        ],
        [
          'bottom',
          { x: 0, y: 0, width: 100, height: 100 },
          { x: 0, y: 120, width: 100, height: 100 },
          { clientX: 50, clientY: 100 },
          { clientX: 50, clientY: 110 },
        ],
        [
          'top',
          { x: 0, y: 0, width: 100, height: 100 },
          { x: 0, y: -120, width: 100, height: 100 },
          { clientX: 50, clientY: 0 },
          { clientX: 50, clientY: -10 },
        ],
      ] as const)(
        'keeps an inline submenu open while traversing toward a viewport on the %s',
        async (_placement, triggerRect, viewportRect, leavePoint, traversePoint) => {
          render(() => <TestInlineNestedNavigationMenu nestedDefaultValue={null} />);
          const trigger = screen.getByTestId('trigger-1');
          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger);
          tick(OPEN_DELAY);
          await flushMicrotasks();

          const nestedTrigger = screen.getByTestId('nested-trigger-1');
          const nestedViewport = screen.getByTestId('inline-nested-viewport');
          const nestedList = screen.getByTestId('inline-nested-list');
          mockBoundingClientRect(nestedTrigger, triggerRect);
          mockBoundingClientRect(nestedViewport, viewportRect);

          fireEvent.mouseEnter(nestedTrigger);
          fireEvent.mouseMove(nestedTrigger);
          tick(OPEN_DELAY);
          await flushMicrotasks();

          expect(nestedTrigger).toHaveAttribute('aria-expanded', 'true');
          expect(nestedList.style.pointerEvents).toBe('none');
          fireEvent.mouseLeave(nestedTrigger, leavePoint);
          fireEvent.mouseMove(document, traversePoint);
          expect(nestedList.style.pointerEvents).toBe('none');
          tick(50); // closeDelay
          await flushMicrotasks();

          expect(nestedTrigger).toHaveAttribute('aria-expanded', 'true');
          expect(screen.queryByTestId('nested-popup-1')).not.toBe(null);
        },
      );

      it('clears inline safePolygon pointer events when the pointer leaves the traversal path', async () => {
        render(() => <TestInlineNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.mouseEnter(trigger1);
        fireEvent.mouseMove(trigger1);
        tick(OPEN_DELAY);
        await flushMicrotasks();

        const nestedList = screen.getByTestId('inline-nested-list');
        const nestedTrigger1 = screen.getByTestId('nested-trigger-1');
        const nestedViewport = screen.getByTestId('inline-nested-viewport');

        mockBoundingClientRect(nestedTrigger1, { x: 0, y: 40, width: 100, height: 40 });
        mockBoundingClientRect(nestedViewport, { x: 200, y: 0, width: 300, height: 300 });
        fireEvent.mouseEnter(nestedTrigger1);

        expect(nestedList.style.pointerEvents).toBe('none');

        fireEvent.mouseLeave(nestedTrigger1, {
          clientX: 98,
          clientY: 60,
        });
        expect(nestedList.style.pointerEvents).toBe('none');

        fireEvent.mouseMove(document, { clientX: 40, clientY: 220 });
        await flushMicrotasks();

        expect(nestedList.style.pointerEvents).toBe('');
        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByTestId('nested-popup-1')).not.toBe(null);
      });

      it('keeps inline safePolygon pointer events when returning to the original trigger before traversing again', async () => {
        render(() => <TestInlineNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.mouseEnter(trigger1);
        fireEvent.mouseMove(trigger1);
        tick(OPEN_DELAY);
        await flushMicrotasks();

        const nestedList = screen.getByTestId('inline-nested-list');
        const nestedTrigger1 = screen.getByTestId('nested-trigger-1');
        const nestedTrigger2 = screen.getByTestId('nested-trigger-2');
        const nestedViewport = screen.getByTestId('inline-nested-viewport');

        mockBoundingClientRect(nestedTrigger1, { x: 0, y: 40, width: 100, height: 40 });
        mockBoundingClientRect(nestedTrigger2, { x: 0, y: 100, width: 100, height: 40 });
        mockBoundingClientRect(nestedViewport, { x: 200, y: 0, width: 300, height: 300 });

        fireEvent.mouseEnter(nestedTrigger1);
        fireEvent.mouseLeave(nestedTrigger1, {
          clientX: 98,
          clientY: 60,
        });
        fireEvent.mouseMove(document, { clientX: 150, clientY: 80 });
        await flushMicrotasks();
        fireEvent.mouseEnter(nestedViewport);
        await flushMicrotasks();

        fireEvent.mouseEnter(nestedTrigger2);
        fireEvent.mouseMove(nestedTrigger2);
        tick(OPEN_DELAY);
        await flushMicrotasks();

        fireEvent.mouseEnter(nestedTrigger1);
        fireEvent.mouseMove(nestedTrigger1);
        tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(nestedList.style.pointerEvents).toBe('none');

        fireEvent.mouseLeave(nestedTrigger1, {
          clientX: 98,
          clientY: 60,
        });
        fireEvent.mouseMove(document, { clientX: 150, clientY: 80 });
        await flushMicrotasks();

        expect(nestedList.style.pointerEvents).toBe('none');
        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');
        expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByTestId('nested-popup-1')).not.toBe(null);
        expect(screen.queryByTestId('nested-popup-2')).toBe(null);
      });

      it('closes inline nested viewport when parent menu closes', async () => {
        render(() => <TestInlineNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.mouseEnter(trigger1);
        fireEvent.mouseMove(trigger1);
        tick(OPEN_DELAY);
        await flushMicrotasks();

        const popup1 = screen.getByTestId('popup-1');
        expect(popup1).not.toBe(null);

        const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');
        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByTestId('nested-popup-1')).not.toBe(null);

        fireEvent.mouseLeave(trigger1);
        fireEvent.mouseLeave(popup1);
        tick(50); // closeDelay
        await flushMicrotasks();

        expect(screen.queryByTestId('popup-1')).toBe(null);
        expect(screen.queryByTestId('nested-popup-1')).toBe(null);
        expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      });

      it('maintains inline viewport state when hovering between triggers and content', async () => {
        render(() => <TestInlineNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.mouseEnter(trigger1);
        fireEvent.mouseMove(trigger1);
        tick(OPEN_DELAY);
        await flushMicrotasks();

        const popup1 = screen.getByTestId('popup-1');

        const nestedTrigger2 = within(popup1).getByTestId('nested-trigger-2');
        fireEvent.mouseEnter(nestedTrigger2);
        fireEvent.mouseMove(nestedTrigger2);
        tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'true');
        const nestedPopup2 = screen.getByTestId('nested-popup-2');
        expect(nestedPopup2).not.toBe(null);

        fireEvent.mouseEnter(nestedPopup2);
        fireEvent.mouseMove(nestedPopup2);
        await flushMicrotasks();

        expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByTestId('nested-popup-2')).not.toBe(null);

        fireEvent.mouseEnter(nestedTrigger2);
        fireEvent.mouseMove(nestedTrigger2);
        await flushMicrotasks();

        expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByTestId('nested-popup-2')).not.toBe(null);
      });

      it('handles click interactions on inline nested menu triggers', async () => {
        render(() => <TestInlineNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.click(trigger1);
        await flushMicrotasks();

        const popup1 = screen.getByTestId('popup-1');
        expect(popup1).not.toBe(null);

        const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');
        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');

        const nestedTrigger2 = within(popup1).getByTestId('nested-trigger-2');
        fireEvent.click(nestedTrigger2);
        await flushMicrotasks();

        expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'true');
        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByTestId('nested-popup-2')).not.toBe(null);
        expect(screen.queryByTestId('nested-popup-1')).toBe(null);

        fireEvent.click(nestedTrigger2);
        await flushMicrotasks();

        expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'true');
        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByTestId('nested-popup-2')).not.toBe(null);
        expect(screen.queryByTestId('nested-popup-1')).toBe(null);
      });

      it('adds popup-open data attributes to the active icon', async () => {
        render(() => (
          <NavigationMenu.Root defaultValue="item-1">
            <NavigationMenu.List>
              <NavigationMenu.Item value="item-1">
                <NavigationMenu.Trigger>
                  Item 1
                  <NavigationMenu.Icon data-testid="icon-1" />
                </NavigationMenu.Trigger>
                <NavigationMenu.Content>
                  <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
                </NavigationMenu.Content>
              </NavigationMenu.Item>
              <NavigationMenu.Item value="item-2">
                <NavigationMenu.Trigger>
                  Item 2
                  <NavigationMenu.Icon data-testid="icon-2" />
                </NavigationMenu.Trigger>
                <NavigationMenu.Content>
                  <NavigationMenu.Link href="#link-2">Link 2</NavigationMenu.Link>
                </NavigationMenu.Content>
              </NavigationMenu.Item>
            </NavigationMenu.List>

            <NavigationMenu.Portal>
              <NavigationMenu.Positioner>
                <NavigationMenu.Popup>
                  <NavigationMenu.Viewport />
                </NavigationMenu.Popup>
              </NavigationMenu.Positioner>
            </NavigationMenu.Portal>
          </NavigationMenu.Root>
        ));

        expect(screen.getByTestId('icon-1')).toHaveAttribute('data-popup-open');
        expect(screen.getByTestId('icon-2')).not.toHaveAttribute('data-popup-open');
      });

      it.each(FALSY_VALUE_CASES)(
        'treats a falsy value (%s) as open for inline nested trigger interactions',
        async (_label, itemValue) => {
          render(() => (
            <TestInlineNestedNavigationMenu
              nestedDefaultValue={itemValue}
              nestedItem1Value={itemValue}
            />
          ));
          const trigger1 = screen.getByTestId('trigger-1');

          fireEvent.click(trigger1);
          await flushMicrotasks();

          const popup1 = screen.getByTestId('popup-1');
          const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');
          expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');
          expect(screen.queryByTestId('nested-popup-1')).not.toBe(null);

          fireEvent.click(nestedTrigger1);
          await flushMicrotasks();

          expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');
          expect(screen.queryByTestId('nested-popup-1')).not.toBe(null);
        },
      );

      it('propagates a nested close with a falsy open value to the parent root', async () => {
        render(() => (
          <TestInlineNestedNavigationMenu
            nestedDefaultValue={false}
            nestedItem1Value={false}
            nestedLinkCloseOnClick
          />
        ));
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.click(trigger1);
        await flushMicrotasks();

        const popup1 = screen.getByTestId('popup-1');
        const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');
        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');

        fireEvent.click(screen.getByText('Nested Link 1'));
        await flushMicrotasks();

        expect(trigger1).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByTestId('popup-1')).toBe(null);
      });

      it('allows arrow key navigation to submenu triggers', async () => {
        const { user } = renderWithUser(() => <TestInlineNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.click(trigger1);
        await flushMicrotasks();

        const popup1 = screen.getByTestId('popup-1');
        expect(popup1).not.toBe(null);

        const link1 = screen.getByText('Link 1');
        await act(async () => link1.focus());

        // Arrow down should move to nested-trigger-1
        await user.keyboard('{ArrowDown}');

        const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');
        expect(nestedTrigger1).toHaveFocus();

        // Arrow down should move to nested-trigger-2
        await user.keyboard('{ArrowDown}');

        const nestedTrigger2 = within(popup1).getByTestId('nested-trigger-2');
        expect(nestedTrigger2).toHaveFocus();

        // Arrow up should move back to nested-trigger-1
        await user.keyboard('{ArrowUp}');
        expect(nestedTrigger1).toHaveFocus();

        // Arrow up should move back to Link 1
        await user.keyboard('{ArrowUp}');
        expect(link1).toHaveFocus();
      });

      it('allows arrow key navigation with 3+ levels of nesting', async () => {
        const { user } = renderWithUser(() => <TestDeeplyNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.click(trigger1);
        await flushMicrotasks();

        const content1 = screen.getByTestId('content-1');
        expect(content1).not.toBe(null);

        // Level 1 content contains: Link 1, Level2-trigger-1, Level2-trigger-2
        const link1 = screen.getByTestId('link-1');
        await act(async () => link1.focus());

        // Navigate through Level 1 content items
        await user.keyboard('{ArrowDown}');
        const level2Trigger1 = screen.getByTestId('level2-trigger-1');
        expect(level2Trigger1).toHaveFocus();

        await user.keyboard('{ArrowDown}');
        const level2Trigger2 = screen.getByTestId('level2-trigger-2');
        expect(level2Trigger2).toHaveFocus();

        await user.keyboard('{ArrowUp}');
        expect(level2Trigger1).toHaveFocus();

        await user.keyboard('{ArrowUp}');
        expect(link1).toHaveFocus();

        // Now navigate into Level 2 content (which contains Level 3 triggers)
        const level2Content1 = screen.getByTestId('level2-content-1');
        const level2Link1 = within(level2Content1).getByTestId('level2-link-1');
        await act(async () => level2Link1.focus());

        // Navigate through Level 2 content items (includes Level 3 triggers)
        await user.keyboard('{ArrowDown}');
        const level3Trigger1 = screen.getByTestId('level3-trigger-1');
        expect(level3Trigger1).toHaveFocus();

        await user.keyboard('{ArrowDown}');
        const level3Trigger2 = screen.getByTestId('level3-trigger-2');
        expect(level3Trigger2).toHaveFocus();

        await user.keyboard('{ArrowUp}');
        expect(level3Trigger1).toHaveFocus();

        await user.keyboard('{ArrowUp}');
        expect(level2Link1).toHaveFocus();
      });

      it('updates popup sizing when inline nested content is inserted while active', async () => {
        const originalResizeObserver = globalThis.ResizeObserver;
        const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        if (typeof originalResizeObserver === 'function') {
          globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver;
        }

        try {
          render(() => <TestInlineNestedNavigationMenuWithDynamicContent />);
          const trigger1 = screen.getByTestId('trigger-1');

          fireEvent.click(trigger1);
          await flushMicrotasks();

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');
          const animations = mockAnimations(popupRoot);

          const popupWidth = 250;
          let popupHeight = 120;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidth,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => popupHeight,
          });

          popupHeight = 220;
          animations.start();
          fireEvent.click(screen.getByTestId('insert-content'));
          await flushMicrotasks();

          expect(screen.getByTestId('extra-content')).not.toBe(null);
          await waitFor(() => {
            expect(
              parseInt(getComputedStyle(positioner).getPropertyValue('--positioner-height'), 10),
            ).toBe(220);
          });

          await act(async () => {
            await animations.finish();
            await flushMicrotasks();
          });

          await waitFor(() => {
            expect(getPopupSizeVars(popupRoot, positioner)).toEqual({
              popupWidth: 'auto',
              popupHeight: 'auto',
              positionerWidth: '250px',
              positionerHeight: '220px',
            });
          });
        } finally {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
          if (typeof originalResizeObserver === 'function') {
            globalThis.ResizeObserver = originalResizeObserver;
          }
        }
      });

      it('does not animate popup sizing when nested default content mounts during opening', async () => {
        const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        try {
          render(() => <TestInlineNestedNavigationMenu />);
          const trigger1 = screen.getByTestId('trigger-1');

          fireEvent.click(trigger1);
          flush();

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');

          const popupHeightValues = [120, 220];
          const popupWidth = 250;
          let popupHeight = 220;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidth,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => {
              const nextHeight = popupHeightValues.shift();
              if (nextHeight != null) {
                popupHeight = nextHeight;
              }

              return popupHeight;
            },
          });

          await flushMicrotasks();

          expect(screen.getByTestId('nested-popup-1')).not.toBe(null);
          await waitFor(() => {
            expect(getPopupSizeVars(popupRoot, positioner)).toEqual({
              popupWidth: 'auto',
              popupHeight: 'auto',
              positionerWidth: '250px',
              positionerHeight: '220px',
            });
          });
        } finally {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
        }
      });

      it('does not animate popup sizing when kept nested default content first moves into the portal', async () => {
        const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        let setPopupPropertySpy: ReturnType<typeof vi.spyOn> | undefined;

        try {
          render(() => <TestInlineNestedNavigationMenu keepMountedContent />);
          const trigger1 = screen.getByTestId('trigger-1');

          fireEvent.click(trigger1);
          flush();

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');

          setPopupPropertySpy = vi.spyOn(popupRoot.style, 'setProperty');

          // Upstream returns a stale height (120) for the first measurement, which React takes
          // while the kept nested content is still being moved into the portal. Here the move
          // happens synchronously in the opening flush, before anything is measured, so the
          // popup is measured at its final size.
          const popupHeightValues: number[] = [];
          const popupWidth = 250;
          let popupHeight = 220;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidth,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => {
              const nextHeight = popupHeightValues.shift();
              if (nextHeight != null) {
                popupHeight = nextHeight;
              }

              return popupHeight;
            },
          });

          await flushMicrotasks();

          expect(screen.getByTestId('nested-popup-1')).not.toHaveAttribute('hidden');
          await waitFor(() => {
            expect(getPopupSizeVars(popupRoot, positioner)).toEqual({
              popupWidth: 'auto',
              popupHeight: 'auto',
              positionerWidth: '250px',
              positionerHeight: '220px',
            });
          });

          const popupSetPropertyCalls = setPopupPropertySpy.mock.calls as Array<
            [property: string, value: string, priority?: string]
          >;
          const fixedPopupHeightCalls = popupSetPropertyCalls
            .filter((call) => call[0] === '--popup-height')
            .map((call) => call[1])
            .filter((value) => value !== 'auto' && value !== '0px');

          expect(fixedPopupHeightCalls.length).toBeGreaterThan(0);
          expect(fixedPopupHeightCalls.every((value) => value === '220px')).toBe(true);
        } finally {
          setPopupPropertySpy?.mockRestore();
          globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
        }
      });

      it('updates popup sizing when switching kept inline nested content', async () => {
        const restoreResizeObserver = mockResizeObserver();
        const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        try {
          render(() => <TestInlineNestedNavigationMenu keepMountedContent />);
          const trigger1 = screen.getByTestId('trigger-1');

          fireEvent.click(trigger1);
          await flushMicrotasks();

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');
          const animations = mockAnimations(popupRoot);

          const popupWidth = 250;
          let popupHeight = 220;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidth,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => popupHeight,
          });

          primeOpenPopupSize(popupRoot, positioner, 250, 220);

          popupHeight = 300;
          animations.start();
          fireEvent.click(screen.getByTestId('nested-trigger-2'));
          await flushMicrotasks();

          expect(screen.getByTestId('nested-popup-2')).not.toHaveAttribute('hidden');
          await waitFor(() => {
            expect(screen.getByTestId('nested-popup-1')).toHaveAttribute('hidden');
          });
          await waitFor(() => {
            expect(
              parseInt(getComputedStyle(positioner).getPropertyValue('--positioner-height'), 10),
            ).toBe(300);
          });

          await act(async () => {
            await animations.finish();
            await flushMicrotasks();
          });

          await waitFor(() => {
            expect(getPopupSizeVars(popupRoot, positioner)).toEqual({
              popupWidth: 'auto',
              popupHeight: 'auto',
              positionerWidth: '250px',
              positionerHeight: '300px',
            });
          });
        } finally {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
          restoreResizeObserver();
        }
      });

      it('updates popup sizing when a kept nested content hidden attribute changes', async () => {
        const restoreResizeObserver = mockResizeObserver();
        const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        try {
          render(() => <TestInlineNestedNavigationMenu keepMountedContent />);
          const trigger1 = screen.getByTestId('trigger-1');

          fireEvent.click(trigger1);
          await flushMicrotasks();

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');

          const popupWidth = 250;
          let popupHeight = 220;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidth,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => popupHeight,
          });

          primeOpenPopupSize(popupRoot, positioner, 250, 220);

          popupHeight = 300;

          await act(async () => {
            // Contract-level check for the MutationObserver path; the sibling
            // switch test above covers the React-driven `hidden` toggle.
            screen.getByTestId('nested-popup-1').setAttribute('hidden', '');
            await flushMicrotasks();
          });

          await waitFor(() => {
            expect(getPopupSizeVars(popupRoot, positioner)).toMatchObject({
              positionerWidth: '250px',
              positionerHeight: '300px',
            });
          });
        } finally {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
          restoreResizeObserver();
        }
      });

      it('keeps inline mutation resize interruptible when content updates again mid-transition', async () => {
        const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        try {
          render(() => (
            <TestInlineNestedNavigationMenuWithDynamicContent initialContentStage={1} />
          ));
          const trigger1 = screen.getByTestId('trigger-1');

          fireEvent.click(trigger1);
          await flushMicrotasks();

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');
          const animations = mockAnimations(popupRoot);

          const popupWidth = 250;
          const popupHeightValues = [190, 260];
          let popupHeight = 260;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidth,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => {
              const nextHeight = popupHeightValues.shift();
              if (nextHeight != null) {
                popupHeight = nextHeight;
              }

              return popupHeight;
            },
          });

          popupRoot.style.setProperty('--popup-width', '250px');
          popupRoot.style.setProperty('--popup-height', '220px');
          positioner.style.setProperty('--positioner-width', '250px');
          positioner.style.setProperty('--positioner-height', '220px');

          const setPropertySpy = vi.spyOn(positioner.style, 'setProperty');

          animations.start();
          fireEvent.click(screen.getByTestId('insert-content'));
          await flushMicrotasks();

          expect(screen.getByTestId('extra-content-2')).not.toBe(null);
          expect(
            setPropertySpy.mock.calls.some(
              (call) => call[0] === '--positioner-height' && call[1] === '190px',
            ),
          ).toBe(true);

          await act(async () => {
            animations.finish();
            await flushMicrotasks();
          });

          await waitFor(() => {
            expect(getPopupSizeVars(popupRoot, positioner)).toMatchObject({
              popupHeight: 'auto',
              positionerHeight: '260px',
            });
          });

          setPropertySpy.mockRestore();
        } finally {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
        }
      });

      it('preserves the current size when an interrupted mutation temporarily measures zero', async () => {
        const originalResizeObserver = globalThis.ResizeObserver;
        globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver;

        try {
          render(() => (
            <TestInlineNestedNavigationMenuWithDynamicContent initialContentStage={1} />
          ));
          fireEvent.click(screen.getByTestId('trigger-1'));
          await flushMicrotasks();

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');
          const popupWidths = [250, 0];
          const popupHeights = [220, 0];

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidths.shift() ?? 0,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => popupHeights.shift() ?? 0,
          });

          popupRoot.style.setProperty('--popup-width', '250px');
          popupRoot.style.setProperty('--popup-height', '220px');
          positioner.style.setProperty('--positioner-width', '250px');
          positioner.style.setProperty('--positioner-height', '220px');

          fireEvent.click(screen.getByTestId('insert-content'));
          await flushMicrotasks();

          await waitFor(() => {
            expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('auto');
          });
          await waitFor(() => {
            expect(popupRoot.style.getPropertyValue('--popup-height')).toBe('auto');
          });

          expect(positioner.style.getPropertyValue('--positioner-width')).toBe('250px');
          expect(positioner.style.getPropertyValue('--positioner-height')).toBe('220px');
        } finally {
          globalThis.ResizeObserver = originalResizeObserver;
        }
      });

      it('updates popup sizing when the window is resized while the popup is open', async () => {
        const restoreResizeObserver = mockResizeObserver();

        try {
          render(() => <TestNavigationMenuWithKeepMountedContent />);

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');

          let popupWidth = 675;
          let popupHeight = 220;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidth,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => popupHeight,
          });

          popupRoot.style.setProperty('--popup-width', 'auto');
          popupRoot.style.setProperty('--popup-height', 'auto');
          positioner.style.setProperty('--positioner-width', '675px');
          positioner.style.setProperty('--positioner-height', '220px');

          popupWidth = 500;
          popupHeight = 180;

          fireEvent(window, new Event('resize'));
          expect(positioner).toHaveAttribute('data-instant');

          tick(0);
          await flushMicrotasks();
          expect(positioner).toHaveAttribute('data-instant');

          tick(100);
          await flushMicrotasks();
          expect(positioner).not.toHaveAttribute('data-instant');

          await waitFor(() => {
            expect(getPopupSizeVars(popupRoot, positioner)).toEqual({
              popupWidth: 'auto',
              popupHeight: 'auto',
              positionerWidth: '500px',
              positionerHeight: '180px',
            });
          });
        } finally {
          restoreResizeObserver();
        }
      });

      it('updates popup sizing immediately when switching to a keepMounted trigger', async () => {
        const restoreResizeObserver = mockResizeObserver();
        const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        try {
          render(() => <TestNavigationMenuWithKeepMountedContent />);

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');
          const animations = mockAnimations(popupRoot);

          let popupWidth = 675;
          let popupHeight = 220;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidth,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => popupHeight,
          });

          popupRoot.style.setProperty('--popup-width', 'auto');
          popupRoot.style.setProperty('--popup-height', 'auto');
          positioner.style.setProperty('--positioner-width', '675px');
          positioner.style.setProperty('--positioner-height', '220px');

          popupWidth = 500;
          popupHeight = 180;
          animations.start();
          fireEvent.click(screen.getByTestId('trigger-learn'));
          await flushMicrotasks();

          expect(positioner.style.getPropertyValue('--positioner-width')).toBe('500px');
          expect(positioner.style.getPropertyValue('--positioner-height')).toBe('180px');

          await act(async () => {
            animations.finish();
            await flushMicrotasks();
          });

          await waitFor(() => {
            expect(getPopupSizeVars(popupRoot, positioner)).toEqual({
              popupWidth: 'auto',
              popupHeight: 'auto',
              positionerWidth: '500px',
              positionerHeight: '180px',
            });
          });
        } finally {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
          restoreResizeObserver();
        }
      });

      it('ignores the initial open size reset once a trigger switch has started', async () => {
        const restoreResizeObserver = mockResizeObserver();
        const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        try {
          function waitForAnimationFrame() {
            return new Promise<void>((resolve) => {
              requestAnimationFrame(() => {
                resolve();
              });
            });
          }

          render(() => <TestNavigationMenuWithKeepMountedContentClosed />);

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');
          const animations = mockAnimations(popupRoot);

          async function waitForSettledAnimations() {
            await act(async () => {
              await flushMicrotasks();
              await waitForAnimationFrame();
              await waitForAnimationFrame();
            });
          }

          async function finishAnimation(animation: Parameters<typeof animations.finish>[0]) {
            await act(async () => {
              await animations.finish(animation);
              await flushMicrotasks();
              await waitForAnimationFrame();
              await waitForAnimationFrame();
            });
          }

          let popupWidth = 675;
          let popupHeight = 220;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidth,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => popupHeight,
          });

          const openAnimation = animations.start();
          fireEvent.click(screen.getByTestId('trigger-product'));
          await waitForSettledAnimations();

          popupWidth = 500;
          popupHeight = 180;

          const switchAnimation = animations.start();
          fireEvent.click(screen.getByTestId('trigger-learn'));
          await waitForSettledAnimations();

          await waitFor(() => {
            expect(getPopupSizeVars(popupRoot, positioner)).toMatchObject({
              positionerWidth: '500px',
              positionerHeight: '180px',
            });
          });

          await finishAnimation(openAnimation);

          expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('500px');
          expect(popupRoot.style.getPropertyValue('--popup-height')).toBe('180px');

          await finishAnimation(switchAnimation);

          await waitFor(() => {
            expect(getPopupSizeVars(popupRoot, positioner)).toMatchObject({
              popupWidth: 'auto',
              popupHeight: 'auto',
            });
          });
        } finally {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
          restoreResizeObserver();
        }
      });

      it('seeds the popup width from the exiting panel when reopening after hovering a top-level link', async () => {
        const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        let popupWidthSpy: ReturnType<typeof vi.spyOn> | undefined;

        try {
          function waitForAnimationFrame() {
            return new Promise<void>((resolve) => {
              requestAnimationFrame(() => {
                resolve();
              });
            });
          }

          render(() => <TestNavigationMenuWithTopLevelLinkScopedPopupAnimation />);

          const triggerProduct = screen.getByTestId('trigger-product');
          const triggerLearn = screen.getByTestId('trigger-learn');
          const topLevelLink = screen.getByTestId('top-level-link');
          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');
          const animations = mockAnimations(popupRoot);

          let nextPanelWidth = 675;
          let nextPanelHeight = 220;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => {
              const fixedWidth = popupRoot.style.getPropertyValue('--popup-width');
              return fixedWidth && fixedWidth !== 'auto'
                ? parseInt(fixedWidth, 10)
                : nextPanelWidth;
            },
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => {
              const fixedHeight = popupRoot.style.getPropertyValue('--popup-height');
              return fixedHeight && fixedHeight !== 'auto'
                ? parseInt(fixedHeight, 10)
                : nextPanelHeight;
            },
          });

          const openAnimation = animations.start();
          fireEvent.mouseEnter(triggerProduct);
          fireEvent.mouseMove(triggerProduct);
          tick(OPEN_DELAY);
          await flushMicrotasks();

          await act(async () => {
            await animations.finish(openAnimation);
            await flushMicrotasks();
          });

          await waitFor(() => {
            expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('auto');
          });
          expect(triggerProduct).toHaveAttribute('aria-expanded', 'true');

          const productContent = screen
            .getByText('Product panel')
            .closest('.test-navigation-menu-content') as HTMLElement;
          const productContentAnimations = mockAnimations(productContent);
          const productContentCloseAnimation = productContentAnimations.start();

          const closeAnimation = animations.start();
          fireEvent.mouseLeave(triggerProduct, { relatedTarget: topLevelLink });
          fireEvent.mouseEnter(topLevelLink);
          fireEvent.mouseMove(topLevelLink);
          tick(OPEN_DELAY);
          await flushMicrotasks();

          await waitFor(() => {
            expect(triggerProduct).toHaveAttribute('aria-expanded', 'false');
          });

          nextPanelWidth = 500;
          nextPanelHeight = 180;
          popupWidthSpy = vi.spyOn(popupRoot.style, 'setProperty');

          const reopenAnimation = animations.start();
          fireEvent.mouseEnter(triggerLearn);
          fireEvent.mouseMove(triggerLearn);
          tick(OPEN_DELAY);
          await flushMicrotasks();

          await act(async () => {
            await waitForAnimationFrame();
            await flushMicrotasks();
          });

          const popupWidthCalls = (
            popupWidthSpy.mock.calls as Array<[property: string, value: string, priority?: string]>
          )
            .filter((call) => call[0] === '--popup-width')
            .map((call) => call[1]);
          const exitingWidthIndex = popupWidthCalls.indexOf('675px');
          const reopeningWidthIndex = popupWidthCalls.lastIndexOf('500px');

          expect(triggerLearn).toHaveAttribute('aria-expanded', 'true');
          expect(positioner.style.getPropertyValue('--positioner-width')).toBe('500px');
          expect(exitingWidthIndex).toBeGreaterThan(-1);
          expect(reopeningWidthIndex).toBeGreaterThan(exitingWidthIndex);

          await act(async () => {
            await productContentAnimations.finish(productContentCloseAnimation);
            await animations.finish(closeAnimation);
            await animations.finish(reopenAnimation);
            await flushMicrotasks();
          });
        } finally {
          popupWidthSpy?.mockRestore();
          globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
        }
      });

      // Skipped (jsdom has no CSS animations): closing on the short exit path after switching
      // content measures real animation timings.

      it('does not collapse auto-sized popup to zero on close if measurement temporarily returns 0', async () => {
        render(() => <TestInlineNestedNavigationMenuWithDynamicContent />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.click(trigger1);
        await flushMicrotasks();

        const popupRoot = screen.getByTestId('popup-root');
        const positioner = screen.getByTestId('positioner');

        primeOpenPopupSize(popupRoot, positioner, 250, 120);

        Object.defineProperty(popupRoot, 'offsetWidth', {
          configurable: true,
          get: () => (screen.queryByTestId('popup-1')?.hasAttribute('data-open') ? 250 : 0),
        });
        Object.defineProperty(popupRoot, 'offsetHeight', {
          configurable: true,
          get: () => (screen.queryByTestId('popup-1')?.hasAttribute('data-open') ? 120 : 0),
        });
        Object.defineProperty(positioner, 'offsetWidth', {
          configurable: true,
          get: () => 0,
        });
        Object.defineProperty(positioner, 'offsetHeight', {
          configurable: true,
          get: () => 0,
        });

        fireEvent.blur(trigger1, { relatedTarget: document.body });
        await flushMicrotasks();

        expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('250px');
        expect(popupRoot.style.getPropertyValue('--popup-height')).toBe('120px');
        expect(positioner.style.getPropertyValue('--positioner-width')).toBe('250px');
        expect(positioner.style.getPropertyValue('--positioner-height')).toBe('120px');
      });

      it('tabs from the last link of the last nested panel to the next top-level trigger', async () => {
        const { user } = renderWithUser(() => <TestInlineNestedNavigationMenuTabForwardBoundary />);
        const trigger1 = screen.getByTestId('trigger-1');

        await user.click(trigger1);
        await flushMicrotasks();

        const nestedLastLink = screen.getByTestId('nested-last-link');
        await act(async () => nestedLastLink.focus());
        expect(nestedLastLink).toHaveFocus();

        await user.tab();

        expect(screen.getByTestId('trigger-2')).toHaveFocus();
        expect(screen.getByTestId('nested-popup-2')).not.toBe(null);
        expect(screen.getByTestId('nested-trigger-2')).toHaveAttribute('aria-expanded', 'true');
      });

      it('tabs between nested triggers and links without opening inactive panels', async () => {
        const { user } = renderWithUser(() => <TestInlineNestedNavigationMenuTabFlow />);
        const triggerProduct = screen.getByTestId('trigger-product');

        await user.click(triggerProduct);
        await flushMicrotasks();

        const nestedDevelopersTrigger = screen.getByTestId('nested-trigger-developers');
        await act(async () => nestedDevelopersTrigger.focus());
        expect(nestedDevelopersTrigger).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('nested-link-get-started')).toHaveFocus();

        await user.tab({ shift: true });
        expect(nestedDevelopersTrigger).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('nested-link-get-started')).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('nested-link-composition')).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('nested-trigger-design-systems')).toHaveFocus();
        expect(screen.queryByTestId('nested-popup-design-systems')).toBe(null);

        await user.tab();
        expect(screen.getByText('Engineering Leads')).toHaveFocus();
      });

      it('returns to the last inline submenu item when shift+tabbing after leaving it', async () => {
        const { user } = renderWithUser(() => <TestInlineNestedNavigationMenuTabFlow />);
        const triggerProduct = screen.getByTestId('trigger-product');

        await user.click(triggerProduct);
        await flushMicrotasks();

        await user.tab();
        expect(screen.getByTestId('nested-trigger-developers')).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('nested-link-get-started')).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('nested-link-composition')).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('nested-trigger-design-systems')).toHaveFocus();

        await user.tab({ shift: true });
        expect(screen.getByTestId('nested-link-composition')).toHaveFocus();
      });
    });
  });

});

describe('initial open', () => {
  // Fake timers without `shouldAdvanceTime`, so the one-frame instant reset (scheduled via a
  // zero-delay timeout) can be observed deterministically rather than racing the assertion.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('suppresses the positioner transition for the first frame while initially open', async () => {
    render(() => <TestNavigationMenu defaultValue="item-1" />);
    await flushMicrotasks();

    // While initially open, the positioner starts with its transition suppressed so a
    // default value does not animate in from the unpositioned portal state.
    const positioner = screen.getByTestId('top-level-positioner');
    expect(positioner).toHaveAttribute('data-instant');

    // The suppression is released on the next tick.
    tick(0);
    await flushMicrotasks();
    expect(positioner).not.toHaveAttribute('data-instant');
  });
});
