import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Menu } from '..';
import { act, flushMicrotasks, renderWithUser } from '../test-utils';
import { renderWithProps } from '../../dialog/test-utils';

describe('<Menu.List />', () => {
  it('replays keys from an item that holds real focus and activates on Enter', async () => {
    const onClick = vi.fn();
    const { user } = renderWithUser(() => (
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Rename</Menu.Item>
                  <Menu.Item onClick={onClick}>Delete</Menu.Item>
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
    await user.keyboard('[ArrowDown]');
    const rename = screen.getByRole('menuitem', { name: 'Rename' });
    const del = screen.getByRole('menuitem', { name: 'Delete' });
    expect(input).toHaveAttribute('aria-activedescendant', rename.id);

    // A screen reader following `aria-activedescendant` moves real focus onto the item.
    await act(() => rename.focus());
    await user.keyboard('[ArrowDown]');

    await waitFor(() => {
      expect(input).toHaveAttribute('aria-activedescendant', del.id);
    });
    expect(input).toHaveFocus();

    await act(() => del.focus());
    await user.keyboard('[Enter]');

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('');
  });

  it('clears the highlight when focus returns to the input from an item', async () => {
    const { user } = renderWithUser(() => (
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
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
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    await user.keyboard('[ArrowDown]');
    const rename = screen.getByRole('menuitem', { name: 'Rename' });
    expect(input).toHaveAttribute('aria-activedescendant', rename.id);

    // A screen reader parks real focus on the item, then the user moves back to the input.
    await act(() => rename.focus());
    await act(() => input.focus());

    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(rename).not.toHaveAttribute('data-highlighted');
  });

  it('keeps the highlight when focus returns to the input with autoHighlight="always"', async () => {
    renderWithUser(() => (
      <Menu.FilterProvider autoHighlight="always">
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
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
    const rename = screen.getByRole('menuitem', { name: 'Rename' });
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-activedescendant', rename.id);
    });

    await act(() => rename.focus());
    await act(() => input.focus());

    expect(input).toHaveAttribute('aria-activedescendant', rename.id);
  });

  it('keeps virtual focus on the input without making the list tabbable', async () => {
    const { user } = renderWithUser(() => (
      <Menu.FilterProvider>
        <Menu.Root open>
          <Menu.Trigger>Fruit</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter fruit" />
                <Menu.List data-testid="list">
                  <Menu.Item>Apple</Menu.Item>
                  <Menu.Item>Banana</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    const input = screen.getByRole('searchbox', { name: 'Filter fruit' });
    const list = screen.getByTestId('list');
    const apple = screen.getByRole('menuitem', { name: 'Apple' });

    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    expect(list).not.toHaveAttribute('aria-hidden');
    expect(list).toHaveAttribute('tabindex', '-1');
    expect(apple).toHaveAttribute('tabindex', '-1');
    expect(apple).not.toHaveAttribute('aria-expanded');

    await user.keyboard('[ArrowDown]');
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-activedescendant', apple.id);
    });
    expect(input).toHaveFocus();
  });

  describe('keys on a focused list', () => {
    function App(props: { onPress?: (() => void) | undefined }) {
      return (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Fruit</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter fruit" />
                  <Menu.List data-testid="list">
                    <Menu.Item onClick={() => props.onPress?.()}>Apple</Menu.Item>
                    <Menu.Item>Banana</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      );
    }

    // Focus the list takes from the input goes straight back to it, so start from focus that
    // reached the list another way, such as a screen reader or a touch press.
    function focusList(list: HTMLElement) {
      screen.getByRole('searchbox', { name: 'Filter fruit' }).blur();
      list.focus();
    }

    it('replays navigation keys on the input instead of scrolling', async () => {
      renderWithUser(() => <App />);

      const input = screen.getByRole('searchbox', { name: 'Filter fruit' });
      const list = screen.getByTestId('list');
      const apple = screen.getByRole('menuitem', { name: 'Apple' });

      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      await act(() => focusList(list));
      expect(list).toHaveFocus();

      const scrolls = fireEvent.keyDown(list, { key: 'ArrowDown' });

      expect(scrolls).toBe(false);
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', apple.id);
      });
      expect(input).toHaveFocus();
    });

    it('commits the highlighted item when Enter lands on the list', async () => {
      const onPress = vi.fn();
      const { user } = renderWithUser(() => <App onPress={onPress} />);

      const input = screen.getByRole('searchbox', { name: 'Filter fruit' });
      const list = screen.getByTestId('list');
      const apple = screen.getByRole('menuitem', { name: 'Apple' });

      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', apple.id);
      });

      await act(() => focusList(list));
      fireEvent.keyDown(list, { key: 'Enter' });

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('still closes the menu with Escape', async () => {
      renderWithUser(() => <App />);

      const list = screen.getByTestId('list');

      await waitFor(() => {
        expect(screen.getByRole('searchbox', { name: 'Filter fruit' })).toHaveFocus();
      });
      await act(() => focusList(list));
      fireEvent.keyDown(list, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });
    });

    it('hands typing keys back to the input', async () => {
      renderWithUser(() => <App />);

      const input = screen.getByRole('searchbox', { name: 'Filter fruit' });
      const list = screen.getByTestId('list');

      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      await act(() => focusList(list));

      const types = fireEvent.keyDown(list, { key: 'z' });

      // Not canceled, so the native default action types into the refocused input.
      expect(types).toBe(true);
      expect(input).toHaveFocus();
    });
  });
});

describe('filterable menu list semantics', () => {
  function TestMenu(props: { secondId?: string; orientation?: Menu.Root.Orientation }) {
    return (
      <Menu.FilterProvider autoHighlight="always">
        <Menu.Root defaultOpen orientation={props.orientation}>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item id="first-item">First</Menu.Item>
                  <Menu.Item id={props.secondId}>Second</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    );
  }

  it('reads an item id when navigating to it', async () => {
    const { user, setProps } = renderWithProps(TestMenu, { secondId: 'old-id' });
    const input = screen.getByRole('searchbox');
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', 'first-item'));
    await waitFor(() => expect(input).toHaveFocus());
    await setProps({ secondId: 'new-id' });
    await user.keyboard('[ArrowDown]');
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', 'new-id'));
  });

  it('exposes horizontal navigation on the menu instead of the dialog', async () => {
    const { user } = renderWithUser(() => (
      <TestMenu orientation="horizontal" secondId="second-item" />
    ));
    const input = screen.getByRole('searchbox');
    expect(screen.getByRole('menu')).toHaveAttribute('aria-orientation', 'horizontal');
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-orientation');
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', 'first-item'));
    await waitFor(() => expect(input).toHaveFocus());
    await user.keyboard('[ArrowRight]');
    expect(input).toHaveAttribute('aria-activedescendant', 'second-item');
  });

  describe('horizontal list without autoHighlight', () => {
    function HorizontalMenu(props: { defaultOpen?: boolean }) {
      return (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen={props.defaultOpen} orientation="horizontal">
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item id="alpha">Alpha</Menu.Item>
                    <Menu.Item id="apple">Apple</Menu.Item>
                    <Menu.Item id="beta">Beta</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      );
    }

    it('enters the results with the vertical arrows after typing', async () => {
      const { user } = renderWithUser(() => <HorizontalMenu defaultOpen />);
      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => expect(input).toHaveFocus());

      await user.type(input, 'p');
      await waitFor(() => expect(screen.queryByText('Beta')).toBe(null));
      await flushMicrotasks();

      // Left and Right keep moving the caret while nothing is highlighted.
      await user.keyboard('[ArrowLeft]');
      expect(input).not.toHaveAttribute('aria-activedescendant');

      await user.keyboard('[ArrowDown]');
      expect(input).toHaveAttribute('aria-activedescendant', 'alpha');
      await user.keyboard('[ArrowRight]');
      expect(input).toHaveAttribute('aria-activedescendant', 'apple');
      await user.keyboard('[ArrowLeft]');
      expect(input).toHaveAttribute('aria-activedescendant', 'alpha');
    });

    it('enters the results from the end with ArrowUp', async () => {
      const { user } = renderWithUser(() => <HorizontalMenu defaultOpen />);
      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => expect(input).toHaveFocus());

      await user.keyboard('[ArrowUp]');
      expect(input).toHaveAttribute('aria-activedescendant', 'beta');
    });

    it('highlights the first item when opened from the trigger with ArrowDown', async () => {
      const { user } = renderWithUser(() => <HorizontalMenu />);
      const trigger = screen.getByRole('button', { name: 'Actions' });
      await act(() => trigger.focus());

      await user.keyboard('[ArrowDown]');

      const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', 'alpha'));
    });
  });
});

