import { For, createSignal, flush, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Popover } from '..';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { act, flushMicrotasks, renderWithUser } from '../../dialog/test-utils';

describe('<Popover.Root />', () => {
  it('opens by trigger from a descendant effect on initial mount', () => {
    const handle = Popover.createHandle();
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    function OpenOnMount() {
      onSettled(() => {
        handle.open('trigger');
      });
      return null;
    }

    render(() => (
      <Popover.Root handle={handle}>
        <Popover.Trigger id="trigger">Trigger</Popover.Trigger>
        <OpenOnMount />
      </Popover.Root>
    ));
    flush();

    const detachedWarned = consoleWarn.mock.calls.some(
      ([message]) =>
        typeof message === 'string' && message.includes('no root using this handle is mounted'),
    );
    consoleWarn.mockRestore();

    expect(detachedWarned).toBe(false);
    expect(handle.isOpen).toBe(true);
    expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  // React-only: these cover ref mergers that retain the first ref callback they were given
  // (`useComposeRef`), which re-fire across host swaps. Solid ref callbacks are called once per
  // element and never with `null`.
  it.skip('hands off hover between detached triggers when the rendered component retains a stale ref', () => {});
  it.skip('keeps registration on the attached store when a stale-ref component swaps its host node', () => {});

  it('registers detached triggers on the attached root store', () => {
    const handle = Popover.createHandle<number>();
    const fallbackStore = handle.store;

    render(() => (
      <>
        <For each={[1, 2]}>
          {(payload) => (
            <Popover.Trigger handle={handle} id={`trigger-${payload}`} payload={payload}>
              Trigger {payload}
            </Popover.Trigger>
          )}
        </For>
        <Popover.Root handle={handle}>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup data-testid="popup">Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </>
    ));
    flush();

    expect(fallbackStore.context.triggerElements.size).toBe(0);
    expect(handle.store.context.triggerElements.size).toBe(2);
  });

  it('does not detach the consumer ref when the handle attaches to a root', () => {
    const handle = Popover.createHandle();
    const refCalls: (Element | null)[] = [];

    render(() => (
      <>
        <Popover.Trigger
          handle={handle}
          id="trigger"
          ref={(element: HTMLElement) => {
            refCalls.push(element);
          }}
        >
          Trigger
        </Popover.Trigger>
        <Popover.Root handle={handle}>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </>
    ));
    flush();

    expect(handle.store.context.triggerElements.getById('trigger')).toBe(
      screen.getByRole('button', { name: 'Trigger' }),
    );
    expect(refCalls).toEqual([screen.getByRole('button', { name: 'Trigger' })]);
  });

  // Upstream counts re-renders of an inactive trigger. Solid components don't re-render: the
  // `render` callback is called once, so these check that the open/close flows never recreate the
  // inactive trigger's element.
  describe('does not re-render inactive triggers', () => {
    function renderPopover(
      options: {
        rootProps?: Partial<Popover.Root.Props>;
        triggerProps?: Partial<Popover.Trigger.Props>;
        popupChildren?: () => JSX.Element;
      } = {},
    ) {
      const handle = Popover.createHandle();
      const inactiveTrigger = { renders: 0 };

      const { user } = renderWithUser(() => (
        <div>
          <Popover.Trigger handle={handle} id="trigger-1" {...options.triggerProps}>
            Trigger 1
          </Popover.Trigger>
          <Popover.Trigger handle={handle} id="trigger-2" {...options.triggerProps}>
            Trigger 2
          </Popover.Trigger>
          <Popover.Trigger
            handle={handle}
            id="trigger-3"
            {...options.triggerProps}
            render={(props) => {
              inactiveTrigger.renders += 1;
              return <button {...props} />;
            }}
          >
            Trigger 3
          </Popover.Trigger>
          <Popover.Root handle={handle} {...options.rootProps}>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="popup">
                  Content
                  {options.popupChildren?.()}
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </div>
      ));
      flush();

      inactiveTrigger.renders = 0;
      return {
        user,
        handle,
        inactiveTrigger,
        trigger: screen.getByRole('button', { name: 'Trigger 1' }),
        trigger2: screen.getByRole('button', { name: 'Trigger 2' }),
        trigger3: screen.getByRole('button', { name: 'Trigger 3' }),
      };
    }

    async function expectOpenedBy(trigger: HTMLElement) {
      expect(await screen.findByTestId('popup')).not.toBe(null);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });
    }

    async function expectClosed(trigger: HTMLElement) {
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }

    it('when a click opens and closes the popup', async () => {
      const { user, inactiveTrigger, trigger, trigger3 } = renderPopover();

      async function openAndClose() {
        await user.click(trigger);
        await expectOpenedBy(trigger);
        await user.click(trigger);
        await expectClosed(trigger);
      }

      await openAndClose();
      await openAndClose();

      expect(inactiveTrigger.renders).toBe(0);
      expect(screen.getByRole('button', { name: 'Trigger 3' })).toBe(trigger3);
    });

    it('when a touch press opens and closes the popup', async () => {
      const { user, inactiveTrigger, trigger } = renderPopover();

      async function openAndClose() {
        await user.pointer({ keys: '[TouchA]', target: trigger });
        await expectOpenedBy(trigger);
        await user.pointer({ keys: '[TouchA]', target: trigger });
        await expectClosed(trigger);
      }

      await openAndClose();
      await openAndClose();

      expect(inactiveTrigger.renders).toBe(0);
    });

    it('when a modal popup closes from Popover.Close', async () => {
      const { user, inactiveTrigger, trigger } = renderPopover({
        rootProps: { modal: true },
        popupChildren: () => <Popover.Close>Close</Popover.Close>,
      });

      async function openAndClose() {
        await user.click(trigger);
        await expectOpenedBy(trigger);
        await user.click(screen.getByRole('button', { name: 'Close' }));
        await expectClosed(trigger);
      }

      await openAndClose();
      await openAndClose();

      expect(inactiveTrigger.renders).toBe(0);
    });

    it('when the popup moves to another trigger', async () => {
      const { user, inactiveTrigger, trigger, trigger2 } = renderPopover();

      await user.click(trigger);
      await expectOpenedBy(trigger);
      await user.click(trigger2);
      await expectOpenedBy(trigger2);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('data-pressed');
      expect(trigger2).toHaveAttribute('data-pressed');
      await waitFor(() => {
        expect(trigger2.previousElementSibling).toHaveAttribute('data-base-ui-focus-guard');
      });
      expect(trigger.previousElementSibling).toBe(null);
      expect(trigger2.nextElementSibling).toHaveAttribute('data-base-ui-focus-guard');
      await user.click(trigger2);
      await expectClosed(trigger2);

      expect(inactiveTrigger.renders).toBe(0);
    });

    describe('with openOnHover', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });
      afterEach(() => {
        vi.useRealTimers();
      });

      it('when a hover opens the popup', async () => {
        const { handle, inactiveTrigger, trigger } = renderPopover({
          triggerProps: { openOnHover: true, delay: 0, closeDelay: 0 },
        });

        async function openAndClose() {
          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger);
          await flushMicrotasks();
          expect(screen.queryByTestId('popup')).not.toBe(null);
          expect(trigger).toHaveAttribute('aria-expanded', 'true');

          // Covers the patient-click window ending while open.
          vi.advanceTimersByTime(PATIENT_CLICK_THRESHOLD);
          fireEvent.mouseLeave(trigger);
          await act(() => handle.close());
          await flushMicrotasks();
          expect(screen.queryByTestId('popup')).toBe(null);
          expect(trigger).toHaveAttribute('aria-expanded', 'false');
        }

        await openAndClose();
        await openAndClose();

        expect(inactiveTrigger.renders).toBe(0);
      });

      it('when a press takes over a hover-opened popup', async () => {
        const { handle, inactiveTrigger, trigger } = renderPopover({
          triggerProps: { openOnHover: true, delay: 0, closeDelay: 0 },
        });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);
        await flushMicrotasks();
        expect(screen.queryByTestId('popup')).not.toBe(null);

        // A press inside the patient-click window keeps it open and changes the open reason.
        fireEvent.click(trigger);
        await flushMicrotasks();
        expect(trigger).toHaveAttribute('data-pressed');

        fireEvent.mouseLeave(trigger);
        await act(() => handle.close());
        await flushMicrotasks();
        expect(screen.queryByTestId('popup')).toBe(null);

        expect(inactiveTrigger.renders).toBe(0);
      });
    });
  });

  describe('after a prop-only reopen', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('keeps the popup open when the last hovered trigger is pressed', async () => {
      const handle = Popover.createHandle();
      const [open, setOpen] = createSignal(false);

      render(() => (
        <div>
          <Popover.Trigger handle={handle} id="trigger-1" openOnHover delay={0}>
            Trigger 1
          </Popover.Trigger>
          <Popover.Trigger handle={handle} id="trigger-2">
            Trigger 2
          </Popover.Trigger>
          <Popover.Root handle={handle} open={open()} onOpenChange={(next) => setOpen(next)}>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="popup">Content</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </div>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger 1' });

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      await flushMicrotasks();
      expect(screen.queryByTestId('popup')).not.toBe(null);
      // End the hover's patient-click window so only the close-time reset keeps the click sticky.
      vi.advanceTimersByTime(PATIENT_CLICK_THRESHOLD);

      await act(() => setOpen(false));
      expect(screen.queryByTestId('popup')).toBe(null);

      await act(() => setOpen(true));
      expect(screen.queryByTestId('popup')).not.toBe(null);

      fireEvent.click(trigger);
      await flushMicrotasks();
      expect(screen.queryByTestId('popup')).not.toBe(null);
    });
  });

  it('dismisses a keyboard-reopened popup on a virtual outside click after a touch session', async () => {
    const handle = Popover.createHandle();
    const { user } = renderWithUser(() => (
      <>
        <button>Outside</button>
        <Popover.Trigger handle={handle} id="trigger">
          Trigger
        </Popover.Trigger>
        <Popover.Root handle={handle}>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup data-testid="popup">Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </>
    ));

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    await user.click(trigger);
    const popup = await screen.findByTestId('popup');

    fireEvent.pointerDown(popup, { pointerType: 'touch', button: 0 });
    fireEvent.pointerUp(popup, { pointerType: 'touch', button: 0 });
    fireEvent.click(popup);
    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });

    await act(() => trigger.focus());
    await user.keyboard('[Enter]');
    await screen.findByTestId('popup');

    // Virtual clicks have no pointerdown to replace the previous session's touch type.
    fireEvent.click(screen.getByRole('button', { name: 'Outside' }), { detail: 0 });
    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  // Upstream runs these only in a real browser: they rely on real focus restoration, CSS
  // transitions/animations (`trigger-change` instant restoration) and layout.
  describe.skip('multiple triggers within Root', () => {
    it('returns focus to the active trigger when opening programmatically from body focus', () => {});
    it('returns focus to the previous element when the trigger unmounts while open', () => {});
  });
  describe.skip('multiple detached triggers', () => {
    it('does not apply or restore the trigger-change instant across closes and reopens', () => {});
    it('renders focus guards around the active detached trigger and reports it on close', () => {});
    it('keeps positioning correct when conditional triggers unmount and the tree remounts', () => {});
  });
});
