import { Show, createEffect, createSignal } from 'solid-js';
import { screen, waitFor } from '@solidjs/testing-library';
import { Menu } from '..';
import { act, renderWithUser } from '../test-utils';

// Kept in a separate file so the module mock doesn't leak into `MenuFilterRoot.test.tsx`.
vi.mock('@egoist/solid-base-utils/platform', async () => {
  const actual = await vi.importActual<typeof import('@egoist/solid-base-utils/platform')>(
    '@egoist/solid-base-utils/platform',
  );

  return {
    ...actual,
    platform: {
      ...actual.platform,
      engine: { ...actual.platform.engine, webkit: true },
    },
  };
});

/**
 * Neither Solid nor jsdom acts on `autofocus`; React focuses an `autoFocus` element on mount.
 */
function autoFocusOnMount(element: HTMLElement) {
  queueMicrotask(() => {
    if (element.autofocus) {
      element.focus();
    }
  });
}

function Test(props: { autofocus?: boolean; inputKey?: string; showInput?: boolean }) {
  return (
    <Menu.FilterProvider>
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              {/* A keyed `Show` replaces the input when `inputKey` changes (upstream `key`). */}
              <Show when={props.showInput !== false && (props.inputKey ?? 'input')} keyed>
                {(_key) => (
                  <Menu.Input
                    aria-label="Filter actions"
                    autofocus={props.autofocus}
                    ref={autoFocusOnMount}
                  />
                )}
              </Show>
              <Menu.List>
                <Menu.Item>Apple</Menu.Item>
                <Menu.Item>Banana</Menu.Item>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menu.FilterProvider>
  );
}

