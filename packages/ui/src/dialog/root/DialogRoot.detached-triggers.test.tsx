import { Match, Show, Switch, createSignal, onSettled } from 'solid-js';
import { fireEvent, render, screen, waitFor, within } from '@solidjs/testing-library';
import { Dialog } from '..';
import {
  act,
  detachedTriggersConformanceTests,
  renderWithProps,
  renderWithUser,
  wait,
} from '../test-utils';

type NumberPayload = { readonly payload: number | undefined };

describe('<Dialog.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  detachedTriggersConformanceTests({
    createHandle: Dialog.createHandle,
    Root: Dialog.Root,
    Trigger: Dialog.Trigger,
    Portal: Dialog.Portal,
    Popup: Dialog.Popup,
    Close: Dialog.Close,
  });

  // Solid calls render functions once: an inactive trigger's `render` must not run again when the
  // popup opens, closes or moves to another trigger.
  describe('does not re-render inactive triggers', () => {
    function renderDialog() {
      const handle = Dialog.createHandle();
      const bystander = { renders: 0 };

      const { user } = renderWithUser(() => (
        <div>
          <Dialog.Trigger handle={handle} id="trigger-1">
            Trigger 1
          </Dialog.Trigger>
          <Dialog.Trigger handle={handle} id="trigger-2">
            Trigger 2
          </Dialog.Trigger>
          <Dialog.Trigger
            handle={handle}
            id="trigger-3"
            render={(props) => {
              bystander.renders += 1;
              return <button {...props} />;
            }}
          >
            Trigger 3
          </Dialog.Trigger>
          <Dialog.Root handle={handle}>
            <Dialog.Portal>
              <Dialog.Popup data-testid="popup">Content</Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      ));

      bystander.renders = 0;
      return {
        user,
        handle,
        bystander,
        trigger1: screen.getByRole('button', { name: 'Trigger 1' }),
        trigger2: screen.getByRole('button', { name: 'Trigger 2' }),
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

    it('when the popup opens and closes', async () => {
      const { user, bystander, trigger1 } = renderDialog();

      async function openAndClose() {
        await user.click(trigger1);
        await expectOpenedBy(trigger1);
        await user.keyboard('[Escape]');
        await expectClosed(trigger1);
      }

      await openAndClose();
      await openAndClose();
      expect(bystander.renders).toBe(0);
    });

    it('when the popup moves to another trigger', async () => {
      const { handle, bystander, trigger1, trigger2 } = renderDialog();

      await act(() => handle.open('trigger-1'));
      await expectOpenedBy(trigger1);
      await act(() => handle.open('trigger-2'));
      await expectOpenedBy(trigger2);
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      await act(() => handle.close());
      await expectClosed(trigger2);

      expect(bystander.renders).toBe(0);
    });
  });

  // Popover is not ported yet.
  it.skip('closes a nonmodal dialog on Escape from an inactive trigger inside a popover on every open', () => {});

  it('opens a handle-backed dialog as topmost over a dialog that opened while it was closed', async () => {
    const help = Dialog.createHandle();

    const { user } = renderWithUser(() => (
      <Dialog.Root handle={help}>
        <Dialog.Portal>
          <Dialog.Backdrop data-testid="help-backdrop" />
          <Dialog.Popup data-testid="help">Help</Dialog.Popup>
        </Dialog.Portal>
        <Dialog.Root>
          <Dialog.Trigger>Open section</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup data-testid="section">
              <Dialog.Trigger handle={help}>Open help</Dialog.Trigger>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </Dialog.Root>
    ));

    async function openHelp() {
      await user.click(screen.getByRole('button', { name: 'Open help' }));
      expect(await screen.findByTestId('help')).not.toBe(null);
      expect(screen.getByTestId('help')).not.toHaveAttribute('data-nested-dialog-open');
      expect(screen.getByTestId('help').style.getPropertyValue('--nested-dialogs')).toBe('0');
    }

    await user.click(screen.getByRole('button', { name: 'Open section' }));
    expect(await screen.findByTestId('section')).not.toBe(null);

    await openHelp();
    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(screen.queryByTestId('help')).toBe(null);
    });
    expect(screen.queryByTestId('section')).not.toBe(null);

    await openHelp();
    await user.click(screen.getByTestId('help-backdrop'));
    await waitFor(() => {
      expect(screen.queryByTestId('help')).toBe(null);
    });
    expect(screen.queryByTestId('section')).not.toBe(null);
  });

  it('resets nested state recorded while open when a handle-backed dialog closes', async () => {
    const help = Dialog.createHandle();
    const section = Dialog.createHandle();

    render(() => (
      <Dialog.Root handle={help}>
        <Dialog.Portal>
          <Dialog.Popup data-testid="help">Help</Dialog.Popup>
        </Dialog.Portal>
        <Dialog.Root handle={section}>
          <Dialog.Portal>
            <Dialog.Popup data-testid="section">Section</Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </Dialog.Root>
    ));

    await act(() => help.open(null));
    await act(() => section.open(null));
    expect(await screen.findByTestId('section')).not.toBe(null);
    await waitFor(() => {
      expect(screen.getByTestId('help')).toHaveAttribute('data-nested-dialog-open');
    });

    // The section dialog stays open, so it never sends a zeroed count.
    await act(() => help.close());
    await waitFor(() => {
      expect(screen.queryByTestId('help')).toBe(null);
    });
    expect(screen.queryByTestId('section')).not.toBe(null);

    await act(() => help.open(null));
    expect(await screen.findByTestId('help')).not.toHaveAttribute('data-nested-dialog-open');
    expect(screen.getByTestId('help').style.getPropertyValue('--nested-dialogs')).toBe('0');
  });

  it('updates the parent nested state each time a handle-backed nested dialog opens and closes', async () => {
    const child = Dialog.createHandle();

    const { user } = renderWithUser(() => (
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Popup data-testid="parent">
            <Dialog.Trigger handle={child}>Open child</Dialog.Trigger>
            <Dialog.Root handle={child}>
              <Dialog.Portal>
                <Dialog.Popup data-testid="child">
                  <Dialog.Close>Close child</Dialog.Close>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    const parent = await screen.findByTestId('parent');

    async function openAndCloseChild() {
      await user.click(screen.getByRole('button', { name: 'Open child' }));
      expect(await screen.findByTestId('child')).not.toBe(null);
      await waitFor(() => {
        expect(parent).toHaveAttribute('data-nested-dialog-open');
      });
      expect(parent.style.getPropertyValue('--nested-dialogs')).toBe('1');

      await user.click(screen.getByRole('button', { name: 'Close child' }));
      await waitFor(() => {
        expect(screen.queryByTestId('child')).toBe(null);
      });
      expect(parent).not.toHaveAttribute('data-nested-dialog-open');
      expect(parent.style.getPropertyValue('--nested-dialogs')).toBe('0');
    }

    await openAndCloseChild();
    await openAndCloseChild();
  });

  it('keeps the parent nested state when a closed handle-backed nested dialog mounts', async () => {
    const handle = Dialog.createHandle();
    const handleParentOpenChange = vi.fn();

    const { user } = renderWithUser(() => (
      <Dialog.Root defaultOpen onOpenChange={handleParentOpenChange}>
        <Dialog.Portal>
          <Dialog.Backdrop data-testid="parent-backdrop" />
          <Dialog.Popup data-testid="parent">
            <Dialog.Root defaultOpen>
              <Dialog.Portal>
                <Dialog.Popup data-testid="nested">Nested</Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
            {/* Must come after the open sibling so its effects run last. */}
            <Dialog.Root handle={handle}>
              <Dialog.Portal>
                <Dialog.Popup>Closed</Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    await screen.findByTestId('nested');
    expect(screen.getByTestId('parent')).toHaveAttribute('data-nested-dialog-open');

    // The parent isn't topmost while the nested dialog is open, so its backdrop doesn't dismiss it.
    await user.click(screen.getByTestId('parent-backdrop'));
    expect(handleParentOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('parent')).toBeVisible();
  });

  describe('handle-backed root ownership', () => {
    // Server rendering + hydration is not covered by this (client-only) test setup.
    it.skip('hydrates a detached trigger from the stable fallback store', () => {});
    // React Suspense during hydration is React-only.
    it.skip('keeps the server snapshot stable when the root closes before a delayed trigger hydrates', () => {});

    it('opens from a descendant effect on initial mount', () => {
      const handle = Dialog.createHandle();
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      function OpenOnMount() {
        onSettled(() => {
          handle.open(null);
        });
        return null;
      }

      render(() => (
        <Dialog.Root handle={handle}>
          <OpenOnMount />
        </Dialog.Root>
      ));

      const detachedWarned = consoleWarn.mock.calls.some(
        ([message]) =>
          typeof message === 'string' && message.includes('no root using this handle is mounted'),
      );
      consoleWarn.mockRestore();

      expect(detachedWarned).toBe(false);
      expect(handle.isOpen).toBe(true);
    });

    it('opens with a payload from a descendant effect on initial mount', async () => {
      const handle = Dialog.createHandle<number>();
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      function OpenOnMount() {
        onSettled(() => {
          handle.openWithPayload(8);
        });
        return null;
      }

      render(() => (
        <Dialog.Root handle={handle}>
          {(arg: NumberPayload) => (
            <>
              <span data-testid="payload">{arg.payload ?? 'No payload'}</span>
              <OpenOnMount />
            </>
          )}
        </Dialog.Root>
      ));

      const detachedWarned = consoleWarn.mock.calls.some(
        ([message]) =>
          typeof message === 'string' && message.includes('no root using this handle is mounted'),
      );
      consoleWarn.mockRestore();

      expect(detachedWarned).toBe(false);
      expect(handle.isOpen).toBe(true);
      await waitFor(() => {
        expect(screen.getByTestId('payload').textContent).toBe('8');
      });
    });

    it('closes from a descendant effect on an initially open root', () => {
      const handle = Dialog.createHandle();
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      function CloseOnMount() {
        onSettled(() => {
          handle.close();
        });
        return null;
      }

      render(() => (
        <Dialog.Root handle={handle} defaultOpen>
          <CloseOnMount />
        </Dialog.Root>
      ));

      const detachedWarned = consoleWarn.mock.calls.some(
        ([message]) =>
          typeof message === 'string' && message.includes('no root using this handle is mounted'),
      );
      consoleWarn.mockRestore();

      expect(detachedWarned).toBe(false);
      expect(handle.isOpen).toBe(false);
    });

    // `isDev` is resolved at build time in Solid, so production can't be simulated at runtime.
    it.skip('does not warn for a detached payload open in production', () => {});

    it('ignores openWithPayload() after the root unmounts and keeps the remounted root without payload', async () => {
      const handle = Dialog.createHandle<number>();

      const { setProps } = renderWithProps(
        (props: { mounted: boolean }) => (
          <Show when={props.mounted}>
            <Dialog.Root handle={handle}>
              {(arg: NumberPayload) => (
                <span data-testid="payload">{arg.payload ?? 'No payload'}</span>
              )}
            </Dialog.Root>
          </Show>
        ),
        { mounted: true },
      );
      await setProps({ mounted: false });

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        handle.openWithPayload(8);
        expect(
          consoleWarn.mock.calls.filter(
            ([message]) =>
              typeof message === 'string' &&
              message.includes('openWithPayload() was called while no root using this handle'),
          ),
        ).toHaveLength(1);
      } finally {
        consoleWarn.mockRestore();
      }
      expect(handle.isOpen).toBe(false);

      await setProps({ mounted: true });
      expect(handle.isOpen).toBe(false);
      expect(screen.getByTestId('payload').textContent).toBe('No payload');
    });

    // React transitions/Suspense (an abandoned render) have no Solid equivalent here.
    it.skip('does not attach a replacement root store from an abandoned transition render', () => {});

    it('attaches a fresh root store when the handle prop changes to a previously dirtied handle', async () => {
      const handleA = Dialog.createHandle<number>();
      const handleB = Dialog.createHandle<number>();

      function App() {
        const [phase, setPhase] = createSignal<'dirty' | 'main'>('dirty');
        const [handle, setHandle] = createSignal(handleA);

        return (
          <Show
            when={phase() === 'main'}
            fallback={
              <Dialog.Root handle={handleB}>
                {(arg: NumberPayload) => (
                  <>
                    <span data-testid="dirty-payload">{arg.payload ?? 'No payload'}</span>
                    <Dialog.Portal>
                      <Dialog.Popup>
                        Dirty dialog
                        <button type="button" onClick={() => setPhase('main')}>
                          Unmount dirty root
                        </button>
                      </Dialog.Popup>
                    </Dialog.Portal>
                  </>
                )}
              </Dialog.Root>
            }
          >
            <Dialog.Trigger handle={handle()} id="trigger" payload={1}>
              Trigger
            </Dialog.Trigger>
            <button type="button" onClick={() => setHandle(handleB)}>
              Switch to handle B
            </button>
            <Dialog.Root handle={handle()}>
              {(arg: NumberPayload) => (
                <>
                  <span data-testid="payload">{arg.payload ?? 'No payload'}</span>
                  <Dialog.Portal>
                    <Dialog.Popup>Dialog Content</Dialog.Popup>
                  </Dialog.Portal>
                </>
              )}
            </Dialog.Root>
          </Show>
        );
      }

      const { user } = renderWithUser(() => <App />);

      await act(() => handleB.openWithPayload(8));
      await waitFor(() => {
        expect(screen.getByText('Dirty dialog')).toBeVisible();
      });
      expect(screen.getByTestId('dirty-payload').textContent).toBe('8');

      await user.click(screen.getByRole('button', { name: 'Unmount dirty root' }));
      expect(handleB.isOpen).toBe(false);
      expect(screen.queryByRole('dialog')).toBe(null);
      expect(screen.getByTestId('payload').textContent).toBe('No payload');

      await user.click(screen.getByRole('button', { name: 'Switch to handle B' }));
      expect(handleB.isOpen).toBe(false);
      expect(screen.queryByRole('dialog')).toBe(null);
      expect(screen.getByTestId('payload').textContent).toBe('No payload');

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });
      expect(screen.getByTestId('payload').textContent).toBe('1');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('keeps a handle-backed dialog open and controllable across handle swaps on a live root', async () => {
      const handleA = Dialog.createHandle();
      const handleB = Dialog.createHandle();

      function App() {
        const [handle, setHandle] = createSignal(handleA);

        return (
          <>
            <Dialog.Trigger handle={handle()} id="trigger">
              Trigger
            </Dialog.Trigger>
            <button type="button" onClick={() => setHandle(handleA)}>
              Use handle A
            </button>
            <button type="button" onClick={() => setHandle(handleB)}>
              Use handle B
            </button>
            <Dialog.Root handle={handle()} modal={false} disablePointerDismissal>
              <Dialog.Portal>
                <Dialog.Popup>Dialog Content</Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </>
        );
      }

      const { user } = renderWithUser(() => <App />);
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });

      // The store is owned by the Root, so swapping the handle re-attaches it without resetting state.
      await user.click(screen.getByRole('button', { name: 'Use handle B' }));
      expect(screen.getByText('Dialog Content')).toBeVisible();
      expect(handleB.isOpen).toBe(true);
      expect(handleA.isOpen).toBe(false);
      await waitFor(() => {
        expect(trigger.getAttribute('aria-controls')).toBe(
          screen.getByRole('dialog').getAttribute('id'),
        );
      });

      // Swapping back to a previously-attached handle keeps working (no stale registrations).
      await user.click(screen.getByRole('button', { name: 'Use handle A' }));
      expect(screen.getByText('Dialog Content')).toBeVisible();
      expect(handleA.isOpen).toBe(true);
      expect(handleB.isOpen).toBe(false);

      // The currently-attached handle controls the live dialog.
      await act(() => handleA.close());
      await waitFor(() => {
        expect(screen.queryByText('Dialog Content')).toBe(null);
      });
    });

    it('attaches and detaches a handle when the prop toggles on a live root', async () => {
      const handle = Dialog.createHandle();
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      function App() {
        const [attached, setAttached] = createSignal(false);

        return (
          <>
            <Dialog.Trigger handle={handle} id="trigger">
              Trigger
            </Dialog.Trigger>
            <button type="button" onClick={() => setAttached((value) => !value)}>
              Toggle handle
            </button>
            <Dialog.Root
              handle={attached() ? handle : undefined}
              modal={false}
              disablePointerDismissal
            >
              <Dialog.Portal>
                <Dialog.Popup>Dialog Content</Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </>
        );
      }

      const { user } = renderWithUser(() => <App />);
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await act(() => handle.open('trigger'));
      expect(handle.isOpen).toBe(false);
      expect(screen.queryByRole('dialog')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Toggle handle' }));
      await act(() => handle.open('trigger'));

      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });
      expect(trigger.getAttribute('aria-controls')).toBe(
        screen.getByRole('dialog').getAttribute('id'),
      );

      await act(() => handle.close());
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });

      await user.click(screen.getByRole('button', { name: 'Toggle handle' }));
      await act(() => handle.open('trigger'));
      expect(handle.isOpen).toBe(false);
      expect(screen.queryByRole('dialog')).toBe(null);

      const detachedWarnings = consoleWarn.mock.calls.filter(
        ([message]) =>
          typeof message === 'string' && message.includes('no root using this handle is mounted'),
      );
      consoleWarn.mockRestore();
      expect(detachedWarnings).toHaveLength(2);
    });

    it('associates the requested trigger when opened by id in the same pass a root attaches', async () => {
      const handle = Dialog.createHandle<number>();

      function OpenOnMount() {
        onSettled(() => {
          handle.open('trigger');
        });
        return null;
      }

      render(() => (
        <>
          <Dialog.Trigger handle={handle} id="other" payload={9}>
            Other
          </Dialog.Trigger>
          <Dialog.Trigger handle={handle} id="trigger" payload={5}>
            Trigger
          </Dialog.Trigger>
          <Dialog.Root handle={handle}>
            {(arg: NumberPayload) => (
              <>
                <span data-testid="payload">{arg.payload ?? 'No payload'}</span>
                <Dialog.Portal>
                  <Dialog.Popup>Dialog Content</Dialog.Popup>
                </Dialog.Portal>
              </>
            )}
          </Dialog.Root>
          <OpenOnMount />
        </>
      ));

      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });

      // The requested trigger is associated (ARIA + its own payload), not the other detached trigger.
      const requestedTrigger = screen.getByRole('button', { name: 'Trigger', hidden: true });
      const otherTrigger = screen.getByRole('button', { name: 'Other', hidden: true });
      expect(requestedTrigger).toHaveAttribute('aria-expanded', 'true');
      expect(requestedTrigger.getAttribute('aria-controls')).toBe(
        screen.getByRole('dialog').getAttribute('id'),
      );
      expect(otherTrigger).not.toHaveAttribute('aria-controls');
      expect(screen.getByTestId('payload').textContent).toBe('5');
    });

    describe('multiple roots sharing one handle', () => {
      const overlapWarned = (consoleWarn: { mock: { calls: unknown[][] } }) =>
        consoleWarn.mock.calls.some(
          ([message]) => typeof message === 'string' && message.includes('more than one mounted root'),
        );

      type Phase = 'outgoing' | 'overlap' | 'incoming';

      function renderTransitioningRoots(handle: ReturnType<typeof Dialog.createHandle>) {
        return renderWithProps(
          (props: { phase: Phase }) => (
            <>
              <Show when={props.phase === 'outgoing' || props.phase === 'overlap'}>
                <Dialog.Root handle={handle}>
                  <Dialog.Portal>
                    <Dialog.Popup>Outgoing</Dialog.Popup>
                  </Dialog.Portal>
                </Dialog.Root>
              </Show>
              <Show when={props.phase === 'overlap' || props.phase === 'incoming'}>
                <Dialog.Root handle={handle}>
                  <Dialog.Portal>
                    <Dialog.Popup>Incoming</Dialog.Popup>
                  </Dialog.Portal>
                </Dialog.Root>
              </Show>
            </>
          ),
          { phase: 'outgoing' as Phase },
        );
      }

      it('does not warn when one root replaces another during a route transition', async () => {
        const handle = Dialog.createHandle();
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const { setProps } = renderTransitioningRoots(handle);
        // The incoming root mounts while the outgoing one is still mounted (overlap)...
        await setProps({ phase: 'overlap' });
        // ...then the outgoing root unmounts, completing a clean handoff, all before the deferred
        // check runs.
        await setProps({ phase: 'incoming' });

        await act(() => wait(50));

        expect(overlapWarned(consoleWarn)).toBe(false);
        consoleWarn.mockRestore();
      });

      it('keeps the newer root attached after the older root unmounts', async () => {
        const handle = Dialog.createHandle();

        const { setProps } = renderTransitioningRoots(handle);
        await setProps({ phase: 'overlap' });
        await setProps({ phase: 'incoming' });

        await act(() => wait(50));

        await act(() => handle.open(null));

        expect(screen.getByText('Incoming')).toBeVisible();
        expect(screen.queryByText('Outgoing')).toBe(null);
        expect(handle.isOpen).toBe(true);
      });

      it('restores control to the previous root when a newer overlapping root detaches', async () => {
        const handle = Dialog.createHandle();
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const { setProps } = renderTransitioningRoots(handle);
        await setProps({ phase: 'overlap' });
        // The transition is canceled: the newer (incoming) root unmounts first while the older
        // (outgoing) root stays mounted.
        await setProps({ phase: 'outgoing' });

        await act(() => wait(50));

        // The still-mounted outgoing root regains control of the handle instead of being left inert.
        await act(() => handle.open(null));

        expect(screen.getByText('Outgoing')).toBeVisible();
        expect(screen.queryByText('Incoming')).toBe(null);
        expect(handle.isOpen).toBe(true);
        // A canceled transient overlap should not warn.
        expect(overlapWarned(consoleWarn)).toBe(false);
        consoleWarn.mockRestore();
      });

      it('warns when two roots stay attached to the same handle', async () => {
        const handle = Dialog.createHandle();
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const { setProps } = renderTransitioningRoots(handle);
        await setProps({ phase: 'overlap' });

        await act(() => wait(50));

        expect(overlapWarned(consoleWarn)).toBe(true);
        consoleWarn.mockRestore();
      });

      // React Strict Mode effect replay has no Solid equivalent.
      it.skip('keeps the root attached through Strict Mode effect replay', () => {});
    });
  });

  describe('multiple triggers within Root', () => {
    it('keeps the payload reactive', async () => {
      function App() {
        const [payloads, setPayloads] = createSignal([1, 2]);

        return (
          <div>
            <Dialog.Root>
              {(arg: NumberPayload) => (
                <>
                  <Dialog.Trigger id="trigger-1" payload={payloads()[0]}>
                    Dialog 1
                  </Dialog.Trigger>
                  <Dialog.Trigger id="trigger-2" payload={payloads()[1]}>
                    Dialog 2
                  </Dialog.Trigger>

                  <Dialog.Portal>
                    <Dialog.Popup>
                      <span data-testid="content">{arg.payload}</span>
                      <button type="button" onClick={() => setPayloads([8, 16])}>
                        Update payloads
                      </button>
                    </Dialog.Popup>
                  </Dialog.Portal>
                </>
              )}
            </Dialog.Root>
          </div>
        );
      }

      const { user } = renderWithUser(() => <App />);

      await user.click(screen.getByRole('button', { name: 'Dialog 1' }));
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await user.click(screen.getByRole('button', { name: 'Update payloads' }));
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('8');
      });
    });
  });

  describe('multiple detached triggers', () => {
    it('attaches fresh root state when the root remounts after being unmounted while open', async () => {
      const testDialog = Dialog.createHandle();

      function App() {
        const [mounted, setMounted] = createSignal(true);

        return (
          <div>
            <Dialog.Trigger handle={testDialog} id="trigger-1">
              Trigger 1
            </Dialog.Trigger>
            <Dialog.Trigger handle={testDialog} id="trigger-2">
              Trigger 2
            </Dialog.Trigger>
            <Show
              when={mounted()}
              fallback={
                <button type="button" onClick={() => setMounted(true)}>
                  Remount root
                </button>
              }
            >
              <Dialog.Root handle={testDialog}>
                <Dialog.Portal>
                  <Dialog.Popup>
                    Dialog Content
                    <button type="button" onClick={() => setMounted(false)}>
                      Unmount root
                    </button>
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
            </Show>
          </div>
        );
      }

      const { user } = renderWithUser(() => <App />);
      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.click(trigger1);
      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });

      await user.click(screen.getByRole('button', { name: 'Unmount root' }));
      expect(screen.queryByText('Dialog Content')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Remount root' }));
      expect(screen.queryByText('Dialog Content')).toBe(null);
      await waitFor(() => {
        expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      });

      await user.click(trigger1);
      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });

      expect(trigger1).toHaveAttribute('aria-expanded', 'true');
      expect(trigger1.getAttribute('aria-controls')).toBe(
        screen.getByRole('dialog').getAttribute('id'),
      );
      expect(trigger2).toHaveAttribute('aria-expanded', 'false');
    });

    it('resets stale payload when a handle-backed root remounts', async () => {
      const testDialog = Dialog.createHandle<number>();

      function App() {
        const [mounted, setMounted] = createSignal(true);

        return (
          <div>
            <Show
              when={mounted()}
              fallback={
                <button type="button" onClick={() => setMounted(true)}>
                  Remount root
                </button>
              }
            >
              <Dialog.Root handle={testDialog}>
                {(arg: NumberPayload) => (
                  <>
                    <span data-testid="payload">{arg.payload ?? 'No payload'}</span>
                    <Dialog.Portal>
                      <Dialog.Popup>
                        Dialog Content
                        <button type="button" onClick={() => setMounted(false)}>
                          Unmount root
                        </button>
                      </Dialog.Popup>
                    </Dialog.Portal>
                  </>
                )}
              </Dialog.Root>
            </Show>
          </div>
        );
      }

      const { user } = renderWithUser(() => <App />);

      expect(screen.getByTestId('payload').textContent).toBe('No payload');

      await act(() => testDialog.openWithPayload(8));
      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });
      expect(screen.getByTestId('payload').textContent).toBe('8');

      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Unmount root' }),
      );
      expect(screen.queryByTestId('payload')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Remount root' }));
      expect(screen.queryByRole('dialog')).toBe(null);
      expect(screen.getByTestId('payload').textContent).toBe('No payload');
    });

    it('notifies persistent detached triggers after attaching fresh root state on remount', async () => {
      const testDialog = Dialog.createHandle();

      function RouteRoot() {
        const [mounted, setMounted] = createSignal(true);

        return (
          <Show
            when={mounted()}
            fallback={
              <button type="button" onClick={() => setMounted(true)}>
                Remount root
              </button>
            }
          >
            <Dialog.Root handle={testDialog}>
              <Dialog.Portal>
                <Dialog.Popup>
                  Dialog Content
                  <button type="button" onClick={() => setMounted(false)}>
                    Unmount root
                  </button>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </Show>
        );
      }

      const { user } = renderWithUser(() => (
        <>
          <Dialog.Trigger handle={testDialog} id="trigger">
            Trigger
          </Dialog.Trigger>
          <RouteRoot />
        </>
      ));
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger.getAttribute('aria-controls')).toBe(
        screen.getByRole('dialog').getAttribute('id'),
      );

      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Unmount root' }),
      );
      expect(screen.queryByText('Dialog Content')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Remount root' }));
      expect(screen.queryByText('Dialog Content')).toBe(null);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });
      expect(trigger).not.toHaveAttribute('aria-controls');
    });

    it('resets stale controlled open state when a handle-backed root remounts uncontrolled', async () => {
      const testDialog = Dialog.createHandle();

      function App() {
        const [mode, setMode] = createSignal<'controlled' | 'unmounted' | 'uncontrolled'>(
          'controlled',
        );

        return (
          <div>
            <Dialog.Trigger handle={testDialog} id="trigger">
              Trigger
            </Dialog.Trigger>
            <button type="button" onClick={() => setMode('unmounted')}>
              Unmount root
            </button>
            <Switch>
              <Match when={mode() === 'unmounted'}>
                <button type="button" onClick={() => setMode('uncontrolled')}>
                  Remount uncontrolled root
                </button>
              </Match>
              <Match when={mode() === 'controlled'}>
                <Dialog.Root handle={testDialog} open triggerId="trigger">
                  <Dialog.Portal>
                    <Dialog.Popup>
                      Dialog Content
                      <button type="button" onClick={() => setMode('unmounted')}>
                        Unmount root
                      </button>
                    </Dialog.Popup>
                  </Dialog.Portal>
                </Dialog.Root>
              </Match>
              <Match when={mode() === 'uncontrolled'}>
                <Dialog.Root handle={testDialog}>
                  <Dialog.Portal>
                    <Dialog.Popup>Dialog Content</Dialog.Popup>
                  </Dialog.Portal>
                </Dialog.Root>
              </Match>
            </Switch>
          </div>
        );
      }

      const { user } = renderWithUser(() => <App />);

      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });

      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Unmount root' }),
      );
      expect(screen.queryByText('Dialog Content')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Remount uncontrolled root' }));
      expect(screen.queryByText('Dialog Content')).toBe(null);
    });

    it('opens a handle-backed root that remounts controlled after being uncontrolled', async () => {
      const testDialog = Dialog.createHandle();

      function App() {
        const [mode, setMode] = createSignal<'uncontrolled' | 'unmounted' | 'controlled'>(
          'uncontrolled',
        );

        return (
          <div>
            <Dialog.Trigger handle={testDialog} id="trigger">
              Trigger
            </Dialog.Trigger>
            <button type="button" onClick={() => setMode('unmounted')}>
              Unmount root
            </button>
            <Switch>
              <Match when={mode() === 'unmounted'}>
                <button type="button" onClick={() => setMode('controlled')}>
                  Remount controlled root
                </button>
              </Match>
              <Match when={mode() === 'uncontrolled'}>
                <Dialog.Root handle={testDialog}>
                  <Dialog.Portal>
                    <Dialog.Popup>Dialog Content</Dialog.Popup>
                  </Dialog.Portal>
                </Dialog.Root>
              </Match>
              <Match when={mode() === 'controlled'}>
                <Dialog.Root handle={testDialog} open triggerId="trigger">
                  <Dialog.Portal>
                    <Dialog.Popup>Dialog Content</Dialog.Popup>
                  </Dialog.Portal>
                </Dialog.Root>
              </Match>
            </Switch>
          </div>
        );
      }

      const { user } = renderWithUser(() => <App />);

      await user.click(screen.getByRole('button', { name: 'Unmount root' }));
      expect(screen.queryByText('Dialog Content')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Remount controlled root' }));
      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });
      expect(screen.getByRole('button', { name: 'Trigger', hidden: true })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });

    it('keeps ARIA controls in sync when a detached handle is recreated while open', async () => {
      // The Root and its trigger remount with the new handle (upstream remounts through React's
      // reconciliation of a new `handle` prop; here the Root follows the prop on the live store).
      const { setProps } = renderWithProps(
        (props: { handle: ReturnType<typeof Dialog.createHandle> }) => (
          <>
            <Dialog.Trigger id="trigger" handle={props.handle}>
              Trigger
            </Dialog.Trigger>
            <Dialog.Root handle={props.handle} open triggerId="trigger" modal={false}>
              <Dialog.Portal>
                <Dialog.Popup data-testid="popup">Dialog Content</Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </>
        ),
        { handle: Dialog.createHandle() },
      );

      let trigger = screen.getByRole('button', { name: 'Trigger' });
      let popup = await screen.findByTestId('popup');

      await waitFor(() => {
        expect(trigger.getAttribute('aria-controls')).toBe(popup.getAttribute('id'));
      });

      await setProps({ handle: Dialog.createHandle() });

      trigger = screen.getByRole('button', { name: 'Trigger' });
      popup = await screen.findByTestId('popup');

      await waitFor(() => {
        expect(trigger.getAttribute('aria-controls')).toBe(popup.getAttribute('id'));
      });
    });

    it('keeps the payload reactive', async () => {
      type NumberAccessorPayload = { readonly payload: (() => number) | undefined };
      const testDialog = Dialog.createHandle<() => number>();

      function Triggers() {
        // The payload lives in the triggers' own state, so updating it doesn't touch the Root.
        const [payloads, setPayloads] = createSignal([1, 2]);

        return (
          <div>
            <Dialog.Trigger id="trigger-1" payload={() => payloads()[0]} handle={testDialog}>
              Dialog 1
            </Dialog.Trigger>
            <Dialog.Trigger id="trigger-2" payload={() => payloads()[1]} handle={testDialog}>
              Dialog 2
            </Dialog.Trigger>
            <button type="button" onClick={() => setPayloads([8, 16])}>
              Update payloads
            </button>
          </div>
        );
      }

      const { user } = renderWithUser(() => (
        <div>
          <Triggers />
          <Dialog.Root modal={false} disablePointerDismissal handle={testDialog}>
            {(arg: NumberAccessorPayload) => (
              <Dialog.Portal>
                <Dialog.Popup>
                  <span data-testid="content">{arg.payload?.()}</span>
                </Dialog.Popup>
              </Dialog.Portal>
            )}
          </Dialog.Root>
        </div>
      ));

      await user.click(screen.getByRole('button', { name: 'Dialog 1' }));
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await user.click(screen.getByRole('button', { name: 'Update payloads' }));
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('8');
      });
    });

    it('closes a non-modal dialog with Escape from an inactive detached trigger', async () => {
      const testDialog = Dialog.createHandle();
      const { user } = renderWithUser(() => (
        <>
          <Dialog.Trigger handle={testDialog}>Trigger 1</Dialog.Trigger>
          <Dialog.Trigger handle={testDialog}>Trigger 2</Dialog.Trigger>
          <Dialog.Root handle={testDialog} modal={false}>
            <Dialog.Portal>
              <Dialog.Popup>Dialog Content</Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      ));

      await user.click(screen.getByRole('button', { name: 'Trigger 1' }));
      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });

      const inactiveTrigger = screen.getByRole('button', { name: 'Trigger 2' });
      await act(() => inactiveTrigger.focus());
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText('Dialog Content')).toBe(null);
      });
    });
  });

  describe('imperative actions on the handle', () => {
    it('associates an imperative open-by-id with a persistent detached trigger after the root remounts', async () => {
      const dialog = Dialog.createHandle<number>();

      function App() {
        const [mounted, setMounted] = createSignal(true);

        return (
          <div>
            <Dialog.Trigger handle={dialog} id="trigger" payload={7}>
              Trigger
            </Dialog.Trigger>
            <Show
              when={mounted()}
              fallback={
                <button type="button" onClick={() => setMounted(true)}>
                  Remount root
                </button>
              }
            >
              <Dialog.Root handle={dialog}>
                {(arg: NumberPayload) => (
                  <>
                    <span data-testid="payload">{arg.payload ?? 'No payload'}</span>
                    <Dialog.Portal>
                      <Dialog.Popup>
                        Dialog Content
                        <button type="button" onClick={() => setMounted(false)}>
                          Unmount root
                        </button>
                      </Dialog.Popup>
                    </Dialog.Portal>
                  </>
                )}
              </Dialog.Root>
            </Show>
          </div>
        );
      }

      const { user } = renderWithUser(() => <App />);
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await act(() => dialog.open('trigger'));
      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger.getAttribute('aria-controls')).toBe(
        screen.getByRole('dialog').getAttribute('id'),
      );
      expect(screen.getByTestId('payload').textContent).toBe('7');

      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Unmount root' }),
      );
      expect(screen.queryByRole('dialog')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Remount root' }));
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });

      // The trigger stayed mounted across the remount, so an imperative open-by-id must still
      // associate it (ARIA + payload), not open unassociated.
      await act(() => dialog.open('trigger'));
      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger.getAttribute('aria-controls')).toBe(
        screen.getByRole('dialog').getAttribute('id'),
      );
      expect(screen.getByTestId('payload').textContent).toBe('7');
    });

    it('stops resolving a handle-A trigger after the root switches to handle B', async () => {
      const handleA = Dialog.createHandle<number>();
      const handleB = Dialog.createHandle<number>();
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        function App() {
          const [handle, setHandle] = createSignal(handleA);
          return (
            <div>
              <Dialog.Trigger handle={handleA} id="a" payload={1}>
                A trigger
              </Dialog.Trigger>
              <button type="button" onClick={() => setHandle(handleB)}>
                Switch root to B
              </button>
              <Dialog.Root handle={handle()} modal={false} disablePointerDismissal>
                <Dialog.Portal>
                  <Dialog.Popup>Dialog Content</Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
          );
        }

        const { user } = renderWithUser(() => <App />);
        const aTrigger = screen.getByRole('button', { name: 'A trigger' });

        // Positive control: while the root is on handle A, opening by the A-trigger's id associates it.
        await act(() => handleA.open('a'));
        await waitFor(() => {
          expect(screen.getByText('Dialog Content')).toBeVisible();
        });
        expect(aTrigger).toHaveAttribute('aria-expanded', 'true');
        await act(() => handleA.close());
        await waitFor(() => {
          expect(screen.queryByText('Dialog Content')).toBe(null);
        });

        // The A-trigger stays mounted on handle A; only the root moves to handle B.
        await user.click(screen.getByRole('button', { name: 'Switch root to B' }));

        // Handle B's root must no longer resolve the handle-A trigger.
        consoleWarn.mockClear();
        await act(() => handleB.open('a'));
        await waitFor(() => {
          expect(screen.getByText('Dialog Content')).toBeVisible();
        });
        expect(aTrigger).toHaveAttribute('aria-expanded', 'false');
        expect(
          consoleWarn.mock.calls.some(
            ([message]) => typeof message === 'string' && message.includes('No trigger found'),
          ),
        ).toBe(true);
      } finally {
        consoleWarn.mockRestore();
      }
    });

    it('does not associate the only rendered trigger when opened with a payload', async () => {
      const dialog = Dialog.createHandle<string>();
      const { user } = renderWithUser(() => (
        <div>
          <Dialog.Trigger handle={dialog} id="trigger" payload="from trigger">
            Trigger
          </Dialog.Trigger>
          <Dialog.Root handle={dialog}>
            {(arg: { readonly payload: string | undefined }) => (
              <Dialog.Portal>
                <Dialog.Popup data-testid="content">{arg.payload}</Dialog.Popup>
              </Dialog.Portal>
            )}
          </Dialog.Root>
        </div>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await act(() => dialog.openWithPayload('from openWithPayload'));
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBe(null);
      });

      expect(screen.getByTestId('content').textContent).toBe('from openWithPayload');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).not.toHaveAttribute('data-popup-open');

      await act(() => dialog.close());
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });

      // Opening through the trigger afterwards still associates it and forwards its payload.
      await user.click(trigger);
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBe(null);
      });
      expect(screen.getByTestId('content').textContent).toBe('from trigger');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger.getAttribute('aria-controls')).toBe(
        screen.getByRole('dialog').getAttribute('id'),
      );
    });

    it('does not let a trigger that mounts while open replace the programmatic payload', async () => {
      const dialog = Dialog.createHandle<string>();

      const { setProps } = renderWithProps(
        (props: { showTrigger: boolean }) => (
          <div>
            <Show when={props.showTrigger}>
              <Dialog.Trigger handle={dialog} id="trigger" payload="from trigger">
                Trigger
              </Dialog.Trigger>
            </Show>
            <Dialog.Root handle={dialog}>
              {(arg: { readonly payload: string | undefined }) => (
                <Dialog.Portal>
                  <Dialog.Popup data-testid="content">{arg.payload}</Dialog.Popup>
                </Dialog.Portal>
              )}
            </Dialog.Root>
          </div>
        ),
        { showTrigger: false },
      );

      await act(() => dialog.openWithPayload('from openWithPayload'));
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBe(null);
      });
      expect(screen.getByTestId('content').textContent).toBe('from openWithPayload');

      await setProps({ showTrigger: true });

      expect(screen.getByTestId('content').textContent).toBe('from openWithPayload');
      // The modal dialog hides the rest of the page from the accessibility tree.
      const trigger = screen.getByRole('button', { name: 'Trigger', hidden: true });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('aria-controls');
    });

    it('keeps the programmatic payload when a controlled dialog declines a close request', async () => {
      const dialog = Dialog.createHandle<string>();

      function App(props: { showTrigger: boolean }) {
        const [open, setOpen] = createSignal(false);

        return (
          <div>
            <Show when={props.showTrigger}>
              <Dialog.Trigger handle={dialog} id="trigger" payload="from trigger">
                Trigger
              </Dialog.Trigger>
            </Show>
            <Dialog.Root
              handle={dialog}
              open={open()}
              onOpenChange={(nextOpen) => {
                // Accept opens, but keep the dialog open on close requests.
                if (nextOpen) {
                  setOpen(true);
                }
              }}
            >
              {(arg: { readonly payload: string | undefined }) => (
                <Dialog.Portal>
                  <Dialog.Popup data-testid="content">{arg.payload}</Dialog.Popup>
                </Dialog.Portal>
              )}
            </Dialog.Root>
          </div>
        );
      }

      const { setProps } = renderWithProps(
        (props: { showTrigger: boolean }) => <App showTrigger={props.showTrigger} />,
        { showTrigger: false },
      );

      await act(() => dialog.openWithPayload('from openWithPayload'));
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBe(null);
      });

      // The close request is declined, so the dialog stays open without a trigger.
      await act(() => dialog.close());
      expect(screen.queryByRole('dialog')).not.toBe(null);
      expect(dialog.isOpen).toBe(true);

      await setProps({ showTrigger: true });

      expect(screen.getByTestId('content').textContent).toBe('from openWithPayload');
      const trigger = screen.getByRole('button', { name: 'Trigger', hidden: true });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('aria-controls');
    });
  });

  it('fires a click on a detached trigger outside of any Root without errors', () => {
    const handle = Dialog.createHandle();
    render(() => <Dialog.Trigger handle={handle}>Lonely</Dialog.Trigger>);
    fireEvent.click(screen.getByRole('button', { name: 'Lonely' }));
    expect(handle.isOpen).toBe(false);
    expect(screen.getByRole('button', { name: 'Lonely' })).toHaveAttribute('aria-expanded', 'false');
  });
});
