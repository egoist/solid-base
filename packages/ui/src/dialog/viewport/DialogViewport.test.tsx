import { createSignal } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Dialog } from '..';
import { renderWithProps, renderWithUser } from '../test-utils';

describe('<Dialog.Viewport />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Dialog.Root open modal={false}>
        <Dialog.Portal>
          <Dialog.Viewport
            data-testid="viewport"
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.open ? 'viewport open' : 'viewport')}
            style={{ color: 'red' }}
            render={(props, state) => <section {...props} data-state-open={String(state.open)} />}
          >
            <Dialog.Popup />
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    const viewport = screen.getByTestId('viewport');
    expect(ref).toBe(viewport);
    expect(viewport.tagName).toBe('SECTION');
    expect(viewport).toHaveClass('viewport', 'open');
    expect(viewport).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(viewport).toHaveAttribute('data-state-open', 'true');
    expect(viewport).toHaveAttribute('role', 'presentation');
  });

  it('renders only when the dialog is mounted by default', async () => {
    function App() {
      const [open, setOpen] = createSignal(false);
      return (
        <Dialog.Root open={open()} onOpenChange={setOpen} modal={false}>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Viewport data-testid="viewport">
              <Dialog.Popup data-testid="popup">Content</Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        </Dialog.Root>
      );
    }

    const { user } = renderWithUser(() => <App />);

    expect(screen.queryByTestId('viewport')).toBe(null);

    await user.click(screen.getByText('Open'));

    expect(screen.getByTestId('viewport')).not.toBe(null);
    expect(screen.getByTestId('viewport')).toContainElement(screen.getByTestId('popup'));
  });

  it('stays mounted when used within a keepMounted portal', async () => {
    const { setProps } = renderWithProps(
      (props: { open: boolean }) => (
        <Dialog.Root open={props.open} modal={false}>
          <Dialog.Portal keepMounted>
            <Dialog.Viewport data-testid="viewport">
              <Dialog.Popup>Content</Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        </Dialog.Root>
      ),
      { open: true },
    );

    expect(screen.getByTestId('viewport')).not.toBe(null);

    await setProps({ open: false });

    expect(screen.getByTestId('viewport')).not.toBe(null);
  });
});
