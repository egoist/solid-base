import { For, Show, createSignal, flush, onSettled } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Combobox } from '..';
import { Autocomplete } from '../../autocomplete';
import { Field } from '../../field';
import { REASONS } from '../../internals/reasons';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { act, flushMicrotasks, renderWithUser } from '../test-utils';

describe('<Combobox.Trigger />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  describe('conformance', () => {
    it('forwards ref, class, style and render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Combobox.Root>
          <Combobox.Trigger
            data-testid="trigger"
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.open ? 'open' : 'closed')}
            style={{ color: 'red' }}
            render={(props) => <button {...props} data-custom="" />}
          />
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      expect(ref).toBe(trigger);
      expect(trigger).toBeInstanceOf(window.HTMLButtonElement);
      expect(trigger).toHaveAttribute('data-custom');
      expect(trigger).toHaveClass('closed');
      expect(trigger).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });

    it('renders a native button with type="button" by default', () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger" />
        </Combobox.Root>
      ));
      expect(screen.getByTestId('trigger')).toHaveAttribute('type', 'button');
    });
  });

  it('sets tabIndex to -1 when not used as the main anchor', async () => {
    const { user } = renderWithUser(() => (
      <Combobox.Root>
        <Combobox.Input />
        <Combobox.Trigger data-testid="trigger" />
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    const trigger = screen.getByTestId('trigger');

    expect(trigger).toHaveAttribute('tabindex', '-1');

    await user.click(input);
    expect(trigger).toHaveAttribute('tabindex', '-1');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('tabindex', '-1');
  });

  describe('prop: disabled', () => {
    it('should render aria-disabled attribute when disabled', async () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Trigger disabled data-testid="trigger">
            Open
          </Combobox.Trigger>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('disabled');
    });

    it('should inherit disabled state from ComboboxRoot', async () => {
      render(() => (
        <Combobox.Root disabled>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('disabled');
    });

    it('should inherit disabled state from Field.Root', async () => {
      render(() => (
        <Field.Root disabled>
          <Combobox.Root>
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          </Combobox.Root>
        </Field.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('disabled');
    });

    it('should not open popup when disabled', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root>
          <Combobox.Trigger disabled data-testid="trigger">
            Open
          </Combobox.Trigger>
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

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('ignores native keydown events on a disabled non-native trigger', async () => {
      const onOpenChange = vi.fn();
      render(() => (
        <Combobox.Root onOpenChange={onOpenChange}>
          <Combobox.Trigger disabled nativeButton={false} render="div" data-testid="trigger" />
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      await act(async () => {
        trigger.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
        );
      });

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('should prioritize local disabled over root disabled', async () => {
      render(() => (
        <Combobox.Root disabled={false}>
          <Combobox.Trigger disabled data-testid="trigger">
            Open
          </Combobox.Trigger>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('disabled');
    });
  });

  it.each([
    {
      name: 'single selection',
      control: () => (
        <Combobox.Root defaultValue="apple">
          <Combobox.Trigger data-testid="trigger" />
        </Combobox.Root>
      ),
      expectedValue: 'apple',
    },
    {
      name: 'no selection',
      control: () => (
        <Autocomplete.Root defaultValue="query">
          <Autocomplete.Trigger data-testid="trigger" />
        </Autocomplete.Root>
      ),
      expectedValue: 'query',
    },
  ])('validates the $name value when blurred', async ({ control, expectedValue }) => {
    const validate = vi.fn();
    render(() => (
      <Field.Root validationMode="onBlur" validate={validate}>
        {control()}
      </Field.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    fireEvent.focus(trigger);
    fireEvent.blur(trigger);
    flush();

    expect(validate).toHaveBeenCalledWith(expectedValue, expect.anything());
  });

  it('ignores a pending mouseup after the trigger unmounts', async () => {
    const onOpenChange = vi.fn();

    const [showTrigger, setShowTrigger] = createSignal(true);

    function Test() {
      return (
        <Combobox.Root onOpenChange={onOpenChange}>
          <Show when={showTrigger()}>
            <Combobox.Trigger data-testid="trigger" />
          </Show>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      );
    }

    render(() => <Test />);
    fireEvent.mouseDown(screen.getByTestId('trigger'));
    flush();

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything()));
    onOpenChange.mockClear();

    setShowTrigger(false);
    await flushMicrotasks();

    fireEvent.mouseUp(document.body, { clientX: 100, clientY: 100 });
    flush();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('does not select when closed typeahead matches a sparse label without a value', async () => {
    const onValueChange = vi.fn();

    function SparseRegistry() {
      const store = useComboboxRootContext();
      onSettled(() => {
        store.context.labelsRef.current[0] = 'apple';
        delete store.context.valuesRef.current[0];
      });
      return null;
    }

    const { user } = renderWithUser(() => (
      <Combobox.Root onValueChange={onValueChange}>
        <SparseRegistry />
        <Combobox.Trigger>Open</Combobox.Trigger>
      </Combobox.Root>
    ));

    const trigger = screen.getByRole('combobox');
    trigger.focus();
    await user.keyboard('a');

    expect(onValueChange).not.toHaveBeenCalled();
  });

  describe('prop: readOnly', () => {
    it('applies the data-readonly style hook only when readOnly', async () => {
      const [readOnly, setReadOnly] = createSignal(true);
      render(() => (
        <Combobox.Root readOnly={readOnly()}>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('data-readonly', '');

      setReadOnly(false);
      flush();
      expect(trigger).not.toHaveAttribute('data-readonly');
    });

    it('opens the popup when readOnly', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root readOnly>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
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

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      expect(await screen.findByRole('listbox')).toHaveAttribute('aria-readonly', 'true');
    });

    it.each([
      { name: 'ArrowDown', key: '{ArrowDown}' },
      { name: 'ArrowUp', key: '{ArrowUp}' },
      { name: 'Enter', key: '{Enter}' },
      { name: 'Space', key: '[Space]' },
    ])('opens on $name when readOnly', async ({ key }) => {
      const onOpenChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Combobox.Root readOnly onOpenChange={onOpenChange}>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      trigger.focus();
      await user.keyboard(key);

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole('listbox')).not.toBe(null);
    });

    it('does not commit a value with typeahead on a closed trigger', async () => {
      const onValueChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Combobox.Root readOnly onValueChange={onValueChange}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value />
          </Combobox.Trigger>
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

      const trigger = screen.getByTestId('trigger');
      trigger.focus();
      await user.keyboard('b');

      expect(onValueChange).not.toHaveBeenCalled();
      expect(trigger).toHaveAttribute('data-placeholder');
    });

    it('should not toggle when readOnly=false (control)', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root readOnly={false}>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
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

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);
      expect(await screen.findByRole('listbox')).not.toBe(null);
    });
  });

  describe('interaction behavior', () => {
    it('should toggle popup when enabled', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root>
          <Combobox.Input />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
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

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      expect(await screen.findByRole('listbox')).not.toBe(null);

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });

    it('closes a popup opened with an arrow key', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root>
          <Combobox.Input />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
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

      const input = screen.getByRole('combobox');
      await act(() => input.focus());
      await user.keyboard('{ArrowDown}');
      expect(await screen.findByRole('listbox')).not.toBe(null);

      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });

    it('should call onOpenChange when toggling', async () => {
      const handleOpenChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Combobox.Root onOpenChange={handleOpenChange}>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
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

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      await waitFor(() => {
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });
      expect(handleOpenChange.mock.calls[0][0]).toBe(true);
    });

    it('opens popup when pressing ArrowDown or ArrowUp', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger" />
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

      const trigger = screen.getByTestId('trigger');
      await act(() => trigger.focus());

      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('listbox')).not.toBe(null);
      expect(screen.getByRole('combobox')).toHaveFocus();

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).toBe(null);

      await act(() => trigger.focus());

      await user.keyboard('{ArrowUp}');
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(screen.getByRole('combobox')).toHaveFocus();
    });

    it('does not open on ArrowDown/ArrowUp when reference is a textarea', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root>
          <Combobox.Trigger>Open</Combobox.Trigger>
          <textarea aria-label="notes" />
        </Combobox.Root>
      ));

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);
      await user.keyboard('{ArrowDown}');
      expect(screen.queryByRole('listbox')).toBe(null);
      await user.keyboard('{ArrowUp}');
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('fires with reason trigger-press when Trigger is clicked', async () => {
      const onOpenChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Combobox.Root onOpenChange={onOpenChange}>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="alpha">Alpha</Combobox.Item>
                  <Combobox.Item value="beta">Beta</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      await waitFor(() => {
        expect(onOpenChange.mock.calls.length).toBe(1);
      });
      expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.triggerPress);
    });

    // Needs a real browser to simulate a screen reader press (no pointer/mouse events).
    it.skip('keeps focus on the input after a screen reader press', async () => {
      render(() => (
        <Combobox.Root items={['Apple', 'Banana']}>
          <Combobox.Input />
          <Combobox.Trigger data-testid="trigger" />
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

      const trigger = screen.getByTestId('trigger');
      trigger.click();

      expect(await screen.findByRole('listbox')).not.toBe(null);
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toHaveFocus();
      });
    });
  });

  describe('drag selection', () => {
    it('commits selection when the input is outside the popup', async () => {
      const handleValueChange = vi.fn();

      render(() => (
        <Combobox.Root onValueChange={handleValueChange}>
          <Combobox.Input />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="alpha">Alpha</Combobox.Item>
                  <Combobox.Item value="beta">Beta</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(trigger, { button: 0 });

      await screen.findByRole('listbox');
      const option = await screen.findByRole('option', { name: 'Beta' });

      fireEvent.mouseMove(option, { pointerType: 'mouse' });
      await waitFor(() => expect(option).toHaveAttribute('data-highlighted'));

      fireEvent.mouseUp(option, { button: 0 });

      await waitFor(() => {
        expect(handleValueChange.mock.calls.length).toBe(1);
      });
      expect(handleValueChange.mock.calls[0][0]).toBe('beta');
    });

    it('commits selection when the input is inside the popup and the pointer is released over an item', async () => {
      const handleValueChange = vi.fn();

      render(() => (
        <Combobox.Root onValueChange={handleValueChange}>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
                  <Combobox.Item value="alpha">Alpha</Combobox.Item>
                  <Combobox.Item value="beta">Beta</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(trigger, { button: 0 });

      await screen.findByRole('listbox');
      const option = await screen.findByRole('option', { name: 'Beta' });

      fireEvent.mouseMove(option, { pointerType: 'mouse' });
      await waitFor(() => expect(option).toHaveAttribute('data-highlighted'));

      fireEvent.mouseUp(option, { button: 0 });

      await waitFor(() => {
        expect(handleValueChange.mock.calls.length).toBe(1);
      });
      expect(handleValueChange.mock.calls[0][0]).toBe('beta');
    });

    // Upstream runs this in a real browser only (touch pointer compat events).
    it.skip('does not double-commit when a non-primary touch lands on another item', async () => {
      const handleValueChange = vi.fn();

      render(() => (
        <Combobox.Root onValueChange={handleValueChange}>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
                  <Combobox.Item value="alpha">Alpha</Combobox.Item>
                  <Combobox.Item value="beta">Beta</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(trigger, { button: 0 });

      await screen.findByRole('listbox');
      const alpha = await screen.findByRole('option', { name: 'Alpha' });
      const beta = await screen.findByRole('option', { name: 'Beta' });

      // Highlight Alpha so a stray drag-select would be able to commit it.
      fireEvent.mouseMove(alpha, { pointerType: 'mouse' });
      await waitFor(() => expect(alpha).toHaveAttribute('data-highlighted'));

      // Primary touch presses Alpha; a second, non-primary touch lands on Beta.
      // Without the `isPrimary` guard the shared ref would flip to Beta, making
      // Alpha's release read as a drag-select and commit once on `mouseup` and
      // again on the following `click`.
      fireEvent.pointerDown(alpha, { pointerType: 'touch', isPrimary: true, button: 0 });
      fireEvent.pointerDown(beta, { pointerType: 'touch', isPrimary: false, button: 0 });
      fireEvent.mouseUp(alpha, { button: 0 });
      fireEvent.click(alpha, { button: 0 });

      await waitFor(() => {
        expect(handleValueChange.mock.calls.length).toBe(1);
      });
      expect(handleValueChange.mock.calls[0][0]).toBe('alpha');
    });

    // Upstream runs this in a real browser only (touch pointer compat events).
    it.skip('commits a later drag-select onto an item whose earlier pointerdown never released', async () => {
      const handleValueChange = vi.fn();

      const { user } = renderWithUser(() => (
        <Combobox.Root onValueChange={handleValueChange}>
          <Combobox.Input />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="alpha">Alpha</Combobox.Item>
                  <Combobox.Item value="beta">Beta</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      // Press an item, then close before any matching `mouseup` arrives. The
      // closed-state effect must clear the shared pointerdown ref, otherwise the
      // stale entry makes the next drag-select onto Alpha read as a same-item tap
      // and never commit.
      fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(trigger, { button: 0 });
      await screen.findByRole('listbox');
      const alpha = await screen.findByRole('option', { name: 'Alpha' });
      fireEvent.pointerDown(alpha, { pointerType: 'touch', isPrimary: true, button: 0 });

      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      // Reopen and drag-select onto Alpha (gesture starts on the trigger).
      fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(trigger, { button: 0 });
      await screen.findByRole('listbox');
      const alphaReopened = await screen.findByRole('option', { name: 'Alpha' });
      fireEvent.mouseMove(alphaReopened, { pointerType: 'mouse' });
      await waitFor(() => expect(alphaReopened).toHaveAttribute('data-highlighted'));
      fireEvent.mouseUp(alphaReopened, { button: 0 });

      await waitFor(() => {
        expect(handleValueChange.mock.calls.length).toBe(1);
      });
      expect(handleValueChange.mock.calls[0][0]).toBe('alpha');
    });

    it('does not commit selection if the pointer never hovers the item', async () => {
      const handleValueChange = vi.fn();

      render(() => (
        <Combobox.Root onValueChange={handleValueChange}>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
                  <Combobox.Item value="alpha">Alpha</Combobox.Item>
                  <Combobox.Item value="beta">Beta</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(trigger, { button: 0 });

      await screen.findByRole('listbox');
      const option = await screen.findByRole('option', { name: 'Beta' });

      fireEvent.mouseUp(option, { button: 0 });

      await waitFor(() => {
        expect(handleValueChange.mock.calls.length).toBe(0);
      });
    });
  });

  describe('cancel-open', () => {
    it('closes the popup when mouseup occurs outside the trigger bounds', async () => {
      const onOpenChange = vi.fn();

      render(() => (
        <Combobox.Root onOpenChange={onOpenChange}>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="alpha">Alpha</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(trigger, { button: 0 });

      await screen.findByRole('listbox');

      fireEvent.mouseUp(document.body, { button: 0, clientX: 999, clientY: 999 });

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.cancelOpen);
    });

    it('keeps the popup open when mouseup remains near the trigger bounds', async () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="alpha">Alpha</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      trigger.getBoundingClientRect = () =>
        ({
          left: 0,
          top: 0,
          right: 100,
          bottom: 40,
          width: 100,
          height: 40,
          x: 0,
          y: 0,
          toJSON() {
            return {};
          },
        }) as DOMRect;

      fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(trigger, { button: 0 });

      const listbox = await screen.findByRole('listbox');

      fireEvent.mouseUp(document.body, { button: 0, clientX: 1, clientY: 1 });

      expect(listbox.isConnected).toBe(true);
    });

    it('closes the popup when the release is more than 5px outside the trigger bounds', async () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="alpha">Alpha</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      trigger.getBoundingClientRect = () =>
        DOMRect.fromRect({ x: 100, y: 100, width: 100, height: 40 });

      fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(trigger, { button: 0 });

      await screen.findByRole('listbox');

      fireEvent.mouseUp(document.body, { button: 0, clientX: 94, clientY: 120 });

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });
  });

  describe('aria attributes', () => {
    it('sets aria-required attribute when required (input inside popup)', async () => {
      render(() => (
        <Combobox.Root required>
          <Combobox.Trigger data-testid="trigger" />
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('aria-required', 'true');
    });

    it('does not set aria-required attribute when the input is outside the popup', async () => {
      render(() => (
        <Combobox.Root required>
          <Combobox.Input />
          <Combobox.Trigger data-testid="trigger" />
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      expect(trigger).not.toHaveAttribute('aria-required');
    });

    it('sets aria-readonly attribute when readOnly (input inside popup)', async () => {
      render(() => (
        <Combobox.Root readOnly>
          <Combobox.Trigger data-testid="trigger" />
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('role', 'combobox');
      expect(trigger).toHaveAttribute('aria-readonly', 'true');
    });

    it('does not set aria-readonly attribute when the input is outside the popup', async () => {
      render(() => (
        <Combobox.Root readOnly>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger" />
        </Combobox.Root>
      ));

      // Without the `combobox` role the trigger is a plain button, so `aria-readonly` wouldn't
      // apply to it. The input carries the state instead.
      const trigger = screen.getByTestId('trigger');
      expect(trigger).not.toHaveAttribute('role');
      expect(trigger).not.toHaveAttribute('aria-readonly');
      expect(screen.getByTestId('input')).toHaveAttribute('aria-readonly', 'true');
    });

    it('sets all aria attributes on the input when closed', async () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      expect(trigger).toHaveAttribute('tabindex', '0');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      expect(trigger).not.toHaveAttribute('aria-controls');
    });

    it('sets all aria attributes on the trigger when open', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      await screen.findByRole('listbox');
      const popup = screen.getByRole('dialog');

      expect(trigger).toHaveAttribute('tabindex', '0');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      expect(popup.id).not.toBe('');
      expect(trigger).toHaveAttribute('aria-controls', popup.id);
    });
  });

  describe('typeahead', () => {
    it('selects item when typing on focused trigger (input inside popup)', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value />
          </Combobox.Trigger>
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

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveTextContent('apple');

      await act(() => trigger.focus());
      await user.keyboard('a');

      expect(trigger).toHaveTextContent('apple');
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it.each([false, true])(
      'selects item when typing after the popup has been opened and closed (items prop, strict: %s)',
      // `strict` toggles React's StrictMode upstream; there is no equivalent, so both runs match.
      async (_strict) => {
        const { user } = renderWithUser(() => (
          <Combobox.Root items={['apple', 'banana', 'cherry']}>
            <Combobox.Trigger data-testid="trigger">
              <Combobox.Value />
            </Combobox.Trigger>
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

        const trigger = screen.getByTestId('trigger');

        // Opening mounts the list (rendered labels overwrite the derived ones) and closing
        // unmounts it, clearing the registered labels. Typeahead must still work afterwards.
        await user.click(trigger);
        await screen.findByRole('listbox');
        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });
        // Focus returns to the trigger asynchronously after close.
        await waitFor(() => {
          expect(trigger).toHaveFocus();
        });

        await user.keyboard('b');

        await waitFor(() => {
          expect(trigger).toHaveTextContent('banana');
        });
      },
    );

    it.each([false, true])(
      'cycles to the next matching item when typing after open/close (no items prop, keepMounted %s)',
      async (keepMounted) => {
        const { user } = renderWithUser(() => (
          <Combobox.Root defaultValue="apple">
            <Combobox.Trigger data-testid="trigger">
              <Combobox.Value />
            </Combobox.Trigger>
            <Combobox.Portal keepMounted={keepMounted}>
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

        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);
        await screen.findByRole('listbox');
        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });
        await waitFor(() => {
          expect(trigger).toHaveFocus();
        });

        // Typeahead starts matching after the selected item, like a native select.
        await user.keyboard('a');
        await waitFor(() => {
          expect(trigger).toHaveTextContent('apricot');
        });
      },
    );

    it('cycles from the selected item after reordering items while closed (no items prop)', async () => {
      function App() {
        const [order, setOrder] = createSignal(['apple', 'apricot', 'banana']);

        return (
          <div>
            <Combobox.Root defaultValue="apple">
              <Combobox.Trigger data-testid="trigger">
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <For each={order()}>
                        {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                      </For>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
            <button
              type="button"
              data-testid="reorder"
              onClick={() => setOrder(['apricot', 'apple', 'banana'])}
            >
              reorder
            </button>
          </div>
        );
      }

      const { user } = renderWithUser(() => <App />);
      const trigger = screen.getByTestId('trigger');

      // Open and close so the trigger path force-mounts the list.
      await user.click(trigger);
      await screen.findByRole('listbox');
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });

      // Reorder while closed: apple moves from index 0 to index 1.
      fireEvent.click(screen.getByTestId('reorder'));
      await flushMicrotasks();

      // Typeahead starts after the selected item; from apple it wraps to apricot.
      await user.keyboard('a');
      await waitFor(() => {
        expect(trigger).toHaveTextContent('apricot');
      });
    });

    it('only matches mounted indexed item labels when typing on the focused trigger', async () => {
      function TestComponent() {
        const [showBanana, setShowBanana] = createSignal(true);

        return (
          <Combobox.Root>
            <Combobox.Trigger data-testid="trigger">
              <Combobox.Value />
            </Combobox.Trigger>
            <button type="button" onClick={() => setShowBanana(false)}>
              Remove banana
            </button>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="apple" index={0}>
                      Apple
                    </Combobox.Item>
                    <Show when={showBanana()}>
                      <Combobox.Item value="banana" index={1}>
                        Banana
                      </Combobox.Item>
                    </Show>
                    <Combobox.Item value="blueberry" index={2}>
                      Blueberry
                    </Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      const { user } = renderWithUser(() => <TestComponent />);
      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await screen.findByRole('listbox');

      await user.click(screen.getByRole('button', { name: 'Remove banana' }));
      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Banana' })).toBe(null);
      });
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await act(() => trigger.focus());
      await user.keyboard('b');

      await waitFor(() => {
        expect(trigger).toHaveTextContent('blueberry');
      });
    });
  });

  describe('data state attributes', () => {
    // Requires real positioning (the resolved side), which jsdom lacks.
    it.skip('sets data-popup-side to the current popup side', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root items={['apple']}>
          <Combobox.Trigger data-testid="trigger">Trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner side="right">
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      expect(trigger).not.toHaveAttribute('data-popup-side');

      await user.click(trigger);

      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBe(null));
      expect(trigger).toHaveAttribute('data-popup-side', 'right');

      await user.click(document.body);

      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(trigger).not.toHaveAttribute('data-popup-side');
    });

    it('toggles data-list-empty when the filtered list is empty', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root items={['apple', 'banana']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Trigger</Combobox.Trigger>
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
      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      expect(trigger).not.toHaveAttribute('data-list-empty');

      await user.type(input, 'zzz');

      expect(trigger).toHaveAttribute('data-list-empty');

      await user.clear(input);

      expect(trigger).not.toHaveAttribute('data-list-empty');
    });

    it('has data-placeholder when no value is selected', async () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value placeholder="Select" />
          </Combobox.Trigger>
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

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('data-placeholder');
    });

    it('does not have data-placeholder when value is selected', async () => {
      render(() => (
        <Combobox.Root defaultValue="a">
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value placeholder="Select" />
          </Combobox.Trigger>
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

      const trigger = screen.getByTestId('trigger');
      expect(trigger).not.toHaveAttribute('data-placeholder');
    });

    it('has data-placeholder when multiple mode has empty array', async () => {
      render(() => (
        <Combobox.Root multiple defaultValue={[]}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value placeholder="Select" />
          </Combobox.Trigger>
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

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('data-placeholder');
    });

    it('does not have data-placeholder when multiple mode has a default value', async () => {
      render(() => (
        <Combobox.Root multiple defaultValue={['a']}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value placeholder="Select" />
          </Combobox.Trigger>
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

      const trigger = screen.getByTestId('trigger');
      expect(trigger).not.toHaveAttribute('data-placeholder');
    });
  });
});