describe('<Menu.FilterProvider><Menu.Root/></Menu.FilterProvider> (WebKit)', () => {
  it('marks only the highlighted item while its input is focused in WebKit', async () => {
    const { user } = renderWithUser(() => <Test />);

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    const apple = screen.getByRole('menuitem', { name: 'Apple' });
    const banana = screen.getByRole('menuitem', { name: 'Banana' });
    expect(apple).not.toHaveAttribute('aria-selected');

    await user.keyboard('[ArrowDown]');

    expect(apple).toHaveAttribute('aria-selected', 'true');
    expect(banana).not.toHaveAttribute('aria-selected');
    expect(input).toHaveAttribute('aria-activedescendant', apple.id);

    await user.keyboard('[ArrowDown]');

    expect(apple).not.toHaveAttribute('aria-selected');
    expect(banana).toHaveAttribute('aria-selected', 'true');

    await act(() => input.blur());
    expect(banana).not.toHaveAttribute('aria-selected');

    await act(() => input.focus());
    expect(banana).toHaveAttribute('aria-selected', 'true');
  });

  // React-only: Strict Mode replays effects and refs, which Solid has no equivalent of.
  it.skip('keeps selection state for an auto-focused input in Strict Mode (React-only)', () => {});

  it('keeps selection state when a focused input is replaced', async () => {
    const [inputKey, setInputKey] = createSignal('first');
    const { user } = renderWithUser(() => <Test autofocus inputKey={inputKey()} />);
    await waitFor(() =>
      expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveFocus(),
    );

    await act(() => setInputKey('second'));
    const replacement = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => expect(replacement).toHaveFocus());

    await user.keyboard('[ArrowDown]');
    expect(screen.getByRole('menuitem', { name: 'Apple' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('keeps selection in sync when a focused input is replaced without autofocus', async () => {
    const [inputKey, setInputKey] = createSignal('first');
    const [autofocus, setAutofocus] = createSignal(true);
    const { user } = renderWithUser(() => <Test autofocus={autofocus()} inputKey={inputKey()} />);
    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => expect(input).toHaveFocus());
    await user.keyboard('[ArrowDown]');
    const apple = screen.getByRole('menuitem', { name: 'Apple' });
    expect(apple).toHaveAttribute('aria-selected', 'true');

    await act(() => {
      setAutofocus(false);
      setInputKey('second');
    });
    const replacement = screen.getByRole('searchbox', { name: 'Filter actions' });
    expect(replacement).not.toBe(input);
    // Engines differ in whether they restore focus after removing the old input.
    expect(apple.getAttribute('aria-selected')).toBe(replacement.matches(':focus') ? 'true' : null);
  });

  it('clears selection when the focused input unmounts while the menu stays open', async () => {
    const [showInput, setShowInput] = createSignal(true);
    const { user } = renderWithUser(() => <Test autofocus showInput={showInput()} />);
    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => expect(input).toHaveFocus());
    await user.keyboard('[ArrowDown]');
    const apple = screen.getByRole('menuitem', { name: 'Apple' });
    expect(apple).toHaveAttribute('aria-selected', 'true');

    await act(() => setShowInput(false));
    expect(screen.queryByRole('searchbox', { name: 'Filter actions' })).toBe(null);
    expect(apple).toBeInTheDocument();
    expect(apple).not.toHaveAttribute('aria-selected');
  });

  it('does not restore selection after a focused input unmounts and the menu reopens on hover', async () => {
    const [close, setClose] = createSignal(false);

    function ControlledTest() {
      const [open, setOpen] = createSignal(true);

      createEffect(close, (shouldClose) => {
        if (shouldClose) {
          setOpen(false);
        }
      });

      return (
        <Menu.FilterProvider autoHighlight="always">
          <Menu.Root open={open()} onOpenChange={(next) => setOpen(next)}>
            <Menu.Trigger openOnHover delay={0}>
              Actions
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>Apple</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      );
    }

    const { user } = renderWithUser(() => <ControlledTest />);
    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => expect(input).toHaveFocus());
    expect(screen.getByRole('menuitem', { name: 'Apple' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await act(() => setClose(true));
    await waitFor(() =>
      expect(screen.queryByRole('searchbox', { name: 'Filter actions' })).toBe(null),
    );

    await user.hover(screen.getByRole('button', { name: 'Actions' }));
    const reopenedInput = await screen.findByRole('searchbox', { name: 'Filter actions' });
    expect(reopenedInput).not.toHaveFocus();
    expect(screen.getByRole('menuitem', { name: 'Apple' })).not.toHaveAttribute('aria-selected');
  });

  it('preserves checked state on checkbox and radio items in WebKit', async () => {
    const { user } = renderWithUser(() => (
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.CheckboxItem defaultChecked>Details</Menu.CheckboxItem>
                  <Menu.RadioGroup defaultValue="date">
                    <Menu.RadioItem value="date">Date</Menu.RadioItem>
                  </Menu.RadioGroup>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    const checkbox = screen.getByRole('menuitemcheckbox', { name: 'Details' });
    const radio = screen.getByRole('menuitemradio', { name: 'Date' });
    await waitFor(() => {
      expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveFocus();
    });

    await user.keyboard('[ArrowDown]');
    expect(checkbox).toHaveAttribute('aria-selected', 'true');
    expect(checkbox).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('[ArrowDown]');
    expect(radio).toHaveAttribute('aria-selected', 'true');
    expect(radio).toHaveAttribute('aria-checked', 'true');
  });

  it('marks highlighted links and submenu triggers while their input is focused in WebKit', async () => {
    const { user } = renderWithUser(() => (
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.LinkItem href="#docs">Documentation</Menu.LinkItem>
                  <Menu.FilterProvider>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger>More actions</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.List>
                              <Menu.Item>Share</Menu.Item>
                            </Menu.List>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.FilterProvider>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger>Plain submenu</Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner>
                        <Menu.Popup>
                          <Menu.Item>Copy</Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    const link = screen.getByRole('menuitem', { name: 'Documentation' });
    const submenuTrigger = screen.getByRole('menuitem', { name: 'More actions' });
    const plainSubmenuTrigger = screen.getByRole('menuitem', { name: 'Plain submenu' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    await user.keyboard('[ArrowDown]');
    expect(link).toHaveAttribute('aria-selected', 'true');
    expect(submenuTrigger).not.toHaveAttribute('aria-selected');
    expect(input).toHaveAttribute('aria-activedescendant', link.id);

    await user.keyboard('[ArrowDown]');
    expect(link).not.toHaveAttribute('aria-selected');
    expect(submenuTrigger).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', submenuTrigger.id);

    expect(plainSubmenuTrigger).not.toHaveAttribute('aria-selected');
    await user.keyboard('[ArrowDown]');

    expect(submenuTrigger).not.toHaveAttribute('aria-selected');
    expect(plainSubmenuTrigger).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', plainSubmenuTrigger.id);
  });

  it('marks items inside an opened submenu while its input is focused', async () => {
    const { user } = renderWithUser(() => (
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.FilterProvider>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger>More actions</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Input aria-label="Filter more actions" />
                            <Menu.List>
                              <Menu.Item>Share</Menu.Item>
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

    await waitFor(() => {
      expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveFocus();
    });
    await user.keyboard('[ArrowDown][ArrowRight]');

    const submenuInput = await screen.findByRole('searchbox', { name: 'Filter more actions' });
    await waitFor(() => {
      expect(submenuInput).toHaveFocus();
    });

    const shareItem = screen.getByRole('menuitem', { name: 'Share' });
    const submenuTrigger = screen.getByRole('menuitem', { name: 'More actions' });
    expect(submenuTrigger).not.toHaveAttribute('aria-selected');
    expect(shareItem).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('[ArrowUp]');
    expect(shareItem).not.toHaveAttribute('aria-selected');

    await user.keyboard('[ArrowDown]');

    expect(shareItem).toHaveAttribute('aria-selected', 'true');
    expect(submenuInput).toHaveAttribute('aria-activedescendant', shareItem.id);
  });

  it('leaves plain menu items alone, which navigate with real focus', () => {
    renderWithUser(() => (
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>Apple</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    expect(screen.getByRole('menuitem', { name: 'Apple' })).not.toHaveAttribute('aria-selected');
  });
});
