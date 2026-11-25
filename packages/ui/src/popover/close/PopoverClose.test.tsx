import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Popover } from '..';
import { Tooltip } from '../../tooltip';
import { REASONS } from '../../internals/reasons';

function isElementOrAncestorInert(element: HTMLElement) {
  let current: HTMLElement | null = element;
  while (current) {
    if (current.getAttribute('aria-hidden') === 'true' || current.hasAttribute('inert')) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

describe('<Popover.Close />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Popover.Root open>
        <Popover.Trigger>Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Popover.Close
                ref={(el) => {
                  ref = el;
                }}
                class="close"
                style={{ color: 'red' }}
                render={(props) => <button {...props} data-custom="" />}
              >
                Close
              </Popover.Close>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    const close = screen.getByRole('button', { name: 'Close' });
    expect(ref).toBe(close);
    expect(close).toBeInstanceOf(window.HTMLButtonElement);
    expect(close).toHaveAttribute('data-custom');
    expect(close).toHaveClass('close');
    expect(close).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('renders when popover is closed', () => {
    render(() => (
      <Popover.Root>
        <Popover.Close aria-label="Close popover" />
      </Popover.Root>
    ));

    expect(screen.queryByRole('button', { name: 'Close popover' })).not.toBe(null);
  });

  it('should close popover when clicked', () => {
    render(() => (
      <Popover.Root defaultOpen>
        <Popover.Trigger>Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              Content
              <Popover.Close data-testid="close" />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    expect(screen.queryByText('Content')).not.toBe(null);

    fireEvent.click(screen.getByTestId('close'));
    flush();

    expect(screen.queryByText('Content')).toBe(null);
  });

  it('keeps the trigger when closing with a tooltip trigger close button', () => {
    const handleOpenChange = vi.fn();

    render(() => (
      <Popover.Root defaultOpen onOpenChange={handleOpenChange}>
        <Popover.Trigger id="trigger-1">Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              Content
              <Popover.Close
                data-testid="close"
                render={(popoverCloseProps) => (
                  <Tooltip.Root>
                    <Tooltip.Trigger {...popoverCloseProps}>Close</Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Positioner>
                        <Tooltip.Popup>Tooltip</Tooltip.Popup>
                      </Tooltip.Positioner>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                )}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    expect(screen.queryByText('Content')).not.toBe(null);

    fireEvent.click(screen.getByTestId('close'));
    flush();

    expect(screen.queryByText('Content')).toBe(null);
    expect(handleOpenChange.mock.calls[0][0]).toBe(false);
    expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.closePress);
    expect(handleOpenChange.mock.calls[0][1].trigger?.id).toBe('trigger-1');
  });

  // `triggerId` can point at a trigger that isn't mounted (for example while a controlled id is
  // being handed over), but the popup is still anchored to the element it opened against, so the
  // close event has to report that element rather than nothing.
  it('falls back to the active trigger element when the active trigger id is unregistered', () => {
    const handleOpenChange = vi.fn();
    const [triggerId, setTriggerId] = createSignal<string | null>('trigger-1');

    render(() => (
      <Popover.Root open triggerId={triggerId()} onOpenChange={handleOpenChange}>
        <Popover.Trigger id="trigger-1">Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              Content
              <Popover.Close data-testid="close" />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    setTriggerId('unregistered');
    flush();

    fireEvent.click(screen.getByTestId('close'));
    flush();

    expect(handleOpenChange).toHaveBeenCalledTimes(1);
    expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.closePress);
    expect(handleOpenChange.mock.calls[0][1].trigger).toBe(
      screen.getByRole('button', { name: 'Trigger' }),
    );
  });

  it('reports no trigger when the active trigger id has no mounted trigger', () => {
    const handleOpenChange = vi.fn();

    render(() => (
      <Popover.Root defaultOpen defaultTriggerId="never-mounted" onOpenChange={handleOpenChange}>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              Content
              <Popover.Close data-testid="close" />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    fireEvent.click(screen.getByTestId('close'));
    flush();

    expect(screen.queryByText('Content')).toBe(null);
    expect(handleOpenChange).toHaveBeenCalledTimes(1);
    expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.closePress);
    expect(handleOpenChange.mock.calls[0][1].trigger).toBe(undefined);
  });

  it.each([true, 'trap-focus'] as const)(
    'enables modal focus management when `modal=%s` and close is rendered',
    async (modal) => {
      render(() => (
        <div>
          <button data-testid="outside">Outside</button>
          <Popover.Root defaultOpen modal={modal}>
            <Popover.Trigger>Trigger</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup>
                  <Popover.Close aria-label="Close popover" />
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </div>
      ));

      await waitFor(() => {
        expect(isElementOrAncestorInert(screen.getByTestId('outside'))).toBe(true);
      });
    },
  );

  it('does not enable modal focus management when close is not rendered', async () => {
    render(() => (
      <div>
        <button data-testid="outside">Outside</button>
        <Popover.Root defaultOpen modal>
          <Popover.Trigger>Trigger</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>
    ));

    await waitFor(() => {
      expect(screen.getByText('Content')).toBeVisible();
    });
    expect(isElementOrAncestorInert(screen.getByTestId('outside'))).toBe(false);
  });
});
