import { Show, createSignal, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Menu } from '..';
import { act, renderWithUser, waitSingleFrame } from '../test-utils';

// The submenu trigger's VoiceOver branch is covered separately; keep the mainline deterministic.
vi.mock('@egoist/solid-base-utils/platform', async () => {
  const actual = await vi.importActual<typeof import('@egoist/solid-base-utils/platform')>(
    '@egoist/solid-base-utils/platform',
  );

  return {
    ...actual,
    platform: {
      ...actual.platform,
      screenReader: { ...actual.platform.screenReader, voiceOver: false },
    },
  };
});

/**
 * Lets the initial focus of a menu rendered open (moved in an animation frame) settle, so it
 * doesn't land in the middle of the interaction that follows.
 */
async function settleInitialFocus() {
  await act(async () => {
    await waitSingleFrame();
    await waitSingleFrame();
  });
}

/**
 * The focus manager moves focus into a popup opened from the keyboard in an animation frame.
 */
async function waitForFocusInside(popup: HTMLElement) {
  await waitFor(() => {
    const root = popup.getRootNode() as Document | ShadowRoot;
    expect(popup.contains(root.activeElement)).toBe(true);
  });
}

describe('<Menu.FilterProvider><Menu.SubmenuRoot/></Menu.FilterProvider>', () => {
  /** A filterable submenu whose parent is a plain, roving-focus `Menu.Root`. */
  function PlainParentMenu() {
    return (
      <Menu.Root open>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>Rename</Menu.Item>
              <Menu.FilterProvider>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger data-testid="submenu-trigger">Move to</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Input aria-label="Filter folders" />
                        <Menu.List data-testid="submenu-list">
                          <Menu.Item>Projects</Menu.Item>
                          <Menu.Item>Archive</Menu.Item>
                        </Menu.List>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.FilterProvider>
              <Menu.Item>Delete</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    );
  }

  describe('prop: value', () => {
    it('renders the controlled query and reports changes', async () => {
      const onValueChange = vi.fn();

      function ControlledSubmenu() {
        const [inputValue, setInputValue] = createSignal('pro');

        return (
          <Menu.FilterProvider>
            <Menu.Root defaultOpen>
              <Menu.Trigger>Actions</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.FilterProvider
                        value={inputValue()}
                        onValueChange={(nextValue, eventDetails) => {
                          onValueChange(nextValue, eventDetails.reason);
                          setInputValue(nextValue);
                        }}
                      >
                        <Menu.SubmenuRoot defaultOpen>
                          <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>
                          <Menu.Portal>
                            <Menu.Positioner>
                              <Menu.Popup>
                                <Menu.Input aria-label="Filter folders" />
                                <Menu.List>
                                  <Menu.Item>Projects</Menu.Item>
                                  <Menu.Item>Archive</Menu.Item>
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

      const { user } = renderWithUser(() => <ControlledSubmenu />);

      const input = screen.getByRole('searchbox', { name: 'Filter folders' });
      expect(input).toHaveValue('pro');
      expect(screen.queryByRole('menuitem', { name: 'Archive' })).toBe(null);

      await user.clear(input);

      expect(onValueChange).toHaveBeenCalledWith('', 'input-clear');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Archive' })).not.toBe(null);
      });
    });

    it('keeps the uncontrolled query when the change is canceled', async () => {
      const { user } = renderWithUser(() => (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.FilterProvider
                      defaultValue="pro"
                      onValueChange={(_, eventDetails) => eventDetails.cancel()}
                    >
                      <Menu.SubmenuRoot defaultOpen>
                        <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner>
                            <Menu.Popup>
                              <Menu.Input aria-label="Filter folders" />
                              <Menu.List>
                                <Menu.Item>Projects</Menu.Item>
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
      ));

      const input = screen.getByRole('searchbox', { name: 'Filter folders' });
      await user.type(input, 'x');

      expect(input).toHaveValue('pro');
    });

    it('resets the controlled query when an item press closes the whole menu', async () => {
      const onValueChange = vi.fn();

      function ControlledSubmenu() {
        const [inputValue, setInputValue] = createSignal('');

        return (
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="parent-popup">
                  <Menu.Item>Rename</Menu.Item>
                  <Menu.FilterProvider
                    value={inputValue()}
                    onValueChange={(nextValue, eventDetails) => {
                      onValueChange(nextValue, eventDetails.reason);
                      setInputValue(nextValue);
                    }}
                  >
                    <Menu.SubmenuRoot defaultOpen>
                      <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Input aria-label="Filter folders" />
                            <Menu.List>
                              <Menu.Item>Projects</Menu.Item>
                              <Menu.Item>Archive</Menu.Item>
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
        );
      }

      const { user } = renderWithUser(() => <ControlledSubmenu />);

      const input = await screen.findByRole('searchbox', { name: 'Filter folders' });
      await user.type(input, 'p');
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'Archive' })).toBe(null);
      });
      expect(onValueChange.mock.calls).toEqual([['p', 'input-change']]);

      await user.click(screen.getByRole('menuitem', { name: 'Projects' }));

      await waitFor(() => {
        expect(screen.queryByTestId('parent-popup')).toBe(null);
      });
      expect(onValueChange.mock.calls).toEqual([
        ['p', 'input-change'],
        ['', 'popup-close'],
      ]);
    });
  });

  describe('prop: filter', () => {
    // Browser-only upstream (`skipIf(isJSDOM)`): relies on a real CSS exit animation.
    it.skip('keeps externally filtered items while the submenu animates out (animations)', () => {});
  });

  describe('inside a plain parent menu', () => {
    it('closes with Escape and returns focus to the highlighted trigger', async () => {
      const { user } = renderWithUser(() => <PlainParentMenu />);

      const trigger = screen.getByTestId('submenu-trigger');
      await settleInitialFocus();
      await act(() => trigger.focus());
      await user.keyboard('{ArrowRight}');

      const input = await screen.findByRole('searchbox', { name: 'Filter folders' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByTestId('submenu-list')).toBe(null);
      });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
      expect(trigger).toHaveAttribute('data-highlighted');
      expect(screen.getByRole('menuitem', { name: 'Rename' })).not.toBe(null);
    });

    it('opens with the cross-axis key and focuses the submenu input', async () => {
      const { user } = renderWithUser(() => <PlainParentMenu />);

      const trigger = screen.getByTestId('submenu-trigger');
      await settleInitialFocus();
      await act(() => trigger.focus());
      await user.keyboard('{ArrowRight}');

      const input = await screen.findByRole('searchbox', { name: 'Filter folders' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
    });

    it('closes with the cross-axis close key and returns focus to the trigger', async () => {
      const { user } = renderWithUser(() => <PlainParentMenu />);

      const trigger = screen.getByTestId('submenu-trigger');
      await settleInitialFocus();
      await act(() => trigger.focus());
      await user.keyboard('{ArrowRight}');

      const input = await screen.findByRole('searchbox', { name: 'Filter folders' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await user.keyboard('{ArrowLeft}');

      await waitFor(() => {
        expect(screen.queryByTestId('submenu-list')).toBe(null);
      });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });

    it('hands the cursor back to the submenu input when the open key repeats', async () => {
      const { user } = renderWithUser(() => <PlainParentMenu />);

      const trigger = screen.getByTestId('submenu-trigger');
      await settleInitialFocus();
      await act(() => trigger.focus());
      await user.keyboard('{ArrowRight}');

      const input = await screen.findByRole('searchbox', { name: 'Filter folders' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      // Move real focus back onto the trigger, then press the open key again while the submenu
      // is still open: it must re-enter rather than reopen.
      await settleInitialFocus();
      await act(() => trigger.focus());
      await user.keyboard('{ArrowRight}');

      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      expect(screen.getByTestId('submenu-list')).not.toBe(null);
    });

    it('keeps the automatic highlight when the keyboard enters a hover-opened submenu', async () => {
      const { user } = renderWithUser(() => (
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Rename</Menu.Item>
                <Menu.FilterProvider autoHighlight="always">
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger delay={0} data-testid="submenu-trigger">
                      Move to
                    </Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner>
                        <Menu.Popup>
                          <Menu.Input aria-label="Filter folders" />
                          <Menu.List>
                            <Menu.Item>Projects</Menu.Item>
                            <Menu.Item>Archive</Menu.Item>
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

      const trigger = screen.getByTestId('submenu-trigger');
      await user.hover(trigger);
      const input = await screen.findByRole('searchbox', { name: 'Filter folders' });
      const projects = screen.getByRole('menuitem', { name: 'Projects' });
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', projects.id);
      });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });

      await user.keyboard('{ArrowRight}');

      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      expect(input).toHaveAttribute('aria-activedescendant', projects.id);
    });

    it('moves along the parent list with the main-axis keys', async () => {
      const { user } = renderWithUser(() => <PlainParentMenu />);

      const trigger = screen.getByTestId('submenu-trigger');
      await settleInitialFocus();
      await act(() => trigger.focus());

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
      });
    });

    it('closes when the close key arrives while the trigger holds focus', async () => {
      const { user } = renderWithUser(() => <PlainParentMenu />);

      const trigger = screen.getByTestId('submenu-trigger');
      await settleInitialFocus();
      await act(() => trigger.focus());
      await user.keyboard('{ArrowRight}');

      await screen.findByRole('searchbox', { name: 'Filter folders' });

      // Put real focus back on the trigger, then press the close key there rather than in the
      // submenu popup.
      await act(() => trigger.focus());
      await user.keyboard('{ArrowLeft}');

      await waitFor(() => {
        expect(screen.queryByTestId('submenu-list')).toBe(null);
      });
    });

    it('keeps focus in the submenu input when the pointer crosses the trigger again', async () => {
      const { user } = renderWithUser(() => (
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Rename</Menu.Item>
                <Menu.FilterProvider>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger delay={0} data-testid="submenu-trigger">
                      Move to
                    </Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner>
                        <Menu.Popup>
                          <Menu.Input aria-label="Filter folders" />
                          <Menu.List>
                            <Menu.Item>Projects</Menu.Item>
                            <Menu.Item>Archive</Menu.Item>
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

      const trigger = screen.getByTestId('submenu-trigger');
      await user.hover(trigger);
      const input = await screen.findByRole('searchbox', { name: 'Filter folders' });

      // The pointer enters the submenu and typing starts.
      fireEvent.mouseMove(input);
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      await user.keyboard('ar');
      expect(input).toHaveValue('ar');

      // Crossing the trigger must not interrupt typing in the submenu.
      await act(async () => {
        fireEvent.mouseMove(trigger);
        flush();
        await waitSingleFrame();
        await waitSingleFrame();
      });
      expect(input).toHaveFocus();
      await user.keyboard('c');
      expect(input).toHaveValue('arc');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Archive' })).toBeVisible();
      });
    });

    it('leaves a key that is neither an axis nor an activation key to the parent', async () => {
      const { user } = renderWithUser(() => <PlainParentMenu />);

      const trigger = screen.getByTestId('submenu-trigger');
      await settleInitialFocus();
      await act(() => trigger.focus());

      await user.keyboard('{Home}');

      // The submenu must not open, and the parent's own Home handling still runs.
      expect(screen.queryByTestId('submenu-list')).toBe(null);
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
      });
    });
  });
});

