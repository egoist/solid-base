import { Errored } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Menu } from '..';
import { act, flushMicrotasks, renderWithUser } from '../test-utils';

function TriggeredMenu(props: { children: any; rootProps?: Menu.Root.Props; keepMounted?: boolean }) {
  return (
    <Menu.Root {...props.rootProps}>
      <Menu.Trigger>Open</Menu.Trigger>
      <Menu.Portal keepMounted={props.keepMounted}>
        <Menu.Positioner>
          <Menu.Popup>{props.children}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

describe('<Menu.RadioItem />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.RadioGroup defaultValue="a">
                  <Menu.RadioItem
                    value="a"
                    ref={(el) => {
                      ref = el;
                    }}
                    class={(state) => (state.checked ? 'checked' : 'unchecked')}
                    style={{ color: 'red' }}
                    render={(props) => <li {...props} />}
                  >
                    Item
                  </Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const item = screen.getByRole('menuitemradio');
      expect(ref).toBe(item);
      expect(item.tagName).toBe('LI');
      expect(item).toHaveClass('checked');
      expect(item.style.color).toBe('red');
    });
  });

  it('throws when rendered outside Menu.RadioGroup', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Menu.Root open>
          <Menu.RadioItem value="a" />
        </Menu.Root>
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent(
      'Base UI: MenuRadioGroupContext is missing. MenuRadioGroup parts must be placed within <Menu.RadioGroup>.',
    );
  });

  // Omitted: 'perf: does not rerender menu items unnecessarily' counts React re-renders; Solid
  // components never re-render.

  describe('state management', () => {
    it('adds the state and ARIA attributes when selected', async () => {
      const { user } = renderWithUser(() => (
        <TriggeredMenu>
          <Menu.RadioGroup defaultValue={0}>
            <Menu.RadioItem value={1}>Item</Menu.RadioItem>
          </Menu.RadioGroup>
        </TriggeredMenu>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = await screen.findByRole('menuitemradio');
      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'true');
      expect(item).toHaveAttribute('data-checked', '');
    });

    it.each([{ key: 'Space' }, { key: 'Enter' }])(
      'selects the item when $key is pressed',
      async ({ key }) => {
        const { user } = renderWithUser(() => (
          <Menu.Root>
            <Menu.Trigger>Open</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.RadioGroup defaultValue={0}>
                  <Menu.RadioItem value={1}>Item</Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ));

        const trigger = screen.getByRole('button', { name: 'Open' });
        await act(async () => {
          trigger.focus();
        });
        await user.keyboard('[ArrowDown]');
        const item = await screen.findByRole('menuitemradio');

        await waitFor(() => {
          expect(item).toHaveFocus();
        });

        await user.keyboard(`[${key}]`);
        expect(item).toHaveAttribute('data-checked', '');
      },
    );

    // Skipped: relies on real browser typeahead timing (upstream skips it in jsdom).
    it.skip('does not select when Space is pressed during an active typeahead session', () => {});

    it('calls `onValueChange` when the item is clicked', async () => {
      const onValueChange = vi.fn();
      const { user } = renderWithUser(() => (
        <TriggeredMenu>
          <Menu.RadioGroup defaultValue={0} onValueChange={onValueChange}>
            <Menu.RadioItem value={1}>Item</Menu.RadioItem>
          </Menu.RadioGroup>
        </TriggeredMenu>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = await screen.findByRole('menuitemradio');
      await user.click(item);

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.lastCall?.[0]).toBe(1);
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('item-press');
    });

    it('does not select when `onValueChange` cancels the event', async () => {
      const { user } = renderWithUser(() => (
        <TriggeredMenu>
          <Menu.RadioGroup
            defaultValue={0}
            onValueChange={(_, eventDetails) => {
              eventDetails.cancel();
            }}
          >
            <Menu.RadioItem value={1}>Item</Menu.RadioItem>
          </Menu.RadioGroup>
        </TriggeredMenu>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = await screen.findByRole('menuitemradio');
      await user.click(item);
      await act(() => {});

      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(item).not.toHaveAttribute('data-checked');
    });

    it('keeps the state when closed and reopened', async () => {
      const { user } = renderWithUser(() => (
        <TriggeredMenu rootProps={{ modal: false }} keepMounted>
          <Menu.RadioGroup defaultValue={0}>
            <Menu.RadioItem value={1}>Item</Menu.RadioItem>
          </Menu.RadioGroup>
        </TriggeredMenu>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBe(null));

      const item = screen.getByRole('menuitemradio');
      await user.click(item);

      await user.click(trigger); // close the menu

      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });

      await user.click(trigger); // reopen the menu
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBe(null));

      const itemAfterReopen = await screen.findByRole('menuitemradio');
      expect(itemAfterReopen).toHaveAttribute('aria-checked', 'true');
      expect(itemAfterReopen).toHaveAttribute('data-checked', '');
    });

    it('supports a controlled value', async () => {
      const onValueChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.RadioGroup value="a" onValueChange={onValueChange}>
                  <Menu.RadioItem value="a">A</Menu.RadioItem>
                  <Menu.RadioItem value="b">B</Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const [a, b] = screen.getAllByRole('menuitemradio');
      await user.click(b);
      expect(onValueChange.mock.lastCall?.[0]).toBe('b');
      expect(a).toHaveAttribute('aria-checked', 'true');
      expect(b).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: closeOnClick', () => {
    it('when `closeOnClick=true`, closes the menu when the item is clicked', async () => {
      const { user } = renderWithUser(() => (
        <TriggeredMenu>
          <Menu.RadioGroup defaultValue={0}>
            <Menu.RadioItem closeOnClick value={1}>
              Item
            </Menu.RadioItem>
          </Menu.RadioGroup>
        </TriggeredMenu>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = await screen.findByRole('menuitemradio');
      await user.click(item);

      await waitFor(() => expect(screen.queryByRole('menu')).toBe(null));
    });

    it('does not close the menu when the item is clicked by default', async () => {
      const { user } = renderWithUser(() => (
        <TriggeredMenu>
          <Menu.RadioGroup defaultValue={0}>
            <Menu.RadioItem value={1}>Item</Menu.RadioItem>
          </Menu.RadioGroup>
        </TriggeredMenu>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = await screen.findByRole('menuitemradio');
      await user.click(item);
      await act(() => {});

      expect(screen.queryByRole('menu')).not.toBe(null);
    });
  });

  describe('prop: focusableWhenDisabled', () => {
    it('can be focused but not interacted with when a radio group is disabled', async () => {
      const handleClick = vi.fn();
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleValueChange = vi.fn();

      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.RadioGroup defaultValue={0} disabled onValueChange={handleValueChange}>
                  <Menu.RadioItem
                    value="one"
                    onClick={handleClick}
                    onKeyDown={handleKeyDown}
                    onKeyUp={handleKeyUp}
                  >
                    one
                  </Menu.RadioItem>
                  <Menu.RadioItem
                    value="two"
                    onClick={handleClick}
                    onKeyDown={handleKeyDown}
                    onKeyUp={handleKeyUp}
                  >
                    two
                  </Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      await flushMicrotasks();
      const [item1, item2] = screen.getAllByRole('menuitemradio');

      expect(item1).toHaveAttribute('data-disabled');
      expect(item2).toHaveAttribute('data-disabled');

      await act(() => item1.focus());
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'Enter' });
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleValueChange.mock.calls.length).toBe(0);

      fireEvent.keyUp(item1, { key: 'Space' });
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleValueChange.mock.calls.length).toBe(0);

      fireEvent.click(item1);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleValueChange.mock.calls.length).toBe(0);

      fireEvent.keyDown(item1, { key: 'ArrowDown' });
      expect(handleKeyDown.mock.calls.length).toBe(0);
      await waitFor(() => expect(item2).toHaveFocus());

      fireEvent.keyDown(item2, { key: 'Enter' });
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleValueChange.mock.calls.length).toBe(0);

      fireEvent.keyUp(item2, { key: 'Space' });
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleValueChange.mock.calls.length).toBe(0);

      fireEvent.click(item2);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleValueChange.mock.calls.length).toBe(0);
    });
  });

  it('can be focused but not interacted with when individual items are disabled', async () => {
    const handleClick = vi.fn();
    const handleKeyDown = vi.fn();
    const handleKeyUp = vi.fn();
    const handleValueChange = vi.fn();

    render(() => (
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.RadioGroup defaultValue={0} onValueChange={handleValueChange}>
                <Menu.RadioItem
                  value="one"
                  onClick={handleClick}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                  disabled
                >
                  one
                </Menu.RadioItem>
                <Menu.RadioItem
                  value="two"
                  onClick={handleClick}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                >
                  two
                </Menu.RadioItem>
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    await flushMicrotasks();
    const [item1, item2] = screen.getAllByRole('menuitemradio');

    expect(item1).toHaveAttribute('data-disabled');
    expect(item2).not.toHaveAttribute('data-disabled');

    await act(() => item1.focus());
    expect(item1).toHaveFocus();

    fireEvent.keyDown(item1, { key: 'Enter' });
    expect(handleKeyDown.mock.calls.length).toBe(0);
    expect(handleClick.mock.calls.length).toBe(0);
    expect(handleValueChange.mock.calls.length).toBe(0);

    fireEvent.keyUp(item1, { key: 'Space' });
    expect(handleKeyDown.mock.calls.length).toBe(0);
    expect(handleClick.mock.calls.length).toBe(0);
    expect(handleValueChange.mock.calls.length).toBe(0);

    fireEvent.click(item1);
    expect(handleClick.mock.calls.length).toBe(0);
    expect(handleValueChange.mock.calls.length).toBe(0);

    fireEvent.keyDown(item1, { key: 'ArrowDown' });
    expect(handleKeyDown.mock.calls.length).toBe(0);
    await waitFor(() => expect(item2).toHaveFocus());

    fireEvent.keyDown(item2, { key: 'Enter' });
    expect(handleKeyDown.mock.calls.length).toBe(1);
    expect(handleClick.mock.calls.length).toBe(1);
    expect(handleValueChange.mock.calls.length).toBe(1);
    expect(handleValueChange.mock.calls[0][0]).toBe('two');

    fireEvent.keyDown(item2, { key: 'ArrowDown' });
    await waitFor(() => {
      expect(item1).toHaveFocus();
    });
  });
});
