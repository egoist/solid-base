import { createEffect, createSignal, flush, untrack } from 'solid-js';
import { Portal, type JSX } from '@solidjs/web';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Combobox, ComboboxSeparatorDataAttributes } from '..';
import { Popover } from '../../popover';
import { REASONS } from '../../internals/reasons';
import {
  ActiveIndexProbe,
  createRef,
  flushMicrotasks,
  isElementOrAncestorInert,
  renderWithProps,
  renderWithUser,
  wait,
} from '../test-utils';

describe('<Combobox.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  describe('closing before the popup attaches', () => {
    it('unmounts the popup when a layout effect closes it on mount', async () => {
      const onOpenChangeComplete = vi.fn();

      function App() {
        const [open, setOpen] = createSignal(true);
        createEffect(
          () => undefined,
          () => {
            setOpen(false);
          },
        );
        return (
          <Combobox.Root
            open={open()}
            onOpenChange={(next) => setOpen(next)}
            onOpenChangeComplete={onOpenChangeComplete}
          >
            <Combobox.Input />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="apple">Apple</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      render(() => <App />);

      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      expect(screen.queryByRole('listbox', { hidden: true })).toBe(null);
    });

    it('finishes closing when a layout effect closes it right after a press opens it', async () => {
      const onOpenChangeComplete = vi.fn();

      function App() {
        const [open, setOpen] = createSignal(false);
        createEffect(open, (isOpen) => {
          if (isOpen) {
            setOpen(false);
          }
        });
        return (
          <Combobox.Root
            open={open()}
            onOpenChange={(next) => setOpen(next)}
            onOpenChangeComplete={onOpenChangeComplete}
          >
            <Combobox.Input />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="apple">Apple</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      const { user } = renderWithUser(() => <App />);
      await user.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      // The press mounts the list while closed so its items can register; it isn't left closing.
      expect(screen.getByRole('listbox', { hidden: true })).not.toHaveAttribute(
        'data-ending-style',
      );
    });
  });

  it('exposes the orientation attribute rendered by Separator', () => {
    render(() => <Combobox.Separator orientation="vertical" />);

    const separator = screen.getByRole('presentation');
    expect(separator).toHaveAttribute(ComboboxSeparatorDataAttributes.orientation, 'vertical');
  });

  it('forwards class, style, render and ref on parts', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Input
          data-testid="input"
          class={(state) => (state.open ? 'open' : 'closed')}
          style={{ color: 'red' }}
          ref={(el) => {
            ref = el;
          }}
        />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup render={(props) => <section {...props} data-testid="popup" />}>
              <Combobox.List />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByTestId('input');
    expect(ref).toBe(input);
    expect(input).toHaveClass('open');
    expect(input).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(screen.getByTestId('popup').tagName).toBe('SECTION');
  });

  // Upstream's shared `popupConformanceTests`, adapted to the combobox (the input is the trigger,
  // and the List carries the listbox role).
  describe('Popup conformance', () => {
    function ConformanceCombobox(props: {
      root?: Partial<Combobox.Root.Props<string>>;
      popup?: { id?: string };
    }) {
      return (
        <Combobox.Root {...(props.root ?? {})}>
          <Combobox.Input data-testid="trigger" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List data-testid="popup" {...(props.popup ?? {})}>
                  <Combobox.Item value="item">Item</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      );
    }

    const getPopup = () => screen.queryByTestId('popup');
    const getTrigger = () => screen.getByTestId('trigger');

    describe('IME dismissal', () => {
      it('dismisses after a composition is dropped without compositionend', async () => {
        const handleOpenChange = vi.fn();
        const { user } = renderWithUser(() => (
          <ConformanceCombobox root={{ defaultOpen: true, onOpenChange: handleOpenChange }} />
        ));
        const popup = getPopup()!;
        // The positioner is hidden until it has been positioned.
        await waitFor(() => expect(popup).toBeVisible());

        fireEvent.compositionStart(popup);
        getTrigger().focus();
        await user.keyboard('[Escape]');

        await waitFor(() => expect(getPopup()).toBe(null));
        expect(handleOpenChange).toHaveBeenCalledWith(
          false,
          expect.objectContaining({ reason: REASONS.escapeKey }),
        );
      });

      it.each([
        { name: 'isComposing', isComposing: true, keyCode: 27 },
        { name: 'keyCode 229', isComposing: false, keyCode: 229 },
      ])('preserves the popup for an IME Escape identified by $name', async (event) => {
        const handleOpenChange = vi.fn();
        render(() => (
          <ConformanceCombobox root={{ defaultOpen: true, onOpenChange: handleOpenChange }} />
        ));
        const popup = getPopup()!;
        getTrigger().focus();

        fireEvent.keyDown(document.activeElement!, {
          key: 'Escape',
          isComposing: event.isComposing,
          keyCode: event.keyCode,
        });
        await flushMicrotasks();

        await waitFor(() => expect(popup).toBeVisible());
        expect(handleOpenChange).not.toHaveBeenCalled();
      });
    });

    describe('controlled mode', () => {
      it('opens the popup with the `open` prop', async () => {
        const { setProps } = renderWithProps(
          (props: { open: boolean }) => <ConformanceCombobox root={{ open: props.open }} />,
          { open: false },
        );
        expect(getPopup()).toBe(null);

        await setProps({ open: true });
        expect(getPopup()).not.toBe(null);
      });

      it('reports every close request while `open={true}` keeps the popup open', async () => {
        const handleOpenChange = vi.fn();
        const { user } = renderWithUser(() => (
          <ConformanceCombobox root={{ open: true, onOpenChange: handleOpenChange }} />
        ));
        getTrigger().focus();

        await user.keyboard('[Escape]');
        await flushMicrotasks();
        expect(getPopup()).toBeVisible();
        await user.keyboard('[Escape]');

        await waitFor(() => {
          expect(handleOpenChange).toHaveBeenCalledTimes(2);
        });
        expect(handleOpenChange).toHaveBeenNthCalledWith(
          2,
          false,
          expect.objectContaining({ reason: REASONS.escapeKey }),
        );
      });
    });

    describe('prop: defaultOpen', () => {
      it('opens initially and remains uncontrolled', async () => {
        const { user } = renderWithUser(() => <ConformanceCombobox root={{ defaultOpen: true }} />);
        // The positioner is hidden until it has been positioned.
        await waitFor(() => expect(getPopup()).toBeVisible());
        getTrigger().focus();

        await user.keyboard('[Escape]');
        await waitFor(() => expect(getPopup()).toBe(null));
      });

      it('is ignored when `open={false}` is passed', () => {
        render(() => <ConformanceCombobox root={{ defaultOpen: true, open: false }} />);
        expect(getPopup()).toBe(null);
      });

      it('is ignored when `open={true}` is passed, so Escape cannot close', async () => {
        const { user } = renderWithUser(() => (
          <ConformanceCombobox root={{ defaultOpen: true, open: true }} />
        ));
        // The positioner is hidden until it has been positioned.
        await waitFor(() => expect(getPopup()).toBeVisible());
        getTrigger().focus();

        await user.keyboard('[Escape]');
        await flushMicrotasks();
        expect(getPopup()).toBeVisible();
      });
    });

    describe('prop: onOpenChange', () => {
      it('is called with the new open state and the change details', async () => {
        const handleOpenChange = vi.fn();
        const { user } = renderWithUser(() => (
          <ConformanceCombobox root={{ onOpenChange: handleOpenChange }} />
        ));
        expect(handleOpenChange).not.toHaveBeenCalled();

        await user.click(getTrigger());
        await waitFor(() => {
          expect(getPopup()).toBeVisible();
        });
        expect(handleOpenChange).toHaveBeenCalledTimes(1);
        expect(handleOpenChange).toHaveBeenNthCalledWith(
          1,
          true,
          expect.objectContaining({ reason: REASONS.inputPress, trigger: getTrigger() }),
        );

        await user.keyboard('[Escape]');
        await waitFor(() => expect(getPopup()).toBe(null));
        expect(handleOpenChange).toHaveBeenCalledTimes(2);
        expect(handleOpenChange).toHaveBeenNthCalledWith(
          2,
          false,
          expect.objectContaining({ reason: REASONS.escapeKey }),
        );
      });

      it('keeps the popup closed when the open change is canceled', async () => {
        const handleOpenChange = vi.fn(
          (nextOpen: boolean, eventDetails: Combobox.Root.OpenChangeEventDetails) => {
            if (nextOpen) {
              eventDetails.cancel();
            }
          },
        );
        const { user } = renderWithUser(() => (
          <ConformanceCombobox root={{ onOpenChange: handleOpenChange }} />
        ));

        await user.click(getTrigger());
        await waitFor(() => {
          expect(handleOpenChange).toHaveBeenCalledTimes(1);
        });
        await flushMicrotasks();

        expect(handleOpenChange).toHaveBeenNthCalledWith(
          1,
          true,
          expect.objectContaining({ reason: REASONS.inputPress }),
        );
        expect(getPopup()).toBe(null);
        expect(getTrigger()).not.toHaveAttribute('data-popup-open');
      });

      it('is not called when the `close` action is called while closed', async () => {
        const handleOpenChange = vi.fn();
        const actionsRef = createRef<Combobox.Root.Actions>();
        render(() => <ConformanceCombobox root={{ actionsRef, onOpenChange: handleOpenChange }} />);

        actionsRef.current!.close();
        flush();
        await flushMicrotasks();

        expect(handleOpenChange).not.toHaveBeenCalled();
        expect(getTrigger()).not.toHaveAttribute('data-popup-open');
      });

      it('is not called when the `close` action is called after the `open` prop opened and closed the popup', async () => {
        const handleOpenChange = vi.fn();
        const actionsRef = createRef<Combobox.Root.Actions>();
        const { user, setProps } = renderWithProps(
          (props: { open: boolean }) => (
            <ConformanceCombobox
              root={{ actionsRef, onOpenChange: handleOpenChange, open: props.open }}
            />
          ),
          { open: false },
        );

        await user.click(getTrigger());
        await waitFor(() => {
          expect(handleOpenChange).toHaveBeenCalledWith(true, expect.anything());
        });
        await setProps({ open: true });
        await setProps({ open: false });
        await waitFor(() => expect(getPopup()).toBe(null));
        handleOpenChange.mockClear();

        actionsRef.current!.close();
        flush();
        await flushMicrotasks();

        expect(handleOpenChange).not.toHaveBeenCalled();
        expect(getTrigger()).not.toHaveAttribute('data-popup-open');
      });

      it('is called when the `close` action is called while open', async () => {
        const handleOpenChange = vi.fn();
        const actionsRef = createRef<Combobox.Root.Actions>();
        render(() => (
          <ConformanceCombobox
            root={{ actionsRef, defaultOpen: true, onOpenChange: handleOpenChange }}
          />
        ));
        // The positioner is hidden until it has been positioned.
        await waitFor(() => expect(getPopup()).toBeVisible());

        actionsRef.current!.close();
        flush();

        expect(handleOpenChange).toHaveBeenCalledTimes(1);
        expect(handleOpenChange).toHaveBeenNthCalledWith(
          1,
          false,
          expect.objectContaining({ reason: REASONS.imperativeAction }),
        );
        await waitFor(() => expect(getPopup()).toBe(null));
      });
    });

    describe('ARIA attributes', () => {
      it('has the listbox role on the popup', () => {
        render(() => <ConformanceCombobox root={{ open: true }} />);
        expect(getPopup()).toHaveAttribute('role', 'listbox');
      });

      it('has the `aria-controls` attribute on the trigger', () => {
        render(() => <ConformanceCombobox root={{ open: true }} />);
        expect(getTrigger()).toHaveAttribute('aria-controls', getPopup()?.id);
      });

      it('opens on trigger click and sets `aria-expanded` on the trigger', async () => {
        const { user } = renderWithUser(() => <ConformanceCombobox />);
        const trigger = getTrigger();
        expect(getPopup()).toBe(null);
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await user.click(trigger);
        await waitFor(() => {
          expect(getPopup()).toHaveAttribute('role', 'listbox');
        });
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });

      it('has the `aria-haspopup` attribute on the trigger', async () => {
        const { setProps } = renderWithProps(
          (props: { open: boolean }) => <ConformanceCombobox root={{ open: props.open }} />,
          { open: false },
        );
        expect(getTrigger()).toHaveAttribute('aria-haspopup', 'listbox');

        await setProps({ open: true });
        expect(getTrigger()).toHaveAttribute('aria-haspopup', 'listbox');
      });

      it('allows a custom `id` prop', async () => {
        render(() => <ConformanceCombobox root={{ open: true }} popup={{ id: 'TestId' }} />);
        expect(getPopup()).toHaveAttribute('id', 'TestId');
        await waitFor(() => expect(getTrigger()).toHaveAttribute('aria-controls', 'TestId'));
      });
    });

    describe('prop: onOpenChangeComplete', () => {
      it('is not called on mount when closed', async () => {
        const onOpenChangeComplete = vi.fn();
        render(() => <ConformanceCombobox root={{ onOpenChangeComplete }} />);
        await flushMicrotasks();

        expect(onOpenChangeComplete).not.toHaveBeenCalled();
      });

      it('is called on open and close when there are no animations', async () => {
        const onOpenChangeComplete = vi.fn();
        const { setProps } = renderWithProps(
          (props: { open: boolean }) => (
            <ConformanceCombobox root={{ open: props.open, onOpenChangeComplete }} />
          ),
          { open: false },
        );

        await setProps({ open: true });
        await waitFor(() => {
          expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
        });
        await setProps({ open: false });
        await waitFor(() => expect(getPopup()).toBe(null));
        await waitFor(() => {
          expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
        });
        expect(onOpenChangeComplete.mock.calls).toEqual([[true], [false]]);
      });
    });

    // Upstream also covers hover triggers (not applicable), React commit counting with
    // `React.Profiler` (React-only) and CSS animations (no animations in jsdom).
  });

  // Upstream's shared `popupListConformanceTests` (virtual focus, selectable, no Home/End,
  // `listEnd: 'escape'`), adapted to the combobox. Tests relying on layout/scrolling are omitted.
  describe('Popup list conformance', () => {
    const ITEMS = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'];

    function renderList(
      options: {
        root?: Partial<Combobox.Root.Props<string>>;
        disabledItems?: string[];
        onItemClick?: (event: MouseEvent) => void;
        onSubmit?: (event: SubmitEvent) => void;
      } = {},
    ) {
      return renderWithUser(() => (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            options.onSubmit?.(event);
          }}
        >
          <Combobox.Root items={ITEMS} {...(options.root ?? {})}>
            <Combobox.Input data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup data-testid="popup">
                  <Combobox.List data-testid="scroller">
                    {(item: string) => (
                      <Combobox.Item
                        value={item}
                        disabled={(options.disabledItems ?? []).includes(item)}
                        onClick={(event) => options.onItemClick?.(event)}
                      >
                        <span>{item}</span>
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <button type="button" data-testid="after">
            After
          </button>
        </form>
      ));
    }

    const getTrigger = () => screen.getByTestId('trigger');
    const getItem = (index: number) => screen.getByRole('option', { name: ITEMS[index] });
    function getHighlightedIndex() {
      const highlighted = screen
        .queryAllByRole('option')
        .filter((item) => item.hasAttribute('data-highlighted'));
      if (highlighted.length > 1) {
        throw new Error(`${highlighted.length} items are highlighted.`);
      }
      return highlighted.length ? ITEMS.indexOf(highlighted[0].textContent ?? '') : -1;
    }

    async function waitForOpen() {
      await waitFor(() => expect(getTrigger()).toHaveAttribute('aria-expanded', 'true'));
      await waitFor(() => expect(screen.getAllByRole('option')[0]).toBeVisible());
      await flushMicrotasks();
    }

    async function openWithKeyboard(user: ReturnType<typeof renderWithUser>['user']) {
      getTrigger().focus();
      await user.keyboard('{ArrowDown}');
      await waitForOpen();
      await waitFor(() => expect(getHighlightedIndex()).not.toBe(-1));
      return getHighlightedIndex();
    }

    async function expectFocusOnItem(index: number) {
      await waitFor(() => {
        expect(getTrigger()).toHaveAttribute('aria-activedescendant', getItem(index).id);
      });
      expect(getTrigger()).toHaveFocus();
    }

    async function expectNoHighlight() {
      await waitFor(() => expect(getHighlightedIndex()).toBe(-1));
      expect(getTrigger()).not.toHaveAttribute('aria-activedescendant');
    }

    describe('pointer', () => {
      it('highlights the hovered item', async () => {
        const { user } = renderList();
        await user.click(getTrigger());
        await waitForOpen();

        await user.hover(getItem(2));
        await waitFor(() => expect(getHighlightedIndex()).toBe(2));
        await expectFocusOnItem(2);
      });

      it('continues keyboard navigation from the hovered item', async () => {
        const { user } = renderList();
        await user.click(getTrigger());
        await waitForOpen();

        await user.hover(getItem(1));
        await waitFor(() => expect(getHighlightedIndex()).toBe(1));
        await user.keyboard('{ArrowDown}');
        await waitFor(() => expect(getHighlightedIndex()).toBe(2));
      });

      it('activates the hovered item with Enter', async () => {
        const onValueChange = vi.fn();
        const { user } = renderList({ root: { onValueChange } });
        await user.click(getTrigger());
        await waitForOpen();

        await user.hover(getItem(3));
        await waitFor(() => expect(getHighlightedIndex()).toBe(3));
        await user.keyboard('{Enter}');

        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange.mock.calls[0][0]).toBe('Date');
      });

      it('does not activate a disabled item', async () => {
        const onValueChange = vi.fn();
        const { user } = renderList({ root: { onValueChange }, disabledItems: ['Banana'] });
        await user.click(getTrigger());
        await waitForOpen();

        await user.click(getItem(1));
        await flushMicrotasks();

        expect(onValueChange).not.toHaveBeenCalled();
        expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
      });
    });

    describe('opening', () => {
      it('starts without a highlight after a pointer opening', async () => {
        const { user } = renderList();
        await user.click(getTrigger());
        await waitForOpen();
        await expectNoHighlight();
      });

      it('opens on the first item with ArrowDown', async () => {
        const { user } = renderList();
        expect(await openWithKeyboard(user)).toBe(0);
        await expectFocusOnItem(0);
      });

      it('opens on the last item with ArrowUp', async () => {
        const { user } = renderList();
        getTrigger().focus();
        await user.keyboard('{ArrowUp}');
        await waitForOpen();
        await waitFor(() => expect(getHighlightedIndex()).toBe(ITEMS.length - 1));
      });

      it('opens past a disabled first item', async () => {
        const { user } = renderList({ disabledItems: ['Apple'] });
        expect(await openWithKeyboard(user)).toBe(1);
      });

      it('starts fresh when reopened after Escape', async () => {
        const { user } = renderList();
        await openWithKeyboard(user);
        await user.keyboard('{ArrowDown}');
        await waitFor(() => expect(getHighlightedIndex()).toBe(1));
        await user.keyboard('{Escape}');
        await waitFor(() => expect(getTrigger()).toHaveAttribute('aria-expanded', 'false'));

        expect(await openWithKeyboard(user)).toBe(0);
      });

      it.each(['{ArrowDown}', '{ArrowUp}'])('opens on the selected item with %s', async (key) => {
        const { user } = renderList({ root: { defaultValue: 'Cherry' } });
        getTrigger().focus();
        await user.keyboard(key);
        await waitForOpen();
        await waitFor(() => expect(getHighlightedIndex()).toBe(2));
      });

      it('marks only the selected item as selected', async () => {
        const { user } = renderList({ root: { defaultValue: 'Cherry' } });
        await user.click(getTrigger());
        await waitForOpen();
        const selected = screen
          .getAllByRole('option')
          .filter((item) => item.getAttribute('aria-selected') === 'true');
        expect(selected).toEqual([getItem(2)]);
      });
    });

    describe('keyboard', () => {
      it('moves the highlight one item at a time with the arrow keys', async () => {
        const { user } = renderList();
        await openWithKeyboard(user);
        await user.keyboard('{ArrowDown}');
        await waitFor(() => expect(getHighlightedIndex()).toBe(1));
        await user.keyboard('{ArrowDown}');
        await waitFor(() => expect(getHighlightedIndex()).toBe(2));
        await user.keyboard('{ArrowUp}');
        await waitFor(() => expect(getHighlightedIndex()).toBe(1));
        await expectFocusOnItem(1);
      });

      it('activates the highlighted item once with Enter', async () => {
        const activated: string[] = [];
        const onValueChange = vi.fn();
        const { user } = renderList({
          root: { onValueChange },
          onItemClick: (event) => activated.push((event.currentTarget as HTMLElement).textContent!),
        });
        await openWithKeyboard(user);
        await user.keyboard('{ArrowDown}');
        await waitFor(() => expect(getHighlightedIndex()).toBe(1));
        await user.keyboard('{Enter}');

        expect(activated).toEqual(['Banana']);
        expect(onValueChange).toHaveBeenCalledTimes(1);
      });

      it('does not submit a surrounding form', async () => {
        const onSubmit = vi.fn();
        const { user } = renderList({ onSubmit });
        await openWithKeyboard(user);
        await user.keyboard('{Enter}');
        await flushMicrotasks();

        expect(onSubmit).not.toHaveBeenCalled();
      });

      it('stops on a disabled item while navigating', async () => {
        const { user } = renderList({ disabledItems: ['Banana'] });
        await openWithKeyboard(user);
        await user.keyboard('{ArrowDown}');
        await waitFor(() => expect(getHighlightedIndex()).toBe(1));
      });
    });

    describe('list boundaries', () => {
      it('escapes to the input past the first item', async () => {
        const { user } = renderList();
        await openWithKeyboard(user);
        await user.keyboard('{ArrowUp}');
        await expectNoHighlight();
      });

      it('escapes to the input past the last item', async () => {
        const { user } = renderList();
        await openWithKeyboard(user);
        for (let i = 0; i < ITEMS.length - 1; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          await user.keyboard('{ArrowDown}');
        }
        await waitFor(() => expect(getHighlightedIndex()).toBe(ITEMS.length - 1));
        await user.keyboard('{ArrowDown}');
        await expectNoHighlight();
      });
    });

    describe('dismissal', () => {
      it('closes on Escape without committing, and keeps focus on the trigger', async () => {
        const onValueChange = vi.fn();
        const { user } = renderList({ root: { onValueChange } });
        await openWithKeyboard(user);
        await user.keyboard('{Escape}');
        await waitFor(() => expect(getTrigger()).toHaveAttribute('aria-expanded', 'false'));

        expect(onValueChange).not.toHaveBeenCalled();
        expect(getTrigger()).toHaveFocus();
      });

      it('closes on an outside press without committing', async () => {
        const onValueChange = vi.fn();
        const { user } = renderList({ root: { onValueChange } });
        await openWithKeyboard(user);
        await user.click(screen.getByTestId('after'));
        await waitFor(() => expect(getTrigger()).toHaveAttribute('aria-expanded', 'false'));

        expect(onValueChange).not.toHaveBeenCalled();
      });
    });
  });

  describe('IME composition', () => {
    // Browsers report keyCode 229 for every keydown an IME handles, including the committing Enter.
    it('does not select the highlighted item with an Enter that commits IME text', async () => {
      const onValueChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Combobox.Root items={['a', 'b', 'c']} onValueChange={onValueChange}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      input.focus();
      await user.keyboard('{ArrowDown}');
      const optionA = await screen.findByRole('option', { name: 'a' });
      await waitFor(() => {
        expect(optionA).toHaveAttribute('data-highlighted');
      });

      fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, which: 229 });
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(optionA).toHaveAttribute('data-highlighted');
    });

    it('does not move the highlight with arrow keys that pick an IME candidate', async () => {
      const { user } = renderWithUser(() => (
        <Combobox.Root items={['a', 'b', 'c']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      input.focus();
      await user.keyboard('{ArrowDown}');
      const optionA = await screen.findByRole('option', { name: 'a' });
      await waitFor(() => {
        expect(optionA).toHaveAttribute('data-highlighted');
      });

      // Chrome reports keys handled by an active IME composition with keyCode 229.
      fireEvent.keyDown(input, { key: 'ArrowDown', keyCode: 229, which: 229 });
      await flushMicrotasks();

      expect(optionA).toHaveAttribute('data-highlighted');
    });
  });

  it('calls onOpenChangeComplete after the closed popup resets the input', async () => {
    const calls: string[] = [];
    const { user } = renderWithUser(() => (
      <Combobox.Root
        onInputValueChange={(value) => calls.push(`inputValueChange:${value}`)}
        onOpenChangeComplete={(open) => calls.push(`openChangeComplete:${open}`)}
      >
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="apple">apple</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    await user.type(screen.getByTestId('input'), 'ap');
    await waitFor(() => expect(calls).toContain('openChangeComplete:true'));
    calls.length = 0;

    await user.click(document.body);
    await waitFor(() => expect(calls).toContain('openChangeComplete:false'));
    expect(calls).toEqual(['inputValueChange:', 'openChangeComplete:false']);
  });

  describe('manual unmount lifecycle', () => {
    type PopupProps = Pick<
      Combobox.Root.Props<string>,
      'open' | 'defaultOpen' | 'onOpenChange' | 'onOpenChangeComplete' | 'actionsRef'
    >;

    function Popup(props: PopupProps) {
      const [open, setOpen] = createSignal(untrack(() => props.defaultOpen) ?? false);
      return (
        <Combobox.Root
          actionsRef={props.actionsRef}
          onOpenChangeComplete={props.onOpenChangeComplete}
          open={props.open ?? open()}
          onOpenChange={(nextOpen, details) => {
            props.onOpenChange?.(nextOpen, details);
            if (!details.isCanceled) {
              setOpen(nextOpen);
            }
          }}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">Apple</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      );
    }

    const closeCalls = (fn: ReturnType<typeof vi.fn>) =>
      fn.mock.calls.filter(([open]) => !open).length;

    it('automatically unmounts with an actions ref and completes closing once', async () => {
      const actionsRef = createRef<Combobox.Root.Actions>();
      const onOpenChangeComplete = vi.fn();
      const { user } = renderWithUser(() => (
        <Popup actionsRef={actionsRef} onOpenChangeComplete={onOpenChangeComplete} />
      ));

      expect(onOpenChangeComplete).not.toHaveBeenCalled();
      await user.click(screen.getByRole('combobox'));
      await screen.findByRole('listbox');
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(closeCalls(onOpenChangeComplete)).toBe(1);

      // Calling the action after the automatic unmount must not repeat the completion.
      actionsRef.current!.unmount();
      flush();
      expect(closeCalls(onOpenChangeComplete)).toBe(1);
    });

    it('keeps the popup mounted until the unmount action completes closing', async () => {
      const actionsRef = createRef<Combobox.Root.Actions>();
      const onOpenChangeComplete = vi.fn();
      const { user, setProps } = renderWithProps(
        (props: { open?: boolean }) => (
          <Popup
            defaultOpen
            open={props.open}
            actionsRef={actionsRef}
            onOpenChangeComplete={onOpenChangeComplete}
            onOpenChange={(open, details) => {
              if (!open) {
                details.preventUnmountOnClose();
              }
            }}
          />
        ),
        {},
      );

      await user.click(screen.getByRole('option'));
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      actionsRef.current!.unmount();
      flush();
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(closeCalls(onOpenChangeComplete)).toBe(1);

      await setProps({ open: true });
      await screen.findByRole('listbox');
      await setProps({ open: false });
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(closeCalls(onOpenChangeComplete)).toBe(2);
    });

    it('clears the opt-out when a controlled reopen interrupts a pending unmount', async () => {
      const onOpenChangeComplete = vi.fn();
      const { user, setProps } = renderWithProps(
        (props: { open?: boolean }) => (
          <Popup
            defaultOpen
            open={props.open}
            onOpenChangeComplete={onOpenChangeComplete}
            onOpenChange={(open, details) => {
              if (!open) {
                details.preventUnmountOnClose();
              }
            }}
          />
        ),
        {},
      );

      await user.click(screen.getByRole('option'));
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      await setProps({ open: true });
      await setProps({ open: false });
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(closeCalls(onOpenChangeComplete)).toBe(1);
    });

    it('ignores an opt-out on a canceled close', async () => {
      let cancel = true;
      const { user } = renderWithUser(() => (
        <Popup
          defaultOpen
          onOpenChange={(open, details) => {
            if (!open && cancel) {
              details.preventUnmountOnClose();
              details.cancel();
            }
          }}
        />
      ));

      await user.click(screen.getByRole('option'));
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByRole('listbox')).not.toBe(null);
      cancel = false;
      await user.click(screen.getByRole('option'));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
    });

    it('keeps the opt-out when a controlled close is applied later', async () => {
      const actionsRef = createRef<Combobox.Root.Actions>();
      const onOpenChangeComplete = vi.fn();
      function App() {
        const [open, setOpen] = createSignal(true);
        return (
          <Popup
            open={open()}
            actionsRef={actionsRef}
            onOpenChangeComplete={onOpenChangeComplete}
            onOpenChange={(nextOpen, details) => {
              if (!nextOpen) {
                details.preventUnmountOnClose();
              }
              // Upstream applies the close in `React.startTransition`.
              queueMicrotask(() => setOpen(nextOpen));
            }}
          />
        );
      }

      const { user } = renderWithUser(() => <App />);
      await user.click(screen.getByRole('option'));
      await waitFor(() =>
        expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false'),
      );
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

      actionsRef.current!.unmount();
      flush();
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(closeCalls(onOpenChangeComplete)).toBe(1);
    });

    it('closes through the `close` action so `onOpenChange` can opt out', () => {
      const actionsRef = createRef<Combobox.Root.Actions>();
      const reasons: string[] = [];
      render(() => (
        <Popup
          defaultOpen
          actionsRef={actionsRef}
          onOpenChange={(open, details) => {
            reasons.push(details.reason);
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />
      ));

      actionsRef.current!.close();
      flush();
      expect(reasons).toEqual([REASONS.imperativeAction]);
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).not.toBe(null);

      actionsRef.current!.unmount();
      flush();
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('ignores `unmount` while the popup is open', () => {
      const actionsRef = createRef<Combobox.Root.Actions>();
      const onOpenChangeComplete = vi.fn();
      render(() => (
        <Popup defaultOpen actionsRef={actionsRef} onOpenChangeComplete={onOpenChangeComplete} />
      ));
      const popup = screen.getByRole('listbox');

      actionsRef.current!.unmount();
      flush();

      expect(screen.getByRole('listbox')).toBe(popup);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    });

    it('unmounts when `close` and `unmount` are called in one batch', () => {
      const actionsRef = createRef<Combobox.Root.Actions>();
      const onOpenChangeComplete = vi.fn();
      render(() => (
        <Popup
          defaultOpen
          actionsRef={actionsRef}
          onOpenChangeComplete={onOpenChangeComplete}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />
      ));

      actionsRef.current!.close();
      actionsRef.current!.unmount();
      flush();

      expect(screen.queryByRole('listbox')).toBe(null);
      expect(closeCalls(onOpenChangeComplete)).toBe(1);
    });

    it('still unmounts on a later close after `unmount` was called while open', async () => {
      const actionsRef = createRef<Combobox.Root.Actions>();
      const onOpenChangeComplete = vi.fn();
      const { user } = renderWithUser(() => (
        <Popup defaultOpen actionsRef={actionsRef} onOpenChangeComplete={onOpenChangeComplete} />
      ));

      // A stale exit-animation callback can call `unmount()` after a quick reopen.
      actionsRef.current!.unmount();
      flush();
      expect(screen.queryByRole('listbox')).not.toBe(null);

      screen.getByRole('combobox').focus();
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
    });

    it('still unmounts on a later close after `unmount` and a reopen in one batch', async () => {
      const actionsRef = createRef<Combobox.Root.Actions>();
      const onOpenChangeComplete = vi.fn();
      let reopenOnComplete = true;
      let optOut = true;
      function App() {
        const [open, setOpen] = createSignal(true);
        return (
          <Popup
            open={open()}
            actionsRef={actionsRef}
            onOpenChange={(nextOpen, details) => {
              if (!nextOpen && optOut) {
                details.preventUnmountOnClose();
              }
              setOpen(nextOpen);
            }}
            onOpenChangeComplete={(nextOpen) => {
              onOpenChangeComplete(nextOpen);
              // An exit-animation callback that reopens right after it unmounts.
              if (!nextOpen && reopenOnComplete) {
                reopenOnComplete = false;
                setOpen(true);
              }
            }}
          />
        );
      }

      const { user } = renderWithUser(() => <App />);
      actionsRef.current!.close();
      flush();
      expect(screen.queryByRole('listbox')).not.toBe(null);

      actionsRef.current!.unmount();
      flush();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(closeCalls(onOpenChangeComplete)).toBe(1);

      optOut = false;
      await user.click(screen.getByRole('option'));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(closeCalls(onOpenChangeComplete)).toBe(2);
    });

    it('completes closing once when `unmount` is called twice in one batch', async () => {
      const actionsRef = createRef<Combobox.Root.Actions>();
      const onOpenChangeComplete = vi.fn();
      const { user } = renderWithUser(() => (
        <Popup
          defaultOpen
          actionsRef={actionsRef}
          onOpenChangeComplete={onOpenChangeComplete}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />
      ));

      await user.click(screen.getByRole('option'));
      expect(screen.queryByRole('listbox')).not.toBe(null);

      actionsRef.current!.unmount();
      actionsRef.current!.unmount();
      flush();
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(closeCalls(onOpenChangeComplete)).toBe(1);
    });
  });

  // Upstream renders these with `renderToString` (no hydration). Here they check the initial
  // client render, before the input or trigger registered themselves.
  describe('server-side rendering', () => {
    it('sets combobox aria attributes on the input', () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('sets combobox aria attributes on the trigger when input is inside popup', () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger" />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      expect(trigger).toHaveAttribute('role', 'combobox');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    });

    // Checks server HTML before hydration (`renderToString`); not reproducible in a client render.
    it.skip('does not link Combobox.Label to trigger before hydration', () => {});
  });

  it('does not focus input when closing via trigger click (input inside popup)', async () => {
    const { user } = renderWithUser(() => (
      <Combobox.Root items={['One', 'Two', 'Three']}>
        <Combobox.Trigger data-testid="trigger">
          <Combobox.Value />
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup aria-label="Demo">
              <Combobox.Input data-testid="input" aria-label="combobox-input" />
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    await user.click(trigger);

    expect(await screen.findByRole('listbox')).not.toBe(null);

    const input = await screen.findByRole('combobox', { name: 'combobox-input' });
    await waitFor(() => expect(input).toHaveFocus());

    await user.click(trigger);
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  describe('input inside popup composition', () => {
    function InsidePopupCombobox(props: {
      items?: string[];
      root?: Partial<Combobox.Root.Props<string>>;
      children?: JSX.Element;
    }) {
      return (
        <Combobox.Root items={props.items ?? ['Apple', 'Banana', 'Cherry']} {...(props.root ?? {})}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value placeholder="Select a fruit" />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup aria-label="Fruits">
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      );
    }

    it('selects with the keyboard, restores focus, and resets the query on reopen', async () => {
      const { user } = renderWithUser(() => <InsidePopupCombobox />);

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      const input = await screen.findByTestId('input');
      await waitFor(() => expect(input).toHaveFocus());

      await user.type(input, 'ban');
      await user.keyboard('{ArrowDown}{Enter}');

      await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
      expect(trigger).toHaveFocus();
      expect(trigger).toHaveTextContent('Banana');

      await user.click(trigger);

      const reopenedInput = await screen.findByTestId('input');
      expect(reopenedInput).toHaveValue('');

      const banana = await screen.findByRole('option', { name: 'Banana' });
      expect(banana).toHaveAttribute('aria-selected', 'true');
      await waitFor(() => expect(banana).toHaveAttribute('data-highlighted'));
    });

    it('discards an uncommitted query on Escape and preserves the selection', async () => {
      const onValueChange = vi.fn();
      const { user } = renderWithUser(() => (
        <InsidePopupCombobox root={{ defaultValue: 'Apple', onValueChange }} />
      ));

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);
      await user.type(await screen.findByTestId('input'), 'ban');
      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
      expect(trigger).toHaveFocus();
      expect(trigger).toHaveTextContent('Apple');
      expect(onValueChange).not.toHaveBeenCalled();

      await user.click(trigger);

      expect(await screen.findByTestId('input')).toHaveValue('');
      expect(await screen.findByRole('option', { name: 'Apple' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(await screen.findByRole('option', { name: 'Banana' })).not.toBe(null);
    });

    it('keeps filtering responsive when the selection close is canceled', async () => {
      const { user } = renderWithUser(() => (
        <InsidePopupCombobox
          items={['Apple', 'Apricot', 'Banana']}
          root={{
            onOpenChange: (open, eventDetails) => {
              if (!open) {
                eventDetails.cancel();
              }
            },
          }}
        />
      ));

      await user.click(screen.getByTestId('trigger'));
      const input = await screen.findByTestId('input');
      await user.type(input, 'ap');
      await user.click(screen.getByRole('option', { name: 'Apple' }));

      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(screen.getByTestId('trigger')).toHaveTextContent('Apple');

      await user.clear(input);
      await user.type(input, 'ba');

      expect(await screen.findByRole('option', { name: 'Banana' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'Apple' })).toBe(null);
    });

    // Needs a running CSS close animation (no animations in jsdom).
    it.skip('clears a single-select query and restores the selection when reopening during the close animation', () => {});

    // Needs a running CSS close animation (no animations in jsdom).
    it.skip('preserves a typed query when input reopens single-select during the close animation', () => {});
  });

  it('does not aria-hide the input group when the input is outside the popup', async () => {
    const { user } = renderWithUser(() => (
      <Combobox.Root items={['apple', 'banana']}>
        <Combobox.InputGroup data-testid="group">
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger>Open</Combobox.Trigger>
        </Combobox.InputGroup>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="apple">apple</Combobox.Item>
                <Combobox.Item value="banana">banana</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByTestId('input');
    const group = screen.getByTestId('group');

    await user.click(input);
    expect(await screen.findByRole('listbox')).not.toBe(null);
    await flushMicrotasks();

    expect(input).toHaveFocus();
    expect(group).not.toHaveAttribute('aria-hidden', 'true');
  });

  it('dismisses the popup when clicking a plain wrapper around the input', async () => {
    const { user } = renderWithUser(() => (
      <Combobox.Root items={['apple', 'banana']}>
        <div style={{ padding: '10px' }}>
          <span data-testid="pad">padding</span>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger>Open</Combobox.Trigger>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="apple">apple</Combobox.Item>
                <Combobox.Item value="banana">banana</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('listbox')).not.toBe(null);

    await user.click(screen.getByTestId('pad'));

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBe(null);
    });
  });

  it('does not dismiss when pressing portalled content inside the popup but outside the list', async () => {
    const { user } = renderWithUser(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Trigger>Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Input />
              <Combobox.List>
                <Combobox.Item value="apple">Apple</Combobox.Item>
              </Combobox.List>
              <Portal mount={document.body}>
                <div>Portalled content</div>
              </Portal>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    await user.click(screen.getByText('Portalled content'));

    expect(screen.getByRole('listbox')).not.toBe(null);
  });

  it('does not navigate the list with arrow keys from portalled controls inside the popup', () => {
    render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Trigger>Open</Combobox.Trigger>
        <ActiveIndexProbe />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Input />
              <Combobox.List>
                <Combobox.Item value="apple">Apple</Combobox.Item>
              </Combobox.List>
              <Portal mount={document.body}>
                <button type="button">Portalled control</button>
              </Portal>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const portalledControl = screen.getByRole('button', { name: 'Portalled control' });
    portalledControl.focus();
    fireEvent.keyDown(portalledControl, { key: 'ArrowDown' });
    flush();

    expect(screen.getByTestId('active-index')).toHaveTextContent('null');
  });

  it('does not dismiss when pressing content inside a nested popover', async () => {
    const { user } = renderWithUser(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Trigger>Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Input />
              <Combobox.List>
                <Combobox.Item value="apple">Apple</Combobox.Item>
              </Combobox.List>
              <Popover.Root>
                <Popover.Trigger>Open nested popover</Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Popup>
                      <button type="button">Nested focusable content</button>
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    await user.click(screen.getByRole('button', { name: 'Open nested popover' }));

    await user.click(await screen.findByRole('button', { name: 'Nested focusable content' }));

    expect(screen.getByRole('listbox')).not.toBe(null);
  });

  it('wraps modal focus from popup controls back to the input', async () => {
    const { user } = renderWithUser(() => (
      <Combobox.Root defaultOpen modal>
        <Combobox.Trigger>Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Input />
              <button type="button">Extra control</button>
              <Combobox.List>
                <Combobox.Item value="apple">Apple</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    const extraControl = screen.getByRole('button', { name: 'Extra control' });

    // Let the opening focus management (scheduled in animation frames) settle first.
    await waitFor(() => expect(screen.getByRole('listbox')).toBeVisible());
    await wait(50);
    input.focus();
    await user.tab();
    expect(extraControl).toHaveFocus();

    await user.tab();
    await waitFor(() => expect(input).toHaveFocus());
  });

  it('does not cause infinite re-renders when items becomes undefined', async () => {
    const [items, setItems] = createSignal<string[] | undefined>([]);
    render(() => (
      <Combobox.Root items={items()} defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    setItems(undefined);
    flush();
    await flushMicrotasks();

    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
  });

  it('hides the trigger when popup is open with input outside the popup', async () => {
    const { user } = renderWithUser(() => (
      <div>
        <button data-testid="outside">Outside</button>
        <Combobox.Root items={['Apple', 'Banana']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </div>
    ));

    await user.click(screen.getByTestId('input'));

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBe(null);
    });

    const outside = screen.getByTestId('outside');
    const trigger = screen.getByTestId('trigger');

    await waitFor(() => {
      expect(isElementOrAncestorInert(outside)).toBe(true);
    });

    expect(isElementOrAncestorInert(trigger)).toBe(true);
  });

  it('does not render the start dismiss button while closed', () => {
    render(() => (
      <Combobox.Root items={['Apple', 'Banana']}>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBe(null);
  });

  it('renders internal dismiss buttons before the input and after the popup', async () => {
    const { user } = renderWithUser(() => (
      <div>
        <button data-testid="outside">Outside</button>
        <Combobox.Root defaultOpen modal items={['Apple', 'Banana']}>
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup data-testid="popup" aria-label="Demo">
                <Combobox.Input aria-label="Combobox input" />
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </div>
    ));

    const popup = screen.getByTestId('popup');
    const input = screen.getByRole('combobox', { name: 'Combobox input' });
    const [startDismissButton, endDismissButton] = screen.getAllByRole('button', {
      name: 'Dismiss',
    });
    const outside = screen.getByTestId('outside');

    expect(input.previousElementSibling).toBe(startDismissButton);
    expect(popup.nextElementSibling).toBe(endDismissButton);
    expect(startDismissButton).not.toHaveAttribute('tabindex');
    expect(endDismissButton).not.toHaveAttribute('tabindex');

    await waitFor(() => {
      expect(isElementOrAncestorInert(outside)).toBe(true);
    });

    await user.click(endDismissButton);

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBe(null);
    });
  });

  it('renders an internal dismiss button for the input-outside-popup pattern', async () => {
    const { user } = renderWithUser(() => (
      <Combobox.Root items={['Apple', 'Banana']}>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    await user.click(screen.getByTestId('input'));

    const popup = await screen.findByTestId('popup');
    const input = screen.getByTestId('input');
    const [startDismissButton, endDismissButton] = screen.getAllByRole('button', {
      name: 'Dismiss',
    });

    expect(input.previousElementSibling).toBe(startDismissButton);
    expect(popup.nextElementSibling).toBe(endDismissButton);
    expect(startDismissButton).not.toHaveAttribute('tabindex');
    expect(endDismissButton).not.toHaveAttribute('tabindex');

    await user.click(startDismissButton);

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBe(null);
    });
  });
});
