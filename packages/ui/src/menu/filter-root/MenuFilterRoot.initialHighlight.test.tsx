import { createSignal } from 'solid-js';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { Menu } from '..';
import { act, renderWithUser, waitSingleFrame } from '../test-utils';

function Test(props: { openOnHover?: boolean; onInputFocus?: () => void }) {
  return (
    <Menu.FilterProvider>
      <Menu.Root>
        <Menu.Trigger openOnHover={props.openOnHover} delay={0}>
          Actions
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Input aria-label="Filter actions" onFocus={() => props.onInputFocus?.()} />
              <Menu.Empty>No actions found.</Menu.Empty>
              <Menu.List>
                <Menu.Item disabled>Unavailable</Menu.Item>
                <Menu.Item>Rename</Menu.Item>
                <Menu.Item>Delete</Menu.Item>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menu.FilterProvider>
  );
}

describe('filterable menu initial highlight', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('highlights the first enabled action and keeps the input in the arrow loop', async () => {
    const { user } = renderWithUser(() => <Test />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    await act(() => trigger.focus());
    await user.keyboard('[Enter]');

    const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
    const rename = screen.getByRole('menuitem', { name: 'Rename' });
    const deleteItem = screen.getByRole('menuitem', { name: 'Delete' });
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute('aria-activedescendant', rename.id);

    await user.keyboard('[ArrowDown]');
    expect(input).toHaveAttribute('aria-activedescendant', deleteItem.id);
    await user.keyboard('[ArrowDown]');
    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(input).toHaveAttribute('data-highlighted');

    await user.keyboard('[ArrowUp]');
    expect(input).toHaveAttribute('aria-activedescendant', deleteItem.id);
    await user.keyboard('[ArrowUp][ArrowUp][ArrowUp]');
    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(input).toHaveFocus();
  });

  it.each([
    { key: 'ArrowDown', position: 'first', name: 'Rename' },
    { key: 'ArrowUp', position: 'last', name: 'Delete' },
  ])('highlights the $position enabled action when $key opens the menu', async ({ key, name }) => {
    const { user } = renderWithUser(() => <Test />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    await act(() => trigger.focus());
    await user.keyboard(`[${key}]`);

    const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
    const item = screen.getByRole('menuitem', { name });
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute('aria-activedescendant', item.id);
  });

  it('clears the initial highlight when typing and permits an empty result', async () => {
    const { user } = renderWithUser(() => <Test />);
    await act(() => screen.getByRole('button', { name: 'Actions' }).focus());
    await user.keyboard('[Enter]');
    const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => expect(input).toHaveFocus());

    await user.keyboard('Del');
    expect(input).toHaveValue('Del');
    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);

    await user.keyboard('[ArrowDown]');
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('menuitem', { name: 'Delete' }).id,
    );

    await user.keyboard('x');
    expect(input).toHaveValue('Delx');
    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(await screen.findByText('No actions found.')).toBeVisible();
    expect(input).toHaveFocus();
  });

  it.each(['mouse', 'touch', 'pen'])('handles opening with %s', async (pointerType) => {
    const onInputFocus = vi.fn();
    renderWithUser(() => <Test onInputFocus={onInputFocus} />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    await act(() => trigger.focus());
    fireEvent.pointerDown(trigger, { pointerType });
    fireEvent.mouseDown(trigger, { detail: 1 });
    fireEvent.pointerUp(trigger, { pointerType });
    fireEvent.mouseUp(trigger, { detail: 1 });
    fireEvent.click(trigger, { detail: 1 });

    const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
    await act(() => waitSingleFrame());
    const shouldFocus = pointerType === 'mouse';
    await waitFor(() => expect(input.matches(':focus')).toBe(shouldFocus));
    expect(onInputFocus.mock.calls.length > 0).toBe(shouldFocus);
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });

  // Browser-only upstream (`skipIf(isJSDOM)`): the iOS VoiceOver press relies on real pointer
  // geometry and focus behavior.
  it.skip('focuses the input when a screen reader press opens the menu (browser-only)', () => {});
  it.skip('focuses a submenu input when a screen reader press opens the submenu (browser-only)', () => {});
  // Browser-only upstream (`skipIf(isJSDOM)`): relies on real touch compatibility mouse events.
  it.skip('does not focus the input when an item is tapped after a touch open (browser-only)', () => {});

  it('does not focus the input when opened on hover', async () => {
    const onInputFocus = vi.fn();
    const { user } = renderWithUser(() => <Test openOnHover onInputFocus={onInputFocus} />);

    await user.hover(screen.getByRole('button', { name: 'Actions' }));

    const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
    await act(() => waitSingleFrame());
    expect(input).not.toHaveFocus();
    expect(onInputFocus).not.toHaveBeenCalled();
  });

  it('highlights the first action again when reopening', async () => {
    const { user } = renderWithUser(() => <Test />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    await act(() => trigger.focus());
    await user.keyboard('[Enter]');
    const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => expect(input).toHaveFocus());
    await user.keyboard('[ArrowDown][Escape]');
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.keyboard('[Enter]');

    const reopenedInput = await screen.findByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => expect(reopenedInput).toHaveFocus());
    expect(reopenedInput).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('menuitem', { name: 'Rename' }).id,
    );
  });

  it('does not highlight an item when a controlled open follows a keyboard open', async () => {
    const [openProp, setOpenProp] = createSignal<boolean | undefined>(undefined);

    function ControlledTest() {
      const [open, setOpen] = createSignal(false);

      return (
        <Menu.FilterProvider>
          <Menu.Root open={openProp() ?? open()} onOpenChange={(next) => setOpen(next)}>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                    <Menu.Item>Delete</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      );
    }

    const { user } = renderWithUser(() => <ControlledTest />);
    await act(() => screen.getByRole('button', { name: 'Actions' }).focus());
    await user.keyboard('[ArrowDown]');
    const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Rename' }).id,
      );
    });

    await act(() => setOpenProp(false));
    await waitFor(() => {
      expect(screen.queryByRole('searchbox', { name: 'Filter actions' })).toBe(null);
    });
    await act(() => setOpenProp(true));

    const reopenedInput = await screen.findByRole('searchbox', { name: 'Filter actions' });
    await act(() => waitSingleFrame());
    expect(reopenedInput).not.toHaveAttribute('aria-activedescendant');
  });
});
