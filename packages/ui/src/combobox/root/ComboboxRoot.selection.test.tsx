import { For, createSignal } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Combobox } from '..';
import { REASONS } from '../../internals/reasons';
import {
  ActiveIndexProbe,
  AsyncItemsCombobox,
  MultiplePopupCombobox,
  SelectedIndexProbe,
  flushMicrotasks,
} from '../test-utils';

function renderWithUser(ui: () => any) {
  const user = userEvent.setup();
  const result = render(ui);
  return { ...result, user };
}

function StringList() {
  return (
    <Combobox.List>
      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
    </Combobox.List>
  );
}

describe('<Combobox.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  describe('selection behavior', () => {
    describe('single', () => {
      it('fires onOpenChange once with reason item-press on mouse click', async () => {
        const items = ['apple', 'banana'];
        const onOpenChange = vi.fn();

        const { user } = renderWithUser(() => (
          <Combobox.Root items={items} onOpenChange={onOpenChange}>
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <StringList />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByRole('combobox');
        await user.click(input);
        expect(screen.getByRole('listbox')).not.toBe(null);

        onOpenChange.mockClear();
        await user.click(screen.getByRole('option', { name: 'apple' }));

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

        expect(onOpenChange.mock.calls.length).toBe(1);
        expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
        expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
        expect(onOpenChange.mock.lastCall?.[1].event instanceof MouseEvent).toBe(true);
      });

      it('fires onOpenChange once with reason item-press on Enter selection', async () => {
        const items = ['apple', 'banana'];
        const onOpenChange = vi.fn();

        const { user } = renderWithUser(() => (
          <Combobox.Root items={items} onOpenChange={onOpenChange}>
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <StringList />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByRole('combobox');
        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

        await user.keyboard('{ArrowDown}');
        onOpenChange.mockClear();
        await user.keyboard('{Enter}');

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

        expect(onOpenChange.mock.calls.length).toBe(1);
        expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
        expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
        expect(onOpenChange.mock.lastCall?.[1].event instanceof KeyboardEvent).toBe(true);
      });

      it('should auto-close popup after selection when open state is uncontrolled', async () => {
        const items = ['apple', 'banana', 'cherry'];

        const { user } = renderWithUser(() => (
          <Combobox.Root items={items}>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <StringList />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByTestId('input');
        const trigger = screen.getByTestId('trigger');
        await user.click(trigger);

        expect(await screen.findByRole('listbox')).not.toBe(null);
        expect(input).toHaveAttribute('aria-expanded', 'true');

        const appleOption = await screen.findByText('apple');
        await user.click(appleOption);

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });
        expect(input).toHaveAttribute('aria-expanded', 'false');
      });

      it('syncs selected index when items change after close', async () => {
        const { user } = renderWithUser(() => <AsyncItemsCombobox />);

        const input = screen.getByTestId('input');
        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

        await user.click(screen.getByRole('option', { name: 'Cherry' }));
        await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));

        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

        const cherryOption = screen.getByRole('option', { name: 'Cherry' });
        expect(cherryOption).toHaveAttribute('data-selected', '');
      });

      it('should not auto-close popup when open state is controlled', async () => {
        const items = ['apple', 'banana', 'cherry'];

        const { user } = renderWithUser(() => (
          <Combobox.Root items={items} open>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <StringList />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        await user.click(screen.getByText('apple'));
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      it('should show all items when query is empty with enhanced filter', async () => {
        const items = ['apple', 'banana', 'cherry'];

        render(() => (
          <Combobox.Root items={items} defaultOpen>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <StringList />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        expect(screen.queryByText('apple')).not.toBe(null);
        expect(screen.queryByText('banana')).not.toBe(null);
        expect(screen.queryByText('cherry')).not.toBe(null);
      });

      it('should show all items when query matches current selection', async () => {
        const items = ['apple', 'banana', 'cherry'];

        const { user } = renderWithUser(() => (
          <Combobox.Root items={items} defaultValue="apple">
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <StringList />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByTestId('input');
        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);

        const appleOption = await screen.findByText('apple');
        await user.click(appleOption);

        expect(input).toHaveValue('apple');

        await user.click(trigger);

        expect(await screen.findByText('apple')).not.toBe(null);
        expect(await screen.findByText('banana')).not.toBe(null);
        expect(await screen.findByText('cherry')).not.toBe(null);
      });

      it('should reset input value to selected value when popup closes without selection', async () => {
        const items = ['apple', 'banana', 'cherry'];
        const onInputValueChange = vi.fn();

        const { user } = renderWithUser(() => (
          <Combobox.Root items={items} defaultValue="apple" onInputValueChange={onInputValueChange}>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <StringList />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByTestId('input');
        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);
        const appleOption = await screen.findByText('apple');
        await user.click(appleOption);

        expect(input).toHaveValue('apple');

        await user.click(trigger);
        await user.type(input, 'xyz');
        expect(input).toHaveValue('applexyz');

        await user.click(document.body);

        await waitFor(() => expect(input).toHaveValue('apple'));
        expect(onInputValueChange.mock.lastCall?.[0]).toBe('apple');
        expect(onInputValueChange.mock.lastCall?.[1].reason).toBe('none');
      });

      it('should not auto-close during browser autofill', async () => {
        const items = ['apple', 'banana', 'cherry'];

        render(() => (
          <Combobox.Root items={items} name="test" defaultOpen>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <StringList />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        expect(screen.getByRole('listbox')).not.toBe(null);

        const hiddenInput = screen.queryByRole('textbox', { hidden: true });
        fireEvent.change(hiddenInput!, { target: { value: 'apple' } });

        await flushMicrotasks();

        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      // Upstream skips these in jsdom (they rely on real layout, scrolling or browser input).
      it.skip('highlights and scrolls the selected item into view on first open (no items prop)', () => {});
      it.skip('highlights and scrolls the selected item into view on mount when inline (items prop)', () => {});
      it.skip('does not restore the initial highlight after focus leaves an inline input (items prop)', () => {});
      it.skip('does not apply the initial highlight when a selection resolves after blur (items prop)', () => {});
      it.skip('does not snap the highlight to a stale index while filtering an inline list (items prop)', () => {});
      it.skip('does not transfer a stale highlight when clearing an inline list without a selection (items prop)', () => {});
      it.skip('waits for a controlled query clear to commit before restoring the selection (items prop)', () => {});
      it.skip('highlights the first selected item on mount and keeps the highlight when toggling in a multiple inline list (items prop)', () => {});
      it.skip('does not highlight a non-selected item when an initial input value pre-filters the inline list (items prop)', () => {});
      it.skip('does not replace a pointer highlight when the initial selection resolves after mount (items prop)', () => {});
      it.skip('does not restore the initial highlight after pointer navigation is cleared (items prop)', () => {});
      it.skip('emits the selected item index to onItemHighlighted on mount when inline and virtualized (items prop)', () => {});
      it.skip('restores the highlight and scroll to the selected item when the query is cleared', () => {});
      it.skip('restores the selected direct item after its registration index changes', () => {});

      it('does not navigate kept-mounted items while controlled closed', async () => {
        const { user } = renderWithUser(() => (
          <Combobox.Root items={['apple', 'banana']} open={false} autoHighlight>
            <Combobox.Input data-testid="input" />
            <ActiveIndexProbe />
            <Combobox.Portal keepMounted>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <StringList />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        await user.type(screen.getByTestId('input'), 'banana');

        expect(screen.getByTestId('active-index')).toHaveTextContent('null');
        expect(screen.getByTestId('input')).not.toHaveAttribute('aria-activedescendant');
      });

      it('restores the selected item with the input outside the popup', async () => {
        const { user } = renderWithUser(() => (
          <Combobox.Root items={['apple', 'banana', 'cherry']} value="banana" defaultOpen>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <StringList />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByTestId('input');
        await user.type(input, 'cherry');
        await waitFor(() => expect(screen.queryByRole('option', { name: 'banana' })).toBe(null));

        await user.clear(input);

        const banana = await screen.findByRole('option', { name: 'banana' });
        await waitFor(() => expect(banana).toHaveAttribute('data-highlighted'));
        expect(input).toHaveAttribute('aria-activedescendant', banana.id);
      });

      // Upstream skips this in jsdom: it measures real scroll positions.
      it.skip('scrolls to programmatic highlights after the filtered list changes', () => {});

      it('restores the selected item instead of the first item when clearing with autoHighlight', async () => {
        const { user } = renderWithUser(() => (
          <Combobox.Root items={['apple', 'banana', 'cherry']} defaultValue="banana" autoHighlight>
            <Combobox.Trigger data-testid="trigger">
              <Combobox.Value />
            </Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input data-testid="input" />
                  <StringList />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');

        // With autoHighlight, filtering strongly highlights the first match.
        await user.type(input, 'a');
        const appleItem = await screen.findByRole('option', { name: 'apple' });
        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });

        // Clearing should return the highlight to the selected item, not the first item.
        await user.clear(input);

        const bananaItem = await screen.findByRole('option', { name: 'banana' });
        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('data-highlighted');
        });
        expect(screen.getByRole('option', { name: 'apple' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('emits onItemHighlighted for the selected item when the query is cleared', async () => {
        const onItemHighlighted = vi.fn();

        const { user } = renderWithUser(() => (
          <Combobox.Root
            items={['apple', 'banana', 'cherry']}
            defaultValue="banana"
            onItemHighlighted={onItemHighlighted}
          >
            <Combobox.Trigger data-testid="trigger">
              <Combobox.Value />
            </Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input data-testid="input" />
                  <StringList />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');

        await user.type(input, 'cherry');
        onItemHighlighted.mockClear();

        await user.clear(input);

        // The consumer receives a programmatic (`none`) highlight for the selected item,
        // which virtualized lists rely on to scroll it into view.
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenCalledWith(
            'banana',
            expect.objectContaining({ reason: REASONS.none, index: 1 }),
          );
        });
      });

      // Upstream skips this in jsdom: it relies on real layout of a virtualized window.
      it.skip('restores the selected item through an externally virtualized list', () => {});

      it('consumes a query-clear restore when the selected item is absent', async () => {
        const onItemHighlighted = vi.fn();
        function App() {
          const [inputValue, setInputValue] = createSignal('');
          const [includeSelected, setIncludeSelected] = createSignal(true);
          const visibleItems = () => {
            if (inputValue()) {
              return ['apple'];
            }
            if (includeSelected()) {
              return ['apple', 'banana', 'cherry'];
            }
            return ['apple', 'cherry'];
          };

          return (
            <Combobox.Root
              inputValue={inputValue()}
              onInputValueChange={setInputValue}
              defaultValue="banana"
              defaultOpen
              autoHighlight
              onItemHighlighted={onItemHighlighted}
            >
              <ActiveIndexProbe />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.Input data-testid="input" />
                    <button type="button" onClick={() => setIncludeSelected(false)}>
                      Remove selected item
                    </button>
                    <Combobox.List>
                      <For each={visibleItems()}>
                        {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                      </For>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        const { user } = renderWithUser(() => <App />);
        const input = screen.getByTestId('input');
        await user.type(input, 'a');
        await waitFor(() => {
          expect(screen.getByTestId('active-index')).toHaveTextContent('0');
        });

        fireEvent.click(screen.getByRole('button', { name: 'Remove selected item' }));
        await flushMicrotasks();
        onItemHighlighted.mockClear();
        await user.clear(input);
        await waitFor(() => {
          expect(screen.getAllByRole('option')).toHaveLength(2);
        });
        await flushMicrotasks();
        expect(screen.getByTestId('active-index')).toHaveTextContent('null');
        expect(onItemHighlighted.mock.calls.some(([item]) => item === 'banana')).toBe(false);
      });

      it('clears selectedIndex when the value is cleared externally while closed (no items prop)', async () => {
        function App() {
          const [value, setValue] = createSignal<string | null>('banana');

          return (
            <div>
              <Combobox.Root value={value()} onValueChange={setValue}>
                <Combobox.Input data-testid="input" />
                <SelectedIndexProbe />
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.List>
                        <Combobox.Item value="apple">apple</Combobox.Item>
                        <Combobox.Item value="banana">banana</Combobox.Item>
                        <Combobox.Item value="cherry">cherry</Combobox.Item>
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
              <button type="button" data-testid="external-clear" onClick={() => setValue(null)}>
                Clear
              </button>
            </div>
          );
        }

        const { user } = renderWithUser(() => <App />);

        const input = screen.getByTestId('input');

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('1');
        });

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

        await user.click(screen.getByTestId('external-clear'));
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('null');
        });

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);

        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
        expect(input).not.toHaveAttribute('aria-activedescendant');
      });

      it('clears selectedIndex when the value is set to an unmatched value while closed (no items prop)', async () => {
        function App() {
          const [value, setValue] = createSignal<string | null>('banana');

          return (
            <div>
              <Combobox.Root value={value()} onValueChange={setValue}>
                <Combobox.Input data-testid="input" />
                <SelectedIndexProbe />
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.List>
                        <Combobox.Item value="apple">apple</Combobox.Item>
                        <Combobox.Item value="banana">banana</Combobox.Item>
                        <Combobox.Item value="cherry">cherry</Combobox.Item>
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
              <button
                type="button"
                data-testid="external-set"
                onClick={() => setValue('dragonfruit')}
              >
                Set
              </button>
            </div>
          );
        }

        const { user } = renderWithUser(() => <App />);

        const input = screen.getByTestId('input');

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('1');
        });

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

        await user.click(screen.getByTestId('external-set'));
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('null');
        });

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);

        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
        expect(input).not.toHaveAttribute('aria-activedescendant');
      });

      it('registers selectedIndex before opening with a keepMounted portal (no items prop)', async () => {
        render(() => (
          <Combobox.Root defaultValue="banana">
            <Combobox.Input data-testid="input" />
            <SelectedIndexProbe />
            <Combobox.Portal keepMounted>
              <Combobox.Positioner>
                <Combobox.Popup>
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

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('1');
        });
      });

      it('does not highlight the previous item after the value changes while open (no items prop)', async () => {
        const onItemHighlighted = vi.fn();

        function App() {
          const [value, setValue] = createSignal<string | null>('banana');

          return (
            <div>
              <Combobox.Root
                value={value()}
                onValueChange={setValue}
                onItemHighlighted={onItemHighlighted}
              >
                <Combobox.Input data-testid="input" />
                <SelectedIndexProbe />
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.List>
                        <Combobox.Item value="apple">apple</Combobox.Item>
                        <Combobox.Item value="banana">banana</Combobox.Item>
                        <Combobox.Item value="cherry">cherry</Combobox.Item>
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
              <button type="button" data-testid="external-set" onClick={() => setValue('cherry')}>
                Set
              </button>
            </div>
          );
        }

        const { user } = renderWithUser(() => <App />);

        const input = screen.getByTestId('input');

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('1');
        });

        // Change the value externally while the popup is open. `fireEvent` avoids the
        // outside-press dismiss a real pointer interaction would trigger.
        fireEvent.click(screen.getByTestId('external-set'));
        await flushMicrotasks();
        expect(screen.getByRole('listbox')).not.toBe(null);

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });
        // Closing reconciles the index to the new selection (cherry).
        expect(screen.getByTestId('selected-index').textContent).toBe('2');

        onItemHighlighted.mockClear();
        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);

        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'cherry' })).toHaveAttribute(
            'data-highlighted',
          );
        });
        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
        expect(
          onItemHighlighted.mock.calls.some(([highlightedValue]) => highlightedValue === 'banana'),
        ).toBe(false);
      });

      it('re-highlights the selection on reopen when the value object is recreated with equal contents (no items prop)', async () => {
        const onItemHighlighted = vi.fn();
        const apple = { id: 1, label: 'apple' };
        const banana = { id: 2, label: 'banana' };
        const cherry = { id: 3, label: 'cherry' };
        const isItemEqualToValue = (a: any, b: any) => a.id === b.id;

        function App() {
          const [version, setVersion] = createSignal(0);
          // Recreate the controlled value object identity on each change (same id).
          const value = () => {
            version();
            return { id: 2, label: 'banana' };
          };

          return (
            <div>
              <Combobox.Root
                value={value()}
                isItemEqualToValue={isItemEqualToValue}
                onItemHighlighted={onItemHighlighted}
                itemToStringLabel={(v: any) => v.label}
              >
                <Combobox.Input data-testid="input" />
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.List>
                        <Combobox.Item value={apple}>apple</Combobox.Item>
                        <Combobox.Item value={banana}>banana</Combobox.Item>
                        <Combobox.Item value={cherry}>cherry</Combobox.Item>
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
              <button type="button" data-testid="force" onClick={() => setVersion((v) => v + 1)}>
                force
              </button>
            </div>
          );
        }

        const { user } = renderWithUser(() => <App />);
        const input = screen.getByTestId('input');

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);
        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'banana' })).toHaveAttribute(
            'data-highlighted',
          );
        });

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

        // Change while closed so the value object is recreated with the same id.
        fireEvent.click(screen.getByTestId('force'));
        await flushMicrotasks();

        onItemHighlighted.mockClear();
        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'banana' })).toHaveAttribute(
            'data-highlighted',
          );
        });
        expect(
          onItemHighlighted.mock.calls.some(([v]) => v && v.id !== undefined && v.id !== 2),
        ).toBe(false);
      });
    });

    describe('multiple', () => {
      it('should handle multiple selection', async () => {
        const handleValueChange = vi.fn();

        const { user } = renderWithUser(() => (
          <Combobox.Root multiple onValueChange={handleValueChange}>
            <Combobox.Input />
            <Combobox.List>
              <Combobox.Item value="a">a</Combobox.Item>
              <Combobox.Item value="b">b</Combobox.Item>
              <Combobox.Item value="c">c</Combobox.Item>
            </Combobox.List>
          </Combobox.Root>
        ));

        const optionA = screen.getByRole('option', { name: 'a' });
        await user.click(optionA);

        expect(handleValueChange.mock.calls.length).toBe(1);
        expect(handleValueChange.mock.calls[0][0]).toEqual(['a']);

        const optionB = screen.getByRole('option', { name: 'b' });
        await user.click(optionB);

        expect(handleValueChange.mock.calls.length).toBe(2);
        expect(handleValueChange.mock.calls[1][0]).toEqual(['a', 'b']);
      });

      it('opens with an empty input and highlights the first selected item (input inside popup)', async () => {
        const onItemHighlighted = vi.fn();
        const { user } = renderWithUser(() => (
          <MultiplePopupCombobox onItemHighlighted={onItemHighlighted} />
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        const appleItem = screen.getByRole('option', { name: 'apple' });
        const bananaItem = screen.getByRole('option', { name: 'banana' });

        expect(input).toHaveValue('');
        expect(appleItem).toHaveAttribute('aria-selected', 'true');
        expect(bananaItem).toHaveAttribute('aria-selected', 'true');
        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', appleItem.id);
        });
        await waitFor(() => {
          expect(screen.getByTestId('active-index')).toHaveTextContent('0');
        });
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenCalledWith(
            'apple',
            expect.objectContaining({ reason: REASONS.none, index: 0 }),
          );
        });
      });

      it('anchors the highlight to the first selected item in rendered order regardless of value order', async () => {
        // `apple` renders first but sits in the middle of the value array, so neither end of
        // that array points at it and only the rendered order does.
        const { user } = renderWithUser(() => (
          <MultiplePopupCombobox defaultValue={['banana', 'apple', 'cherry']} />
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        const appleItem = screen.getByRole('option', { name: 'apple' });

        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', appleItem.id);
        });
        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
        expect(screen.getByRole('option', { name: 'cherry' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('anchors the highlight to the first selected item with individually rendered items', async () => {
        const { user } = renderWithUser(() => (
          <Combobox.Root multiple defaultValue={['banana', 'apple', 'cherry']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <For each={['apple', 'banana', 'cherry']}>
                      {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </For>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByTestId('input');
        await user.click(input);
        const appleItem = await screen.findByRole('option', { name: 'apple' });

        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', appleItem.id);
        });
        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
        expect(screen.getByRole('option', { name: 'cherry' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('anchors to the first selected item in rendered order across groups', async () => {
        // `spinach` renders first but is not the last value, so anchoring to the rendered order
        // and anchoring to the end of the value array give different answers.
        const { user } = renderWithUser(() => (
          <Combobox.Root multiple defaultValue={['spinach', 'plum']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Group>
                      <Combobox.GroupLabel>Vegetables</Combobox.GroupLabel>
                      <Combobox.Item value="artichoke">artichoke</Combobox.Item>
                      <Combobox.Item value="spinach">spinach</Combobox.Item>
                    </Combobox.Group>
                    <Combobox.Group>
                      <Combobox.GroupLabel>Fruits</Combobox.GroupLabel>
                      <Combobox.Item value="apple">apple</Combobox.Item>
                      <Combobox.Item value="plum">plum</Combobox.Item>
                    </Combobox.Group>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByTestId('input');
        await user.click(input);

        const spinachItem = await screen.findByRole('option', { name: 'spinach' });
        await waitFor(() => {
          expect(spinachItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', spinachItem.id);
        });
        expect(screen.getByRole('option', { name: 'plum' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('keeps the highlight on an item a controlled value refused to select', async () => {
        // A controlled consumer may decline the change without calling `cancel()`. The query
        // still clears, and the highlight stays on the item that was pressed, matching what
        // happens when the same item is pressed without a query active.
        const { user } = renderWithUser(() => (
          <Combobox.Root
            items={['apple', 'banana', 'cherry']}
            multiple
            value={['apple']}
            onValueChange={() => {}}
          >
            <Combobox.Trigger data-testid="trigger">
              <Combobox.Value />
            </Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input data-testid="input" />
                  <StringList />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');

        await user.type(input, 'banana');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);
        });

        await user.click(screen.getByRole('option', { name: 'banana' }));
        await waitFor(() => {
          expect(input).toHaveValue('');
        });

        const bananaItem = await screen.findByRole('option', { name: 'banana' });
        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('data-highlighted');
        });
        expect(bananaItem).toHaveAttribute('aria-selected', 'false');
        expect(screen.getByRole('option', { name: 'apple' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('anchors to the first selected item when opened with the keyboard', async () => {
        const { user } = renderWithUser(() => (
          <MultiplePopupCombobox defaultValue={['banana', 'cherry']} />
        ));

        const trigger = screen.getByTestId('trigger');
        await user.keyboard('{Tab}');
        expect(trigger).toHaveFocus();
        await user.keyboard('{ArrowDown}');

        const bananaItem = await screen.findByRole('option', { name: 'banana' });
        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('data-highlighted');
        });
        expect(screen.getByRole('option', { name: 'cherry' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('continues arrow navigation from the anchor rather than the top of the list', async () => {
        const { user } = renderWithUser(() => (
          <MultiplePopupCombobox defaultValue={['banana', 'cherry']} />
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        // Focus reaches the input asynchronously. Keys sent before it lands are lost.
        await waitFor(() => {
          expect(input).toHaveFocus();
        });
        const bananaItem = await screen.findByRole('option', { name: 'banana' });
        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('data-highlighted');
        });

        // The next item after the anchor, not `apple` at the top.
        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'cherry' })).toHaveAttribute(
            'data-highlighted',
          );
        });

        await user.keyboard('{ArrowUp}');
        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('data-highlighted');
        });
      });

      it('keeps the toggled item highlighted when selecting with the keyboard while filtering', async () => {
        const { user } = renderWithUser(() => <MultiplePopupCombobox />);

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');

        await user.type(input, 'cherry');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);
        });

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'cherry' })).toHaveAttribute(
            'data-highlighted',
          );
        });

        await user.keyboard('{Enter}');
        await waitFor(() => {
          expect(input).toHaveValue('');
        });

        const cherryItem = await screen.findByRole('option', { name: 'cherry' });
        await waitFor(() => {
          expect(cherryItem).toHaveAttribute('data-highlighted');
        });
        expect(screen.getByRole('option', { name: 'apple' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('moves the anchor when the anchor item value changes', async () => {
        const [replaceApple, setReplaceApple] = createSignal(false);
        render(() => (
          <Combobox.Root multiple defaultValue={['apple', 'cherry']}>
            <Combobox.Input data-testid="input" />
            <SelectedIndexProbe />
            <Combobox.Portal keepMounted>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value={replaceApple() ? 'date' : 'apple'}>
                      {replaceApple() ? 'date' : 'apple'}
                    </Combobox.Item>
                    <Combobox.Item value="banana">banana</Combobox.Item>
                    <Combobox.Item value="cherry">cherry</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('0');
        });

        setReplaceApple(true);

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('2');
        });
      });

      it('moves the anchor to the next selected item when the anchor item leaves the list', async () => {
        const [hideApple, setHideApple] = createSignal(false);
        const visible = () => (hideApple() ? ['banana', 'cherry'] : ['apple', 'banana', 'cherry']);

        render(() => (
          <Combobox.Root multiple defaultValue={['apple', 'cherry']}>
            <Combobox.Input data-testid="input" />
            <SelectedIndexProbe />
            <Combobox.Portal keepMounted>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <For each={visible()}>
                      {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </For>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('0');
        });

        setHideApple(true);

        // `banana` now occupies index 0 but is not selected, so `cherry` takes the anchor.
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('1');
        });
      });

      it('restores the anchor rather than the toggled item when deselecting while filtering', async () => {
        const { user } = renderWithUser(() => <MultiplePopupCombobox />);

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');

        await user.type(input, 'banana');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);
        });

        await user.click(screen.getByRole('option', { name: 'banana' }));
        await waitFor(() => {
          expect(input).toHaveValue('');
        });

        const appleItem = await screen.findByRole('option', { name: 'apple' });
        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
        expect(screen.getByTestId('active-index')).toHaveTextContent('0');
      });

      it('restores the highlight to the first selected item when clearing (input inside popup)', async () => {
        const onItemHighlighted = vi.fn();
        const { user } = renderWithUser(() => (
          <MultiplePopupCombobox onItemHighlighted={onItemHighlighted} />
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');

        await user.type(input, 'banana');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);
        });

        onItemHighlighted.mockClear();
        await user.clear(input);

        const appleItem = await screen.findByRole('option', { name: 'apple' });
        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', appleItem.id);
        });
        await waitFor(() => {
          expect(screen.getByTestId('active-index')).toHaveTextContent('0');
        });
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenCalledWith(
            'apple',
            expect.objectContaining({ reason: REASONS.none, index: 0 }),
          );
        });
        expect(onItemHighlighted).toHaveBeenCalledTimes(1);
      });

      it('keeps the popup open and highlights the newly selected item after clearing its query', async () => {
        const onItemHighlighted = vi.fn();
        const { user } = renderWithUser(() => (
          <MultiplePopupCombobox defaultValue={['apple']} onItemHighlighted={onItemHighlighted} />
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        await user.type(input, 'cherry');
        const cherryItem = await screen.findByRole('option', { name: 'cherry' });

        onItemHighlighted.mockClear();
        await user.click(cherryItem);

        await waitFor(() => {
          expect(input).toHaveValue('');
        });
        expect(screen.getByRole('listbox')).not.toBe(null);
        expect(screen.getByRole('option', { name: 'apple' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        await waitFor(() => {
          expect(cherryItem).toHaveAttribute('aria-selected', 'true');
        });
        await waitFor(() => {
          expect(cherryItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', cherryItem.id);
        });
        await waitFor(() => {
          expect(screen.getByTestId('active-index')).toHaveTextContent('2');
        });
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenCalledWith(
            'cherry',
            expect.objectContaining({ reason: REASONS.none, index: 2 }),
          );
        });
      });

      it('keeps the toggled item highlighted when deselecting a selected item', async () => {
        const { user } = renderWithUser(() => <MultiplePopupCombobox />);

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        const appleItem = screen.getByRole('option', { name: 'apple' });
        const bananaItem = screen.getByRole('option', { name: 'banana' });

        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        await user.click(bananaItem);

        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('aria-selected', 'false');
        });
        expect(screen.getByRole('listbox')).not.toBe(null);
        expect(appleItem).toHaveAttribute('aria-selected', 'true');
        expect(appleItem).not.toHaveAttribute('data-highlighted');
        expect(bananaItem).toHaveAttribute('data-highlighted');
        expect(input).toHaveAttribute('aria-activedescendant', bananaItem.id);
        expect(screen.getByTestId('active-index')).toHaveTextContent('1');
      });

      it('clears the highlight when filtering deselects the only selected item', async () => {
        const { user } = renderWithUser(() => <MultiplePopupCombobox defaultValue={['banana']} />);

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        await user.type(input, 'banana');
        const bananaItem = await screen.findByRole('option', { name: 'banana' });

        await user.click(bananaItem);

        await waitFor(() => {
          expect(input).toHaveValue('');
        });
        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('aria-selected', 'false');
        });
        await flushMicrotasks();
        expect(input).not.toHaveAttribute('aria-activedescendant');
        expect(screen.getByTestId('active-index')).toHaveTextContent('null');
        expect(
          screen.getAllByRole('option').some((item) => item.hasAttribute('data-highlighted')),
        ).toBe(false);
      });

      it('clears a closing query and restores the first selected item on reopen', async () => {
        const onItemHighlighted = vi.fn();
        const { user } = renderWithUser(() => (
          <MultiplePopupCombobox onItemHighlighted={onItemHighlighted} />
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        await user.type(input, 'cherry');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'banana' })).toBe(null);
        });

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

        onItemHighlighted.mockClear();
        await user.click(screen.getByTestId('trigger'));

        const reopenedInput = await screen.findByTestId('input');
        const appleItem = await screen.findByRole('option', { name: 'apple' });
        expect(reopenedInput).toHaveValue('');
        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(reopenedInput).toHaveAttribute('aria-activedescendant', appleItem.id);
        });
        await waitFor(() => {
          expect(screen.getByTestId('active-index')).toHaveTextContent('0');
        });
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenCalledWith(
            'apple',
            expect.objectContaining({ reason: REASONS.none, index: 0 }),
          );
        });
      });

      // Upstream skips this in jsdom: it asserts real `scrollIntoView` calls.
      it.skip('scrolls the first selected item into view when clearing (input inside popup)', () => {});

      it('restores the highlight when clearing with the input outside the popup', async () => {
        const { user } = renderWithUser(() => (
          <Combobox.Root
            items={['apple', 'banana', 'cherry']}
            multiple
            defaultValue={['apple', 'banana']}
          >
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <StringList />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByTestId('input');
        await user.click(input);
        await user.type(input, 'banana');
        await waitFor(() => expect(screen.queryByRole('option', { name: 'apple' })).toBe(null));

        // Opening already highlights the first selected item in this layout, so clearing
        // the query returns to the same anchor.
        await user.clear(input);
        const apple = await screen.findByRole('option', { name: 'apple' });
        await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));
        expect(input).toHaveAttribute('aria-activedescendant', apple.id);
      });

      it('resets selectedIndex when clearing all selections while open', async () => {
        const items = ['apple', 'banana', 'cherry'];

        function App() {
          const [value, setValue] = createSignal(items.slice(0, 2));

          return (
            <Combobox.Root items={items} multiple value={value()} onValueChange={setValue}>
              <Combobox.Input data-testid="input" />
              <SelectedIndexProbe />
              <button type="button" data-testid="clear" onClick={() => setValue([])}>
                Clear
              </button>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <StringList />
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        const { user } = renderWithUser(() => <App />);

        expect(screen.queryByRole('listbox')).toBe(null);

        await user.click(screen.getByTestId('input'));

        expect(await screen.findByRole('listbox')).not.toBe(null);
        expect(screen.getByTestId('selected-index').textContent).toBe('0');

        await user.click(screen.getByTestId('clear'));

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('null');
        });
      });

      it('re-syncs selectedIndex after an external controlled update when closing', async () => {
        const items = ['apple', 'banana', 'cherry'];

        function App() {
          const [value, setValue] = createSignal([items[0]]);

          return (
            <Combobox.Root items={items} multiple value={value()} onValueChange={setValue}>
              <Combobox.Input data-testid="input" />
              <SelectedIndexProbe />
              <button type="button" data-testid="set-external" onClick={() => setValue([items[2]])}>
                Set external
              </button>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <StringList />
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        const { user } = renderWithUser(() => <App />);

        const input = screen.getByTestId('input');
        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('0');
        });

        await user.click(screen.getByTestId('set-external'));
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('2');
        });
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('2');
        });
      });

      it('clears selectedIndex when all values are removed externally while closed (no items prop)', async () => {
        const items = ['apple', 'banana', 'cherry'];

        function App() {
          const [value, setValue] = createSignal(items.slice(0, 2));

          return (
            <Combobox.Root multiple value={value()} onValueChange={setValue}>
              <Combobox.Input data-testid="input" />
              <SelectedIndexProbe />
              <button type="button" data-testid="external-clear" onClick={() => setValue([])}>
                Clear
              </button>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <For each={items}>
                        {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                      </For>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        const { user } = renderWithUser(() => <App />);

        const input = screen.getByTestId('input');

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('0');
        });

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

        await user.click(screen.getByTestId('external-clear'));
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('null');
        });

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);

        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('should create multiple hidden inputs for form submission', async () => {
        const items = ['a', 'b', 'c'];
        render(() => (
          <Combobox.Root multiple value={items} name="languages">
            <Combobox.Input />
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

        items.forEach((item) => {
          const input = screen.getByDisplayValue(item);
          expect(input).toHaveAttribute('type', 'hidden');
          expect(input.tagName).toBe('INPUT');
        });
      });

      it('does not submit multiple values when disabled', async () => {
        render(() => (
          <form data-testid="form">
            <Combobox.Root multiple disabled name="x" defaultValue={['a']}>
              <Combobox.Input />
            </Combobox.Root>
          </form>
        ));

        const form = screen.getByTestId<HTMLFormElement>('form');

        expect(new FormData(form).getAll('x')).toEqual([]);
      });

      it('should handle disabled state with chips', async () => {
        const { user } = renderWithUser(() => (
          <Combobox.Root multiple disabled defaultValue={['a', 'b']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Chips>
              <Combobox.Chip data-testid="chip-a">
                <Combobox.ChipRemove data-testid="remove-a" />
              </Combobox.Chip>
              <Combobox.Chip data-testid="chip-b">
                <Combobox.ChipRemove data-testid="remove-b" />
              </Combobox.Chip>
            </Combobox.Chips>
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

        const chipA = screen.getByTestId('chip-a');
        const removeA = screen.getByTestId('remove-a');

        expect(chipA).toHaveAttribute('aria-disabled', 'true');
        expect(removeA).toHaveAttribute('aria-disabled', 'true');

        await user.click(removeA);
        expect(screen.getByTestId('chip-a')).not.toBe(null);
      });

      it('should handle readOnly state with chips', async () => {
        const { user } = renderWithUser(() => (
          <Combobox.Root multiple readOnly defaultValue={['a', 'b']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Chips>
              <Combobox.Chip data-testid="chip-a">
                <Combobox.ChipRemove data-testid="remove-a" />
              </Combobox.Chip>
              <Combobox.Chip data-testid="chip-b">
                <Combobox.ChipRemove data-testid="remove-b" />
              </Combobox.Chip>
            </Combobox.Chips>
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

        const chipA = screen.getByTestId('chip-a');
        const removeA = screen.getByTestId('remove-a');

        expect(chipA).toHaveAttribute('aria-readonly', 'true');

        await user.click(removeA);
        expect(screen.getByTestId('chip-a')).not.toBe(null);
      });
    });
  });
});
