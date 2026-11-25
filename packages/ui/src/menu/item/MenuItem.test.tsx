import { Errored } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Menu } from '..';
import { act, flushMicrotasks, renderWithUser } from '../test-utils';

function OpenMenu(props: { children: any; rootProps?: Menu.Root.Props }) {
  return (
    <Menu.Root open {...props.rootProps}>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>{props.children}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

describe('<Menu.Item />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <OpenMenu>
          <Menu.Item
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.highlighted ? 'highlighted' : 'item')}
            style={{ color: 'red' }}
            render={(props) => <li {...props} />}
          >
            Item
          </Menu.Item>
        </OpenMenu>
      ));

      const item = screen.getByRole('menuitem');
      expect(ref).toBe(item);
      expect(item.tagName).toBe('LI');
      expect(item).toHaveClass('item');
      expect(item.style.color).toBe('red');
    });

    it('renders a div with role menuitem by default', () => {
      render(() => (
        <OpenMenu>
          <Menu.Item>Item</Menu.Item>
        </OpenMenu>
      ));
      const item = screen.getByRole('menuitem');
      expect(item.tagName).toBe('DIV');
      expect(item).toHaveAttribute('tabindex', '-1');
      expect(item).toHaveAttribute('id');
    });
  });

  it('throws when rendered outside Menu.Root', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Menu.Item />
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent(
      'Base UI: MenuRootContext is missing. Menu parts must be placed within <Menu.Root>.',
    );
  });

  it('calls the onClick handler when clicked', async () => {
    const onClick = vi.fn();
    const { user } = renderWithUser(() => (
      <OpenMenu>
        <Menu.Item onClick={onClick} id="item">
          Item
        </Menu.Item>
      </OpenMenu>
    ));

    const item = screen.getByRole('menuitem');
    await user.click(item);

    expect(onClick.mock.calls.length).toBe(1);
  });

  // Skipped: upstream verifies native browser focus order on press, which requires a real browser.
  it.skip('native press focuses the item before mouseup and click without hover focus', () => {});

  it.each([{ press: 'mouse' }, { press: 'Enter' }])(
    'preserves focus moved by onClick after $press activation',
    async ({ press }) => {
      const { user } = renderWithUser(() => (
        <>
          <Menu.Root>
            <Menu.Trigger>Open</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup finalFocus={false}>
                  <Menu.Item onClick={() => screen.getByRole('textbox').focus()}>
                    Focus editor
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <textarea aria-label="Editor" />
        </>
      ));

      await user.click(screen.getByRole('button', { name: 'Open' }));
      const item = await screen.findByRole('menuitem');
      expect(screen.getByRole('textbox')).not.toHaveFocus();

      if (press === 'Enter') {
        await act(() => item.focus());
        await user.keyboard('{Enter}');
      } else {
        await user.click(item);
      }

      await waitFor(() => expect(screen.queryByRole('menuitem')).toBe(null));
      expect(screen.getByRole('textbox')).toHaveFocus();
    },
  );

  it('does not close the menu when onClick prevents Base UI handler', async () => {
    const onClick = vi.fn((event) => event.preventBaseUIHandler());
    const { user } = renderWithUser(() => (
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item onClick={onClick}>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);

    const item = await screen.findByRole('menuitem');
    await user.click(item);

    expect(onClick.mock.calls.length).toBe(1);
    await act(() => {});
    expect(screen.queryByRole('menu')).not.toBe(null);
  });

  it('allows onMouseDown to call preventBaseUIHandler', () => {
    render(() => (
      <OpenMenu>
        <Menu.Item onMouseDown={(event) => event.preventBaseUIHandler()}>Item</Menu.Item>
      </OpenMenu>
    ));

    const item = screen.getByRole('menuitem');

    expect(() => fireEvent.mouseDown(item)).not.toThrow();
  });

  // Omitted: 'perf: does not rerender menu items unnecessarily' counts React re-renders; Solid
  // components never re-render.

  describe('prop: closeOnClick', () => {
    it('closes the menu when the item is clicked by default', async () => {
      const { user } = renderWithUser(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = await screen.findByRole('menuitem');
      await user.click(item);

      await waitFor(() => expect(screen.queryByRole('menu')).toBe(null));
    });

    it('when `closeOnClick=false` does not close the menu when the item is clicked', async () => {
      const { user } = renderWithUser(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item closeOnClick={false}>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = await screen.findByRole('menuitem');
      await user.click(item);
      await act(() => {});

      expect(screen.queryByRole('menu')).not.toBe(null);
    });
  });

  describe('disabled state', () => {
    it('can be focused but not interacted with when disabled', async () => {
      const handleClick = vi.fn();
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();

      render(() => (
        <OpenMenu>
          <Menu.Item disabled onClick={handleClick} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
            Item
          </Menu.Item>
        </OpenMenu>
      ));

      const item = screen.getByRole('menuitem');
      await act(() => item.focus());
      expect(item).toHaveFocus();
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toHaveAttribute('data-disabled');

      fireEvent.keyDown(item, { key: 'Enter' });
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);

      fireEvent.keyUp(item, { key: 'Space' });
      expect(handleKeyUp.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);

      fireEvent.click(item);
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleKeyUp.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
    });

    it('skips a natively disabled item during keyboard navigation', async () => {
      const { user } = renderWithUser(() => (
        <OpenMenu>
          <Menu.Item>1</Menu.Item>
          <Menu.Item nativeButton render={(props) => <button type="button" {...props} disabled />}>
            2
          </Menu.Item>
          <Menu.Item>3</Menu.Item>
        </OpenMenu>
      ));

      const [firstItem, , lastItem] = screen.getAllByRole('menuitem');
      // Items are indexed by the list after a microtask.
      await flushMicrotasks();
      await act(async () => {
        firstItem.focus();
      });

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(lastItem).toHaveFocus();
      });

      await user.keyboard('{ArrowUp}');
      await waitFor(() => {
        expect(firstItem).toHaveFocus();
      });
    });
  });
});
