import { For, createSignal } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Combobox } from '..';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { flushMicrotasks } from '../test-utils';

describe('<Combobox.Item />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Combobox.Root>
        <Combobox.Item
          value="x"
          data-testid="item"
          ref={(el) => {
            ref = el;
          }}
          class={(state) => (state.selected ? 'selected' : 'item')}
          style={{ color: 'red' }}
          render={(props) => <section {...props} />}
        />
      </Combobox.Root>
    ));

    const item = screen.getByTestId('item');
    expect(ref).toBe(item);
    expect(item.tagName).toBe('SECTION');
    expect(item).toHaveClass('item');
    expect(item).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('selects item and closes in single mode', async () => {
    render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="one">one</Combobox.Item>
                <Combobox.Item value="two">two</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByTestId('input');
    fireEvent.click(screen.getByRole('option', { name: 'two' }));
    await flushMicrotasks();

    expect(input).toHaveValue('two');
    expect(screen.queryByRole('listbox')).toBe(null);
  });

  describe('prop: onClick', () => {
    it('calls onClick when clicked with a pointer', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(() => (
        <Combobox.Root items={['apple', 'banana']} openOnInputClick>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item value={item} onClick={handleClick}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
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
        <Combobox.Root items={['one', 'two']} openOnInputClick>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item value={item} onClick={handleClick}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(handleClick.mock.calls.length).toBe(1);
    });

    it('does not select the item when onClick prevents Base UI handler', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn((event: any) => event.preventBaseUIHandler());
      render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="one" onClick={handleClick}>
                    one
                  </Combobox.Item>
                  <Combobox.Item value="two">two</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const option = screen.getByRole('option', { name: 'one' });
      await user.click(option);
      await flushMicrotasks();

      const input = screen.getByTestId('input');
      expect(handleClick.mock.calls.length).toBe(1);
      expect(input).toHaveValue('');
      expect(screen.queryByRole('listbox')).not.toBe(null);
    });
  });

  it('does not select disabled item', async () => {
    render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="one">one</Combobox.Item>
                <Combobox.Item value="two" disabled>
                  two
                </Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByTestId('input');
    fireEvent.click(screen.getByRole('option', { name: 'two' }));
    await flushMicrotasks();

    expect(input).toHaveValue('');
  });

  it('inherits the disabled state from the root', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(() => (
      <Combobox.Root defaultOpen disabled>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="one" onClick={handleClick}>
                  one
                </Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const item = screen.getByRole('option', { name: 'one' });
    expect(item).toHaveAttribute('data-disabled');

    await user.click(item);
    await flushMicrotasks();

    expect(handleClick).not.toHaveBeenCalled();
    expect(screen.getByTestId('input')).toHaveValue('');
  });

  it('Enter selects highlighted item', async () => {
    const user = userEvent.setup();
    render(() => (
      <Combobox.Root>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="one">one</Combobox.Item>
                <Combobox.Item value="two">two</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByTestId('input');
    await user.click(input);
    await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(input).toHaveValue('one'));
    expect(screen.queryByRole('listbox')).toBe(null);
  });

  // Needs real touch pointer input in a browser (upstream skips it in jsdom).
  it.skip('keeps the input focused after selecting an item with touch', () => {});

  it('prevents default on mousedown so pointer selection does not steal input focus', () => {
    render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="one">one</Combobox.Item>
                <Combobox.Item value="two">two</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const option = screen.getByRole('option', { name: 'two' });
    const mouseDown = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
    });

    option.dispatchEvent(mouseDown);

    expect(mouseDown.defaultPrevented).toBe(true);
  });

  it('multiple mode toggles selection and stays open', async () => {
    const user = userEvent.setup();
    render(() => (
      <Combobox.Root multiple>
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
    await user.click(input);
    await waitFor(() => {
      expect(screen.getByRole('listbox')).not.toBe(null);
    });

    const a = screen.getByRole('option', { name: 'a' });
    await user.click(a);
    expect(a).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('listbox')).not.toBe(null);

    await user.click(a);
    expect(a).not.toHaveAttribute('aria-selected', 'true');
  });

  it('reflects selected value with aria-selected when reopening', async () => {
    const user = userEvent.setup();
    render(() => (
      <Combobox.Root defaultValue="two">
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="one">one</Combobox.Item>
                <Combobox.Item value="two">two</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByTestId('input');
    await user.click(input);
    await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'two' })).toHaveAttribute('aria-selected', 'true'),
    );
  });

  describe('link handling', () => {
    it('clicking a link inside an item does not select or close (anchor with href)', async () => {
      const user = userEvent.setup();
      render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item
                    value="one"
                    render={(props) => <a href="/somewhere" {...props} />}
                    data-testid="link-one"
                  >
                    one
                  </Combobox.Item>
                  <Combobox.Item value="two">two</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      const link = screen.getByTestId('link-one');

      await user.click(link);

      await waitFor(() => expect(input.value).toBe(''));
      expect(screen.queryByRole('listbox')).not.toBe(null);
    });

    it('clicking a hash link inside an item does not select and closes popup (anchor with #hash)', async () => {
      const user = userEvent.setup();
      render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item
                    value="one"
                    render={(props) => <a href="#section" {...props} />}
                    data-testid="link-hash"
                  >
                    one
                  </Combobox.Item>
                  <Combobox.Item value="two">two</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      const link = screen.getByTestId('link-hash');

      await user.click(link);

      await waitFor(() => expect(input.value).toBe(''));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
    });

    it('clicking an anchor without href behaves like normal item (selects and closes)', async () => {
      const user = userEvent.setup();
      render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item
                    value="one"
                    render={(props) => <a {...props} />}
                    data-testid="anchor-no-href"
                  >
                    one
                  </Combobox.Item>
                  <Combobox.Item value="two">two</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.click(screen.getByTestId('anchor-no-href'));

      await waitFor(() => expect(input.value).toBe('one'));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
    });
  });

  // Virtualized items without an explicit `index` resolve their index from the filtered set.
  // Filtering must keep that index fresh, otherwise keyboard highlight/Enter selection targets
  // the wrong filtered item.
  describe('virtualized without explicit index', () => {
    function VirtualizedItems() {
      const items = Combobox.useFilteredItems<string>();
      return (
        <For each={items()}>{(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}</For>
      );
    }

    function VirtualizedCombobox() {
      return (
        <Combobox.Root virtualized items={['one', 'two', 'three', 'four', 'five']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <VirtualizedItems />
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      );
    }

    it('selects the highlighted filtered item with the keyboard after filtering', async () => {
      const user = userEvent.setup();
      render(() => <VirtualizedCombobox />);

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      // Narrows the list to items containing "f" ("four", "five"), which sat at full-list
      // indices 3 and 4. The first filtered item is now "four", not "one".
      await user.type(input, 'f');
      await waitFor(() => expect(screen.queryByRole('option', { name: 'one' })).toBe(null));
      expect(screen.getByRole('option', { name: 'four' })).not.toBe(null);

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      await waitFor(() => expect(input).toHaveValue('four'));
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('selects the clicked filtered item after filtering', async () => {
      const user = userEvent.setup();
      render(() => <VirtualizedCombobox />);

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await user.type(input, 'f');
      await waitFor(() => expect(screen.queryByRole('option', { name: 'one' })).toBe(null));

      await user.click(screen.getByRole('option', { name: 'five' }));

      await waitFor(() => expect(input).toHaveValue('five'));
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('registers a rendered window at its filtered indexes', async () => {
      const user = userEvent.setup();

      function ListRefProbe() {
        const store = useComboboxRootContext();
        const [snapshot, setSnapshot] = createSignal('');

        return (
          <button
            type="button"
            data-testid="refresh-list-ref"
            onClick={() => {
              const list = store.context.listRef.current;
              setSnapshot(
                Array.from(
                  { length: list.length },
                  (_, index) => list[index]?.textContent ?? '',
                ).join('|'),
              );
            }}
          >
            {snapshot()}
          </button>
        );
      }

      function WindowedItems() {
        const items = Combobox.useFilteredItems<string>();
        return (
          <For each={items().slice(2, 4)}>
            {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
          </For>
        );
      }

      render(() => (
        <Combobox.Root virtualized items={['one', 'two', 'three', 'four', 'five']}>
          <Combobox.Input data-testid="input" />
          <ListRefProbe />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <WindowedItems />
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await user.click(screen.getByTestId('input'));
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await flushMicrotasks();
      fireEvent.click(screen.getByTestId('refresh-list-ref'));
      await flushMicrotasks();

      expect(screen.getByTestId('refresh-list-ref')).toHaveTextContent('||three|four|');
    });

    it('does not register an item missing from the filtered values', async () => {
      const user = userEvent.setup();
      render(() => (
        <Combobox.Root virtualized items={['one']} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item>missing value</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      const item = screen.getByRole('option', { name: 'missing value' });

      await user.hover(item);

      expect(input).not.toHaveAttribute('aria-activedescendant');
      expect(item).not.toHaveAttribute('data-highlighted');
      expect(item).not.toHaveAttribute('id');
    });
  });

  describe('virtualized with explicit index', () => {
    function VirtualizedItems() {
      const items = Combobox.useFilteredItems<string>();
      return (
        <For each={items()}>
          {(item, index) => (
            <Combobox.Item value={item} index={index()}>
              {item}
            </Combobox.Item>
          )}
        </For>
      );
    }

    it('selects the highlighted filtered item with the keyboard after filtering', async () => {
      const user = userEvent.setup();
      render(() => (
        <Combobox.Root virtualized items={['one', 'two', 'three']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <VirtualizedItems />
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await user.type(input, 't');
      await waitFor(() => expect(screen.queryByRole('option', { name: 'one' })).toBe(null));

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      await waitFor(() => expect(input).toHaveValue('two'));
      expect(screen.queryByRole('listbox')).toBe(null);
    });
  });

  // Upstream guards against React re-renders of still-mounted items on each keystroke. Solid has
  // no re-renders; the equivalent guarantee is that the items (and their `render` functions) are
  // not recreated when the filtered membership is unchanged.
  describe('item re-renders on keystroke', () => {
    it('does not recreate still-mounted items when filtering keeps the same membership', async () => {
      const items = ['apple', 'apricot', 'avocado'];
      const renderSpy = vi.fn();

      render(() => (
        <Combobox.Root items={items} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item
                      value={item}
                      render={(props) => {
                        renderSpy();
                        return <div {...props} />;
                      }}
                    >
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      expect(screen.getAllByRole('option')).toHaveLength(3);
      const before = screen.getAllByRole('option');

      renderSpy.mockClear();

      // "a" matches all three items, so the filtered set is unchanged and every item stays mounted.
      fireEvent.input(screen.getByTestId('input'), { target: { value: 'a' } });
      await flushMicrotasks();

      await waitFor(() => expect(screen.getByTestId('input')).toHaveValue('a'));
      expect(screen.getAllByRole('option')).toHaveLength(3);
      expect(screen.getAllByRole('option')).toEqual(before);

      expect(renderSpy).not.toHaveBeenCalled();
    });
  });

  describe('prop: index', () => {
    // Regression test for https://github.com/mui/base-ui/issues/4657 — explicitly
    // indexed items in a non-virtualized list previously skipped CompositeList
    // registration, so hover could not resolve the item in `listRef`.
    it('updates the highlight on hover in a non-virtualized list', async () => {
      const user = userEvent.setup();
      const items = ['apple', 'banana', 'cherry'];
      render(() => (
        <Combobox.Root items={items} defaultOpen autoHighlight>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {items.map((item, index) => (
                    <Combobox.Item value={item} index={index}>
                      {item}
                    </Combobox.Item>
                  ))}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      const banana = screen.getByRole('option', { name: 'banana' });
      await user.hover(banana);
      await waitFor(() => {
        expect(banana).toHaveAttribute('data-highlighted');
      });

      const cherry = screen.getByRole('option', { name: 'cherry' });
      await user.hover(cherry);
      await waitFor(() => {
        expect(cherry).toHaveAttribute('data-highlighted');
      });
      expect(banana).not.toHaveAttribute('data-highlighted');
    });

    it('does not assign an id to an explicitly unregistered item', () => {
      render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.List>
            <Combobox.Item value="orphan" index={-1}>
              orphan
            </Combobox.Item>
          </Combobox.List>
        </Combobox.Root>
      ));

      expect(screen.getByRole('option', { name: 'orphan' })).not.toHaveAttribute('id');
    });
  });
});
