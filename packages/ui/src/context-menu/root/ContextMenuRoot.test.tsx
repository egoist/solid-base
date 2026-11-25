import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { ContextMenu } from '..';
import { flushMicrotasks, renderWithUser } from '../../menu/test-utils';
import { REASONS } from '../../internals/reasons';

vi.mock('@egoist/solid-base-utils/platform', async () => {
  const actual = await vi.importActual<typeof import('@egoist/solid-base-utils/platform')>(
    '@egoist/solid-base-utils/platform',
  );

  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: { ...actual.platform.os, mac: true, apple: true },
    },
  };
});

describe('<ContextMenu.Root />', () => {
  describe('interactions', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      // Fire pending fake frames so module-level frame ids don't leak into later tests.
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    it('closes nested submenus when releasing the context menu pointer over an item', async () => {
      const rootOnOpenChange = vi.fn();
      const submenuOnOpenChange = vi.fn();

      const { user } = renderWithUser(() => (
        <ContextMenu.Root onOpenChange={rootOnOpenChange}>
          <ContextMenu.Trigger data-testid="context-trigger">Surface</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup data-testid="context-root-popup">
                <ContextMenu.SubmenuRoot defaultOpen onOpenChange={submenuOnOpenChange}>
                  <ContextMenu.SubmenuTrigger delay={1} data-testid="context-submenu-trigger">
                    More options
                  </ContextMenu.SubmenuTrigger>
                  <ContextMenu.Portal>
                    <ContextMenu.Positioner>
                      <ContextMenu.Popup data-testid="context-submenu-popup">
                        <ContextMenu.Item data-testid="context-submenu-item">
                          Deep action
                        </ContextMenu.Item>
                      </ContextMenu.Popup>
                    </ContextMenu.Positioner>
                  </ContextMenu.Portal>
                </ContextMenu.SubmenuRoot>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('context-trigger');

      fireEvent.contextMenu(trigger, { clientX: 10, clientY: 10, button: 2 });
      await flushMicrotasks();

      await screen.findByTestId('context-root-popup');

      const submenuTrigger = screen.getByTestId('context-submenu-trigger');
      await user.hover(submenuTrigger);

      await screen.findByTestId('context-submenu-popup');
      await flushMicrotasks();

      const submenuItem = screen.getByTestId('context-submenu-item');
      fireEvent.mouseUp(submenuItem, { button: 2 });
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.queryByTestId('context-submenu-popup')).toBe(null);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('context-root-popup')).toBe(null);
      });

      expect(submenuOnOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(submenuOnOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
      expect(rootOnOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(rootOnOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
    });

    it('does not activate a submenu trigger when releasing the context menu pointer over it', async () => {
      const submenuOnOpenChange = vi.fn();

      renderWithUser(() => (
        <ContextMenu.Root>
          <ContextMenu.Trigger data-testid="context-trigger">Surface</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup data-testid="context-root-popup">
                <ContextMenu.SubmenuRoot onOpenChange={submenuOnOpenChange}>
                  <ContextMenu.SubmenuTrigger
                    data-testid="context-submenu-trigger"
                    openOnHover={false}
                  >
                    More options
                  </ContextMenu.SubmenuTrigger>
                  <ContextMenu.Portal>
                    <ContextMenu.Positioner>
                      <ContextMenu.Popup data-testid="context-submenu-popup">
                        <ContextMenu.Item>Deep action</ContextMenu.Item>
                      </ContextMenu.Popup>
                    </ContextMenu.Positioner>
                  </ContextMenu.Portal>
                </ContextMenu.SubmenuRoot>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('context-trigger');
      fireEvent.contextMenu(trigger, { clientX: 20, clientY: 20, button: 2 });
      await screen.findByTestId('context-root-popup');
      await flushMicrotasks();

      fireEvent.pointerMove(document.body, { clientX: 24, clientY: 24 });
      fireEvent.mouseUp(screen.getByTestId('context-submenu-trigger'), {
        button: 2,
        clientX: 24,
        clientY: 24,
      });
      await flushMicrotasks();

      expect(screen.queryByTestId('context-submenu-popup')).toBe(null);
      expect(submenuOnOpenChange).not.toHaveBeenCalled();
    });

    it.each([0, -5])(
      'ignores mouseup directly under the cursor when the context menu spawns there (alignOffset %s)',
      async (alignOffset) => {
        const onOpenChange = vi.fn();

        renderWithUser(() => (
          <ContextMenu.Root onOpenChange={onOpenChange}>
            <ContextMenu.Trigger data-testid="context-trigger">Surface</ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Positioner alignOffset={alignOffset}>
                <ContextMenu.Popup data-testid="context-popup">
                  <ContextMenu.Item data-testid="context-item">Action</ContextMenu.Item>
                </ContextMenu.Popup>
              </ContextMenu.Positioner>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        ));

        const trigger = screen.getByTestId('context-trigger');

        fireEvent.contextMenu(trigger, { clientX: 12, clientY: 12, button: 2 });

        await screen.findByTestId('context-popup');
        await flushMicrotasks();
        const item = screen.getByTestId('context-item');

        fireEvent.mouseUp(item, { button: 2, clientX: 12, clientY: 12 });
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.queryByTestId('context-popup')).not.toBe(null);
        });

        expect(onOpenChange.mock.calls.length).toBe(1);
      },
    );

    it('allows mouseup after leaving the initial cursor point', async () => {
      const onOpenChange = vi.fn();

      renderWithUser(() => (
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="context-trigger">Surface</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner alignOffset={0}>
              <ContextMenu.Popup data-testid="context-popup">
                <ContextMenu.Item data-testid="context-item">Action</ContextMenu.Item>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('context-trigger');

      fireEvent.contextMenu(trigger, { clientX: 20, clientY: 20, button: 2 });

      await screen.findByTestId('context-popup');
      await flushMicrotasks();
      const item = screen.getByTestId('context-item');

      fireEvent.pointerMove(document.body, { clientX: 24, clientY: 24 });
      fireEvent.mouseUp(item, { button: 2, clientX: 24, clientY: 24 });

      await waitFor(() => {
        expect(screen.queryByTestId('context-popup')).toBe(null);
      });

      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
    });

    it('does not open when disabled', async () => {
      const onOpenChange = vi.fn();

      renderWithUser(() => (
        <ContextMenu.Root disabled onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="context-trigger">Surface</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup data-testid="context-popup">
                <ContextMenu.Item>Action</ContextMenu.Item>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('context-trigger');

      fireEvent.contextMenu(trigger, { clientX: 10, clientY: 10, button: 2 });
      await flushMicrotasks();

      expect(screen.queryByTestId('context-popup')).toBe(null);
      expect(onOpenChange.mock.calls.length).toBe(0);
    });
  });

  it.each([
    { name: 'Shift+Tab', shift: true },
    { name: 'Tab', shift: false },
  ])('returns focus to the focused surface when closing with $name', async ({ shift }) => {
    const { user } = renderWithUser(() => (
      <ContextMenu.Root>
        <ContextMenu.Trigger render="button">Surface</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup>
              <ContextMenu.Item>Item</ContextMenu.Item>
            </ContextMenu.Popup>
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    const surface = screen.getByRole('button', { name: 'Surface' });
    await user.tab();
    expect(surface).toHaveFocus();
    fireEvent.contextMenu(surface, { clientX: 20, clientY: 20, button: 2 });
    await waitFor(() => {
      expect(screen.getByRole('menu')).toHaveFocus();
    });

    await user.tab({ shift });
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBe(null);
    });
    expect(surface).toHaveFocus();
  });

  // Skipped: collision avoidance (flipping) needs real layout, which jsdom doesn't provide.
  it.skip('prop: collisionAvoidance flips to the opposite side when side: flip is set and there is no space', () => {});
});
