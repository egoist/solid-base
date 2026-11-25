import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { For, createSignal, flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { resetAnimationFrameScheduler } from '@egoist/solid-base-utils/animationFrame';
import { Select } from '..';
import { act, flushMicrotasks, isJSDOM, renderWithUser, wait } from '../test-utils';

describe('<Select.Item />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Select.Root open defaultValue="a">
          <Select.Item
            value="a"
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.selected ? 'item selected' : 'item')}
            style={{ color: 'red' }}
            render={(props) => <li {...props} />}
          >
            a
          </Select.Item>
        </Select.Root>
      ));
      flush();
      const item = screen.getByRole('option');
      expect(ref).toBe(item);
      expect(item.tagName).toBe('LI');
      expect(item).toHaveClass('item', 'selected');
      expect(item).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });

    it('renders a div option by default', () => {
      render(() => (
        <Select.Root open>
          <Select.Item value="a">a</Select.Item>
        </Select.Root>
      ));
      const item = screen.getByRole('option');
      expect(item).toBeInstanceOf(window.HTMLDivElement);
      expect(item).toHaveAttribute('aria-selected', 'false');
    });
  });

  it('treats a null value as an empty selection in multiple mode', async () => {
    const handleValueChange = vi.fn();

    // A controlled multiple select can legitimately be handed `null` (for example while its
    // value is still loading) instead of an array.
    const { user } = renderWithUser(() => (
      <Select.Root multiple value={null} onValueChange={handleValueChange}>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="one">one</Select.Item>
              <Select.Item value="two">two</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    await user.click(screen.getByTestId('trigger'));

    const option = await screen.findByRole('option', { name: 'one' });
    expect(option).toHaveAttribute('aria-selected', 'false');

    await user.click(option);

    expect(handleValueChange).toHaveBeenCalledWith(['one'], expect.anything());
  });

  it('keeps the selection while grouped items are reordered and inserted', async () => {
    // `useCompositeListItem({ guess: true })` guesses each index from render order and lets the
    // commit flush correct it. Grouping, reordering and late insertion all invalidate the guess,
    // so this pins that a corrected index still resolves back to the right item.
    function App() {
      const [items, setItems] = createSignal(['b', 'c']);
      const [reversed, setReversed] = createSignal(false);
      const ordered = () => (reversed() ? [...items()].reverse() : items());

      return (
        <div>
          <Select.Root open defaultValue="b">
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Group>
                    <Select.GroupLabel>Group one</Select.GroupLabel>
                    <For each={ordered()}>
                      {(itemValue) => (
                        <Select.Item value={itemValue}>
                          <Select.ItemText>{itemValue}</Select.ItemText>
                        </Select.Item>
                      )}
                    </For>
                  </Select.Group>
                  <Select.Group>
                    <Select.GroupLabel>Group two</Select.GroupLabel>
                    <Select.Item value="z">
                      <Select.ItemText>z</Select.ItemText>
                    </Select.Item>
                  </Select.Group>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <button data-testid="prepend" onClick={() => setItems((prev) => ['a', ...prev])}>
            Prepend
          </button>
          <button data-testid="reverse" onClick={() => setReversed((prev) => !prev)}>
            Reverse
          </button>
        </div>
      );
    }

    const { user } = renderWithUser(() => <App />);

    await user.click(screen.getByTestId('prepend'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'a' })).not.toBe(null);
    });

    await user.click(screen.getByTestId('reverse'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-selected');
    });

    await user.click(screen.getByTestId('reverse'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-selected');
    });
  });

  it('should select the item and close popup when clicked', async () => {
    renderWithUser(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value" />
        </Select.Trigger>
        {/* Upstream renders the item without a popup; the close transition here waits for the
            popup element to unmount the positioner. */}
        <Select.Positioner data-testid="positioner">
          <Select.Popup>
            <Select.Item value="one">one</Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Root>
    ));

    const value = screen.getByTestId('value');
    const trigger = screen.getByTestId('trigger');
    const positioner = screen.getByTestId('positioner');

    expect(value.textContent).toBe('');

    fireEvent.click(trigger);
    flush();

    await flushMicrotasks();

    fireEvent.click(screen.getByText('one'));
    flush();

    await flushMicrotasks();

    expect(value.textContent).toBe('one');

    await waitFor(() => expect(positioner).not.toBeVisible());
  });

  it.skipIf(!isJSDOM)('navigating with keyboard should focus item', async () => {
    const { user } = renderWithUser(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="one">one</Select.Item>
              <Select.Item value="two">two</Select.Item>
              <Select.Item value="three">three</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.getByRole('listbox')).not.toBe(null);
    });
    await waitFor(() => {
      expect(screen.getByText('one')).toHaveFocus();
    });

    await user.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(screen.getByText('two')).toHaveFocus();
    });

    await user.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(screen.getByText('three')).toHaveFocus();
    });
  });

  it.skipIf(!isJSDOM)('should select item when Enter key is pressed', async () => {
    const { user } = renderWithUser(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="one">one</Select.Item>
              <Select.Item value="two">two</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();
    // Items register with the list a microtask after they mount and focus moves on the next frame
    // (upstream registers synchronously): wait for them before interacting.
    await waitFor(() => expect(screen.getByRole('option', { name: 'one' })).toHaveFocus());

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByTestId('value').textContent).toBe('two');
    });
  });

  it('should focus disabled items', async () => {
    const { user } = renderWithUser(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="one">one</Select.Item>
              <Select.Item value="two" disabled>
                two
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    await act(() => screen.getByTestId('trigger').focus());
    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'one' })).toHaveFocus();
    });

    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'two' })).toHaveFocus();
    });
  });

  it('should not select disabled item', async () => {
    const handleValueChange = vi.fn();
    const { user } = renderWithUser(() => (
      <Select.Root onValueChange={handleValueChange}>
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="one">one</Select.Item>
              <Select.Item value="two" disabled>
                two
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    await user.click(screen.getByTestId('trigger'));
    await user.click(await screen.findByRole('option', { name: 'two' }));

    expect(handleValueChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('value').textContent).toBe('');
    expect(screen.getByRole('listbox')).toBeVisible();
  });

  it('should not select disabled item when Enter is pressed', async () => {
    const handleValueChange = vi.fn();
    const { user } = renderWithUser(() => (
      <Select.Root onValueChange={handleValueChange}>
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="one">one</Select.Item>
              <Select.Item value="two" disabled>
                two
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    await act(() => screen.getByTestId('trigger').focus());
    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'one' })).toHaveFocus();
    });

    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'two' })).toHaveFocus();
    });

    await user.keyboard('{Enter}');

    expect(handleValueChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('value').textContent).toBe('');
  });

  it('inherits the disabled state from the root', async () => {
    const handleClick = vi.fn();

    const { user } = renderWithUser(() => (
      <Select.Root open disabled>
        <Select.Trigger>
          <Select.Value data-testid="value" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="one" onClick={handleClick}>
                one
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    const item = screen.getByRole('option', { name: 'one' });
    expect(item).toHaveAttribute('data-disabled');

    await user.click(item);

    expect(handleClick).not.toHaveBeenCalled();
    expect(screen.getByTestId('value').textContent).toBe('');
  });

  it('should call onClick exactly once for a regular click', async () => {
    const handleClick = vi.fn();

    renderWithUser(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="one" onClick={handleClick}>
                one
              </Select.Item>
              <Select.Item value="two">two</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();
    // Items register with the list a microtask after they mount and focus moves on the next frame
    // (upstream registers synchronously): wait for them before interacting.
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'one' })).toHaveAttribute('data-highlighted'),
    );

    fireEvent.click(screen.getByRole('option', { name: 'one' }));
    await flushMicrotasks();

    expect(screen.getByTestId('value').textContent).toBe('one');
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('should select an unhighlighted item with the mouse', async () => {
    renderWithUser(() => (
      <Select.Root defaultOpen highlightItemOnHover={false}>
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="one">one</Select.Item>
              <Select.Item value="two">two</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    const option = screen.getByRole('option', { name: 'two' });

    expect(option).not.toHaveAttribute('data-highlighted');

    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.mouseDown(option);
    fireEvent.mouseUp(option);
    fireEvent.click(option, { detail: 1 });
    flush();

    await waitFor(() => {
      expect(screen.getByTestId('value').textContent).toBe('two');
    });
  });

  it('should highlight a hovered item and commit it with a mouse click', async () => {
    const onValueChange = vi.fn();

    renderWithUser(() => (
      <Select.Root onValueChange={onValueChange}>
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="one">one</Select.Item>
              <Select.Item value="two">two</Select.Item>
              <Select.Item value="three">three</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    const trigger = screen.getByTestId('trigger');

    fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
    fireEvent.mouseDown(trigger);
    fireEvent.pointerUp(trigger, { pointerType: 'mouse' });
    fireEvent.mouseUp(trigger);
    fireEvent.click(trigger);
    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBe(null);
    });
    // Items register with the list a microtask after they mount (upstream: synchronously).
    await flushMicrotasks();

    const option = screen.getByRole('option', { name: 'two' });

    fireEvent.pointerEnter(option, { pointerType: 'mouse' });
    fireEvent.mouseMove(option);
    flush();

    await waitFor(() => {
      expect(option).toHaveAttribute('data-highlighted');
    });

    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.mouseDown(option);
    fireEvent.pointerUp(option, { pointerType: 'mouse' });
    fireEvent.mouseUp(option);
    fireEvent.click(option);
    await flushMicrotasks();

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('two', expect.anything());
    await waitFor(() => {
      expect(screen.getByTestId('value').textContent).toBe('two');
    });
  });

  it('should ignore an unhighlighted item with a generic virtual click', async () => {
    renderWithUser(() => (
      <Select.Root defaultOpen highlightItemOnHover={false}>
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="one">one</Select.Item>
              <Select.Item value="two">two</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    const option = screen.getByRole('option', { name: 'two' });

    expect(option).not.toHaveAttribute('data-highlighted');

    fireEvent.click(option, { detail: 0 });
    await flushMicrotasks();

    expect(screen.getByTestId('value').textContent).toBe('');
  });

  it('should focus the selected item upon opening the popup', async () => {
    const { user } = renderWithUser(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="one">one</Select.Item>
              <Select.Item value="two">two</Select.Item>
              <Select.Item value="three">three</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    const trigger = screen.getByTestId('trigger');

    fireEvent.click(trigger);
    flush();
    await user.click(screen.getByRole('option', { name: 'three' }));
    fireEvent.click(trigger);
    flush();
    flush();

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'three' })).toHaveFocus();
    });
  });

  // Skipped in jsdom (as upstream): needs real browser focus/typeahead timing.
  it.skipIf(isJSDOM)(
    'should allow pointer click after a typeahead sequence that ends with Space',
    async () => {
      const { user } = renderWithUser(() => (
        <Select.Root defaultOpen>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="one">Item One</Select.Item>
                <Select.Item value="two">Item Two</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const [firstItem, secondItem] = screen.getAllByRole('option');

      await act(async () => {
        firstItem.focus();
      });

      await user.keyboard('item t ');

      await waitFor(() => {
        expect(secondItem).toHaveFocus();
      });

      await user.click(secondItem);

      await waitFor(() => {
        expect(screen.getByTestId('value').textContent).toBe('two');
      });
    },
  );

  // Runs before 'quick selection': animation frames stop firing in this file once fake timers
  // were used.
  describe.skipIf(!isJSDOM)('style hooks', () => {
    it('should apply data-highlighted attribute when item is highlighted', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root defaultValue="a">
          <Select.Trigger data-testid="trigger" />
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      fireEvent.click(screen.getByTestId('trigger'));
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-highlighted', '');
      expect(screen.getByRole('option', { name: 'b' })).not.toHaveAttribute('data-highlighted');

      // Focus moves into the popup on the next frame.
      await waitFor(() =>
        expect(screen.getByRole('listbox').contains(document.activeElement)).toBe(true),
      );

      await user.keyboard('{ArrowDown}');
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'a' })).not.toHaveAttribute('data-highlighted');
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-highlighted', '');
    });

    it('should apply data-selected attribute when item is selected', async () => {
      renderWithUser(() => (
        <Select.Root>
          <Select.Trigger data-testid="trigger" />
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      // Focusing the trigger mounts the items while closed, as in a real keyboard interaction,
      // so they are registered (asynchronously in this port) by the time the popup opens.
      await act(() => screen.getByTestId('trigger').focus());
      await wait(10);

      fireEvent.click(screen.getByTestId('trigger'));
      await flushMicrotasks();
      await waitFor(() =>
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-highlighted'),
      );

      fireEvent.click(screen.getByRole('option', { name: 'a' }));
      await flushMicrotasks();

      fireEvent.click(screen.getByTestId('trigger'));
      flush();
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      });
      expect(screen.getByRole('option', { name: 'b' })).not.toHaveAttribute('data-selected');
    });
  });

  describe.skipIf(!isJSDOM)('quick selection', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
      // Drop frames requested under fake timers so they don't leak into later tests.
      resetAnimationFrameScheduler();
    });

    function renderFakeTimers(ui: () => JSX.Element) {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      return { ...render(ui), user };
    }

    it('calls onClick once for a click made after the opening delay', async () => {
      // Past the delay, a release over an item can select it on its own, so a regular click must
      // still only activate the item through its click event.
      const onClick = vi.fn();
      const { user } = renderFakeTimers(() => (
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b" onClick={onClick}>
                  b
                </Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      await user.click(screen.getByTestId('trigger'));
      const optionB = await screen.findByRole('option', { name: 'b' });
      await vi.advanceTimersByTimeAsync(500);
      await user.click(optionB);

      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'false');
      });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not select an item on quick mouseup when showing a placeholder (no null item)', async () => {
        const fonts = [
        { label: 'Sans-serif', value: 'sans' },
        { label: 'Serif', value: 'serif' },
        { label: 'Monospace', value: 'mono' },
        { label: 'Cursive', value: 'cursive' },
      ];

      renderFakeTimers(() => (
        <Select.Root items={fonts}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" placeholder="Select font" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <For each={fonts}>
                  {(font) => <Select.Item value={font.value}>{font.label}</Select.Item>}
                </For>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      const value = screen.getByTestId('value');

      expect(value.textContent).toBe('Select font');

      // Open on mousedown and keep the mouse button "held" (no mouseup yet).
      fireEvent.mouseDown(trigger);
      flush();

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      const option = screen.getByRole('option', { name: 'Sans-serif' });
      fireEvent.mouseMove(option);
      flush();

      // Release quickly over an unselected option.
      await vi.advanceTimersByTimeAsync(250);
      fireEvent.mouseUp(option);
      flush();

      await waitFor(() => {
        expect(value.textContent).toBe('Select font');
      });
    });

    it('should not select an unselected item within the selected delay when aligned with the trigger', async () => {
  
      renderFakeTimers(() => (
        <Select.Root defaultValue="one">
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger>
              <Select.Popup>
                <Select.Item value="one">one</Select.Item>
                <Select.Item value="two">two</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      const value = screen.getByTestId('value');

      expect(value.textContent).toBe('one');

      fireEvent.mouseDown(trigger);
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBe(null));

      const option = screen.getByRole('option', { name: 'two' });
      await vi.advanceTimersByTimeAsync(250);
      fireEvent.mouseUp(option);
      flush();

      expect(value.textContent).toBe('one');
    });

    it('should call onClick when selecting via drag-to-select (mousedown on trigger, mouseup on item)', async () => {
        const handleClick = vi.fn();

      renderFakeTimers(() => (
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" placeholder="Select font" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="one" onClick={handleClick}>
                  one
                </Select.Item>
                <Select.Item value="two">two</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.mouseDown(trigger);
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBe(null));

      const option = screen.getByRole('option', { name: 'one' });
      fireEvent.pointerEnter(option, { pointerType: 'mouse' });
      for (let i = 0; i < 4; i += 1) {
        fireEvent.pointerMove(option, {
          pointerType: 'mouse',
          buttons: 1,
          movementY: 2,
        });
      }

      // Real pointer movement over the item allows drag-to-select before the opening delay elapses.
      await vi.advanceTimersByTimeAsync(100);
      fireEvent.mouseUp(option);
      flush();

      await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('one'));
      expect(handleClick).toHaveBeenCalledOnce();
    });

    it('does not fire click handlers on a disabled item during drag-to-select', async () => {
        const handleClick = vi.fn();

      renderFakeTimers(() => (
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" placeholder="Select font" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="one" disabled onClick={handleClick}>
                  one
                </Select.Item>
                <Select.Item value="two">two</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.mouseDown(trigger);
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBe(null));

      const option = screen.getByRole('option', { name: 'one' });
      fireEvent.pointerEnter(option, { pointerType: 'mouse' });
      for (let i = 0; i < 4; i += 1) {
        fireEvent.pointerMove(option, { pointerType: 'mouse', buttons: 1, movementY: 2 });
      }

      await vi.advanceTimersByTimeAsync(100);
      fireEvent.mouseUp(option);
      flush();

      await flushMicrotasks();

      // Releasing over a disabled item must not synthesize a click on it at all.
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should not select a disabled item via drag-to-select', async () => {
        const handleValueChange = vi.fn();

      renderFakeTimers(() => (
        <Select.Root onValueChange={handleValueChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" placeholder="Select font" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="one" disabled>
                  one
                </Select.Item>
                <Select.Item value="two">two</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.mouseDown(trigger);
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBe(null));

      const option = screen.getByRole('option', { name: 'one' });
      fireEvent.pointerEnter(option, { pointerType: 'mouse' });
      for (let i = 0; i < 4; i += 1) {
        fireEvent.pointerMove(option, {
          pointerType: 'mouse',
          buttons: 1,
          movementY: 2,
        });
      }

      await vi.advanceTimersByTimeAsync(100);
      fireEvent.mouseUp(option);
      flush();

      await flushMicrotasks();

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('value').textContent).toBe('Select font');
    });

    it('should not select on mouseup that follows a touch interaction', async () => {
        const handleValueChange = vi.fn();

      renderFakeTimers(() => (
        <Select.Root onValueChange={handleValueChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" placeholder="Select font" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="one">one</Select.Item>
                <Select.Item value="two">two</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.mouseDown(trigger);
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBe(null));

      const option = screen.getByRole('option', { name: 'one' });
      // A touch drag over the item: the synthesized mouseup must not commit a selection,
      // otherwise scrolling the popup with a finger would pick whatever is released over.
      fireEvent.pointerEnter(option, { pointerType: 'touch' });
      flush();

      await vi.advanceTimersByTimeAsync(500);
      fireEvent.mouseUp(option);
      flush();

      await flushMicrotasks();

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('value').textContent).toBe('Select font');
    });

    it('should accumulate drag-to-select movement across items', async () => {
  
      renderFakeTimers(() => (
        <Select.Root defaultValue="one">
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger>
              <Select.Popup>
                <Select.Item value="one">one</Select.Item>
                <Select.Item value="two">two</Select.Item>
                <Select.Item value="three">three</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.mouseDown(trigger);
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBe(null));

      const optionTwo = screen.getByRole('option', { name: 'two' });
      fireEvent.pointerEnter(optionTwo, { pointerType: 'mouse' });
      fireEvent.pointerMove(optionTwo, {
        pointerType: 'mouse',
        buttons: 1,
        movementY: 4,
      });

      const optionThree = screen.getByRole('option', { name: 'three' });
      fireEvent.pointerEnter(optionThree, { pointerType: 'mouse' });
      fireEvent.pointerMove(optionThree, {
        pointerType: 'mouse',
        buttons: 1,
        movementY: 4,
      });

      await vi.advanceTimersByTimeAsync(100);
      fireEvent.mouseUp(optionThree);
      flush();

      await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('three'));
    });

    it('should select via drag-to-select when hover highlighting is disabled', async () => {
  
      renderFakeTimers(() => (
        <Select.Root highlightItemOnHover={false}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" placeholder="Select font" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="one">one</Select.Item>
                <Select.Item value="two">two</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.mouseDown(trigger);
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBe(null));

      const option = screen.getByRole('option', { name: 'two' });
      fireEvent.pointerEnter(option, { pointerType: 'mouse' });
      fireEvent.pointerMove(option, {
        pointerType: 'mouse',
        buttons: 1,
        movementY: 8,
      });

      expect(option).not.toHaveAttribute('data-highlighted');

      await vi.advanceTimersByTimeAsync(500);
      fireEvent.mouseUp(option);
      flush();

      await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('two'));
    });

    it('focuses the selected item after drag-to-select so arrow navigation continues from it', async () => {
  
      renderFakeTimers(() => (
        <Select.Root multiple highlightItemOnHover={false}>
          <Select.Trigger data-testid="trigger">
            <Select.Value>
              {(value: string[]) => (value.length ? value.join(', ') : 'Select items')}
            </Select.Value>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="one">one</Select.Item>
                <Select.Item value="two">two</Select.Item>
                <Select.Item value="three">three</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      fireEvent.mouseDown(screen.getByTestId('trigger'));
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBe(null));

      const option = screen.getByRole('option', { name: 'two' });
      fireEvent.pointerEnter(option, { pointerType: 'mouse' });
      fireEvent.pointerMove(option, { pointerType: 'mouse', buttons: 1, movementY: 8 });
      flush();

      expect(option).not.toHaveFocus();

      await vi.advanceTimersByTimeAsync(500);
      fireEvent.mouseUp(option);
      flush();

      expect(option).toHaveAttribute('aria-selected', 'true');
      expect(option).toHaveFocus();

      fireEvent.keyDown(option, { key: 'ArrowDown' });
      await waitFor(() => expect(screen.getByRole('option', { name: 'three' })).toHaveFocus());
    });

    it('should not treat small pointer movement as drag-to-select', async () => {
  
      renderFakeTimers(() => (
        <Select.Root defaultValue="one">
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger>
              <Select.Popup>
                <Select.Item value="one">one</Select.Item>
                <Select.Item value="two">two</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      const value = screen.getByTestId('value');

      expect(value.textContent).toBe('one');

      fireEvent.mouseDown(trigger);
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBe(null));

      const option = screen.getByRole('option', { name: 'two' });
      fireEvent.pointerEnter(option, { pointerType: 'mouse' });
      fireEvent.pointerMove(option, {
        pointerType: 'mouse',
        buttons: 1,
        movementY: 2,
      });

      await vi.advanceTimersByTimeAsync(100);
      fireEvent.mouseUp(option);
      flush();

      expect(value.textContent).toBe('one');
    });

    it('should allow small pointer movement to select after the opening delay', async () => {
  
      renderFakeTimers(() => (
        <Select.Root defaultValue="one">
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger>
              <Select.Popup>
                <Select.Item value="one">one</Select.Item>
                <Select.Item value="two">two</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.mouseDown(trigger);
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBe(null));

      const option = screen.getByRole('option', { name: 'two' });
      fireEvent.pointerEnter(option, { pointerType: 'mouse' });
      fireEvent.pointerMove(option, {
        pointerType: 'mouse',
        buttons: 1,
        movementY: 2,
      });

      await vi.advanceTimersByTimeAsync(500);
      fireEvent.mouseUp(option);
      flush();

      await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('two'));
    });

    it('should ignore an opening click that did not start on the item', async () => {
  
      renderFakeTimers(() => (
        <Select.Root highlightItemOnHover={false}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" placeholder="Select font" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger>
              <Select.Popup>
                <Select.Item value="one">one</Select.Item>
                <Select.Item value="two">two</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
      fireEvent.mouseDown(trigger);
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBe(null));

      const option = screen.getByRole('option', { name: 'one' });
      fireEvent.mouseUp(option);
      fireEvent.click(option, { detail: 1 });
      flush();

      expect(screen.getByTestId('value').textContent).toBe('Select font');
    });

    it('should not select item when onClick calls preventBaseUIHandler during drag-to-select', async () => {
        const handleClick = vi.fn((event) => event.preventBaseUIHandler());

      renderFakeTimers(() => (
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" placeholder="Select font" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="one" onClick={handleClick}>
                  one
                </Select.Item>
                <Select.Item value="two">two</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.mouseDown(trigger);
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBe(null));

      const option = screen.getByRole('option', { name: 'one' });
      fireEvent.pointerEnter(option, { pointerType: 'mouse' });
      fireEvent.pointerMove(option, {
        pointerType: 'mouse',
        buttons: 1,
        movementY: 8,
      });

      // Wait past the delay gates and release the mouse over the option
      await vi.advanceTimersByTimeAsync(500);
      fireEvent.mouseUp(option);
      flush();

      expect(handleClick).toHaveBeenCalledOnce();
      expect(screen.getByTestId('value').textContent).toBe('Select font');
      expect(screen.queryByRole('listbox')).not.toBe(null);
    });
  });
});
