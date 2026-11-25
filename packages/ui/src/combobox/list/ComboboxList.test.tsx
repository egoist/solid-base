import { render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Combobox } from '..';
import { Autocomplete } from '../../autocomplete';
import { act } from '../test-utils';

describe('<Combobox.List />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Combobox.Root>
        <Combobox.List
          data-testid="list"
          ref={(el) => {
            ref = el;
          }}
          class={(state) => (state.empty ? 'empty' : 'filled')}
          style={{ color: 'red' }}
          render={(props) => <section {...props} />}
        />
      </Combobox.Root>
    ));

    const list = screen.getByTestId('list');
    expect(ref).toBe(list);
    expect(list.tagName).toBe('SECTION');
    expect(list).toHaveClass('empty');
    expect(list).toHaveAttribute('data-empty');
    expect(list).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('sets role=listbox and aria-multiselectable in multiple mode', () => {
    render(() => (
      <Combobox.Root multiple defaultOpen>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const list = screen.getByRole('listbox');
    expect(list).toHaveAttribute('aria-multiselectable', 'true');
  });

  it('sets aria-readonly on the listbox when the root is readOnly', () => {
    render(() => (
      <Combobox.Root readOnly defaultOpen>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.getByRole('listbox')).toHaveAttribute('aria-readonly', 'true');
  });

  it('does not set aria-readonly on the grid when the root is readOnly', () => {
    render(() => (
      <Combobox.Root readOnly defaultOpen grid>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Row>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.Row>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    // `aria-readonly` on a grid describes cell editability, so the combobox carries the state.
    expect(screen.getByRole('grid')).not.toHaveAttribute('aria-readonly');
    expect(screen.getByTestId('input')).toHaveAttribute('aria-readonly', 'true');
  });

  it('does not set aria-readonly on the listbox by default', () => {
    render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.getByRole('listbox')).not.toHaveAttribute('aria-readonly');
  });

  it('sets aria-readonly on the Autocomplete listbox when the root is readOnly', () => {
    render(() => (
      <Autocomplete.Root readOnly defaultOpen>
        <Autocomplete.Portal>
          <Autocomplete.Positioner>
            <Autocomplete.Popup>
              <Autocomplete.List>
                <Autocomplete.Item value="a">a</Autocomplete.Item>
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
    ));

    expect(screen.getByRole('listbox')).toHaveAttribute('aria-readonly', 'true');
  });

  it('does not prevent Enter when no item is highlighted', async () => {
    render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const list = screen.getByRole('listbox');
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    await act(() => list.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
  });

  it('selects the highlighted item with Enter', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(() => (
      <Combobox.Root defaultOpen onValueChange={onValueChange}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{ArrowDown}');

    const list = screen.getByRole('listbox');
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    await act(() => list.dispatchEvent(event));

    expect(onValueChange).toHaveBeenCalledWith('a', expect.anything());
  });

  it.each([{ disabled: true }, { readOnly: true }])(
    'ignores Enter when interaction is disabled: %o',
    async (rootProps) => {
      const onValueChange = vi.fn();
      render(() => (
        <Combobox.Root defaultOpen onValueChange={onValueChange} {...rootProps}>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const list = screen.getByRole('listbox');
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      await act(() => list.dispatchEvent(event));

      expect(onValueChange).not.toHaveBeenCalled();
    },
  );
});
