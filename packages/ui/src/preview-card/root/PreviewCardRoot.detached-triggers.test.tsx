import { Show, createSignal } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { PreviewCard } from '..';
import { act, flushMicrotasks, renderWithUser } from '../../dialog/test-utils';

type NumberPayload = { readonly payload: number | undefined };

describe('<PreviewCard.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  // `detachedTriggersConformanceTests` lives in `PreviewCardRoot.detached-triggers.conformance.test.tsx`.

  // Solid calls a `render` function once and updates its props in place, so these check that the
  // inactive trigger's render function is never called again.
  describe('does not re-render inactive triggers', () => {
    function renderPreviewCard() {
      const handle = PreviewCard.createHandle();
      const bystander = { renders: 0 };

      render(() => (
        <div>
          <PreviewCard.Trigger handle={handle} id="trigger-1" href="#" delay={0} closeDelay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger handle={handle} id="trigger-2" href="#" delay={0} closeDelay={0}>
            Trigger 2
          </PreviewCard.Trigger>
          <PreviewCard.Trigger
            handle={handle}
            id="trigger-3"
            render={(props) => {
              bystander.renders += 1;
              return <a {...props} />;
            }}
          >
            Trigger 3
          </PreviewCard.Trigger>
          <PreviewCard.Root handle={handle}>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid="popup">Content</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>
      ));

      bystander.renders = 0;
      return {
        handle,
        bystander,
        trigger1: screen.getByText('Trigger 1'),
        trigger2: screen.getByText('Trigger 2'),
      };
    }

    async function expectOpenedBy(trigger: HTMLElement) {
      expect(await screen.findByTestId('popup')).not.toBe(null);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-popup-open');
      });
    }

    async function expectClosed(trigger: HTMLElement) {
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
      expect(trigger).not.toHaveAttribute('data-popup-open');
    }

    it('when opened and closed imperatively', async () => {
      const { handle, bystander, trigger1 } = renderPreviewCard();

      async function openAndClose() {
        await act(() => handle.open('trigger-1'));
        await expectOpenedBy(trigger1);
        await act(() => handle.close());
        await expectClosed(trigger1);
      }

      await openAndClose();
      await openAndClose();
      expect(bystander.renders).toBe(0);
    });

    it('when the popup moves to another trigger', async () => {
      const { handle, bystander, trigger1, trigger2 } = renderPreviewCard();

      await act(() => handle.open('trigger-1'));
      await expectOpenedBy(trigger1);
      await act(() => handle.open('trigger-2'));
      await expectOpenedBy(trigger2);
      expect(trigger1).not.toHaveAttribute('data-popup-open');
      await act(() => handle.close());
      await expectClosed(trigger2);

      expect(bystander.renders).toBe(0);
    });

    it('when focus opens and closes the popup', async () => {
      const { bystander, trigger1 } = renderPreviewCard();

      async function openAndClose() {
        await act(() => trigger1.focus());
        await expectOpenedBy(trigger1);
        await act(() => trigger1.blur());
        await expectClosed(trigger1);
      }

      await openAndClose();
      await openAndClose();
      expect(bystander.renders).toBe(0);
    });

    it('when hover opens and closes the popup', async () => {
      const { bystander, trigger1, trigger2 } = renderPreviewCard();

      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      await expectOpenedBy(trigger1);
      fireEvent.mouseLeave(trigger1);
      fireEvent.mouseEnter(trigger2);
      fireEvent.mouseMove(trigger2);
      await expectOpenedBy(trigger2);
      fireEvent.mouseLeave(trigger2);
      await expectClosed(trigger2);

      expect(bystander.renders).toBe(0);
    });
  });

  describe('handle-backed root ownership', () => {
    it('keeps a default-open root open while a detached trigger migrates after the initial commit', async () => {
      const handle = PreviewCard.createHandle();
      const onOpenChange = vi.fn();

      render(() => (
        <>
          <PreviewCard.Root
            handle={handle}
            defaultOpen
            defaultTriggerId="trigger"
            onOpenChange={onOpenChange}
          >
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid="default-open-content">Content</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
          <PreviewCard.Trigger handle={handle} id="trigger" href="#">
            Trigger
          </PreviewCard.Trigger>
        </>
      ));

      await waitFor(() => {
        expect(screen.getByRole('link', { name: 'Trigger' })).toHaveAttribute('data-popup-open');
      });
      await flushMicrotasks();

      expect(handle.isOpen).toBe(true);
      expect(screen.getByTestId('default-open-content')).toHaveAttribute('data-open');
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('multiple triggers within Root', () => {
    it('should open the preview card immediately when hovering another trigger', async () => {
      const { user } = renderWithUser(() => (
        <PreviewCard.Root>
          {(arg: NumberPayload) => (
            <>
              <button type="button" aria-label="Initial focus" autofocus />
              <PreviewCard.Trigger href="#" delay={0} payload={1}>
                Trigger 1
              </PreviewCard.Trigger>

              {/* delay should be ignored when moving from already active trigger */}
              <PreviewCard.Trigger href="#" delay={2000} payload={2}>
                Trigger 2
              </PreviewCard.Trigger>

              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="popup">Content: {arg.payload}</PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </>
          )}
        </PreviewCard.Root>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('popup').textContent).toBe('Content: 1');
      });

      await user.hover(trigger2);
      await flushMicrotasks();
      expect(screen.queryByTestId('popup')).not.toBe(null);
      expect(screen.getByTestId('popup').textContent).toBe('Content: 2');
    });

    it('should open again after escape when focusing another trigger', async () => {
      const { user } = renderWithUser(() => (
        <PreviewCard.Root>
          <button type="button" aria-label="Initial focus" autofocus />
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 2
          </PreviewCard.Trigger>

          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup data-testid="popup">Content</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await act(() => trigger1.focus());
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).not.toBe(null);
      });

      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });

      await act(() => trigger2.focus());
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).not.toBe(null);
      });
    });

    it('should switch immediately when focusing another trigger while open', async () => {
      render(() => (
        <PreviewCard.Root>
          {(arg: NumberPayload) => (
            <>
              <button type="button" aria-label="Initial focus" autofocus />
              <PreviewCard.Trigger href="#" payload={1} delay={0}>
                Trigger 1
              </PreviewCard.Trigger>
              <PreviewCard.Trigger href="#" payload={2} delay={2000}>
                Trigger 2
              </PreviewCard.Trigger>

              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup>
                    <span data-testid="content">{arg.payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </>
          )}
        </PreviewCard.Root>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await act(() => trigger1.focus());
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await act(() => trigger2.focus());
      expect(screen.getByTestId('content').textContent).toBe('2');
    });

    it('should close when the active trigger unmounts', async () => {
      const [showFirstTrigger, setShowFirstTrigger] = createSignal(true);

      render(() => (
        <PreviewCard.Root defaultOpen defaultTriggerId="trigger-1">
          {(arg: NumberPayload) => (
            <>
              <Show when={showFirstTrigger()}>
                <PreviewCard.Trigger href="#" id="trigger-1" payload={1} delay={0}>
                  Trigger 1
                </PreviewCard.Trigger>
              </Show>
              <PreviewCard.Trigger href="#" id="trigger-2" payload={2} delay={0}>
                Trigger 2
              </PreviewCard.Trigger>

              <PreviewCard.Portal>
                <PreviewCard.Positioner side="bottom" align="start">
                  <PreviewCard.Popup>
                    <span data-testid="content">{arg.payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </>
          )}
        </PreviewCard.Root>
      ));

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      await act(() => setShowFirstTrigger(false));

      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(screen.queryByRole('link', { name: 'Trigger 1' })).toBe(null);
      expect(trigger2).not.toHaveAttribute('data-popup-open');
    });

    it('should remain open when the active trigger unmount close is canceled', async () => {
      const [showFirstTrigger, setShowFirstTrigger] = createSignal(true);
      const onOpenChange = vi.fn(
        (nextOpen: boolean, details: PreviewCard.Root.ChangeEventDetails) => {
          if (!nextOpen) {
            details.cancel();
          }
        },
      );

      render(() => (
        <PreviewCard.Root defaultOpen defaultTriggerId="trigger-1" onOpenChange={onOpenChange}>
          {(arg: NumberPayload) => (
            <>
              <Show when={showFirstTrigger()}>
                <PreviewCard.Trigger href="#" id="trigger-1" payload={1} delay={0}>
                  Trigger 1
                </PreviewCard.Trigger>
              </Show>
              <PreviewCard.Trigger href="#" id="trigger-2" payload={2} delay={0}>
                Trigger 2
              </PreviewCard.Trigger>

              <PreviewCard.Portal>
                <PreviewCard.Positioner side="bottom" align="start">
                  <PreviewCard.Popup>
                    <span data-testid="content">{arg.payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </>
          )}
        </PreviewCard.Root>
      ));

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      await act(() => setShowFirstTrigger(false));

      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(
          false,
          expect.objectContaining({ reason: 'none' }),
        );
      });
      expect(screen.queryByRole('link', { name: 'Trigger 1' })).toBe(null);
      expect(trigger2).not.toHaveAttribute('data-popup-open');
      expect(screen.getByTestId('content')).toHaveTextContent('1');
    });
  });

  describe('multiple detached triggers', () => {
    // Measures the positioner against each trigger's rect; jsdom has no layout.
    it.skip('should reposition to a different trigger when reopened with keepMounted=true', () => {});

    it('should close when the active detached trigger unmounts', async () => {
      const testPreviewCard = PreviewCard.createHandle<number>();
      const [showFirstTrigger, setShowFirstTrigger] = createSignal(true);

      render(() => (
        <div>
          <button type="button" aria-label="Initial focus" autofocus />
          <div>
            <Show when={showFirstTrigger()}>
              <PreviewCard.Trigger
                href="#"
                handle={testPreviewCard}
                id="trigger-1"
                payload={1}
                delay={0}
              >
                Trigger 1
              </PreviewCard.Trigger>
            </Show>
            <PreviewCard.Trigger
              href="#"
              handle={testPreviewCard}
              id="trigger-2"
              payload={2}
              delay={0}
            >
              Trigger 2
            </PreviewCard.Trigger>
          </div>

          <PreviewCard.Root handle={testPreviewCard} defaultOpen defaultTriggerId="trigger-1">
            {(arg: NumberPayload) => (
              <PreviewCard.Portal>
                <PreviewCard.Positioner side="bottom" align="start">
                  <PreviewCard.Popup>
                    <span data-testid="content">{arg.payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            )}
          </PreviewCard.Root>
        </div>
      ));

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      await act(() => setShowFirstTrigger(false));

      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(screen.queryByRole('link', { name: 'Trigger 1' })).toBe(null);
      expect(trigger2).not.toHaveAttribute('data-popup-open');
    });

    // The close-transition tests below rely on CSS animations (`data-ending-style` held by a
    // running keyframe animation); jsdom doesn't run animations.
    it.skip('opens immediately when entering trigger B during trigger A close transition', () => {});
    it.skip('still respects trigger B open delay after trigger A close transition finishes', () => {});
    it.skip('reopens immediately when re-hovering trigger A during its close transition', () => {});
    it.skip('respects open delay on later same-trigger hovers after close lifecycle finishes', () => {});
  });
});
