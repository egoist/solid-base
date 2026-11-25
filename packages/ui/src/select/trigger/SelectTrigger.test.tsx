import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { flush } from 'solid-js';
import { Select } from '..';
import { act, renderWithUser, wait } from '../test-utils';

describe('<Select.Trigger />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Select.Root open>
          <Select.Trigger
            data-testid="trigger"
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.open ? 'trigger open' : 'trigger')}
            style={{ color: 'red' }}
            render={(props, state) => <button {...props} data-state-open={String(state.open)} />}
          />
        </Select.Root>
      ));
      const trigger = screen.getByTestId('trigger');
      expect(ref).toBe(trigger);
      expect(trigger).toBeInstanceOf(window.HTMLButtonElement);
      expect(trigger).toHaveClass('trigger', 'open');
      expect(trigger).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(trigger).toHaveAttribute('data-state-open', 'true');
    });

    it('renders a combobox button by default', () => {
      render(() => (
        <Select.Root>
          <Select.Trigger data-testid="trigger" />
        </Select.Root>
      ));
      const trigger = screen.getByTestId('trigger');
      expect(trigger.tagName).toBe('BUTTON');
      expect(trigger).toHaveAttribute('type', 'button');
      expect(trigger).toHaveAttribute('role', 'combobox');
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveAttribute('tabindex', '0');
    });
  });

  it('throws a descriptive error when rendered outside <Select.Root>', () => {
    expect(() => render(() => <Select.Trigger />)).toThrow(
      'Base UI: SelectRootContext is missing. Select parts must be placed within <Select.Root>.',
    );
  });

  // Skipped: 'closes an aligned popup when focus lands on the trigger so it is not obscured'
  // (needs real layout for the item-aligned positioning).

  it('keeps a non-aligned popup open when focus lands on the trigger', async () => {
    const onOpenChange = vi.fn();

    render(() => (
      <Select.Root defaultOpen onOpenChange={onOpenChange}>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner alignItemWithTrigger={false}>
            <Select.Popup>
              <Select.Item value="a">a</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    const trigger = screen.getByTestId('trigger');

    fireEvent.focus(trigger);
    flush();

    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  describe('releasing the opening press', () => {
    async function pressTrigger(
      options: {
        container?: ShadowRoot;
        onOpenChange?: Select.Root.Props<string>['onOpenChange'];
        release?: boolean;
      } = {},
    ) {
      render(() => (
        <Select.Root onOpenChange={options.onOpenChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal container={options.container}>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      trigger.getBoundingClientRect = () =>
        DOMRect.fromRect({ x: 100, y: 100, width: 100, height: 40 });

      fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(trigger, { button: 0 });
      if (options.release) {
        fireEvent.mouseUp(trigger, { button: 0, clientX: 150, clientY: 120 });
      }
      flush();
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });
      return trigger;
    }

    it('ignores a later release when the opening press was released immediately', async () => {
      const onOpenChange = vi.fn();
      const trigger = await pressTrigger({ onOpenChange, release: true });
      await act(async () => {
        await wait(20);
      });
      onOpenChange.mockClear();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      // e.g. a press that started inside the popup and was dragged off it
      fireEvent.mouseUp(document.body, { button: 0, clientX: 10, clientY: 10 });
      await act(async () => {
        await wait(20);
      });

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('keeps the popup open when the press slips up to 5px off the trigger', async () => {
      const trigger = await pressTrigger();

      fireEvent.mouseUp(document.body, { button: 0, clientX: 96, clientY: 120 });
      await act(async () => {
        await wait(20);
      });

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes the popup when the press is dragged off the trigger and released', async () => {
      const trigger = await pressTrigger();

      fireEvent.mouseUp(document.body, { button: 0, clientX: 94, clientY: 120 });
      flush();

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('keeps the popup open when the press is released inside a popup in a shadow root', async () => {
      const host = document.createElement('div');
      document.body.append(host);
      const shadowRoot = host.attachShadow({ mode: 'open' });

      try {
        const trigger = await pressTrigger({ container: shadowRoot });
        const popup = shadowRoot.querySelector('[role="listbox"]');
        expect(popup).not.toBe(null);

        fireEvent.mouseUp(popup!, { button: 0, clientX: 500, clientY: 500 });
        await act(async () => {
          await wait(20);
        });

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      } finally {
        host.remove();
      }
    });
  });

  describe('disabled state', () => {
    it('is removed from the tab order when disabled and not rendered as a button', () => {
      render(() => (
        <Select.Root disabled>
          <Select.Trigger data-testid="trigger" nativeButton={false} render="div">
            <Select.Value />
          </Select.Trigger>
        </Select.Root>
      ));

      expect(screen.getByTestId('trigger')).toHaveAttribute('tabindex', '-1');
    });

    it('cannot be focused when disabled', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root defaultValue="b">
          <Select.Trigger data-testid="trigger" disabled>
            <Select.Value />
          </Select.Trigger>
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

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('data-disabled');

      await user.keyboard('[Tab]');

      expect(trigger).not.toHaveFocus();
    });

    it('does not toggle the popup when disabled', async () => {
      const handleOpenChange = vi.fn();
      render(() => (
        <Select.Root defaultValue="b" onOpenChange={handleOpenChange}>
          <Select.Trigger data-testid="trigger" disabled>
            <Select.Value />
          </Select.Trigger>
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

      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      flush();

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
      expect(handleOpenChange.mock.calls.length).toBe(0);
    });
  });

  describe('placeholder state', () => {
    it('should have the data-placeholder attribute when provided `null` value', () => {
      render(() => (
        <Select.Root value={null}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
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

      const trigger = screen.getByTestId('trigger');
      const value = screen.getByTestId('value');

      expect(trigger).toHaveAttribute('data-placeholder');
      expect(value).toHaveAttribute('data-placeholder');
    });

    it('should have the data-placeholder attribute when provided custom property with `itemToStringValue`', () => {
      const shippingMethods = [
        { id: '', name: 'Default' },
        { id: 'standard', name: 'Standard' },
        { id: 'express', name: 'Express' },
        { id: 'overnight', name: 'Overnight' },
      ];

      render(() => (
        <Select.Root
          defaultValue={shippingMethods[0]}
          itemToStringValue={(item) => item.id}
          itemToStringLabel={(item) => item.name}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      const value = screen.getByTestId('value');

      expect(trigger).toHaveAttribute('data-placeholder');
      expect(value).toHaveAttribute('data-placeholder');
      expect(value.textContent).toBe('Default');
    });

    it('should have the data-placeholder attribute when provided { value: null }', () => {
      const fonts = [{ label: 'Select font', value: null }];

      render(() => (
        <Select.Root items={fonts}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      const value = screen.getByTestId('value');

      expect(trigger).toHaveAttribute('data-placeholder');
      expect(value).toHaveAttribute('data-placeholder');
      expect(value.textContent).toBe('Select font');
    });

    it('should not have the data-placeholder attribute when provided a value', () => {
      render(() => (
        <Select.Root defaultValue="a">
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      const value = screen.getByTestId('value');

      expect(trigger).not.toHaveAttribute('data-placeholder');
      expect(value).not.toHaveAttribute('data-placeholder');
    });

    it('should not have the data-placeholder attribute when multiple mode has a default value', () => {
      render(() => (
        <Select.Root multiple defaultValue={['a']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      const value = screen.getByTestId('value');

      expect(trigger).not.toHaveAttribute('data-placeholder');
      expect(value).not.toHaveAttribute('data-placeholder');
    });
  });

  describe('style hooks', () => {
    // Skipped: 'sets data-popup-side to the current popup side' and 'sets data-popup-side to the
    // resolved side when alignItemWithTrigger is active' (need real layout for positioning).

    it('should have the data-popup-open and data-pressed attributes when open', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root>
          <Select.Trigger />
        </Select.Root>
      ));

      const trigger = screen.getByRole('combobox');

      await user.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-popup-open');
      });
      expect(trigger).toHaveAttribute('data-pressed');
    });
  });

  describe('prop: required', () => {
    it('sets aria-required attribute when required', () => {
      render(() => (
        <Select.Root required>
          <Select.Trigger data-testid="trigger" />
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('aria-required', 'true');
    });
  });
});
