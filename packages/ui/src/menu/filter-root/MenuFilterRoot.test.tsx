import { For, Show, createSignal, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { Dialog } from '../../dialog';
import { DirectionProvider } from '../../direction-provider';
import { ScrollArea } from '../../scroll-area';
import { Menu } from '..';
import { renderWithProps } from '../../dialog/test-utils';
import {
  act,
  createRef,
  flushMicrotasks,
  renderWithUser,
  waitSingleFrame,
} from '../test-utils';

// Mainline tests assert the non-WebKit path (jsdom is not WebKit, so no platform mock is needed);
// MenuFilterRoot.webkit.test.tsx covers its compatibility state.

/**
 * The most common fixture of this file: a filterable "Actions" menu whose `children` are the
 * contents of its `Menu.List`.
 */
function ActionsMenu(props: {
  providerProps?: Omit<Menu.FilterProvider.Props, 'children'>;
  rootProps?: Omit<Menu.Root.Props, 'children'>;
  inputLabel?: string;
  children?: JSX.Element;
}) {
  return (
    <Menu.FilterProvider {...props.providerProps}>
      <Menu.Root {...props.rootProps}>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Input aria-label={props.inputLabel ?? 'Filter actions'} />
              <Menu.List>{props.children}</Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menu.FilterProvider>
  );
}

/**
 * A filterable "Actions" menu whose list holds a filterable "Move to folder" submenu.
 */
function FolderMenu(props: {
  rootProps?: Omit<Menu.Root.Props, 'children'>;
  submenuProviderProps?: Omit<Menu.FilterProvider.Props, 'children'>;
  submenuRootProps?: Omit<Menu.SubmenuRoot.Props, 'children'>;
  triggerProps?: Omit<Menu.SubmenuTrigger.Props, 'children'>;
  triggerLabel?: string;
  inputLabel?: string;
  submenuItems?: JSX.Element;
  before?: JSX.Element;
  after?: JSX.Element;
}) {
  return (
    <ActionsMenu rootProps={props.rootProps ?? { defaultOpen: true }}>
      {props.before}
      <Menu.FilterProvider {...props.submenuProviderProps}>
        <Menu.SubmenuRoot {...props.submenuRootProps}>
          <Menu.SubmenuTrigger {...props.triggerProps}>
            {props.triggerLabel ?? 'Move to folder'}
          </Menu.SubmenuTrigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label={props.inputLabel ?? 'Filter folders'} />
                <Menu.List>{props.submenuItems ?? <Menu.Item>Documents</Menu.Item>}</Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.SubmenuRoot>
      </Menu.FilterProvider>
      {props.after}
    </ActionsMenu>
  );
}

describe('<Menu.FilterProvider><Menu.Root/></Menu.FilterProvider>', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  // Drag release selection depends on real pointer timing and layout.
  it.skip('keeps input focus after selecting an item by drag release', () => {});

  describe('opening with a query', () => {
    it('keeps the matching items mounted', async () => {
      const nodes = { Rename: new Set<Element>(), Copy: new Set<Element>() };
      function Tracked(props: { label: 'Rename' | 'Copy' }) {
        return (
          <span
            ref={(node) => {
              nodes[props.label].add(node);
            }}
          >
            {props.label}
          </span>
        );
      }

      const { user } = renderWithUser(() => (
        <ActionsMenu providerProps={{ defaultValue: 'e' }}>
          <Menu.Item>
            <Tracked label="Rename" />
          </Menu.Item>
          <Menu.Item>
            <Tracked label="Copy" />
          </Menu.Item>
        </ActionsMenu>
      ));

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await user.click(trigger);

      const rename = await screen.findByRole('menuitem', { name: 'Rename' });
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'Copy' })).toBe(null);
      });
      // A non-matching item renders once so its text can be read; a match is never remounted.
      expect(nodes.Copy.size).toBe(1);
      expect(nodes.Rename.size).toBe(1);
      expect(rename).toContainElement([...nodes.Rename][0] as HTMLElement);
    });
  });

  describe('filtering', () => {
    // Requires a running exit animation (jsdom has no animations).
    it.skip('ignores ArrowDown/ArrowUp in the input while the popup animates out', () => {});
    // Requires a running exit animation (jsdom has no animations).
    it.skip('ignores text typed in the input while the popup animates out', () => {});

    it('highlights the first item while keeping input focus when opened with the keyboard', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu>
          <Menu.Item>Rename</Menu.Item>
        </ActionsMenu>
      ));

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await act(() => trigger.focus());
      await user.keyboard('[Enter]');

      const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      expect(input).not.toHaveAttribute('data-highlighted');
      await waitFor(() => {
        expect(input).toHaveAttribute(
          'aria-activedescendant',
          screen.getByRole('menuitem', { name: 'Rename' }).id,
        );
      });
    });

    it('marks the input focus-visible when the menu is opened with a pointer', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu>
          <Menu.Item>Rename</Menu.Item>
        </ActionsMenu>
      ));

      await user.click(screen.getByRole('button', { name: 'Actions' }));

      const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      expect(input).toHaveAttribute('data-highlighted');
    });

    describe('prop: autoHighlight', () => {
      it('automatically highlights the first match after the user types', async () => {
        const { user } = renderWithUser(() => (
          <ActionsMenu providerProps={{ autoHighlight: true }} rootProps={{ defaultOpen: true }}>
            <Menu.Item>Rename</Menu.Item>
            <Menu.Item>Duplicate</Menu.Item>
            <Menu.Item>Delete</Menu.Item>
          </ActionsMenu>
        ));

        const input = screen.getByRole('searchbox', { name: 'Filter actions' });
        expect(input).not.toHaveAttribute('aria-activedescendant');

        await user.type(input, 'd');

        const duplicate = screen.getByRole('menuitem', { name: 'Duplicate' });
        await waitFor(() => {
          expect(duplicate).toHaveAttribute('data-highlighted');
        });
        expect(input).toHaveAttribute('aria-activedescendant', duplicate.id);

        await user.type(input, 'el');

        const deleteItem = screen.getByRole('menuitem', { name: 'Delete' });
        await waitFor(() => {
          expect(deleteItem).toHaveAttribute('data-highlighted');
        });
        expect(input).toHaveAttribute('aria-activedescendant', deleteItem.id);
      });

      it('updates the active descendant when filtering replaces a custom-id item', async () => {
        function Test(props: { value: string }) {
          return (
            <Menu.FilterProvider
              autoHighlight="always"
              value={props.value}
              onValueChange={() => {}}
            >
              <Menu.Root open>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Input aria-label="Filter fruit" />
                      <Menu.List>
                        <Menu.Item render={(p) => <div {...p} id="apple-item" />}>Apple</Menu.Item>
                        <Menu.Item render={(p) => <div {...p} id="banana-item" />}>
                          Banana
                        </Menu.Item>
                      </Menu.List>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </Menu.FilterProvider>
          );
        }

        const { setProps } = renderWithProps(Test, { value: '' });

        const input = screen.getByRole('searchbox', { name: 'Filter fruit' });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', 'apple-item');
        });

        await setProps({ value: 'ban' });

        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', 'banana-item');
        });
        expect(screen.queryByRole('menuitem', { name: 'Apple' })).toBe(null);
      });

      it('always highlights the first item when autoHighlight is "always"', async () => {
        renderWithUser(() => (
          <ActionsMenu providerProps={{ autoHighlight: 'always' }} rootProps={{ open: true }}>
            <Menu.Item>Rename</Menu.Item>
            <Menu.Item>Delete</Menu.Item>
          </ActionsMenu>
        ));

        const input = screen.getByRole('searchbox', { name: 'Filter actions' });
        const rename = screen.getByRole('menuitem', { name: 'Rename' });

        await waitFor(() => {
          expect(rename).toHaveAttribute('data-highlighted');
        });
        expect(input).toHaveAttribute('aria-activedescendant', rename.id);
      });

      it.each([true, 'always'] as const)(
        'keeps a highlight when typing does not change the trimmed query with autoHighlight=%s',
        async (autoHighlight) => {
          const { user } = renderWithUser(() => (
            <ActionsMenu providerProps={{ autoHighlight }} rootProps={{ open: true }}>
              <Menu.Item>Google Calendar</Menu.Item>
              <Menu.Item>Google Chrome</Menu.Item>
            </ActionsMenu>
          ));

          const input = screen.getByRole('searchbox', { name: 'Filter actions' });
          await user.type(input, 'Google');

          const firstItem = screen.getByRole('menuitem', { name: 'Google Calendar' });
          await waitFor(() => {
            expect(firstItem).toHaveAttribute('data-highlighted');
          });

          await user.type(input, ' ');

          await waitFor(() => {
            expect(firstItem).toHaveAttribute('data-highlighted');
          });
          expect(input).toHaveAttribute('aria-activedescendant', firstItem.id);
        },
      );

      it.each([true, 'always'] as const)(
        'does not allow arrow navigation to escape when autoHighlight is %s',
        async (autoHighlight) => {
          const { user } = renderWithUser(() => (
            <ActionsMenu providerProps={{ autoHighlight }} rootProps={{ open: true }}>
              <Menu.Item>Rename</Menu.Item>
              <Menu.Item>Delete</Menu.Item>
            </ActionsMenu>
          ));

          const input = screen.getByRole('searchbox', { name: 'Filter actions' });
          if (autoHighlight === true) {
            await user.type(input, 'e');
          } else {
            await act(() => input.focus());
          }

          const firstItem = screen.getByRole('menuitem', { name: 'Rename' });
          await waitFor(() => {
            expect(firstItem).toHaveAttribute('data-highlighted');
          });

          await user.keyboard('[ArrowUp]');

          const lastItem = screen.getByRole('menuitem', { name: 'Delete' });
          await waitFor(() => {
            expect(lastItem).toHaveAttribute('data-highlighted');
          });
          expect(input).toHaveAttribute('aria-activedescendant', lastItem.id);

          await user.keyboard('[ArrowDown]');

          await waitFor(() => {
            expect(firstItem).toHaveAttribute('data-highlighted');
          });
          expect(input).toHaveAttribute('aria-activedescendant', firstItem.id);
        },
      );

      it('always highlights the first item when mounted inside an opened dialog', async () => {
        function App() {
          const [open, setOpen] = createSignal(false);

          return (
            <Dialog.Root open={open()} onOpenChange={(next) => setOpen(next)}>
              <Dialog.Trigger>Open palette</Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Popup aria-label="Command palette">
                  <Menu.FilterProvider autoHighlight="always">
                    <Menu.Root open>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Input aria-label="Search commands" />
                            <Dialog.Close>Close palette</Dialog.Close>
                            <ScrollArea.Root>
                              <ScrollArea.Viewport>
                                <ScrollArea.Content>
                                  <Menu.List>
                                    <Menu.Group>
                                      <Menu.GroupLabel>Suggestions</Menu.GroupLabel>
                                      <Menu.Item>Linear</Menu.Item>
                                      <Menu.Item>Figma</Menu.Item>
                                    </Menu.Group>
                                  </Menu.List>
                                </ScrollArea.Content>
                              </ScrollArea.Viewport>
                              <ScrollArea.Scrollbar>
                                <ScrollArea.Thumb />
                              </ScrollArea.Scrollbar>
                            </ScrollArea.Root>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.Root>
                  </Menu.FilterProvider>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          );
        }

        const { user } = renderWithUser(() => <App />);

        await user.click(screen.getByRole('button', { name: 'Open palette' }));

        const input = await screen.findByRole('searchbox', { name: 'Search commands' });
        const firstItem = screen.getByRole('menuitem', { name: 'Linear' });
        await waitFor(() => {
          expect(firstItem).toHaveAttribute('data-highlighted');
        });
        expect(input).toHaveAttribute('aria-activedescendant', firstItem.id);
      });

      it('clears the automatic highlight when a typed query is cleared', async () => {
        const { user } = renderWithUser(() => (
          <ActionsMenu providerProps={{ autoHighlight: true }} rootProps={{ open: true }}>
            <Menu.Item>Rename</Menu.Item>
            <Menu.Item>Delete</Menu.Item>
          </ActionsMenu>
        ));

        const input = screen.getByRole('searchbox', { name: 'Filter actions' });
        await user.type(input, 'del');
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant');
        });

        await user.clear(input);

        await waitFor(() => {
          expect(input).not.toHaveAttribute('aria-activedescendant');
        });
        expect(screen.getByRole('menuitem', { name: 'Rename' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('clears a navigated highlight when Clear is pressed', async () => {
        const { user } = renderWithUser(() => (
          <Menu.FilterProvider autoHighlight>
            <Menu.Root open>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.Clear aria-label="Clear filter" />
                    <Menu.List>
                      <Menu.Item>Rename</Menu.Item>
                      <Menu.Item>Delete</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        ));

        const input = screen.getByRole('searchbox', { name: 'Filter actions' });
        await user.type(input, 'e');
        await user.keyboard('[ArrowDown]');
        const deleteItem = screen.getByRole('menuitem', { name: 'Delete' });
        await waitFor(() => {
          expect(deleteItem).toHaveAttribute('data-highlighted');
        });

        await user.click(screen.getByLabelText('Clear filter'));

        await waitFor(() => {
          expect(input).not.toHaveAttribute('aria-activedescendant');
        });
        expect(deleteItem).not.toHaveAttribute('data-highlighted');
      });

      it('restores the first item when an always-highlighted query is cleared', async () => {
        const { user } = renderWithUser(() => (
          <ActionsMenu providerProps={{ autoHighlight: 'always' }} rootProps={{ open: true }}>
            <Menu.Item>Rename</Menu.Item>
            <Menu.Item>Delete</Menu.Item>
          </ActionsMenu>
        ));

        const input = screen.getByRole('searchbox', { name: 'Filter actions' });
        await user.type(input, 'del');
        const deleteItem = screen.getByRole('menuitem', { name: 'Delete' });
        await waitFor(() => {
          expect(deleteItem).toHaveAttribute('data-highlighted');
        });

        await user.clear(input);

        const rename = screen.getByRole('menuitem', { name: 'Rename' });
        await waitFor(() => {
          expect(rename).toHaveAttribute('data-highlighted');
        });
        expect(input).toHaveAttribute('aria-activedescendant', rename.id);
      });

      it('clears the highlight when no items match', async () => {
        const { user } = renderWithUser(() => (
          <ActionsMenu providerProps={{ autoHighlight: true }} rootProps={{ open: true }}>
            <Menu.Item>Rename</Menu.Item>
            <Menu.Item>Delete</Menu.Item>
          </ActionsMenu>
        ));

        const input = screen.getByRole('searchbox', { name: 'Filter actions' });
        await user.type(input, 'missing');

        await waitFor(() => {
          expect(input).not.toHaveAttribute('aria-activedescendant');
        });
        expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
      });

      it('continues keyboard navigation from the automatic highlight and activates it', async () => {
        const onDelete = vi.fn();
        const { user } = renderWithUser(() => (
          <ActionsMenu providerProps={{ autoHighlight: true }} rootProps={{ open: true }}>
            <Menu.Item>Duplicate</Menu.Item>
            <Menu.Item onClick={onDelete}>Delete</Menu.Item>
          </ActionsMenu>
        ));

        const input = screen.getByRole('searchbox', { name: 'Filter actions' });
        await user.type(input, 'd');
        await waitFor(() => {
          expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toHaveAttribute(
            'data-highlighted',
          );
        });

        await user.keyboard('[ArrowDown][Enter]');

        expect(onDelete).toHaveBeenCalledTimes(1);
      });

      it('preserves navigation with an inline filter and a highlighted-item preview', async () => {
        const onActivate = vi.fn();

        function Test() {
          const [highlightedLabel, setHighlightedLabel] = createSignal<string>();

          return (
            <Menu.FilterProvider
              autoHighlight="always"
              filter={(text, query) => text.includes(query)}
            >
              <Menu.Root
                defaultOpen
                onItemHighlighted={(_, details) => setHighlightedLabel(details.label)}
              >
                <Menu.Trigger>Actions</Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Input aria-label="Filter actions" />
                      <Menu.List>
                        <Menu.Item onClick={() => onActivate('Rename')}>Rename</Menu.Item>
                        <Menu.Item onClick={() => onActivate('Delete')}>Delete</Menu.Item>
                      </Menu.List>
                      <div data-testid="preview">{highlightedLabel()}</div>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </Menu.FilterProvider>
          );
        }

        const { user } = renderWithUser(() => <Test />);
        const input = screen.getByRole('searchbox');
        await waitFor(() => expect(input).toHaveFocus());
        await waitFor(() => expect(screen.getByTestId('preview')).toHaveTextContent('Rename'));

        await user.keyboard('[ArrowDown]');

        expect(input).toHaveAttribute(
          'aria-activedescendant',
          screen.getByRole('menuitem', { name: 'Delete' }).id,
        );
        expect(screen.getByTestId('preview')).toHaveTextContent('Delete');

        await user.keyboard('[Enter]');

        expect(onActivate).toHaveBeenCalledExactlyOnceWith('Delete');
      });

      it('preserves a pointer highlight when autoHighlight is "always"', async () => {
        const { user } = renderWithUser(() => (
          <ActionsMenu providerProps={{ autoHighlight: 'always' }} rootProps={{ open: true }}>
            <Menu.Item>Rename</Menu.Item>
            <Menu.Item>Delete</Menu.Item>
          </ActionsMenu>
        ));

        const deleteItem = screen.getByRole('menuitem', { name: 'Delete' });
        await user.hover(deleteItem);

        await waitFor(() => {
          expect(deleteItem).toHaveAttribute('data-highlighted');
        });

        await user.unhover(deleteItem);

        expect(deleteItem).toHaveAttribute('data-highlighted');
      });

      it('keeps the highlight when an item\'s text changes with autoHighlight="always"', async () => {
        function Test(props: { count: number }) {
          return (
            <ActionsMenu providerProps={{ autoHighlight: 'always' }} rootProps={{ open: true }}>
              <Menu.Item>Inbox ({props.count})</Menu.Item>
              <Menu.Item>Archive</Menu.Item>
              <Menu.Item>Delete</Menu.Item>
            </ActionsMenu>
          );
        }

        const { user, setProps } = renderWithProps(Test, { count: 1 });
        const input = screen.getByRole('searchbox', { name: 'Filter actions' });
        await act(() => input.focus());
        await user.keyboard('[ArrowDown][ArrowDown]');

        const deleteItem = screen.getByRole('menuitem', { name: 'Delete' });
        await waitFor(() => {
          expect(deleteItem).toHaveAttribute('data-highlighted');
        });

        await setProps({ count: 2 });

        expect(screen.getByRole('menuitem', { name: 'Inbox (2)' })).toBeVisible();
        expect(deleteItem).toHaveAttribute('data-highlighted');
        expect(input).toHaveAttribute('aria-activedescendant', deleteItem.id);
      });

      it('keeps the automatic highlight when typing moves it out from under the pointer', async () => {
        const { user } = renderWithUser(() => (
          <ActionsMenu providerProps={{ autoHighlight: true }} rootProps={{ open: true }}>
            <Menu.Item>Rename</Menu.Item>
            <Menu.Item>Delete</Menu.Item>
          </ActionsMenu>
        ));

        const input = screen.getByRole('searchbox', { name: 'Filter actions' });
        await act(() => input.focus());
        await user.type(input, 'e');
        const deleteItem = screen.getByRole('menuitem', { name: 'Delete' });
        await user.hover(deleteItem);
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', deleteItem.id);
        });

        // Only Delete matches, so it moves to the top of the list, away from the resting pointer.
        await user.keyboard('l');
        await waitFor(() => {
          expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
        });
        fireEvent.pointerLeave(deleteItem, { pointerType: 'mouse' });
        await flushMicrotasks();

        expect(input).toHaveAttribute('aria-activedescendant', deleteItem.id);
      });

      it('supports a controlled query', async () => {
        function App() {
          const [query, setQuery] = createSignal('');

          return (
            <ActionsMenu
              providerProps={{
                autoHighlight: true,
                get value() {
                  return query();
                },
                onValueChange: (value) => setQuery(value),
              }}
              rootProps={{ open: true }}
            >
              <Menu.Item>Rename</Menu.Item>
              <Menu.Item>Delete</Menu.Item>
            </ActionsMenu>
          );
        }

        const { user } = renderWithUser(() => <App />);
        const input = screen.getByRole('searchbox', { name: 'Filter actions' });
        await user.type(input, 'del');

        const deleteItem = screen.getByRole('menuitem', { name: 'Delete' });
        await waitFor(() => {
          expect(deleteItem).toHaveAttribute('data-highlighted');
        });
        expect(input).toHaveAttribute('aria-activedescendant', deleteItem.id);
      });

      it('supports persistent always highlighting inside a filterable submenu', async () => {
        const { user } = renderWithUser(() => (
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.FilterProvider autoHighlight="always">
                    <Menu.SubmenuRoot defaultOpen>
                      <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Input aria-label="Filter destinations" />
                            <Menu.List>
                              <Menu.Item>Documents</Menu.Item>
                              <Menu.Item>Downloads</Menu.Item>
                            </Menu.List>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.FilterProvider>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ));

        const input = screen.getByRole('searchbox', { name: 'Filter destinations' });
        const firstItem = screen.getByRole('menuitem', { name: 'Documents' });
        await waitFor(() => {
          expect(firstItem).toHaveAttribute('data-highlighted');
        });
        expect(input).toHaveAttribute('aria-activedescendant', firstItem.id);

        await act(() => input.focus());
        await user.keyboard('[ArrowUp]');

        const lastItem = screen.getByRole('menuitem', { name: 'Downloads' });
        await waitFor(() => {
          expect(lastItem).toHaveAttribute('data-highlighted');
        });
        expect(input).toHaveAttribute('aria-activedescendant', lastItem.id);
      });
    });

    // Requires a running exit animation (jsdom has no animations).
    it.skip('does not highlight the first item while closing from the trigger with a pointer', () => {});

    it('moves focus past the menu when tabbing from the input', async () => {
      const { user } = renderWithUser(() => (
        <div>
          <Menu.FilterProvider>
            <Menu.Root defaultOpen modal={false}>
              <Menu.Trigger>Actions</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List style={{ height: '1px', overflow: 'auto' }}>
                      <Menu.Item style={{ height: '10px' }}>Rename</Menu.Item>
                      <Menu.Item style={{ height: '10px' }}>Duplicate</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
          <input data-testid="after" />
        </div>
      ));

      const input = screen.getByRole<HTMLInputElement>('searchbox', {
        name: 'Filter actions',
      });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await user.tab();

      await waitFor(() => {
        expect(screen.getByTestId('after')).toHaveFocus();
      });
    });

    it('uses the configured locale for default matching', async () => {
      renderWithUser(() => (
        <ActionsMenu providerProps={{ defaultValue: 'ı', locale: 'tr' }} rootProps={{ open: true }}>
          <Menu.Item>Istanbul</Menu.Item>
        </ActionsMenu>
      ));

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Istanbul' })).toBeVisible();
      });
    });

    it('keeps Home and End as caret keys until an item is highlighted', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu providerProps={{ defaultValue: 'rename' }} rootProps={{ open: true }}>
          <Menu.Item>Rename</Menu.Item>
        </ActionsMenu>
      ));

      const input = screen.getByRole<HTMLInputElement>('searchbox', {
        name: 'Filter actions',
      });
      await user.click(input);
      input.setSelectionRange(3, 3);

      await user.keyboard('[Home]');
      expect(input.selectionStart).toBe(0);
      expect(input).not.toHaveAttribute('aria-activedescendant');

      await user.keyboard('[End]');
      expect(input.selectionStart).toBe(input.value.length);
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('keeps Home and End as caret keys while the input is empty', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu rootProps={{ open: true }}>
          <Menu.Item>Rename</Menu.Item>
          <Menu.Item>Delete</Menu.Item>
        </ActionsMenu>
      ));

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await user.click(input);

      await user.keyboard('[End]');
      expect(input).not.toHaveAttribute('aria-activedescendant');

      await user.keyboard('[Home]');
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('keeps the caret keys while a query is highlighted automatically', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu providerProps={{ autoHighlight: true }} rootProps={{ open: true }}>
          <Menu.Item>Rename</Menu.Item>
          <Menu.Item>Remove</Menu.Item>
        </ActionsMenu>
      ));

      const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Filter actions' });
      await user.click(input);
      await user.keyboard('rem');
      const remove = screen.getByRole('menuitem', { name: 'Remove' });
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', remove.id);
      });

      await user.keyboard('[ArrowLeft]');
      expect(input.selectionStart).toBe(2);
      await user.keyboard('[Home]');
      expect(input.selectionStart).toBe(0);
      await user.keyboard('[ArrowRight]');
      expect(input.selectionStart).toBe(1);
      expect(input).toHaveAttribute('aria-activedescendant', remove.id);
    });

    it('keeps the caret keys after navigating to an item while the query is not empty', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu rootProps={{ open: true }}>
          <Menu.Item>Rename</Menu.Item>
          <Menu.Item>Remove</Menu.Item>
        </ActionsMenu>
      ));

      const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Filter actions' });
      await user.click(input);
      await user.keyboard('re[ArrowDown]');
      const rename = screen.getByRole('menuitem', { name: 'Rename' });
      expect(input).toHaveAttribute('aria-activedescendant', rename.id);

      await user.keyboard('[ArrowLeft]');
      expect(input.selectionStart).toBe(1);
      await user.keyboard('[End]');
      expect(input.selectionStart).toBe(2);
      expect(input).toHaveAttribute('aria-activedescendant', rename.id);
    });

    describe('Space', () => {
      function SpaceTest(props: { onRenameClick: () => void }) {
        return (
          <ActionsMenu rootProps={{ defaultOpen: true }}>
            <Menu.Item onClick={() => props.onRenameClick()}>Rename</Menu.Item>
            <Menu.Item>Remove</Menu.Item>
          </ActionsMenu>
        );
      }

      it('activates the highlighted item while the input is empty', async () => {
        const onRenameClick = vi.fn();
        const { user } = renderWithUser(() => <SpaceTest onRenameClick={onRenameClick} />);

        const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Filter actions' });
        await user.click(input);
        await user.keyboard('[ArrowDown]');
        expect(input).toHaveAttribute(
          'aria-activedescendant',
          screen.getByRole('menuitem', { name: 'Rename' }).id,
        );

        await user.keyboard(' ');

        expect(onRenameClick).toHaveBeenCalledTimes(1);
        await waitFor(() => {
          expect(screen.queryByRole('menu')).toBe(null);
        });
      });

      it('does nothing while the input is empty and no item is highlighted', async () => {
        const onRenameClick = vi.fn();
        const { user } = renderWithUser(() => <SpaceTest onRenameClick={onRenameClick} />);

        const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Filter actions' });
        await user.click(input);
        expect(input).not.toHaveAttribute('aria-activedescendant');

        await user.keyboard(' ');

        expect(input.value).toBe('');
        expect(onRenameClick).not.toHaveBeenCalled();
        expect(screen.getByRole('menu')).not.toBe(null);
      });

      it('types into a non-empty input with a highlighted item', async () => {
        const onRenameClick = vi.fn();
        const { user } = renderWithUser(() => <SpaceTest onRenameClick={onRenameClick} />);

        const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Filter actions' });
        await user.click(input);
        await user.keyboard('re[ArrowDown]');
        expect(input).toHaveAttribute(
          'aria-activedescendant',
          screen.getByRole('menuitem', { name: 'Rename' }).id,
        );

        await user.keyboard(' ');

        expect(input.value).toBe('re ');
        expect(onRenameClick).not.toHaveBeenCalled();
      });
    });
    describe('cross-axis arrow keys with a query', () => {
      function SubmenuTest() {
        return (
          <ActionsMenu rootProps={{ defaultOpen: true }}>
            <Menu.FilterProvider>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger>Move to folder</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Input aria-label="Filter folders" />
                      <Menu.List>
                        <Menu.Item>Archive</Menu.Item>
                      </Menu.List>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.FilterProvider>
          </ActionsMenu>
        );
      }

      it('opens the highlighted submenu with ArrowRight only from the end of the text', async () => {
        const { user } = renderWithUser(() => <SubmenuTest />);

        const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Filter actions' });
        await user.click(input);
        await user.keyboard('mo[ArrowDown]');
        const trigger = screen.getByRole('menuitem', { name: 'Move to folder' });
        expect(input).toHaveAttribute('aria-activedescendant', trigger.id);
        input.setSelectionRange(1, 1);

        await user.keyboard('[ArrowRight]');
        expect(input.selectionStart).toBe(2);
        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        await user.keyboard('[ArrowRight]');
        const submenuInput = await screen.findByRole('searchbox', { name: 'Filter folders' });
        await waitFor(() => {
          expect(submenuInput).toHaveFocus();
        });
      });

      it('closes the submenu with ArrowLeft only from the start of the text', async () => {
        const { user } = renderWithUser(() => <SubmenuTest />);

        const parentInput = screen.getByRole('searchbox', { name: 'Filter actions' });
        await user.click(parentInput);
        await user.keyboard('[ArrowDown][ArrowRight]');
        const submenuInput = await screen.findByRole<HTMLInputElement>('searchbox', {
          name: 'Filter folders',
        });
        await waitFor(() => {
          expect(submenuInput).toHaveFocus();
        });
        await user.keyboard('ar');

        await user.keyboard('[ArrowLeft][ArrowLeft]');
        expect(submenuInput.selectionStart).toBe(0);
        expect(submenuInput).toHaveFocus();

        await user.keyboard('[ArrowLeft]');
        await waitFor(() => {
          expect(screen.queryByRole('searchbox', { name: 'Filter folders' })).toBe(null);
        });
        expect(parentInput).toHaveFocus();
      });
    });

    it('uses Home and End for list navigation after an item is highlighted', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu rootProps={{ open: true }}>
          <Menu.Item>Rename</Menu.Item>
          <Menu.Item>Duplicate</Menu.Item>
          <Menu.Item>Delete</Menu.Item>
        </ActionsMenu>
      ));

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      const items = screen.getAllByRole('menuitem');
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      await user.keyboard('[ArrowDown][ArrowDown]');

      await user.keyboard('[Home]');
      expect(input).toHaveAttribute('aria-activedescendant', items[0]?.id);

      await user.keyboard('[End]');
      expect(input).toHaveAttribute('aria-activedescendant', items[2]?.id);
    });

    it('hides a group, label included, when the query filters out all of its items', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu rootProps={{ open: true }}>
          <Menu.Group data-testid="file-group">
            <Menu.GroupLabel>File</Menu.GroupLabel>
            <Menu.Item>Save</Menu.Item>
          </Menu.Group>
          <Menu.Group data-testid="manage-group">
            <Menu.GroupLabel>Manage</Menu.GroupLabel>
            <Menu.Item>Rename</Menu.Item>
          </Menu.Group>
        </ActionsMenu>
      ));

      const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
      await user.type(input, 'ren');
      await user.keyboard('[ArrowDown]');

      await waitFor(() => {
        expect(screen.getByTestId('file-group')).not.toBeVisible();
      });
      expect(screen.getByTestId('manage-group')).toBeVisible();
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();

      await user.clear(input);

      await waitFor(() => {
        expect(screen.getByTestId('file-group')).toBeVisible();
      });
    });

    function ShareMenu(props: { rootProps?: Omit<Menu.Root.Props, 'children'>; hover?: boolean }) {
      return (
        <div>
          <input />
          <Menu.FilterProvider>
            <Menu.Root modal={false} {...props.rootProps}>
              <Menu.Trigger>Actions</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.FilterProvider>
                        <Menu.SubmenuRoot>
                          <Menu.SubmenuTrigger openOnHover={props.hover}>Share</Menu.SubmenuTrigger>
                          <Menu.Portal>
                            <Menu.Positioner>
                              <Menu.Popup>
                                <Menu.Input aria-label="Filter sharing options" />
                                <Menu.List>
                                  <Menu.Item>Email</Menu.Item>
                                </Menu.List>
                              </Menu.Popup>
                            </Menu.Positioner>
                          </Menu.Portal>
                        </Menu.SubmenuRoot>
                      </Menu.FilterProvider>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
          <input data-testid="after" />
        </div>
      );
    }

    it('closes a filterable submenu and moves focus to the next element when tabbing forward', async () => {
      const { user } = renderWithUser(() => <ShareMenu rootProps={{ defaultOpen: true }} />);

      const parentInput = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(parentInput).toHaveFocus();
      });

      await user.keyboard('[ArrowDown][ArrowRight]');

      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter sharing options' });
      await waitFor(() => {
        expect(submenuInput).toHaveFocus();
      });

      await user.tab();

      await waitFor(() => {
        expect(screen.getByTestId('after')).toHaveFocus();
      });
      await waitFor(() => {
        expect(screen.queryByRole('searchbox', { name: 'Filter actions' })).toBe(null);
      });
    });

    // Upstream enables exit transitions here; jsdom runs none, so the popups unmount at once.
    it('closes a pointer-opened filterable submenu and moves focus forward when tabbing', async () => {
      const { user } = renderWithUser(() => <ShareMenu hover={false} />);

      await user.click(screen.getByRole('button', { name: 'Actions' }));

      const submenuTrigger = await screen.findByRole('menuitem', { name: 'Share' });
      await user.click(submenuTrigger);

      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter sharing options' });
      await waitFor(() => {
        expect(submenuInput).toHaveFocus();
      });

      await user.tab();

      await waitFor(() => {
        expect(screen.getByTestId('after')).toHaveFocus();
      });
      await waitFor(() => {
        expect(screen.queryByRole('searchbox', { name: 'Filter actions' })).toBe(null);
      });
    });

    it('focuses a click-opened filterable submenu input so typing filters the submenu', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu>
          <Menu.FilterProvider>
            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger openOnHover={false}>Share</Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter sharing options" />
                    <Menu.List>
                      <Menu.Item>Email</Menu.Item>
                      <Menu.Item>Link</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>
          </Menu.FilterProvider>
          <Menu.Item>Delete</Menu.Item>
        </ActionsMenu>
      ));

      await user.click(screen.getByRole('button', { name: 'Actions' }));

      const submenuTrigger = await screen.findByRole('menuitem', { name: 'Share' });
      await user.click(submenuTrigger);

      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter sharing options' });
      await waitFor(() => {
        expect(submenuInput).toHaveFocus();
      });

      await user.keyboard('em');

      expect(submenuInput).toHaveValue('em');
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'Link' })).toBe(null);
      });
      expect(screen.getByRole('menuitem', { name: 'Email' })).toBeVisible();
      // The parent list did not filter: its own items are all still present.
      expect(screen.getByRole('menuitem', { name: 'Share' })).toBeVisible();
      expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
    });

    // Only the submenu filters here; the outer menu is an ordinary one.
    function FilterableSubmenu(props: { portalled?: boolean }) {
      const SubmenuPortal = (portalProps: { children?: JSX.Element }) =>
        props.portalled === false ? (
          portalProps.children
        ) : (
          <Menu.Portal>{portalProps.children}</Menu.Portal>
        );

      return (
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Rename</Menu.Item>
                <Menu.FilterProvider>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger delay={0}>Move to folder</Menu.SubmenuTrigger>
                    <SubmenuPortal>
                      <Menu.Positioner>
                        <Menu.Popup>
                          <Menu.Input aria-label="Filter folders" />
                          <Menu.List>
                            <Menu.Item>Documents</Menu.Item>
                            <Menu.Item>Downloads</Menu.Item>
                          </Menu.List>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </SubmenuPortal>
                  </Menu.SubmenuRoot>
                </Menu.FilterProvider>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      );
    }

    function ParentNavigationMenu(props: { loopFocus: boolean; triggerLast?: boolean }) {
      const submenu = () => (
        <Menu.FilterProvider>
          <Menu.SubmenuRoot>
            <Menu.SubmenuTrigger>Move to folder</Menu.SubmenuTrigger>
          </Menu.SubmenuRoot>
        </Menu.FilterProvider>
      );

      return (
        <Menu.Root defaultOpen loopFocus={props.loopFocus}>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                {!props.triggerLast && submenu()}
                <Menu.Item disabled>Disabled</Menu.Item>
                <Menu.Item>Next</Menu.Item>
                {props.triggerLast && submenu()}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      );
    }

    it('uses dialog semantics for a filterable submenu', async () => {
      const { user } = renderWithUser(() => <FilterableSubmenu />);
      const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to folder' });

      expect(submenuTrigger).toHaveAttribute('aria-haspopup', 'dialog');

      await user.hover(submenuTrigger);

      const popup = await screen.findByRole('dialog');
      expect(submenuTrigger).toHaveAttribute('aria-controls', popup.id);
      expect(popup).toHaveAttribute('aria-labelledby', submenuTrigger.id);
    });

    it('lets the ordinary parent menu own its main-axis navigation keys', async () => {
      const { user } = renderWithUser(() => <FilterableSubmenu />);
      const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to folder' });
      await flushMicrotasks();

      await act(() => submenuTrigger.focus());
      await user.keyboard('[ArrowUp]');

      expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
      expect(screen.queryByRole('dialog')).toBe(null);
    });

    it('keeps disabled parent items reachable during main-axis navigation', async () => {
      const { user } = renderWithUser(() => <ParentNavigationMenu loopFocus />);
      const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to folder' });
      await flushMicrotasks();

      await act(() => submenuTrigger.focus());
      await user.keyboard('[ArrowDown]');

      // The parent menu passes `disabledIndices: EMPTY_ARRAY` to `useListNavigation`, so its own
      // items land on `aria-disabled` neighbours. Arrowing off this trigger must match.
      expect(screen.getByRole('menuitem', { name: 'Disabled' })).toHaveFocus();
    });

    it('wraps parent navigation when loopFocus is enabled', async () => {
      const { user } = renderWithUser(() => <ParentNavigationMenu loopFocus triggerLast />);
      const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to folder' });
      await flushMicrotasks();

      await act(() => submenuTrigger.focus());
      await user.keyboard('[ArrowDown]');

      // The trigger is last, so this wraps to the first item, which is the disabled one.
      expect(screen.getByRole('menuitem', { name: 'Disabled' })).toHaveFocus();
    });

    it('stops parent navigation at the boundary when loopFocus is disabled', async () => {
      const { user } = renderWithUser(() => (
        <ParentNavigationMenu loopFocus={false} triggerLast />
      ));
      const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to folder' });
      await flushMicrotasks();

      await act(() => submenuTrigger.focus());
      await user.keyboard('[ArrowDown]');

      expect(submenuTrigger).toHaveFocus();
    });

    it('resets the input value once when the popup closes', async () => {
      const onValueChange = vi.fn();

      function Test() {
        const [open, setOpen] = createSignal(true);

        return (
          <>
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
            <Menu.FilterProvider onValueChange={onValueChange}>
              <Menu.Root open={open()} modal={false}>
                <Menu.Trigger>Fruit</Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Input aria-label="Filter fruit" />
                      <Menu.List>
                        <Menu.Item>Apple</Menu.Item>
                      </Menu.List>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </Menu.FilterProvider>
          </>
        );
      }

      const { user } = renderWithUser(() => <Test />);
      const input = await screen.findByRole('searchbox', { name: 'Filter fruit' });

      await user.type(input, 'app');
      onValueChange.mockClear();

      await user.click(screen.getByRole('button', { name: 'Close' }));

      await waitFor(() => {
        expect(onValueChange).toHaveBeenCalledTimes(1);
      });
      expect(onValueChange.mock.calls[0][0]).toBe('');
      expect(onValueChange.mock.calls[0][1].reason).toBe('popup-close');
    });
    // Requires a running exit animation (jsdom has no animations).
    it.skip('keeps submenu filtering updated during the exit transition', () => {});

    it('leaves the uncontrolled query and visible items unchanged when a change is canceled', async () => {
      const { user } = renderWithUser(() => (
        <Menu.FilterProvider
          defaultValue="app"
          onValueChange={(_, eventDetails) => eventDetails.cancel()}
        >
          <Menu.Root open>
            <Menu.Trigger>Fruit</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter fruit" />
                  <Menu.Clear aria-label="Clear filter" />
                  <Menu.List>
                    <Menu.Item>Apple</Menu.Item>
                    <Menu.Item>Banana</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      const input = await screen.findByRole('searchbox', { name: 'Filter fruit' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(input).toHaveAttribute(
          'aria-activedescendant',
          screen.getByRole('menuitem', { name: 'Apple' }).id,
        );
      });

      expect(input).toHaveValue('app');
      expect(screen.getByRole('menuitem', { name: 'Apple' })).toBeVisible();
      expect(screen.queryByRole('menuitem', { name: 'Banana' })).toBe(null);

      // Typing is rejected.
      await user.type(input, 'x', { skipClick: true });

      expect(input).toHaveValue('app');
      expect(screen.getByRole('menuitem', { name: 'Apple' })).toBeVisible();
      expect(screen.queryByRole('menuitem', { name: 'Banana' })).toBe(null);
      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Apple' }).id,
      );

      // Clearing is rejected.
      await user.click(screen.getByLabelText('Clear filter'));

      expect(input).toHaveValue('app');
      expect(screen.getByRole('menuitem', { name: 'Apple' })).toBeVisible();
      expect(screen.queryByRole('menuitem', { name: 'Banana' })).toBe(null);
      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Apple' }).id,
      );
    });

    it('clears a positional highlight when a controlled query replaces the visible item', async () => {
      const onAppleClick = vi.fn();

      function Test(props: { value: string }) {
        return (
          <Menu.FilterProvider value={props.value} onValueChange={() => {}}>
            <Menu.Root open>
              <Menu.Trigger>Fruit</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter fruit" />
                    <Menu.List>
                      <Menu.Item onClick={onAppleClick}>Apple</Menu.Item>
                      <Menu.Item>Banana</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        );
      }

      const { user, setProps } = renderWithProps(Test, { value: 'ban' });
      const input = screen.getByRole('searchbox', { name: 'Filter fruit' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(input).toHaveAttribute(
          'aria-activedescendant',
          screen.getByRole('menuitem', { name: 'Banana' }).id,
        );
      });

      await setProps({ value: 'app' });

      expect(screen.getByRole('menuitem', { name: 'Apple' })).toBeVisible();
      expect(screen.queryByRole('menuitem', { name: 'Banana' })).toBe(null);
      expect(input).not.toHaveAttribute('aria-activedescendant');
      await user.keyboard('[Enter]');
      expect(onAppleClick).not.toHaveBeenCalled();
    });

    it('supports a detached trigger in a filterable menu', async () => {
      function Test() {
        const handle = Menu.createHandle();

        return (
          <>
            <Menu.FilterProvider>
              <Menu.Root handle={handle}>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Input aria-label="Filter fruit" />
                      <Menu.List data-testid="list">
                        <Menu.Item>Apple</Menu.Item>
                      </Menu.List>
                      <Menu.Empty>No fruit found</Menu.Empty>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </Menu.FilterProvider>
            <Menu.Trigger id="fruit-trigger" handle={handle}>
              Fruit
            </Menu.Trigger>
          </>
        );
      }

      const { user } = renderWithUser(() => <Test />);
      const trigger = screen.getByRole('button', { name: 'Fruit' });

      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');

      await user.click(trigger);

      const popup = await screen.findByRole('dialog', { name: 'Fruit' });
      const list = screen.getByTestId('list');
      const input = screen.getByRole('searchbox', { name: 'Filter fruit' });

      expect(trigger).toHaveAttribute('aria-controls', popup.id);
      expect(popup).toHaveAttribute('aria-labelledby', trigger.id);
      expect(list).toHaveAttribute('aria-labelledby', trigger.id);
      expect(screen.queryByRole('status')).toBe(null);

      await user.type(input, 'zz');

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('No fruit found');
      });
    });

    it('uses the id from a custom trigger render element for popup labelling', async () => {
      const { user } = renderWithUser(() => (
        <Menu.FilterProvider>
          <Menu.Root>
            <Menu.Trigger render={(p) => <button {...p} id="custom-trigger" />}>Fruit</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter fruit" />
                  <Menu.List>
                    <Menu.Item>Apple</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      await user.click(screen.getByRole('button', { name: 'Fruit' }));

      expect(await screen.findByRole('dialog')).toHaveAttribute(
        'aria-labelledby',
        'custom-trigger',
      );
      expect(screen.getByRole('menu')).toHaveAttribute('aria-labelledby', 'custom-trigger');
    });

    it('uses an explicit popup label instead of the trigger label', async () => {
      const { user } = renderWithUser(() => (
        <Menu.FilterProvider>
          <Menu.Root>
            <Menu.Trigger>Fruit</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup aria-label="Available commands">
                  <Menu.Input aria-label="Filter fruit" />
                  <Menu.List>
                    <Menu.Item>Apple</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      await user.click(screen.getByRole('button', { name: 'Fruit' }));

      const popup = await screen.findByRole('dialog', { name: 'Available commands' });
      expect(popup).not.toHaveAttribute('aria-labelledby');
    });

    // React-only: upstream reads `aria-label` off the `render` element's props; a Solid render
    // callback is opaque (see internals/resolveRenderedAriaLabel.ts).
    it.skip('uses an explicit label from the popup render element', () => {});

    it('releases a popup id override when the prop is removed', async () => {
      function Test() {
        const [customId, setCustomId] = createSignal(true);
        return (
          <Menu.FilterProvider>
            <Menu.Root defaultOpen>
              <Menu.Trigger>Fruit</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup id={customId() ? 'custom-popup' : undefined}>
                    <Menu.Input aria-label="Filter fruit" />
                    <Menu.List>
                      <Menu.Item>Apple</Menu.Item>
                    </Menu.List>
                    <button type="button" onClick={() => setCustomId(false)}>
                      Remove id
                    </button>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        );
      }

      const { user } = renderWithUser(() => <Test />);
      const trigger = screen.getByRole('button', { name: 'Fruit' });
      const popup = screen.getByRole('dialog');
      expect(popup).toHaveAttribute('id', 'custom-popup');

      await user.click(screen.getByRole('button', { name: 'Remove id' }));

      await waitFor(() => {
        expect(popup).not.toHaveAttribute('id', 'custom-popup');
      });
      expect(trigger.getAttribute('aria-controls')).toBe(popup.id);
      expect(screen.getByRole('menuitem', { name: 'Apple' }).id).not.toBe('');
    });

    // Upstream runs it in real browsers only (hover-driven input highlight depends on layout).
    it.skip('focuses the input when a filterable submenu opens with the keyboard', () => {});

    it('opens a virtually focused submenu with the keyboard', async () => {
      const { user } = renderWithUser(() => (
        <FolderMenu after={<Menu.Item>Delete</Menu.Item>} />
      ));

      const parentInput = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(parentInput).toHaveFocus();
      });

      await user.keyboard('[ArrowDown]');

      const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to folder' });
      expect(parentInput).toHaveAttribute('aria-activedescendant', submenuTrigger.id);

      await user.keyboard('[ArrowRight]');

      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter folders' });
      await waitFor(() => {
        expect(submenuInput).toHaveFocus();
      });
      expect(submenuInput).not.toHaveAttribute('data-highlighted');
      expect(submenuInput).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Documents' }).id,
      );
      expect(parentInput).not.toHaveAttribute('aria-activedescendant');

      await user.keyboard('[ArrowLeft]');

      await waitFor(() => {
        expect(parentInput).toHaveFocus();
      });
      expect(parentInput).toHaveAttribute('aria-activedescendant', submenuTrigger.id);

      await user.keyboard('[ArrowDown]');

      const nextItem = screen.getByRole('menuitem', { name: 'Delete' });
      expect(parentInput).toHaveAttribute('aria-activedescendant', nextItem.id);
    });

    it.each([false, true])(
      'keeps cross-axis keys as caret keys while the submenu query is not empty (autoHighlight: %s)',
      async (autoHighlight) => {
        const { user } = renderWithUser(() => (
          <FolderMenu submenuProviderProps={{ autoHighlight }} />
        ));

        const parentInput = screen.getByRole('searchbox', { name: 'Filter actions' });
        await waitFor(() => {
          expect(parentInput).toHaveFocus();
        });

        await user.keyboard('[ArrowDown][ArrowRight]');

        const submenuInput = await screen.findByRole<HTMLInputElement>('searchbox', {
          name: 'Filter folders',
        });
        await waitFor(() => {
          expect(submenuInput).toHaveFocus();
        });

        await user.keyboard('doc');
        expect(submenuInput).toHaveValue('doc');

        // Editing the query must not leave the submenu; the caret moves instead.
        await user.keyboard('[ArrowLeft]');

        expect(submenuInput).toHaveFocus();
        expect(submenuInput.selectionStart).toBe(2);
        expect(submenuInput).toHaveValue('doc');
      },
    );

    it('uses RTL cross-axis keys to enter and leave a filterable submenu', async () => {
      const { user } = renderWithUser(() => (
        <DirectionProvider direction="rtl">
          <FolderMenu />
        </DirectionProvider>
      ));

      const parentInput = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(parentInput).toHaveFocus();
      });

      await user.keyboard('[ArrowDown][ArrowLeft]');

      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter folders' });
      fireEvent.mouseMove(submenuInput);
      await waitFor(() => {
        expect(submenuInput).toHaveFocus();
      });

      await user.keyboard('[ArrowRight]');

      await waitFor(() => {
        expect(screen.queryByRole('searchbox', { name: 'Filter folders' })).toBe(null);
      });
      expect(parentInput).toHaveFocus();
      expect(parentInput).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Move to folder' }).id,
      );
    });

    it('returns virtual focus to the parent input on Escape and resumes filtering', async () => {
      const { user } = renderWithUser(() => (
        <FolderMenu after={<Menu.Item>Rename</Menu.Item>} />
      ));

      const parentInput = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(parentInput).toHaveFocus();
      });

      await user.keyboard('[ArrowDown][ArrowRight]');

      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter folders' });
      fireEvent.mouseMove(submenuInput);
      await waitFor(() => {
        expect(submenuInput).toHaveFocus();
      });

      await user.keyboard('[Escape]');

      const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to folder' });
      await waitFor(() => {
        expect(parentInput).toHaveFocus();
      });
      expect(parentInput).toHaveAttribute('aria-activedescendant', submenuTrigger.id);

      await user.type(parentInput, 'ren');

      expect(parentInput).toHaveValue('ren');
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
      expect(screen.queryByRole('menuitem', { name: 'Move to folder' })).toBe(null);
    });

    it('does not reclaim focus when a controlled submenu closes after focus moves outside', async () => {
      let closeSubmenu = () => {};

      function Test() {
        const [submenuOpen, setSubmenuOpen] = createSignal(false);
        closeSubmenu = () => setSubmenuOpen(false);

        return (
          <>
            <FolderMenu
              rootProps={{ defaultOpen: true, modal: false }}
              submenuRootProps={{
                get open() {
                  return submenuOpen();
                },
                onOpenChange: (next) => setSubmenuOpen(next),
              }}
            />
            <button type="button">Outside</button>
          </>
        );
      }

      const { user } = renderWithUser(() => <Test />);
      await waitFor(() => {
        expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveFocus();
      });
      await user.keyboard('[ArrowDown][ArrowRight]');
      await waitFor(() => {
        expect(screen.getByRole('searchbox', { name: 'Filter folders' })).toHaveFocus();
      });

      const outside = screen.getByRole('button', { name: 'Outside' });
      await act(() => {
        outside.focus();
        closeSubmenu();
      });

      await waitFor(() => {
        expect(outside).toHaveFocus();
      });
    });

    it('opens a submenu from a filterable submenu input', async () => {
      const { user } = renderWithUser(() => (
        <FolderMenu
          submenuItems={
            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger>More folders</Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item>Archive</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>
          }
        />
      ));

      const parentInput = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(parentInput).toHaveFocus();
      });

      await user.keyboard('[ArrowDown][ArrowRight]');

      const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to folder' });
      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter folders' });
      fireEvent.mouseMove(submenuInput);
      await waitFor(() => {
        expect(submenuInput).toHaveFocus();
      });

      const nestedTrigger = screen.getByRole('menuitem', { name: 'More folders' });
      // The keyboard-open highlight can land a frame after focus (items are indexed late).
      await waitFor(() => {
        expect(submenuInput).toHaveAttribute('aria-activedescendant', nestedTrigger.id);
      });

      await user.keyboard('[ArrowRight]');

      const nestedItem = await screen.findByRole('menuitem', { name: 'Archive' });
      await waitFor(() => {
        expect(nestedItem).toHaveFocus();
      });

      await user.keyboard('[ArrowLeft]');

      await waitFor(() => {
        expect(submenuInput).toHaveFocus();
      });
      await waitFor(() => {
        expect(submenuInput).toHaveAttribute('aria-activedescendant', nestedTrigger.id);
      });

      await user.keyboard('[ArrowLeft]');

      await waitFor(() => {
        expect(parentInput).toHaveFocus();
      });
      await waitFor(() => {
        expect(parentInput).toHaveAttribute('aria-activedescendant', submenuTrigger.id);
      });
    });

    it('opens a virtually focused submenu with Enter from the input', async () => {
      const { user } = renderWithUser(() => (
        <FolderMenu
          triggerLabel="Share"
          inputLabel="Filter sharing options"
          submenuItems={<Menu.Item>Email</Menu.Item>}
          after={<Menu.Item>Delete</Menu.Item>}
        />
      ));

      const parentInput = screen.getByRole('searchbox', { name: 'Filter actions' });
      const submenuTrigger = screen.getByRole('menuitem', { name: 'Share' });
      await waitFor(() => {
        expect(parentInput).toHaveFocus();
      });
      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(parentInput).toHaveAttribute('aria-activedescendant', submenuTrigger.id);
      });

      await user.keyboard('[Enter]');

      const submenuInput = screen.getByRole('searchbox', { name: 'Filter sharing options' });
      await waitFor(() => {
        expect(submenuInput).toHaveFocus();
      });
      expect(parentInput).not.toHaveAttribute('aria-activedescendant');

      await user.keyboard('[ArrowLeft]');

      await waitFor(() => {
        expect(parentInput).toHaveFocus();
      });
      expect(parentInput).toHaveAttribute('aria-activedescendant', submenuTrigger.id);

      await user.keyboard('[ArrowDown]');

      const nextItem = screen.getByRole('menuitem', { name: 'Delete' });
      expect(parentInput).toHaveAttribute('aria-activedescendant', nextItem.id);
    });

    it('does not reopen a stale submenu with a cross-axis key', async () => {
      const { user } = renderWithUser(() => (
        <FolderMenu
          before={<Menu.Item>Rename</Menu.Item>}
          triggerLabel="Share"
          inputLabel="Filter sharing options"
          submenuItems={<Menu.Item>Email</Menu.Item>}
          after={
            <Menu.FilterProvider>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger>Export</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Input aria-label="Filter export options" />
                      <Menu.List>
                        <Menu.Item>PDF</Menu.Item>
                      </Menu.List>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.FilterProvider>
          }
        />
      ));

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await user.keyboard('[ArrowDown][ArrowDown][ArrowRight]');
      await waitFor(() => {
        expect(screen.getByRole('searchbox', { name: 'Filter sharing options' })).toHaveFocus();
      });

      await user.keyboard('[Escape]');
      const shareTrigger = screen.getByRole('menuitem', { name: 'Share' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      expect(input).toHaveAttribute('aria-activedescendant', shareTrigger.id);

      await user.keyboard('[ArrowUp]');
      const item = screen.getByRole('menuitem', { name: 'Rename' });
      expect(input).toHaveFocus();
      expect(input).toHaveAttribute('aria-activedescendant', item.id);

      await user.keyboard('[ArrowRight]');
      expect(screen.queryByRole('searchbox', { name: 'Filter sharing options' })).toBe(null);

      await user.keyboard('[ArrowDown][ArrowDown][ArrowRight]');
      expect(screen.queryByRole('searchbox', { name: 'Filter sharing options' })).toBe(null);
      await waitFor(() => {
        expect(screen.getByRole('searchbox', { name: 'Filter export options' })).toHaveFocus();
      });
    });

    // Upstream runs it in real browsers only (pointer-driven focus handoff).
    it.skip('moves focus into the submenu input once the pointer enters it', () => {});

    it('closes a hover-opened submenu from a virtually focused parent', async () => {
      const { user } = renderWithUser(() => <FolderMenu triggerProps={{ delay: 0 }} />);

      const parentInput = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(parentInput).toHaveFocus();
      });
      await user.keyboard('[ArrowDown]');
      const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to folder' });
      await user.hover(submenuTrigger);

      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter folders' });
      fireEvent.mouseMove(submenuInput);
      await waitFor(() => {
        expect(submenuInput).toHaveFocus();
      });
      expect(parentInput).toHaveAttribute('aria-activedescendant', submenuTrigger.id);

      await user.keyboard('[ArrowLeft]');

      await waitFor(() => {
        expect(screen.queryByRole('searchbox', { name: 'Filter folders' })).toBe(null);
      });
      await waitFor(() => {
        expect(parentInput).toHaveFocus();
      });
      expect(parentInput).toHaveAttribute('aria-activedescendant', submenuTrigger.id);
    });

    it('focuses the first item when entering a hover-opened submenu from a filterable menu', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu rootProps={{ defaultOpen: true }}>
          <Menu.SubmenuRoot>
            <Menu.SubmenuTrigger delay={0}>Move to folder</Menu.SubmenuTrigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Documents</Menu.Item>
                  <Menu.Item>Downloads</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.SubmenuRoot>
        </ActionsMenu>
      ));

      const parentInput = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(parentInput).toHaveFocus();
      });
      await user.keyboard('[ArrowDown]');
      const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to folder' });
      await user.hover(submenuTrigger);

      const firstItem = await screen.findByRole('menuitem', { name: 'Documents' });
      // Focus moves are scheduled in a frame, so let one pass before asserting it never happens.
      await act(() => waitSingleFrame());
      expect(parentInput).toHaveFocus();

      await user.keyboard('[ArrowRight]');

      await waitFor(() => {
        expect(firstItem).toHaveFocus();
      });
    });
    it('filters items and selects the active item while focus remains on the input', async () => {
      const onClick = vi.fn();
      const { user } = renderWithUser(() => (
        <Menu.FilterProvider>
          <Menu.Root>
            <Menu.Trigger>Fruit</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter fruit" />
                  <Menu.List data-testid="list">
                    <Menu.Item>Apple</Menu.Item>
                    <Menu.Item onClick={onClick} closeOnClick={false}>
                      Banana
                    </Menu.Item>
                  </Menu.List>
                  <Menu.Empty>No fruit found</Menu.Empty>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      const trigger = screen.getByRole('button', { name: 'Fruit' });
      await user.click(trigger);

      const popup = await screen.findByRole('dialog');
      const list = screen.getByTestId('list');
      const input = screen.getByRole('searchbox', { name: 'Filter fruit' });

      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      expect(popup).toContainElement(list);

      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      const firstItem = screen.getByText('Apple');
      expect(firstItem).not.toHaveAttribute('data-highlighted');
      expect(input).not.toHaveAttribute('aria-activedescendant');

      await waitFor(() => {
        expect(screen.getByText('Apple')).toHaveAttribute('tabindex', '-1');
      });
      await waitFor(() => {
        expect(screen.getByText('Banana')).toHaveAttribute('tabindex', '-1');
      });

      await user.type(input, 'ban');

      expect(screen.queryByRole('menuitem', { name: 'Apple' })).toBe(null);
      expect(screen.getByText('Banana')).toBeVisible();

      Object.defineProperty(list, 'scrollTo', {
        configurable: true,
        value: vi.fn(),
      });

      await user.keyboard('{ArrowDown}');

      expect(input).toHaveFocus();
      const activeItem = screen.getByRole('menuitem', { name: 'Banana' });
      expect(activeItem).toHaveAttribute('data-highlighted', '');
      expect(activeItem).toHaveAttribute('tabindex', '-1');
      expect(input).toHaveAttribute('aria-activedescendant', activeItem.id);
      expect(popup).not.toHaveAttribute('aria-activedescendant');

      await user.keyboard('{Enter}');

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not activate the highlighted item when Enter commits an IME composition', async () => {
      const onClick = vi.fn();
      const { user } = renderWithUser(() => (
        <ActionsMenu rootProps={{ defaultOpen: true }}>
          <Menu.Item onClick={onClick}>Rename</Menu.Item>
        </ActionsMenu>
      ));

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      await user.keyboard('[ArrowDown]');
      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Rename' }).id,
      );

      fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, which: 229 });
      await flushMicrotasks();

      expect(onClick).not.toHaveBeenCalled();
    });

    it('does not forward submenu navigation keys while composing text', async () => {
      const { user } = renderWithUser(() => (
        <FolderMenu triggerProps={{ openOnHover: false }} />
      ));

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      await user.keyboard('[ArrowDown]');

      fireEvent.keyDown(input, {
        key: 'ArrowRight',
        keyCode: 229,
        which: 229,
      });
      await flushMicrotasks();

      expect(screen.queryByRole('searchbox', { name: 'Filter folders' })).toBe(null);
    });

    it('disables filter controls when the root is disabled', async () => {
      renderWithUser(() => (
        <Menu.FilterProvider defaultValue="a">
          <Menu.Root open disabled>
            <Menu.Trigger>Fruit</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter fruit" />
                  <Menu.Clear aria-label="Clear filter" />
                  <Menu.List>
                    <Menu.Item>Apple</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      expect(screen.getByRole('searchbox', { name: 'Filter fruit' })).toBeDisabled();
      expect(screen.getByLabelText('Clear filter')).toBeDisabled();
    });

    it('uses an updated custom filter function', async () => {
      const startsWith = (item: string, query: string) => item.toLowerCase().startsWith(query);
      const endsWith = (item: string, query: string) => item.toLowerCase().endsWith(query);

      function Test() {
        // Functions passed to `createSignal` derive the value, so box the filter.
        const [filter, setFilter] = createSignal({ fn: startsWith });

        return (
          <>
            <button type="button" onClick={() => setFilter({ fn: endsWith })}>
              Change filter
            </button>
            <Menu.FilterProvider filter={filter().fn} defaultValue="a">
              <Menu.Root open modal={false}>
                <Menu.Trigger>Fruit</Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Input aria-label="Filter fruit" />
                      <Menu.List>
                        <Menu.Item>Apple</Menu.Item>
                        <Menu.Item>Banana</Menu.Item>
                      </Menu.List>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </Menu.FilterProvider>
          </>
        );
      }

      const { user } = renderWithUser(() => <Test />);
      const input = screen.getByRole('searchbox', { name: 'Filter fruit' });
      await user.click(input);
      await user.keyboard('[ArrowDown]');

      expect(screen.getByRole('menuitem', { name: 'Apple' })).toBeVisible();
      expect(screen.queryByRole('menuitem', { name: 'Banana' })).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Change filter' }));
      await user.click(input);
      await user.keyboard('[ArrowDown]');

      expect(screen.queryByRole('menuitem', { name: 'Apple' })).toBe(null);
      expect(screen.getByRole('menuitem', { name: 'Banana' })).toBeVisible();
    });

    function PlainPopupSubmenuMenu(props: { filterable?: boolean; triggerLabel?: string }) {
      const submenu = () => (
        <Menu.SubmenuRoot>
          <Menu.SubmenuTrigger label={props.triggerLabel}>Move to folder</Menu.SubmenuTrigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Documents</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.SubmenuRoot>
      );
      return (
        <ActionsMenu rootProps={{ defaultOpen: true }}>
          <Menu.Item>Rename</Menu.Item>
          {props.filterable === false ? (
            submenu()
          ) : (
            <Menu.FilterProvider>{submenu()}</Menu.FilterProvider>
          )}
        </ActionsMenu>
      );
    }

    it('filters a non-filterable submenu trigger from a filterable parent', async () => {
      const { user } = renderWithUser(() => <PlainPopupSubmenuMenu />);

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await user.type(input, 'rename');
      await user.keyboard('[ArrowDown]');

      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
      expect(screen.queryByRole('menuitem', { name: 'Move to folder' })).toBe(null);
    });

    it('keeps a submenu trigger visible when the query matches its label', async () => {
      const { user } = renderWithUser(() => <PlainPopupSubmenuMenu />);

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await user.type(input, 'move');

      expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
      expect(screen.getByRole('menuitem', { name: 'Move to folder' })).toBeVisible();
    });

    it('matches a submenu trigger on its label', async () => {
      const { user } = renderWithUser(() => (
        <PlainPopupSubmenuMenu triggerLabel="Move to directory" />
      ));

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await user.type(input, 'directory');

      expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
      expect(screen.getByRole('menuitem', { name: 'Move to folder' })).toBeVisible();
    });

    it('filters a Menu.SubmenuTrigger used inside a plain submenu root', async () => {
      const { user } = renderWithUser(() => <PlainPopupSubmenuMenu filterable={false} />);

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await user.type(input, 'rename');

      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
      expect(screen.queryByRole('menuitem', { name: 'Move to folder' })).toBe(null);

      await user.clear(input);
      await user.type(input, 'move');

      expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
      expect(screen.getByRole('menuitem', { name: 'Move to folder' })).toBeVisible();
    });

    it('keeps plain menu items and submenu triggers out of the tab order in a filterable list', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu rootProps={{ defaultOpen: true }}>
          <Menu.Item>Plain item</Menu.Item>
          <Menu.SubmenuRoot>
            <Menu.SubmenuTrigger delay={0}>More folders</Menu.SubmenuTrigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Archive</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.SubmenuRoot>
        </ActionsMenu>
      ));

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await act(() => input.focus());
      await user.keyboard('[ArrowDown][ArrowDown]');

      // Virtual navigation keeps DOM focus on the input even for highlighted plain items.
      const plainItem = screen.getByRole('menuitem', { name: 'Plain item' });
      expect(plainItem).toHaveAttribute('tabindex', '-1');
      // `aria-expanded` is only valid on an item that owns a popup.
      expect(plainItem).not.toHaveAttribute('aria-expanded');
      const submenuTrigger = screen.getByRole('menuitem', { name: 'More folders' });
      expect(submenuTrigger).toHaveAttribute('tabindex', '-1');
      expect(submenuTrigger).toHaveAttribute('aria-expanded', 'false');
      expect(input).toHaveFocus();
    });

    it('retains the parent highlight when a submenu opens from a pointer', async () => {
      const { user } = renderWithUser(() => <FolderMenu triggerProps={{ delay: 0 }} />);

      const parentInput = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(parentInput).toHaveFocus();
      });

      const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to folder' });
      await user.hover(submenuTrigger);

      await screen.findByRole('searchbox', { name: 'Filter folders' });
      expect(parentInput).toHaveAttribute('aria-activedescendant', submenuTrigger.id);
    });

    it('closes the submenu when the query filters out its trigger', async () => {
      const { user } = renderWithUser(() => (
        <FolderMenu before={<Menu.Item>Rename</Menu.Item>} triggerProps={{ delay: 0 }} />
      ));

      const parentInput = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(parentInput).toHaveFocus();
      });

      await user.hover(screen.getByRole('menuitem', { name: 'Move to folder' }));
      await screen.findByRole('searchbox', { name: 'Filter folders' });

      // The parent input still holds DOM focus, so the query can change while the submenu is open.
      await user.type(parentInput, 'rename');

      expect(screen.queryByRole('menuitem', { name: 'Move to folder' })).toBe(null);
      await waitFor(() => {
        expect(screen.queryByRole('searchbox', { name: 'Filter folders' })).toBe(null);
      });
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
    });

    it('keeps an open submenu trigger mounted when its filter close is canceled', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu rootProps={{ defaultOpen: true }}>
          <Menu.Item>Rename</Menu.Item>
          <Menu.Group>
            <Menu.FilterProvider>
              <Menu.SubmenuRoot
                open
                onOpenChange={(open, details) => {
                  if (!open) {
                    details.cancel();
                  }
                }}
              >
                <Menu.SubmenuTrigger delay={0}>Move to folder</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Input aria-label="Filter folders" />
                      <Menu.List>
                        <Menu.Item>Documents</Menu.Item>
                      </Menu.List>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.FilterProvider>
          </Menu.Group>
        </ActionsMenu>
      ));

      const parentInput = screen.getByRole('searchbox', { name: 'Filter actions' });
      await screen.findByRole('searchbox', { name: 'Filter folders' });

      await user.type(parentInput, 'zzz');

      // The query really ran: it matches nothing, so only the canceled submenu trigger survives.
      expect(parentInput).toHaveValue('zzz');
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
      });

      expect(screen.getByRole('menuitem', { name: 'Move to folder' })).toBeVisible();
      expect(screen.getByRole('searchbox', { name: 'Filter folders' })).toBeVisible();
    });

    it('filters each menu item variant without changing its role', async () => {
      const { user } = renderWithUser(() => (
        <Menu.FilterProvider defaultValue="banana">
          <Menu.Root open>
            <Menu.Trigger>Fruit</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter fruit" />
                  <Menu.List>
                    <Menu.Item>Apple</Menu.Item>
                    <Menu.CheckboxItem>Banana</Menu.CheckboxItem>
                    <Menu.RadioGroup>
                      <Menu.RadioItem value="cherry">Cherry</Menu.RadioItem>
                    </Menu.RadioGroup>
                    <Menu.LinkItem href="#date">Date</Menu.LinkItem>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      const input = screen.getByRole('searchbox', { name: 'Filter fruit' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      await user.keyboard('[ArrowDown]');

      expect(screen.getByRole('menuitemcheckbox', { name: 'Banana' })).not.toHaveAttribute(
        'aria-expanded',
      );
      expect(screen.queryByRole('menuitem', { name: 'Apple' })).toBe(null);

      await user.clear(input);
      await user.type(input, 'cherry');
      await user.keyboard('[ArrowDown]');

      expect(screen.getByRole('menuitemradio', { name: 'Cherry' })).not.toHaveAttribute(
        'aria-expanded',
      );
      expect(screen.queryByRole('menuitemcheckbox', { name: 'Banana' })).toBe(null);

      await user.clear(input);
      await user.type(input, 'date');
      await user.keyboard('[ArrowDown]');

      expect(screen.getByRole('menuitem', { name: 'Date' })).not.toHaveAttribute('aria-expanded');
      expect(screen.queryByRole('menuitemradio', { name: 'Cherry' })).toBe(null);
    });

    it('preserves uncontrolled checkbox state while the item is filtered out', async () => {
      const { user } = renderWithUser(() => (
        <Menu.FilterProvider>
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter settings" />
                  <Menu.List>
                    <Menu.CheckboxItem defaultChecked>Show details</Menu.CheckboxItem>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      const input = screen.getByRole('searchbox', { name: 'Filter settings' });
      const checkbox = screen.getByRole('menuitemcheckbox', { name: 'Show details' });
      await user.click(checkbox);
      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      await user.type(input, 'rename');
      expect(screen.queryByRole('menuitemcheckbox', { name: 'Show details' })).toBe(null);

      await user.clear(input);
      expect(screen.getByRole('menuitemcheckbox', { name: 'Show details' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
    });
  });

  describe('keyboard navigation', () => {
    // React-only: counts re-renders; Solid calls a `render` callback once per item.
    it.skip('does not rerender unaffected items when the highlight moves', () => {});

    function KeyboardNavigationMenu() {
      return (
        <ActionsMenu>
          <Menu.Item>Rename</Menu.Item>
          <Menu.Item>Duplicate</Menu.Item>
          <Menu.Item>Delete</Menu.Item>
        </ActionsMenu>
      );
    }

    async function openWithKeyboard(user: ReturnType<typeof renderWithUser>['user']) {
      const trigger = screen.getByRole('button', { name: 'Actions' });
      await act(() => trigger.focus());
      await user.keyboard('[Enter]');
      const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
      // The popup hands focus to the input asynchronously, so keys pressed before it lands
      // reach the body instead.
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      return input;
    }

    it('walks the list with the arrow keys and releases the highlight at the end', async () => {
      const { user } = renderWithUser(() => <KeyboardNavigationMenu />);
      const input = await openWithKeyboard(user);

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveAttribute(
          'data-highlighted',
        );
      });
      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Rename' }).id,
      );

      await user.keyboard('[ArrowDown][ArrowDown]');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute(
          'data-highlighted',
        );
      });

      // Past the last item the highlight is released back to the input, matching Combobox.
      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(input).not.toHaveAttribute('aria-activedescendant');
      });

      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveAttribute(
          'data-highlighted',
        );
      });
    });

    it('starts navigation from the top again after closing and reopening', async () => {
      const { user } = renderWithUser(() => <KeyboardNavigationMenu />);
      await openWithKeyboard(user);

      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toHaveAttribute(
          'data-highlighted',
        );
      });

      await user.keyboard('[Escape]');
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });

      const reopenedInput = await openWithKeyboard(user);
      await waitFor(() => {
        expect(reopenedInput).toHaveAttribute(
          'aria-activedescendant',
          screen.getByRole('menuitem', { name: 'Rename' }).id,
        );
      });
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveAttribute(
          'data-highlighted',
        );
      });
      expect(screen.getByRole('menuitem', { name: 'Duplicate' })).not.toHaveAttribute(
        'data-highlighted',
      );
    });

    it('keeps the highlight index in step with the highlighted item after the input is refocused', async () => {
      const { user } = renderWithUser(() => <KeyboardNavigationMenu />);
      const input = await openWithKeyboard(user);

      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toHaveAttribute(
          'data-highlighted',
        );
      });

      // Refocusing the input keeps the highlight, and list navigation must keep its cursor on
      // the same item. If the two drift apart, the next arrow key moves from the wrong position.
      await act(() => {
        input.blur();
        input.focus();
      });

      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Duplicate' }).id,
      );

      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute(
          'data-highlighted',
        );
      });
    });

    it('resets the highlight when the query changes and rebuilds it from the first match', async () => {
      const { user } = renderWithUser(() => <KeyboardNavigationMenu />);
      const input = await openWithKeyboard(user);

      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toHaveAttribute(
          'data-highlighted',
        );
      });

      await user.type(input, 'e');
      await waitFor(() => {
        expect(input).not.toHaveAttribute('aria-activedescendant');
      });

      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveAttribute(
          'data-highlighted',
        );
      });
    });
  });

  describe('typeahead', () => {
    it('does not move the highlight while typing into the input', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu rootProps={{ defaultOpen: true }}>
          <Menu.Item>Rename</Menu.Item>
          <Menu.Item>Duplicate</Menu.Item>
        </ActionsMenu>
      ));

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await user.keyboard('d');
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
      });
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });
  });

  it('keeps component-rendered item text after the item is filtered out', async () => {
    function Label(props: { text: string }) {
      return <span>{props.text}</span>;
    }

    function App() {
      const [query, setQuery] = createSignal('');

      return (
        <ActionsMenu
          providerProps={{
            get value() {
              return query();
            },
            onValueChange: (nextQuery) => setQuery(nextQuery),
          }}
          rootProps={{ defaultOpen: true }}
        >
          <Menu.Item>
            <Label text="Rename" />
          </Menu.Item>
          <Menu.Item>Delete</Menu.Item>
        </ActionsMenu>
      );
    }

    const { user } = renderWithUser(() => <App />);
    const input = screen.getByRole('searchbox', { name: 'Filter actions' });

    await user.type(input, 'del');
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
    });

    // Upstream's `fireEvent.change` is React's text input event; Solid listens to `input`.
    fireEvent.input(input, { target: { value: 'ren' } });

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
    });
  });

  it('preserves input focus on item presses', async () => {
    renderWithUser(() => (
      <ActionsMenu rootProps={{ defaultOpen: true }}>
        <Menu.Item>Rename</Menu.Item>
      </ActionsMenu>
    ));

    const item = screen.getByRole('menuitem', { name: 'Rename' });
    const itemMouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });

    await act(() => item.dispatchEvent(itemMouseDown));

    expect(itemMouseDown.defaultPrevented).toBe(true);
  });

  it('returns focus to the input with the RTL submenu close key', async () => {
    renderWithUser(() => (
      <DirectionProvider direction="rtl">
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <button type="button">Auxiliary action</button>
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      </DirectionProvider>
    ));

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    const auxiliaryAction = screen.getByRole('button', { name: 'Auxiliary action' });
    await act(() => auxiliaryAction.focus());

    fireEvent.keyDown(auxiliaryAction, { key: 'ArrowRight' });

    expect(input).toHaveFocus();
  });

  it('releases the highlight when the query is cleared', async () => {
    const onClick = vi.fn();
    const { user } = renderWithUser(() => (
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.Clear aria-label="Clear filter" />
                <Menu.List>
                  <Menu.Item onClick={onClick}>Apple</Menu.Item>
                  <Menu.Item>Banana</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await user.type(input, 'ban');
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Apple' })).toBe(null);
    });

    // Banana is now index 0.
    await user.keyboard('[ArrowDown]');
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('menuitem', { name: 'Banana' }).id,
    );

    await user.click(screen.getByLabelText('Clear filter'));

    // Apple takes index 0 back, so a kept highlight would activate the wrong item.
    await waitFor(() => {
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });
    await user.keyboard('[Enter]');
    expect(onClick).toHaveBeenCalledTimes(0);
  });

  it('keeps the query when the popup-close reset is canceled', async () => {
    function App() {
      const [open, setOpen] = createSignal(true);
      const [inputValue, setInputValue] = createSignal('');
      return (
        <>
          <button onClick={() => setOpen((value) => !value)}>toggle</button>
          <ActionsMenu
            providerProps={{
              get value() {
                return inputValue();
              },
              onValueChange: (value, details) => {
                if (details.reason === 'popup-close') {
                  details.cancel();
                  return;
                }
                setInputValue(value);
              },
            }}
            rootProps={{
              get open() {
                return open();
              },
              onOpenChange: (next) => setOpen(next),
              modal: false,
            }}
          >
            <Menu.Item>Rename</Menu.Item>
            <Menu.Item>Delete</Menu.Item>
          </ActionsMenu>
        </>
      );
    }

    const { user } = renderWithUser(() => <App />);

    await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'ren');
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBe(null);
    });

    const toggle = screen.getByRole('button', { name: 'toggle' });
    await act(() => toggle.click());
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBe(null);
    });

    await act(() => toggle.click());

    const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
    expect(input).toHaveValue('ren');
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBe(null);
    });
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
  });

  it('renders Empty when no items are registered at all', async () => {
    renderWithUser(() => (
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.Empty>No actions found</Menu.Empty>
                <Menu.List />
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    await waitFor(() => {
      expect(screen.getByText('No actions found')).toBeInTheDocument();
    });
  });

  it('keeps a group with no registered items visible while filtering', async () => {
    const { user } = renderWithUser(() => (
      <ActionsMenu rootProps={{ defaultOpen: true }}>
        <Menu.Group>
          <Menu.GroupLabel>Empty section</Menu.GroupLabel>
        </Menu.Group>
        <Menu.Item>Rename</Menu.Item>
      </ActionsMenu>
    ));

    await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'ren');

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
    });
    expect(screen.getByText('Empty section')).toBeVisible();
  });

  // Port limitation: a filtered-out item is unmounted and its children are never read (reading
  // them creates them, see createFilterDropdownItem), so its text can't change while hidden.
  it.skip('re-filters an item whose rendered text changes while it is hidden', () => {});

  it('preserves modifiers when the input activates a link item', async () => {
    const onClick = vi.fn((event: MouseEvent) => event.preventDefault());
    const { user } = renderWithUser(() => (
      <ActionsMenu rootProps={{ defaultOpen: true }}>
        <Menu.LinkItem href="#docs" onClick={onClick}>
          Docs
        </Menu.LinkItem>
      </ActionsMenu>
    ));

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    await user.keyboard('[ArrowDown]{Control>}[Enter]{/Control}');

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0]).toHaveProperty('ctrlKey', true);
  });

  it('leaves modified editing keys to the input while an item is highlighted', async () => {
    const { user } = renderWithUser(() => (
      <ActionsMenu rootProps={{ defaultOpen: true }}>
        <Menu.Item>Rename</Menu.Item>
        <Menu.Item>Duplicate</Menu.Item>
      </ActionsMenu>
    ));

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    await user.keyboard('[ArrowDown]');
    const rename = screen.getByRole('menuitem', { name: 'Rename' });
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-activedescendant', rename.id);
    });

    // `fireEvent` returns `false` when a handler called `preventDefault`, which would break the
    // browser-native selection and word/boundary movement these shortcuts perform.
    expect(fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true })).toBe(true);
    await flushMicrotasks();
    expect(input).toHaveAttribute('aria-activedescendant', rename.id);

    expect(fireEvent.keyDown(input, { key: 'ArrowLeft', shiftKey: true })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'ArrowRight', altKey: true })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'Home', metaKey: true })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'End', shiftKey: true })).toBe(true);
    await flushMicrotasks();
    expect(input).toHaveAttribute('aria-activedescendant', rename.id);
  });

  it('does not open a highlighted submenu with a modified cross-axis key from the input', async () => {
    const { user } = renderWithUser(() => (
      <ActionsMenu rootProps={{ defaultOpen: true }}>
        <Menu.SubmenuRoot>
          <Menu.SubmenuTrigger delay={0}>Share</Menu.SubmenuTrigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup data-testid="submenu-list">
                <Menu.Item>Email</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.SubmenuRoot>
      </ActionsMenu>
    ));

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    await user.keyboard('[ArrowDown]');
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Share' })).toHaveAttribute('data-highlighted');
    });

    fireEvent.keyDown(input, { key: 'ArrowRight', metaKey: true });
    await flushMicrotasks();
    expect(screen.queryByTestId('submenu-list')).toBe(null);

    await user.keyboard('[ArrowRight]');
    await screen.findByTestId('submenu-list');
  });

  it('calls onOpenChangeComplete when the menu opens and closes', async () => {
    const onOpenChangeComplete = vi.fn();
    const { user } = renderWithUser(() => (
      <ActionsMenu rootProps={{ onOpenChangeComplete }}>
        <Menu.Item>Rename</Menu.Item>
      </ActionsMenu>
    ));

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await waitFor(() => {
      expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
    });

    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(onOpenChangeComplete).toHaveBeenCalledWith(false);
    });
  });

  it('does not seed a highlight when the trigger regains focus while open', async () => {
    const { user } = renderWithUser(() => (
      <ActionsMenu>
        <Menu.Item>Rename</Menu.Item>
      </ActionsMenu>
    ));

    const trigger = screen.getByRole('button', { name: 'Actions' });
    await user.click(trigger);
    const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    // Safari focuses the trigger on mousedown before the closing click lands.
    await act(() => trigger.focus());

    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(trigger).not.toHaveAttribute('aria-activedescendant');
    expect(screen.getByRole('menuitem', { name: 'Rename' })).not.toHaveAttribute(
      'data-highlighted',
    );
  });

  // React-only: compares render passes; Solid calls a `render` callback once.
  it.skip('renders the trigger as often as a plain menu on mount', () => {});

  it('uses the id passed to Menu.Input', async () => {
    renderWithUser(() => (
      <Menu.FilterProvider>
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <label for="action-filter">Filter actions</label>
                <Menu.Input id="action-filter" />
                <Menu.List>
                  <Menu.Item>Rename</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveAttribute(
      'id',
      'action-filter',
    );
  });

  it('prefers the label prop over rendered text for matching', async () => {
    const { user } = renderWithUser(() => (
      <ActionsMenu rootProps={{ defaultOpen: true }}>
        <Menu.Item label="Apple">Fruit one</Menu.Item>
        <Menu.Item>Banana</Menu.Item>
      </ActionsMenu>
    ));

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await user.type(input, 'app');
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Banana' })).toBe(null);
    });
    expect(screen.getByRole('menuitem', { name: 'Fruit one' })).toBeVisible();

    await user.clear(input);
    await user.type(input, 'fruit');
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Fruit one' })).toBe(null);
    });
  });

  it('removes Empty once the query matches again', async () => {
    const { user } = renderWithUser(() => (
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.Empty>No actions found</Menu.Empty>
                <Menu.List>
                  <Menu.Item>Rename</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    expect(screen.queryByText('No actions found')).toBe(null);

    await user.type(input, 'zzz');
    await waitFor(() => {
      expect(screen.getByText('No actions found')).toBeInTheDocument();
    });

    await user.clear(input);
    await user.type(input, 'ren');
    await waitFor(() => {
      expect(screen.queryByText('No actions found')).toBe(null);
    });
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
  });

  describe('server-side rendering', () => {
    // Server rendering (`renderToString`) and hydration aren't covered by the jsdom client tests.
    it.skip('shows the empty state after hydration when no items are rendered', () => {});
  });

  it('does not set aria-selected on highlighted items outside WebKit', async () => {
    const { user } = renderWithUser(() => (
      <ActionsMenu rootProps={{ defaultOpen: true }}>
        <Menu.Item>Rename</Menu.Item>
      </ActionsMenu>
    ));

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    await user.keyboard('[ArrowDown]');

    const item = screen.getByRole('menuitem', { name: 'Rename' });
    await waitFor(() => {
      expect(item).toHaveAttribute('data-highlighted');
    });
    expect(item).not.toHaveAttribute('aria-selected');
  });

  // Upstream runs these in real browsers only (hover intent and safe polygons need layout).
  describe.skip('hover-opened submenu ownership', () => {
    it('closes when the pointer sweeps off the trigger', () => {});
    it('closes when the pointer leaves the submenu popup', () => {});
    it('closes and resets after a query was typed into the hover-opened submenu', () => {});
  });

  describe('prop: filter', () => {
    function CustomFilterMenu(props: { filter?: Menu.FilterProvider.Props['filter'] }) {
      return (
        <Menu.FilterProvider filter={props.filter}>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>Delete</Menu.Item>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      );
    }

    it('applies a custom filter to item text', async () => {
      const filter = vi.fn((text: string, query: string) => text.toLowerCase().startsWith(query));

      const { user } = renderWithUser(() => <CustomFilterMenu filter={filter} />);

      await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'de');

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
      });
      expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
      expect(filter).toHaveBeenCalledWith('Delete', 'de');
      expect(filter).toHaveBeenCalledWith('Rename', 'de');
      expect(filter.mock.calls.every((args) => args.length === 2)).toBe(true);
    });

    it('keeps every item visible when filtering is turned off with null', async () => {
      const { user } = renderWithUser(() => <CustomFilterMenu filter={null} />);

      await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'zzz');

      expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
    });

    // Requires a running exit animation (jsdom has no animations).
    it.skip('keeps externally filtered items while the popup animates out', () => {});
  });

  describe('closing with a query', () => {
    function ControlledQueryMenu(props: {
      onValueChange: (value: string, reason: string) => void;
      rootProps?: Omit<Menu.Root.Props, 'children'>;
    }) {
      const [query, setQuery] = createSignal('');

      return (
        <Menu.FilterProvider
          value={query()}
          onValueChange={(value, eventDetails) => {
            props.onValueChange(value, eventDetails.reason);
            setQuery(value);
          }}
        >
          <Menu.Root {...props.rootProps}>
            <Menu.Trigger>Fruit</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="popup">
                  <Menu.Input aria-label="Filter fruit" />
                  <Menu.List>
                    <Menu.Item>Apple</Menu.Item>
                    <Menu.Item>Apricot</Menu.Item>
                    <Menu.Item>Banana</Menu.Item>
                    <Show when={query() !== ''}>
                      <Menu.Item label={query()}>{`Create "${query()}"`}</Menu.Item>
                    </Show>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      );
    }

    function getItemNames() {
      return screen.getAllByRole('menuitem').map((item) => item.textContent);
    }

    async function openAndType(user: ReturnType<typeof renderWithUser>['user'], text: string) {
      await user.click(screen.getByRole('button', { name: 'Fruit' }));
      const input = await screen.findByRole('searchbox', { name: 'Filter fruit' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      fireEvent.input(input, { target: { value: text } });
      await waitFor(() => {
        expect(getItemNames()).toEqual(['Apple', 'Apricot', `Create "${text}"`]);
      });
      return input;
    }

    // Requires a running exit animation (jsdom has no animations).
    it.skip('keeps an item rendered from the controlled query while the popup animates out', () => {});

    // Requires a running exit animation (jsdom has no animations).
    it.skip('resets the query when the popup reopens before its exit transition completes', () => {});

    it('keeps the query until a popup that prevented unmounting is unmounted', async () => {
      const onValueChange = vi.fn();
      const actionsRef = createRef<Menu.Root.Actions>();

      const { user } = renderWithUser(() => (
        <ControlledQueryMenu
          onValueChange={onValueChange}
          rootProps={{
            actionsRef,
            onOpenChange(_, eventDetails) {
              eventDetails.preventUnmountOnClose();
            },
          }}
        />
      ));
      const input = await openAndType(user, 'ap');

      await user.keyboard('[Escape]');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Fruit' })).toHaveAttribute(
          'aria-expanded',
          'false',
        );
      });
      expect(input).toHaveValue('ap');
      expect(getItemNames()).toEqual(['Apple', 'Apricot', 'Create "ap"']);
      expect(onValueChange).not.toHaveBeenCalledWith('', 'popup-close');

      await act(() => actionsRef.current?.unmount());

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
      expect(onValueChange).toHaveBeenLastCalledWith('', 'popup-close');
    });

    // Requires a running exit animation (jsdom has no animations).
    it.skip('resets the query when the menu is removed as its exit transition completes', () => {});
  });

  describe('canceling changes', () => {
    it('stays closed when onOpenChange is canceled', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu rootProps={{ onOpenChange: (_, eventDetails) => eventDetails.cancel() }}>
          <Menu.Item>Rename</Menu.Item>
        </ActionsMenu>
      ));

      await user.click(screen.getByRole('button', { name: 'Actions' }));

      expect(screen.queryByRole('menu')).toBe(null);
    });

    it('leaves a checkbox item unchecked when onCheckedChange is canceled', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu rootProps={{ defaultOpen: true }}>
          <Menu.CheckboxItem
            closeOnClick={false}
            onCheckedChange={(_, eventDetails) => eventDetails.cancel()}
          >
            Show hidden
          </Menu.CheckboxItem>
        </ActionsMenu>
      ));

      const item = screen.getByRole('menuitemcheckbox', { name: 'Show hidden' });
      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'false');
    });

    it('tracks a controlled checkbox item', async () => {
      function ControlledCheckbox() {
        const [checked, setChecked] = createSignal(false);

        return (
          <ActionsMenu rootProps={{ defaultOpen: true }}>
            <Menu.CheckboxItem
              closeOnClick={false}
              checked={checked()}
              onCheckedChange={(next) => setChecked(next)}
            >
              Show hidden
            </Menu.CheckboxItem>
          </ActionsMenu>
        );
      }

      const { user } = renderWithUser(() => <ControlledCheckbox />);

      const item = screen.getByRole('menuitemcheckbox', { name: 'Show hidden' });
      expect(item).toHaveAttribute('aria-checked', 'false');

      await user.click(item);

      await waitFor(() => {
        expect(item).toHaveAttribute('aria-checked', 'true');
      });
    });
  });

  it('never mounts the Empty children while items match', async () => {
    const onEmptyMount = vi.fn();
    function NoResults() {
      onSettled(() => {
        onEmptyMount();
      });
      return 'No results';
    }

    const { user } = renderWithUser(() => (
      <Menu.FilterProvider>
        <Menu.Root>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.Empty>
                  <NoResults />
                </Menu.Empty>
                <Menu.List>
                  <Menu.Item>Rename</Menu.Item>
                  <Menu.Item>Delete</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await screen.findByRole('menuitem', { name: 'Rename' });

    expect(onEmptyMount).not.toHaveBeenCalled();
    expect(screen.queryByText('No results')).toBe(null);
  });

  describe('IME composition', () => {
    it('filters on the committed text, not the composition in progress', async () => {
      const onValueChange = vi.fn();
      renderWithUser(() => (
        <Menu.FilterProvider onValueChange={onValueChange}>
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.Empty>No actions found.</Menu.Empty>
                  <Menu.List>
                    <Menu.Item>日本語</Menu.Item>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      // Without a trigger the popup has no anchor, so the positioner is never positioned and stays
      // transparent in this port: presence is asserted instead of `toBeVisible`.
      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      fireEvent.compositionStart(input);
      fireEvent.input(input, { target: { value: 'にほ' } });
      await flushMicrotasks();

      expect(input).toHaveValue('にほ');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
      expect(screen.queryByText('No actions found.')).toBe(null);

      fireEvent.input(input, { target: { value: '日本' } });
      fireEvent.compositionEnd(input);

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0][0]).toBe('日本');
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
      });
      expect(screen.getByRole('menuitem', { name: '日本語' })).toBeInTheDocument();
    });
  });

  describe('input value change reasons', () => {
    function renderReasonMenu(onValueChange: (value: string, reason: string) => void) {
      return renderWithUser(() => (
        <Menu.FilterProvider
          onValueChange={(value, eventDetails) => onValueChange(value, eventDetails.reason)}
        >
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.Clear aria-label="Clear filter" />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));
    }

    it('reports input-change while typing', async () => {
      const onValueChange = vi.fn();
      const { user } = renderReasonMenu(onValueChange);

      await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'r');

      expect(onValueChange).toHaveBeenCalledWith('r', 'input-change');
    });

    it('reports input-clear when the field is emptied', async () => {
      const onValueChange = vi.fn();
      const { user } = renderReasonMenu(onValueChange);

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await user.type(input, 'r');
      await user.clear(input);

      expect(onValueChange).toHaveBeenLastCalledWith('', 'input-clear');
    });

    it('reports clear-press when the clear button is used', async () => {
      const onValueChange = vi.fn();
      const { user } = renderReasonMenu(onValueChange);

      await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'r');
      await user.click(screen.getByLabelText('Clear filter'));

      expect(onValueChange).toHaveBeenLastCalledWith('', 'clear-press');
    });

    it('reports popup-close when a controlled close discards the query', async () => {
      const onValueChange = vi.fn();

      function ControlledOpen(props: { open: boolean }) {
        return (
          <ActionsMenu
            providerProps={{
              defaultValue: 'ren',
              onValueChange: (value, eventDetails) => onValueChange(value, eventDetails.reason),
            }}
            rootProps={{
              get open() {
                return props.open;
              },
            }}
          >
            <Menu.Item>Rename</Menu.Item>
          </ActionsMenu>
        );
      }

      const { setProps } = renderWithProps(ControlledOpen, { open: true });
      await setProps({ open: false });

      await waitFor(() => {
        expect(onValueChange).toHaveBeenCalledWith('', 'popup-close');
      });
    });
  });

  describe('accessible names', () => {
    it('does not point the popup or list at a trigger that never rendered', async () => {
      renderWithUser(() => (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-labelledby');
      expect(screen.getByRole('menu')).not.toHaveAttribute('aria-labelledby');
    });

    it('labels the list with the trigger when no label is given', async () => {
      renderWithUser(() => (
        <ActionsMenu rootProps={{ defaultOpen: true }}>
          <Menu.Item>Rename</Menu.Item>
        </ActionsMenu>
      ));

      const trigger = screen.getByRole('button', { name: 'Actions' });
      expect(screen.getByRole('menu')).toHaveAttribute('aria-labelledby', trigger.id);
    });

    // React-only: upstream reads `aria-label` off the `render` element's props; a Solid render
    // callback is opaque (see internals/resolveRenderedAriaLabel.ts).
    it.skip('keeps a list label supplied through a render element', () => {});

    // Upstream sets the empty id on a `render` element; a Solid render callback is opaque, so the
    // empty id is passed as the `id` prop.
    it('omits aria-controls when the list renders with an explicitly empty id', async () => {
      renderWithUser(() => (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List id="">
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).not.toHaveAttribute('aria-controls');
      });
      expect(screen.getByRole('menu').id).toBe('');
    });

    // React-only: React Server Component render elements (`react.lazy` wrappers).
    it.skip('points aria-controls at the id of a server-created render element', () => {});

    // Upstream sets the empty id on a `render` element; here it is passed as the `id` prop.
    it('omits the list label when the trigger renders with an explicitly empty id', async () => {
      renderWithUser(() => (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger id="">Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      const list = screen.getByRole('menu');
      await waitFor(() => {
        expect(list).not.toHaveAttribute('aria-labelledby');
      });
      expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-labelledby');
    });
  });

  describe('handle', () => {
    it('opens from a trigger rendered outside the root', async () => {
      function DetachedTriggerMenu() {
        const handle = Menu.createHandle();

        return (
          <>
            <Menu.FilterProvider>
              <Menu.Root handle={handle}>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Input aria-label="Filter actions" />
                      <Menu.List>
                        <Menu.Item>Rename</Menu.Item>
                      </Menu.List>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </Menu.FilterProvider>
            <Menu.Trigger handle={handle}>Actions</Menu.Trigger>
          </>
        );
      }

      const { user } = renderWithUser(() => <DetachedTriggerMenu />);

      expect(screen.queryByRole('menu')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Actions' }));

      await waitFor(() => {
        expect(screen.getByRole('menu')).not.toBe(null);
      });
      await waitFor(() => {
        expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveFocus();
      });
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
    });

    it('does not highlight an item when another detached trigger receives focus', async () => {
      const onItemHighlighted = vi.fn();

      function DetachedTriggersMenu() {
        const handle = Menu.createHandle();

        return (
          <>
            <Menu.Trigger handle={handle}>First trigger</Menu.Trigger>
            <Menu.Trigger handle={handle}>Second trigger</Menu.Trigger>
            <Menu.FilterProvider>
              <Menu.Root handle={handle} onItemHighlighted={onItemHighlighted}>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Input aria-label="Filter actions" />
                      <Menu.List>
                        <Menu.Item>Rename</Menu.Item>
                        <Menu.Item>Delete</Menu.Item>
                      </Menu.List>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </Menu.FilterProvider>
          </>
        );
      }

      const { user } = renderWithUser(() => <DetachedTriggersMenu />);
      await user.click(screen.getByRole('button', { name: 'First trigger' }));
      const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      onItemHighlighted.mockClear();

      await act(() => screen.getByRole('button', { name: 'Second trigger' }).focus());

      expect(input).not.toHaveAttribute('aria-activedescendant');
      expect(screen.getByRole('menuitem', { name: 'Rename' })).not.toHaveAttribute(
        'data-highlighted',
      );
      expect(onItemHighlighted).not.toHaveBeenCalled();
    });
  });

  describe('consumer props', () => {
    // `Menu.Input` and `Menu.Popup` wrap an inner part, and `Menu.Trigger` merges the props the
    // filter publishes. Consumer props must be applied once, or every handler fires twice.
    it('runs a consumer handler once per interaction on each composed part', async () => {
      const onTriggerClick = vi.fn();
      const onInputKeyDown = vi.fn();
      const onPopupKeyDown = vi.fn();

      const { user } = renderWithUser(() => (
        <Menu.FilterProvider>
          <Menu.Root>
            <Menu.Trigger onClick={onTriggerClick}>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup onKeyDown={onPopupKeyDown}>
                  <Menu.Input aria-label="Filter actions" onKeyDown={onInputKeyDown} />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      await user.click(screen.getByRole('button', { name: 'Actions' }));
      expect(onTriggerClick).toHaveBeenCalledTimes(1);

      const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      fireEvent.keyDown(input, { key: 'r' });

      // A printable key stays on the input: it must not reach the popup's handler.
      expect(onInputKeyDown).toHaveBeenCalledTimes(1);
      expect(onPopupKeyDown).toHaveBeenCalledTimes(0);

      // Escape is not consumed by the input, so it reaches the popup exactly once.
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(onPopupKeyDown).toHaveBeenCalledTimes(1);
    });

    it('lets a consumer key handler on the input opt out of list navigation and activation', async () => {
      const onPress = vi.fn();
      renderWithUser(() => (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input
                    aria-label="Filter actions"
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowUp' || event.key === 'Enter') {
                        event.preventBaseUIHandler();
                      }
                    }}
                  />
                  <Menu.List>
                    <Menu.Item onClick={onPress}>Rename</Menu.Item>
                    <Menu.Item>Delete</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      await waitFor(() => {
        expect(input).toHaveAttribute(
          'aria-activedescendant',
          screen.getByRole('menuitem', { name: 'Rename' }).id,
        );
      });

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'Enter' });
      await flushMicrotasks();

      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Rename' }).id,
      );
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('focus ownership inside the popup', () => {
    it('leaves focus on another control in the popup when the pointer moves', async () => {
      renderWithUser(() => (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="popup">
                  <Menu.Input aria-label="Filter actions" />
                  <button type="button">Auxiliary action</button>
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      const auxiliary = screen.getByRole('button', { name: 'Auxiliary action' });
      await act(() => auxiliary.focus());

      fireEvent.mouseMove(screen.getByTestId('popup'));

      expect(auxiliary).toHaveFocus();
    });

    it('returns focus to the parent input when the pointer moves back over the parent popup', async () => {
      const { user } = renderWithUser(() => (
        <FolderMenu triggerProps={{ delay: 0, closeDelay: 1000 }} />
      ));

      const rootInput = screen.getByRole('searchbox', { name: 'Filter actions' });
      const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to folder' });
      await user.hover(submenuTrigger);
      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter folders' });
      // Let the root popup's initial focus land first so it can't steal focus from the click below.
      await act(() => waitSingleFrame());
      fireEvent.mouseMove(submenuInput);
      await waitFor(() => {
        expect(submenuInput).toHaveAttribute('data-highlighted');
      });
      await user.click(submenuInput);
      expect(submenuInput).toHaveFocus();

      // Back over the still-open submenu's trigger.
      fireEvent.mouseMove(submenuTrigger);

      expect(rootInput).toHaveFocus();
      await waitFor(() => {
        expect(rootInput).toHaveAttribute('data-highlighted');
      });
      expect(submenuInput).not.toHaveAttribute('data-highlighted');
      expect(submenuInput).toBeVisible();
    });

    // Upstream runs it in real browsers only (touch-then-mouse pointer sequences).
    it.skip('returns focus to the parent input when a mouse enters the trigger after a tap', () => {});

    it('restores the parent input highlight when the pointer returns from a plain submenu', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu rootProps={{ defaultOpen: true }}>
          <Menu.SubmenuRoot>
            <Menu.SubmenuTrigger delay={0}>Share</Menu.SubmenuTrigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.List>
                    <Menu.Item>Email</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.SubmenuRoot>
        </ActionsMenu>
      ));

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      const trigger = screen.getByRole('menuitem', { name: 'Share' });
      await user.hover(trigger);
      const item = await screen.findByRole('menuitem', { name: 'Email' });
      await flushMicrotasks();
      fireEvent.mouseMove(item);
      await waitFor(() => expect(item).toHaveFocus());
      await waitFor(() => {
        expect(input).not.toHaveAttribute('data-highlighted');
      });

      fireEvent.mouseOver(trigger);
      expect(input).toHaveFocus();
      await waitFor(() => {
        expect(input).toHaveAttribute('data-highlighted');
      });
    });

    it('returns focus to the parent input once a pointer-opened submenu unmounts', async () => {
      const { user } = renderWithUser(() => (
        <FolderMenu
          before={<Menu.Item>Rename</Menu.Item>}
          triggerProps={{ delay: 0, closeDelay: 0 }}
        />
      ));

      await user.hover(screen.getByRole('menuitem', { name: 'Move to folder' }));
      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter folders' });
      fireEvent.mouseMove(submenuInput);
      await waitFor(() => {
        expect(submenuInput).toHaveFocus();
      });

      await user.hover(screen.getByRole('menuitem', { name: 'Rename' }));
      await waitFor(() => {
        expect(submenuInput).not.toBeInTheDocument();
      });

      const rootInput = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(rootInput).toHaveFocus();
      });
      await waitFor(() => {
        expect(rootInput).toHaveAttribute('data-highlighted');
      });
    });

    function SiblingSubmenus(props: { onRootInputFocus: () => void }) {
      function Submenu(submenuProps: { label: string; delay: number }) {
        return (
          <Menu.FilterProvider>
            <Menu.SubmenuRoot>
              {/* The close waits until the pointer has highlighted the next trigger. */}
              <Menu.SubmenuTrigger delay={submenuProps.delay} closeDelay={10}>
                {submenuProps.label}
              </Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label={`Filter ${submenuProps.label}`} />
                    <Menu.List>
                      <Menu.Item>Option</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>
          </Menu.FilterProvider>
        );
      }

      return (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input
                    aria-label="Filter actions"
                    onFocus={() => props.onRootInputFocus()}
                  />
                  <Menu.List>
                    <Submenu label="Move to folder" delay={0} />
                    {/* Opens only after the first submenu has unmounted. */}
                    <Submenu label="Share" delay={50} />
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      );
    }

    it('opens a hovered submenu without moving focus until the pointer enters it', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu rootProps={{ defaultOpen: true }}>
          <Menu.FilterProvider>
            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger delay={0}>Move to folder</Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup data-testid="submenu-popup">
                    <Menu.Input aria-label="Filter folders" />
                    <Menu.List>
                      <Menu.Item>Documents</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>
          </Menu.FilterProvider>
        </ActionsMenu>
      ));

      const rootInput = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(rootInput).toHaveFocus();
      });

      const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to folder' });
      await user.hover(submenuTrigger);
      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter folders' });
      await act(() => waitSingleFrame());
      expect(rootInput).toHaveFocus();
      expect(rootInput).toHaveAttribute('data-highlighted');

      fireEvent.mouseMove(screen.getByTestId('submenu-popup'));
      expect(submenuInput).toHaveFocus();
      await waitFor(() => {
        expect(submenuInput).toHaveAttribute('data-highlighted');
      });
    });

    it('moves focus back to the parent input while the pointer moves between submenu triggers', async () => {
      const { user } = renderWithUser(() => <SiblingSubmenus onRootInputFocus={() => {}} />);
      const rootInput = screen.getByRole('searchbox', { name: 'Filter actions' });

      await user.hover(screen.getByRole('menuitem', { name: 'Move to folder' }));
      const firstInput = await screen.findByRole('searchbox', { name: 'Filter Move to folder' });
      fireEvent.mouseMove(firstInput);
      await waitFor(() => {
        expect(firstInput).toHaveFocus();
      });

      await user.hover(screen.getByRole('menuitem', { name: 'Share' }));
      await waitFor(() => {
        expect(rootInput).toHaveFocus();
      });
      const secondInput = await screen.findByRole('searchbox', { name: 'Filter Share' });
      // Let the second submenu's open settle without moving focus.
      await act(() => waitSingleFrame());
      expect(rootInput).toHaveFocus();

      fireEvent.mouseMove(secondInput);
      expect(secondInput).toHaveFocus();
    });
  });

  describe('leaving the menu', () => {
    function QueryMenu(props: { modal?: boolean }) {
      return (
        <ActionsMenu
          rootProps={{
            defaultOpen: true,
            get modal() {
              return props.modal;
            },
          }}
        >
          <Menu.Item>Rename</Menu.Item>
        </ActionsMenu>
      );
    }

    it('closes on Escape even with a query typed', async () => {
      const { user } = renderWithUser(() => <QueryMenu />);

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      fireEvent.input(input, { target: { value: 'ren' } });
      expect(input).toHaveValue('ren');
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await user.keyboard('[Escape]');

      // Escape closes outright; it does not clear the query first.
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus();
      });
    });

    it('closes and returns focus to the trigger on Shift+Tab from the input', async () => {
      const { user } = renderWithUser(() => <QueryMenu />);

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await user.tab({ shift: true });

      // Backward tabbing mirrors a plain menu: the popup closes and the trigger regains focus.
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus();
      });
    });

    it('keeps input focus when a Shift+Tab close is canceled', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu
          rootProps={{
            defaultOpen: true,
            onOpenChange: (open, details) => {
              if (!open) {
                details.cancel();
              }
            },
          }}
        >
          <Menu.Item>Rename</Menu.Item>
        </ActionsMenu>
      ));

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await user.tab({ shift: true });

      expect(input).toHaveFocus();
      expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await user.type(input, 'r');
      expect(input).toHaveValue('r');
    });
  });

  describe('prop: keepMounted', () => {
    it('resets the query and highlight across a close and reopen', async () => {
      const { user } = renderWithUser(() => (
        <Menu.FilterProvider>
          <Menu.Root>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal keepMounted>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                    <Menu.Item>Delete</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await user.click(trigger);

      const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
      await user.type(input, 'ren');
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBe(null);
      });

      await user.keyboard('[ArrowDown]');
      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Rename' }).id,
      );

      await user.keyboard('[Escape]');
      await user.click(trigger);

      // The parts stay mounted, so the query has to be cleared explicitly on close.
      await waitFor(() => {
        expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveValue('');
      });
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
      });
      expect(screen.getByRole('searchbox', { name: 'Filter actions' })).not.toHaveAttribute(
        'aria-activedescendant',
      );
    });
  });

  describe('with a Viewport', () => {
    it('keeps real focus on the input while the cursor moves through the list', async () => {
      const { user } = renderWithUser(() => (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.Viewport>
                    <Menu.List>
                      <Menu.Item>Rename</Menu.Item>
                      <Menu.Item>Delete</Menu.Item>
                    </Menu.List>
                  </Menu.Viewport>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await user.keyboard('[ArrowDown]');

      expect(input).toHaveFocus();
      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Rename' }).id,
      );
    });
  });

  describe('prop: autoHighlight', () => {
    it('clears a pointer highlight on pointer leave by default', async () => {
      const { user } = renderWithUser(() => (
        <ActionsMenu rootProps={{ defaultOpen: true }}>
          <Menu.Item>Rename</Menu.Item>
        </ActionsMenu>
      ));

      const item = screen.getByRole('menuitem', { name: 'Rename' });
      await user.hover(item);
      await waitFor(() => {
        expect(item).toHaveAttribute('data-highlighted');
      });

      await user.unhover(item);

      // The mirror of the `autoHighlight="always"` case, which retains the highlight.
      await waitFor(() => {
        expect(item).not.toHaveAttribute('data-highlighted');
      });
    });
  });

  describe('prop: onItemHighlighted', () => {
    it.each(['vertical', 'horizontal'] as const)(
      'passes the keydown event to onItemHighlighted in a %s menu',
      async (orientation) => {
        const onItemHighlighted = vi.fn();
        const { user } = renderWithUser(() => (
          <Menu.FilterProvider>
            <Menu.Root open orientation={orientation} onItemHighlighted={onItemHighlighted}>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.Item>Rename</Menu.Item>
                      <Menu.Item>Delete</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        ));

        const input = screen.getByRole('searchbox', { name: 'Filter actions' });
        await act(() => input.focus());
        await user.keyboard('[ArrowDown]');

        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenLastCalledWith(
            screen.getByRole('menuitem', { name: 'Rename' }),
            expect.anything(),
          );
        });
        const details = onItemHighlighted.mock.lastCall?.[1];
        expect(details.reason).toBe('keyboard');
        expect(details.event).toBeInstanceOf(KeyboardEvent);
        expect(details.event.key).toBe('ArrowDown');
      },
    );

    function SubmenuHighlightMenu(props: {
      onItemHighlighted: Menu.Root.Props['onItemHighlighted'];
    }) {
      return (
        <Menu.FilterProvider>
          <Menu.Root open onItemHighlighted={props.onItemHighlighted}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.FilterProvider>
                      <Menu.SubmenuRoot>
                        <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner>
                            <Menu.Popup>
                              <Menu.Input aria-label="Filter sharing options" />
                              <Menu.List>
                                <Menu.Item>Email</Menu.Item>
                              </Menu.List>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.SubmenuRoot>
                    </Menu.FilterProvider>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      );
    }

    it('passes the keydown events when entering and leaving a filterable submenu', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = renderWithUser(() => (
        <SubmenuHighlightMenu onItemHighlighted={onItemHighlighted} />
      ));

      await act(() => screen.getByRole('searchbox', { name: 'Filter actions' }).focus());
      await user.keyboard('[ArrowDown][ArrowRight]');
      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter sharing options' });
      await waitFor(() => {
        expect(submenuInput).toHaveFocus();
      });

      const enterDetails = onItemHighlighted.mock.lastCall?.[1];
      expect(onItemHighlighted.mock.lastCall?.[0]).toBe(undefined);
      expect(enterDetails.reason).toBe('keyboard');
      expect(enterDetails.event.key).toBe('ArrowRight');

      await user.keyboard('[ArrowLeft]');
      const trigger = screen.getByRole('menuitem', { name: 'Share' });
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith(trigger, expect.anything());
      });

      const exitDetails = onItemHighlighted.mock.lastCall?.[1];
      expect(exitDetails.reason).toBe('keyboard');
      expect(exitDetails.event.key).toBe('ArrowLeft');
    });

    it('reports no keyboard reason when Enter opens a filterable submenu', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = renderWithUser(() => (
        <SubmenuHighlightMenu onItemHighlighted={onItemHighlighted} />
      ));

      await act(() => screen.getByRole('searchbox', { name: 'Filter actions' }).focus());
      await user.keyboard('[ArrowDown][Enter]');
      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter sharing options' });
      await waitFor(() => {
        expect(submenuInput).toHaveFocus();
      });

      expect(onItemHighlighted.mock.lastCall?.[0]).toBe(undefined);
      expect(onItemHighlighted.mock.lastCall?.[1].reason).toBe('none');
    });
  });
});

