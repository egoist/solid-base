import { Errored } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { DirectionProvider } from '../../direction-provider';
import { Menu } from '..';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuStore } from '../store/MenuStore';
import { renderWithProps } from '../../dialog/test-utils';
import { act, flushMicrotasks, renderWithUser, waitSingleFrame } from '../test-utils';

type TextDirection = 'ltr' | 'rtl';

describe('<Menu.SubmenuTrigger />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  async function waitForAnimationFrame() {
    await act(() => waitSingleFrame());
  }

  afterEach(waitForAnimationFrame);

  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger
                    ref={(el) => {
                      ref = el;
                    }}
                    class={(state) => (state.open ? 'trigger open' : 'trigger')}
                    style={{ color: 'red' }}
                    render={(props, state) => (
                      <section {...props} data-state-open={String(state.open)} />
                    )}
                  >
                    More
                  </Menu.SubmenuTrigger>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      const trigger = screen.getByRole('menuitem', { name: 'More' });
      expect(ref).toBe(trigger);
      expect(trigger.tagName).toBe('SECTION');
      expect(trigger).toHaveClass('trigger');
      expect(trigger.style.color).toBe('red');
      expect(trigger).toHaveAttribute('data-state-open', 'false');
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('renders a div by default', () => {
      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      expect(screen.getByRole('menuitem', { name: 'More' })).toBeInstanceOf(
        window.HTMLDivElement,
      );
    });
  });

  // Skipped: upstream runs this only in a real browser (native hover + keyboard activation).
  it.skip('keeps a hover-opened submenu open when pressing Enter / Space', () => {});

  // Skipped: upstream runs this only in a real browser (native touch pointer sequences).
  it.skip('closes a touch-opened submenu on a second tap', () => {});

  it('keeps a submenu open on direct trigger focus but closes it on guard return', async () => {
    const { user } = renderWithUser(() => (
      <Menu.Root>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="parent-menu">
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="submenu">
                      <Menu.Item>Alpha</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
              <Menu.Item>Play Next</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    await user.keyboard('[Tab][Enter]');
    const trigger = await screen.findByRole('menuitem', { name: 'More' });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
    await user.keyboard('[ArrowRight]');
    const item = await screen.findByRole('menuitem', { name: 'Alpha' });
    await waitFor(() => {
      expect(item).toHaveFocus();
    });

    await act(() => {
      trigger.focus();
    });
    await flushMicrotasks();
    expect(screen.getByTestId('submenu')).not.toBe(null);

    await act(() => {
      item.focus();
    });

    const submenu = screen.getByTestId('submenu');
    const guard = submenu.parentElement?.querySelector<HTMLElement>(
      '[data-base-ui-focus-guard][data-type="inside"]',
    );
    expect(guard).toBeTruthy();

    await act(() => {
      guard?.focus();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('submenu')).toBe(null);
    });
    expect(screen.getByTestId('parent-menu')).not.toBe(null);

    await user.keyboard('[ArrowDown]');
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Play Next' })).toHaveFocus();
    });
  });

  // Skipped: upstream runs this only in a real browser (focus inside a shadow-root portal).
  it.skip('closes a submenu when its focus guard is in a shadow-root portal', () => {});

  it('follows a submenu trigger id change', async () => {
    const storeRef: { current: MenuStore<unknown> | null } = { current: null };

    function StoreProbe() {
      storeRef.current = useMenuRootContext().store as MenuStore<unknown>;
      return null;
    }

    const { setProps } = renderWithProps(
      (props: { id: string }) => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.SubmenuRoot>
                  <StoreProbe />
                  <Menu.SubmenuTrigger id={props.id}>More</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Item>Monthly</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ),
      { id: 'first' },
    );
    await flushMicrotasks();

    const submenuTrigger = screen.getByText('More');
    expect(storeRef.current!.context.triggerElements.getById('first')).toBe(submenuTrigger);

    await setProps({ id: 'second' });

    expect(storeRef.current!.context.triggerElements.getById('first')).toBeUndefined();
    expect(storeRef.current!.context.triggerElements.getById('second')).toBe(submenuTrigger);
    expect(storeRef.current!.context.triggerElements.size).toBe(1);
  });

  it('throws when rendered outside Menu.SubmenuRoot', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Menu.SubmenuTrigger />
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent(
      'Base UI: <Menu.SubmenuTrigger> must be placed in <Menu.SubmenuRoot>.',
    );
  });

  it('throws when Menu.SubmenuRoot is rendered outside a menu', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Menu.SubmenuRoot>
          <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
        </Menu.SubmenuRoot>
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent('Base UI: MenuRootContext is missing.');
  });

  function TestComponent(props: { direction: TextDirection }) {
    return (
      <DirectionProvider direction={props.direction}>
        <Menu.Root open>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger>2</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Item>2.1</Menu.Item>
                        <Menu.Item>2.2</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </DirectionProvider>
    );
  }

  it.each([
    { direction: 'ltr', openKey: 'ArrowRight' },
    { direction: 'rtl', openKey: 'ArrowLeft' },
  ] as const)(
    'opens the submenu with $openKey and highlights a single item in $direction direction',
    async ({ direction, openKey }) => {
      render(() => <TestComponent direction={direction} />);
      await flushMicrotasks();
      const submenuTrigger = screen.getByText('2');

      fireEvent.focus(submenuTrigger);
      fireEvent.keyDown(submenuTrigger, { key: openKey });

      await waitFor(() => {
        expect(screen.getByText('2.1')).toBeInTheDocument();
      });
      const submenuItem1 = screen.getByText('2.1');

      await waitFor(() => {
        expect(submenuItem1).toHaveFocus();
      });

      // Only the first submenu item is highlighted; no other submenu or parent menu item is.
      const highlightedItems = screen
        .getAllByRole('menuitem')
        .filter((item) => item.hasAttribute('data-highlighted'));
      expect(highlightedItems).toEqual([submenuItem1]);
    },
  );

  it('sets tabIndex to 0 on the submenu trigger after opening the submenu with a keydown event', async () => {
    render(() => <TestComponent direction="ltr" />);
    await flushMicrotasks();
    const submenuTrigger = screen.getByText('2');

    fireEvent.focus(submenuTrigger);
    fireEvent.keyDown(submenuTrigger, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(submenuTrigger).toHaveAttribute('tabindex', '0');
    });
  });

  it('uses the label prop for text navigation', async () => {
    const { user } = renderWithUser(() => (
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>Alpha</Menu.Item>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger data-testid="submenu-trigger" label="Reports">
                  More
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Item>Monthly</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    // The focus manager moves focus into the initially open popup on the next frame.
    await waitFor(() =>
      expect(screen.getByRole('menu')).toContainElement(document.activeElement as HTMLElement),
    );

    fireEvent.focus(screen.getByText('Alpha'));
    await user.keyboard('r');

    await waitFor(() => {
      expect(screen.getByTestId('submenu-trigger')).toHaveFocus();
    });
  });

  describe('prop: disabled', () => {
    it('should render with disabled attributes when disabled prop is set', () => {
      render(() => (
        <Menu.Root open>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger disabled>Open submenu</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="submenu-popup">
                        <Menu.Item>2.1</Menu.Item>
                        <Menu.Item>2.2</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const submenuTrigger = screen.getByRole('menuitem', { name: 'Open submenu' });

      expect(submenuTrigger).toHaveAttribute('data-disabled');
      expect(submenuTrigger).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not open on hover when disabled', async () => {
      const { user } = renderWithUser(() => (
        <Menu.Root open>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger disabled delay={0}>
                    Open submenu
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="submenu-popup">
                        <Menu.Item>2.1</Menu.Item>
                        <Menu.Item>2.2</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const submenuTrigger = screen.getByRole('menuitem', { name: 'Open submenu' });

      await user.hover(submenuTrigger);
      await act(() => {});

      expect(screen.queryByTestId('submenu-popup')).toBe(null);
    });

    it('should warn when a disabled element is detected via render prop with JSX element', async () => {
      const warnSpy = vi
        .spyOn(console, 'warn')
        .mockName('console.warn')
        .mockImplementation(() => {});
      try {
        render(() => (
          <Menu.Root open>
            <Menu.Trigger>Open menu</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>1</Menu.Item>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger
                      nativeButton
                      render={(props) => <button {...props} type="button" disabled />}
                    >
                      Open submenu
                    </Menu.SubmenuTrigger>
                  </Menu.SubmenuRoot>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ));
        await flushMicrotasks();

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'Base UI: A disabled element was detected on <Menu.SubmenuTrigger>. To properly disable the trigger, use the `disabled` prop on the component instead of setting it on the rendered element.',
          ),
        );
        expect(warnSpy.mock.lastCall?.[0]).not.toContain('undefined');
      } finally {
        warnSpy.mockRestore();
      }
    });

    // Omitted: 'warns without an owner stack when React cannot provide one' (React-only owner
    // stacks) and 'does not inspect rendered disabled elements in production' (`isDev` is a
    // build-time constant here, not `process.env.NODE_ENV`).
  });
});
