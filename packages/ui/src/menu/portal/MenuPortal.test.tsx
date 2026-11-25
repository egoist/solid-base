import { createSignal } from 'solid-js';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { Menu } from '..';
import { act } from '../test-utils';

describe('<Menu.Portal />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Menu.Root>
        <Menu.Portal
          keepMounted
          data-testid="portal"
          ref={(el) => {
            ref = el;
          }}
          class="portal"
          style={{ color: 'red' }}
          render={(props) => <section {...props} />}
        />
      </Menu.Root>
    ));
    const portal = screen.getByTestId('portal');
    expect(ref).toBe(portal);
    expect(portal.tagName).toBe('SECTION');
    expect(portal).toHaveClass('portal');
    expect(portal.style.color).toBe('red');
  });

  it('renders nothing while closed without keepMounted', () => {
    render(() => (
      <Menu.Root>
        <Menu.Portal data-testid="portal">
          <Menu.Positioner>
            <Menu.Popup />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    expect(screen.queryByTestId('portal')).toBe(null);
  });

  describe('prop: container', () => {
    it.each([
      { controlled: false, keepMounted: false },
      { controlled: true, keepMounted: false },
      { controlled: false, keepMounted: true },
    ])(
      'mounts and focuses an initially open menu inside an ancestor ref (controlled=$controlled, keepMounted=$keepMounted)',
      async ({ controlled, keepMounted }) => {
        function Test() {
          let container: HTMLDivElement | undefined;
          return (
            <div ref={container} data-testid="container">
              <Menu.Root defaultOpen={!controlled} open={controlled ? true : undefined}>
                <Menu.Trigger>Open menu</Menu.Trigger>
                <Menu.Portal
                  container={() => container ?? null}
                  keepMounted={keepMounted}
                  data-testid="portal"
                >
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Item>Item</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </div>
          );
        }

        render(() => <Test />);
        await act(() => {});
        expect(screen.getByTestId('container')).toContainElement(screen.getByTestId('portal'));
        expect(screen.getByTestId('container')).toContainElement(screen.getByRole('menu'));
        await waitFor(() => expect(screen.getByRole('menu')).toHaveFocus());
      },
    );

    it('keeps a closed menu inside an ancestor ref when opening', async () => {
      const [open, setOpen] = createSignal(false);
      function Test() {
        let container: HTMLDivElement | undefined;
        return (
          <div ref={container} data-testid="container">
            <Menu.Root open={open()}>
              <Menu.Trigger>Open menu</Menu.Trigger>
              <Menu.Portal container={() => container ?? null} keepMounted>
                <Menu.Positioner>
                  <Menu.Popup data-testid="popup">
                    <Menu.Item>Item</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        );
      }

      render(() => <Test />);
      await act(() => {});
      const container = screen.getByTestId('container');
      const popup = screen.getByTestId('popup');
      expect(screen.queryByRole('menu')).toBeNull();
      expect(container).toContainElement(popup);

      await act(() => setOpen(true));
      expect(screen.getByRole('menu')).toBe(popup);
      expect(container).toContainElement(popup);
    });
  });
});
