import { Show, createSignal, createUniqueId, flush, onSettled } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Combobox } from '..';
import { Autocomplete } from '../../autocomplete';
import { Dialog } from '../../dialog';
import { Field } from '../../field';
import { Form } from '../../form';
import { Input } from '../../input';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import {
  SelectedIndexProbe,
  getHiddenControl,
  flushMicrotasks,
  renderWithProps,
  renderWithUser,
  wait,
} from '../test-utils';

function renderUser(ui: () => any) {
  return renderWithUser(ui);
}

describe('<Combobox.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  describe('prop: limit', () => {
    it('keeps the selected index unset when the selected item is outside the rendered limit', async () => {
      const items = ['apple', 'banana', 'cherry', 'date'];
      const { user } = renderUser(() => (
        <Combobox.Root items={items} limit={2} defaultValue="date">
          <Combobox.Input />
          <SelectedIndexProbe />
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

      expect(screen.getByTestId('selected-index')).toHaveTextContent('null');

      await user.click(screen.getByRole('combobox'));
      await flushMicrotasks();

      expect(screen.getAllByRole('option')).toHaveLength(2);
      expect(screen.getByTestId('selected-index')).toHaveTextContent('null');
      expect(screen.getByRole('option', { name: 'apple' })).not.toHaveAttribute('data-highlighted');
      expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
        'data-highlighted',
      );
    });

    it('limits the number of items displayed when no groups are used', async () => {
      const items = ['apple', 'banana', 'cherry', 'date', 'elderberry'];
      render(() => (
        <Combobox.Root items={items} limit={3} defaultOpen>
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

      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'banana' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'cherry' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'date' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'elderberry' })).toBe(null);
    });

    function GroupedList() {
      return (
        <Combobox.List>
          {(group: { value: string; items: string[] }) => (
            <Combobox.Group items={group.items}>
              <Combobox.GroupLabel>{group.value}</Combobox.GroupLabel>
              <Combobox.Collection>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.Collection>
            </Combobox.Group>
          )}
        </Combobox.List>
      );
    }

    it('limits the number of items displayed when groups are used', async () => {
      const items = [
        { value: 'citrus', items: ['orange', 'lemon', 'lime'] },
        { value: 'berries', items: ['strawberry', 'blueberry', 'raspberry'] },
      ];

      render(() => (
        <Combobox.Root items={items} limit={4} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <GroupedList />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      expect(screen.getByRole('option', { name: 'orange' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'lemon' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'lime' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'strawberry' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'blueberry' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'raspberry' })).toBe(null);

      expect(screen.getByText('citrus')).not.toBe(null);
      expect(screen.getByText('berries')).not.toBe(null);
    });

    it('respects limit when filtering items', async () => {
      const items = ['apple', 'apricot', 'avocado', 'banana', 'blueberry'];
      const { user } = renderUser(() => (
        <Combobox.Root items={items} limit={2} defaultOpen>
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

      await user.type(input, 'a');
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'apricot' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'avocado' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'banana' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'blueberry' })).toBe(null);
    });

    it('stops filtering grouped items once the limit is reached', async () => {
      const items = [
        { value: 'groupA', items: ['banana', 'apple', 'apricot', 'avocado'] },
        { value: 'groupB', items: ['artichoke', 'banana', 'blueberry'] },
      ];

      const filter = vi.fn((itemValue: string, query: string) => itemValue.startsWith(query));

      const { user } = renderUser(() => (
        <Combobox.Root items={items} filter={filter as any} limit={2} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <GroupedList />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      filter.mockClear();

      await user.type(screen.getByTestId('input'), 'a');
      await flushMicrotasks();

      const filteredItemValues = filter.mock.calls.map(([itemValue]) => itemValue);

      expect(filteredItemValues).not.toContain('avocado');
      expect(filteredItemValues).not.toContain('artichoke');
      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'apricot' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'avocado' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'artichoke' })).toBe(null);
    });

    it('shows all items when limit is -1 (default)', async () => {
      const items = ['apple', 'banana', 'cherry', 'date', 'elderberry'];
      render(() => (
        <Combobox.Root items={items} limit={-1} defaultOpen>
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

      for (const name of items) {
        expect(screen.getByRole('option', { name })).not.toBe(null);
      }
    });

    it('handles limit of 0 gracefully', async () => {
      const items = ['apple', 'banana', 'cherry'];
      render(() => (
        <Combobox.Root items={items} limit={0} defaultOpen>
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

      expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'banana' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'cherry' })).toBe(null);
    });

    it('preserves order of items when applying limit across groups', async () => {
      const items = [
        { value: 'groupA', items: ['A1', 'A2'] },
        { value: 'groupB', items: ['B1', 'B2', 'B3'] },
      ];

      render(() => (
        <Combobox.Root items={items} limit={3} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <GroupedList />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      expect(screen.getByRole('option', { name: 'A1' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'A2' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'B1' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'B2' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'B3' })).toBe(null);
    });

    it('does not limit items when not using items prop', async () => {
      render(() => (
        <Combobox.Root limit={2} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                  <Combobox.Item value="cherry">cherry</Combobox.Item>
                  <Combobox.Item value="date">date</Combobox.Item>
                  <Combobox.Item value="elderberry">elderberry</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      for (const name of ['apple', 'banana', 'cherry', 'date', 'elderberry']) {
        expect(screen.getByRole('option', { name })).not.toBe(null);
      }
    });

    it('updates displayed items when limit changes', async () => {
      const items = ['apple', 'banana', 'cherry', 'date'];
      const { setProps } = renderWithProps(
        (props: { limit: number }) => (
          <Combobox.Root items={items} limit={props.limit} defaultOpen>
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
        ),
        { limit: 2 },
      );

      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'banana' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'cherry' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'date' })).toBe(null);

      await setProps({ limit: 3 });

      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'banana' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'cherry' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'date' })).toBe(null);
    });
  });
  describe('dialog pattern', () => {
    const fruits = ['Apple', 'Apricot', 'Banana', 'Grape', 'Orange'];
    const asyncFruits = ['apple', 'banana', 'cherry'];

    it.each([
      [false, ''],
      [false, 'Ba'],
      [true, ''],
      [true, 'Ba'],
    ] as const)(
      'clears the highlight when a keepMounted dialog closes (multiple=%s, query="%s")',
      async (multiple, query) => {
        const onItemHighlighted = vi.fn();
        const onValueChange = vi.fn();

        function Test() {
          const [open, setOpen] = createSignal(false);
          return (
            <Combobox.Root
              inline
              multiple={multiple}
              items={['Apple', 'Banana']}
              open={open()}
              onOpenChange={(next) => setOpen(next)}
              onItemHighlighted={onItemHighlighted}
              onValueChange={(value: any) => {
                onValueChange(value);
                setOpen(false);
              }}
            >
              <Dialog.Root open={open()} onOpenChange={(next) => setOpen(next)}>
                <Dialog.Trigger>Choose fruit</Dialog.Trigger>
                <Dialog.Portal keepMounted>
                  <Dialog.Popup
                    aria-label="Fruit chooser"
                    style={{ opacity: open() ? '1' : '0', transition: 'opacity 50ms' }}
                  >
                    <Combobox.Input />
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                    <Dialog.Close>Done</Dialog.Close>
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
            </Combobox.Root>
          );
        }

        const { user } = renderUser(() => <Test />);
        const trigger = screen.getByRole('button', { name: 'Choose fruit' });
        await user.click(trigger);
        const input = screen.getByRole('combobox');
        await waitFor(() => expect(input).toHaveFocus());
        if (query) {
          await user.type(input, query);
        }
        await user.keyboard(query ? '{ArrowDown}' : '{ArrowDown}{ArrowDown}');
        await flushMicrotasks();
        expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute('data-highlighted');
        onItemHighlighted.mockClear();

        await user.keyboard('{Enter}');
        await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
        expect(onValueChange).toHaveBeenLastCalledWith(multiple ? ['Banana'] : 'Banana');
        expect(onItemHighlighted.mock.calls.map(([value]) => value)).toEqual([undefined]);

        async function reopenAndNavigate(closeWithEscape = false) {
          await user.click(trigger);
          await waitFor(() => expect(input).toHaveFocus());
          expect(input).not.toHaveAttribute('aria-activedescendant');
          onValueChange.mockClear();
          await user.keyboard('{Enter}');
          expect(onValueChange).not.toHaveBeenCalled();
          await user.keyboard('{ArrowDown}');
          if (closeWithEscape) {
            await user.keyboard('{Escape}');
          } else {
            await user.click(screen.getByRole('button', { name: 'Done' }));
          }
          await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
        }

        await reopenAndNavigate(true);
        await reopenAndNavigate();
        await reopenAndNavigate();
      },
    );

    it('clears the highlight when an inline list in an unbound dialog unmounts', async () => {
      render(() => (
        <Combobox.Root inline items={['Apple', 'Banana', 'Cherry']}>
          <Dialog.Root>
            <Dialog.Trigger>Choose fruit</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup aria-label="Fruit chooser">
                <Combobox.Input />
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Combobox.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Choose fruit' });
      fireEvent.click(trigger);
      flush();
      let input = await screen.findByRole('combobox');
      await waitFor(() => expect(input).toHaveFocus());
      await flushMicrotasks();
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      flush();
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      flush();
      expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute('data-highlighted');

      fireEvent.keyDown(input, { key: 'Escape' });
      flush();
      await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));

      fireEvent.click(trigger);
      flush();
      input = await screen.findByRole('combobox');
      await waitFor(() => expect(input).toHaveFocus());
      await flushMicrotasks();
      expect(input).not.toHaveAttribute('aria-activedescendant');
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      flush();
      expect(screen.getByRole('option', { name: 'Apple' })).toHaveAttribute('data-highlighted');
    });

    function AsyncDialogCombobox() {
      const [loading, setLoading] = createSignal(true);
      const [value, setValue] = createSignal<string | null>(null);

      onSettled(() => {
        const timeout = setTimeout(() => setLoading(false), 0);
        return () => clearTimeout(timeout);
      });

      return (
        <Dialog.Root open>
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Popup>
              <form>
                <label for="name">Name</label>
                <input id="name" disabled={loading()} />

                <label for="fruit">Fruit</label>
                <Combobox.Root
                  items={asyncFruits}
                  value={value()}
                  onValueChange={(next: string | null) => setValue(next)}
                  disabled={loading()}
                >
                  <Combobox.Input id="fruit" placeholder="Select fruit..." />
                  <Combobox.Trigger aria-label="Open" />
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

                <button type="button">Cancel</button>
                <button type="submit" disabled={loading()}>
                  Save
                </button>
              </form>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      );
    }

    function DialogMultipleCombobox(props: { defaultOpen?: boolean }) {
      const [open, setOpen] = createSignal(props.defaultOpen ?? true);
      return (
        <Combobox.Root multiple items={fruits} inline>
          <Dialog.Root open={open()} onOpenChange={(next) => setOpen(next)}>
            <Dialog.Trigger>Trigger</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup aria-label="Fruit chooser">
                <Combobox.Chips>
                  <Combobox.Input data-testid="dialog-input" />
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Chips>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Combobox.Root>
      );
    }

    function DialogSingleCombobox(props: { defaultOpen?: boolean }) {
      const [open, setOpen] = createSignal(props.defaultOpen ?? true);
      const inputId = `input-${createUniqueId()}`;

      return (
        <Combobox.Root items={fruits} open={open()} onOpenChange={(next) => setOpen(next)} inline>
          <Dialog.Root open={open()} onOpenChange={(next) => setOpen(next)}>
            <Dialog.Trigger data-testid="dialog-trigger">
              <Combobox.Value>
                {(value: string | null) => (value == null ? 'Select a fruit' : value)}
              </Combobox.Value>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup aria-label="Fruit chooser">
                <div>
                  <label for={inputId}>Fruit</label>
                  <Combobox.Input
                    id={inputId}
                    data-testid="dialog-input"
                    placeholder="e.g. Apple"
                  />
                </div>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
                <Dialog.Close>Done</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Combobox.Root>
      );
    }

    it('does not let pending dialog initial focus steal focus from an async-enabled combobox', async () => {
      // Keep the dialog's initial-focus rAF pending until after the combobox click.
      const frameCallbacks = new Map<number, FrameRequestCallback>();
      let frameId = 0;
      const requestAnimationFrameSpy = vi
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation((callback) => {
          frameId += 1;
          frameCallbacks.set(frameId, callback);
          return frameId;
        });
      const cancelAnimationFrameSpy = vi
        .spyOn(window, 'cancelAnimationFrame')
        .mockImplementation((id) => {
          frameCallbacks.delete(id);
        });

      try {
        const { user } = renderUser(() => <AsyncDialogCombobox />);

        await waitFor(() => expect(screen.getByLabelText('Fruit')).toBeEnabled());
        await user.click(screen.getByLabelText('Fruit'));

        expect(await screen.findByRole('listbox')).toBeVisible();

        const callbacks = Array.from(frameCallbacks.values());
        frameCallbacks.clear();
        callbacks.forEach((callback) => callback(performance.now()));
        flush();
        await flushMicrotasks();

        expect(screen.getByLabelText('Fruit')).toHaveFocus();
        expect(screen.getByRole('listbox')).toBeVisible();
      } finally {
        requestAnimationFrameSpy.mockRestore();
        cancelAnimationFrameSpy.mockRestore();
      }
    });

    describe('multiple', () => {
      it('clears input after filtering, removes filter and highlight', async () => {
        const { user } = renderUser(() => <DialogMultipleCombobox />);

        const input = await screen.findByTestId('dialog-input');

        await user.type(input, 'ap');

        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'Banana' })).toBe(null);
        });
        expect(screen.getByRole('option', { name: 'Apple' })).not.toBe(null);
        expect(screen.getByRole('option', { name: 'Apricot' })).not.toBe(null);

        await user.click(screen.getByRole('option', { name: 'Apple' }));

        expect(input).toHaveValue('');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'Banana' })).not.toBe(null);
        });
        await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
      });

      it('still filters after selecting an item', async () => {
        const { user } = renderUser(() => <DialogMultipleCombobox />);

        const input = await screen.findByTestId('dialog-input');

        await user.type(input, 'ap');

        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'Banana' })).toBe(null);
        });
        expect(screen.getByRole('option', { name: 'Apple' })).not.toBe(null);
        expect(screen.getByRole('option', { name: 'Apricot' })).not.toBe(null);

        await user.click(screen.getByRole('option', { name: 'Apple' }));

        expect(input).toHaveValue('');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'Banana' })).not.toBe(null);
        });
        await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));

        await user.type(input, 'ap');

        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'Banana' })).toBe(null);
        });
      });

      it('retains highlight on selected item when not filtering', async () => {
        const { user } = renderUser(() => <DialogMultipleCombobox />);

        const input = await screen.findByTestId('dialog-input');

        input.focus();
        await flushMicrotasks();

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          const apple = screen.getByRole('option', { name: 'Apple' });
          expect(input).toHaveAttribute('aria-activedescendant', apple.id);
        });

        await user.keyboard('{Enter}');

        await waitFor(() => {
          const apple = screen.getByRole('option', { name: 'Apple' });
          expect(input).toHaveAttribute('aria-activedescendant', apple.id);
        });
      });
    });

    describe('single', () => {
      it('closes the dialog after selecting an item and updates the trigger value', async () => {
        const { user } = renderUser(() => <DialogSingleCombobox defaultOpen={false} />);

        const trigger = screen.getByTestId('dialog-trigger');
        await user.click(trigger);

        await screen.findByRole('dialog', { name: 'Fruit chooser' });
        const input = await screen.findByTestId('dialog-input');

        await user.type(input, 'ap');
        await user.click(screen.getByRole('option', { name: 'Apple' }));

        await waitFor(() => {
          expect(screen.queryByRole('dialog', { name: 'Fruit chooser' })).toBe(null);
        });

        await waitFor(() => {
          expect(trigger).toHaveTextContent('Apple');
        });
      });

      it('clears the filter input when re-opening after a selection', async () => {
        const { user } = renderUser(() => <DialogSingleCombobox defaultOpen={false} />);

        const trigger = screen.getByTestId('dialog-trigger');
        await user.click(trigger);

        await screen.findByRole('dialog', { name: 'Fruit chooser' });
        const input = await screen.findByTestId('dialog-input');

        await user.type(input, 'ap');
        await user.click(screen.getByRole('option', { name: 'Apple' }));

        await waitFor(() => {
          expect(screen.queryByRole('dialog', { name: 'Fruit chooser' })).toBe(null);
        });

        await user.click(trigger);

        await screen.findByRole('dialog', { name: 'Fruit chooser' });
        const reopenedInput = await screen.findByTestId('dialog-input');

        expect(reopenedInput).toHaveValue('');
        await screen.findByRole('option', { name: 'Banana' });
      });

      it('restores highlight when the input regains focus', async () => {
        const { user } = renderUser(() => <DialogSingleCombobox />);

        const input = await screen.findByTestId('dialog-input');

        input.focus();
        await flushMicrotasks();

        await user.keyboard('{ArrowDown}');

        const apple = screen.getByRole('option', { name: 'Apple' });

        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', apple.id);
        });
        expect(apple).toHaveAttribute('data-highlighted');

        const done = screen.getByRole('button', { name: 'Done' });
        fireEvent.blur(input, { relatedTarget: done });
        fireEvent.focus(done);
        flush();
        await flushMicrotasks();

        expect(input).not.toHaveAttribute('aria-activedescendant');
        expect(apple).not.toHaveAttribute('data-highlighted');

        fireEvent.blur(done, { relatedTarget: input });
        fireEvent.focus(input);
        flush();

        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', apple.id);
        });
        expect(apple).toHaveAttribute('data-highlighted');
      });
    });
  });

  describe('hidden input type', () => {
    function createComponent(props: Record<string, any>) {
      return (
        <Combobox.Root {...props}>
          <Combobox.Input data-testid="input" />
        </Combobox.Root>
      );
    }

    it('is hidden when the control takes no part in a form', async () => {
      const { container } = render(() => createComponent({}));
      expect(container.querySelector('input[aria-hidden]')).toHaveAttribute('type', 'hidden');
    });

    it.each([
      { name: 'name', props: { name: 'field' } },
      { name: 'autoComplete', props: { autoComplete: 'country' } },
      { name: 'required', props: { required: true } },
    ])('is a text input when $name is set', async ({ props }) => {
      render(() => createComponent(props));
      expect(screen.getByRole('textbox', { hidden: true })).not.toHaveAttribute('type');
    });

    it('is a text input inside Field.Root', async () => {
      render(() => <Field.Root>{createComponent({})}</Field.Root>);
      expect(screen.getByRole('textbox', { hidden: true })).not.toHaveAttribute('type');
    });

    // jsdom lets `type="hidden"` inputs take focus.
    it.skip('stays focusable through inputRef', () => {});
  });

  // Skipped: hiddenInputSizeTests (needs layout).
  describe('Form', () => {
    const countries = [
      { code: 'US', label: 'United States' },
      { code: 'CA', label: 'Canada' },
      { code: 'AU', label: 'Australia' },
    ];

    function CountryPortal() {
      return (
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: { code: string; label: string }) => (
                  <Combobox.Item value={item}>{item.label}</Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      );
    }

    function StringPortal() {
      return (
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      );
    }

    it('submits stringified value to onFormSubmit when itemToStringValue is provided', async () => {
      const items = countries.slice(0, 2);
      const handleFormSubmit = vi.fn();

      const { user } = renderUser(() => (
        <Form onFormSubmit={handleFormSubmit}>
          <Field.Root name="country">
            <Combobox.Root
              items={items}
              itemToStringLabel={(item) => item.label}
              itemToStringValue={(item) => item.code}
              defaultValue={items[0]}
            >
              <Combobox.Input />
              <CountryPortal />
            </Combobox.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      await user.click(screen.getByText('Submit'));

      expect(handleFormSubmit.mock.calls.length).toBe(1);
      expect(handleFormSubmit.mock.calls[0][0]).toEqual({ country: 'US' });
    });

    it('submits to an external form when `form` is provided', async () => {
      const submitSpy = vi.fn((event: SubmitEvent) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget as HTMLFormElement);
        return formData.get('country');
      });

      const items = countries.slice(0, 2);

      render(() => (
        <>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Combobox.Root
            name="country"
            form="external-form"
            items={items}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.code}
            defaultValue={items[0]}
          >
            <Combobox.Input />
            <CountryPortal />
          </Combobox.Root>
        </>
      ));

      fireEvent.click(screen.getByRole('button'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('US');
    });

    it('submits multiple values to an external form when `form` is provided', async () => {
      const submitSpy = vi.fn((event: SubmitEvent) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget as HTMLFormElement);
        return formData.getAll('countries');
      });

      render(() => (
        <>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Combobox.Root
            multiple
            name="countries"
            form="external-form"
            items={countries}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.code}
            defaultValue={[countries[0], countries[2]]}
          >
            <Combobox.Input />
            <CountryPortal />
          </Combobox.Root>
        </>
      ));

      fireEvent.click(screen.getByRole('button'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toEqual(['US', 'AU']);
    });

    describe('serialization for object values', () => {
      const items = [
        { value: 'US', label: 'United States' },
        { value: 'CA', label: 'Canada' },
        { value: 'AU', label: 'Australia' },
      ];

      function ValuePortal() {
        return (
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: { value: string; label: string }) => (
                    <Combobox.Item value={item}>{item.label}</Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        );
      }

      it('serializes {value,label} objects using their value field', async () => {
        render(() => (
          <Combobox.Root
            name="country"
            items={items}
            itemToStringLabel={(item) => item.label}
            defaultValue={items[1]}
          >
            <Combobox.Input />
            <ValuePortal />
          </Combobox.Root>
        ));

        const hiddenInput = screen.getByDisplayValue('CA');
        expect(hiddenInput.tagName).toBe('INPUT');
        expect(hiddenInput).toHaveAttribute('name', 'country');
      });

      it('serializes multiple {value,label} objects into multiple hidden inputs', async () => {
        const values = [items[0], items[2]];
        const { container } = render(() => (
          <Combobox.Root
            name="countries"
            items={items}
            itemToStringLabel={(item) => item.label}
            multiple
            defaultValue={values}
          >
            <Combobox.Input />
            <ValuePortal />
          </Combobox.Root>
        ));

        const hiddenInputs = container.querySelectorAll('input[name="countries"]');
        expect(hiddenInputs).toHaveLength(values.length);
        values.forEach((item, index) => {
          expect(hiddenInputs[index]).toHaveValue(item.value);
        });
      });

      it('falls back to itemToStringValue when object lacks value', async () => {
        const codeItems = [
          { code: 'US', name: 'United States' },
          { code: 'CA', name: 'Canada' },
          { code: 'AU', name: 'Australia' },
        ];

        const { container } = render(() => (
          <Combobox.Root
            name="country"
            items={codeItems}
            itemToStringLabel={(item) => item.name}
            itemToStringValue={(item) => item.code}
            defaultValue={codeItems[0]}
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: { code: string; name: string }) => (
                      <Combobox.Item value={item}>{item.name}</Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const hiddenInput = container.querySelector('input[name="country"]');
        expect(hiddenInput).toHaveValue('US');
      });
    });

    it('triggers native HTML validation on submit', async () => {
      const { user } = renderUser(() => (
        <Form>
          <Field.Root name="test" data-testid="field">
            <Combobox.Root required>
              <Combobox.Input data-testid="input" />
              <Combobox.Portal>
                <Combobox.Positioner />
              </Combobox.Portal>
            </Combobox.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const submit = screen.getByText('Submit');

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(submit);

      const error = screen.getByTestId('error');
      expect(error).toHaveTextContent('required');
    });

    it('focuses trigger and surfaces errors when input is inside popup', async () => {
      let submittedCalls = 0;

      const handleSubmit = (event: SubmitEvent) => {
        event.preventDefault();
        submittedCalls += 1;
      };

      const { user } = renderUser(() => (
        <Form onSubmit={handleSubmit}>
          <Field.Root name="combobox">
            <Combobox.Root required>
              <Combobox.Trigger data-testid="trigger">
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.Input
                      render={(props) => <Input {...(props as any)} data-testid="input" />}
                    />
                    <Combobox.List>
                      <Combobox.Item value="a">a</Combobox.Item>
                      <Combobox.Item value="b">b</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByText('Submit'));

      expect(submittedCalls).toBe(0);

      const trigger = screen.getByTestId('trigger');

      await waitFor(() => expect(trigger).toHaveFocus());
      expect(trigger).toHaveAttribute('data-invalid', '');

      const error = screen.getByTestId('error');
      expect(error).toHaveTextContent('required');

      await user.click(trigger);

      const input = await screen.findByTestId('input');
      expect(input).not.toHaveAttribute('data-invalid');
    });

    it('submits when input renders a field-aware input', async () => {
      const handleFormSubmit = vi.fn();

      const { user } = renderUser(() => (
        <Form onFormSubmit={handleFormSubmit}>
          <Field.Root name="country">
            <Combobox.Root items={['France', 'Germany']} required>
              <Combobox.Input
                render={(props) => <Input {...(props as any)} data-testid="input" />}
              />
              <StringPortal />
            </Combobox.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('name', 'country');

      await user.click(input);
      await user.click(screen.getByRole('option', { name: 'France' }));
      await user.click(screen.getByText('Submit'));

      expect(handleFormSubmit.mock.calls.length).toBe(1);
      expect(handleFormSubmit.mock.calls[0][0]).toEqual({ country: 'France' });
    });

    it('submits when input inside popup renders a field-aware input', async () => {
      const handleFormSubmit = vi.fn();

      const { user } = renderUser(() => (
        <Form onFormSubmit={handleFormSubmit}>
          <Field.Root name="country">
            <Combobox.Root items={['France', 'Germany']} required>
              <Combobox.Trigger>
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.Input
                      render={(props) => <Input {...(props as any)} data-testid="input" />}
                    />
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      await user.click(screen.getByRole('combobox'));
      const input = await screen.findByTestId('input');
      expect(input).not.toHaveAttribute('name');

      await user.click(screen.getByRole('option', { name: 'France' }));

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('name', 'country');
      expect(hiddenInput).toHaveValue('France');

      await user.click(screen.getByText('Submit'));

      expect(handleFormSubmit.mock.calls.length).toBe(1);
      expect(handleFormSubmit.mock.calls[0][0]).toEqual({ country: 'France' });
    });

    it('clears external errors on change', async () => {
      const { user } = renderUser(() => (
        <Form errors={{ combobox: 'test' }}>
          <Field.Root name="combobox">
            <Combobox.Root>
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
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>
      ));

      expect(screen.getByTestId('error')).toHaveTextContent('test');

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('aria-invalid', 'true');

      await user.click(input);
      await flushMicrotasks();

      const option = screen.getByRole('option', { name: 'b' });
      await wait(200);
      await user.click(option);
      await flushMicrotasks();

      expect(screen.queryByTestId('error')).toBe(null);
      expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('submits on Enter when no item is highlighted (does not prevent)', async () => {
      let submittedCalls = 0;

      const handleSubmit = (event: SubmitEvent) => {
        event.preventDefault();
        submittedCalls += 1;
      };

      const { user } = renderUser(() => (
        <Form onSubmit={handleSubmit}>
          <Field.Root name="q">
            <Combobox.Root items={['apple', 'banana']} openOnInputClick>
              <Combobox.Input />
              <StringPortal />
            </Combobox.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{Enter}');

      expect(submittedCalls).toBe(1);
    });

    it('prevents submit on Enter when an item is highlighted', async () => {
      let submittedCalls = 0;

      const handleSubmit = (event: SubmitEvent) => {
        event.preventDefault();
        submittedCalls += 1;
      };

      const { user } = renderUser(() => (
        <Form onSubmit={handleSubmit}>
          <Field.Root name="q">
            <Combobox.Root items={['alpha', 'beta']} openOnInputClick>
              <Combobox.Input />
              <StringPortal />
            </Combobox.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(submittedCalls).toBe(0);
    });
  });
  describe('Field', () => {
    function ABPortal() {
      return (
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
      );
    }

    function ABPopupWithInput(props: { inputTestId?: string }) {
      return (
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Input data-testid={props.inputTestId} />
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
                <Combobox.Item value="b">b</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      );
    }

    function SelectPortal() {
      return (
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="">Select</Combobox.Item>
                <Combobox.Item value="1">Option 1</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      );
    }

    it('should receive disabled prop from Field.Root', async () => {
      render(() => (
        <Field.Root disabled>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <ABPortal />
          </Combobox.Root>
        </Field.Root>
      ));

      expect(screen.getByTestId('input')).toHaveAttribute('disabled');
      expect(screen.getByTestId('trigger')).toHaveAttribute('disabled');
    });

    it('should receive name prop from Field.Root', async () => {
      render(() => (
        <Field.Root name="field-combobox">
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <ABPortal />
          </Combobox.Root>
        </Field.Root>
      ));

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('name', 'field-combobox');
    });

    it('Field.Label links to Combobox.Trigger when input is inside popup and trigger has an explicit id', async () => {
      render(() => (
        <Field.Root>
          <Field.Label data-testid="label">Search</Field.Label>
          <Combobox.Root>
            <Combobox.Trigger data-testid="trigger" id="x-id">
              Open
            </Combobox.Trigger>
            <ABPopupWithInput />
          </Combobox.Root>
        </Field.Root>
      ));

      const label = screen.getByTestId('label');
      const trigger = screen.getByTestId('trigger');

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-labelledby', label.id);
      });
      expect(trigger).toHaveAttribute('id', 'x-id');
    });

    it('does not apply validation ARIA attributes to input inside popup', async () => {
      const { user } = renderUser(() => (
        <Field.Root invalid>
          <Combobox.Root>
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <ABPopupWithInput inputTestId="input" />
          </Combobox.Root>
          <Field.Description data-testid="description" />
          <Field.Error data-testid="error" match />
        </Field.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      const description = screen.getByTestId('description');
      const error = screen.getByTestId('error');
      await flushMicrotasks();
      const triggerDescribedBy = trigger.getAttribute('aria-describedby');

      expect(trigger).toHaveAttribute('aria-invalid', 'true');
      expect(triggerDescribedBy).toContain(description.id);
      expect(triggerDescribedBy).toContain(error.id);

      await user.click(trigger);

      const input = await screen.findByTestId('input');

      expect(input).not.toHaveAttribute('aria-invalid');
      expect(input).not.toHaveAttribute('aria-describedby');
      expect(input).not.toHaveAttribute('data-valid');
      expect(input).not.toHaveAttribute('data-invalid');
      expect(input).not.toHaveAttribute('data-touched');
      expect(input).not.toHaveAttribute('data-dirty');
      expect(input).not.toHaveAttribute('data-filled');
      expect(input).not.toHaveAttribute('data-focused');
    });

    it('Combobox.Label links to Combobox.Trigger when input is inside popup and trigger has an explicit id', async () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Label data-testid="label">Search</Combobox.Label>
          <Combobox.Trigger data-testid="trigger" id="x-id">
            Open
          </Combobox.Trigger>
          <ABPopupWithInput />
        </Combobox.Root>
      ));

      const label = screen.getByTestId('label');
      const trigger = screen.getByTestId('trigger');

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-labelledby', label.id);
      });
      expect(trigger).toHaveAttribute('id', 'x-id');
    });

    it('Combobox.Label focuses trigger without opening when input is inside popup', async () => {
      const { user } = renderUser(() => (
        <Combobox.Root>
          <Combobox.Label data-testid="label">Search</Combobox.Label>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <ABPopupWithInput />
        </Combobox.Root>
      ));

      await user.click(screen.getByTestId('label'));

      expect(screen.getByTestId('trigger')).toHaveFocus();
      expect(screen.queryByRole('dialog')).toBe(null);
    });

    it('[data-touched]', async () => {
      render(() => (
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <SelectPortal />
          </Combobox.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).not.toHaveAttribute('data-dirty');
      expect(trigger).not.toHaveAttribute('data-dirty');

      fireEvent.focus(input);
      fireEvent.blur(input);

      await flushMicrotasks();

      expect(input).toHaveAttribute('data-touched', '');
      expect(trigger).toHaveAttribute('data-touched', '');
    });

    it('[data-dirty]', async () => {
      const { user } = renderUser(() => (
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <SelectPortal />
          </Combobox.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).not.toHaveAttribute('data-dirty');
      expect(trigger).not.toHaveAttribute('data-dirty');

      await user.click(input);
      await flushMicrotasks();

      const option = screen.getByRole('option', { name: 'Option 1' });

      await user.keyboard('{ArrowDown}');
      await user.click(option);
      await flushMicrotasks();

      expect(input).toHaveAttribute('data-dirty', '');
      expect(trigger).toHaveAttribute('data-dirty', '');
    });

    it('removes [data-dirty] in multiple mode after returning to the initial value', async () => {
      const { user } = renderUser(() => (
        <Field.Root>
          <Combobox.Root multiple defaultOpen defaultValue={['a']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <ABPortal />
          </Combobox.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');
      const optionB = screen.getByRole('option', { name: 'b' });

      expect(input).not.toHaveAttribute('data-dirty');
      expect(trigger).not.toHaveAttribute('data-dirty');

      await user.click(optionB);

      await waitFor(() => expect(input).toHaveAttribute('data-dirty', ''));
      await waitFor(() => expect(trigger).toHaveAttribute('data-dirty', ''));

      await user.click(optionB);

      await waitFor(() => expect(input).not.toHaveAttribute('data-dirty'));
      await waitFor(() => expect(trigger).not.toHaveAttribute('data-dirty'));
    });

    it('removes [data-dirty] when an equal object value is reselected (different reference)', async () => {
      const options = [
        { id: 'a', label: 'a' },
        { id: 'b', label: 'b' },
      ];

      const { user } = renderUser(() => (
        <Field.Root>
          <Combobox.Root
            multiple
            defaultOpen
            items={options}
            defaultValue={[{ id: 'a', label: 'a' }]}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.id}
            isItemEqualToValue={(item, value) => item.id === value.id}
          >
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: { id: string; label: string }) => (
                      <Combobox.Item value={item}>{item.label}</Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('data-dirty');

      await user.click(screen.getByRole('option', { name: 'a' }));

      await waitFor(() => expect(trigger).toHaveAttribute('data-dirty', ''));

      await user.click(screen.getByRole('option', { name: 'a' }));

      await waitFor(() => expect(trigger).not.toHaveAttribute('data-dirty'));
    });

    it('keeps [data-dirty] when the same values are reselected in a different order', async () => {
      const { user } = renderUser(() => (
        <Field.Root>
          <Combobox.Root multiple defaultOpen defaultValue={['a', 'b']}>
            <Combobox.Trigger data-testid="trigger" />
            <ABPortal />
          </Combobox.Root>
        </Field.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('data-dirty');

      await user.click(screen.getByRole('option', { name: 'a' }));
      await waitFor(() => expect(trigger).toHaveAttribute('data-dirty', ''));

      await user.click(screen.getByRole('option', { name: 'a' }));
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('data-dirty', '');
    });

    describe('[data-filled]', () => {
      it('adds [data-filled] attribute when filled', async () => {
        const { user } = renderUser(() => (
          <Field.Root>
            <Combobox.Root>
              <Combobox.Input data-testid="input" />
              <Combobox.Trigger data-testid="trigger" />
              <SelectPortal />
            </Combobox.Root>
          </Field.Root>
        ));

        const input = screen.getByTestId('input');
        const trigger = screen.getByTestId('trigger');

        expect(input).not.toHaveAttribute('data-filled');
        expect(trigger).not.toHaveAttribute('data-filled');

        await user.click(input);
        await flushMicrotasks();

        const option = screen.getByRole('option', { name: 'Option 1' });

        await user.keyboard('{ArrowDown}');
        await user.click(option);
        await flushMicrotasks();

        expect(input).toHaveAttribute('data-filled', '');
        expect(trigger).toHaveAttribute('data-filled', '');

        await user.click(input);

        await flushMicrotasks();

        const listbox = screen.getByRole('listbox');

        expect(listbox).not.toHaveAttribute('data-filled');
      });

      it('adds [data-filled] attribute when already filled', async () => {
        render(() => (
          <Field.Root>
            <Combobox.Root defaultValue="1">
              <Combobox.Input data-testid="input" />
              <Combobox.Trigger data-testid="trigger" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="1">Option 1</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
        ));

        await flushMicrotasks();
        expect(screen.getByTestId('input')).toHaveAttribute('data-filled');
        expect(screen.getByTestId('trigger')).toHaveAttribute('data-filled');
      });
    });

    it('[data-focused]', async () => {
      render(() => (
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <SelectPortal />
          </Combobox.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).not.toHaveAttribute('data-focused');
      expect(trigger).not.toHaveAttribute('data-focused');

      fireEvent.focus(input);
      flush();

      expect(input).toHaveAttribute('data-focused', '');
      expect(trigger).toHaveAttribute('data-focused', '');

      fireEvent.blur(input);
      flush();

      expect(input).not.toHaveAttribute('data-focused');
      expect(trigger).not.toHaveAttribute('data-focused');
    });
    describe('[data-focused] without a blur event', () => {
      function Comboboxes(props: { firstMounted?: boolean; firstDisabled?: boolean }) {
        return (
          <Field.Root data-testid="field">
            <Show when={props.firstMounted ?? true}>
              <Combobox.Root disabled={props.firstDisabled ?? false}>
                <Combobox.Input data-testid="first" />
              </Combobox.Root>
            </Show>
          </Field.Root>
        );
      }

      it('is removed when the focused input becomes disabled', async () => {
        const { setProps } = renderWithProps(
          Comboboxes,
          {} as {
            firstMounted?: boolean;
            firstDisabled?: boolean;
          },
        );

        const input = screen.getByTestId('first');
        input.focus();
        flush();

        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ firstDisabled: true });

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
        expect(input).not.toHaveAttribute('data-focused');
      });

      it('is removed when the focused input unmounts', async () => {
        const { setProps } = renderWithProps(
          Comboboxes,
          {} as {
            firstMounted?: boolean;
            firstDisabled?: boolean;
          },
        );

        screen.getByTestId('first').focus();
        flush();

        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ firstMounted: false });

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
      });

      function Triggers(props: { disabled?: boolean; mounted?: boolean }) {
        return (
          <Field.Root data-testid="field">
            <Combobox.Root disabled={props.disabled ?? false}>
              <Show when={props.mounted ?? true}>
                <Combobox.Trigger data-testid="trigger" />
              </Show>
            </Combobox.Root>
          </Field.Root>
        );
      }

      it('is removed when the focused trigger becomes disabled', async () => {
        const { setProps } = renderWithProps(
          Triggers,
          {} as {
            disabled?: boolean;
            mounted?: boolean;
          },
        );

        const trigger = screen.getByTestId('trigger');
        trigger.focus();
        flush();

        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ disabled: true });

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
        expect(trigger).not.toHaveAttribute('data-focused');
      });

      it('is removed when the focused trigger unmounts', async () => {
        const { setProps } = renderWithProps(
          Triggers,
          {} as {
            disabled?: boolean;
            mounted?: boolean;
          },
        );

        screen.getByTestId('trigger').focus();
        flush();

        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

        await setProps({ mounted: false });

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
      });
    });

    function OptionOnePortal() {
      return (
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="1">Option 1</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      );
    }

    it('does not mark as touched when focus moves into the popup', async () => {
      const validateSpy = vi.fn(() => 'error');

      render(() => (
        <>
          <Field.Root validationMode="onBlur" validate={validateSpy}>
            <Combobox.Root>
              <Combobox.Trigger data-testid="trigger" />
              <OptionOnePortal />
            </Combobox.Root>
          </Field.Root>
          <button data-testid="outside">Outside</button>
        </>
      ));

      const trigger = screen.getByTestId('trigger');

      fireEvent.focus(trigger);
      fireEvent.click(trigger);
      flush();

      await flushMicrotasks();

      const popup = screen.getByRole('dialog');

      fireEvent.blur(trigger, { relatedTarget: popup });
      fireEvent.focus(popup);
      flush();

      await flushMicrotasks();

      expect(validateSpy.mock.calls.length).toBe(0);
      expect(trigger).toHaveAttribute('data-focused', '');
      expect(trigger).not.toHaveAttribute('data-touched');
      expect(trigger).not.toHaveAttribute('aria-invalid');
    });

    it('validates when the popup is blurred', async () => {
      const validateSpy = vi.fn(() => 'error');

      const { user } = renderUser(() => (
        <>
          <Field.Root validationMode="onBlur" validate={validateSpy}>
            <Combobox.Root>
              <Combobox.Trigger data-testid="trigger" />
              <OptionOnePortal />
            </Combobox.Root>
          </Field.Root>
          <button data-testid="outside">Outside</button>
        </>
      ));

      const trigger = screen.getByTestId('trigger');
      const outside = screen.getByTestId('outside');

      fireEvent.focus(trigger);
      fireEvent.click(trigger);
      flush();

      await flushMicrotasks();

      const popup = screen.getByRole('dialog');

      fireEvent.blur(trigger, { relatedTarget: popup });
      popup.focus();
      flush();
      await flushMicrotasks();

      // Upstream dispatches a synthetic `blur` on the popup. The focus manager treats a `focusout`
      // from inside the floating element as staying in the component tree until the next task
      // (floating-ui#3060), so move focus out for real by tabbing past the popup instead.
      await user.tab();
      expect(outside).toHaveFocus();

      await waitFor(() => {
        expect(validateSpy.mock.calls.length).toBe(1);
      });
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-touched', '');
      });
      expect(trigger).not.toHaveAttribute('data-focused');
      expect(trigger).toHaveAttribute('aria-invalid', 'true');
    });

    it('[data-invalid]', async () => {
      render(() => (
        <Field.Root invalid>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <OptionOnePortal />
          </Combobox.Root>
        </Field.Root>
      ));

      expect(screen.getByTestId('input')).toHaveAttribute('data-invalid', '');
      expect(screen.getByTestId('trigger')).toHaveAttribute('data-invalid', '');
    });

    it('[data-valid]', async () => {
      const { user } = renderUser(() => (
        <Field.Root validationMode="onBlur">
          <Combobox.Root>
            <Combobox.Input data-testid="input" required />
            <Combobox.Trigger data-testid="trigger" />
            <OptionOnePortal />
          </Combobox.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).not.toHaveAttribute('data-valid');
      expect(input).not.toHaveAttribute('data-invalid');
      expect(trigger).not.toHaveAttribute('data-valid');
      expect(trigger).not.toHaveAttribute('data-invalid');

      fireEvent.focus(input);
      await user.click(input);
      const option = await screen.findByRole('option', { name: 'Option 1' });

      await user.click(option);
      fireEvent.blur(input);
      flush();

      await waitFor(() => expect(input).toHaveAttribute('data-valid', ''));
      expect(trigger).toHaveAttribute('data-valid', '');
      expect(input).not.toHaveAttribute('data-invalid');
      expect(trigger).not.toHaveAttribute('data-invalid');
    });

    it('prop: validate', async () => {
      render(() => (
        <Field.Root validationMode="onBlur" validate={() => 'error'}>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner />
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('aria-invalid');

      fireEvent.focus(input);
      fireEvent.blur(input);
      flush();

      await flushMicrotasks();

      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('passes raw value to validate when itemToStringValue is provided', async () => {
      const items = [
        { code: 'US', label: 'United States' },
        { code: 'CA', label: 'Canada' },
      ];
      const validateSpy = vi.fn((value: unknown) => {
        expect(value).toBe(items[0]);
        return 'error';
      });

      render(() => (
        <Field.Root validationMode="onBlur" validate={validateSpy}>
          <Combobox.Root
            items={items}
            defaultValue={items[0]}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.code}
          >
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner />
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');

      fireEvent.focus(input);
      fireEvent.blur(input);
      flush();

      await waitFor(() => {
        expect(validateSpy.mock.calls.length).toBe(1);
      });
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validationMode=onSubmit', async () => {
      const { user } = renderUser(() => (
        <Form>
          <Field.Root validate={(val) => (val === 'a' ? 'error' : null)}>
            <Combobox.Root required>
              <Combobox.Input data-testid="input" />
              <Combobox.Clear data-testid="clear" keepMounted />
              <ABPortal />
            </Combobox.Root>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const input = screen.getByTestId('input');
      expect(input).not.toHaveAttribute('aria-invalid');

      await user.click(screen.getByText('submit'));
      expect(input).toHaveAttribute('aria-invalid', 'true');

      await user.click(input);

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      await flushMicrotasks();

      expect(input).not.toHaveAttribute('aria-invalid');

      const clear = screen.getByTestId('clear');
      await user.click(clear);

      expect(document.activeElement).toBe(input);
      await user.keyboard('{Tab}');
      await flushMicrotasks();

      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validationMode=onChange', async () => {
      const { user } = renderUser(() => (
        <Field.Root
          validationMode="onChange"
          validate={(value) => (value === '1' ? 'error' : null)}
        >
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <OptionOnePortal />
          </Combobox.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('aria-invalid');

      await user.click(input);

      await flushMicrotasks();

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      await flushMicrotasks();

      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validationMode=onBlur', async () => {
      const { user } = renderUser(() => (
        <Field.Root validationMode="onBlur" validate={(value) => (value === '1' ? 'error' : null)}>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <OptionOnePortal />
          </Combobox.Root>
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('aria-invalid');

      await user.click(input);

      await flushMicrotasks();

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      await flushMicrotasks();

      // Selecting an item must not validate until the input is blurred.
      expect(input).not.toHaveAttribute('aria-invalid');

      fireEvent.blur(input);
      flush();

      await flushMicrotasks();

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('Field.Label', async () => {
      render(() => (
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner />
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Label data-testid="label" nativeLabel={false} render="span" />
        </Field.Root>
      ));

      await flushMicrotasks();
      expect(screen.getByTestId('input')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );
    });

    it('Combobox.Label does not label Combobox.Input and warns when input is the form control', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(() => (
        <Combobox.Root>
          <Combobox.Label data-testid="label" />
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await waitFor(() => {
        expect(errorSpy.mock.calls.length).toBe(1);
      });

      expect(errorSpy.mock.calls[0][0]).toContain(
        'Base UI: <Combobox.Label> labels <Combobox.Trigger> only.',
      );
      expect(screen.getByTestId('input')).not.toHaveAttribute('aria-labelledby');
      errorSpy.mockRestore();
    });

    it('does not set fallback aria-labelledby when no label is rendered', async () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Input data-testid="input" aria-label="Search" />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await flushMicrotasks();
      expect(screen.getByTestId('input')).not.toHaveAttribute('aria-labelledby');
    });

    it('updates Combobox.Label linkage when root id changes', async () => {
      const { setProps } = renderWithProps(
        (props: { id: string }) => (
          <Combobox.Root id={props.id}>
            <Combobox.Label data-testid="label">Food</Combobox.Label>
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ),
        { id: 'first' },
      );

      await setProps({ id: 'second' });

      const trigger = screen.getByTestId('trigger');

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-labelledby', 'second-label');
      });
      expect(trigger).toHaveAttribute('id', 'second');
      expect(screen.getByTestId('label')).toHaveAttribute('id', 'second-label');
    });

    it('Field.Description', async () => {
      render(() => (
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" aria-describedby="external-description" />
            <Combobox.Portal>
              <Combobox.Positioner />
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Description data-testid="description" />
        </Field.Root>
      ));

      await flushMicrotasks();
      expect(screen.getByTestId('input')).toHaveAttribute(
        'aria-describedby',
        `external-description ${screen.getByTestId('description').id}`,
      );
    });
  });
  describe('prop: isItemEqualToValue', () => {
    interface User {
      id: number;
      name: string;
      source?: string;
    }

    function UsersPortal() {
      return (
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: User) => <Combobox.Item value={item}>{item.name}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      );
    }

    it('matches object values using the provided comparator', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      render(() => (
        <Combobox.Root
          items={users}
          value={{ id: 2, name: 'Bob' }}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) => item.id === value.id}
          defaultOpen
        >
          <Combobox.Input data-testid="input" />
          <span data-testid="value">
            <Combobox.Value />
          </span>
          <UsersPortal />
        </Combobox.Root>
      ));

      expect(screen.getByTestId('value')).toHaveTextContent('Bob');
      expect(screen.getByRole('option', { name: 'Bob' })).toHaveAttribute('aria-selected', 'true');
    });

    it('properly deselects object values using the provided comparator', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      render(() => (
        <Combobox.Root
          items={users}
          defaultValue={[{ id: 2, name: 'Bob' }]}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) => item.id === value.id}
          defaultOpen
          multiple
        >
          <Combobox.Input data-testid="input" />
          <span data-testid="value">
            <Combobox.Value />
          </span>
          <UsersPortal />
        </Combobox.Root>
      ));

      const option = screen.getByRole('option', { name: 'Bob' });

      fireEvent.click(option);
      flush();

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Bob' })).toHaveAttribute(
          'aria-selected',
          'false',
        );
      });
    });

    it('passes item as the first comparator argument in multiple mode', async () => {
      const users = [
        { id: 1, name: 'Alice', source: 'item' },
        { id: 2, name: 'Bob', source: 'item' },
      ];

      render(() => (
        <Combobox.Root
          items={users}
          defaultValue={[{ id: 2, name: 'Bob', source: 'selected' }]}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) =>
            item.id === value.id && item.source === 'item' && value.source === 'selected'
          }
          defaultOpen
          multiple
        >
          <Combobox.Input data-testid="input" />
          <UsersPortal />
        </Combobox.Root>
      ));

      const option = screen.getByRole('option', { name: 'Bob' });
      expect(option).toHaveAttribute('aria-selected', 'true');

      fireEvent.click(option);
      flush();

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Bob' })).toHaveAttribute(
          'aria-selected',
          'false',
        );
      });
    });

    it('does not call comparator with null when clearing the value', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      const compare = vi.fn((item: any, value: any) => {
        if (value == null) {
          throw new Error('Compared against null');
        }
        return item.id === value.id;
      });

      let hiddenInput: HTMLInputElement | undefined;

      const { user } = renderUser(() => (
        <Combobox.Root
          items={users}
          defaultValue={users[0]}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={compare}
          inputRef={(element) => {
            hiddenInput = element;
          }}
        >
          <Combobox.Trigger>
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Clear data-testid="clear" keepMounted />
          <UsersPortal />
        </Combobox.Root>
      ));

      const clear = await screen.findByTestId('clear');
      await user.click(clear);

      await waitFor(() => {
        expect(hiddenInput?.value ?? '').toBe('');
      });

      expect(compare.mock.calls.length).toBeGreaterThan(0);
      compare.mock.calls.forEach((call) => {
        expect(call[1]).not.toBe(null);
      });
    });

    interface Country {
      code: string;
      label: string;
    }

    const loadedItems: Country[] = [
      { code: 'ca', label: 'Canada' },
      { code: 'us', label: 'United States' },
    ];

    it('does not call comparator with undefined when items load asynchronously after opening', async () => {
      const compare = vi.fn((item: Country, value: Country) => {
        if (item == null || value == null) {
          throw new Error('Compared against undefined');
        }
        return item.code === value.code;
      });

      const handleInputValueChange = vi.fn();
      const handleValueChange = vi.fn();

      const { user, setProps } = renderWithProps(
        (props: { items: Country[] | undefined }) => (
          <Combobox.Root
            items={props.items}
            value={loadedItems[0]}
            inputValue=""
            onInputValueChange={handleInputValueChange}
            onValueChange={handleValueChange}
            itemToStringLabel={(item: Country) => item.label}
            isItemEqualToValue={compare}
            filter={null}
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: Country) => <Combobox.Item value={item}>{item.label}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ),
        { items: undefined as Country[] | undefined },
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      await setProps({ items: loadedItems });

      const canada = await screen.findByRole('option', { name: 'Canada' });
      fireEvent.mouseMove(canada, { pointerType: 'mouse' });
      flush();
      await waitFor(() => expect(canada).toHaveAttribute('data-highlighted'));
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'United States' })).toHaveAttribute(
          'data-highlighted',
        );
      });

      expect(compare.mock.calls.length).toBeGreaterThan(0);
      compare.mock.calls.forEach((call) => {
        expect(call[0]).not.toBe(null);
        expect(call[0]).not.toBe(undefined);
        expect(call[1]).not.toBe(null);
        expect(call[1]).not.toBe(undefined);
      });
    });

    it('keeps showing items after selecting in controlled input-inside-popup async load flow', async () => {
      function AsyncControlledCombobox(props: { countries: Country[] | undefined }) {
        const [country, setCountry] = createSignal<Country | null>(null);
        const [inputValue, setInputValue] = createSignal('');

        return (
          <Combobox.Root
            items={props.countries}
            filter={null}
            value={country()}
            inputValue={inputValue()}
            onInputValueChange={(next) => setInputValue(next)}
            isItemEqualToValue={(item, selected) => item?.code === selected?.code}
            onValueChange={(value) => {
              if (country()?.code === value?.code) {
                setCountry(null);
              } else {
                setCountry(value);
              }
            }}
          >
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input />
                  <Combobox.Empty data-testid="empty">No countries found.</Combobox.Empty>
                  <Combobox.List>
                    {(item: Country) => <Combobox.Item value={item}>{item.label}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      const { user, setProps } = renderWithProps(AsyncControlledCombobox, {
        countries: undefined as Country[] | undefined,
      });

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await setProps({ countries: loadedItems });

      const canada = await screen.findByRole('option', { name: 'Canada' });
      fireEvent.mouseMove(canada, { pointerType: 'mouse' });
      flush();
      await waitFor(() => expect(canada).toHaveAttribute('data-highlighted'));

      await user.click(canada);
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));

      await user.click(trigger);

      await screen.findByRole('option', { name: 'Canada' });
      expect(screen.getByRole('option', { name: 'United States' })).toBeInTheDocument();
    });
  });

  function FruitList(props: { highlightItemOnHover?: boolean; loopFocus?: boolean }) {
    return (
      <Combobox.Root
        items={['apple', 'banana', 'cherry']}
        highlightItemOnHover={props.highlightItemOnHover}
        loopFocus={props.loopFocus}
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
    );
  }

  describe('prop: highlightItemOnHover', () => {
    it('highlights an item on mouse move by default', async () => {
      const { user } = renderUser(() => <FruitList />);

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);

      const banana = screen.getByRole('option', { name: 'banana' });
      fireEvent.mouseMove(banana, { pointerType: 'mouse' });
      flush();

      await waitFor(() => expect(banana).toHaveAttribute('data-highlighted'));
      expect(input.getAttribute('aria-activedescendant')).toBe(banana.id);
    });

    it('does not highlight items from mouse movement when disabled', async () => {
      const { user } = renderUser(() => <FruitList highlightItemOnHover={false} />);

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);

      const banana = screen.getByRole('option', { name: 'banana' });
      fireEvent.mouseMove(banana, { pointerType: 'mouse' });
      flush();

      await waitFor(() => expect(input).not.toHaveAttribute('aria-activedescendant'));
      expect(banana).not.toHaveAttribute('data-highlighted');
    });
  });

  describe('prop: loopFocus', () => {
    async function openWith(key: string, loopFocus?: boolean) {
      const result = renderUser(() => <FruitList loopFocus={loopFocus} />);
      const input = screen.getByRole<HTMLInputElement>('combobox');
      input.focus();
      flush();
      await flushMicrotasks();
      await result.user.keyboard(key);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      return { ...result, input, options: screen.getAllByRole('option') };
    }

    it('loops focus from last to first item with ArrowDown by default', async () => {
      const { user, input, options } = await openWith('{ArrowUp}');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[2].id);
      });

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(input).not.toHaveAttribute('aria-activedescendant'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
      });
    });

    it('loops focus from first to last item with ArrowUp by default', async () => {
      const { user, input, options } = await openWith('{ArrowDown}');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
      });

      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(input).not.toHaveAttribute('aria-activedescendant'));

      await user.keyboard('{ArrowUp}');
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[2].id);
      });
    });

    it('does not loop focus from last to first with ArrowDown when loopFocus={false}', async () => {
      const { user, input, options } = await openWith('{ArrowUp}', false);

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[2].id);
      });

      await user.keyboard('{ArrowDown}');
      await flushMicrotasks();
      expect(input).toHaveAttribute('aria-activedescendant', options[2].id);
    });

    it('does not loop focus from first to last with ArrowUp when loopFocus={false}', async () => {
      const { user, input, options } = await openWith('{ArrowDown}', false);

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
      });

      await user.keyboard('{ArrowUp}');
      await flushMicrotasks();
      expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
    });
  });
  describe('coverage edge cases', () => {
    it('allows an attempted open to be canceled', async () => {
      const onOpenChange = vi.fn((_open: boolean, details: Combobox.Root.ChangeEventDetails) => {
        details.cancel();
      });
      const { user } = renderUser(() => (
        <Combobox.Root onOpenChange={onOpenChange}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await user.click(screen.getByRole('combobox'));
      await flushMicrotasks();

      expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything());
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('handles closing after a changed query is cleared', async () => {
      const { user } = renderUser(() => (
        <Combobox.Root defaultOpen items={['apple']}>
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
      await user.type(input, 'a');
      await user.clear(input);
      await user.keyboard('{Escape}');
      await flushMicrotasks();

      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('clears a multiple inline query on close', async () => {
      const { user } = renderUser(() => (
        <Combobox.Root multiple inline open items={['apple']}>
          <Combobox.Input data-testid="inline-input" />
          <Combobox.Trigger>Toggle</Combobox.Trigger>
          <Combobox.List>
            {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
          </Combobox.List>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('inline-input');
      await user.type(input, 'a');
      fireEvent.click(screen.getByText('Toggle'));
      flush();

      expect(input).toHaveValue('');
    });

    it('normalizes a controlled null value when selecting in multiple mode', async () => {
      const onValueChange = vi.fn();
      render(() => (
        <Combobox.Root multiple value={null as never} defaultOpen onValueChange={onValueChange}>
          <Combobox.Input />
          <Combobox.List>
            <Combobox.Item value="apple">apple</Combobox.Item>
          </Combobox.List>
        </Combobox.Root>
      ));

      fireEvent.click(screen.getByRole('option', { name: 'apple' }));
      flush();

      expect(onValueChange).toHaveBeenCalledWith(['apple'], expect.anything());
    });

    it('normalizes a controlled null value while closed in multiple mode', async () => {
      render(() => (
        <Combobox.Root multiple value={null as never} items={['apple']}>
          <Combobox.Input />
          <SelectedIndexProbe />
        </Combobox.Root>
      ));

      await flushMicrotasks();
      expect(screen.getByTestId('selected-index')).toHaveTextContent('null');
    });

    it('does not seed an initial highlight for an unmatched inline value', async () => {
      render(() => (
        <Combobox.Root inline open defaultValue="missing" items={['apple']}>
          <Combobox.Input />
          <SelectedIndexProbe />
          <Combobox.List>
            {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
          </Combobox.List>
        </Combobox.Root>
      ));

      await flushMicrotasks();
      expect(screen.getByTestId('selected-index')).toHaveTextContent('null');
    });

    it('seeds the initial highlight for a matched inline value', async () => {
      render(() => (
        <Combobox.Root inline open defaultValue="apple" items={['apple']}>
          <Combobox.Input />
          <SelectedIndexProbe />
          <Combobox.List>
            {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
          </Combobox.List>
        </Combobox.Root>
      ));

      await flushMicrotasks();
      expect(screen.getByTestId('selected-index')).toHaveTextContent('0');
    });

    it('restores the first highlight after an always-highlighted query becomes empty', async () => {
      const { user } = renderUser(() => (
        <Autocomplete.Root defaultOpen autoHighlight="always" items={['apple']}>
          <Autocomplete.Input />
          <Autocomplete.List>
            {(item: string) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>}
          </Autocomplete.List>
        </Autocomplete.Root>
      ));

      const input = screen.getByRole('combobox');
      await user.type(input, 'z');
      await flushMicrotasks();
      expect(screen.queryByRole('option')).toBe(null);

      await user.clear(input);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'apple' })).toHaveAttribute('data-highlighted');
      });
    });

    it('omits groups with no matching items', async () => {
      const items = [
        { value: 'fruit', items: ['apple'] },
        { value: 'vegetables', items: ['broccoli'] },
      ];
      const { user } = renderUser(() => (
        <Combobox.Root defaultOpen items={items}>
          <Combobox.Input />
          <Combobox.List>
            {(group: { value: string; items: string[] }) => (
              <Combobox.Group items={group.items}>
                <Combobox.GroupLabel>{group.value}</Combobox.GroupLabel>
                <Combobox.Collection>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.Collection>
              </Combobox.Group>
            )}
          </Combobox.List>
        </Combobox.Root>
      ));

      await user.type(screen.getByRole('combobox'), 'app');
      await flushMicrotasks();

      expect(screen.getByText('fruit')).not.toBe(null);
      expect(screen.queryByText('vegetables')).toBe(null);
    });

    it('exposes an unmount action that is ignored while open', async () => {
      const actionsRef: { current: Combobox.Root.Actions | null } = { current: null };
      const onOpenChangeComplete = vi.fn();
      render(() => (
        <Combobox.Root
          defaultOpen
          actionsRef={actionsRef}
          onOpenChangeComplete={onOpenChangeComplete}
        >
          <Combobox.Input />
        </Combobox.Root>
      ));

      actionsRef.current?.unmount();
      flush();
      await flushMicrotasks();

      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    });

    it('moves focus from the hidden control to an external input', async () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Input data-testid="visible-input" />
        </Combobox.Root>
      ));
      const visibleInput = screen.getByTestId('visible-input');
      const hiddenInput = getHiddenControl();

      fireEvent.focus(hiddenInput);

      expect(visibleInput).toHaveFocus();
    });

    it('falls back to the trigger when the hidden control is focused', async () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
        </Combobox.Root>
      ));
      const hiddenInput = getHiddenControl();

      fireEvent.focus(hiddenInput);

      expect(screen.getByTestId('trigger')).toHaveFocus();
    });

    it('falls back to the trigger after an external input unmounts', async () => {
      const { setProps } = renderWithProps(
        (props: { showInput: boolean }) => (
          <Combobox.Root>
            <Show
              when={props.showInput}
              fallback={<Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>}
            >
              <Combobox.Input />
            </Show>
          </Combobox.Root>
        ),
        { showInput: true },
      );
      await setProps({ showInput: false });

      fireEvent.focus(getHiddenControl());

      expect(screen.getByTestId('trigger')).toHaveFocus();
    });

    it('moves hidden-control focus to the trigger when the input is inside the popup', async () => {
      render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
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

      fireEvent.focus(getHiddenControl());

      expect(screen.getByTestId('trigger')).toHaveFocus();
    });

    it('safely handles hidden-control focus without a visible control', async () => {
      render(() => <Combobox.Root />);
      const hiddenInput = getHiddenControl();

      fireEvent.focus(hiddenInput);

      expect(document.body).toHaveFocus();
    });

    it('ignores scalar browser autofill in multiple mode', async () => {
      const onValueChange = vi.fn();
      render(() => (
        <Combobox.Root multiple items={['apple']} onValueChange={onValueChange}>
          <Combobox.Input data-testid="visible-input" />
        </Combobox.Root>
      ));
      const hiddenInput = getHiddenControl();

      fireEvent.change(hiddenInput, { target: { value: 'apple' } });
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('ignores unmatched browser autofill in single mode', async () => {
      const onValueChange = vi.fn();
      render(() => (
        <Combobox.Root name="fruit" items={['apple']} onValueChange={onValueChange}>
          <Combobox.Input />
        </Combobox.Root>
      ));
      const hiddenInput = screen
        .getAllByDisplayValue('')
        .find((element) => element.getAttribute('name') === 'fruit')!;

      fireEvent.change(hiddenInput, { target: { value: 'orange' } });
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
    });

    function AutocompleteWithSubmit() {
      return (
        <Autocomplete.Root defaultOpen submitOnItemClick>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="apple">apple</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      );
    }

    it('does not request form submission when no form owns the autocomplete', async () => {
      render(() => <AutocompleteWithSubmit />);

      fireEvent.click(screen.getByRole('option', { name: 'apple' }));
      flush();
      expect(screen.getByRole('combobox')).toHaveValue('apple');
    });

    it('does not request form submission when requestSubmit is unavailable', async () => {
      render(() => (
        <form aria-label="search">
          <AutocompleteWithSubmit />
        </form>
      ));
      const form = screen.getByRole('form', { name: 'search' });
      Object.defineProperty(form, 'requestSubmit', { configurable: true, value: undefined });

      fireEvent.click(screen.getByRole('option', { name: 'apple' }));
      flush();
      expect(screen.getByRole('combobox')).toHaveValue('apple');
    });

    it('validates the autocomplete input when focus leaves its popup', async () => {
      const validate = vi.fn();
      const { user } = renderUser(() => (
        <Field.Root validationMode="onBlur" validate={validate}>
          <Autocomplete.Root defaultOpen defaultValue="query">
            <Autocomplete.Trigger>Open</Autocomplete.Trigger>
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.Input />
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>
      ));

      await flushMicrotasks();
      await user.click(document.body);

      await waitFor(() => {
        expect(validate).toHaveBeenCalledWith('query', expect.anything());
      });
    });
  });

  describe('within Composite', () => {
    it('should navigate between combobox and composite items', async () => {
      const { user } = renderUser(() => (
        <CompositeRoot orientation="horizontal">
          <CompositeItem tag="button">Item 1</CompositeItem>
          <CompositeItem tag="button">Item 2</CompositeItem>
          <Combobox.Root>
            <Combobox.Input render={(props) => <CompositeItem tag="input" props={[props]} />} />
          </Combobox.Root>
        </CompositeRoot>
      ));

      const input = screen.getByRole('combobox');
      await user.click(input);
      await flushMicrotasks();

      await user.keyboard('{ArrowLeft}');
      const button2 = screen.getByRole('button', { name: 'Item 2' });
      expect(button2).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(input).toHaveFocus();
    });
  });
});
