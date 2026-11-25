import { createSignal } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Menu } from '..';
import { Popover } from '../../popover';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { act, flushMicrotasks, renderWithUser } from '../test-utils';

describe('<Menu.Trigger />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Menu.Root open>
          <Menu.Trigger
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.open ? 'trigger open' : 'trigger')}
            style={{ color: 'red' }}
            render={(props, state) => <button {...props} data-state-open={String(state.open)} />}
          >
            Open
          </Menu.Trigger>
        </Menu.Root>
      ));
      const trigger = screen.getByRole('button', { name: 'Open' });
      expect(ref).toBe(trigger);
      expect(trigger).toBeInstanceOf(window.HTMLButtonElement);
      expect(trigger).toHaveClass('trigger', 'open');
      expect(trigger).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(trigger).toHaveAttribute('data-state-open', 'true');
    });

    it('renders a native button by default', () => {
      render(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
        </Menu.Root>
      ));
      const trigger = screen.getByRole('button', { name: 'Open' });
      expect(trigger.tagName).toBe('BUTTON');
      expect(trigger).toHaveAttribute('type', 'button');
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('throws without Menu.Root or a handle', () => {
    expect(() => render(() => <Menu.Trigger />)).toThrow(
      'Base UI: <Menu.Trigger> must be either used within a <Menu.Root> component or provided with a handle.',
    );
  });

  // Skipped: upstream runs this only in a real browser (native Shift+Tab focus traversal).
  it.skip('focuses the preceding element when tabbing backward from the open trigger', () => {});

  describe('prop: disabled', () => {
    it('should render a disabled button', () => {
      render(() => (
        <Menu.Root>
          <Menu.Trigger disabled />
        </Menu.Root>
      ));

      const button = screen.getByRole('button');
      expect(button).toHaveProperty('disabled', true);
    });

    it('should not open the menu when clicked', async () => {
      const { user } = renderWithUser(() => (
        <Menu.Root>
          <Menu.Trigger disabled />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const button = screen.getByRole('button');
      await user.click(button);
      await act(() => {});

      expect(screen.queryByRole('menu', { hidden: false })).toBe(null);
    });
  });

  it('removes the hover mouseup listener when unmounted before mouseup', async () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    try {
      const { user, unmount } = renderWithUser(() => (
        <Menu.Root>
          <Menu.Trigger delay={0} openOnHover>
            Open
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      addEventListenerSpy.mockClear();
      await user.hover(trigger);
      await screen.findByRole('menu', { hidden: false });
      await act(() => {});

      // The trigger's listener is the `{ once: true }` one (the dismiss interaction, set up
      // earlier here than in React, also listens to mouseup in the capture phase).
      const mouseUpListener = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'mouseup' && (call[2] as AddEventListenerOptions | undefined)?.once,
      )?.[1];
      expect(mouseUpListener).toBeTypeOf('function');

      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', mouseUpListener);
    } finally {
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    }
  });

  it.each([
    { name: 'stays open when the mouseup lands inside the popup', insidePopup: true },
    { name: 'closes when the mouseup lands outside the popup', insidePopup: false },
  ])('a hover-opened menu in a shadow root $name', async ({ insidePopup }) => {
    const host = document.createElement('div');
    document.body.append(host);
    const shadowRoot = host.attachShadow({ mode: 'open' });

    try {
      const { user } = renderWithUser(() => (
        <Menu.Root>
          <Menu.Trigger delay={0} openOnHover>
            Open
          </Menu.Trigger>
          <Menu.Portal container={shadowRoot as unknown as HTMLElement}>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.hover(trigger);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });
      await act(() => {});

      const popup = shadowRoot.querySelector('[role="menu"]');
      expect(popup).not.toBe(null);

      fireEvent.mouseUp(insidePopup ? popup! : document.body, { clientX: 500, clientY: 500 });
      await act(() => {});

      expect(trigger).toHaveAttribute('aria-expanded', String(insidePopup));
    } finally {
      host.remove();
    }
  });

  describe('keyboard navigation', () => {
    const cases = [
      { buttonType: 'native', key: 'ArrowUp' },
      { buttonType: 'native', key: 'ArrowDown' },
      { buttonType: 'non-native', key: 'ArrowUp' },
      { buttonType: 'non-native', key: 'ArrowDown' },
      { buttonType: 'non-native', key: 'Enter' },
      { buttonType: 'non-native', key: 'Space' },
    ] as const;

    it.each(cases)(
      'opens the menu when pressing $key on a $buttonType button',
      async ({ buttonType, key }) => {
        const { user } = renderWithUser(() => (
          <Menu.Root>
            {buttonType === 'native' ? (
              <Menu.Trigger>Open</Menu.Trigger>
            ) : (
              <Menu.Trigger render="span" nativeButton={false}>
                Open
              </Menu.Trigger>
            )}
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>1</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ));

        const button = screen.getByRole('button', { name: 'Open' });
        expect(button.tagName).toBe(buttonType === 'native' ? 'BUTTON' : 'SPAN');
        await act(() => {
          button.focus();
        });

        await user.keyboard(`[${key}]`);
        await act(() => {});

        expect(screen.getByRole('menu', { hidden: false })).toBeInTheDocument();
      },
    );
  });

  describe('style hooks', () => {
    it('should have the data-popup-open and data-pressed attributes when open', async () => {
      render(() => (
        <Menu.Root>
          <Menu.Trigger />
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button');

      await act(() => {
        trigger.click();
      });

      expect(trigger).toHaveAttribute('data-popup-open');
      expect(trigger).toHaveAttribute('data-pressed');
    });

    it('keeps the data-popup-open attribute and handle.isOpen when a controlled close is vetoed', async () => {
      const handle = Menu.createHandle();

      function TestCase() {
        const [open, setOpen] = createSignal(false);

        return (
          <>
            <Menu.Root
              handle={handle}
              open={open()}
              onOpenChange={(nextOpen) => {
                if (nextOpen) {
                  setOpen(true);
                }
              }}
            >
              <Menu.Trigger>Actions</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item>Item</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <button type="button">Outside</button>
          </>
        );
      }

      const { user } = renderWithUser(() => <TestCase />);

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await user.click(trigger);

      await screen.findByRole('menu');
      expect(trigger).toHaveAttribute('data-popup-open');
      expect(handle.isOpen).toBe(true);

      await user.click(screen.getByRole('button', { name: 'Outside' }));
      await act(() => {});

      expect(screen.getByRole('menu')).toHaveAttribute('data-open');
      expect(trigger).toHaveAttribute('data-popup-open');
      expect(handle.isOpen).toBe(true);
    });
  });

  describe('impatient clicks with `openOnHover=true`', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does not close the menu if the user clicks too quickly', async () => {
      render(() => (
        <Menu.Root>
          <Menu.Trigger delay={0} openOnHover />
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseMove(trigger);
      await flushMicrotasks();

      vi.advanceTimersByTime(PATIENT_CLICK_THRESHOLD - 1);
      await flushMicrotasks();

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('closes the menu if the user clicks patiently', async () => {
      render(() => (
        <Menu.Root>
          <Menu.Trigger delay={0} openOnHover />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      await flushMicrotasks();

      vi.advanceTimersByTime(PATIENT_CLICK_THRESHOLD);
      await flushMicrotasks();

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(trigger).not.toHaveAttribute('data-popup-open');

      // Leaving the trigger afterwards doesn't reopen it.
      fireEvent.mouseLeave(trigger);
      await flushMicrotasks();

      expect(trigger).not.toHaveAttribute('data-popup-open');
    });

    it('sticks if the user clicks impatiently', async () => {
      render(() => (
        <Menu.Root>
          <Menu.Trigger delay={0} openOnHover />
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      await flushMicrotasks();

      vi.advanceTimersByTime(PATIENT_CLICK_THRESHOLD - 1);
      await flushMicrotasks();

      fireEvent.click(trigger);
      fireEvent.mouseLeave(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-popup-open');

      vi.advanceTimersByTime(1);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('sticks when clicked before the hover delay completes', async () => {
      render(() => (
        <Menu.Root>
          <Menu.Trigger openOnHover delay={300}>
            Open
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>Content</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      await flushMicrotasks();

      vi.advanceTimersByTime(100);
      await flushMicrotasks();

      // User clicks impatiently to open
      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-popup-open');

      fireEvent.mouseLeave(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('should keep the menu open when re-hovered and clicked within the patient threshold', async () => {
      render(() => (
        <Menu.Root>
          <Menu.Trigger openOnHover delay={100}>
            Open
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>Content</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      await flushMicrotasks();

      vi.advanceTimersByTime(100);
      await flushMicrotasks();

      expect(screen.getByText('Content')).not.toBe(null);

      vi.advanceTimersByTime(PATIENT_CLICK_THRESHOLD);
      await flushMicrotasks();

      fireEvent.mouseLeave(trigger);
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      fireEvent.click(trigger);
      await flushMicrotasks();
      expect(screen.getByText('Content')).not.toBe(null);
    });
  });

  // Skipped: needs real layout (the mouseup is matched against the trigger's bounding rect).
  it.skip('keeps a hover-opened menu open when mouseup lands outside the trigger DOM but within its bounds', () => {});

  describe('preventBaseUIHandler', () => {
    it('prevents opening the menu with a mouse when `preventBaseUIHandler` is called in onMouseDown', async () => {
      const { user } = renderWithUser(() => (
        <Menu.Root>
          <Menu.Trigger onMouseDown={(event) => event.preventBaseUIHandler()} />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const button = screen.getByRole('button');
      await user.click(button);
      await act(() => {});

      expect(screen.queryByRole('menu', { hidden: false })).toBe(null);
    });

    it('prevents opening the menu with keyboard when `preventBaseUIHandler` is called in onClick', async () => {
      const { user } = renderWithUser(() => (
        <Menu.Root>
          <Menu.Trigger onClick={(event) => event.preventBaseUIHandler()} />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const button = screen.getByRole('button');
      await act(() => {
        button.focus();
      });

      await user.keyboard('[Enter]');
      await act(() => {});

      expect(screen.queryByRole('menu', { hidden: false })).toBe(null);
    });
  });

  it('does not have role prop inside a Popover', () => {
    render(() => (
      <Popover.Root open>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Menu.Root>
                <Menu.Trigger data-testid="menu-trigger" />
              </Menu.Root>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    const button = screen.getByTestId('menu-trigger');
    expect(button).not.toHaveAttribute('role');
  });

  it('has a role prop inside a Popover when not a native button', () => {
    render(() => (
      <Popover.Root open>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Menu.Root>
                <Menu.Trigger data-testid="menu-trigger" render="span" nativeButton={false} />
              </Menu.Root>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    const button = screen.getByTestId('menu-trigger');
    expect(button).toHaveAttribute('role', 'button');
  });
});
