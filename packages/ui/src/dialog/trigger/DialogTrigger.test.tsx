import { render, screen } from '@solidjs/testing-library';
import { Dialog } from '..';
import { renderWithUser } from '../test-utils';

describe('<Dialog.Trigger />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Dialog.Root open modal={false}>
          <Dialog.Trigger
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.open ? 'trigger open' : 'trigger')}
            style={{ color: 'red' }}
            render={(props, state) => <button {...props} data-state-open={String(state.open)} />}
          >
            Open
          </Dialog.Trigger>
        </Dialog.Root>
      ));
      const trigger = screen.getByRole('button', { name: 'Open' });
      expect(ref).toBe(trigger);
      expect(trigger).toBeInstanceOf(window.HTMLButtonElement);
      expect(trigger).toHaveClass('trigger', 'open');
      expect(trigger).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(trigger).toHaveAttribute('data-state-open', 'true');
      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('renders a native button by default', () => {
      render(() => (
        <Dialog.Root>
          <Dialog.Trigger>Open</Dialog.Trigger>
        </Dialog.Root>
      ));
      const trigger = screen.getByRole('button', { name: 'Open' });
      expect(trigger.tagName).toBe('BUTTON');
      expect(trigger).toHaveAttribute('type', 'button');
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('throws a descriptive error without a root or handle', () => {
    expect(() => render(() => <Dialog.Trigger />)).toThrow(
      'Base UI: <Dialog.Trigger> must be used within <Dialog.Root> or provided with a handle.',
    );
  });

  describe('prop: disabled', () => {
    it('disables the dialog', async () => {
      const { user } = renderWithUser(() => (
        <Dialog.Root modal={false}>
          <Dialog.Trigger disabled />
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Popup>
              <Dialog.Title>title text</Dialog.Title>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('data-disabled');

      await user.click(trigger);
      expect(screen.queryByText('title text')).toBe(null);

      await user.keyboard('[Tab]');
      expect(document.activeElement).not.toBe(trigger);
    });

    it('custom element', async () => {
      const { user } = renderWithUser(() => (
        <Dialog.Root modal={false}>
          <Dialog.Trigger disabled render="span" nativeButton={false} />
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Popup>
              <Dialog.Title>title text</Dialog.Title>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      const trigger = screen.getByRole('button');
      expect(trigger).not.toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('data-disabled');
      expect(trigger).toHaveAttribute('aria-disabled', 'true');

      await user.click(trigger);
      expect(screen.queryByText('title text')).toBe(null);

      await user.keyboard('[Tab]');
      expect(document.activeElement).not.toBe(trigger);
    });
  });
});