describe('<Menu.List /> in a plain menu', () => {
  function PlainMenu(props: { orientation?: Menu.Root.Props['orientation']; listId?: string }) {
    return (
      <Menu.Root orientation={props.orientation}>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="popup">
              <div>Header</div>
              <Menu.List data-testid="list" id={props.listId}>
                <Menu.Item data-testid="item-1">Rename</Menu.Item>
                <Menu.Item data-testid="item-2">Delete</Menu.Item>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    );
  }

  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.List
                data-testid="list"
                ref={(el) => {
                  ref = el;
                }}
                class="list"
                style={{ color: 'red' }}
                render={(props) => <section {...props} />}
              />
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    const list = screen.getByTestId('list');
    expect(ref).toBe(list);
    expect(list.tagName).toBe('SECTION');
    expect(list).toHaveClass('list');
    expect(list.style.color).toBe('red');
  });

  it('takes the menu role and label from the popup', async () => {
    const { user } = renderWithUser(() => <PlainMenu />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    await user.click(trigger);

    const list = await screen.findByTestId('list');
    expect(list).toHaveAttribute('role', 'menu');
    expect(list).toHaveAttribute('aria-labelledby', trigger.id);
    expect(screen.getByTestId('popup')).toHaveAttribute('role', 'presentation');
    expect(screen.getByTestId('popup')).not.toHaveAttribute('aria-labelledby');
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-controls', list.id);
    });
  });

  it('updates the trigger when the open list changes its id', async () => {
    const { user, setProps } = renderWithProps(PlainMenu, { listId: 'old-list' } as {
      listId?: string;
    });
    const trigger = screen.getByRole('button', { name: 'Actions' });

    await user.click(trigger);
    await screen.findByTestId('list');
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-controls', 'old-list');
    });

    await setProps({ listId: 'new-list' });
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-controls', 'new-list');
    });
  });

  it('renders the orientation on the list', async () => {
    const { user } = renderWithUser(() => <PlainMenu orientation="horizontal" />);

    await user.click(screen.getByRole('button', { name: 'Actions' }));

    const list = await screen.findByTestId('list');
    expect(list).toHaveAttribute('aria-orientation', 'horizontal');
    expect(screen.getByTestId('popup')).not.toHaveAttribute('aria-orientation');
  });

  it('navigates the items with the keyboard', async () => {
    const { user } = renderWithUser(() => <PlainMenu />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    await act(() => trigger.focus());
    await user.keyboard('[Enter]');

    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });

    await user.keyboard('[ArrowDown]');

    await waitFor(() => {
      expect(screen.getByTestId('item-2')).toHaveFocus();
    });
  });

  it('focuses the list rather than the presentational popup on a pointer open', async () => {
    const { user } = renderWithUser(() => <PlainMenu />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    fireEvent.mouseDown(trigger, { detail: 1 });
    fireEvent.click(trigger, { detail: 1 });

    const list = await screen.findByTestId('list');
    await waitFor(() => {
      expect(list).toHaveFocus();
    });

    await user.keyboard('[ArrowDown]');

    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });
  });

  it('does not point an inactive trigger at the list', async () => {
    function TwoTriggers() {
      const handle = Menu.createHandle();
      return (
        <>
          <Menu.Trigger handle={handle}>First</Menu.Trigger>
          <Menu.Trigger handle={handle}>Second</Menu.Trigger>
          <Menu.Root handle={handle}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.List data-testid="list">
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </>
      );
    }

    const { user } = renderWithUser(() => <TwoTriggers />);
    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });

    await user.click(first);

    const list = await screen.findByTestId('list');
    await waitFor(() => {
      expect(first).toHaveAttribute('aria-controls', list.id);
    });
    expect(second).not.toHaveAttribute('aria-controls');
  });

  // Omitted: 'does not re-render an inactive trigger when the list mounts' counts React render
  // passes; Solid components run once.

  it('enters the list from the end with ArrowUp after a pointer open without looping', async () => {
    const { user } = renderWithUser(() => (
      <Menu.Root loopFocus={false}>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.List data-testid="list">
                <Menu.Item>Rename</Menu.Item>
                <Menu.Item>Duplicate</Menu.Item>
                <Menu.Item>Delete</Menu.Item>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    const list = await screen.findByTestId('list');
    await waitFor(() => {
      expect(list).toHaveFocus();
    });

    await user.keyboard('[ArrowUp]');

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    });
  });
});
