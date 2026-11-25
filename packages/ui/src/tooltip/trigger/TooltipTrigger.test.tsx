import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Tooltip } from '..';
import { Toolbar } from '../../toolbar';
import { act, flushMicrotasks, renderWithUser, wait } from '../../dialog/test-utils';

describe('<Tooltip.Trigger />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Tooltip.Root open>
          <Tooltip.Trigger
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.open ? 'trigger open' : 'trigger')}
            style={{ color: 'red' }}
            render={(props, state) => <button {...props} data-state-open={String(state.open)} />}
          >
            Trigger
          </Tooltip.Trigger>
        </Tooltip.Root>
      ));
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      expect(ref).toBe(trigger);
      expect(trigger).toBeInstanceOf(window.HTMLButtonElement);
      expect(trigger).toHaveClass('trigger', 'open');
      expect(trigger).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(trigger).toHaveAttribute('data-state-open', 'true');
      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('renders a button by default', () => {
      render(() => (
        <Tooltip.Root>
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
        </Tooltip.Root>
      ));
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      expect(trigger.tagName).toBe('BUTTON');
      expect(trigger).not.toHaveAttribute('data-popup-open');
    });
  });

  it('throws a descriptive error when rendered without a root or a handle', () => {
    expect(() => render(() => <Tooltip.Trigger>Trigger</Tooltip.Trigger>)).toThrow(
      'Base UI: <Tooltip.Trigger> must be either used within a <Tooltip.Root> component or provided with a handle.',
    );
  });

  it('removes `data-popup-open` as soon as `open` becomes false', async () => {
    function TooltipWithPreventedUnmount() {
      const [open, setOpen] = createSignal(false);

      return (
        <Tooltip.Root
          open={open()}
          onOpenChange={(nextOpen, eventDetails) => {
            if (!nextOpen) {
              eventDetails.preventUnmountOnClose();
            }
            setOpen(nextOpen);
          }}
        >
          <Tooltip.Trigger data-testid="trigger" delay={0} closeDelay={0}>
            Trigger
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      );
    }

    render(() => <TooltipWithPreventedUnmount />);
    const trigger = screen.getByTestId('trigger');

    fireEvent.mouseEnter(trigger);
    fireEvent.mouseMove(trigger);
    await act(async () => flushMicrotasks());
    expect(trigger).toHaveAttribute('data-popup-open');
    expect(screen.getByText('Content')).not.toBe(null);

    fireEvent.mouseLeave(trigger);
    await act(async () => flushMicrotasks());
    expect(trigger).not.toHaveAttribute('data-popup-open');
    expect(screen.getByText('Content')).not.toBe(null);
  });

  it('opens when the rendered trigger element has its own id', async () => {
    const { user } = renderWithUser(() => (
      <Tooltip.Root>
        <Tooltip.Trigger
          delay={0}
          closeDelay={0}
          render={(props) => (
            <button {...props} id="custom-button" data-testid="trigger" type="button" />
          )}
        >
          Trigger
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const trigger = screen.getByTestId('trigger');

    expect(trigger).toHaveAttribute('id', 'custom-button');

    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('popup')).not.toBe(null);
    });
    expect(trigger).toHaveAttribute('data-popup-open');
  });

  it('opens on delayed hover when rendered as a disabled toolbar button', async () => {
    const { user } = renderWithUser(() => (
      <Toolbar.Root>
        <Tooltip.Root>
          <Tooltip.Trigger
            delay={20}
            render={(props) => <Toolbar.Button {...props} disabled data-testid="trigger" />}
          >
            Push
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="popup">Nothing to push</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Toolbar.Root>
    ));

    const trigger = screen.getByTestId('trigger');

    expect(trigger).not.toHaveAttribute('disabled');
    expect(trigger).toHaveAttribute('aria-disabled', 'true');

    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('popup')).not.toBe(null);
    });
  });

  describe('once the tooltip has unmounted', () => {
    it('stays closed when focus returns to the trigger after leaving the window', async () => {
      const { user } = renderWithUser(() => (
        <Tooltip.Root>
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.keyboard('[Tab]');
      expect(trigger).toHaveFocus();
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).not.toBe(null);
      });

      await user.keyboard('[Escape]');
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });

      // Leaving the window blurs the trigger, then the window, while the trigger stays the
      // active element; coming back focuses the window, then the trigger.
      fireEvent.blur(trigger);
      fireEvent.blur(window);
      fireEvent.focus(window);
      fireEvent.focus(trigger);
      flush();
      await wait(50);

      expect(screen.queryByTestId('popup')).toBe(null);
    });

    it('does not request an open when its previously active trigger is hovered while the tooltip is open without a trigger', async () => {
      const onOpenChange = vi.fn();

      function App() {
        const [open, setOpen] = createSignal(false);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              Open externally
            </button>
            <Tooltip.Root
              open={open()}
              onOpenChange={(nextOpen, eventDetails) => {
                onOpenChange(nextOpen, eventDetails);
                setOpen(nextOpen);
              }}
            >
              <Tooltip.Trigger delay={50}>Trigger</Tooltip.Trigger>
              <Tooltip.Trigger delay={50}>Other trigger</Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </>
        );
      }

      const { user } = renderWithUser(() => <App />);
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      // jsdom doesn't match `:focus-visible` on programmatic focus; a keyboard focus does.
      await act(async () => {
        fireEvent.keyDown(document, { key: 'Tab' });
        trigger.focus();
      });
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).not.toBe(null);
      });
      await act(async () => {
        trigger.blur();
      });
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });

      await user.click(screen.getByRole('button', { name: 'Open externally' }));
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).not.toBe(null);
      });
      onOpenChange.mockClear();

      await user.hover(trigger);
      await wait(100);

      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });
});
