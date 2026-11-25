import { createSignal } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Dialog } from '..';

describe('<Dialog.Backdrop />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Dialog.Root open modal={false}>
          <Dialog.Backdrop
            data-testid="backdrop"
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.open ? 'backdrop open' : 'backdrop')}
            style={{ color: 'red' }}
            render={(props, state) => (
              <section {...props} data-state-open={String(state.open)} />
            )}
          />
        </Dialog.Root>
      ));
      const backdrop = screen.getByTestId('backdrop');
      expect(ref).toBe(backdrop);
      expect(ref).toBeInstanceOf(window.HTMLElement);
      expect(backdrop.tagName).toBe('SECTION');
      expect(backdrop).toHaveClass('backdrop', 'open');
      expect(backdrop).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(backdrop).toHaveAttribute('data-state-open', 'true');
      expect(backdrop).toHaveAttribute('data-open');
    });

    it('renders a div by default', () => {
      render(() => (
        <Dialog.Root open modal={false}>
          <Dialog.Backdrop data-testid="backdrop" />
        </Dialog.Root>
      ));
      expect(screen.getByTestId('backdrop')).toBeInstanceOf(window.HTMLDivElement);
    });
  });

  it('has role="presentation"', () => {
    render(() => (
      <Dialog.Root open>
        <Dialog.Backdrop data-testid="backdrop" />
      </Dialog.Root>
    ));

    expect(screen.getByTestId('backdrop')).toHaveAttribute('role', 'presentation');
  });

  describe('prop: forceRender', () => {
    it('renders only the root backdrop by default', () => {
      function App() {
        const [nestedOpen, setNestedOpen] = createSignal(true);

        return (
          <Dialog.Root open>
            <Dialog.Backdrop data-testid="root-backdrop" />
            <Dialog.Portal>
              <Dialog.Popup>
                Root dialog
                <Dialog.Root open={nestedOpen()} onOpenChange={setNestedOpen}>
                  <Dialog.Backdrop data-testid="nested-backdrop" />
                  <Dialog.Portal>
                    <Dialog.Popup>Nested dialog</Dialog.Popup>
                  </Dialog.Portal>
                </Dialog.Root>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        );
      }

      render(() => <App />);

      expect(screen.getByTestId('root-backdrop')).not.toBe(null);
      expect(screen.queryByTestId('nested-backdrop')).toBe(null);
    });

    it('always renders by default when not nested', () => {
      render(() => (
        <Dialog.Root open>
          <Dialog.Backdrop data-testid="backdrop" />
          <Dialog.Portal>
            <Dialog.Popup>Content</Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      expect(screen.getByTestId('backdrop')).not.toBe(null);
    });

    it('renders only the root backdrop with multiple nesting levels', () => {
      render(() => (
        <Dialog.Root open>
          <Dialog.Backdrop data-testid="level-1-backdrop" />
          <Dialog.Portal>
            <Dialog.Popup>
              Level 1 dialog
              <Dialog.Root open>
                <Dialog.Backdrop data-testid="level-2-backdrop" />
                <Dialog.Portal>
                  <Dialog.Popup>
                    Level 2 dialog
                    <Dialog.Root open>
                      <Dialog.Backdrop data-testid="level-3-backdrop" />
                      <Dialog.Portal>
                        <Dialog.Popup>Level 3 dialog</Dialog.Popup>
                      </Dialog.Portal>
                    </Dialog.Root>
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      expect(screen.getByTestId('level-1-backdrop')).not.toBe(null);
      expect(screen.queryByTestId('level-2-backdrop')).toBe(null);
      expect(screen.queryByTestId('level-3-backdrop')).toBe(null);
    });

    it('always renders when true', () => {
      render(() => (
        <Dialog.Root open>
          <Dialog.Backdrop data-testid="level-1-backdrop" forceRender />
          <Dialog.Portal>
            <Dialog.Popup>
              Level 1 dialog
              <Dialog.Root open>
                <Dialog.Backdrop data-testid="level-2-backdrop" forceRender />
                <Dialog.Portal>
                  <Dialog.Popup>
                    Level 2 dialog
                    <Dialog.Root open>
                      <Dialog.Backdrop data-testid="level-3-backdrop" forceRender />
                      <Dialog.Portal>
                        <Dialog.Popup>Level 3 dialog</Dialog.Popup>
                      </Dialog.Portal>
                    </Dialog.Root>
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      expect(screen.getByTestId('level-1-backdrop')).not.toBe(null);
      expect(screen.getByTestId('level-2-backdrop')).not.toBe(null);
      expect(screen.getByTestId('level-3-backdrop')).not.toBe(null);
    });
  });
});
