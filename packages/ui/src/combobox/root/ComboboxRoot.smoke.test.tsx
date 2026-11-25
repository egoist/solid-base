import { render, screen, waitFor, fireEvent } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { flush } from 'solid-js';
import { Combobox } from '..';
import { Autocomplete } from '../../autocomplete';

describe('scratch', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('autocomplete basic', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(() => (
      <Autocomplete.Root items={['apple', 'banana']} onValueChange={onValueChange}>
        <Autocomplete.Input data-testid="input" />
        <Autocomplete.Portal>
          <Autocomplete.Positioner>
            <Autocomplete.Popup>
              <Autocomplete.List>
                {(item: string) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>}
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
    ));
    const input = screen.getByTestId('input');
    await user.type(input, 'ap');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    await user.click(screen.getByRole('option'));
    expect(input).toHaveValue('apple');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
  });

  it('input inside popup', async () => {
    const user = userEvent.setup();
    render(() => (
      <Combobox.Root items={['apple', 'banana']}>
        <Combobox.Trigger data-testid="trigger">
          <Combobox.Value placeholder="Pick" />
        </Combobox.Trigger>
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
    const trigger = screen.getByTestId('trigger');
    expect(trigger).toHaveTextContent('Pick');
    await user.click(trigger);
    const input = await screen.findByTestId('input');
    await waitFor(() => expect(input).toHaveFocus());
    await user.type(input, 'ban');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(trigger).toHaveTextContent('banana'));
    await waitFor(() => expect(screen.queryByTestId('input')).toBe(null));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('form submission', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: SubmitEvent) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget as HTMLFormElement);
      return fd.get('fruit');
    });
    render(() => (
      <form onSubmit={onSubmit} data-testid="form">
        <Combobox.Root name="fruit" items={['apple', 'banana']} defaultValue="banana">
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
        <button type="submit">Submit</button>
      </form>
    ));
    expect(screen.getByTestId('input')).toHaveValue('banana');
    await user.click(screen.getByText('Submit'));
    expect(onSubmit.mock.results[0].value).toBe('banana');
  });

  it('inline list', async () => {
    const user = userEvent.setup();
    render(() => (
      <Combobox.Root items={['apple', 'banana']} inline open>
        <Combobox.Input data-testid="input" />
        <Combobox.List>
          {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
        </Combobox.List>
      </Combobox.Root>
    ));
    const input = screen.getByTestId('input');
    await user.click(input);
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(screen.getAllByRole('option')[0]).toHaveAttribute('data-highlighted'));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true'));
  });

  it('individual items without items prop', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(() => (
      <Combobox.Root onValueChange={onValueChange} defaultValue="b">
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
                <Combobox.Item value="b">b</Combobox.Item>
                <Combobox.Item value="c">c</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));
    const input = screen.getByTestId('input');
    expect(input).toHaveValue('b');
    await user.click(input);
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(screen.getByRole('option', { name: 'c' })).toHaveAttribute('data-highlighted'));
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('c', expect.anything());
    fireEvent.keyDown(input, { key: 'Escape' });
    flush();
  });
});
