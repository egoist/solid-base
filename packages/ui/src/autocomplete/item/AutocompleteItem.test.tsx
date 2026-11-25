import { render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Autocomplete } from '..';

describe('<Autocomplete.Item />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  describe('prop: onClick', () => {
    it('calls onClick when clicked with a pointer', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(() => (
        <Autocomplete.Root items={['apple', 'banana']} openOnInputClick>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item: string) => (
                    <Autocomplete.Item value={item} onClick={handleClick}>
                      {item}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);

      const option = await screen.findByRole('option', { name: 'banana' });
      await user.click(option);

      expect(handleClick.mock.calls.length).toBe(1);
    });

    it('calls onClick when selected with Enter key (via root interaction)', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(() => (
        <Autocomplete.Root items={['one', 'two']} openOnInputClick>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item: string) => (
                    <Autocomplete.Item value={item} onClick={handleClick}>
                      {item}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      // Move highlight to an option then press Enter to select it
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(handleClick.mock.calls.length).toBe(1);
    });
  });

  it('does not expose data-selected when reopening after a value is chosen', async () => {
    const user = userEvent.setup();
    render(() => (
      <Autocomplete.Root openOnInputClick>
        <Autocomplete.Input data-testid="input" />
        <Autocomplete.Portal>
          <Autocomplete.Positioner>
            <Autocomplete.Popup>
              <Autocomplete.List>
                <Autocomplete.Item value="apple">apple</Autocomplete.Item>
                <Autocomplete.Item value="banana">banana</Autocomplete.Item>
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
    ));

    const input = screen.getByTestId('input');

    await user.click(input);
    await user.click(await screen.findByRole('option', { name: 'banana' }));
    await user.click(input);

    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute('data-selected'),
    );
  });
});
