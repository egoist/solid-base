import { createSignal } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { NavigationMenu } from '..';
import { DirectionProvider } from '../../direction-provider';
import { flushMicrotasks, renderWithUser } from '../test-utils';

describe('<NavigationMenu.Trigger />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', async () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <NavigationMenu.Root defaultValue="item">
          <NavigationMenu.List>
            <NavigationMenu.Item value="item">
              <NavigationMenu.Trigger
                ref={(element) => {
                  ref = element;
                }}
                class={(state) => (state.open ? 'trigger open' : 'trigger')}
                style={{ color: 'red' }}
                render={(props, state) => (
                  <button {...props} data-state-open={String(state.open)} />
                )}
              >
                Item
              </NavigationMenu.Trigger>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      ));
      await flushMicrotasks();

      const trigger = screen.getByRole('button', { name: 'Item' });
      expect(ref).toBe(trigger);
      expect(trigger).toBeInstanceOf(window.HTMLButtonElement);
      expect(trigger).toHaveClass('trigger', 'open');
      expect(trigger).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(trigger).toHaveAttribute('data-state-open', 'true');
      expect(trigger).toHaveAttribute('data-popup-open');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('renders a native button by default', () => {
      render(() => (
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>Item</NavigationMenu.Trigger>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      ));
      const trigger = screen.getByRole('button', { name: 'Item' });
      expect(trigger.tagName).toBe('BUTTON');
      expect(trigger).toHaveAttribute('type', 'button');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveAttribute('tabindex', '0');
      expect(trigger).toHaveAttribute('data-base-ui-navigation-menu-trigger');
    });

    it('supports a non-native button', () => {
      render(() => (
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger nativeButton={false} render="span">
                Item
              </NavigationMenu.Trigger>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      ));
      const trigger = screen.getByRole('button', { name: 'Item' });
      expect(trigger.tagName).toBe('SPAN');
      expect(trigger).not.toHaveAttribute('type');
    });
  });

  it('applies the data-disabled style hook only when disabled', async () => {
    function App() {
      const [disabled, setDisabled] = createSignal(true);
      return (
        <div>
          <NavigationMenu.Root>
            <NavigationMenu.List>
              <NavigationMenu.Item>
                <NavigationMenu.Trigger disabled={disabled()} data-testid="trigger">
                  Overview
                </NavigationMenu.Trigger>
              </NavigationMenu.Item>
            </NavigationMenu.List>
          </NavigationMenu.Root>
          <button type="button" onClick={() => setDisabled(false)}>
            enable
          </button>
        </div>
      );
    }

    render(() => <App />);
    const trigger = screen.getByTestId('trigger');
    expect(trigger).toHaveAttribute('data-disabled', '');

    fireEvent.click(screen.getByText('enable'));
    await flushMicrotasks();
    expect(trigger).not.toHaveAttribute('data-disabled');
  });

  it('opens a vertical menu with the mirrored arrow key in RTL mode', async () => {
    const { user } = renderWithUser(() => (
      <DirectionProvider direction="rtl">
        <NavigationMenu.Root orientation="vertical">
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>Overview</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#">Quick Start</NavigationMenu.Link>
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
      </DirectionProvider>
    ));

    const trigger = screen.getByRole('button', { name: 'Overview' });
    trigger.focus();

    await user.keyboard('{ArrowLeft}');

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Quick Start' })).toBeVisible();
    });
  });

  it('opens with ArrowDown and keeps focus on the trigger', async () => {
    const { user } = renderWithUser(() => (
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>Overview</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#quick-start">Quick Start</NavigationMenu.Link>
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

    const trigger = screen.getByRole('button', { name: 'Overview' });
    trigger.focus();

    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Quick Start' })).toBeVisible();
    });
    expect(trigger).toHaveFocus();
  });

  // Skipped (jsdom has no layout or CSS transitions): keyboard focus with real popup sizes
  // (Enter/Space variants), positioner height/width measurements, repositioning when switching
  // triggers, rapid-hover sizing races, and the pointer-events lock release cases that depend on
  // real pointer movement.
});