describe('filtered submenu trigger navigation', () => {
  it('prevents native scrolling when moving along the parent menu', async () => {
    render(() => (
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.FilterProvider>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger openOnHover={false}>More</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Input aria-label="Filter child actions" />
                        <Menu.List>
                          <Menu.Item>Child</Menu.Item>
                        </Menu.List>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.FilterProvider>
              <Menu.Item>Next</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    const trigger = screen.getByRole('menuitem', { name: 'More' });
    await settleInitialFocus();
    await act(() => trigger.focus());
    expect(fireEvent.keyDown(trigger, { key: 'ArrowDown' })).toBe(false);
    flush();
    expect(screen.getByRole('menuitem', { name: 'Next' })).toHaveFocus();
  });
});

describe('closing a filtered submenu from the keyboard', () => {
  it('ignores a close key that composes text in the submenu input', async () => {
    const { user } = renderWithUser(() => (
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.FilterProvider>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger openOnHover={false}>More</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Input aria-label="Filter child actions" />
                        <Menu.List>
                          <Menu.Item>Child</Menu.Item>
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

    await settleInitialFocus();
    await act(() => screen.getByRole('menuitem', { name: 'More' }).focus());
    await user.keyboard('[ArrowRight]');
    const input = await screen.findByRole('searchbox', { name: 'Filter child actions' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    // An IME composition reports `keyCode` 229.
    fireEvent.keyDown(input, { key: 'ArrowLeft', keyCode: 229, which: 229 });
    flush();

    // The popup can stay mounted through an exit animation, so check the open state itself.
    expect(screen.getByRole('menuitem', { name: 'More' })).toHaveAttribute('data-popup-open');
    expect(input).toHaveFocus();
  });

  function Submenu(props: { filterable: boolean; container?: ShadowRoot }) {
    const submenu = () => (
      <Menu.SubmenuRoot>
        <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
        <Menu.Portal container={props.container}>
          <Menu.Positioner>
            <Menu.Popup data-testid="submenu">
              {props.filterable && <Menu.Input aria-label="Filter child actions" />}
              <Menu.List>
                <Menu.Item>Child</Menu.Item>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.SubmenuRoot>
    );
    return (
      <Show when={props.filterable} fallback={submenu()}>
        <Menu.FilterProvider>{submenu()}</Menu.FilterProvider>
      </Show>
    );
  }

  it.each([
    { parentFilterable: false, submenuFilterable: true },
    { parentFilterable: true, submenuFilterable: false },
    { parentFilterable: true, submenuFilterable: true },
  ])(
    'moves a horizontal parent on when a vertical submenu closes on its main-axis key (filterable parent: $parentFilterable, filterable submenu: $submenuFilterable)',
    async ({ parentFilterable, submenuFilterable }) => {
      const menu = () => (
        <Menu.Root orientation="horizontal">
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                {parentFilterable && <Menu.Input aria-label="Filter actions" />}
                <Menu.List>
                  <Menu.Item>First</Menu.Item>
                  <Submenu filterable={submenuFilterable} />
                  <Menu.Item>Last</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      );
      const { user } = renderWithUser(() =>
        parentFilterable ? <Menu.FilterProvider>{menu()}</Menu.FilterProvider> : menu(),
      );

      await act(() => screen.getByRole('button', { name: 'Actions' }).focus());
      await user.keyboard('[Enter]');
      const initialFocus = parentFilterable
        ? await screen.findByRole('searchbox', { name: 'Filter actions' })
        : await screen.findByRole('menuitem', { name: 'First' });
      await waitFor(() => expect(initialFocus).toHaveFocus());
      await user.keyboard('[ArrowRight]');
      const trigger = screen.getByRole('menuitem', { name: 'More' });
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-highlighted');
      });

      await user.keyboard('[ArrowDown]');
      await waitForFocusInside(await screen.findByTestId('submenu'));
      await user.keyboard('[ArrowLeft]');

      await waitFor(() => {
        expect(screen.queryByTestId('submenu')).toBe(null);
      });
      expect(screen.getByRole('menuitem', { name: 'First' })).toHaveAttribute('data-highlighted');
      expect(trigger).not.toHaveAttribute('data-highlighted');
    },
  );

  it.each([false, true])(
    'does not wrap a filterable parent when closing from its first item (filterable submenu: %s)',
    async (submenuFilterable) => {
      const { user } = renderWithUser(() => (
        <Menu.FilterProvider>
          <Menu.Root orientation="horizontal">
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Submenu filterable={submenuFilterable} />
                    <Menu.Item>Middle</Menu.Item>
                    <Menu.Item>Last</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      await act(() => screen.getByRole('button', { name: 'Actions' }).focus());
      await user.keyboard('[Enter]');
      const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
      const trigger = screen.getByRole('menuitem', { name: 'More' });
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', trigger.id);
      });

      await user.keyboard('[ArrowDown]');
      await waitForFocusInside(await screen.findByTestId('submenu'));
      await user.keyboard('[ArrowLeft]');

      await waitFor(() => {
        expect(screen.queryByTestId('submenu')).toBe(null);
      });
      expect(input).toHaveFocus();
      expect(input).toHaveAttribute('aria-activedescendant', trigger.id);
      expect(screen.getByRole('menuitem', { name: 'Last' })).not.toHaveAttribute(
        'data-highlighted',
      );
    },
  );

  it('moves a filterable parent on when a submenu portaled into a shadow root closes', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const shadowRoot = host.attachShadow({ mode: 'open' });

    try {
      const { user } = renderWithUser(() => (
        <Menu.FilterProvider>
          <Menu.Root orientation="horizontal">
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>First</Menu.Item>
                    <Submenu filterable={false} container={shadowRoot} />
                    <Menu.Item>Last</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ));

      await act(() => screen.getByRole('button', { name: 'Actions' }).focus());
      await user.keyboard('[Enter]');
      await waitFor(() => {
        expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveFocus();
      });
      await user.keyboard('[ArrowRight]');
      const trigger = screen.getByRole('menuitem', { name: 'More' });
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-highlighted');
      });

      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(shadowRoot.querySelector('[data-testid="submenu"]')).not.toBe(null);
      });
      await waitForFocusInside(shadowRoot.querySelector<HTMLElement>('[data-testid="submenu"]')!);
      await user.keyboard('[ArrowLeft]');

      await waitFor(() => {
        expect(shadowRoot.querySelector('[data-testid="submenu"]')).toBe(null);
      });
      expect(screen.getByRole('menuitem', { name: 'First' })).toHaveAttribute('data-highlighted');
    } finally {
      host.remove();
    }
  });
});
