import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Combobox } from '..';
import { act, createRef } from '../test-utils';

describe('<Combobox.Popup />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Combobox.Root open>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup
              data-testid="popup"
              ref={(el) => {
                ref = el;
              }}
              class={(state) => (state.open ? 'open' : 'closed')}
              style={{ color: 'red' }}
              render={(props) => <section {...props} />}
            />
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const popup = screen.getByTestId('popup');
    expect(ref).toBe(popup);
    expect(popup.tagName).toBe('SECTION');
    expect(popup).toHaveClass('open');
    expect(popup).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('exposes open state via data attributes mapping', async () => {
    render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup" />
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const popup = await screen.findByTestId('popup');
    expect(popup).toHaveAttribute('data-open');
  });

  it('sets role to presentation when input renders outside the popup', async () => {
    render(() => (
      <Combobox.Root defaultOpen items={['Apple']}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup" />
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const popup = await screen.findByTestId('popup');
    await waitFor(() => {
      expect(popup).toHaveAttribute('role', 'presentation');
    });
  });

  it('sets role to dialog when input renders inside the popup', async () => {
    render(() => (
      <Combobox.Root defaultOpen items={['Apple']}>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.Input />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const popup = await screen.findByTestId('popup');
    await waitFor(() => {
      expect(popup).toHaveAttribute('role', 'dialog');
    });
  });

  it('focuses the popup instead of its input when opened by touch', async () => {
    render(() => (
      <Combobox.Root>
        <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.Input data-testid="input" />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerDown(trigger, { pointerType: 'touch' });
    fireEvent.mouseDown(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveFocus();
    });
    expect(screen.getByTestId('input')).not.toHaveFocus();
  });

  it('honors initialFocus={false}', async () => {
    render(() => (
      <Combobox.Root>
        <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup initialFocus={false}>
              <Combobox.Input data-testid="input" />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);

    await screen.findByTestId('input');
    expect(trigger).toHaveFocus();
  });

  it('passes the close type of an item press to a finalFocus function', async () => {
    const user = userEvent.setup();
    const finalFocus = vi.fn(() => false);

    render(() => (
      <Combobox.Root>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup finalFocus={finalFocus}>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
                <Combobox.Item value="b">b</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByTestId('input');

    await user.click(input);
    // user-event's synthetic clicks carry no pointer type, so the mouse press is dispatched
    // directly.
    const option = await screen.findByRole('option', { name: 'a' });
    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.click(option, { detail: 1 });
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBe(null);
    });
    expect(finalFocus).toHaveBeenLastCalledWith('mouse');

    await act(() => input.focus());
    await user.keyboard('{ArrowDown}');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBe(null);
    });
    expect(finalFocus).toHaveBeenLastCalledWith('keyboard');
  });

  it('returns focus to an explicitly provided element when the popup closes', async () => {
    const user = userEvent.setup();
    const finalFocusRef = createRef<HTMLButtonElement>();

    render(() => (
      <div>
        <button
          ref={(el) => {
            finalFocusRef.current = el;
          }}
          type="button"
        >
          final focus
        </button>
        <Combobox.Root defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup finalFocus={finalFocusRef}>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </div>
    ));

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'final focus' })).toHaveFocus();
    });
  });
});
