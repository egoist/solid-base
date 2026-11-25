import { Errored, Show } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { NavigationMenu } from '..';
import { act, describeConformance, flushMicrotasks, renderWithProps } from '../test-utils';

describe('<NavigationMenu.List />', () => {
  describeConformance(
    (props) => (
      <NavigationMenu.Root>
        <NavigationMenu.List {...props} />
      </NavigationMenu.Root>
    ),
    { refInstanceof: window.HTMLUListElement },
  );

  it('throws a descriptive error when rendered outside <NavigationMenu.Root>', () => {
    render(() => (
      <Errored fallback={(error) => <output data-testid="error">{String(error())}</output>}>
        <NavigationMenu.List />
      </Errored>
    ));
    expect(screen.getByTestId('error').textContent).toBe(
      'Error: Base UI: NavigationMenuRootContext is missing. Navigation Menu parts must be placed within <NavigationMenu.Root>.',
    );
  });

  it('stops vertical navigation keys from escaping the list', () => {
    const handleKeyDown = vi.fn();

    render(() => (
      <div onKeyDown={handleKeyDown}>
        <NavigationMenu.Root orientation="vertical">
          <NavigationMenu.List data-testid="list">
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>Item</NavigationMenu.Trigger>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      </div>
    ));

    const trigger = screen.getByRole('button', { name: 'Item' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    expect(handleKeyDown.mock.calls.length).toBe(0);

    fireEvent.keyDown(trigger, { key: 'PageDown' });

    expect(handleKeyDown.mock.calls.length).toBe(1);
  });

  describe('item removal', () => {
    function App(props: { showFirst: boolean }) {
      return (
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <Show when={props.showFirst}>
              <NavigationMenu.Item>
                <NavigationMenu.Trigger data-testid="first">One</NavigationMenu.Trigger>
              </NavigationMenu.Item>
            </Show>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger data-testid="middle">Two</NavigationMenu.Trigger>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger data-testid="last">Three</NavigationMenu.Trigger>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      );
    }

    it('navigates from the focused trigger after an earlier item is removed', async () => {
      const { setProps } = renderWithProps(App, { showFirst: true });
      await flushMicrotasks();

      const first = screen.getByTestId('first');
      await act(() => {
        first.focus();
      });

      fireEvent.keyDown(first, { key: 'ArrowRight' });
      await flushMicrotasks();

      const middle = screen.getByTestId('middle');
      fireEvent.keyDown(middle, { key: 'ArrowRight' });
      await flushMicrotasks();

      const last = screen.getByTestId('last');
      expect(last).toHaveFocus();

      await setProps({ showFirst: false });

      fireEvent.keyDown(last, { key: 'ArrowLeft' });
      await flushMicrotasks();

      expect(middle).toHaveFocus();
    });
  });
});
