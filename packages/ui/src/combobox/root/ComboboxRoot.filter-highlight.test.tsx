import { For, createMemo, createSignal, flush, omit, onSettled } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Combobox } from '..';
import { REASONS } from '../../internals/reasons';
import { act, flushMicrotasks, renderWithProps } from '../test-utils';
import { useComboboxRootContext } from './ComboboxRootContext';

describe('<Combobox.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  describe('prop: filter', () => {
    it('uses custom filter to narrow results', async () => {
      const user = userEvent.setup();
      const items = ['alpha', 'beta', 'alphabet', 'alpine'];
      const startsWith = (item: string, q: string) => item.toLowerCase().startsWith(q);

      render(() => (
        <Combobox.Root items={items} filter={(item, q) => startsWith(String(item), q)}>
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
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'alp');
      await flushMicrotasks();

      // Only beta should be filtered out
      expect(screen.queryByText('beta')).toBe(null);
      expect(screen.queryByText('alpha')).not.toBe(null);
      expect(screen.queryByText('alphabet')).not.toBe(null);
      expect(screen.queryByText('alpine')).not.toBe(null);
    });

    it('resets filtered results after selecting when using a custom search stringifier', async () => {
      const user = userEvent.setup();
      type Movie = { id: number; english: string; romaji: string };
      const movies: Movie[] = [
        { id: 1, english: 'Spirited Away', romaji: 'Sen to Chihiro no Kamikakushi' },
        { id: 2, english: 'My Neighbor Totoro', romaji: 'Tonari no Totoro' },
        { id: 3, english: 'Princess Mononoke', romaji: 'Mononoke Hime' },
      ];

      const stringifyMovie = (movie: Movie | null) =>
        movie ? `${movie.english} ${movie.romaji}` : '';

      function MultilingualFilterCombobox() {
        const [value, setValue] = createSignal<Movie | null>(null);
        const { contains } = Combobox.useFilter({
          get value() {
            return value();
          },
        });

        const filter = (item: Movie | null, query: string) => {
          if (!item) {
            return false;
          }
          return contains(item, query, stringifyMovie);
        };

        return (
          <Combobox.Root
            items={movies}
            value={value()}
            onValueChange={setValue}
            filter={filter}
            itemToStringLabel={(movie: Movie) => movie?.english ?? ''}
          >
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(movie: Movie) => <Combobox.Item value={movie}>{movie.english}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      render(() => <MultilingualFilterCombobox />);
      const input = screen.getByRole('combobox');

      await user.click(input);
      await screen.findByRole('listbox');

      await user.type(input, 'tonari');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Spirited Away' })).toBe(null);
      });

      await user.click(screen.getByRole('option', { name: 'My Neighbor Totoro' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await user.click(input);
      await screen.findByRole('listbox');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Spirited Away' })).not.toBe(null);
      });
    });
  });

  describe('prop: filteredItems', () => {
    it('resets external filteredItems when reopening after a selection', async () => {
      const user = userEvent.setup();
      interface TestItem {
        id: number;
        label: string;
        label2: string;
      }

      const testItems: TestItem[] = [
        { id: 1, label: 'apple', label2: 'one' },
        { id: 2, label: 'orange', label2: 'two' },
        { id: 3, label: 'banana', label2: 'three' },
      ];

      function getItemLabelToFilter(item: TestItem | null) {
        return item ? `${item.label} ${item.label2}` : '';
      }

      function getItemLabelToDisplay(item: TestItem | null) {
        return item ? item.label || item.label2 : '';
      }

      function FilteredItemsCombobox() {
        const [searchValue, setSearchValue] = createSignal('');
        const [value, setValue] = createSignal<TestItem | null>(null);

        const { contains } = Combobox.useFilter({
          get value() {
            return value();
          },
        });

        const filteredItems = createMemo(() =>
          testItems.filter((item) => contains(item, searchValue(), getItemLabelToFilter)),
        );

        return (
          <Combobox.Root
            items={testItems}
            filteredItems={filteredItems()}
            inputValue={searchValue()}
            onInputValueChange={setSearchValue}
            value={value()}
            onValueChange={setValue}
            itemToStringLabel={getItemLabelToDisplay}
            isItemEqualToValue={(item: TestItem, v: TestItem) => item?.id === v?.id}
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner sideOffset={4}>
                <Combobox.Popup>
                  <Combobox.Empty>No items found.</Combobox.Empty>
                  <Combobox.List>
                    {(item: TestItem) => (
                      <Combobox.Item value={item}>
                        <Combobox.ItemIndicator />
                        {item.label}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      render(() => <FilteredItemsCombobox />);
      const input = screen.getByRole('combobox');

      await user.click(input);
      await user.type(input, 'one');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'orange' })).toBe(null);
      });

      await user.click(screen.getByRole('option', { name: 'apple' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await user.click(input);

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'orange' })).not.toBe(null);
      });
    });

    it('uses filteredItems when items prop is omitted', async () => {
      const user = userEvent.setup();
      const fruits = ['Apple', 'Banana', 'Cherry'];

      function FilteredItemsOnlyCombobox() {
        const [value, setValue] = createSignal<string | null>(null);

        return (
          <Combobox.Root filteredItems={fruits} value={value()} onValueChange={setValue}>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner sideOffset={4}>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      render(() => <FilteredItemsOnlyCombobox />);
      const input = screen.getByTestId('input');

      await user.click(input);
      await screen.findByRole('listbox');
      await user.click(screen.getByRole('option', { name: 'Apple' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await user.click(input);
      await screen.findByRole('listbox');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Banana' })).not.toBe(null);
      });
    });

    it('highlights the externally filtered item order when filtering reorders items', async () => {
      const user = userEvent.setup();
      const fruits = ['Apple', 'Banana', 'Zucchini'];
      const onItemHighlighted = vi.fn();

      function ReorderingFilteredItemsCombobox() {
        const [input, setInput] = createSignal('');
        const filteredItems = createMemo(() =>
          input().length > 0 ? [...fruits].reverse() : fruits,
        );

        return (
          <Combobox.Root
            autoHighlight
            filteredItems={filteredItems()}
            inputValue={input()}
            onInputValueChange={setInput}
            onItemHighlighted={onItemHighlighted}
          >
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner sideOffset={4}>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      render(() => <ReorderingFilteredItemsCombobox />);
      const input = screen.getByTestId('input');

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      onItemHighlighted.mockClear();

      await user.type(input, 'a');

      await waitFor(() => {
        expect(onItemHighlighted.mock.calls.length).toBeGreaterThan(0);
      });

      const [highlightedValue] = onItemHighlighted.mock.lastCall ?? [];
      expect(highlightedValue).toBe('Zucchini');
    });

    it('opens a reordered external list at the selected value in rendered-list coordinates', async () => {
      const user = userEvent.setup();
      const fruits = ['Apple', 'Banana', 'Cherry'];
      const onItemHighlighted = vi.fn();

      render(() => (
        <Combobox.Root
          items={fruits}
          filteredItems={['Cherry', 'Apple']}
          multiple
          defaultValue={['Apple']}
          onItemHighlighted={onItemHighlighted}
        >
          <Combobox.Input />
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
      ));

      await user.click(screen.getByRole('combobox'));

      const apple = await screen.findByRole('option', { name: 'Apple' });
      const cherry = screen.getByRole('option', { name: 'Cherry' });
      await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));
      expect(cherry).not.toHaveAttribute('data-highlighted');
      expect(onItemHighlighted.mock.lastCall?.[0]).toBe('Apple');
    });

    it('resets an initially empty external result when opening a grouped selection', async () => {
      const user = userEvent.setup();
      const groups = [
        { value: 'Fruits', items: ['Apple', 'Banana'] },
        { value: 'Vegetables', items: ['Carrot'] },
      ];

      render(() => (
        <Combobox.Root items={groups} filteredItems={[]} defaultValue="Banana">
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(group: (typeof groups)[number]) => (
                    <Combobox.Group items={group.items}>
                      <Combobox.GroupLabel>{group.value}</Combobox.GroupLabel>
                      <Combobox.Collection>
                        {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                      </Combobox.Collection>
                    </Combobox.Group>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      expect(screen.getByTestId('input')).toHaveValue('Banana');

      await user.click(screen.getByTestId('input'));

      expect(await screen.findAllByRole('option')).toHaveLength(3);
      expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    // Async search keeps showing the previous results while the user types.
    it('does not re-render the list while typing when the external result is unchanged', async () => {
      const user = userEvent.setup();
      const items = ['apple', 'banana', 'cherry'];
      const renderItem = vi.fn((item: string) => (
        <Combobox.Item value={item}>{item}</Combobox.Item>
      ));

      render(() => (
        <Combobox.Root items={items} filteredItems={items} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>{renderItem}</Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      expect(renderItem).toHaveBeenCalled();
      renderItem.mockClear();

      const input = screen.getByTestId('input');
      await user.type(input, 'b');
      await waitFor(() => expect(input).toHaveValue('b'));

      expect(screen.getAllByRole('option')).toHaveLength(3);
      expect(renderItem).not.toHaveBeenCalled();
    });
  });

  describe('prop: openOnInputClick', () => {
    it('keeps the popup open on a second input click by default', async () => {
      const user = userEvent.setup();
      render(() => (
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
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
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      // Click input again should not toggle closed automatically
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
    });

    it('does not open on input click when false, but opens on typing', async () => {
      const user = userEvent.setup();
      render(() => (
        <Combobox.Root openOnInputClick={false}>
          <Combobox.Input data-testid="input" />
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
      await user.click(input);
      expect(screen.queryByRole('listbox')).toBe(null);

      await user.type(input, 'a');
      expect(screen.queryByRole('listbox')).not.toBe(null);
    });
  });

  describe('scroll reset on input value change', () => {
    // jsdom has no layout: scroll positions and overflow detection don't work.
    it.skip('resets the list scroll position to the top when the query changes', () => {});
    // jsdom has no layout: scroll positions and overflow detection don't work.
    it.skip('resets manually filtered children without deferring the reset until hover', () => {});
    // jsdom has no layout: scroll positions and overflow detection don't work.
    it.skip('resets the scroll position of a scrollable wrapper around the list', () => {});
    // jsdom has no layout: scroll positions and overflow detection don't work.
    it.skip('skips clipping ancestors when finding the scroll container', () => {});
    // jsdom has no layout: scroll positions and overflow detection don't work.
    it.skip('keeps the auto-highlighted first item in view after the query changes', () => {});
    // jsdom has no layout: scroll positions and overflow detection don't work.
    it.skip('resets the scroll container when filtering reorders retained items', () => {});
    // jsdom has no layout: scroll positions and overflow detection don't work.
    it.skip('resets only the nearest scrollable wrapper when composed in a scrollable dialog', () => {});
    // jsdom has no layout: scroll positions and overflow detection don't work.
    it.skip('does not reset a surrounding dialog', () => {});
  });

  describe('prop: autoHighlight', () => {
    it('keeps the first highlight when typing opens a kept-mounted list', async () => {
      const user = userEvent.setup();
      render(() => (
        <Combobox.Root items={['apple', 'apricot', 'banana']} autoHighlight>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal keepMounted>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await act(async () => {
        input.focus();
      });
      await user.keyboard('a');

      const apple = await screen.findByRole('option', { name: 'apple' });
      // The highlight must survive the list opening.
      await act(async () => {
        await new Promise((resolve) => {
          requestAnimationFrame(resolve);
        });
      });
      expect(apple).toHaveAttribute('data-highlighted');
    });

    describe('asynchronous items', () => {
      type AsyncComboboxProps = Omit<Combobox.Root.Props<string>, 'items'> & {
        items?: string[];
        dataProp?: 'items' | 'filteredItems';
      };

      function AsyncCombobox(props: AsyncComboboxProps) {
        const other = omit(props, 'items', 'dataProp', 'autoHighlight', 'filter');
        return (
          <Combobox.Root
            items={props.dataProp === 'filteredItems' ? undefined : (props.items ?? [])}
            filteredItems={props.dataProp === 'filteredItems' ? (props.items ?? []) : undefined}
            autoHighlight={props.autoHighlight ?? true}
            filter={null}
            {...other}
          >
            <Combobox.Input />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Empty>No matches</Combobox.Empty>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      /** Renders `AsyncCombobox` with signal-backed props (upstream's `setProps`). */
      function renderAsync(initialProps: AsyncComboboxProps) {
        const user = userEvent.setup();
        const [state, setState] = createSignal<AsyncComboboxProps>(initialProps);
        render(() => (
          <AsyncCombobox
            items={state().items}
            dataProp={state().dataProp}
            open={state().open}
            autoHighlight={state().autoHighlight}
            onOpenChange={state().onOpenChange}
            onItemHighlighted={state().onItemHighlighted}
            onValueChange={state().onValueChange}
          />
        ));
        return {
          user,
          async setProps(next: Partial<AsyncComboboxProps>) {
            setState((previous) => ({ ...previous, ...next }));
            flush();
            await flushMicrotasks();
          },
        };
      }

      it.each(['items', 'filteredItems'] as const)(
        'highlights a candidate arriving after typing with %s',
        async (dataProp) => {
          const onItemHighlighted = vi.fn();
          const onValueChange = vi.fn();
          const { user, setProps } = renderAsync({ dataProp, onItemHighlighted, onValueChange });
          const input = screen.getByRole('combobox');
          await user.type(input, '32');
          onItemHighlighted.mockClear();
          await setProps({ items: ['32', '320'] });

          const option = screen.getByRole('option', { name: '32' });
          await waitFor(() => expect(option).toHaveAttribute('data-highlighted'));
          expect(input).toHaveAttribute('aria-activedescendant', option.id);
          expect(onItemHighlighted).toHaveBeenCalledExactlyOnceWith(
            '32',
            expect.objectContaining({ index: 0, reason: 'none' }),
          );

          await user.keyboard('{Enter}');
          expect(onValueChange).toHaveBeenCalledExactlyOnceWith('32', expect.anything());
        },
      );

      it('waits for a controlled popup to open', async () => {
        const { user, setProps } = renderAsync({ items: ['32'], open: false });
        await user.type(screen.getByRole('combobox'), '32');
        await setProps({ open: true });
        await waitFor(() => expect(screen.getByRole('option')).toHaveAttribute('data-highlighted'));
      });

      it('discards the request when a rejected typed open is followed by a controlled open', async () => {
        const { user, setProps } = renderAsync({
          items: ['32'],
          open: false,
          onOpenChange: (nextOpen, details) => {
            if (nextOpen && details.reason === 'input-change') {
              details.cancel();
            }
          },
        });
        await user.type(screen.getByRole('combobox'), '32');
        await setProps({ open: true });
        await flushMicrotasks();
        expect(screen.getByRole('option')).not.toHaveAttribute('data-highlighted');
      });

      it('keeps a hovered item highlighted when individually rendered items arrive', async () => {
        function ChildrenCombobox(props: { results: string[] }) {
          return (
            <Combobox.Root autoHighlight>
              <Combobox.Input />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <For each={props.results}>
                        {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                      </For>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        const { user, setProps } = renderWithProps<{ results: string[] }>(
          (props) => <ChildrenCombobox results={props.results} />,
          { results: [] },
        );
        await user.type(screen.getByRole('combobox'), 'a');
        await setProps({ results: ['a1', 'a2', 'a3'] });

        const option = screen.getByRole('option', { name: 'a3' });
        await user.hover(option);
        await waitFor(() => expect(option).toHaveAttribute('data-highlighted'));
        await flushMicrotasks();
        expect(option).toHaveAttribute('data-highlighted');
      });

      it('highlights the first result when typing filters out individually rendered items', async () => {
        const user = userEvent.setup();
        function FilteredCombobox() {
          const [query, setQuery] = createSignal('');
          const fruits = () =>
            ['apple', 'banana', 'blackberry', 'blueberry'].filter((fruit) =>
              fruit.includes(query()),
            );
          return (
            <Combobox.Root autoHighlight onInputValueChange={setQuery}>
              <Combobox.Input />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <For each={fruits()}>
                        {(fruit) => <Combobox.Item value={fruit}>{fruit}</Combobox.Item>}
                      </For>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        render(() => <FilteredCombobox />);
        const input = screen.getByRole('combobox');
        await user.type(input, 'b');
        await user.keyboard('{ArrowDown}');
        await waitFor(() =>
          expect(screen.getByRole('option', { name: 'blackberry' })).toHaveAttribute(
            'data-highlighted',
          ),
        );

        await user.type(input, 'l');
        const option = screen.getByRole('option', { name: 'blackberry' });
        await waitFor(() => expect(option).toHaveAttribute('data-highlighted'));
        expect(input).toHaveAttribute('aria-activedescendant', option.id);
      });

      it('discards the request when an ignored typed open is followed by another open', async () => {
        const onOpenChange = vi.fn();
        const { user, setProps } = renderAsync({ items: ['32'], open: false, onOpenChange });
        await user.type(screen.getByRole('combobox'), '32');
        await user.click(screen.getByTestId('trigger'));
        // A trigger press opens on the frame after `mousedown`, which `user.click` can beat.
        await waitFor(() => {
          expect(onOpenChange).toHaveBeenLastCalledWith(
            true,
            expect.objectContaining({ reason: REASONS.triggerPress }),
          );
        });
        await setProps({ open: true });
        await flushMicrotasks();
        expect(screen.getByRole('option')).not.toHaveAttribute('data-highlighted');
      });

      it.each(['Trigger', 'ArrowDown'] as const)(
        'discards the request when a rejected typed open is followed by opening with %s',
        async (method) => {
          const user = userEvent.setup();
          render(() => (
            <AsyncCombobox
              items={['32', '320']}
              onOpenChange={(nextOpen, details) => {
                if (nextOpen && details.reason === 'input-change') {
                  details.cancel();
                }
              }}
            />
          ));
          const input = screen.getByRole('combobox');
          await act(() => input.focus());
          await user.keyboard('32');
          expect(screen.queryByRole('listbox')).toBe(null);

          if (method === 'Trigger') {
            await user.click(screen.getByTestId('trigger'));
          } else {
            await user.keyboard('{ArrowDown}');
          }

          // A trigger press opens on the frame after `mousedown`, which `user.click` can beat.
          const option = await screen.findByRole('option', { name: '32' });
          await flushMicrotasks();
          expect(option).not.toHaveAttribute('data-highlighted');
          expect(input).not.toHaveAttribute('aria-activedescendant');
        },
      );

      it('discards the request when the controlled input is cleared', async () => {
        const onValueChange = vi.fn();
        function ControlledCombobox(props: { clear?: boolean; items?: string[] }) {
          const [inputValue, setInputValue] = createSignal('');
          return (
            <AsyncCombobox
              items={props.items ?? []}
              inputValue={props.clear ? '' : inputValue()}
              onInputValueChange={setInputValue}
              onValueChange={onValueChange}
            />
          );
        }
        const { user, setProps } = renderWithProps<{ clear?: boolean; items?: string[] }>(
          (props) => <ControlledCombobox clear={props.clear} items={props.items} />,
          {},
        );
        const input = screen.getByRole('combobox');
        await user.type(input, '32');
        await setProps({ clear: true });
        await setProps({ clear: true, items: ['32'] });
        expect(input).toHaveValue('');
        expect(input).not.toHaveAttribute('aria-activedescendant');
        expect(screen.getByRole('option')).not.toHaveAttribute('data-highlighted');
        await user.keyboard('{Enter}');
        expect(onValueChange).not.toHaveBeenCalled();
      });

      // jsdom has no Web Animations API to hold the close animation.
      it.skip('discards the request when a controlled close is interrupted', () => {});

      it('does not reset keyboard navigation when candidates change', async () => {
        const { user, setProps } = renderAsync({});
        await user.type(screen.getByRole('combobox'), '32');
        await setProps({ items: ['32', '320'] });
        await user.keyboard('{ArrowDown}');
        await waitFor(() =>
          expect(screen.getByRole('option', { name: '320' })).toHaveAttribute('data-highlighted'),
        );
        await setProps({ items: ['321', '320'] });
        expect(screen.getByRole('option', { name: '320' })).toHaveAttribute('data-highlighted');
      });

      it('discards the request when autoHighlight is disabled', async () => {
        const { user, setProps } = renderAsync({});
        await user.type(screen.getByRole('combobox'), '32');
        await setProps({ autoHighlight: false });
        await setProps({ autoHighlight: true, items: ['32'] });
        expect(screen.getByRole('option')).not.toHaveAttribute('data-highlighted');
      });
    });

    it('does not auto-highlight on initial open when no selection', async () => {
      render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight defaultOpen>
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
      ));
      await flushMicrotasks();

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(screen.getByRole('listbox')).not.toBe(null);
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('shows the selected item as selected on initial open (no active highlight)', async () => {
      render(() => (
        <Combobox.Root
          items={['apple', 'banana', 'cherry']}
          defaultValue="banana"
          autoHighlight
          defaultOpen
        >
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
      ));
      await flushMicrotasks();

      const input = screen.getByRole<HTMLInputElement>('combobox');
      const banana = screen.getByRole('option', { name: 'banana' });

      expect(banana).toHaveAttribute('aria-selected', 'true');
      // Highlight is applied only after filtering begins
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('highlights the first matching item after typing (single mode)', async () => {
      const user = userEvent.setup();
      render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight>
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
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.type(input, 'ch');

      const cherry = await screen.findByRole('option', { name: 'cherry' });
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', cherry.id));
    });

    it('highlights the first matching item after IME composition', async () => {
      render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight openOnInputClick={false}>
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
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      fireEvent.compositionStart(input);
      fireEvent.input(input, { target: { value: 'ch' } });
      fireEvent.compositionEnd(input, { data: 'ch' });
      flush();

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      const cherry = await screen.findByRole('option', { name: 'cherry' });
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', cherry.id));
    });

    it('highlights the first matching item for a static list without the items prop', async () => {
      const user = userEvent.setup();
      render(() => (
        <Combobox.Root autoHighlight>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="alpha">alpha</Combobox.Item>
                  <Combobox.Item value="alphabet">alphabet</Combobox.Item>
                  <Combobox.Item value="beta">beta</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');
      await user.type(input, 'al');

      const alpha = screen.getByRole('option', { name: 'alpha' });
      await waitFor(() => expect(alpha).toHaveAttribute('data-highlighted'));
      expect(input).toHaveAttribute('aria-activedescendant', alpha.id);

      await user.type(input, ' ');
      expect(alpha).toHaveAttribute('data-highlighted');
      expect(input).toHaveAttribute('aria-activedescendant', alpha.id);
    });

    it('keeps gridcell typeahead active across Space in row mode without selecting', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(() => (
        <Combobox.Root autoHighlight grid onValueChange={onValueChange}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="new-york">new york</Combobox.Item>
                    <Combobox.Item value="new-jersey">new jersey</Combobox.Item>
                  </Combobox.Row>
                  <Combobox.Row>
                    <Combobox.Item value="old-town">old town</Combobox.Item>
                    <Combobox.Item value="other">other</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');
      await user.type(input, 'new');

      const newYork = screen.getByRole('gridcell', { name: 'new york' });
      await waitFor(() => expect(newYork).toHaveAttribute('data-highlighted'));
      expect(input).toHaveAttribute('aria-activedescendant', newYork.id);

      await user.type(input, ' ');
      expect(newYork).toHaveAttribute('data-highlighted');
      expect(input).toHaveAttribute('aria-activedescendant', newYork.id);
      expect(input).toHaveValue('new ');
      expect(onValueChange.mock.calls.length > 0).toBe(false);
    });

    it('does not run follow-up state changes after canceled input value changes', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn();
      const onInputValueChange = vi.fn(
        (_value: string, details: Combobox.Root.ChangeEventDetails) => {
          details.cancel();
        },
      );

      render(() => (
        <Combobox.Root
          defaultValue="apple"
          openOnInputClick={false}
          onInputValueChange={onInputValueChange}
          onOpenChange={onOpenChange}
          onValueChange={onValueChange}
        >
          <Combobox.Input />
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

      const input = screen.getByRole('combobox');

      await user.clear(input);

      expect(onInputValueChange).toHaveBeenCalled();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('listbox')).toBe(null);

      onInputValueChange.mockClear();
      onOpenChange.mockClear();

      await user.type(input, 'b');

      expect(onInputValueChange).toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('retains highlight when query is cleared back to empty', async () => {
      const user = userEvent.setup();
      render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight>
          <Combobox.Input />
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
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.type(input, 'a');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));

      await user.clear(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
    });

    it('retains highlight when clearing the query with input-change behavior', async () => {
      const user = userEvent.setup();
      render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight>
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
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await user.type(input, 'ban');
      await screen.findByRole('option', { name: 'banana' });
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
      const highlightedBefore = input.getAttribute('aria-activedescendant');
      expect(highlightedBefore).not.toBe(null);

      await user.clear(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
    });

    it('highlights the first matching item after typing (multiple mode)', async () => {
      const user = userEvent.setup();
      render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']} multiple autoHighlight>
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
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.type(input, 'ba');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
      const activeId = input.getAttribute('aria-activedescendant');
      const activeEl = document.getElementById(activeId!);
      expect(activeEl?.textContent).toBe('banana');
    });

    it('clears highlight after removing the highlighted chip while filtering (multiple mode)', async () => {
      const user = userEvent.setup();
      render(() => (
        <Combobox.Root
          items={['apple', 'banana', 'cherry']}
          multiple
          autoHighlight
          defaultOpen
          defaultValue={['apple']}
        >
          <Combobox.Chips>
            <Combobox.Value>
              {(value: string[]) => (
                <>
                  <For each={value}>
                    {(item) => (
                      <Combobox.Chip>
                        {item}
                        <Combobox.ChipRemove aria-label={`Remove ${item}`} />
                      </Combobox.Chip>
                    )}
                  </For>
                </>
              )}
            </Combobox.Value>
            <Combobox.Input data-testid="input" />
          </Combobox.Chips>
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
      ));

      const input = screen.getByTestId('input');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      await user.type(input, 'a');
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));

      await user.click(screen.getByRole('button', { name: 'Remove apple', hidden: true }));

      await waitFor(() => expect(input.getAttribute('aria-activedescendant')).toBe(null));
    });
    it('keeps the active item highlighted after clearing the last selected value', async () => {
      const user = userEvent.setup();
      const items = [
        { id: 'js', value: 'JavaScript' },
        { id: 'ts', value: 'TypeScript' },
        { id: 'py', value: 'Python' },
        { id: 'rb', value: 'Ruby' },
      ];

      render(() => (
        <Combobox.Root items={items} multiple>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: (typeof items)[number]) => (
                    <Combobox.Item value={item}>{item.value}</Combobox.Item>
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

      await user.click(screen.getByRole('option', { name: 'JavaScript' }));
      await user.click(screen.getByRole('option', { name: 'TypeScript' }));

      await user.type(input, 'pyth');
      await user.click(screen.getByRole('option', { name: 'Python' }));

      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));

      input.focus();
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await user.hover(screen.getByRole('option', { name: 'JavaScript' }));
      await user.click(screen.getByRole('option', { name: 'JavaScript' }));
      await user.hover(screen.getByRole('option', { name: 'TypeScript' }));
      await user.click(screen.getByRole('option', { name: 'TypeScript' }));

      const pythonOption = screen.getByRole('option', { name: 'Python' });
      await user.hover(pythonOption);
      await user.click(pythonOption);

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', pythonOption.id);
      });

      await user.keyboard('{ArrowDown}');
      const rubyOption = screen.getByRole('option', { name: 'Ruby' });
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', rubyOption.id);
      });
    });

    it('does not shift highlight to the previous selected item on Enter deselect', async () => {
      const user = userEvent.setup();
      const items = [
        { id: 'js', value: 'JavaScript' },
        { id: 'ts', value: 'TypeScript' },
        { id: 'py', value: 'Python' },
      ];

      render(() => (
        <Combobox.Root items={items} multiple defaultValue={[items[0], items[1]]}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: (typeof items)[number]) => (
                    <Combobox.Item value={item}>{item.value}</Combobox.Item>
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

      const typeScriptOption = screen.getByRole('option', { name: 'TypeScript' });
      await user.hover(typeScriptOption);
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', typeScriptOption.id);
      });

      expect(typeScriptOption).toHaveAttribute('aria-selected', 'true');

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(typeScriptOption).toHaveAttribute('aria-selected', 'false');
      });
      expect(input).toHaveAttribute('aria-activedescendant', typeScriptOption.id);
    });

    const chipItems = [
      { id: 'js', value: 'JavaScript' },
      { id: 'ts', value: 'TypeScript' },
      { id: 'py', value: 'Python' },
    ];

    function ChipsCombobox(props: { defaultValue?: (typeof chipItems)[number][] }) {
      return (
        <Combobox.Root items={chipItems} multiple defaultValue={props.defaultValue}>
          <Combobox.Chips>
            <Combobox.Value>
              {(value: (typeof chipItems)[number][]) => (
                <For each={value}>
                  {(item) => (
                    <Combobox.Chip aria-label={item.value}>
                      {item.value}
                      <Combobox.ChipRemove aria-label={`Remove ${item.value}`} />
                    </Combobox.Chip>
                  )}
                </For>
              )}
            </Combobox.Value>
            <Combobox.Input data-testid="input" />
          </Combobox.Chips>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: (typeof chipItems)[number]) => (
                    <Combobox.Item value={item}>{item.value}</Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      );
    }

    it('continues ArrowDown navigation from the Enter-selected item (multiple mode)', async () => {
      const user = userEvent.setup();
      render(() => <ChipsCombobox />);

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      const typeScriptOption = screen.getByRole('option', { name: 'TypeScript' });
      await user.hover(typeScriptOption);
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', typeScriptOption.id);
      });

      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', typeScriptOption.id);
      });

      await user.keyboard('{ArrowDown}');

      const pythonOption = screen.getByRole('option', { name: 'Python' });
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', pythonOption.id);
      });
    });

    it('clears active highlight when removing the highlighted chip item', async () => {
      const user = userEvent.setup();
      render(() => <ChipsCombobox defaultValue={[chipItems[0], chipItems[1]]} />);

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant');
      });

      const highlightedOption = document.getElementById(
        input.getAttribute('aria-activedescendant')!,
      );
      const highlightedLabel = highlightedOption?.textContent;
      expect(highlightedLabel).not.toBe(null);

      await user.click(
        screen.getByRole('button', { name: `Remove ${highlightedLabel as string}`, hidden: true }),
      );

      await waitFor(() => {
        expect(input.getAttribute('aria-activedescendant')).toBe(null);
      });
    });

    it('keeps highlight in sync after selecting then backspacing to a single match', async () => {
      const user = userEvent.setup();
      const items = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
      render(() => (
        <Combobox.Root items={items} autoHighlight>
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
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      // Select index 4
      await user.click(screen.getByRole('option', { name: 'epsilon' }));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));

      // Reopen and press Backspace to narrow to a single match
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      // Backspace once: from 'epsilon' -> 'epsilo', which should still only match 'epsilon'
      await user.keyboard('{Backspace}');
      const epsilon = await screen.findByRole('option', { name: 'epsilon' });
      // With autoHighlight, the first (and only) item should be highlighted
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', epsilon.id));
    });

    it('navigates on first ArrowDown after editing selection to a new matching query', async () => {
      const user = userEvent.setup();
      render(() => (
        <Combobox.Root items={['Apple', 'Grape', 'Grapefruit']} autoHighlight>
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
      ));

      const input = screen.getByTestId('input');

      // Open and select Apple
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await user.click(screen.getByRole('option', { name: 'Apple' }));

      // Edit input to "Ape" (matches Grape and Grapefruit)
      await user.click(input);
      await user.clear(input);
      await user.type(input, 'Ape');
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      const grape = screen.getByRole('option', { name: 'Grape' });
      const grapefruit = screen.getByRole('option', { name: 'Grapefruit' });

      // With autoHighlight, first match is highlighted immediately
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', grape.id));

      // One ArrowDown should move to the next match (no double keypress needed)
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', grapefruit.id));
    });

    it('updates highlighted callback with newly filtered first item', async () => {
      const user = userEvent.setup();
      const onItemHighlighted = vi.fn();
      const items = ['banana', 'apple', 'apricot'];

      render(() => (
        <Combobox.Root
          items={items}
          autoHighlight
          defaultOpen
          onItemHighlighted={onItemHighlighted}
        >
          <Combobox.Input />
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
      ));

      const input = screen.getByRole('combobox');

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await user.click(input);
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(onItemHighlighted.mock.calls.length).toBeGreaterThan(0);
      });
      const [initialValue] = onItemHighlighted.mock.lastCall ?? [];
      expect(initialValue).toBe('banana');

      onItemHighlighted.mockClear();

      await user.type(input, 'ap');

      await waitFor(() => {
        expect(onItemHighlighted.mock.calls.length).toBeGreaterThan(0);
      });
      const [nextValue, data] = onItemHighlighted.mock.lastCall ?? [];
      expect(nextValue).toBe('apple');
      expect(data.reason).toBe('none');
      expect(data.index).toBe(0);
    });

    it('fires a single clearing highlight on Enter selection', async () => {
      const user = userEvent.setup();
      const onItemHighlighted = vi.fn();

      render(() => (
        <Combobox.Root
          items={['Apple', 'Apricot', 'Banana']}
          autoHighlight
          onItemHighlighted={onItemHighlighted}
        >
          <Combobox.Input />
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
      ));

      const input = screen.getByRole('combobox');

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await user.type(input, 'app');

      // Reset history to focus on close events only.
      onItemHighlighted.mockClear();
      await user.keyboard('{Enter}');
      await flushMicrotasks();

      const clearingCalls = onItemHighlighted.mock.calls.filter((call) => call[0] === undefined);
      expect(clearingCalls.length).toBe(1);
      const postClearCalls = onItemHighlighted.mock.calls.slice(
        onItemHighlighted.mock.calls.indexOf(clearingCalls[0]) + 1,
      );
      expect(postClearCalls.every((c) => c[0] === undefined)).toBe(true);
    });
  });

  describe('prop: onItemHighlighted', () => {
    it('fires on keyboard navigation', async () => {
      const user = userEvent.setup();
      const items = ['a', 'b', 'c'];
      const onItemHighlighted = vi.fn();

      render(() => (
        <Combobox.Root items={items} onItemHighlighted={onItemHighlighted}>
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
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(onItemHighlighted.mock.calls.length).toBeGreaterThan(0);
      });
      const [value, eventDetails] = onItemHighlighted.mock.lastCall ?? [];
      expect(value).toBe('a');
      expect(eventDetails.reason).toBe('keyboard');
      expect(eventDetails.index).toBe(0);
      expect(eventDetails.event).toBeInstanceOf(KeyboardEvent);
      expect(eventDetails.event.key).toBe('ArrowDown');
    });

    it('passes native mouse and pointer events for pointer highlights', async () => {
      const user = userEvent.setup();
      const items = ['a', 'b', 'c'];
      const onItemHighlighted = vi.fn();

      render(() => (
        <Combobox.Root items={items} onItemHighlighted={onItemHighlighted}>
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
      ));

      await user.click(screen.getByTestId('input'));
      const option = await screen.findByRole('option', { name: 'b' });
      await flushMicrotasks();
      const hoverEvent = new MouseEvent('mousemove', { bubbles: true });
      fireEvent(option, hoverEvent);

      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith('b', expect.anything());
      });
      const eventDetails = onItemHighlighted.mock.lastCall?.[1];
      expect(eventDetails.reason).toBe('pointer');
      expect(eventDetails.event).toBeInstanceOf(MouseEvent);
      expect(eventDetails.event).toBe(hoverEvent);
      expect(eventDetails.event).not.toBeInstanceOf(PointerEvent);

      // Solid's `onPointerLeave` listens to the native `pointerleave` (React synthesizes it from
      // `pointerout`).
      const leaveEvent = new PointerEvent('pointerleave', {
        bubbles: false,
        pointerType: 'mouse',
      });
      fireEvent(option, leaveEvent);
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith(
          undefined,
          expect.objectContaining({ reason: 'pointer', event: leaveEvent }),
        );
      });
      expect(onItemHighlighted.mock.lastCall?.[1].event).toBe(leaveEvent);
    });

    function HighlightCombobox(props: {
      onItemHighlighted: Combobox.Root.Props<string>['onItemHighlighted'];
    }) {
      return (
        <Combobox.Root
          items={['apple', 'apricot', 'banana']}
          onItemHighlighted={props.onItemHighlighted}
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Clear data-testid="clear" keepMounted />
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
      );
    }

    async function highlightFirstWithKeyboard(
      user: ReturnType<typeof userEvent.setup>,
      onItemHighlighted: ReturnType<typeof vi.fn>,
    ) {
      await user.click(screen.getByTestId('input'));
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith('apple', expect.anything());
      });
    }

    it('reports a pointer highlight after keyboard navigation', async () => {
      const user = userEvent.setup();
      const onItemHighlighted = vi.fn();
      render(() => <HighlightCombobox onItemHighlighted={onItemHighlighted} />);
      await highlightFirstWithKeyboard(user, onItemHighlighted);

      fireEvent.mouseMove(screen.getByRole('option', { name: 'banana' }));
      flush();
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith('banana', expect.anything());
      });
      expect(onItemHighlighted.mock.lastCall?.[1].reason).toBe('pointer');
    });

    it('reports no keyboard reason when typing clears the highlight', async () => {
      const user = userEvent.setup();
      const onItemHighlighted = vi.fn();
      render(() => <HighlightCombobox onItemHighlighted={onItemHighlighted} />);
      await highlightFirstWithKeyboard(user, onItemHighlighted);

      await user.keyboard('a');
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith(undefined, expect.anything());
      });
      expect(onItemHighlighted.mock.lastCall?.[1].reason).toBe('none');
    });

    it('reports no keyboard reason when the clear button clears the highlight', async () => {
      const user = userEvent.setup();
      const onItemHighlighted = vi.fn();
      render(() => <HighlightCombobox onItemHighlighted={onItemHighlighted} />);
      await highlightFirstWithKeyboard(user, onItemHighlighted);

      fireEvent.click(screen.getByTestId('clear'));
      flush();
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith(undefined, expect.anything());
      });
      const details = onItemHighlighted.mock.lastCall?.[1];
      expect(details.reason).toBe('none');
      expect(details.event.type).toBe('click');
    });
  });

  describe('highlight restoration when clearing the query', () => {
    it('returns the highlight to the selected item when the input is cleared', async () => {
      const user = userEvent.setup();
      render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']} defaultValue="cherry">
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup aria-label="Select item">
                <Combobox.Input aria-label="Search" />
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      const input = screen.getByRole<HTMLInputElement>('combobox', { name: 'Search' });

      await user.type(input, 'ap');
      await screen.findByRole('option', { name: 'apple' });

      await user.clear(input);
      await screen.findByRole('option', { name: 'cherry' });

      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
      const activeId = input.getAttribute('aria-activedescendant');
      expect(document.getElementById(activeId!)?.textContent).toBe('cherry');
    });

    it('returns the highlight to the selected item without the items prop', async () => {
      const user = userEvent.setup();
      render(() => (
        <Combobox.Root defaultValue="cherry">
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup aria-label="Select item">
                <Combobox.Input aria-label="Search" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                  <Combobox.Item value="cherry">cherry</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      const input = screen.getByRole<HTMLInputElement>('combobox', { name: 'Search' });

      await user.type(input, 'ap');
      await screen.findByRole('option', { name: 'apple' });

      await user.clear(input);
      await screen.findByRole('option', { name: 'cherry' });

      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
      const activeId = input.getAttribute('aria-activedescendant');
      expect(document.getElementById(activeId!)?.textContent).toBe('cherry');
    });

    it('restores an array-valued single selection when the query is cleared', async () => {
      const user = userEvent.setup();
      const items = [
        [1, 2],
        [3, 4],
        [5, 6],
      ];

      render(() => (
        <Combobox.Root
          items={items}
          defaultValue={items[1]}
          itemToStringLabel={(item: number[]) => item.join('-')}
        >
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup aria-label="Select item">
                <Combobox.Input aria-label="Search" />
                <Combobox.List>
                  {(item: number[]) => <Combobox.Item value={item}>{item.join('-')}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      const input = screen.getByRole<HTMLInputElement>('combobox', { name: 'Search' });

      // The array is a single-select value, not a list of selected values.
      const selected = screen.getByRole('option', { name: '3-4' });
      await waitFor(() => expect(selected).toHaveAttribute('data-highlighted'));

      await user.type(input, '1');
      await screen.findByRole('option', { name: '1-2' });

      await user.clear(input);
      const restored = await screen.findByRole('option', { name: '3-4' });
      await waitFor(() => expect(restored).toHaveAttribute('data-highlighted'));
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', restored.id));
    });

    it('does not highlight anything when there is no selected item', async () => {
      const user = userEvent.setup();
      render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']}>
          <Combobox.Input />
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
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await user.type(input, 'ap');
      await screen.findByRole('option', { name: 'apple' });

      await user.clear(input);
      await screen.findByRole('option', { name: 'cherry' });
      await flushMicrotasks();

      expect(input).not.toHaveAttribute('aria-activedescendant');
    });
  });

  describe('prop: open', () => {
    it('controls the open state', async () => {
      const { setProps, user } = renderWithProps<{ open: boolean }>(
        (props) => (
          <Combobox.Root open={props.open}>
            <Combobox.Input />
            <Combobox.Trigger>Open</Combobox.Trigger>
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
        ),
        { open: false },
      );

      const input = screen.getByRole('combobox');

      await user.click(input);
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await setProps({ open: true });
      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      await user.click(document.body);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });
    });

    it('keeps filtering responsive after selection when inline and open is controlled', async () => {
      const user = userEvent.setup();
      const items = ['Apple', 'Apricot', 'Banana', 'Grape', 'Orange'];

      render(() => (
        <Combobox.Root items={items} open inline>
          <Combobox.Input data-testid="input" />
          <Combobox.List>
            {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
          </Combobox.List>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      await user.type(input, 'ap');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Banana' })).toBe(null);
      });

      await user.click(screen.getByRole('option', { name: 'Apple' }));

      await user.clear(input);
      await user.type(input, 'ba');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Banana' })).not.toBe(null);
      });
    });

    it('releases filtering when a controlled popup ignores a close request', async () => {
      const user = userEvent.setup();
      const items = ['Apple', 'Apricot', 'Banana', 'Grape', 'Orange'];
      const onOpenChange = vi.fn();

      render(() => (
        <Combobox.Root items={items} open onOpenChange={onOpenChange}>
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

      const input = screen.getByTestId('input');

      await user.type(input, 'ap');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Banana' })).toBe(null);
      });

      await user.click(screen.getByRole('option', { name: 'Apple' }));

      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(screen.getByRole('dialog')).not.toBe(null);

      await user.clear(input);
      await user.type(input, 'ba');

      expect(input).toHaveValue('ba');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Banana' })).not.toBe(null);
      });
      expect(screen.queryByRole('option', { name: 'Apple' })).toBe(null);
    });

    // jsdom doesn't run CSS animations, so a deferred close has no exit animation to observe.
    it.skip('keeps filtered content stable when a controlled close is deferred', () => {});
  });

  describe('prop: defaultOpen', () => {
    it('mounts the popup on the first render', async () => {
      const mountedOnRender: boolean[] = [];

      function MountedProbe() {
        const store = useComboboxRootContext();
        mountedOnRender.push(store.select('mounted'));
        return null;
      }

      render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Input />
          <MountedProbe />
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

      expect(mountedOnRender[0]).toBe(true);
    });
  });

  describe('prop: onOpenChange', () => {
    it('fires when opening and closing', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      render(() => (
        <Combobox.Root onOpenChange={onOpenChange}>
          <Combobox.Input />
          <Combobox.Trigger>Open</Combobox.Trigger>
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

      await user.click(input);
      await waitFor(() => {
        expect(onOpenChange.mock.calls.length).toBeGreaterThan(0);
      });
      expect(onOpenChange.mock.lastCall?.[0]).toBe(true);

      // Close by clicking outside
      await user.click(document.body);
      await waitFor(() => {
        expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      });
    });

    it('ignores a request to open an open popup before anything is notified', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const handleInteractionOpenChange = vi.fn();

      function InteractionOpenChangeListener() {
        const store = useComboboxRootContext();
        onSettled(() => {
          store.context.events.on('openchange', handleInteractionOpenChange);
          return () => {
            store.context.events.off('openchange', handleInteractionOpenChange);
          };
        });
        return null;
      }

      render(() => (
        <Combobox.Root onOpenChange={onOpenChange}>
          <Combobox.Input />
          <InteractionOpenChangeListener />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');
      await act(async () => {
        input.focus();
      });
      await user.keyboard('a');
      expect(await screen.findByRole('listbox')).not.toBe(null);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(handleInteractionOpenChange).toHaveBeenCalledTimes(1);

      // Each keystroke and press on the input requests an open.
      await user.keyboard('p');
      await user.click(input);

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(handleInteractionOpenChange).toHaveBeenCalledTimes(1);
    });
  });
});
