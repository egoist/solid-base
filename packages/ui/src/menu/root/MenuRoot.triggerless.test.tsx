import { Show, createSignal, onSettled, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { screen, waitFor } from '@solidjs/testing-library';
import { Menu } from '..';
import { DirectionProvider } from '../../direction-provider';
import { useMenuRootContext } from './MenuRootContext';
import type { MenuStore } from '../store/MenuStore';
import { act, renderWithUser } from '../test-utils';

function Popup(props: Menu.Portal.Props) {
  const portalProps = omit(props, 'children');
  return (
    <Menu.Portal {...portalProps}>
      <Menu.Positioner anchor={document.body}>
        <Menu.Popup>{props.children}</Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function Submenu(
  props: Menu.SubmenuRoot.Props & { label: string; openOnHover?: boolean; children?: JSX.Element },
) {
  const rootProps = omit(props, 'label', 'openOnHover', 'children');
  return (
    <Menu.SubmenuRoot {...rootProps}>
      <Menu.SubmenuTrigger openOnHover={props.openOnHover ?? false} delay={0}>
        {props.label}
      </Menu.SubmenuTrigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>{props.children}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.SubmenuRoot>
  );
}

describe('<Menu.Root /> without a trigger', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  async function focusItem(name: string) {
    const item = await screen.findByRole('menuitem', { name });
    // The focus manager moves focus into the popup on the next frame after it opens.
    await waitFor(() =>
      expect(item.closest('[role="menu"]')).toContainElement(
        document.activeElement as HTMLElement,
      ),
    );
    await act(() => item.focus());
    return item;
  }

  describe.each(['ltr', 'rtl'] as const)('%s', (direction) => {
    it.each([false, true])(
      'keeps nested Escape and focus local, keepMounted=%s',
      async (keepMounted) => {
        const changed = vi.fn();
        const { user } = renderWithUser(() => (
          <DirectionProvider direction={direction}>
            <Menu.Root defaultOpen modal={false} onOpenChange={changed}>
              <Popup keepMounted={keepMounted}>
                <Submenu label="More">
                  <Menu.Item>Leaf</Menu.Item>
                </Submenu>
              </Popup>
            </Menu.Root>
          </DirectionProvider>
        ));
        const more = await focusItem('More');
        const root = screen.getByRole('menu');
        const openKey = direction === 'rtl' ? '{ArrowLeft}' : '{ArrowRight}';
        await user.keyboard(openKey);
        await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Leaf' })).toHaveFocus());
        expect(changed).not.toHaveBeenCalled();
        expect(root).toHaveAttribute('data-open');

        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Leaf' })).toBeNull());
        await waitFor(() => expect(more).toHaveFocus());
        expect(changed).not.toHaveBeenCalled();
        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
        expect(changed).toHaveBeenCalledExactlyOnceWith(
          false,
          expect.objectContaining({ reason: 'escape-key' }),
        );
        expect(root.isConnected).toBe(keepMounted);
      },
    );
  });

  it.each([false, true])(
    'supports an external anchor across reopen, keepMounted=%s',
    async (keepMounted) => {
      const changed = vi.fn();
      function Demo() {
        const [anchor, setAnchor] = createSignal<HTMLButtonElement | null>(null);
        return (
          <>
            <button type="button" onClick={(event) => setAnchor(event.currentTarget)}>
              Open
            </button>
            <Menu.Root
              open={Boolean(anchor())}
              onOpenChange={(open, details) => {
                changed(open, details.reason);
                if (!open) {
                  setAnchor(null);
                }
              }}
            >
              <Menu.Portal keepMounted={keepMounted}>
                <Menu.Positioner anchor={anchor()}>
                  <Menu.Popup>
                    <Submenu label="More">
                      <Menu.Item>Nested</Menu.Item>
                    </Submenu>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </>
        );
      }
      const { user } = renderWithUser(() => <Demo />);
      const anchor = screen.getByRole('button', { name: 'Open' });

      async function openAndSelect() {
        await user.click(anchor);
        await focusItem('More');
        await user.keyboard('{ArrowRight}');
        const nested = await screen.findByRole('menuitem', { name: 'Nested' });
        await waitFor(() => expect(nested).toHaveFocus());
        expect(changed).not.toHaveBeenCalled();
        await user.click(nested);
        await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
        expect(changed).toHaveBeenCalledExactlyOnceWith(false, 'item-press');
        await waitFor(() => expect(anchor).toHaveFocus());
        changed.mockClear();
      }
      await openAndSelect();
      await openAndSelect();
    },
  );

  it.each(['click', 'hover'] as const)(
    'closes a sibling submenu without closing the root on %s',
    async (method) => {
      const changed = vi.fn();
      const firstChanged = vi.fn();
      const { user } = renderWithUser(() => (
        <Menu.Root defaultOpen modal={false} onOpenChange={changed}>
          <Popup>
            <Submenu label="First" onOpenChange={firstChanged} openOnHover={method === 'hover'}>
              <Menu.Item>First item</Menu.Item>
            </Submenu>
            <Submenu label="Second" openOnHover={method === 'hover'}>
              <Menu.Item>Second item</Menu.Item>
            </Submenu>
          </Popup>
        </Menu.Root>
      ));
      await user[method](await focusItem('First'));
      await screen.findByRole('menuitem', { name: 'First item' });
      firstChanged.mockClear();
      await user[method](screen.getByRole('menuitem', { name: 'Second' }));
      await screen.findByRole('menuitem', { name: 'Second item' });
      await waitFor(() =>
        expect(screen.queryByRole('menuitem', { name: 'First item' })).toBeNull(),
      );
      expect(firstChanged).toHaveBeenCalledExactlyOnceWith(
        false,
        expect.objectContaining({
          reason: expect.stringMatching(
            method === 'hover' ? /^(trigger-hover|sibling-open)$/ : /^sibling-open$/,
          ),
        }),
      );
      expect(changed).not.toHaveBeenCalled();
    },
  );

  it('keeps an initially open submenu attached to the root', async () => {
    const changed = vi.fn();
    const completed = vi.fn();
    renderWithUser(() => (
      <Menu.Root defaultOpen modal={false} onOpenChange={changed}>
        <Popup>
          <Submenu label="More" defaultOpen onOpenChangeComplete={completed}>
            <Menu.Item>Nested</Menu.Item>
          </Submenu>
        </Popup>
      </Menu.Root>
    ));
    await waitFor(() => expect(completed).toHaveBeenCalledWith(true));
    expect(screen.getAllByRole('menu')).toHaveLength(2);
    expect(changed).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'preserves real trigger registration, initially present=%s',
    async (initialTrigger) => {
      const changed = vi.fn();
      const registered: Array<[MenuStore<unknown>, unknown, unknown]> = [];
      function CaptureTriggerIds() {
        const { store } = useMenuRootContext();
        onSettled(() => {
          registered.push([
            store as MenuStore<unknown>,
            store.state.floatingNodeId,
            store.state.floatingParentNodeId,
          ]);
        });
        return null;
      }
      function Demo() {
        const [hasTrigger, setHasTrigger] = createSignal(initialTrigger);
        return (
          <Menu.Root defaultOpen modal={false} onOpenChange={changed}>
            <Show when={hasTrigger()}>
              <Menu.Trigger>Options</Menu.Trigger>
              <CaptureTriggerIds />
            </Show>
            <Popup>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger
                  openOnHover={false}
                  onKeyDown={(event) => {
                    if (event.key === 'F2') {
                      setHasTrigger(true);
                    }
                  }}
                >
                  More
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Item>Nested</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Popup>
          </Menu.Root>
        );
      }
      const { user } = renderWithUser(() => <Demo />);
      await focusItem('More');
      await user.keyboard('{F2}');
      await act(() => {});
      const trigger = screen.getByRole('button', { name: 'Options' });

      // The trigger rendered inside its Root shares the Root's floating tree position.
      expect(registered.length).toBeGreaterThan(0);
      const [store, triggerNodeId, triggerParentNodeId] = registered[registered.length - 1];
      expect(triggerNodeId).toBeDefined();
      expect(store.state.floatingNodeId).toBe(triggerNodeId);
      expect(store.state.floatingParentNodeId).toBe(triggerParentNodeId);

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Nested' })).toHaveFocus());
      expect(changed).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Nested' })).toBeNull());
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      await waitFor(() => expect(trigger).toHaveFocus());
    },
  );
});
