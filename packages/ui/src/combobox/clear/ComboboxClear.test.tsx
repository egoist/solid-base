import { For, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Combobox } from '..';
import { Autocomplete } from '../../autocomplete';
import { flushMicrotasks } from '../test-utils';

describe('<Combobox.Clear />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Combobox.Root defaultValue="a">
        <Combobox.Input />
        <Combobox.Clear
          data-testid="clear"
          ref={(el) => {
            ref = el;
          }}
          class={(state) => (state.visible ? 'visible' : 'hidden')}
          style={{ color: 'red' }}
          render={(props) => <button {...props} data-custom="" />}
        />
      </Combobox.Root>
    ));

    const clear = screen.getByTestId('clear');
    expect(ref).toBe(clear);
    expect(clear).toBeInstanceOf(window.HTMLButtonElement);
    expect(clear).toHaveAttribute('data-custom');
    expect(clear).toHaveClass('visible');
    expect(clear).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('renders in single mode when a value is selected', () => {
    render(() => (
      <Combobox.Root defaultValue="a">
        <Combobox.Input />
        <Combobox.Clear data-testid="clear" />
      </Combobox.Root>
    ));
    expect(screen.getByTestId('clear')).not.toBe(null);
  });

  it('does not render without a value by default', () => {
    render(() => (
      <Combobox.Root>
        <Combobox.Input />
        <Combobox.Clear data-testid="clear" />
      </Combobox.Root>
    ));

    expect(screen.queryByTestId('clear')).toBe(null);
  });

  it('renders and clears the typed value in no-selection mode', async () => {
    const user = userEvent.setup();
    render(() => (
      <Autocomplete.Root defaultValue="apple">
        <Autocomplete.Input />
        <Autocomplete.Clear data-testid="clear" />
      </Autocomplete.Root>
    ));

    const input = screen.getByRole<HTMLInputElement>('combobox');
    expect(input.value).toBe('apple');

    await user.click(screen.getByTestId('clear'));

    expect(input.value).toBe('');
    expect(input).toHaveFocus();
  });

  it('renders and clears chips in multiple mode', async () => {
    const user = userEvent.setup();
    render(() => (
      <Combobox.Root multiple defaultValue={['apple']}>
        <Combobox.Chips>
          <Combobox.Value>
            {(value: string[]) => (
              <For each={value}>{(item) => <Combobox.Chip>{item}</Combobox.Chip>}</For>
            )}
          </Combobox.Value>
          <Combobox.Input />
        </Combobox.Chips>
        <Combobox.Clear data-testid="clear" />
      </Combobox.Root>
    ));

    expect(screen.getByText('apple')).not.toBe(null);

    await user.click(screen.getByTestId('clear'));

    expect(screen.queryByText('apple')).toBe(null);
  });

  it('click clears selected value and focuses input', async () => {
    const user = userEvent.setup();
    render(() => (
      <Combobox.Root defaultValue="a">
        <Combobox.Input data-testid="input" />
        <Combobox.Clear data-testid="clear" />
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

    const input = screen.getByRole('combobox');
    await user.click(screen.getByTestId('clear'));
    await flushMicrotasks();

    expect(screen.queryByTestId('clear')).toBe(null);
    expect(document.activeElement).toBe(input);
  });

  it('clears after pointer interaction marks keyboard navigation inactive', async () => {
    const user = userEvent.setup();
    render(() => (
      <Combobox.Root defaultValue="a">
        <Combobox.Input data-testid="input" />
        <Combobox.Clear data-testid="clear" />
      </Combobox.Root>
    ));

    fireEvent.pointerMove(screen.getByTestId('input'));
    flush();
    await user.click(screen.getByTestId('clear'));
    await flushMicrotasks();

    expect(screen.queryByTestId('clear')).toBe(null);
  });

  it('does not dismiss the popup on click (outsidePress is blocked)', async () => {
    const user = userEvent.setup();
    render(() => (
      <Combobox.Root defaultOpen defaultValue="a">
        <Combobox.Input data-testid="input" />
        <Combobox.Clear data-testid="clear" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
                <Combobox.Item value="b">b</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.getByRole('listbox')).not.toBe(null);

    await user.click(screen.getByTestId('clear'));

    expect(screen.getByRole('listbox')).not.toBe(null);
  });

  it('does not dismiss a popup input when the clear button is rendered outside it', async () => {
    const user = userEvent.setup();
    render(() => (
      <Combobox.Root items={['a', 'b']} defaultValue="a">
        <Combobox.Trigger>
          <Combobox.Value />
        </Combobox.Trigger>
        <Combobox.Clear data-testid="clear" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Input data-testid="input" />
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    await user.click(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getByTestId('input')).toHaveFocus());

    await user.click(screen.getByTestId('clear'));
    await flushMicrotasks();

    expect(screen.getByRole('dialog')).not.toBe(null);
    expect(screen.getByTestId('input')).toHaveFocus();
    expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('aria-selected', 'false');
  });

  it('is disabled when root disabled and does nothing on click', () => {
    render(() => (
      <Combobox.Root defaultValue="a" disabled>
        <Combobox.Input data-testid="input" />
        <Combobox.Clear data-testid="clear" />
      </Combobox.Root>
    ));

    const clear = screen.getByTestId('clear');
    expect(clear).toHaveAttribute('disabled');

    fireEvent.click(clear);
    flush();
    expect(screen.getByTestId('clear')).not.toBe(null);
  });

  it('when root is readOnly it does nothing on click', () => {
    render(() => (
      <Combobox.Root defaultValue="a" readOnly>
        <Combobox.Input data-testid="input" />
        <Combobox.Clear data-testid="clear" />
      </Combobox.Root>
    ));

    const clear = screen.getByTestId('clear');

    fireEvent.click(clear);
    flush();
    expect(screen.getByTestId('clear')).not.toBe(null);
  });

  it('clears selection without closing and restores popup input focus', async () => {
    const user = userEvent.setup();
    render(() => (
      <Combobox.Root defaultValue="a">
        <Combobox.Trigger data-testid="trigger">
          <Combobox.Value placeholder="None" />
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner data-testid="positioner">
            <Combobox.Popup>
              <Combobox.Input data-testid="input" />
              <Combobox.Clear
                keepMounted
                data-testid="clear"
                class={(state) => (state.visible ? 'visible' : 'hidden')}
              />
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    await user.click(screen.getByTestId('trigger'));

    const clear = await screen.findByTestId('clear');

    await waitFor(() => {
      expect(screen.getByTestId('positioner')).toHaveAttribute('data-open', '');
    });
    expect(clear).toHaveClass('visible');
    expect(clear).toHaveAttribute('data-visible', '');

    await user.click(clear);

    await waitFor(() => {
      expect(clear).toHaveClass('hidden');
    });
    expect(clear).not.toHaveAttribute('data-visible');
    expect(screen.getByRole('dialog')).not.toBe(null);
    expect(screen.getByTestId('input')).toHaveFocus();
    expect(screen.getByTestId('trigger')).toHaveTextContent('None');
    expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('aria-selected', 'false');
  });

  // jsdom doesn't run CSS transitions (upstream skips these in jsdom).
  describe.skip('animations', () => {
    it('triggers enter animation via data-starting-style when becoming visible', () => {});
    it('triggers exit animation via data-ending-style before unmount', () => {});
  });
});
