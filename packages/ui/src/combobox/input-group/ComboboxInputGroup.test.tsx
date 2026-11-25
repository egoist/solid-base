import { Portal } from '@solidjs/web';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Combobox } from '..';
import { Field } from '../../field';
import { flushMicrotasks } from '../test-utils';

describe('<Combobox.InputGroup />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Combobox.Root items={['a']}>
        <Combobox.InputGroup
          data-testid="group"
          ref={(el) => {
            ref = el;
          }}
          class={(state) => (state.open ? 'open' : 'closed')}
          style={{ color: 'red' }}
          render={(props) => <section {...props} />}
        />
      </Combobox.Root>
    ));

    const group = screen.getByTestId('group');
    expect(ref).toBe(group);
    expect(group.tagName).toBe('SECTION');
    expect(group).toHaveClass('closed');
    expect(group).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('should not dismiss the popup when clicking inside the input group', async () => {
    const user = userEvent.setup();
    render(() => (
      <Combobox.Root items={['a', 'b']}>
        <Combobox.InputGroup style={{ padding: '10px' }}>
          <span data-testid="pad">padding</span>
          <Combobox.Input />
          <Combobox.Trigger>Open</Combobox.Trigger>
        </Combobox.InputGroup>

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

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('listbox')).not.toBe(null);

    await user.click(screen.getByTestId('pad'));
    expect(screen.queryByRole('listbox')).not.toBe(null);
  });

  function ChipsGroup(props: { rootProps?: Record<string, unknown> }) {
    return (
      <Combobox.Root items={['a', 'b']} multiple defaultValue={['a']} {...props.rootProps}>
        <Combobox.InputGroup data-testid="group" style={{ padding: '10px' }}>
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip">a</Combobox.Chip>
            <Combobox.Input data-testid="input" />
          </Combobox.Chips>
        </Combobox.InputGroup>

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
    );
  }

  it('focuses the input and opens when clicking input-group padding around chips', async () => {
    render(() => <ChipsGroup />);

    const group = screen.getByTestId('group');
    const input = screen.getByTestId('input');

    fireEvent.mouseDown(group);
    await flushMicrotasks();

    expect(input).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBe(null);
  });

  it('does not focus the input when pressing content in a nested portal', async () => {
    const user = userEvent.setup();
    render(() => (
      <Combobox.Root items={['a']}>
        <Combobox.InputGroup>
          <Combobox.Input data-testid="input" />
          <Portal mount={document.body}>
            <div data-testid="portal" />
          </Portal>
        </Combobox.InputGroup>
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

    const input = screen.getByTestId('input');
    expect(input).not.toHaveFocus();

    await user.pointer({ keys: '[MouseLeft]', target: screen.getByTestId('portal') });

    expect(input).not.toHaveFocus();
    expect(screen.queryByRole('listbox')).toBe(null);
  });

  it('does not handle chip presses a second time when chips are nested inside the input group', async () => {
    const onOpenChange = vi.fn();

    render(() => <ChipsGroup rootProps={{ onOpenChange }} />);

    fireEvent.mouseDown(screen.getByTestId('chip'));
    await flushMicrotasks();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it('focuses the input without opening when openOnInputClick is false', async () => {
    render(() => <ChipsGroup rootProps={{ openOnInputClick: false }} />);

    fireEvent.mouseDown(screen.getByTestId('group'));
    await flushMicrotasks();

    expect(screen.getByTestId('input')).toHaveFocus();
    expect(screen.queryByRole('listbox')).toBe(null);
  });

  it('does not focus or open when disabled by Field.Root', async () => {
    render(() => (
      <Field.Root disabled>
        <ChipsGroup />
      </Field.Root>
    ));

    fireEvent.mouseDown(screen.getByTestId('group'));
    await flushMicrotasks();

    expect(screen.getByTestId('input')).not.toHaveFocus();
    expect(screen.queryByRole('listbox')).toBe(null);
  });

  it('focuses the input and opens when readOnly', async () => {
    render(() => <ChipsGroup rootProps={{ readOnly: true }} />);

    fireEvent.mouseDown(screen.getByTestId('group'));
    await flushMicrotasks();

    expect(screen.getByTestId('input')).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBe(null);
  });

  it('has role prop', () => {
    render(() => (
      <Combobox.Root items={['a']}>
        <Combobox.InputGroup />
      </Combobox.Root>
    ));

    expect(screen.queryByRole('group')).not.toBe(null);
  });
});
