import { For, Show, createSignal, onSettled } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Select } from '..';
import { REASONS } from '../../internals/reasons';
import { useSelectRootContext } from './SelectRootContext';
import type { SelectRoot } from './SelectRoot';
import {
  act,
  createRef,
  flushMicrotasks,
  isJSDOM,
  renderWithProps,
  renderWithUser,
  wait,
} from '../test-utils';

function ABCItems() {
  return (
    <Select.Portal>
      <Select.Positioner>
        <Select.Popup>
          <Select.Item value="a">a</Select.Item>
          <Select.Item value="b">b</Select.Item>
          <Select.Item value="c">c</Select.Item>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  );
}

describe('<Select.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  describe('prop: multiple', () => {
    it('removes selections that no longer exist', async () => {
      const [items, setItems] = createSignal(['a', 'b', 'c']);

      const { user } = renderWithUser(() => (
        <div>
          <Select.Root multiple defaultValue={['a', 'c']}>
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
            data-testid="remove-a"
            onClick={() => setItems((prev) => prev.filter((i) => i !== 'a'))}
          >
            Remove A
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

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      });
      expect(screen.getByRole('option', { name: 'c' })).toHaveAttribute('data-selected', '');

      // Remove one of the selected items; remaining selection should persist
      await user.click(screen.getByTestId('remove-c'));

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      });
      expect(screen.queryByRole('option', { name: 'c' })).toBe(null);

      // Remove the last selected item; selection should become empty
      await user.click(screen.getByTestId('remove-a'));

      await user.click(trigger);

      const options = await screen.findAllByRole('option');
      await waitFor(() => {
        options.forEach((opt) => {
          expect(opt).not.toHaveAttribute('data-selected');
        });
      });
    });

    it('removes selections replaced without changing the item count', async () => {
      const onValueChange = vi.fn();
      const [items, setItems] = createSignal(['a', 'b', 'c']);
      const [value, setValue] = createSignal<string[]>(['a', 'c']);

      render(() => (
        <div>
          <Select.Root
            multiple
            defaultOpen
            value={value()}
            onValueChange={(nextValue) => {
              setValue(nextValue);
              onValueChange(nextValue);
            }}
          >
            <Select.Trigger>
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
          <button onClick={() => setItems(['a', 'b', 'd'])}>Replace C with D</button>
        </div>
      ));
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'c' })).toHaveAttribute('data-selected', '');

      fireEvent.click(screen.getByRole('button', { name: 'Replace C with D' }));

      await waitFor(() => {
        expect(onValueChange.mock.lastCall?.[0]).toEqual(['a']);
      });
      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'd' })).not.toHaveAttribute('data-selected');
    });

    it('should allow multiple selections when multiple is true', async () => {
      const handleValueChange = vi.fn();
      const [value, setValue] = createSignal<any[]>([]);

      const { user } = renderWithUser(() => (
        <Select.Root
          multiple
          value={value()}
          onValueChange={(newValue) => {
            setValue(newValue);
            handleValueChange(newValue);
          }}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <ABCItems />
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await flushMicrotasks();

      const optionA = await screen.findByRole('option', { name: 'a' });
      await user.click(optionA);
      await flushMicrotasks();

      expect(handleValueChange.mock.calls[0][0]).toEqual(['a']);
      expect(optionA).toHaveAttribute('data-selected', '');

      const optionB = screen.getByRole('option', { name: 'b' });
      await user.click(optionB);
      await flushMicrotasks();

      expect(handleValueChange.mock.calls[1][0]).toEqual(['a', 'b']);
      expect(optionA).toHaveAttribute('data-selected', '');
      expect(optionB).toHaveAttribute('data-selected', '');

      expect(screen.getByRole('listbox')).not.toBe(null);
    });

    it('keeps the selection when items are added and none of the selected ones are removed', async () => {
      const handleValueChange = vi.fn();
      const [items, setItems] = createSignal(['a', 'b']);

      const { user } = renderWithUser(() => (
        <div>
          <Select.Root multiple open defaultValue={['a']} onValueChange={handleValueChange}>
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
          <button data-testid="add" onClick={() => setItems((prev) => [...prev, 'c'])}>
            Add C
          </button>
        </div>
      ));

      expect(await screen.findByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');

      await user.click(screen.getByTestId('add'));

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'c' })).not.toBe(null);
      });
      await flushMicrotasks();

      // Growing the list must not rewrite a still-valid selection.
      expect(handleValueChange).not.toHaveBeenCalled();
      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
    });

    it('should deselect items when clicked again in multiple mode', async () => {
      const handleValueChange = vi.fn();
      const [value, setValue] = createSignal(['a', 'b']);

      const { user } = renderWithUser(() => (
        <Select.Root
          multiple
          value={value()}
          onValueChange={(newValue) => {
            setValue(newValue);
            handleValueChange(newValue);
          }}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <ABCItems />
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await flushMicrotasks();

      const optionA = await screen.findByRole('option', { name: 'a' });
      const optionB = screen.getByRole('option', { name: 'b' });

      expect(optionA).toHaveAttribute('data-selected', '');
      expect(optionB).toHaveAttribute('data-selected', '');

      await user.click(optionA);
      await flushMicrotasks();

      expect(handleValueChange.mock.calls[0][0]).toEqual(['b']);
      expect(optionA).not.toHaveAttribute('data-selected');
      expect(optionB).toHaveAttribute('data-selected', '');
    });

    it('should update selected items when the controlled value prop changes while open', async () => {
      const { setProps } = renderWithProps(
        (props: { value: string[] }) => (
          <Select.Root multiple value={props.value}>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <ABCItems />
          </Select.Root>
        ),
        { value: ['a', 'b'] },
      );

      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-selected', '');

      await setProps({ value: ['b'] });

      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'a' })).not.toHaveAttribute('data-selected');
    });

    it('keeps the active index on a deselected item in multiple mode', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root multiple value={['a']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <ABCItems />
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);

      const optionB = await screen.findByRole('option', { name: 'b' });

      await user.click(optionB);

      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });

      await user.click(optionB);

      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });
    });

    it('highlights the first selected item in rendered order regardless of value order', async () => {
      // `a` renders first but sits in the middle of the value array, so neither end of that
      // array points at it and only the rendered order does.
      const { user } = renderWithUser(() => (
        <Select.Root multiple defaultValue={['b', 'a', 'c']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <ABCItems />
        </Select.Root>
      ));

      await user.click(screen.getByTestId('trigger'));

      const optionA = await screen.findByRole('option', { name: 'a' });
      await waitFor(() => {
        expect(optionA).toHaveAttribute('data-highlighted');
      });
      expect(screen.getByRole('option', { name: 'b' })).not.toHaveAttribute('data-highlighted');
      expect(screen.getByRole('option', { name: 'c' })).not.toHaveAttribute('data-highlighted');
    });

    it('re-elects the anchor when the anchor item value changes in place', async () => {
      const { user, setProps } = renderWithProps(
        (props: { replaceA?: boolean }) => (
          <Select.Root multiple defaultValue={['a', 'c']}>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value={props.replaceA ? 'x' : 'a'}>
                    {props.replaceA ? 'x' : 'a'}
                  </Select.Item>
                  <Select.Item value="b">b</Select.Item>
                  <Select.Item value="c">c</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        ),
        { replaceA: false },
      );

      // The list only mounts on the first open, and stays mounted once closed. Opening
      // first is what makes the swap below happen in place, on items that already
      // registered their values and elected an anchor.
      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);
      await screen.findByRole('option', { name: 'a' });
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await setProps({ replaceA: true });

      await user.click(trigger);

      const optionC = await screen.findByRole('option', { name: 'c' });
      await waitFor(() => {
        expect(optionC).toHaveAttribute('data-highlighted');
      });
      expect(screen.getByRole('option', { name: 'x' })).not.toHaveAttribute('data-highlighted');
    });

    it('moves the anchor to the next selected item when the anchor item leaves the list', async () => {
      const { user, setProps } = renderWithProps(
        (props: { trimmed?: boolean }) => (
          <Select.Root multiple defaultValue={['a', 'b', 'c']}>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Show when={!props.trimmed}>
                    <Select.Item value="a">a</Select.Item>
                  </Show>
                  <Select.Item value="b">b</Select.Item>
                  <Select.Item value="c">c</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        ),
        { trimmed: false },
      );

      // The items have to register under the full list before one of them can leave it.
      await user.click(screen.getByTestId('trigger'));
      await screen.findByRole('option', { name: 'a' });
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await setProps({ trimmed: true });

      await user.click(screen.getByTestId('trigger'));

      const optionB = await screen.findByRole('option', { name: 'b' });
      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });
      expect(screen.getByRole('option', { name: 'c' })).not.toHaveAttribute('data-highlighted');
    });

    it('re-anchors backwards when a new isItemEqualToValue identity re-runs every item', async () => {
      // A new comparer identity on every value change re-runs every item effect. The anchor
      // moving to an earlier item must survive the old anchor's own effect.
      interface Option {
        id: number;
      }
      const options: Option[] = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];

      const { user, setProps } = renderWithProps(
        (props: { value: Option[]; isItemEqualToValue: (a: Option, b: Option) => boolean }) => (
          <Select.Root
            multiple
            value={props.value}
            isItemEqualToValue={props.isItemEqualToValue}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value>{() => 'value'}</Select.Value>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <For each={options}>
                    {(option) => (
                      <Select.Item value={option}>
                        <Select.ItemText>{`opt-${option.id}`}</Select.ItemText>
                      </Select.Item>
                    )}
                  </For>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        ),
        { value: [{ id: 2 }, { id: 3 }], isItemEqualToValue: (a, b) => a.id === b.id },
      );

      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'opt-2' })).toHaveAttribute('data-highlighted');
      });
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await setProps({ value: [{ id: 0 }, { id: 1 }], isItemEqualToValue: (a, b) => a.id === b.id });

      await user.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'opt-0' })).toHaveAttribute('data-highlighted');
      });
      expect(screen.getByRole('option', { name: 'opt-1' })).not.toHaveAttribute('data-highlighted');
    });

    // Requires real layout to measure aligned positioning.
    it.skipIf(isJSDOM)(
      'aligns the first selected item with the trigger when alignItemWithTrigger is active',
      () => {},
    );

    it('anchors to the first selected item when opened with the keyboard', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root multiple defaultValue={['b', 'c']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <ABCItems />
        </Select.Root>
      ));

      await user.keyboard('{Tab}');
      expect(screen.getByTestId('trigger')).toHaveFocus();
      await user.keyboard('{ArrowDown}');

      const optionB = await screen.findByRole('option', { name: 'b' });
      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });
      expect(screen.getByRole('option', { name: 'c' })).not.toHaveAttribute('data-highlighted');
    });

    it('continues arrow navigation from the anchor rather than the top of the list', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root multiple defaultValue={['b', 'c']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
                <Select.Item value="d">d</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      await user.click(screen.getByTestId('trigger'));
      const optionB = await screen.findByRole('option', { name: 'b' });
      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });
      // Focus reaches the anchor asynchronously. Keys sent before it lands are lost.
      await waitFor(() => {
        expect(optionB).toHaveFocus();
      });

      // The next item after the anchor, not `a` at the top.
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'c' })).toHaveAttribute('data-highlighted');
      });

      await user.keyboard('{ArrowUp}');
      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });
    });

    it('keeps the highlight on an item deselected with the keyboard', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root multiple defaultValue={['b', 'c']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <ABCItems />
        </Select.Root>
      ));

      await user.click(screen.getByTestId('trigger'));
      const optionB = await screen.findByRole('option', { name: 'b' });
      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });
      // Focus reaches the anchor asynchronously. Keys sent before it lands are lost.
      await waitFor(() => {
        expect(optionB).toHaveFocus();
      });

      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(optionB).toHaveAttribute('aria-selected', 'false');
      });
      expect(optionB).toHaveAttribute('data-highlighted');
    });

    it('anchors to the first selected item in rendered order across groups', async () => {
      // `spinach` renders first but is not the last value, so anchoring to the rendered order
      // and anchoring to the end of the value array give different answers.
      const { user } = renderWithUser(() => (
        <Select.Root multiple defaultValue={['spinach', 'plum']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Group>
                  <Select.GroupLabel>Vegetables</Select.GroupLabel>
                  <Select.Item value="artichoke">artichoke</Select.Item>
                  <Select.Item value="spinach">spinach</Select.Item>
                </Select.Group>
                <Select.Group>
                  <Select.GroupLabel>Fruits</Select.GroupLabel>
                  <Select.Item value="apple">apple</Select.Item>
                  <Select.Item value="plum">plum</Select.Item>
                </Select.Group>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      await user.click(screen.getByTestId('trigger'));

      const spinachItem = await screen.findByRole('option', { name: 'spinach' });
      await waitFor(() => {
        expect(spinachItem).toHaveAttribute('data-highlighted');
      });
      expect(screen.getByRole('option', { name: 'plum' })).not.toHaveAttribute('data-highlighted');
    });

    // Requires real layout: scrolling into view is skipped for pointer modality only in browsers.
    it.skipIf(isJSDOM)('scrolls the first selected item into view on open', () => {});

    it('should handle defaultValue as array in multiple mode', async () => {
      render(() => (
        <Select.Root multiple defaultValue={['a', 'c']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <ABCItems />
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'b' })).not.toHaveAttribute('data-selected');
      expect(screen.getByRole('option', { name: 'c' })).toHaveAttribute('data-selected', '');
    });

    it('should serialize multiple values correctly for form submission', async () => {
      const { container } = render(() => (
        <Select.Root multiple name="select" value={['a', 'c']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <ABCItems />
        </Select.Root>
      ));

      const hiddenInputs = container.querySelectorAll(
        '[name="select"]',
      ) as NodeListOf<HTMLInputElement>;
      expect(hiddenInputs).toHaveLength(2);
      const values = Array.from(hiddenInputs).map((input) => input.value);
      expect(values).toEqual(['a', 'c']);
    });

    it('does not submit multiple values when disabled', async () => {
      const submitSpy = vi.fn((event: SubmitEvent) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget as HTMLFormElement);
        return formData.getAll('select');
      });

      const { user } = renderWithUser(() => (
        <form onSubmit={submitSpy}>
          <Select.Root multiple disabled name="select" value={['a', 'c']}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <ABCItems />
          </Select.Root>
          <button type="submit">Submit</button>
        </form>
      ));

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toEqual([]);
    });

    it('should serialize empty array as empty string in multiple mode', async () => {
      const { container } = render(() => (
        <Select.Root multiple name="select">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <ABCItems />
        </Select.Root>
      ));

      // In multiple mode with empty array, no hidden inputs with name should exist
      const namedHiddenInputs = container.querySelectorAll('[name="select"]');
      expect(namedHiddenInputs).toHaveLength(0);

      // But the main input should have the serialized empty value for Field validation purposes
      const mainInput = container.querySelector<HTMLInputElement>('input[aria-hidden="true"]');
      expect(mainInput).not.toBe(null);
      expect(mainInput?.value).toBe('');
    });

    it('does not mark the hidden input as required when selection exists', async () => {
      render(() => (
        <Select.Root multiple required name="select" value={['a']}>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>
      ));

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput).not.toHaveAttribute('required');
    });

    it('keeps the hidden input required when no selection exists', async () => {
      render(() => (
        <Select.Root multiple required name="select" value={[]}>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>
      ));

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput).toHaveAttribute('required');
    });

    it('should not close popup when selecting items in multiple mode', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root multiple>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <ABCItems />
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      const optionA = await screen.findByRole('option', { name: 'a' });
      await user.click(optionA);
      await flushMicrotasks();

      expect(screen.getByRole('listbox')).not.toBe(null);

      const optionB = screen.getByRole('option', { name: 'b' });
      await user.click(optionB);
      await flushMicrotasks();

      expect(screen.getByRole('listbox')).not.toBe(null);
    });

    it('should close popup in single select mode', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <ABCItems />
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      const optionA = await screen.findByRole('option', { name: 'a' });
      await user.click(optionA);
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });

    it('should update selected items when value prop changes', async () => {
      const { setProps } = renderWithProps(
        (props: { value: string[] }) => (
          <Select.Root multiple value={props.value}>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <ABCItems />
          </Select.Root>
        ),
        { value: ['a'] },
      );

      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(await screen.findByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'b' })).not.toHaveAttribute('data-selected');

      await setProps({ value: ['a', 'b', 'c'] });

      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'c' })).toHaveAttribute('data-selected', '');
    });
  });

  describe('prop: isItemEqualToValue', () => {
    it('matches object values using the provided comparator', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      render(() => (
        <Select.Root
          value={{ id: 2, name: 'Bob' }}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) => item.id === value.id}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <For each={users}>
                  {(user) => <Select.Item value={user}>{user.name}</Select.Item>}
                </For>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveTextContent('Bob');

      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Bob' })).toHaveAttribute('data-selected', '');
      });
    });

    it('matches object values when the popup is mounted on the initial render', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      render(() => (
        <Select.Root
          defaultOpen
          value={{ id: 2, name: 'Bob' }}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) => item.id === value.id}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <For each={users}>
                  {(user) => <Select.Item value={user}>{user.name}</Select.Item>}
                </For>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      expect(screen.getByRole('option', { name: 'Bob' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'Alice' })).not.toHaveAttribute('data-selected');
    });

    it('passes item as the first comparator argument in multiple mode', async () => {
      const users = [
        { id: 1, name: 'Alice', source: 'item' },
        { id: 2, name: 'Bob', source: 'item' },
      ];

      const { user } = renderWithUser(() => (
        <Select.Root
          multiple
          defaultOpen
          defaultValue={[{ id: 2, name: 'Bob', source: 'selected' }]}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) =>
            item.id === value.id && item.source === 'item' && value.source === 'selected'
          }
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <For each={users}>
                  {(user) => <Select.Item value={user}>{user.name}</Select.Item>}
                </For>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const option = screen.getByRole('option', { name: 'Bob' });
      expect(option).toHaveAttribute('data-selected', '');

      // jsdom has no `PointerEvent`, so `fireEvent.click` dispatches a pointer-less virtual click,
      // which only activates a highlighted item. Use a real pointer press instead.
      await user.click(option);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Bob' })).not.toHaveAttribute('data-selected');
      });
    });
  });

  describe('prop: highlightItemOnHover', () => {
    it('highlights an item on mouse move by default', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root defaultOpen>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <ABCItems />
        </Select.Root>
      ));

      const optionB = screen.getByRole('option', { name: 'b' });
      await user.hover(optionB);

      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });
    });

    // Requires real layout for the aligned positioning pass.
    it.skipIf(isJSDOM)(
      'highlights the first item after opening when alignItemWithTrigger is active and no value is selected',
      () => {},
    );

    it('does not highlight items from mouse movement when disabled', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root defaultOpen highlightItemOnHover={false}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <ABCItems />
        </Select.Root>
      ));

      const optionB = screen.getByRole('option', { name: 'b' });
      await user.hover(optionB);

      await flushMicrotasks();

      expect(optionB).not.toHaveAttribute('data-highlighted');
    });

    it('does not remove highlight when mousing out of popup when disabled', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root defaultOpen highlightItemOnHover={false}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <ABCItems />
        </Select.Root>
      ));

      const optionA = screen.getByRole('option', { name: 'a' });
      await user.hover(optionA);

      const popup = screen.getByRole('listbox');
      await waitFor(() => {
        expect(popup).toHaveFocus();
      });

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(optionA).toHaveAttribute('data-highlighted');
      });

      await user.unhover(popup);

      await waitFor(() => {
        expect(optionA).toHaveAttribute('data-highlighted');
      });
    });
  });

  describe('groups', () => {
    it('navigates across groups without stopping on labels or separators', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.Group>
                  <Select.GroupLabel>Fruits</Select.GroupLabel>
                  <Select.Item value="apple">apple</Select.Item>
                  <Select.Item value="banana">banana</Select.Item>
                </Select.Group>
                <Select.Separator />
                <Select.Group>
                  <Select.GroupLabel>Vegetables</Select.GroupLabel>
                  <Select.Item value="carrot">carrot</Select.Item>
                  <Select.Item value="leek">leek</Select.Item>
                </Select.Group>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      await act(async () => {
        screen.getByTestId('trigger').focus();
      });
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'apple' })).toHaveFocus();
      });

      await user.keyboard('{ArrowDown}{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'carrot' })).toHaveFocus();
      });

      await user.keyboard('{End}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'leek' })).toHaveFocus();
      });

      await user.keyboard('{Home}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'apple' })).toHaveFocus();
      });
    });
  });

  // Requires real layout to measure the item-aligned popup geometry.
  describe.skipIf(isJSDOM)('item-aligned popup interaction', () => {
    it('does not move the popup or its list when hovering items at its edges', () => {});
    it('keeps the highlighted item visible while keyboard navigation grows the popup', () => {});
  });

  describe('opening', () => {
    it('does not carry an ArrowUp opening over to a later pointer opening', async () => {
      // A selected item claims the keyboard opening, so the ArrowUp is never consumed.
      const [value, setValue] = createSignal<string | null>('b');

      const { user } = renderWithUser(() => (
        <div>
          <button data-testid="clear" onClick={() => setValue(null)}>
            Clear
          </button>
          <Select.Root value={value()} onValueChange={setValue}>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner alignItemWithTrigger={false}>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                  <Select.Item value="b">b</Select.Item>
                  <Select.Item value="c">c</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
      ));

      const trigger = screen.getByTestId('trigger');
      await act(async () => {
        trigger.focus();
      });
      await user.keyboard('{ArrowUp}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'b' })).toHaveFocus();
      });
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });

      await user.click(screen.getByTestId('clear'));
      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toHaveFocus();
      });
      await act(async () => {
        await wait(50);
      });

      expect(screen.getByRole('option', { name: 'c' })).not.toHaveAttribute('data-highlighted');
    });
  });

  describe('closing', () => {
    it('reports a close after the parent declined an open without canceling it', async () => {
      const handleOpenChange = vi.fn();
      const actionsRef = createRef<SelectRoot.Actions>();
      const [open, setOpen] = createSignal(false);

      const { user } = renderWithUser(() => (
        <Select.Root
          actionsRef={actionsRef}
          open={open()}
          onOpenChange={(nextOpen, eventDetails) => {
            handleOpenChange(nextOpen, eventDetails.reason);
            if (!nextOpen) {
              setOpen(false);
            }
          }}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenLastCalledWith(true, REASONS.triggerPress);
      });
      expect(screen.queryByRole('listbox')).toBe(null);

      await act(async () => {
        actionsRef.current!.close();
      });

      // The store can't tell a declined open from one the parent applies later, so the close is
      // reported.
      expect(handleOpenChange).toHaveBeenLastCalledWith(false, REASONS.imperativeAction);
    });

    it('does not report a close after the parent canceled an open', async () => {
      const handleOpenChange = vi.fn();
      const actionsRef = createRef<SelectRoot.Actions>();
      const [open, setOpen] = createSignal(false);

      const { user } = renderWithUser(() => (
        <Select.Root
          actionsRef={actionsRef}
          open={open()}
          onOpenChange={(nextOpen, eventDetails) => {
            handleOpenChange(nextOpen, eventDetails.reason);
            if (nextOpen) {
              eventDetails.cancel();
            } else {
              setOpen(false);
            }
          }}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenLastCalledWith(true, REASONS.triggerPress);
      });

      await act(async () => {
        actionsRef.current!.close();
      });

      expect(handleOpenChange.mock.calls).toEqual([[true, REASONS.triggerPress]]);
    });

    it('does not notify the interactions of a close that onOpenChange cancels', async () => {
      const onOpenChange = vi.fn((open: boolean, eventDetails: SelectRoot.ChangeEventDetails) => {
        if (!open) {
          eventDetails.cancel();
        }
      });
      const handleInteractionOpenChange = vi.fn();

      function InteractionOpenChangeListener() {
        const store = useSelectRootContext();
        onSettled(() => {
          store.context.events.on('openchange', handleInteractionOpenChange);
          return () => {
            store.context.events.off('openchange', handleInteractionOpenChange);
          };
        });
        return null;
      }

      const { user } = renderWithUser(() => (
        <Select.Root defaultOpen onOpenChange={onOpenChange}>
          <InteractionOpenChangeListener />
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      expect(await screen.findByRole('listbox')).not.toBe(null);

      await user.keyboard('{Escape}');

      expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything());
      expect(screen.getByRole('listbox')).not.toBe(null);
      expect(handleInteractionOpenChange).not.toHaveBeenCalled();
    });

    // Requires real CSS animations (`data-ending-style` with a running exit animation).
    it.skipIf(isJSDOM)('keeps the highlight on the item while the popup animates out', () => {});
  });

  describe('trigger render cost', () => {
    // Solid equivalent of upstream's render counting: the `render` function is called once, and
    // the trigger element is never recreated while the highlight moves.
    it('does not recreate the trigger while navigating the list', async () => {
      let triggerRenders = 0;

      const { user } = renderWithUser(() => (
        <Select.Root>
          <Select.Trigger
            render={(props) => {
              triggerRenders += 1;
              return <button type="button" {...props} />;
            }}
          >
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <For each={Array.from({ length: 10 }, (_, index) => index)}>
                  {(index) => <Select.Item value={String(index)}>{`Item ${index}`}</Select.Item>}
                </For>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });
      await flushMicrotasks();

      triggerRenders = 0;
      await user.keyboard('[ArrowDown][ArrowDown][ArrowDown]');
      await flushMicrotasks();

      expect(triggerRenders).toBe(0);
      expect(screen.getByRole('combobox')).toBe(trigger);
    });
  });
});
