import { flush } from 'solid-js';
import { Portal } from '@solidjs/web';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Combobox } from '..';
import { Field } from '../../field';
import { flushMicrotasks } from '../test-utils';

describe('<Combobox.Chips />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Combobox.Root>
        <Combobox.Chips
          data-testid="chips"
          ref={(el) => {
            ref = el;
          }}
          class="chips"
          style={{ color: 'red' }}
          render={(props) => <section {...props} />}
        />
      </Combobox.Root>
    ));

    const chips = screen.getByTestId('chips');
    expect(ref).toBe(chips);
    expect(chips.tagName).toBe('SECTION');
    expect(chips).toHaveClass('chips');
    expect(chips).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('does not set role="toolbar" when there are no chips', () => {
    render(() => (
      <Combobox.Root multiple>
        <Combobox.Chips data-testid="chips" />
      </Combobox.Root>
    ));

    const chips = screen.getByTestId('chips');
    expect(chips).not.toHaveAttribute('role');
  });

  it('sets role="toolbar" when there is at least one chip', () => {
    render(() => (
      <Combobox.Root multiple defaultValue={['apple']}>
        <Combobox.Chips data-testid="chips">
          <Combobox.Chip>apple</Combobox.Chip>
        </Combobox.Chips>
      </Combobox.Root>
    ));

    const chips = screen.getByTestId('chips');
    expect(chips).toHaveAttribute('role', 'toolbar');
  });

  it('focuses the input when clicking anywhere in the Chips area', () => {
    render(() => (
      <Combobox.Root multiple defaultValue={['apple']}>
        <Combobox.Chips data-testid="chips">
          <Combobox.Chip data-testid="chip">apple</Combobox.Chip>
          <Combobox.Input data-testid="input" />
        </Combobox.Chips>
      </Combobox.Root>
    ));

    const chips = screen.getByTestId('chips');
    const chip = screen.getByTestId('chip');
    const input = screen.getByTestId('input');

    expect(document.activeElement).not.toBe(input);

    fireEvent.mouseDown(chips);
    flush();
    expect(input).toHaveFocus();

    // Blur and click on a chip: input should still receive focus.
    input.blur();
    expect(document.activeElement).not.toBe(input);
    fireEvent.mouseDown(chip);
    flush();
    expect(input).toHaveFocus();
  });

  it('does not focus the input when pressing content in a nested portal', async () => {
    const user = userEvent.setup();
    render(() => (
      <Combobox.Root items={['apple']} multiple>
        <Combobox.Chips>
          <Combobox.Input data-testid="input" />
          <Portal mount={document.body}>
            <div data-testid="portal" />
          </Portal>
        </Combobox.Chips>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="apple">apple</Combobox.Item>
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

  it('lets onMouseDown prevent the built-in focus and open behavior', () => {
    const handleMouseDown = vi.fn();

    render(() => (
      <Combobox.Root items={['apple', 'banana']} multiple defaultValue={['apple']}>
        <Combobox.Chips
          data-testid="chips"
          onMouseDown={(event) => {
            handleMouseDown(event);
            event.preventBaseUIHandler();
          }}
        >
          <Combobox.Chip>apple</Combobox.Chip>
          <Combobox.Input data-testid="input" />
        </Combobox.Chips>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="apple">apple</Combobox.Item>
                <Combobox.Item value="banana">banana</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const chips = screen.getByTestId('chips');
    const input = screen.getByTestId('input');

    fireEvent.mouseDown(chips);
    flush();

    expect(handleMouseDown).toHaveBeenCalledTimes(1);
    expect(input).not.toHaveFocus();
    expect(screen.queryByRole('listbox')).toBe(null);
  });

  it('lets nested chip onMouseDown prevent the built-in focus and open behavior', () => {
    const handleMouseDown = vi.fn();

    render(() => (
      <Combobox.Root items={['apple', 'banana']} multiple defaultValue={['apple']}>
        <Combobox.Chips data-testid="chips">
          <Combobox.Chip
            data-testid="chip"
            onMouseDown={(event) => {
              handleMouseDown(event);
              event.preventBaseUIHandler();
            }}
          >
            apple
          </Combobox.Chip>
          <Combobox.Input data-testid="input" />
        </Combobox.Chips>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="apple">apple</Combobox.Item>
                <Combobox.Item value="banana">banana</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    fireEvent.mouseDown(screen.getByTestId('chip'));
    flush();

    expect(handleMouseDown).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('input')).not.toHaveFocus();
    expect(screen.queryByRole('listbox')).toBe(null);
  });

  it('lets nested chip onContextMenu call preventBaseUIHandler', () => {
    const handleContextMenu = vi.fn();

    render(() => (
      <Combobox.Root items={['apple', 'banana']} multiple defaultValue={['apple']}>
        <Combobox.Chips>
          <Combobox.Chip
            data-testid="chip"
            onContextMenu={(event) => {
              handleContextMenu(event);
              event.preventBaseUIHandler();
            }}
          >
            apple
          </Combobox.Chip>
          <Combobox.Input />
        </Combobox.Chips>
      </Combobox.Root>
    ));

    expect(() => fireEvent.contextMenu(screen.getByTestId('chip'))).not.toThrow();
    expect(handleContextMenu).toHaveBeenCalledTimes(1);
  });

  it('does not treat chip remove presses as chips-area presses', () => {
    render(() => (
      <Combobox.Root items={['apple', 'banana']} multiple defaultValue={['apple']}>
        <Combobox.Chips>
          <Combobox.Chip>
            apple
            <Combobox.ChipRemove data-testid="remove" />
          </Combobox.Chip>
          <Combobox.Input />
        </Combobox.Chips>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="apple">apple</Combobox.Item>
                <Combobox.Item value="banana">banana</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    fireEvent.mouseDown(screen.getByTestId('remove'));
    flush();
    expect(screen.queryByRole('listbox')).toBe(null);
  });

  it('does not focus or open when disabled by Field.Root', () => {
    render(() => (
      <Field.Root disabled>
        <Combobox.Root items={['apple', 'banana']} multiple defaultValue={['apple']}>
          <Combobox.Chips data-testid="chips">
            <Combobox.Chip>apple</Combobox.Chip>
            <Combobox.Input data-testid="input" />
          </Combobox.Chips>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </Field.Root>
    ));

    fireEvent.mouseDown(screen.getByTestId('chips'));
    flush();

    expect(screen.getByTestId('input')).not.toHaveFocus();
    expect(screen.queryByRole('listbox')).toBe(null);
  });

  it('focuses the input and opens when readOnly', async () => {
    render(() => (
      <Combobox.Root items={['apple', 'banana']} multiple readOnly defaultValue={['apple']}>
        <Combobox.Chips data-testid="chips">
          <Combobox.Chip>apple</Combobox.Chip>
          <Combobox.Input data-testid="input" />
        </Combobox.Chips>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="apple">apple</Combobox.Item>
                <Combobox.Item value="banana">banana</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    fireEvent.mouseDown(screen.getByTestId('chips'));
    await flushMicrotasks();

    expect(screen.getByTestId('input')).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBe(null);
  });

  it('opens and focuses an input rendered inside the popup when the chips area is pressed', async () => {
    const user = userEvent.setup();
    render(() => (
      <Combobox.Root items={['apple', 'banana']} multiple defaultValue={['apple']}>
        <Combobox.Chips data-testid="chips">
          <Combobox.Chip>apple</Combobox.Chip>
        </Combobox.Chips>
        <Combobox.Trigger>Open</Combobox.Trigger>
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

    await user.click(screen.getByTestId('chips'));

    expect(await screen.findByRole('dialog')).not.toBe(null);
    await waitFor(() => expect(screen.getByTestId('input')).toHaveFocus());
  });

  it('clears the highlighted chip when the popup opens', async () => {
    const user = userEvent.setup();
    render(() => (
      <Combobox.Root multiple defaultValue={['apple']}>
        <Combobox.Chips>
          <Combobox.Chip data-testid="chip">apple</Combobox.Chip>
          <Combobox.Input data-testid="input" />
        </Combobox.Chips>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="banana">banana</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));
    await flushMicrotasks();

    const input = screen.getByTestId<HTMLInputElement>('input');
    input.focus();
    input.setSelectionRange(0, 0);
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByTestId('chip')).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).not.toBe(null);

    input.focus();
    input.setSelectionRange(0, 0);
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByTestId('chip')).toHaveFocus();
  });
});
