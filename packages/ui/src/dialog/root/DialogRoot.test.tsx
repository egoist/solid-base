import { For, Show, createSignal } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Dialog } from '..';
import { AlertDialog } from '../../alert-dialog';
import { REASONS } from '../../internals/reasons';
import { DialogStore } from '../store/DialogStore';
import { createDialogInteractions } from './useDialogRoot';
import {
  ContainedTriggerDialog,
  DetachedTriggerDialog,
  DialogOpenChangeSpy,
  MultipleDetachedTriggersDialog,
  act,
  dialogRootSharedTests,
  flushMicrotasks,
  popupConformanceTests,
  renderWithProps,
  renderWithUser,
  wait,
} from '../test-utils';

describe('<Dialog.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  popupConformanceTests({
    createComponent: (props) => (
      <Dialog.Root {...props.root}>
        <Dialog.Trigger {...props.trigger}>Open dialog</Dialog.Trigger>
        <Dialog.Portal {...props.portal}>
          <Dialog.Popup {...props.popup}>Dialog</Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ),
    expectedPopupRole: 'dialog',
  });

  // Needs trusted browser input dispatched through CDP (Chromium only).
  it.skip('ignores a native click whose pointerdown opened the dialog', () => {});

  dialogRootSharedTests({ parts: Dialog, popupRole: 'dialog' });

  // Upstream checks the report happens before React's passive effects flush (React-only timing);
  // here we check the counts reach the parent when the interactions mount and unmount.
  it('reports nested drawer counts on mount and clears them on unmount', () => {
    const childStore = new DialogStore(
      { open: true, mounted: true, modal: false, disablePointerDismissal: false },
      undefined,
    );
    const parentStore = new DialogStore(undefined, undefined);
    const reports: Array<[number, number]> = [];
    parentStore.context.onNestedDialogOpen = (dialogCount, drawerCount) => {
      reports.push([dialogCount, drawerCount]);
    };

    function Interactions() {
      createDialogInteractions(childStore, parentStore.context, true);
      return null;
    }

    const { unmount } = render(() => <Interactions />);
    expect(reports).toEqual([[1, 1]]);

    unmount();
    expect(reports).toEqual([
      [1, 1],
      [0, 0],
    ]);
  });

  it('keeps trigger ownership when another trigger mounts while open', async () => {
    function Test() {
      const [showSecondTrigger, setShowSecondTrigger] = createSignal(false);

      return (
        <Dialog.Root modal={false}>
          <Dialog.Trigger id="trigger-1">Trigger 1</Dialog.Trigger>
          <Show when={showSecondTrigger()}>
            <Dialog.Trigger id="trigger-2">Trigger 2</Dialog.Trigger>
          </Show>
          <Dialog.Portal>
            <Dialog.Popup>
              <button onClick={() => setShowSecondTrigger(true)}>Mount trigger 2</button>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      );
    }

    const { user } = renderWithUser(() => <Test />);
    const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });

    await user.click(trigger1);

    const popup = await screen.findByRole('dialog');
    const trigger1Controls = trigger1.getAttribute('aria-controls');

    expect(trigger1Controls).toBe(popup.getAttribute('id'));

    await user.click(screen.getByRole('button', { name: 'Mount trigger 2' }));

    const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
    expect(trigger1).toHaveAttribute('aria-expanded', 'true');
    expect(trigger1.getAttribute('aria-controls')).toBe(trigger1Controls);
    expect(trigger2).toHaveAttribute('aria-expanded', 'false');
    expect(trigger2).not.toHaveAttribute('aria-controls');
  });

  describe.each([
    { name: 'contained triggers', Component: ContainedTriggerDialog },
    { name: 'detached triggers', Component: DetachedTriggerDialog },
    { name: 'multiple detached triggers', Component: MultipleDetachedTriggersDialog },
  ])('when using $name', ({ Component: TestDialog }) => {
    it('rewires dismiss interactions after closing and reopening', async () => {
      const { user } = renderWithUser(() => <TestDialog rootProps={{ modal: false }} />);

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBe(null);
      });

      await user.keyboard('[Escape]');
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBe(null);
      });

      fireEvent.click(document.body);
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });
    });

    it('ARIA attributes', () => {
      render(() => (
        <TestDialog
          rootProps={{ modal: false, open: true }}
          popupProps={{
            get children() {
              return (
                <>
                  <Dialog.Title>title text</Dialog.Title>
                  <Dialog.Description>description text</Dialog.Description>
                </>
              );
            },
          }}
          includeBackdrop
        />
      ));

      const popup = screen.queryByRole('dialog');
      expect(popup).not.toBe(null);

      expect(screen.getByText('title text').getAttribute('id')).toBe(
        popup?.getAttribute('aria-labelledby'),
      );
      expect(screen.getByText('description text').getAttribute('id')).toBe(
        popup?.getAttribute('aria-describedby'),
      );
    });

    it('keeps accessible names and descriptions in sync when label parts change', async () => {
      function DynamicLabels() {
        const [phase, setPhase] = createSignal(0);

        return (
          <>
            <Show when={phase() < 2 ? phase() + 1 : false} keyed>
              {(number) => <Dialog.Title>Title {number}</Dialog.Title>}
            </Show>
            <Show when={phase() < 2 ? phase() + 1 : false} keyed>
              {(number) => <Dialog.Description>Description {number}</Dialog.Description>}
            </Show>
            <button onClick={() => setPhase((value) => value + 1)}>Change labels</button>
          </>
        );
      }

      const { user } = renderWithUser(() => (
        <TestDialog
          rootProps={{ modal: false, open: true }}
          popupProps={{
            get children() {
              return <DynamicLabels />;
            },
          }}
        />
      ));

      const popup = screen.getByRole('dialog');
      const firstTitleId = screen.getByText('Title 1').getAttribute('id');
      const firstDescriptionId = screen.getByText('Description 1').getAttribute('id');

      expect(popup.getAttribute('aria-labelledby')).toBe(firstTitleId);
      expect(popup.getAttribute('aria-describedby')).toBe(firstDescriptionId);

      await user.click(screen.getByRole('button', { name: 'Change labels' }));

      const secondTitleId = screen.getByText('Title 2').getAttribute('id');
      const secondDescriptionId = screen.getByText('Description 2').getAttribute('id');

      await waitFor(() => {
        expect(popup.getAttribute('aria-labelledby')).toBe(secondTitleId);
      });
      await waitFor(() => {
        expect(popup.getAttribute('aria-describedby')).toBe(secondDescriptionId);
      });
      expect(secondTitleId).not.toBe(firstTitleId);
      expect(secondDescriptionId).not.toBe(firstDescriptionId);

      await user.click(screen.getByRole('button', { name: 'Change labels' }));

      await waitFor(() => {
        expect(popup).not.toHaveAttribute('aria-labelledby');
      });
      await waitFor(() => {
        expect(popup).not.toHaveAttribute('aria-describedby');
      });
    });

    describe('prop: onOpenChange', () => {
      it('reports no trigger when closing with an initial trigger id that is not mounted', async () => {
        const handleOpenChange = vi.fn();
        const actionsRef: { current: Dialog.Root.Actions | null } = { current: null };

        render(() => (
          <Dialog.Root
            actionsRef={actionsRef}
            defaultOpen
            defaultTriggerId="missing-trigger"
            modal={false}
            onOpenChange={handleOpenChange}
          >
            <Dialog.Portal>
              <Dialog.Popup>Dialog</Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        ));

        await act(() => actionsRef.current?.close());

        expect(handleOpenChange.mock.calls.length).toBe(1);
        expect(handleOpenChange.mock.calls[0][0]).toBe(false);
        expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.imperativeAction);
        expect(handleOpenChange.mock.calls[0][1].trigger).toBe(undefined);
      });

      it('calls onOpenChange with the reason for change when user clicks backdrop while the modal dialog is open', async () => {
        const handleOpenChange = vi.fn();

        const { user } = renderWithUser(() => (
          <TestDialog rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }} />
        ));

        await user.click(screen.getByRole('presentation', { hidden: true }));

        expect(handleOpenChange.mock.calls.length).toBe(1);
        expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
      });

      it('calls onOpenChange with the reason for change when user clicks outside while the non-modal dialog is open', async () => {
        const handleOpenChange = vi.fn();

        const { user } = renderWithUser(() => (
          <TestDialog
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: false }}
          />
        ));

        await user.click(document.body);

        expect(handleOpenChange.mock.calls.length).toBe(1);
        expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
      });

      describe('clicks on user backdrop', () => {
        it('detects clicks on user backdrop', async () => {
          const handleOpenChange = vi.fn();

          const { user } = renderWithUser(() => (
            <TestDialog
              rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }}
              popupProps={{ style: { position: 'fixed', 'z-index': '10' } }}
              includeBackdrop
            />
          ));

          await user.click(screen.getByTestId('backdrop'));

          expect(handleOpenChange.mock.calls.length).toBe(1);
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
        });

        it('does not change open state on non-main button clicks', async () => {
          const handleOpenChange = vi.fn();

          const { user } = renderWithUser(() => (
            <TestDialog
              rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }}
              includeBackdrop
            />
          ));

          const backdrop = screen.getByTestId('backdrop');
          await user.pointer([{ target: backdrop }, { keys: '[MouseRight]', target: backdrop }]);

          expect(handleOpenChange.mock.calls.length).toBe(0);
        });
      });

      it('emits a single internal openchange when closing on Escape', async () => {
        const handleInternalOpenChange = vi.fn();
        const { user } = renderWithUser(() => (
          <TestDialog
            rootProps={{ defaultOpen: true }}
            popupProps={{
              get children() {
                return (
                  <>
                    <DialogOpenChangeSpy onOpenChange={handleInternalOpenChange} />
                    <p>Dialog content</p>
                    <Dialog.Close>Close</Dialog.Close>
                  </>
                );
              },
            }}
          />
        ));

        await user.keyboard('[Escape]');
        await flushMicrotasks();

        expect(handleInternalOpenChange.mock.calls.length).toBe(1);
        expect(handleInternalOpenChange.mock.calls[0][0]).toMatchObject({
          open: false,
          reason: REASONS.escapeKey,
        });
      });

      it('does not emit internal openchange when an Escape close is canceled', async () => {
        const handleInternalOpenChange = vi.fn();
        const { user } = renderWithUser(() => (
          <TestDialog
            rootProps={{
              defaultOpen: true,
              onOpenChange: (nextOpen, eventDetails) => {
                if (!nextOpen) {
                  eventDetails.cancel();
                }
              },
            }}
            popupProps={{
              get children() {
                return (
                  <>
                    <DialogOpenChangeSpy onOpenChange={handleInternalOpenChange} />
                    <p>Dialog content</p>
                    <Dialog.Close>Close</Dialog.Close>
                  </>
                );
              },
            }}
          />
        ));

        await user.keyboard('[Escape]');
        await flushMicrotasks();

        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(handleInternalOpenChange.mock.calls.length).toBe(0);
      });
    });

    describe('prop: disablePointerDismissal', () => {
      it.each([
        { disablePointerDismissal: true, expectDismissed: false, outcome: 'does not close' },
        { disablePointerDismissal: false, expectDismissed: true, outcome: 'closes' },
        { disablePointerDismissal: undefined, expectDismissed: true, outcome: 'closes' },
      ])(
        '$outcome the dialog when clicking outside if disablePointerDismissal=$disablePointerDismissal',
        async ({ disablePointerDismissal, expectDismissed }) => {
          const handleOpenChange = vi.fn();

          render(() => (
            <div data-testid="outside">
              <TestDialog
                rootProps={{
                  defaultOpen: true,
                  onOpenChange: handleOpenChange,
                  disablePointerDismissal,
                  modal: false,
                }}
              />
            </div>
          ));

          const outside = screen.getByTestId('outside');

          fireEvent.mouseDown(outside);
          fireEvent.click(outside);
          await flushMicrotasks();
          expect(handleOpenChange.mock.calls.length === 1).toBe(expectDismissed);
          expect(screen.queryByRole('dialog') === null).toBe(expectDismissed);
        },
      );
    });

    describe('outside press event with backdrops', () => {
      it('uses intentional outside press with user backdrop (mouse): closes on click, not on mousedown', async () => {
        const handleOpenChange = vi.fn();

        render(() => (
          <TestDialog
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: false }}
            includeBackdrop
          />
        ));

        const backdrop = screen.getByTestId('backdrop');

        fireEvent.mouseDown(backdrop);
        await flushMicrotasks();
        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(handleOpenChange.mock.calls.length).toBe(0);

        fireEvent.click(backdrop);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });

      it('uses intentional outside press with internal backdrop (modal=true): closes on click, not on mousedown', async () => {
        const handleOpenChange = vi.fn();

        render(() => (
          <TestDialog
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: true }}
          />
        ));

        const internalBackdrop = screen.getByRole('presentation', { hidden: true });

        fireEvent.mouseDown(internalBackdrop);
        await flushMicrotasks();
        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(handleOpenChange.mock.calls.length).toBe(0);

        fireEvent.click(internalBackdrop);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });

      it('closing via intentional outside press with user backdrop (modal=true): works when portaled into a shadow DOM', async () => {
        const handleOpenChange = vi.fn();

        const container = document.body.appendChild(document.createElement('div'));
        const shadowRoot = container.attachShadow({ mode: 'open' });

        try {
          render(() => (
            <TestDialog
              rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: true }}
              portalProps={{ container: shadowRoot }}
              includeBackdrop
            />
          ));

          const backdrop = shadowRoot.querySelector('[data-testid="backdrop"]') as HTMLElement;

          fireEvent.click(backdrop);
          await waitFor(() => {
            expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
          });
          expect(handleOpenChange.mock.calls.length).toBe(1);
        } finally {
          container.remove();
        }
      });

      it('closing via outside press: works when clicking another element inside the same shadow root', async () => {
        const handleOpenChange = vi.fn();

        const host = document.body.appendChild(document.createElement('div'));
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const container = document.createElement('div');
        shadowRoot.appendChild(container);

        try {
          render(
            () => (
              <>
                <button data-testid="outside">Outside</button>
                <TestDialog
                  rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: false }}
                  portalProps={{ container: shadowRoot }}
                />
              </>
            ),
            { container },
          );

          const outsideButton = shadowRoot.querySelector('[data-testid="outside"]') as HTMLElement;

          fireEvent.click(outsideButton);

          await waitFor(() => {
            expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
          });

          expect(handleOpenChange.mock.calls.length).toBe(1);
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
        } finally {
          host.remove();
        }
      });

      it('closes when the outside press targets the document', async () => {
        const handleOpenChange = vi.fn();

        render(() => (
          <TestDialog
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: true }}
          />
        ));

        fireEvent.click(document);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        expect(handleOpenChange.mock.calls.length).toBe(1);
        expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
      });

      it('suppresses only the click of a press that starts inside and ends on the document', async () => {
        const handleOpenChange = vi.fn();

        render(() => (
          <TestDialog
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: true }}
          />
        ));

        const popup = screen.getByTestId('dialog-popup');

        fireEvent.pointerDown(popup, { pointerType: 'mouse', button: 0 });
        fireEvent.mouseDown(popup, { button: 0 });
        fireEvent.pointerUp(document, { pointerType: 'mouse', button: 0 });
        fireEvent.mouseUp(document, { button: 0 });
        fireEvent.click(document);
        await flushMicrotasks();

        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(handleOpenChange.mock.calls.length).toBe(0);

        fireEvent.pointerDown(document, { pointerType: 'mouse', button: 0 });
        fireEvent.mouseDown(document, { button: 0 });
        fireEvent.pointerUp(document, { pointerType: 'mouse', button: 0 });
        fireEvent.mouseUp(document, { button: 0 });
        fireEvent.click(document);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
      });

      it.each([
        { name: 'non-modal', modal: false },
        { name: 'modal', modal: true },
      ])(
        'closing via outside press: works for a $name dialog when clicking outside the shadow root',
        async ({ modal }) => {
          const handleOpenChange = vi.fn();

          const host = document.body.appendChild(document.createElement('div'));
          const shadowRoot = host.attachShadow({ mode: 'open' });
          const container = document.createElement('div');
          shadowRoot.appendChild(container);

          try {
            render(
              () => (
                <TestDialog
                  rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal }}
                  portalProps={{ container: shadowRoot }}
                />
              ),
              { container },
            );

            fireEvent.click(document.body);

            await waitFor(() => {
              expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
            });

            expect(handleOpenChange.mock.calls.length).toBe(1);
            expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
          } finally {
            host.remove();
          }
        },
      );
    });

    // jsdom has no CSS transitions.
    it.skip('waits for the exit transition to finish before unmounting', () => {});

    describe('prop: modal', () => {
      it('makes other interactive elements on the page inert when a modal dialog is open', () => {
        render(() => <TestDialog rootProps={{ defaultOpen: true, modal: true }} />);

        expect(screen.getByRole('presentation', { hidden: true })).not.toBe(null);
        expect(screen.getByTestId('dialog-popup')).not.toHaveAttribute('aria-hidden');
      });

      it('does not make other interactive elements on the page inert when a non-modal dialog is open', () => {
        render(() => <TestDialog rootProps={{ defaultOpen: true, modal: false }} />);

        expect(screen.queryByRole('presentation')).toBe(null);
      });

      it('should render an internal backdrop when `true`', async () => {
        const { user } = renderWithUser(() => (
          <div>
            <TestDialog rootProps={{ modal: true }} />
            <button>Outside</button>
          </div>
        ));

        await user.click(screen.getByTestId('trigger'));

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        const popup = screen.getByRole('dialog');

        // focus guard -> internal backdrop
        expect(popup.previousElementSibling?.previousElementSibling).toHaveAttribute(
          'role',
          'presentation',
        );
      });

      it('should not render an internal backdrop when `false`', async () => {
        const { user } = renderWithUser(() => (
          <div>
            <TestDialog rootProps={{ modal: false }} />
            <button>Outside</button>
          </div>
        ));

        await user.click(screen.getByTestId('trigger'));

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        const popup = screen.getByRole('dialog');

        // focus guard -> internal backdrop
        expect(popup.previousElementSibling?.previousElementSibling).toBe(null);
      });
    });

    it('does not dismiss previous modal dialog when clicking new modal dialog', async () => {
      function App() {
        const [openNested, setOpenNested] = createSignal(false);
        const [openNested2, setOpenNested2] = createSignal(false);

        return (
          <div>
            <TestDialog
              triggerProps={{ children: 'Open base' }}
              popupProps={{
                get children() {
                  return <button onClick={() => setOpenNested(true)}>Open nested 1</button>;
                },
              }}
            />
            <TestDialog
              rootProps={{
                get open() {
                  return openNested();
                },
                onOpenChange: (open) => setOpenNested(open),
              }}
              popupProps={{
                get children() {
                  return <button onClick={() => setOpenNested2(true)}>Open nested 2</button>;
                },
              }}
            />
            <TestDialog
              rootProps={{
                get open() {
                  return openNested2();
                },
                onOpenChange: (open) => setOpenNested2(open),
              }}
              popupProps={{ children: 'Final nested' }}
            />
          </div>
        );
      }

      const { user } = renderWithUser(() => <App />);

      await user.click(screen.getByRole('button', { name: 'Open base' }));
      await user.click(screen.getByRole('button', { name: 'Open nested 1' }));
      await user.click(screen.getByRole('button', { name: 'Open nested 2' }));

      expect(screen.getByText('Final nested')).not.toBe(null);
    });

    it('dismisses non-nested dialogs one by one', async () => {
      function App() {
        const [openNested, setOpenNested] = createSignal(false);
        const [openNested2, setOpenNested2] = createSignal(false);

        return (
          <div>
            <TestDialog
              triggerProps={{ children: 'Open base' }}
              popupProps={{
                'data-testid': 'level-1',
                get children() {
                  return <button onClick={() => setOpenNested(true)}>Open nested 1</button>;
                },
              }}
            />
            <TestDialog
              rootProps={{
                get open() {
                  return openNested();
                },
                onOpenChange: (open) => setOpenNested(open),
              }}
              popupProps={{
                'data-testid': 'level-2',
                get children() {
                  return <button onClick={() => setOpenNested2(true)}>Open nested 2</button>;
                },
              }}
            />
            <TestDialog
              rootProps={{
                get open() {
                  return openNested2();
                },
                onOpenChange: (open) => setOpenNested2(open),
              }}
              popupProps={{ 'data-testid': 'level-3', children: 'Final nested' }}
            />
          </div>
        );
      }

      render(() => <App />);

      fireEvent.click(screen.getByRole('button', { name: 'Open base' }));
      await flushMicrotasks();
      fireEvent.click(screen.getByRole('button', { name: 'Open nested 1' }));
      await flushMicrotasks();
      fireEvent.click(screen.getByRole('button', { name: 'Open nested 2' }));
      await flushMicrotasks();

      const backdrops = Array.from(document.querySelectorAll('[role="presentation"]'));
      fireEvent.click(backdrops[backdrops.length - 1]);

      await waitFor(() => {
        expect(screen.queryByTestId('level-3')).toBe(null);
      });

      expect(screen.getByTestId('level-2')).toBeInTheDocument();
      expect(screen.getByTestId('level-1')).toBeInTheDocument();

      fireEvent.click(backdrops[backdrops.length - 2]);

      await waitFor(() => {
        expect(screen.queryByTestId('level-2')).toBe(null);
      });

      expect(screen.getByTestId('level-1')).toBeInTheDocument();

      fireEvent.click(backdrops[backdrops.length - 3]);

      await waitFor(() => {
        expect(screen.queryByTestId('level-1')).toBe(null);
      });
    });

    // Menu and Select are not ported yet.
    describe.skip('nested popups (requires Menu/Select)', () => {
      it('should not dismiss the dialog when dismissing outside a nested modal menu', () => {});
      it('should not dismiss the dialog when dismissing outside a nested select popup', () => {});
      it('should not close the parent menu when Escape is pressed in a nested dialog', () => {});
    });

    describe('pointerdown removal', () => {
      // Relies on the browser firing `focusout` when the focused element is removed (jsdom
      // doesn't), like upstream, which runs it in browsers only.
      it.skip('moves focus to the popup when a focused child is removed on pointerdown and outside press still dismisses', () => {});

      // NumberField is not ported yet.
      it.skip('dismisses on first outside click after NumberField scrub interaction (pointer lock path)', () => {});
    });

    // jsdom has no CSS animations.
    describe.skip('prop: onOpenChangeComplete (requires real CSS animations)', () => {
      it('waits for a restarted enter animation to finish', () => {});
      it('does not get called on open when dismissed during the enter animation', () => {});
    });
  });

  it('does not close on a right-button outside press', async () => {
    const handleOpenChange = vi.fn();

    render(() => (
      <div>
        <button data-testid="outside">Outside</button>
        <Dialog.Root defaultOpen modal="trap-focus" onOpenChange={handleOpenChange}>
          <Dialog.Portal>
            <Dialog.Popup>Dialog</Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    ));

    fireEvent.pointerDown(screen.getByTestId('outside'), {
      bubbles: true,
      button: 2,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    expect(screen.getByRole('dialog')).not.toBe(null);
    expect(handleOpenChange.mock.calls.length).toBe(0);
  });

  it('closes one sibling dialog per Escape press when several open together', async () => {
    function SiblingDialog(props: { name: string }) {
      return (
        <Dialog.Root defaultOpen>
          <Dialog.Portal>
            <Dialog.Popup data-testid={props.name}>
              <Dialog.Close>Close {props.name}</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      );
    }

    const { user } = renderWithUser(() => (
      <>
        <SiblingDialog name="a" />
        <SiblingDialog name="b" />
        <SiblingDialog name="c" />
      </>
    ));

    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(screen.queryByTestId('c')).toBe(null);
    });
    expect(screen.queryByTestId('b')).not.toBe(null);

    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(screen.queryByTestId('b')).toBe(null);
    });
    expect(screen.queryByTestId('a')).not.toBe(null);

    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(screen.queryByTestId('a')).toBe(null);
    });
  });

  it('closes the newest sibling dialog on Escape after an older one remounts its popup', async () => {
    // Neither popup takes focus, so the remount can't move it and Escape reaches the document.
    const { setProps, user } = renderWithProps(
      (props: { popupKey: number }) => (
        <>
          <Dialog.Root defaultOpen>
            <Dialog.Portal>
              <Show when={props.popupKey + 1} keyed>
                {(_key) => <Dialog.Popup initialFocus={false} data-testid="a" />}
              </Show>
            </Dialog.Portal>
          </Dialog.Root>
          <Dialog.Root defaultOpen>
            <Dialog.Portal>
              <Dialog.Popup initialFocus={false} data-testid="b" />
            </Dialog.Portal>
          </Dialog.Root>
        </>
      ),
      { popupKey: 0 },
    );
    const popupA = screen.getByTestId('a');

    await setProps({ popupKey: 1 });
    expect(screen.getByTestId('a')).not.toBe(popupA);
    expect(document.activeElement).toBe(document.body);

    await user.keyboard('[Escape]');

    await waitFor(() => {
      expect(screen.queryByTestId('b')).toBe(null);
    });
    expect(screen.queryByTestId('a')).not.toBe(null);
  });

  // Popover is not ported yet.
  it.skip('closes a popover opened during a nested dialog, not the parent, on Escape after the nested dialog closes', () => {});

  it('closes only the topmost nested dialog on Escape', async () => {
    const { user } = renderWithUser(() => (
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Popup data-testid="parent">
            <Dialog.Root defaultOpen>
              <Dialog.Portal>
                <Dialog.Popup data-testid="nested" />
              </Dialog.Portal>
            </Dialog.Root>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(screen.queryByTestId('nested')).toBe(null);
    });
    expect(screen.getByTestId('parent')).not.toBe(null);

    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(screen.queryByTestId('parent')).toBe(null);
    });
  });

  describe('closed shadow root', () => {
    let host: HTMLElement;
    let shadowRoot: ShadowRoot;
    let container: HTMLElement;

    beforeEach(() => {
      host = document.body.appendChild(document.createElement('div'));
      shadowRoot = host.attachShadow({ mode: 'closed' });
      container = shadowRoot.appendChild(document.createElement('div'));
    });

    afterEach(() => {
      host.remove();
    });

    async function query(testId: string) {
      const selector = `[data-testid="${testId}"]`;
      return waitFor(() => {
        const element = shadowRoot.querySelector(selector) ?? document.querySelector(selector);
        expect(element).not.toBe(null);
        return element as HTMLElement;
      });
    }

    async function click(testId: string) {
      const element = await query(testId);
      element.click();
      await flushMicrotasks();
    }

    type PortalContainer = 'shadow root' | 'body' | undefined;

    const resolveContainer = (target: PortalContainer) =>
      target && { 'shadow root': shadowRoot, body: document.body }[target];

    const nestedKinds = [
      {
        name: 'modal dialog',
        modal: true,
        render: (portalContainer: ShadowRoot | HTMLElement | undefined) => (
          <Dialog.Root>
            <Dialog.Trigger data-testid="open-nested">Open nested</Dialog.Trigger>
            <Dialog.Portal container={portalContainer}>
              <Dialog.Backdrop />
              <Dialog.Popup data-testid="nested">
                <Dialog.Close data-testid="close-nested">Close</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        ),
      },
      {
        name: 'non-modal dialog',
        modal: false,
        render: (portalContainer: ShadowRoot | HTMLElement | undefined) => (
          <Dialog.Root modal={false}>
            <Dialog.Trigger data-testid="open-nested">Open nested</Dialog.Trigger>
            <Dialog.Portal container={portalContainer}>
              <Dialog.Popup data-testid="nested">
                <Dialog.Close data-testid="close-nested">Close</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        ),
      },
      {
        name: 'alert dialog',
        modal: true,
        render: (portalContainer: ShadowRoot | HTMLElement | undefined) => (
          <AlertDialog.Root>
            <AlertDialog.Trigger data-testid="open-nested">Open nested</AlertDialog.Trigger>
            <AlertDialog.Portal container={portalContainer}>
              <AlertDialog.Backdrop />
              <AlertDialog.Popup data-testid="nested">
                <AlertDialog.Close data-testid="close-nested">Close</AlertDialog.Close>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        ),
      },
    ];

    // `undefined` means the portal's default: the parent portal's node, else the body.
    const portalSetups: Array<{ outer: PortalContainer; nested: PortalContainer }> = [
      { outer: 'shadow root', nested: undefined },
      { outer: 'shadow root', nested: 'shadow root' },
      { outer: 'shadow root', nested: 'body' },
      { outer: undefined, nested: undefined },
      { outer: undefined, nested: 'shadow root' },
    ];

    describe.each(nestedKinds)('nested $name', (nestedKind) => {
      it.each(portalSetups)(
        'keeps the parent open on close (outer: $outer, nested: $nested)',
        async ({ outer, nested }) => {
          const handleOpenChange = vi.fn();

          render(
            () => (
              <Dialog.Root defaultOpen modal={nestedKind.modal} onOpenChange={handleOpenChange}>
                <Dialog.Portal container={resolveContainer(outer)}>
                  <Show when={nestedKind.modal}>
                    <Dialog.Backdrop />
                  </Show>
                  <Dialog.Popup data-testid="outer">
                    {nestedKind.render(resolveContainer(nested))}
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
            ),
            { container },
          );

          await click('open-nested');
          await query('nested');

          await click('close-nested');

          expect(await query('outer')).not.toBe(null);
          await waitFor(() => {
            expect(shadowRoot.querySelector('[data-testid="nested"]')).toBe(null);
          });
          expect(document.querySelector('[data-testid="nested"]')).toBe(null);
          expect(handleOpenChange).not.toHaveBeenCalled();
        },
      );
    });

    it('still dismisses on a press outside the popup', async () => {
      const handleOpenChange = vi.fn();

      render(
        () => (
          <>
            <div data-testid="outside">Outside</div>
            <Dialog.Root defaultOpen modal={false} onOpenChange={handleOpenChange}>
              <Dialog.Portal container={shadowRoot}>
                <Dialog.Popup data-testid="outer" />
              </Dialog.Portal>
            </Dialog.Root>
          </>
        ),
        { container },
      );

      await query('outer');
      await click('outside');

      await waitFor(() => {
        expect(shadowRoot.querySelector('[data-testid="outer"]')).toBe(null);
      });
      expect(handleOpenChange.mock.calls.length).toBe(1);
      expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
    });
  });

  // jsdom has no `Touch` constructor.
  describe.skip('touch outside press (requires Touch events)', () => {
    it('closes a non-modal dialog without a backdrop', () => {});
    it('closes a trap-focus dialog without a backdrop', () => {});
    it('does not close when another touch is still active on touchend', () => {});
    it('does not close when two touches are lifted simultaneously on touchend', () => {});
    it('does not close when multiple touches move past the drag dismissal threshold', () => {});
    it('closes as soon as a single touch moves past the drag dismissal threshold', () => {});
  });

  describe('scroll lock', () => {
    afterEach(() => {
      document.documentElement.removeAttribute('style');
      document.body.removeAttribute('style');
      document.body.removeAttribute('data-scroll-locked');
    });

    // Third-party scroll lockers are detected through computed styles of real stylesheets.
    it.skip('keeps the page locked until a third-party overlay unlocks, and unlocks on close (requires real layout)', () => {});

    it('locks immediately when an external <body> lock cannot affect the page', async () => {
      // <html> owns the viewport scroll, so `overflow: hidden` on <body> leaves the page
      // scrollable and must not be mistaken for an effective lock.
      document.documentElement.style.overflowY = 'scroll';
      document.body.style.overflowY = 'hidden';

      render(() => (
        <Dialog.Root defaultOpen>
          <Dialog.Portal>
            <Dialog.Popup>
              <Dialog.Close>Close dialog</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      // Flush the scroll locker's deferred lock, scheduled on a 0ms timeout.
      await act(() => wait(0));

      expect(hasOwnScrollLock(document)).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
      await waitFor(() => {
        expect(hasOwnScrollLock(document)).toBe(false);
      });
    });

    it.each([
      { modal: false as const, locked: false },
      { modal: 'trap-focus' as const, locked: false },
    ])('does not lock the page scroll when modal=$modal', async ({ modal, locked }) => {
      document.documentElement.style.overflowY = 'scroll';

      render(() => (
        <Dialog.Root defaultOpen modal={modal}>
          <Dialog.Portal>
            <Dialog.Popup>Dialog</Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      await act(() => wait(0));

      expect(hasOwnScrollLock(document)).toBe(locked);
    });
  });

  // Menu and ScrollArea are not ported yet.
  it.skip('returns focus to the menu trigger when a detached dialog trigger unmounts (requires Menu)', () => {});
  it.skip('keeps focus trapped when dialog content contains a non-scrollable scroll area (requires ScrollArea layout)', () => {});

  it('returns focus into the dialog when a close confirmation opened by an outside press closes', async () => {
    function App() {
      const [open, setOpen] = createSignal(false);
      const [confirmationOpen, setConfirmationOpen] = createSignal(false);
      const [value, setValue] = createSignal('');

      return (
        <Dialog.Root
          open={open()}
          onOpenChange={(nextOpen, eventDetails) => {
            if (!nextOpen && value()) {
              eventDetails.cancel();
              setConfirmationOpen(true);
              return;
            }
            setOpen(nextOpen);
          }}
        >
          <Dialog.Trigger data-testid="trigger">Tweet</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop data-testid="backdrop" />
            <Dialog.Popup>
              <textarea
                data-testid="textarea"
                value={value()}
                onInput={(event) => setValue(event.currentTarget.value)}
              />
            </Dialog.Popup>
          </Dialog.Portal>
          <AlertDialog.Root
            open={confirmationOpen()}
            onOpenChange={(nextOpen) => setConfirmationOpen(nextOpen)}
          >
            <AlertDialog.Portal>
              <AlertDialog.Popup>
                <AlertDialog.Close data-testid="go-back">Go back</AlertDialog.Close>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </Dialog.Root>
      );
    }

    const { user } = renderWithUser(() => <App />);

    await user.click(screen.getByTestId('trigger'));
    await screen.findByRole('dialog');

    const textarea = screen.getByTestId('textarea');
    await user.click(textarea);
    await user.keyboard('x');
    expect(textarea).toHaveFocus();

    // Pressing the backdrop moves focus to the body before the close is
    // canceled and the confirmation dialog opens.
    await user.click(screen.getByTestId('backdrop'));

    const goBack = await screen.findByTestId('go-back');
    await waitFor(() => {
      expect(goBack).toHaveFocus();
    });

    await user.keyboard('[Enter]');

    await waitFor(() => {
      expect(screen.queryByTestId('go-back')).toBe(null);
    });
    await waitFor(() => {
      expect(textarea).toHaveFocus();
    });
  });

  it('does not leak a non-modal popup field into an unrelated dialog return focus', async () => {
    function App() {
      const [confirmationOpen, setConfirmationOpen] = createSignal(false);

      return (
        <>
          {/* Clicking this non-focusable surface blurs the field to the body and
              opens the confirmation while the body is focused. */}
          <div data-testid="surface" onClick={() => setConfirmationOpen(true)}>
            surface
          </div>

          {/* A non-modal dialog held open (controlled, no `onOpenChange`). */}
          <Dialog.Root open modal={false}>
            <Dialog.Portal>
              <Dialog.Popup>
                <textarea data-testid="nonmodal-field" />
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>

          <AlertDialog.Root
            open={confirmationOpen()}
            onOpenChange={(nextOpen) => setConfirmationOpen(nextOpen)}
          >
            <AlertDialog.Portal>
              <AlertDialog.Popup>
                <AlertDialog.Close data-testid="go-back">Go back</AlertDialog.Close>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </>
      );
    }

    const { user } = renderWithUser(() => <App />);

    const field = screen.getByTestId('nonmodal-field');
    await user.click(field);
    expect(field).toHaveFocus();

    // Blur the field to the body and open the confirmation while it is focused.
    await user.click(screen.getByTestId('surface'));

    const goBack = await screen.findByTestId('go-back');
    await waitFor(() => {
      expect(goBack).toHaveFocus();
    });

    await user.keyboard('[Enter]');

    await waitFor(() => {
      expect(screen.queryByTestId('go-back')).toBe(null);
    });

    // The modal gate keeps the non-modal field out of the shared stack, so the
    // confirmation must not restore focus into the unrelated dialog.
    await flushMicrotasks();
    expect(field).not.toHaveFocus();
  });

  describe('outside content', () => {
    it.each([
      { modal: true as const, hidden: true },
      { modal: 'trap-focus' as const, hidden: true },
      { modal: false as const, hidden: false },
    ])('hides the outside content from assistive technology when modal=$modal', async ({ modal, hidden }) => {
      const { user } = renderWithUser(() => (
        <>
          <div data-testid="outside">
            <button>Outside</button>
          </div>
          <Dialog.Root modal={modal}>
            <Dialog.Trigger>Open</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup data-testid="popup">
                <Dialog.Close>Close</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      ));

      // The outside content is hidden through its closest ancestor that doesn't contain the popup.
      const isHidden = (element: Element) => element.closest('[aria-hidden="true"]') !== null;
      const outside = screen.getByTestId('outside');
      expect(isHidden(outside)).toBe(false);

      await user.click(screen.getByRole('button', { name: 'Open' }));
      await screen.findByTestId('popup');
      await waitFor(() => {
        expect(isHidden(outside)).toBe(hidden);
      });
      expect(isHidden(screen.getByTestId('popup'))).toBe(false);

      await user.click(screen.getByText('Close'));
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
      expect(isHidden(outside)).toBe(false);
    });

    it('keeps pointer interactions outside a trap-focus dialog: no internal backdrop, and an outside press dismisses', async () => {
      const handleOpenChange = vi.fn();
      const { user } = renderWithUser(() => (
        <>
          <button data-testid="outside">Outside</button>
          <Dialog.Root defaultOpen modal="trap-focus" onOpenChange={handleOpenChange}>
            <Dialog.Portal>
              <Dialog.Popup data-testid="popup">Dialog</Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      ));

      expect(screen.queryByRole('presentation', { hidden: true })).toBe(null);

      await user.click(screen.getByTestId('outside'));
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
      expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
    });
  });

  describe('nested dialogs', () => {
    it('marks the topmost dialog and closes only it on Escape, then the parent', async () => {
      const handleParentOpenChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Dialog.Root defaultOpen onOpenChange={handleParentOpenChange}>
          <Dialog.Portal>
            <Dialog.Popup data-testid="parent">
              <Dialog.Root>
                <Dialog.Trigger>Open nested</Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Popup data-testid="nested">
                    <Dialog.Close>Close nested</Dialog.Close>
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      const parent = screen.getByTestId('parent');
      expect(parent).not.toHaveAttribute('data-nested-dialog-open');

      await user.click(screen.getByRole('button', { name: 'Open nested' }));
      const nested = await screen.findByTestId('nested');
      expect(nested).toHaveAttribute('data-nested');
      expect(parent).toHaveAttribute('data-nested-dialog-open');
      expect(parent.style.getPropertyValue('--nested-dialogs')).toBe('1');

      await user.keyboard('[Escape]');
      await waitFor(() => {
        expect(screen.queryByTestId('nested')).toBe(null);
      });
      expect(handleParentOpenChange).not.toHaveBeenCalled();
      expect(parent).not.toHaveAttribute('data-nested-dialog-open');
      expect(parent.style.getPropertyValue('--nested-dialogs')).toBe('0');
    });

    it('does not close the parent when the nested backdrop is pressed', async () => {
      const handleParentOpenChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Dialog.Root defaultOpen onOpenChange={handleParentOpenChange}>
          <Dialog.Portal>
            <Dialog.Popup data-testid="parent">
              <Dialog.Root defaultOpen>
                <Dialog.Portal>
                  <Dialog.Popup data-testid="nested" />
                </Dialog.Portal>
              </Dialog.Root>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      const backdrops = document.querySelectorAll('[role="presentation"]');
      await user.click(backdrops[backdrops.length - 1] as HTMLElement);
      await waitFor(() => {
        expect(screen.queryByTestId('nested')).toBe(null);
      });
      expect(screen.getByTestId('parent')).not.toBe(null);
      expect(handleParentOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('prop: triggerId', () => {
    it('opens a controlled dialog for the trigger given by `triggerId`', async () => {
      const { setProps } = renderWithProps(
        (props: { triggerId: string | null }) => (
          <Dialog.Root open triggerId={props.triggerId} modal={false}>
            <For each={['a', 'b']}>
              {(id) => <Dialog.Trigger id={id}>{`Trigger ${id}`}</Dialog.Trigger>}
            </For>
            <Dialog.Portal>
              <Dialog.Popup />
            </Dialog.Portal>
          </Dialog.Root>
        ),
        { triggerId: 'a' as string | null },
      );

      const triggerA = screen.getByRole('button', { name: 'Trigger a' });
      const triggerB = screen.getByRole('button', { name: 'Trigger b' });
      expect(triggerA).toHaveAttribute('aria-expanded', 'true');
      expect(triggerB).toHaveAttribute('aria-expanded', 'false');

      await setProps({ triggerId: 'b' });
      expect(triggerA).toHaveAttribute('aria-expanded', 'false');
      expect(triggerB).toHaveAttribute('aria-expanded', 'true');
      expect(triggerB).toHaveAttribute('aria-controls', screen.getByRole('dialog').id);
    });
  });

  describe('prop: keepMounted', () => {
    it('keeps the popup mounted but hidden when closed', async () => {
      const { user } = renderWithUser(() => (
        <Dialog.Root modal={false}>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Portal keepMounted>
            <Dialog.Popup data-testid="popup">
              <Dialog.Close>Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      const popup = screen.getByTestId('popup');
      expect(popup).toHaveAttribute('hidden');
      expect(popup).toHaveAttribute('data-closed');

      await user.click(screen.getByRole('button', { name: 'Open' }));
      expect(screen.getByTestId('popup')).toBe(popup);
      expect(popup).not.toHaveAttribute('hidden');
      expect(popup).toHaveAttribute('data-open');

      await user.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => {
        expect(popup).toHaveAttribute('hidden');
      });
      expect(screen.getByTestId('popup')).toBe(popup);
    });
  });
});

// When <html> is the viewport scroller, Base UI hides its overflow to lock the page. An external
// <body> lock never touches <html>, so this distinguishes a lock Base UI applied itself from one
// it is still waiting to take over.
function hasOwnScrollLock(doc: Document) {
  return doc.documentElement.style.overflowX === 'hidden';
}

