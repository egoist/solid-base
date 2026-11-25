import { render, screen, waitFor } from '@solidjs/testing-library';
import { createSignal, flush } from 'solid-js';
import { Select } from '..';
import { renderWithUser } from '../test-utils';

describe('<Select.ItemIndicator />', () => {
  function renderTestComponent(initialValue: string, keepMounted?: boolean) {
    const [value, setValue] = createSignal(initialValue);
    render(() => (
      <Select.Root value={value()} open>
        <Select.Trigger />
        <Select.Positioner>
          <Select.Popup>
            <Select.Item value="a">
              a
              <Select.ItemIndicator keepMounted={keepMounted} data-testid="indicator" />
            </Select.Item>
            <Select.Item value="b">b</Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Root>
    ));
    flush();
    return {
      setValue(next: string) {
        setValue(next);
        flush();
      },
    };
  }

  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Select.Root open defaultValue="a">
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Positioner>
          <Select.Item value="a">
            <Select.ItemIndicator
              data-testid="indicator"
              ref={(el) => {
                ref = el;
              }}
              class={(state) => (state.selected ? 'indicator selected' : 'indicator')}
              style={{ color: 'red' }}
              render={(props) => <i {...props} />}
            />
          </Select.Item>
        </Select.Positioner>
      </Select.Root>
    ));
    flush();
    const indicator = screen.getByTestId('indicator');
    expect(ref).toBe(indicator);
    expect(indicator.tagName).toBe('I');
    expect(indicator).toHaveClass('indicator', 'selected');
    expect(indicator).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('settles out of its transition state after the item is deselected', async () => {
    const { user } = renderWithUser(() => (
      <Select.Root multiple defaultOpen defaultValue={['a']}>
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="a">
                a
                <Select.ItemIndicator keepMounted data-testid="indicator" />
              </Select.Item>
              <Select.Item value="b">b</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));
    flush();

    const indicator = screen.getByTestId('indicator');
    expect(indicator).toHaveAttribute('data-selected');

    await user.click(screen.getByRole('option', { name: 'a' }));

    await waitFor(() => {
      expect(indicator).not.toHaveAttribute('data-selected');
    });

    // A kept-mounted indicator must not be left advertising an exit transition once the
    // deselection has finished, or `[data-ending-style]` CSS would stick permanently.
    await waitFor(() => {
      expect(indicator).not.toHaveAttribute('data-ending-style');
    });
  });

  it('mounts only while selected when keepMounted is false', async () => {
    const { setValue } = renderTestComponent('b');

    expect(screen.queryByTestId('indicator')).toBe(null);

    setValue('a');

    const indicator = screen.getByTestId('indicator');
    expect(indicator).toHaveAttribute('data-selected');
    expect(indicator).toHaveAttribute('aria-hidden', 'true');
    expect(indicator).not.toHaveAttribute('selected');

    setValue('b');

    await waitFor(() => {
      expect(screen.queryByTestId('indicator')).toBe(null);
    });

    setValue('a');

    expect(screen.getByTestId('indicator')).toHaveAttribute('data-selected');
  });

  it('preserves the kept-mounted element across selection changes', async () => {
    const { setValue } = renderTestComponent('b', true);
    const indicator = screen.getByTestId('indicator');

    expect(indicator).not.toHaveAttribute('data-selected');

    setValue('a');

    expect(screen.getByTestId('indicator')).toBe(indicator);
    expect(indicator).toHaveAttribute('data-selected');

    setValue('b');

    expect(screen.getByTestId('indicator')).toBe(indicator);
    expect(indicator).not.toHaveAttribute('data-selected');
    await waitFor(() => {
      expect(indicator).not.toHaveAttribute('data-ending-style');
    });

    setValue('a');

    expect(screen.getByTestId('indicator')).toBe(indicator);
    expect(indicator).toHaveAttribute('data-selected');
  });
});
