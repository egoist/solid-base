import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Errored, flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type userEvent from '@testing-library/user-event';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { Select } from '..';
import { Toolbar } from '../../toolbar';
import type { InteractionType } from '../../utils/popups/interactions/enhancedClickHandler';
import { act, renderWithUser, waitSingleFrame } from '../test-utils';

describe('<Select.Popup />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Select.Root open>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup
                data-testid="popup"
                ref={(el) => {
                  ref = el;
                }}
                class={(state) => (state.open ? 'popup open' : 'popup')}
                style={{ color: 'red' }}
                render={(props, state) => <section {...props} data-state-side={state.side} />}
              />
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      const popup = screen.getByTestId('popup');
      expect(ref).toBe(popup);
      expect(popup.tagName).toBe('SECTION');
      expect(popup).toHaveClass('popup', 'open');
      expect(popup).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(popup).toHaveAttribute('data-state-side', 'none');
      expect(popup).toHaveAttribute('data-open');
    });

    it('renders a div by default', () => {
      render(() => (
        <Select.Root open>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup data-testid="popup" />
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      expect(screen.getByTestId('popup')).toBeInstanceOf(window.HTMLDivElement);
    });
  });

  it('throws a descriptive error when rendered outside <Select.Positioner>', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Select.Root open>
          <Select.Popup />
        </Select.Root>
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent(
      'Base UI: SelectPositionerContext is missing. SelectPositioner parts must be placed within <Select.Positioner>.',
    );
  });

  it('keeps arrow keys inside the popup when the trigger lives in a toolbar', async () => {
    const onToolbarKeyDown = vi.fn();
    const { user } = renderWithUser(() => (
      <Toolbar.Root onKeyDown={onToolbarKeyDown}>
        <Select.Root defaultValue="a">
          <Toolbar.Button render={(props) => <Select.Trigger {...props} data-testid="trigger" />}>
            <Select.Value />
          </Toolbar.Button>
          {/* Rendered inline rather than portaled, so the popup sits inside the toolbar's own
              DOM subtree and its composite key handling actually sees these events. */}
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="a">a</Select.Item>
              <Select.Item value="b">b</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Root>
        <Toolbar.Button data-testid="next">Next</Toolbar.Button>
      </Toolbar.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    await act(async () => {
      trigger.focus();
    });

    // Opening with the keyboard moves focus onto the selected item inside the popup.
    await user.keyboard('{Enter}');
    await screen.findByRole('listbox');
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'a' })).toHaveFocus();
    });

    // Enter isn't a composite key, so opening legitimately reaches the toolbar.
    onToolbarKeyDown.mockClear();

    // A horizontal toolbar navigates with ArrowRight. While the select popup owns focus that key
    // belongs to the popup, so it must not bubble out and move focus off the toolbar button.
    await user.keyboard('{ArrowRight}');

    expect(onToolbarKeyDown).not.toHaveBeenCalled();
    expect(screen.getByTestId('next')).not.toHaveFocus();
  });

  it('moves focus into the items when the boundary item is already highlighted', async () => {
    const { user } = renderWithUser(() => (
      <Select.Root defaultValue="a">
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <button type="button">Select all</button>
              <Select.List>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    await act(async () => screen.getByTestId('trigger').focus());
    await user.keyboard('[Enter]');

    const a = await screen.findByRole('option', { name: 'a' });
    await waitFor(() => expect(a).toHaveAttribute('data-highlighted'));
    await act(async () => screen.getByRole('button', { name: 'Select all' }).focus());
    expect(a).toHaveAttribute('data-highlighted');

    await user.keyboard('[ArrowDown]');
    await waitFor(() => expect(a).toHaveFocus());

    await user.keyboard('[ArrowDown]');
    await waitFor(() => expect(screen.getByRole('option', { name: 'b' })).toHaveFocus());
  });

  it('has aria attributes when no Select.List is present', async () => {
    const { user } = renderWithUser(() => (
      <Select.Root multiple>
        <Select.Trigger>Trigger</Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup data-testid="popup">Popup</Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    const trigger = screen.getByRole('combobox');

    expect(trigger).not.toHaveAttribute('aria-controls');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    const popup = await screen.findByTestId('popup');
    const listbox = await screen.findByRole('listbox');

    expect(popup).toBe(listbox);
    expect(popup.id).not.toBe('');
    expect(popup).toHaveAttribute('aria-multiselectable', 'true');
    expect(trigger).toHaveAttribute('aria-controls', popup.id);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('places aria attributes on Select.List instead if it is present', async () => {
    const { user } = renderWithUser(() => (
      <Select.Root multiple>
        <Select.Trigger>Trigger</Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup data-testid="popup">
              <Select.List data-testid="list">
                <Select.Item value="1">Item 1</Select.Item>
                <Select.Item value="2">Item 2</Select.Item>
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    const trigger = screen.getByRole('combobox');

    expect(trigger).not.toHaveAttribute('aria-controls');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');

    await user.click(trigger);

    const popup = await screen.findByTestId('popup');
    const list = await screen.findByTestId('list');
    const listbox = await screen.findByRole('listbox');

    expect(list).toBe(listbox);
    expect(list).toHaveAttribute('aria-multiselectable');
    expect(popup).toHaveAttribute('role', 'presentation');
    expect(popup).not.toHaveAttribute('aria-multiselectable');
    expect(list.id).not.toBe('');
    expect(trigger).toHaveAttribute('aria-controls', list.id);
    expect(trigger).not.toHaveAttribute('aria-controls', popup.id);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('restores transform-related inline styles after measurement', async () => {
    let popupElement: HTMLElement | null = null;

    render(() => (
      <Select.Root open>
        <Select.Trigger>Trigger</Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup
              ref={(node) => {
                node.style.setProperty('transform', 'translateX(10px)');
                node.style.setProperty('scale', '0.8');
                node.style.setProperty('translate', '1px 2px');
                popupElement = node;
              }}
            >
              <Select.Item value="1">
                <Select.ItemText>Item 1</Select.ItemText>
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    await new Promise<void>(queueMicrotask);
    flush();

    expect(popupElement).not.toBe(null);
    expect(popupElement!.style.getPropertyValue('transform')).toBe('translateX(10px)');
    expect(popupElement!.style.getPropertyValue('scale')).toBe('0.8');
    expect(popupElement!.style.getPropertyValue('translate')).toBe('1px 2px');
  });

  // Skipped: the alignItemWithTrigger geometry tests ('keeps alignItemWithTrigger active at
  // browser zoom', ltr/rtl alignment, reopening, anchor width seeding, 'aligned popup scroll
  // resizing') need real layout; upstream skips them in jsdom too.

  it('does not resize the positioner when the list scrolls before the popup is placed', () => {
    render(() => (
      <Select.Root defaultValue="a">
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Positioner data-testid="positioner">
          <Select.Popup>
            <Select.ScrollUpArrow keepMounted data-testid="up-arrow" />
            <Select.List
              data-testid="list"
              ref={(node) => {
                Object.defineProperty(node, 'scrollTop', { value: 100, configurable: true });
                Object.defineProperty(node, 'scrollHeight', { value: 400, configurable: true });
                Object.defineProperty(node, 'clientHeight', { value: 200, configurable: true });
              }}
            >
              <Select.Item value="a">a</Select.Item>
              <Select.Item value="b">b</Select.Item>
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Root>
    ));

    const positioner = screen.getByTestId('positioner');
    const geometryBefore = {
      height: positioner.style.height,
      top: positioner.style.top,
      bottom: positioner.style.bottom,
    };

    // A closed popup has never been measured, so a stray scroll must neither rewrite the
    // positioner geometry nor light up the scroll arrows.
    fireEvent.scroll(screen.getByTestId('list'));
    flush();

    expect({
      height: positioner.style.height,
      top: positioner.style.top,
      bottom: positioner.style.bottom,
    }).toEqual(geometryBefore);
    expect(screen.getByTestId('up-arrow')).not.toHaveAttribute('data-visible');
  });

  it('passes the keyboard close type of an item press to a finalFocus function', async () => {
    const finalFocus = vi.fn(() => true);

    const { user } = renderWithUser(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">Open</Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup finalFocus={finalFocus}>
              <Select.Item value="a">a</Select.Item>
              <Select.Item value="b">b</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    await act(async () => {
      trigger.focus();
    });
    await user.keyboard('{ArrowDown}');
    await screen.findByRole('listbox');
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'a' })).toHaveFocus();
    });
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
    expect(finalFocus).toHaveBeenLastCalledWith('keyboard');
  });

  // Upstream `popupFocusPropsTests` with `initialFocus: false` (Select.Popup has no
  // `initialFocus` prop), `triggerRole: 'combobox'` and `alwaysMounted: true`.
  describe('prop: finalFocus', () => {
    interface FocusTargets {
      outside: RefObject<HTMLInputElement | null>;
    }

    type FocusPropValue =
      | boolean
      | RefObject<HTMLElement | null>
      | ((interactionType: InteractionType) => boolean | HTMLElement | null | void)
      | undefined;

    function Test(props: { finalFocus?: (targets: FocusTargets) => FocusPropValue }) {
      const outside: RefObject<HTMLInputElement | null> = { current: null };
      const finalFocus = props.finalFocus?.({ outside });
      return (
        <div>
          <input data-testid="outside-before" />
          <Select.Root>
            <Select.Trigger>Open</Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup finalFocus={finalFocus}>
                  <Select.Item value="close">Close</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <input
            data-testid="outside-target"
            ref={(el) => {
              outside.current = el;
            }}
          />
        </div>
      );
    }

    const getTrigger = () => screen.getByRole('combobox');

    function expectClosed() {
      // The popup stays mounted (hidden) after it closes.
      expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('option', { name: 'Close' })).toBe(null);
    }

    async function findClickableClose() {
      const close = await screen.findByRole('option', { name: 'Close' });
      // Positioners ignore pointer events until they have been positioned.
      await waitFor(() => {
        expect(getComputedStyle(close).pointerEvents).not.toBe('none');
      });
      return close;
    }

    async function closeWithPointer(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await findClickableClose());
    }

    function renderTest(ui: () => JSX.Element) {
      return renderWithUser(ui);
    }

    it('focuses the trigger by default', async () => {
      const { user } = renderTest(() => <Test />);

      await user.click(getTrigger());
      await closeWithPointer(user);

      await waitFor(() => {
        expect(getTrigger()).toHaveFocus();
      });
    });

    it('focuses the element of a ref', async () => {
      const { user } = renderTest(() => <Test finalFocus={({ outside }) => outside} />);

      await user.click(getTrigger());
      await closeWithPointer(user);

      await waitFor(() => {
        expect(screen.getByTestId('outside-target')).toHaveFocus();
      });
    });

    it.each([
      {
        name: 'an element',
        returns: ({ outside }: FocusTargets) => outside.current,
        getFocused: () => screen.getByTestId('outside-target'),
      },
      // `true` and `null` keep the default target, so the spy proves the function was consulted.
      { name: 'true', returns: () => true, getFocused: getTrigger },
      { name: 'null', returns: () => null, getFocused: getTrigger },
    ])(
      'focuses the right element when a function returns $name',
      async ({ returns, getFocused }) => {
        const finalFocusSpy = vi.fn();
        const { user } = renderTest(() => (
          <Test
            finalFocus={(targets) => (closeType: InteractionType) => {
              finalFocusSpy(closeType);
              return returns(targets);
            }}
          />
        ));

        await user.click(getTrigger());
        await closeWithPointer(user);

        await waitFor(() => {
          expect(getFocused()).toHaveFocus();
        });
        expect(finalFocusSpy).toHaveBeenCalledTimes(1);
      },
    );

    it('does not move focus when `false`', async () => {
      const { user } = renderTest(() => <Test finalFocus={() => false} />);

      await user.click(getTrigger());
      await closeWithPointer(user);
      await waitFor(() => {
        expectClosed();
      });
      await act(() => waitSingleFrame());

      expect(getTrigger()).not.toHaveFocus();
    });

    it('passes the close type to a function', async () => {
      const finalFocusSpy = vi.fn();

      const { user } = renderTest(() => (
        <Test
          finalFocus={({ outside }) =>
            (closeType: InteractionType) => {
              finalFocusSpy(closeType);
              return closeType === 'keyboard' ? outside.current : true;
            }
          }
        />
      ));

      const trigger = getTrigger();

      await user.click(trigger);
      // user-event's synthetic clicks carry no pointer type, so the mouse press is dispatched
      // directly.
      const close = await findClickableClose();
      fireEvent.pointerDown(close, { pointerType: 'mouse' });
      fireEvent.click(close, { detail: 1 });
      flush();
      await waitFor(() => {
        expectClosed();
      });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
      expect(finalFocusSpy).toHaveBeenNthCalledWith(1, 'mouse');

      await user.click(trigger);
      await findClickableClose();
      await act(() => waitSingleFrame());
      await user.keyboard('[Escape]');
      await waitFor(() => {
        expect(screen.getByTestId('outside-target')).toHaveFocus();
      });
      expect(finalFocusSpy).toHaveBeenNthCalledWith(2, 'keyboard');
      expect(finalFocusSpy).toHaveBeenCalledTimes(2);
    });
  });
});
