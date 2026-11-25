import type { BaseUIEvent } from '../../types';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Dialog } from '..';
import { renderWithUser } from '../test-utils';

describe('<Dialog.Close />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Dialog.Root open modal={false}>
          <Dialog.Portal>
            <Dialog.Popup>
              <Dialog.Close
                ref={(el) => {
                  ref = el;
                }}
                class="close"
                style={{ color: 'red' }}
                nativeButton={false}
                render={(props, state) => (
                  <span {...props} data-state-disabled={String(state.disabled)} />
                )}
              >
                Close
              </Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));
      const close = screen.getByRole('button', { name: 'Close' });
      expect(ref).toBe(close);
      expect(close.tagName).toBe('SPAN');
      expect(close).toHaveClass('close');
      expect(close).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(close).toHaveAttribute('data-state-disabled', 'false');
    });

    it('renders a native button by default', () => {
      render(() => (
        <Dialog.Root open modal={false}>
          <Dialog.Portal>
            <Dialog.Popup>
              <Dialog.Close>Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));
      const close = screen.getByRole('button', { name: 'Close' });
      expect(close).toBeInstanceOf(window.HTMLButtonElement);
      expect(close).toHaveAttribute('type', 'button');
    });
  });

  describe('prop: disabled', () => {
    it('disables the button', async () => {
      const handleOpenChange = vi.fn();

      const { user } = renderWithUser(() => (
        <Dialog.Root onOpenChange={handleOpenChange}>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup>
              <Dialog.Close disabled>Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      expect(handleOpenChange.mock.calls.length).toBe(0);

      await user.click(screen.getByText('Open'));

      expect(handleOpenChange.mock.calls.length).toBe(1);
      expect(handleOpenChange.mock.calls[0][0]).toBe(true);

      const closeButton = screen.getByText('Close');
      expect(closeButton).toHaveAttribute('disabled');
      expect(closeButton).toHaveAttribute('data-disabled');
      await user.click(closeButton);

      expect(handleOpenChange.mock.calls.length).toBe(1);
    });

    it('custom element', async () => {
      const handleOpenChange = vi.fn();

      const { user } = renderWithUser(() => (
        <Dialog.Root onOpenChange={handleOpenChange}>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup>
              <Dialog.Close disabled render="span" nativeButton={false}>
                Close
              </Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      expect(handleOpenChange.mock.calls.length).toBe(0);

      await user.click(screen.getByText('Open'));

      expect(handleOpenChange.mock.calls.length).toBe(1);
      expect(handleOpenChange.mock.calls[0][0]).toBe(true);

      const closeButton = screen.getByText('Close');
      expect(closeButton).not.toHaveAttribute('disabled');
      expect(closeButton).toHaveAttribute('data-disabled');
      expect(closeButton).toHaveAttribute('aria-disabled', 'true');
      await user.click(closeButton);

      expect(handleOpenChange.mock.calls.length).toBe(1);
    });
  });

  it('closes the dialog when undefined is passed to the `onClick` prop', async () => {
    const handleOpenChange = vi.fn();

    const { user } = renderWithUser(() => (
      <Dialog.Root onOpenChange={handleOpenChange}>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Close onClick={undefined}>Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    expect(handleOpenChange.mock.calls.length).toBe(0);

    await user.click(screen.getByText('Open'));

    expect(handleOpenChange.mock.calls.length).toBe(1);
    expect(handleOpenChange.mock.calls[0][0]).toBe(true);

    await user.click(screen.getByText('Close'));

    expect(handleOpenChange.mock.calls.length).toBe(2);
    expect(handleOpenChange.mock.calls[1][0]).toBe(false);
  });

  it('does not close the dialog when the Base UI click handler is prevented', async () => {
    const handleOpenChange = vi.fn();

    const { user } = renderWithUser(() => (
      <Dialog.Root defaultOpen modal={false} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Close
              onClick={(event) =>
                (event as unknown as BaseUIEvent<MouseEvent>).preventBaseUIHandler()
              }
            >
              Close
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.getByRole('dialog')).not.toBe(null);
    expect(handleOpenChange.mock.calls.length).toBe(0);
  });

  it('does not request another close when clicked after the dialog has closed', () => {
    const handleOpenChange = vi.fn();
    const handleClick = vi.fn();

    render(() => (
      <Dialog.Root open={false} modal={false} onOpenChange={handleOpenChange}>
        <Dialog.Portal keepMounted>
          <Dialog.Popup>
            <Dialog.Close onClick={handleClick}>Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));

    expect(handleClick.mock.calls.length).toBe(1);
    expect(handleOpenChange.mock.calls.length).toBe(0);
  });
});
