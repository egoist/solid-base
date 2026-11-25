import { createSignal } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Combobox } from '..';
import { DirectionProvider } from '../../direction-provider';
import { REASONS } from '../../internals/reasons';
import { flushMicrotasks, renderWithProps, renderWithUser } from '../test-utils';

describe('<Combobox.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  describe('initial input value derivation', () => {
    it('derives input from defaultValue on first mount when unspecified', () => {
      render(() => (
        <Combobox.Root defaultValue="apple">
          <Combobox.Input />
        </Combobox.Root>
      ));

      expect(screen.getByRole('combobox')).toHaveValue('apple');
    });

    it('derives input from defaultValue on first mount with items prop', () => {
      const items = [{ value: 'apple', label: 'Apple' }];
      render(() => (
        <Combobox.Root items={items} defaultValue={items[0]}>
          <Combobox.Input />
        </Combobox.Root>
      ));

      expect(screen.getByRole('combobox')).toHaveValue('Apple');
    });

    it('derives input from controlled value on first mount when unspecified', () => {
      render(() => (
        <Combobox.Root value="banana">
          <Combobox.Input />
        </Combobox.Root>
      ));

      expect(screen.getByRole('combobox')).toHaveValue('banana');
    });

    it('defaultInputValue overrides derivation when provided', () => {
      render(() => (
        <Combobox.Root defaultValue="apple" defaultInputValue="x">
          <Combobox.Input />
        </Combobox.Root>
      ));

      expect(screen.getByRole('combobox')).toHaveValue('x');
    });

    it('inputValue overrides derivation when provided', () => {
      render(() => (
        <Combobox.Root value="apple" inputValue="x">
          <Combobox.Input />
        </Combobox.Root>
      ));

      expect(screen.getByRole('combobox')).toHaveValue('x');
    });

    it('multiple mode initial input remains empty', () => {
      const items = [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ];
      render(() => (
        <Combobox.Root multiple items={items}>
          <Combobox.Input />
        </Combobox.Root>
      ));

      const input = screen.getAllByRole('combobox').find((element) => element.tagName === 'INPUT');

      expect(input).toHaveValue('');
    });

    it('does not set input value for input-inside-popup pattern', async () => {
      render(() => (
        <Combobox.Root defaultOpen defaultValue="apple">
          <Combobox.Trigger>Trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));
      await flushMicrotasks();

      const input = screen.getAllByRole('combobox').find((element) => element.tagName === 'INPUT');

      expect(input).toHaveValue('');
    });
  });

  describe('input value synchronization', () => {
    it('updates derived input when controlled value changes externally', async () => {
      const items = [
        { value: 'apple', label: 'Apple' },
        { value: 'banana', label: 'Banana' },
      ];

      const { setProps } = renderWithProps(
        (props: { value: (typeof items)[number] }) => (
          <Combobox.Root items={items} value={props.value}>
            <Combobox.Input />
          </Combobox.Root>
        ),
        { value: items[0] },
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(input).toHaveValue('Apple');

      await setProps({ value: items[1] });

      expect(input).toHaveValue('Banana');
    });

    it('does not force-mount the list when controlled value changes externally', async () => {
      const items = ['apple', 'banana'];
      const labels: Record<string, string> = {
        apple: 'Apple',
        banana: 'Banana',
      };

      function App() {
        const [withItems, setWithItems] = createSignal<string | null>(null);
        const [withoutItems, setWithoutItems] = createSignal<string | null>(null);

        return (
          <div>
            <button
              type="button"
              onClick={() => {
                setWithItems('banana');
                setWithoutItems('banana');
              }}
            >
              Set
            </button>
            <Combobox.Root
              items={items}
              value={withItems()}
              onValueChange={setWithItems}
              itemToStringLabel={(item) => labels[item]}
            >
              <Combobox.Input data-testid="items-input" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{labels[item]}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
            <Combobox.Root
              value={withoutItems()}
              onValueChange={setWithoutItems}
              itemToStringLabel={(item) => labels[item]}
            >
              <Combobox.Input data-testid="plain-input" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="apple">Apple</Combobox.Item>
                      <Combobox.Item value="banana">Banana</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </div>
        );
      }

      const { user } = renderWithUser(() => <App />);

      expect(screen.queryAllByRole('listbox', { hidden: true })).toHaveLength(0);

      await user.click(screen.getByRole('button', { name: 'Set' }));
      await flushMicrotasks();

      expect(screen.queryAllByRole('listbox', { hidden: true })).toHaveLength(0);
      expect(screen.getByTestId('items-input')).toHaveValue('Banana');
      expect(screen.getByTestId('plain-input')).toHaveValue('Banana');
    });

    it('re-derives input when items array changes', async () => {
      const initialItems = [
        { value: 'a', label: 'Apple' },
        { value: 'b', label: 'Banana' },
      ];

      type Item = { value: string; label: string };
      const { setProps } = renderWithProps(
        (props: { items: Item[]; value: Item }) => (
          <Combobox.Root items={props.items} value={props.value}>
            <Combobox.Input />
          </Combobox.Root>
        ),
        { items: initialItems, value: initialItems[0] },
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(input).toHaveValue('Apple');

      const nextItems = [
        { value: 'a', label: 'Apricot' },
        { value: 'b', label: 'Banana' },
        { value: 'c', label: 'Cherry' },
      ];

      await setProps({ items: nextItems, value: nextItems[0] });
      expect(input).toHaveValue('Apricot');

      const sameLengthDifferentItems = [
        { value: 'a', label: 'Ambrosia' },
        { value: 'b', label: 'Blue Java' },
        { value: 'c', label: 'Clementine' },
      ];

      await setProps({ items: sameLengthDifferentItems, value: sameLengthDifferentItems[0] });
      expect(input).toHaveValue('Ambrosia');
    });

    it('restores the selected label after a one-step clear and items reload', async () => {
      const itemToStringLabel = (item: string) => (item === 'apple' ? 'Apple' : item);
      const { setProps, user } = renderWithProps(
        (props: { items: string[] }) => (
          <Combobox.Root items={props.items} value="apple" itemToStringLabel={itemToStringLabel}>
            <Combobox.Input />
          </Combobox.Root>
        ),
        { items: ['apple'] },
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(input).toHaveValue('Apple');

      await user.clear(input);
      await flushMicrotasks();
      expect(input).toHaveValue('');

      await setProps({ items: ['apple'] });

      expect(input).toHaveValue('Apple');
    });

    it('reports a single input value change when the controlled value changes', async () => {
      const onInputValueChange = vi.fn();
      const items = [
        { value: 'a', label: 'Apple' },
        { value: 'b', label: 'Banana' },
        { value: 'c', label: 'Cherry' },
      ];

      const { setProps } = renderWithProps(
        (props: { value: (typeof items)[number] }) => (
          <Combobox.Root items={items} value={props.value} onInputValueChange={onInputValueChange}>
            <Combobox.Input />
          </Combobox.Root>
        ),
        { value: items[0] },
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await setProps({ value: items[1] });

      expect(input).toHaveValue('Banana');
      expect(onInputValueChange).toHaveBeenCalledTimes(1);

      await setProps({ value: items[2] });

      expect(input).toHaveValue('Cherry');
      expect(onInputValueChange).toHaveBeenCalledTimes(2);

      await setProps({ value: items[0] });

      expect(input).toHaveValue('Apple');
      expect(onInputValueChange).toHaveBeenCalledTimes(3);
    });

    it('syncs again after a canceled sync to the same label', async () => {
      let cancelSync = false;

      const { setProps } = renderWithProps(
        (props: { value: string }) => (
          <Combobox.Root
            items={['One', 'Two']}
            value={props.value}
            onInputValueChange={(_, eventDetails) => {
              if (cancelSync && eventDetails.reason === 'none') {
                eventDetails.cancel();
              }
            }}
          >
            <Combobox.Input />
          </Combobox.Root>
        ),
        { value: 'One' },
      );
      const input = screen.getByRole<HTMLInputElement>('combobox');

      expect(input).toHaveValue('One');

      cancelSync = true;
      await setProps({ value: 'Two' });

      expect(input).toHaveValue('One');

      // The input already matches this label, so nothing is written and nothing observes a change.
      cancelSync = false;
      await setProps({ value: 'One' });

      expect(input).toHaveValue('One');

      await setProps({ value: 'Two' });

      expect(input).toHaveValue('Two');
    });

    it('reports a single input value change when the selection is remapped', async () => {
      const onInputValueChange = vi.fn();

      function App() {
        const [value, setValue] = createSignal('Apple');
        return (
          <Combobox.Root
            items={['Apple', 'Banana', 'Cherry']}
            value={value()}
            onValueChange={(next) => setValue(next === 'Banana' ? 'Cherry' : (next ?? ''))}
            onInputValueChange={onInputValueChange}
            defaultOpen
          >
            <Combobox.Input />
            <Combobox.List>
              {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
            </Combobox.List>
          </Combobox.Root>
        );
      }

      const { user } = renderWithUser(() => <App />);
      await flushMicrotasks();

      await user.click(screen.getByRole('option', { name: 'Banana' }));
      await flushMicrotasks();

      expect(screen.getByRole<HTMLInputElement>('combobox')).toHaveValue('Cherry');
      expect(
        onInputValueChange.mock.calls.map(([next, details]) => [next, details.reason]),
      ).toEqual([
        ['Banana', 'item-press'],
        ['Cherry', 'none'],
      ]);
    });

    it('re-syncs the input when the resolved label of an unchanged value changes', async () => {
      const { setProps } = renderWithProps(
        (props: { itemToStringLabel: (value: string) => string }) => (
          <Combobox.Root items={['a', 'b']} value="b" itemToStringLabel={props.itemToStringLabel}>
            <Combobox.Input />
          </Combobox.Root>
        ),
        { itemToStringLabel: (value: string) => value },
      );
      const input = screen.getByRole<HTMLInputElement>('combobox');

      expect(input).toHaveValue('b');

      await setProps({
        itemToStringLabel: (value: string) => (value === 'b' ? 'Banana' : value),
      });

      expect(input).toHaveValue('Banana');
    });

    it('restores derived input after items load asynchronously', async () => {
      const { setProps } = renderWithProps(
        (props: { items: string[] }) => (
          <Combobox.Root items={props.items} value="banana">
            <Combobox.Input />
          </Combobox.Root>
        ),
        { items: [] as string[] },
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(input).toHaveValue('banana');

      await setProps({ items: ['apple', 'banana', 'bread'] });

      expect(input).toHaveValue('banana');

      await setProps({ items: ['banana'] });

      expect(input).toHaveValue('banana');
    });
  });

  // jsdom doesn't run CSS animations, so the close animation these tests interrupt never plays
  // (upstream skips them in jsdom too).
  describe.skip('reopening during the close animation', () => {
    it('shows every item when a controlled reopen interrupts a canceled mirrored-selection clear', () => {});
    it('keeps the typed filter when items change afterwards (input outside popup)', () => {});
    it('keeps filtering when typing reopens the popup (input outside popup)', () => {});
    it('does not re-emit a clear when closing again without typing (multiple, input outside popup)', () => {});
    it('keeps a keystroke typed into an empty input when items refresh synchronously', () => {});
    it('releases the frozen query when controlled open reopens the popup', () => {});
    it('unfreezes filtering when a controlled open ignores the close request (multiple, input outside popup)', () => {});
    it('opens blank when the input only mirrors the selection (single, input inside popup)', () => {});
    it('keeps an input value set in the same batch as a controlled reopen (input inside popup)', () => {});
    it('shows every item when selection reopens the popup', () => {});
  });

  describe('prop: grid', () => {
    function GridCombobox(props: {
      rows: string[][];
      onItemHighlighted?: (value: any) => void;
      autoHighlight?: boolean;
      groups?: boolean;
    }) {
      return (
        <Combobox.Root
          grid
          autoHighlight={props.autoHighlight}
          onItemHighlighted={props.onItemHighlighted}
          defaultOpen
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {props.rows.map((row) => {
                    const rowElement = (
                      <Combobox.Row>
                        {row.map((value) => (
                          <Combobox.Item value={value}>{value}</Combobox.Item>
                        ))}
                      </Combobox.Row>
                    );
                    return props.groups ? (
                      <Combobox.Group>{rowElement}</Combobox.Group>
                    ) : (
                      rowElement
                    );
                  })}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      );
    }

    it('sets grid roles when grid is enabled and rows are used', async () => {
      render(() => (
        <GridCombobox
          rows={[
            ['1', '2', '3'],
            ['4', '5', '6'],
          ]}
        />
      ));
      await flushMicrotasks();

      const grid = screen.getByRole('grid');
      expect(grid).not.toBe(null);
      const cells = screen.getAllByRole('gridcell');
      expect(cells).toHaveLength(6);
    });

    it('arrow keys navigate across rows and columns in grid mode', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = renderWithUser(() => (
        <GridCombobox
          onItemHighlighted={onItemHighlighted}
          rows={[
            ['1', '2', '3'],
            ['4', '5', '6'],
          ]}
        />
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('3'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('6'));

      await user.keyboard('{ArrowLeft}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('5'));

      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));
    });

    it('does not re-report the highlight on keys the grid does not handle', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = renderWithUser(() => (
        <GridCombobox
          onItemHighlighted={onItemHighlighted}
          rows={[
            ['1', '2'],
            ['3', '4'],
          ]}
        />
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));
      onItemHighlighted.mockClear();

      // A modifier alone is not navigation; the grid navigator returns the unchanged index.
      await user.keyboard('{Shift}');
      await flushMicrotasks();
      expect(onItemHighlighted).not.toHaveBeenCalled();

      // A horizontal move is handled by the main-orientation path, once.
      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));
      expect(onItemHighlighted).toHaveBeenCalledTimes(1);
    });

    // https://github.com/mui/base-ui/issues/4947
    it('moves the input caret on ArrowLeft when no item is highlighted in grid mode', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = renderWithUser(() => (
        <GridCombobox onItemHighlighted={onItemHighlighted} rows={[['1', '2']]} />
      ));

      const input = screen.getByTestId<HTMLInputElement>('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.type(input, 'abc');

      expect(input.value).toBe('abc');
      expect(input.selectionStart).toBe(3);

      await user.keyboard('{ArrowLeft}');

      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(2);
      expect(onItemHighlighted).not.toHaveBeenCalled();
    });

    // https://github.com/mui/base-ui/issues/4947
    it('moves the input caret on ArrowRight when no item is highlighted in grid mode', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = renderWithUser(() => (
        <GridCombobox onItemHighlighted={onItemHighlighted} rows={[['1', '2']]} />
      ));

      const input = screen.getByTestId<HTMLInputElement>('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.type(input, 'abc');
      input.setSelectionRange(1, 1);

      expect(input.selectionStart).toBe(1);

      await user.keyboard('{ArrowRight}');

      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(2);
      expect(onItemHighlighted).not.toHaveBeenCalled();
    });

    // https://github.com/mui/base-ui/issues/4947
    it('keeps grid navigation when autoHighlight surfaces an item before typing arrow keys', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = renderWithUser(() => (
        <GridCombobox autoHighlight onItemHighlighted={onItemHighlighted} rows={[['1', '2']]} />
      ));

      const input = screen.getByTestId<HTMLInputElement>('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.type(input, 'a');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));
    });

    it('mirrors horizontal grid navigation in RTL mode', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = renderWithUser(() => (
        <DirectionProvider direction="rtl">
          <GridCombobox
            onItemHighlighted={onItemHighlighted}
            rows={[
              ['1', '2', '3'],
              ['4', '5', '6'],
            ]}
          />
        </DirectionProvider>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));

      await user.keyboard('{ArrowLeft}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      await user.keyboard('{ArrowLeft}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('3'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));
    });

    it('supports uneven rows navigation', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = renderWithUser(() => (
        <GridCombobox
          onItemHighlighted={onItemHighlighted}
          rows={[
            ['1', '2', '3'],
            ['4', '5'],
            ['6', '7', '8', '9', '10'],
          ]}
        />
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('3'));

      // Down from last col (3) to shorter row should clamp to last item (5)
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('5'));

      // Up from clamped item (5) should return to same column in previous row (2)
      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      // From 2, move down to 5 (same column), then down to 7 in the longer row
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('5'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('7'));

      // Left within last row goes to 6, up to first col in previous row (4)
      await user.keyboard('{ArrowLeft}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('6'));

      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('4'));
    });

    it('supports uneven rows navigation within groups', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = renderWithUser(() => (
        <GridCombobox
          groups
          onItemHighlighted={onItemHighlighted}
          rows={[
            ['1', '2', '3'],
            ['4', '5'],
            ['6', '7', '8', '9', '10'],
          ]}
        />
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('3'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('5'));

      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('5'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('7'));
    });

    it('does not render aria-orientation on the grid role', async () => {
      render(() => <GridCombobox rows={[['1', '2']]} />);
      await flushMicrotasks();

      // The grid role does not support aria-orientation (axe: aria-allowed-attr).
      const grid = screen.getByRole('grid');
      expect(grid).not.toHaveAttribute('aria-orientation');
    });

    it('renders groups with the rowgroup role', async () => {
      render(() => (
        <Combobox.Root grid defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Group>
                    <Combobox.GroupLabel>Fruits</Combobox.GroupLabel>
                    <Combobox.Row>
                      <Combobox.Item value="1">1</Combobox.Item>
                      <Combobox.Item value="2">2</Combobox.Item>
                    </Combobox.Row>
                  </Combobox.Group>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));
      await flushMicrotasks();

      // `grid` may only own `row`/`rowgroup` elements (axe: aria-required-children),
      // and `row` must be owned by `grid`, `rowgroup`, or `treegrid` (axe: aria-required-parent).
      expect(screen.queryByRole('group')).toBeNull();
      expect(screen.getByRole('rowgroup')).toHaveAccessibleName('Fruits');
    });
  });
  describe('prop: multiple', () => {
    it('"single" selects and closes, then reopens with selection focused', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root defaultOpen>
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
      await user.click(screen.getByRole('option', { name: 'b' }));
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(input).toHaveValue('b');

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await waitFor(() =>
        expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('aria-selected', 'true'),
      );
    });

    it('"single" keeps the popup open when selection is canceled', async () => {
      const onValueChange = vi.fn((_value: any, details: Combobox.Root.ChangeEventDetails) => {
        details.cancel();
      });
      const { user } = renderWithUser(() => (
        <Combobox.Root defaultOpen onValueChange={onValueChange}>
          <Combobox.Input data-testid="input" />
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

      const input = screen.getByTestId('input');
      await user.click(screen.getByRole('option', { name: 'b' }));
      await flushMicrotasks();

      // The change was canceled, so the value never committed and the popup stays open.
      expect(onValueChange).toHaveBeenCalled();
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(input).not.toHaveValue('b');
    });

    it('"multiple" clears uncontrolled input after select when filtering', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root multiple>
          <Combobox.Input data-testid="input" />
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

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await flushMicrotasks();
      await user.click(screen.getByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      // After selecting while filtering, uncontrolled input clears
      expect(input).toHaveValue('');
    });

    it('keeps the active item when the post-selection input clear is canceled', async ({
      onTestFinished,
    }) => {
      const items = ['apple', 'apricot', 'banana'];
      const onInputValueChange = vi.fn(
        (_value: string, details: Combobox.Root.ChangeEventDetails) => {
          if (details.reason === REASONS.inputClear) {
            details.cancel();
          }
        },
      );

      const { user } = renderWithUser(() => (
        <Combobox.Root multiple defaultOpen items={items} onInputValueChange={onInputValueChange}>
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

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      const apple = await screen.findByRole('option', { name: 'apple' });
      fireEvent.mouseMove(apple, { pointerType: 'mouse' });
      await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));

      const ariaMutations: MutationRecord[] = [];
      const observer = new MutationObserver((records) => ariaMutations.push(...records));
      observer.observe(input, {
        attributes: true,
        attributeFilter: ['aria-activedescendant'],
      });
      onTestFinished(() => observer.disconnect());

      fireEvent.click(apple);
      await flushMicrotasks();

      expect(onInputValueChange.mock.lastCall?.[1].reason).toBe(REASONS.inputClear);
      expect(input).toHaveValue('app');
      expect(apple).toHaveAttribute('data-highlighted');
      expect(input).toHaveAttribute('aria-activedescendant', apple.id);
      expect(ariaMutations).toHaveLength(0);
    });

    it('keeps the filter text when the "item-press" close is canceled (input outside popup)', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root
          multiple
          onOpenChange={(open, eventDetails) => {
            if (!open && eventDetails.reason === REASONS.itemPress) {
              eventDetails.cancel();
            }
          }}
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(input).toHaveValue('app');
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(screen.getByRole('option', { name: 'apple' })).toHaveAttribute(
        'aria-selected',
        'true',
      );

      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(input).toHaveValue('');
    });

    it('marks the close-path clear as an item press only when an item press closed the popup (input outside popup)', async () => {
      const onInputValueChange = vi.fn();

      const { user } = renderWithUser(() => (
        <Combobox.Root multiple onInputValueChange={onInputValueChange}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      onInputValueChange.mockClear();

      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(input).toHaveValue('');
      expect(onInputValueChange.mock.calls.find((call) => call[0] === '')?.[1].isItemPress).toBe(
        true,
      );

      await user.type(input, 'app');
      onInputValueChange.mockClear();

      // Closing with the keyboard clears the same way, but no item was pressed.
      await user.keyboard('{Escape}');
      await flushMicrotasks();

      expect(input).toHaveValue('');
      expect(onInputValueChange.mock.calls.find((call) => call[0] === '')?.[1].isItemPress).toBe(
        false,
      );
    });

    it('keeps the filter text when the selection clear is canceled (input inside popup)', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root
          multiple
          defaultOpen
          onInputValueChange={(_value, eventDetails) => {
            if (eventDetails.isItemPress) {
              eventDetails.cancel();
            }
          }}
        >
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(input).toHaveValue('app');
      expect(screen.queryByRole('listbox')).not.toBe(null);
    });

    it('keeps the filter text in an inline list when the selection clear is canceled', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root
          multiple
          inline
          open
          onInputValueChange={(_value, eventDetails) => {
            if (eventDetails.isItemPress) {
              eventDetails.cancel();
            }
          }}
        >
          <Combobox.Input data-testid="input" />
          <Combobox.List>
            <Combobox.Item value="apple">apple</Combobox.Item>
            <Combobox.Item value="apricot">apricot</Combobox.Item>
            <Combobox.Item value="banana">banana</Combobox.Item>
          </Combobox.List>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(input).toHaveValue('app');
      expect(screen.getByRole('option', { name: 'apple' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('still clears the kept filter text once the popup closes', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root
          multiple
          onInputValueChange={(_value, eventDetails) => {
            if (eventDetails.isItemPress) {
              eventDetails.cancel();
            }
          }}
        >
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      const input = await screen.findByTestId('input');
      await waitFor(() => expect(input).toHaveFocus());

      await user.type(input, 'app');
      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(input).toHaveValue('app');

      // The cleanup clear that runs after the popup closes doesn't carry `isItemPress`, so the
      // recipe doesn't cancel it and the next open starts with a fresh filter.
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));

      await user.click(trigger);

      expect(await screen.findByTestId('input')).toHaveValue('');
    });

    it('clears the input with the "input-clear" reason and the item click event on pointer selection', async () => {
      const onInputValueChange = vi.fn();

      const { user } = renderWithUser(() => (
        <Combobox.Root multiple defaultOpen onInputValueChange={onInputValueChange}>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await user.type(screen.getByTestId('input'), 'app');
      onInputValueChange.mockClear();

      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(onInputValueChange).toHaveBeenCalledWith(
        '',
        expect.objectContaining({ reason: REASONS.inputClear }),
      );
      expect(onInputValueChange.mock.lastCall?.[1].event?.type).toBe('click');
      expect(onInputValueChange.mock.lastCall?.[1].isItemPress).toBe(true);
    });

    it('clears the input with the "input-clear" reason and the originating keydown event on keyboard selection', async () => {
      const onInputValueChange = vi.fn();

      const { user } = renderWithUser(() => (
        <Combobox.Root multiple defaultOpen onInputValueChange={onInputValueChange}>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await screen.findByRole('option', { name: 'apple' });

      await user.keyboard('{ArrowDown}');
      await waitFor(() =>
        expect(screen.getByRole('option', { name: 'apple' })).toHaveAttribute('data-highlighted'),
      );

      onInputValueChange.mockClear();
      await user.keyboard('{Enter}');
      await flushMicrotasks();

      expect(onInputValueChange).toHaveBeenCalledWith(
        '',
        expect.objectContaining({ reason: REASONS.inputClear }),
      );
      // Keyboard activation synthesizes a click on the highlighted item, but the details carry the
      // originating keydown so consumers see the real user gesture.
      expect(onInputValueChange.mock.lastCall?.[1].event?.type).toBe('keydown');
      expect(onInputValueChange.mock.lastCall?.[1].isItemPress).toBe(true);
    });

    it('keeps the filter text when a drag-select release commits the selection', async () => {
      const onInputValueChange = vi.fn(
        (_value: string, eventDetails: Combobox.Root.ChangeEventDetails) => {
          if (eventDetails.isItemPress) {
            eventDetails.cancel();
          }
        },
      );

      const { user } = renderWithUser(() => (
        <Combobox.Root multiple defaultOpen onInputValueChange={onInputValueChange}>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      const apple = await screen.findByRole('option', { name: 'apple' });
      fireEvent.mouseMove(apple, { pointerType: 'mouse' });
      await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));

      // Press starts outside the item (drag-select), so the commit happens on mouseup.
      fireEvent.mouseUp(apple, { button: 0 });
      await flushMicrotasks();

      expect(input).toHaveValue('app');
      expect(apple).toHaveAttribute('aria-selected', 'true');
      expect(onInputValueChange.mock.lastCall?.[1].isItemPress).toBe(true);
    });

    // jsdom doesn't run CSS animations, so there is no close animation to interrupt (upstream
    // skips it in jsdom too).
    it.skip('clears the pending filter with the "input-clear" reason when reopening interrupts the close animation', () => {});

    // jsdom doesn't run CSS animations (upstream skips it in jsdom too).
    it.skip('releases the frozen query when reopening during the close animation with the input outside the popup', () => {});

    it('does not close popup when filtering with input inside popup in multiple mode', async () => {
      const items = ['apple', 'apricot', 'banana'];
      const { user } = renderWithUser(() => (
        <Combobox.Root multiple items={items}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value />
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
      await user.click(trigger);

      const input = await screen.findByTestId('input');
      await user.type(input, 'app');
      await user.click(screen.getByRole('option', { name: 'apple' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });
      await waitFor(() => expect(input).toHaveValue(''));
    });

    it('keeps the popup input focused through keyboard selection and restores the last selection', async () => {
      const items = ['apple', 'apricot', 'banana'];
      const { user } = renderWithUser(() => (
        <Combobox.Root multiple items={items}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value />
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
      await user.click(trigger);

      const input = await screen.findByTestId('input');
      await user.type(input, 'ban');
      await user.keyboard('{ArrowDown}{Enter}');
      await flushMicrotasks();

      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(input).toHaveFocus();
      expect(input).toHaveValue('');
      expect(trigger).toHaveTextContent('banana');
      expect(screen.getByRole('option', { name: 'banana' })).toHaveAttribute(
        'aria-selected',
        'true',
      );

      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
      expect(trigger).toHaveFocus();

      await user.click(trigger);

      const selectedOption = await screen.findByRole('option', { name: 'banana' });
      expect(screen.getByTestId('input')).toHaveValue('');
      expect(selectedOption).toHaveAttribute('aria-selected', 'true');
      await waitFor(() => expect(selectedOption).toHaveAttribute('data-highlighted'));
    });

    // jsdom doesn't run CSS animations (upstream skips these in jsdom too).
    it.skip('keeps filtered popup content stable while closing with input inside popup', () => {});
    it.skip('keeps filtered popup content stable when input changes during the close animation', () => {});
    it.skip('clears the deferred popup input when reopening during close animation', () => {});
    it.skip('does not emit another clear when controlled input is already empty on interrupted close', () => {});

    it('"multiple" clears typed input on close when no selection made', async () => {
      const onInput = vi.fn();
      const { user } = renderWithUser(() => (
        <Combobox.Root multiple defaultOpen onInputValueChange={onInput}>
          <Combobox.Input data-testid="input" />
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

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await flushMicrotasks();

      // Close without selecting
      await user.keyboard('{Escape}');
      await flushMicrotasks();

      expect(screen.queryByRole('listbox')).toBe(null);
      expect(input).toHaveValue('');
      expect(onInput.mock.lastCall?.[0]).toBe('');
      expect(onInput.mock.lastCall?.[1].reason).toBe(REASONS.inputClear);
    });

    it('does not clear popup input after canceled multiple value changes', async () => {
      const onInputValueChange = vi.fn();
      const onValueChange = vi.fn((_value: any, details: Combobox.Root.ChangeEventDetails) => {
        details.cancel();
      });

      const { user } = renderWithUser(() => (
        <Combobox.Root
          multiple
          onInputValueChange={onInputValueChange}
          onValueChange={onValueChange}
        >
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await user.click(screen.getByText('Open'));

      const input = await screen.findByTestId('input');
      // Wait for the popup to finish opening so the input is interactive (the positioner is
      // `inert` until then).
      await screen.findByRole('option', { name: 'apple' });
      await user.type(input, 'app');
      onInputValueChange.mockClear();

      await user.click(screen.getByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalled();
      expect(input).toHaveValue('app');
      expect(onInputValueChange).not.toHaveBeenCalled();
    });

    it('"single" clears typed input on close when no selection made (input outside popup)', async () => {
      const onInput = vi.fn();
      const { user } = renderWithUser(() => (
        <Combobox.Root defaultOpen onInputValueChange={onInput}>
          <Combobox.Input data-testid="input" />
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

      const input = screen.getByTestId('input');
      await user.type(input, 'zz');
      await flushMicrotasks();

      // Close without selecting
      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      await flushMicrotasks();
      expect(input).toHaveValue('');
      expect(onInput.mock.lastCall?.[0]).toBe('');
      expect(onInput.mock.lastCall?.[1].reason).toBe(REASONS.inputClear);
    });
  });
});
