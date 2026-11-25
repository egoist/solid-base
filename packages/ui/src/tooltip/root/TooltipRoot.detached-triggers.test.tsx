import { Show, createSignal } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Tooltip } from '..';
import { act, flushMicrotasks } from '../../dialog/test-utils';

/**
 * Focuses an element the way a keyboard user would. jsdom doesn't match `:focus-visible` on
 * programmatic focus, so a key press first switches to keyboard modality.
 */
async function keyboardFocus(element: HTMLElement) {
  await act(async () => {
    fireEvent.keyDown(document, { key: 'Tab' });
    element.focus();
  });
}

describe('<Tooltip.Root />', () => {
  beforeEach(async () => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;

    await act(async () => {
      document.body.click();
    });
  });

  // React-only: server rendering and hydration with Suspense.
  it.skip('keeps a default-open root open until its detached trigger hydrates', () => {});
  // React-only: server rendering and hydration.
  it.skip('keeps an open root open when ownership moves to a trigger that has not hydrated', () => {});

  describe('does not re-render inactive triggers', () => {
    // Solid doesn't re-render: the `render` prop of a trigger is called once. These check that the
    // bystander trigger's render function isn't called again while the popup changes.
    function renderTooltip() {
      const handle = Tooltip.createHandle();
      const bystander = { renders: 0 };

      render(() => (
        <div>
          <Tooltip.Trigger handle={handle} id="trigger-1" delay={0} closeDelay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={handle} id="trigger-2" delay={0} closeDelay={0}>
            Trigger 2
          </Tooltip.Trigger>
          <Tooltip.Trigger
            handle={handle}
            id="trigger-3"
            render={(props) => {
              bystander.renders += 1;
              return <button {...props} />;
            }}
          >
            Trigger 3
          </Tooltip.Trigger>
          <Tooltip.Root handle={handle}>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      ));

      bystander.renders = 0;
      return {
        handle,
        bystander,
        trigger1: screen.getByRole('button', { name: 'Trigger 1' }),
        trigger2: screen.getByRole('button', { name: 'Trigger 2' }),
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
      const { handle, bystander, trigger1 } = renderTooltip();

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
      const { handle, bystander, trigger1, trigger2 } = renderTooltip();

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
      const { bystander, trigger1 } = renderTooltip();

      async function openAndClose() {
        await keyboardFocus(trigger1);
        await expectOpenedBy(trigger1);
        await act(async () => trigger1.blur());
        await expectClosed(trigger1);
      }

      await openAndClose();
      await openAndClose();
      expect(bystander.renders).toBe(0);
    });

    it('when hover opens and closes the popup', async () => {
      const { bystander, trigger1, trigger2 } = renderTooltip();

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

  it('closes a cursor-tracking tooltip when an inactive trigger is pressed', async () => {
    const handle = Tooltip.createHandle();

    render(() => (
      <div>
        <Tooltip.Trigger handle={handle} id="trigger-1">
          Trigger 1
        </Tooltip.Trigger>
        <Tooltip.Trigger handle={handle} id="trigger-2">
          Trigger 2
        </Tooltip.Trigger>
        <Tooltip.Root handle={handle} trackCursorAxis="both">
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>
    ));

    await act(() => handle.open('trigger-1'));
    expect(await screen.findByTestId('popup')).not.toBe(null);

    const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
    fireEvent.pointerDown(trigger2, { pointerType: 'touch' });
    fireEvent.click(trigger2);

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  describe('handle-backed root ownership', () => {
    it('keeps a default-open root open while a detached trigger migrates after the initial commit', async () => {
      const handle = Tooltip.createHandle();
      const onOpenChange = vi.fn();

      render(() => (
        <>
          <Tooltip.Root
            handle={handle}
            defaultOpen
            defaultTriggerId="trigger"
            onOpenChange={onOpenChange}
          >
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="default-open-content">Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Tooltip.Trigger handle={handle} id="trigger">
            Trigger
          </Tooltip.Trigger>
        </>
      ));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute(
          'data-popup-open',
        );
      });

      expect(handle.isOpen).toBe(true);
      expect(screen.getByTestId('default-open-content')).toHaveAttribute('data-open');
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('multiple triggers within Root', () => {
    type NumberPayload = { readonly payload: number | undefined };

    it('hands off open state and payload to a trigger with its own DOM id while open', async () => {
      render(() => (
        <Tooltip.Root>
          {(root: NumberPayload) => (
            <>
              <Tooltip.Trigger payload={1} delay={0} closeDelay={0}>
                Trigger 1
              </Tooltip.Trigger>
              <Tooltip.Trigger
                payload={2}
                delay={0}
                closeDelay={0}
                render={(props) => <button {...props} id="custom-button" type="button" />}
              >
                Trigger 2
              </Tooltip.Trigger>

              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>
                    <span data-testid="content">{root.payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </>
          )}
        </Tooltip.Root>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      // Focus handoff keeps the popup open across the switch.
      await keyboardFocus(trigger1);
      await flushMicrotasks();
      expect(screen.getByTestId('content').textContent).toBe('1');

      await keyboardFocus(trigger2);
      await flushMicrotasks();
      expect(trigger2).toHaveAttribute('data-popup-open');
      expect(screen.getByTestId('content').textContent).toBe('2');
    });

    function TwoTriggers(props: {
      onOpenChange?: Tooltip.Root.Props['onOpenChange'];
      showFirstTrigger: () => boolean;
    }) {
      return (
        <div style={{ padding: '50px' }}>
          <Tooltip.Root defaultOpen defaultTriggerId="trigger-1" onOpenChange={props.onOpenChange}>
            {(root: NumberPayload) => (
              <>
                <div style={{ display: 'flex', gap: '120px' }}>
                  <Show when={props.showFirstTrigger()}>
                    <Tooltip.Trigger id="trigger-1" payload={1} delay={0}>
                      Trigger 1
                    </Tooltip.Trigger>
                  </Show>
                  <Tooltip.Trigger id="trigger-2" payload={2} delay={0}>
                    Trigger 2
                  </Tooltip.Trigger>
                </div>

                <Tooltip.Portal>
                  <Tooltip.Positioner side="bottom" align="start">
                    <Tooltip.Popup>
                      <span data-testid="content">{root.payload}</span>
                    </Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </>
            )}
          </Tooltip.Root>
        </div>
      );
    }

    it('should close when the active trigger unmounts', async () => {
      const [showFirstTrigger, setShowFirstTrigger] = createSignal(true);

      render(() => <TwoTriggers showFirstTrigger={showFirstTrigger} />);

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      await act(() => setShowFirstTrigger(false));

      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(screen.queryByRole('button', { name: 'Trigger 1' })).toBe(null);
      expect(trigger2).not.toHaveAttribute('data-popup-open');
    });

    it('should remain open when the active trigger unmount close is canceled', async () => {
      const [showFirstTrigger, setShowFirstTrigger] = createSignal(true);
      const onOpenChange = vi.fn((nextOpen: boolean, details: Tooltip.Root.ChangeEventDetails) => {
        if (!nextOpen) {
          details.cancel();
        }
      });

      render(() => <TwoTriggers showFirstTrigger={showFirstTrigger} onOpenChange={onOpenChange} />);

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      await act(() => setShowFirstTrigger(false));

      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(
          false,
          expect.objectContaining({ reason: 'none' }),
        );
      });
      expect(screen.queryByRole('button', { name: 'Trigger 1' })).toBe(null);
      expect(trigger2).not.toHaveAttribute('data-popup-open');
      expect(screen.getByTestId('content')).toHaveTextContent('1');
    });
  });

  describe('multiple detached triggers', () => {
    type NumberPayload = { readonly payload: number | undefined };

    function DetachedRoot(props: { handle: Tooltip.Handle<number>; defaultOpen?: boolean }) {
      return (
        <Tooltip.Root
          handle={props.handle}
          defaultOpen={props.defaultOpen}
          defaultTriggerId={props.defaultOpen ? 'trigger-1' : undefined}
        >
          {(root: NumberPayload) => (
            <Tooltip.Portal>
              <Tooltip.Positioner side="bottom" align="start">
                <Tooltip.Popup>
                  <span data-testid="content">{root.payload}</span>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          )}
        </Tooltip.Root>
      );
    }

    it('should close when focusing a disabled trigger while another trigger is open', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      render(() => (
        <div>
          <Tooltip.Trigger handle={testTooltip} payload={1}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} payload={2} disabled>
            Trigger 2
          </Tooltip.Trigger>
          <DetachedRoot handle={testTooltip} />
        </div>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await keyboardFocus(trigger1);
      await flushMicrotasks();
      expect(screen.getByTestId('content').textContent).toBe('1');

      await keyboardFocus(trigger2);
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(trigger2).not.toHaveAttribute('data-popup-open');
    });

    it('should close when the active detached trigger unmounts', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      const [showFirstTrigger, setShowFirstTrigger] = createSignal(true);

      render(() => (
        <div style={{ padding: '50px' }}>
          <div style={{ display: 'flex', gap: '120px' }}>
            <Show when={showFirstTrigger()}>
              <Tooltip.Trigger handle={testTooltip} id="trigger-1" payload={1} delay={0}>
                Trigger 1
              </Tooltip.Trigger>
            </Show>
            <Tooltip.Trigger handle={testTooltip} id="trigger-2" payload={2} delay={0}>
              Trigger 2
            </Tooltip.Trigger>
          </div>
          <DetachedRoot handle={testTooltip} defaultOpen />
        </div>
      ));

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      await act(() => setShowFirstTrigger(false));

      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(screen.queryByRole('button', { name: 'Trigger 1' })).toBe(null);
      expect(trigger2).not.toHaveAttribute('data-popup-open');
    });

    it('should close when hovering a disabled trigger while another trigger is open', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      render(() => (
        <div>
          <Tooltip.Trigger handle={testTooltip} payload={1} delay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} payload={2} disabled>
            Trigger 2
          </Tooltip.Trigger>
          <DetachedRoot handle={testTooltip} />
        </div>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      fireEvent.mouseLeave(trigger1);
      fireEvent.mouseEnter(trigger2);
      fireEvent.mouseMove(trigger2);
      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(trigger2).not.toHaveAttribute('data-popup-open');
    });

    it('should switch to a rendered disabled button trigger when trigger hover is enabled', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      render(() => (
        <div>
          <Tooltip.Trigger handle={testTooltip} payload={1} delay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger
            handle={testTooltip}
            payload={2}
            delay={0}
            render={(props) => <button {...props} type="button" disabled />}
          >
            Trigger 2
          </Tooltip.Trigger>
          <DetachedRoot handle={testTooltip} />
        </div>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      fireEvent.mouseLeave(trigger1);
      fireEvent.mouseEnter(trigger2);
      fireEvent.mouseMove(trigger2);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('2');
      });
      await waitFor(() => {
        expect(trigger2).toHaveAttribute('data-popup-open');
      });
    });
  });
});