describe('filterable menu navigation regressions', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  describe.each([false, true])('with a filtered submenu: %s', (filterSubmenu) => {
    it.each([
      ['[ArrowRight]', '[ArrowLeft]'],
      ['[ArrowRight]', '{Shift>}[Tab]{/Shift}'],
      ['[Enter]', '[Escape]'],
    ])(
      'restores input focus after opening with %s and closing with %s',
      async (openKey, closeKey) => {
        const submenu = () => (
          <Menu.SubmenuRoot>
            <Menu.SubmenuTrigger openOnHover={false}>More</Menu.SubmenuTrigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  {filterSubmenu ? (
                    [
                      <Menu.Input aria-label="Filter child actions" />,
                      <Menu.List>
                        <Menu.Item>Child action</Menu.Item>
                      </Menu.List>,
                    ]
                  ) : (
                    <Menu.Item>Child action</Menu.Item>
                  )}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.SubmenuRoot>
        );
        const { user } = renderWithUser(() => (
          <ActionsMenu rootProps={{ defaultOpen: true }}>
            {filterSubmenu ? <Menu.FilterProvider>{submenu()}</Menu.FilterProvider> : submenu()}
            <Menu.Item>Rename</Menu.Item>
          </ActionsMenu>
        ));
        const input = screen.getByRole('searchbox', { name: 'Filter actions' });
        await waitFor(() => expect(input).toHaveFocus());
        await user.keyboard(`[ArrowDown]${openKey}`);
        const child = filterSubmenu
          ? await screen.findByRole('searchbox', { name: 'Filter child actions' })
          : await screen.findByRole('menuitem', { name: 'Child action' });
        await waitFor(() => expect(child).toHaveFocus());
        await user.keyboard(closeKey);
        await waitFor(() =>
          expect(screen.queryByRole('menuitem', { name: 'Child action' })).toBe(null),
        );
        await waitFor(() => expect(input).toHaveFocus());
        await user.keyboard('ren');
        expect(input).toHaveValue('ren');
        expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
      },
    );
  });

  it('does not repeat matching when navigating past hidden component labels', async () => {
    function Label(props: { text: string }) {
      return <span>{props.text}</span>;
    }
    const filter = vi.fn((text: string, query: string) => text.includes(query));
    const { user } = renderWithUser(() => (
      <Menu.FilterProvider filter={filter} autoHighlight="always" defaultValue="Match">
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <For each={Array.from({ length: 20 }, (_, index) => index)}>
                    {(index) => (
                      <Menu.Item>
                        <Label text={index < 2 ? `Match ${index}` : `Hidden ${index}`} />
                      </Menu.Item>
                    )}
                  </For>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));
    const input = screen.getByRole('searchbox');
    await waitFor(() => expect(screen.getAllByRole('menuitem')).toHaveLength(2));
    await waitFor(() => expect(input).toHaveFocus());
    filter.mockClear();
    await user.keyboard('[ArrowDown]');
    expect(screen.getByRole('menuitem', { name: 'Match 1' })).toHaveAttribute('data-highlighted');
    expect(filter).not.toHaveBeenCalled();
  });
});
