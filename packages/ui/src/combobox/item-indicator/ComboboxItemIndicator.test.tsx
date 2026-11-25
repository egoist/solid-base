import { createSignal } from 'solid-js';
import { render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Combobox } from '..';
import { flushMicrotasks } from '../test-utils';

describe('<Combobox.ItemIndicator />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  function renderTestComponent(initialValue: string, keepMounted?: boolean) {
    const [value, setValue] = createSignal(initialValue);
    render(() => (
      <Combobox.Root value={value()} open>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">
                  a
                  <Combobox.ItemIndicator keepMounted={keepMounted} data-testid="indicator" />
                </Combobox.Item>
                <Combobox.Item value="b">b</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));
    return {
      async setValue(next: string) {
        setValue(next);
        await flushMicrotasks();
      },
    };
  }

  it('forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Combobox.Root>
        <Combobox.Item value="x">
          <Combobox.ItemIndicator
            keepMounted
            data-testid="indicator"
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.selected ? 'selected' : 'unselected')}
            style={{ color: 'red' }}
            render={(props) => <i {...props} />}
          />
        </Combobox.Item>
      </Combobox.Root>
    ));

    const indicator = screen.getByTestId('indicator');
    expect(ref).toBe(indicator);
    expect(indicator.tagName).toBe('I');
    expect(indicator).toHaveClass('unselected');
    expect(indicator).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('updates a mounted indicator when its item becomes unselected', async () => {
    const user = userEvent.setup();
    render(() => (
      <Combobox.Root defaultOpen defaultValue="apple">
        <Combobox.Input />
        <Combobox.Portal keepMounted>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="apple">
                  apple
                  <Combobox.ItemIndicator keepMounted data-testid="apple-indicator" />
                </Combobox.Item>
                <Combobox.Item value="banana">banana</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.getByTestId('apple-indicator')).toHaveAttribute('data-selected');

    await user.click(screen.getByRole('option', { name: 'banana' }));

    expect(screen.getByTestId('apple-indicator')).not.toHaveAttribute('data-selected');
  });

  it('mounts only while selected when keepMounted is false', async () => {
    const { setValue } = renderTestComponent('b');

    expect(screen.queryByTestId('indicator')).toBe(null);

    await setValue('a');

    const indicator = screen.getByTestId('indicator');
    expect(indicator).toHaveAttribute('data-selected');
    expect(indicator).toHaveAttribute('aria-hidden', 'true');
    expect(indicator).not.toHaveAttribute('selected');

    await setValue('b');

    await waitFor(() => expect(screen.queryByTestId('indicator')).toBe(null));

    await setValue('a');

    expect(screen.getByTestId('indicator')).toHaveAttribute('data-selected');
  });

  it('preserves the kept-mounted element across selection changes', async () => {
    const { setValue } = renderTestComponent('b', true);
    const indicator = screen.getByTestId('indicator');

    expect(indicator).not.toHaveAttribute('data-selected');

    await setValue('a');

    expect(screen.getByTestId('indicator')).toBe(indicator);
    expect(indicator).toHaveAttribute('data-selected');

    await setValue('b');

    expect(screen.getByTestId('indicator')).toBe(indicator);
    expect(indicator).not.toHaveAttribute('data-selected');
    await waitFor(() => {
      expect(indicator).not.toHaveAttribute('data-ending-style');
    });

    await setValue('a');

    expect(screen.getByTestId('indicator')).toBe(indicator);
    expect(indicator).toHaveAttribute('data-selected');
  });
});
