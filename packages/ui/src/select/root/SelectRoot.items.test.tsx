import { For, Show, createSignal, flush } from 'solid-js';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { Select } from '..';
import { act, renderWithUser, wait } from '../test-utils';

function click(element: Element) {
  fireEvent.click(element);
  flush();
}

/**
 * Focuses the trigger and waits for the force-mounted list to register its items, which the
 * closed-trigger typeahead reads.
 */
async function focusTrigger(trigger: HTMLElement) {
  await act(() => {
    trigger.focus();
  });
  await wait(10);
  await act(() => {});
}

describe('<Select.Root /> (dynamic items and typeahead)', () => {
  describe('dynamic items', () => {
    it('skips null items when navigating', async () => {
      const [itemsFiltered, setItemsFiltered] = createSignal(false);

      const { user } = renderWithUser(() => (
        <Select.Root
          onOpenChange={(newOpen) => {
            if (newOpen) {
              setTimeout(() => {
                setItemsFiltered(true);
              }, 0);
            }
          }}
          onOpenChangeComplete={(newOpen) => {
            if (!newOpen) {
              setItemsFiltered(false);
            }
          }}
        >
          <Select.Trigger>Toggle</Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item>Add to Library</Select.Item>
                <Show when={!itemsFiltered()}>
                  <Select.Item>Add to Playlist</Select.Item>
                  <Select.Item>Play Next</Select.Item>
                  <Select.Item>Play Last</Select.Item>
                </Show>
                <Select.Item>Favorite</Select.Item>
                <Select.Item>Share</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByText('Toggle');

      await act(() => {
        trigger.focus();
      });

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });
      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Play Next' })).toBe(null);
      });

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}'); // Share
      await user.keyboard('{ArrowDown}'); // Share still

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Share' })).toHaveFocus();
      });
    });

    it('unselects the selected item if removed', async () => {
      const [items, setItems] = createSignal(['a', 'b', 'c']);
      const [selectedItem, setSelectedItem] = createSignal<string | null>('a');

      const { user } = renderWithUser(() => (
        <div>
          <button
            onClick={() => {
              setItems((prev) => prev.filter((item) => item !== 'a'));
            }}
          >
            Remove
          </button>
          <button
            onClick={() => {
              setItems(['a', 'b', 'c']);
            }}
          >
            Add
          </button>
          <div data-testid="value">{selectedItem()}</div>

          <Select.Root value={selectedItem()} onValueChange={setSelectedItem}>
            <Select.Trigger>Toggle</Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <For each={items()}>
                    {(item) => <Select.Item value={item}>{item}</Select.Item>}
                  </For>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
      ));

      const trigger = screen.getByText('Toggle');

      await act(() => {
        trigger.focus();
      });
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'a' })).toHaveAttribute('data-selected');
      });
      expect(screen.getByTestId('value')).toHaveTextContent('a');

      click(screen.getByText('Remove'));
      await act(() => {});

      expect(screen.queryByRole('option', { name: 'b' })).not.toHaveAttribute('data-selected');

      click(screen.getByText('Add'));
      await act(() => {});

      expect(screen.queryByRole('option', { name: 'a' })).not.toHaveAttribute('data-selected');
    });

    function createSwapTest(initialItems: string[], initialValue: string | null) {
      const onValueChange = vi.fn();
      const [items, setItems] = createSignal(initialItems);
      const [value, setValue] = createSignal<string | null>(initialValue);

      const result = renderWithUser(() => (
        <div>
          <Select.Root
            value={value()}
            onValueChange={(next) => {
              setValue(next);
              onValueChange(next);
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <For each={items()}>
                    {(item) => <Select.Item value={item}>{item}</Select.Item>}
                  </For>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
      ));

      return { ...result, onValueChange, setItems };
    }

    it('resets the value when the selected item is replaced and the item count is unchanged', async () => {
      const { user, onValueChange, setItems } = createSwapTest(['a', 'b', 'c'], 'c');

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveTextContent('c');

      // The items only register once the popup has mounted.
      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeVisible();
      });

      // Replace "c" with "d" while the popup is open, keeping the count at three.
      setItems(['a', 'b', 'd']);
      flush();

      await waitFor(() => {
        expect(onValueChange.mock.lastCall?.[0]).toBe(null);
      });

      expect(trigger).not.toHaveTextContent('c');
    });

    it('resets the value when every item is replaced and the item count is unchanged', async () => {
      const { user, onValueChange, setItems } = createSwapTest(['a', 'b', 'c'], 'c');

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeVisible();
      });

      setItems(['x', 'y', 'z']);
      flush();

      await waitFor(() => {
        expect(onValueChange.mock.lastCall?.[0]).toBe(null);
      });
    });

    it('keeps the value when the items are only reordered', async () => {
      const { user, onValueChange, setItems } = createSwapTest(['a', 'b', 'c'], 'c');

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeVisible();
      });

      setItems(['c', 'a', 'b']);
      flush();

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'c' })).toHaveAttribute('data-selected', '');
      });

      // The item set is unchanged, so nothing should have been reconciled away.
      expect(onValueChange).not.toHaveBeenCalled();
      expect(trigger).toHaveTextContent('c');
    });

    it('resets to default when the selected item is removed from the list', async () => {
      const [items, setItems] = createSignal(['a', 'b', 'c']);
      const { user } = renderWithUser(() => (
        <div>
          <Select.Root defaultValue="b">
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <For each={items()}>{(it) => <Select.Item value={it}>{it}</Select.Item>}</For>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <button
            data-testid="remove-c"
            onClick={() => setItems((prev) => prev.filter((i) => i !== 'c'))}
          >
            Remove C
          </button>
        </div>
      ));

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await user.click(await screen.findByRole('option', { name: 'c' }));
      await waitFor(() => expect(trigger).toHaveTextContent('c'));

      await user.click(screen.getByTestId('remove-c'));

      await waitFor(() => {
        expect(trigger).toHaveTextContent('b');
      });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-selected', '');
      });
    });

    it('resets via onValueChange and does not break in controlled mode when the selected item is removed', async () => {
      const [items, setItems] = createSignal(['a', 'b', 'c']);
      const [value, setValue] = createSignal<string | null>('c');
      const { user } = renderWithUser(() => (
        <div>
          <Select.Root value={value()} onValueChange={setValue}>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <For each={items()}>{(it) => <Select.Item value={it}>{it}</Select.Item>}</For>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <button
            data-testid="remove-c"
            onClick={() => setItems((prev) => prev.filter((i) => i !== 'c'))}
          >
            Remove C
          </button>
        </div>
      ));

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveTextContent('c');

      await user.click(screen.getByTestId('remove-c'));

      // Opening should not break; and no option is selected since the value is missing from list
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeVisible();
      });

      const options = await screen.findAllByRole('option');
      options.forEach((opt) => {
        expect(opt).not.toHaveAttribute('data-selected');
      });
    });

    // Skipped: the three 'resets aligned positioning …' tests measure real layout (upstream
    // skips them in jsdom too).

    it('falls back to null when both selected and initial default are removed (uncontrolled)', async () => {
      const [items, setItems] = createSignal(['a', 'b', 'c']);
      const { user } = renderWithUser(() => (
        <div>
          <Select.Root defaultValue="b">
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <For each={items()}>{(it) => <Select.Item value={it}>{it}</Select.Item>}</For>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <button
            data-testid="remove-b"
            onClick={() => setItems((prev) => prev.filter((i) => i !== 'b'))}
          >
            Remove B
          </button>
          <button
            data-testid="remove-c"
            onClick={() => setItems((prev) => prev.filter((i) => i !== 'c'))}
          >
            Remove C
          </button>
        </div>
      ));

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await user.click(await screen.findByRole('option', { name: 'c' }));
      await waitFor(() => expect(trigger).toHaveTextContent('c'));

      await user.click(screen.getByTestId('remove-b'));
      await user.click(screen.getByTestId('remove-c'));

      // Now no fallback remains; value should reset to null
      await waitFor(() => {
        expect(trigger).toHaveTextContent('');
      });

      await user.click(trigger);

      const options = await screen.findAllByRole('option');
      options.forEach((opt) => {
        expect(opt).not.toHaveAttribute('data-selected');
      });
    });

    it('falls back to null when both selected and initial default are removed (controlled)', async () => {
      const [items, setItems] = createSignal(['a', 'b', 'c']);
      const [value, setValue] = createSignal<string | null>('c');
      const { user } = renderWithUser(() => (
        <div>
          <Select.Root value={value()} onValueChange={setValue}>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <For each={items()}>{(it) => <Select.Item value={it}>{it}</Select.Item>}</For>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <button
            data-testid="remove-b"
            onClick={() => setItems((prev) => prev.filter((i) => i !== 'b'))}
          >
            Remove B
          </button>
          <button
            data-testid="remove-c"
            onClick={() => setItems((prev) => prev.filter((i) => i !== 'c'))}
          >
            Remove C
          </button>
        </div>
      ));

      const trigger = screen.getByTestId('trigger');

      await user.click(screen.getByTestId('remove-b'));
      await user.click(screen.getByTestId('remove-c'));

      await user.click(trigger);

      const options = await screen.findAllByRole('option');
      options.forEach((opt) => {
        expect(opt).not.toHaveAttribute('data-selected');
      });
    });
  });

  describe('typeahead', () => {
    it('matches an item by its label when the rendered text differs', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.Item value="us" label="United States">
                  <Select.ItemText>Option 1</Select.ItemText>
                </Select.Item>
                <Select.Item value="fr" label="France">
                  <Select.ItemText>Option 2</Select.ItemText>
                </Select.Item>
                <Select.Item value="ca" label="Canada">
                  <Select.ItemText>Option 3</Select.ItemText>
                </Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      await act(() => {
        screen.getByTestId('trigger').focus();
      });
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Option 1' })).toHaveFocus();
      });

      // Only the label matches; the rendered text is "Option 2".
      await user.keyboard('fr');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Option 2' })).toHaveFocus();
      });
    });

    it('starts a new search after focus leaves the select', async () => {
      const { user } = renderWithUser(() => (
        <div>
          <Select.Root>
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="apple">apple</Select.Item>
                  <Select.Item value="banana">banana</Select.Item>
                  <Select.Item value="avocado">avocado</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <button data-testid="outside">outside</button>
        </div>
      ));

      const trigger = screen.getByTestId('trigger');
      await focusTrigger(trigger);
      await user.keyboard('b');
      flush();
      expect(screen.getByTestId('value').textContent).toBe('banana');

      // Leaving and returning within the typeahead timeout must not continue the "b" search.
      await act(() => {
        screen.getByTestId('outside').focus();
        trigger.focus();
      });
      await user.keyboard('a');
      flush();

      expect(screen.getByTestId('value').textContent).toBe('avocado');
    });

    // Skipped: 'does not trigger selection when Space is pressed during text navigation'
    // (upstream skips it in jsdom).

    it('skips disabled items and commits the next match via typeahead on a closed trigger', async () => {
      const [value, setValue] = createSignal<string | null>(null);
      const { user } = renderWithUser(() => (
        <Select.Root value={value()} onValueChange={setValue}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="apricot" disabled>
                  apricot
                </Select.Item>
                <Select.Item value="avocado">avocado</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');

      // "apricot" and "avocado" both start with "a", but "apricot" is disabled. A single "a"
      // keypress must skip the disabled "apricot" and land on "avocado".
      await focusTrigger(trigger);
      await user.keyboard('a');
      flush();
      expect(valueEl.textContent).toBe('avocado');
    });

    it('commits typeahead on a closed trigger when items are provided', async () => {
      const [value, setValue] = createSignal<string | null>(null);
      const { user } = renderWithUser(() => (
        <Select.Root
          items={{ apple: 'Apple', cherry: 'Cherry' }}
          value={value()}
          onValueChange={setValue}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="apple">Apple</Select.Item>
                <Select.Item value="cherry">Cherry</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');

      // The popup is never opened: the trigger's own onFocus force-mount registers the list for
      // closed-trigger typeahead.
      await focusTrigger(trigger);
      await user.keyboard('c');
      flush();
      expect(valueEl.textContent).toBe('Cherry');
    });

    it('commits nothing when the only typeahead match is disabled (closed trigger)', async () => {
      const [value, setValue] = createSignal<string | null>(null);
      const { user } = renderWithUser(() => (
        <Select.Root value={value()} onValueChange={setValue}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="cherry">cherry</Select.Item>
                <Select.Item value="banana" disabled>
                  banana
                </Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');

      // "banana" is the only "b" item and it's disabled, so there is no selectable match.
      await focusTrigger(trigger);
      await user.keyboard('b');
      flush();
      expect(valueEl.textContent).toBe('');
    });

    it('does not let a disabled double-letter item block rapid cycling among enabled matches', async () => {
      const [value, setValue] = createSignal<string | null>(null);
      const { user } = renderWithUser(() => (
        <Select.Root value={value()} onValueChange={setValue}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="aaron" disabled>
                  aaron
                </Select.Item>
                <Select.Item value="apple">apple</Select.Item>
                <Select.Item value="avocado">avocado</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');

      // Disabled items are skipped while matching, so they must not count toward the doubled
      // first-letter guard: pressing "a" twice should cycle apple -> avocado.
      await focusTrigger(trigger);
      await user.keyboard('a');
      flush();
      expect(valueEl.textContent).toBe('apple');
      await user.keyboard('a');
      flush();
      expect(valueEl.textContent).toBe('avocado');
    });

    // Skipped: 'skips disabled items when highlighting via typeahead on an open popup'
    // (upstream skips it in jsdom).

    it('starts from the first match after value reset (closed)', async () => {
      const [value, setValue] = createSignal<string | null>(null);
      const { user } = renderWithUser(() => (
        <>
          <button data-testid="reset" onClick={() => setValue(null)}>
            Reset
          </button>
          <Select.Root value={value()} onValueChange={setValue}>
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="a1">A1</Select.Item>
                  <Select.Item value="a2">A2</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </>
      ));

      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');
      const resetBtn = screen.getByTestId('reset');

      await focusTrigger(trigger);
      await user.keyboard('a');
      flush();
      expect(valueEl.textContent).toBe('a1');

      await user.click(resetBtn);

      await focusTrigger(trigger);
      await user.keyboard('a');
      flush();
      expect(valueEl.textContent).toBe('a1');
    });

    it('does not jump matches after a closed-state value reset', async () => {
      const [value, setValue] = createSignal<string | null>('dog');
      const { user } = renderWithUser(() => (
        <>
          <button data-testid="set-car" onClick={() => setValue('car')}>
            Set car
          </button>
          <Select.Root value={value()} onValueChange={setValue}>
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="car">car</Select.Item>
                  <Select.Item value="cat">cat</Select.Item>
                  <Select.Item value="dog">dog</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </>
      ));

      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');
      const setCarButton = screen.getByTestId('set-car');

      expect(valueEl.textContent).toBe('dog');

      await user.click(setCarButton);
      flush();
      expect(valueEl.textContent).toBe('car');

      await focusTrigger(trigger);
      await user.keyboard('c');
      flush();
      expect(valueEl.textContent).toBe('cat');

      await user.keyboard('a');
      flush();
      expect(valueEl.textContent).toBe('cat');
    });
  });
});
