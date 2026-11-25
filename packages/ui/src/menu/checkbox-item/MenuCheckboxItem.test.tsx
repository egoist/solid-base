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

describe('<Menu.CheckboxItem />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem
                  ref={(el) => {
                    ref = el;
                  }}
                  class={(state) => (state.checked ? 'checked' : 'unchecked')}
                  style={{ color: 'red' }}
                  render={(props) => <li {...props} />}
                >
                  Item
                </Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const item = screen.getByRole('menuitemcheckbox');
      expect(ref).toBe(item);
      expect(item.tagName).toBe('LI');
      expect(item).toHaveClass('unchecked');
      expect(item.style.color).toBe('red');
    });
  });

  // Omitted: 'perf: does not rerender menu items unnecessarily' counts React re-renders; Solid
  // components never re-render.

  describe('state management', () => {
    it.each([
      { checked: true, ariaChecked: 'true', dataState: 'checked' },
      { checked: false, ariaChecked: 'false', dataState: 'unchecked' },
    ])(
      'adds the state and ARIA attributes when checked=$checked',
      async ({ checked, ariaChecked, dataState }) => {
        const { user } = renderWithUser(() => (
          <TriggeredMenu>
            <Menu.CheckboxItem checked={checked}>Item</Menu.CheckboxItem>
          </TriggeredMenu>
        ));

        const trigger = screen.getByRole('button', { name: 'Open' });
        await user.click(trigger);

        const item = await screen.findByRole('menuitemcheckbox');
        expect(item).toHaveAttribute('aria-checked', ariaChecked);
        expect(item).toHaveAttribute(`data-${dataState}`, '');
      },
    );

    it('toggles the checked state when clicked', async () => {
      const { user } = renderWithUser(() => (
        <TriggeredMenu>
          <Menu.CheckboxItem>Item</Menu.CheckboxItem>
        </TriggeredMenu>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = await screen.findByRole('menuitemcheckbox');
      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'true');
      expect(item).toHaveAttribute('data-checked', '');

      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(item).toHaveAttribute('data-unchecked', '');
    });

    it('toggles the checked state when Space is pressed', async () => {
      const { user } = renderWithUser(() => (
        <TriggeredMenu>
          <Menu.CheckboxItem>Item</Menu.CheckboxItem>
        </TriggeredMenu>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await act(async () => {
        trigger.focus();
      });
      await user.keyboard('[ArrowDown]');
      const item = await screen.findByRole('menuitemcheckbox');

      await waitFor(() => {
        expect(item).toHaveFocus();
      });

      await user.keyboard('[Space]');
      expect(item).toHaveAttribute('data-checked', '');

      await user.keyboard('[Space]');
      expect(item).toHaveAttribute('data-unchecked', '');
    });

    it('toggles with Space after closing during typeahead and reopening', async () => {
      const { user } = renderWithUser(() => (
        <TriggeredMenu>
          <Menu.CheckboxItem>Settings</Menu.CheckboxItem>
        </TriggeredMenu>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await act(async () => {
        trigger.focus();
      });
      await user.keyboard('[Enter]');
      await waitFor(() => {
        expect(screen.getByRole('menuitemcheckbox')).toHaveFocus();
      });

      await user.keyboard('s[Escape]');
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });

      await user.keyboard('[Enter]');
      await waitFor(() => {
        expect(screen.getByRole('menuitemcheckbox')).toHaveFocus();
      });
      const item = screen.getByRole('menuitemcheckbox');
      expect(item).toHaveAttribute('aria-checked', 'false');

      await user.keyboard('[Space]');
      expect(item).toHaveAttribute('aria-checked', 'true');
    });

    // Skipped: relies on real browser typeahead timing (upstream skips it in jsdom).
    it.skip('does not toggle when Space is pressed during an active typeahead session', () => {});

    // Skipped: Enter activation of a non-button element is browser-only upstream.
    it.skip('toggles the checked state when Enter is pressed', () => {});

    it('calls `onCheckedChange` when the item is clicked', async () => {
      const onCheckedChange = vi.fn();
      const { user } = renderWithUser(() => (
        <TriggeredMenu>
          <Menu.CheckboxItem onCheckedChange={onCheckedChange}>Item</Menu.CheckboxItem>
        </TriggeredMenu>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = await screen.findByRole('menuitemcheckbox');
      await user.click(item);

      expect(onCheckedChange.mock.calls.length).toBe(1);
      expect(onCheckedChange.mock.lastCall?.[0]).toBe(true);
      expect(onCheckedChange.mock.lastCall?.[1].reason).toBe('item-press');

      await user.click(item);

      expect(onCheckedChange.mock.calls.length).toBe(2);
      expect(onCheckedChange.mock.lastCall?.[0]).toBe(false);
    });

    it('does not toggle when `onCheckedChange` cancels the event', async () => {
      const { user } = renderWithUser(() => (
        <TriggeredMenu>
          <Menu.CheckboxItem
            onCheckedChange={(_, eventDetails) => {
              eventDetails.cancel();
            }}
          >
            Item
          </Menu.CheckboxItem>
        </TriggeredMenu>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = await screen.findByRole('menuitemcheckbox');
      await user.click(item);
      await act(() => {});

      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(item).not.toHaveAttribute('data-checked');
    });

    it('keeps the state when closed and reopened', async () => {
      const { user } = renderWithUser(() => (
        <TriggeredMenu rootProps={{ modal: false }} keepMounted>
          <Menu.CheckboxItem>Item</Menu.CheckboxItem>
        </TriggeredMenu>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await act(() => {
        trigger.focus();
      });

      await user.keyboard('{Enter}');

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      await user.keyboard('{Enter}');
      await user.keyboard('{Enter}');

      const itemAfterReopen = screen.getByRole('menuitemcheckbox');
      expect(itemAfterReopen).toHaveAttribute('aria-checked', 'true');
      expect(itemAfterReopen).toHaveAttribute('data-checked');
    });

    it('supports the controlled checked state', async () => {
      const onCheckedChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem checked={false} onCheckedChange={onCheckedChange}>
                  Item
                </Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);
      expect(onCheckedChange).toHaveBeenCalledTimes(1);
      expect(item).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: closeOnClick', () => {
    it('when `closeOnClick=true`, closes the menu when the item is clicked', async () => {
      const { user } = renderWithUser(() => (
        <TriggeredMenu>
          <Menu.CheckboxItem closeOnClick>Item</Menu.CheckboxItem>
        </TriggeredMenu>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = await screen.findByRole('menuitemcheckbox');
      await user.click(item);

      await waitFor(() => expect(screen.queryByRole('menu')).toBe(null));
    });

    it('does not close the menu when the item is clicked by default', async () => {
      const { user } = renderWithUser(() => (
        <TriggeredMenu>
          <Menu.CheckboxItem>Item</Menu.CheckboxItem>
        </TriggeredMenu>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = await screen.findByRole('menuitemcheckbox');
      await user.click(item);
      await act(() => {});

      expect(screen.queryByRole('menu')).not.toBe(null);
    });
  });

  describe('prop: focusableWhenDisabled', () => {
    it('can be focused but not interacted with when disabled', async () => {
      const handleCheckedChange = vi.fn();
      const handleClick = vi.fn();
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();

      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem
                  disabled
                  onCheckedChange={handleCheckedChange}
                  onClick={handleClick}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                >
                  Item
                </Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      await flushMicrotasks();
      const item = screen.getByRole('menuitemcheckbox');
      await act(() => item.focus());
      expect(item).toHaveFocus();

      fireEvent.keyDown(item, { key: 'Enter' });
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleCheckedChange.mock.calls.length).toBe(0);

      fireEvent.keyUp(item, { key: 'Space' });
      expect(handleKeyUp.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleCheckedChange.mock.calls.length).toBe(0);

      fireEvent.click(item);
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleKeyUp.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleCheckedChange.mock.calls.length).toBe(0);
    });
  });
});
