import { Show, createEffect, createSignal, flush, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Autocomplete } from '../autocomplete';
import { Combobox } from '.';
import { useComboboxRootContext } from './root/ComboboxRootContext';
import type { ComboboxStore } from './store';
import { flushMicrotasks } from './test-utils';

/**
 * Characterization tests for how `AriaCombobox` synchronizes external values into the store.
 */
describe('combobox store synchronization', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  /**
   * Every rendered control carrying the form name.
   */
  function namedControls(name: string) {
    return Array.from(document.querySelectorAll(`[name="${name}"]`));
  }

  function StoreProbe(props: { storeRef: { current: ComboboxStore | null } }) {
    // eslint-disable-next-line solid/reactivity
    props.storeRef.current = useComboboxRootContext();
    return null;
  }

  function InlineOwnershipFixture(props: {
    inline: boolean;
    storeRef: { current: ComboboxStore | null };
    children?: JSX.Element;
    withPopupInput?: boolean;
  }) {
    return (
      <Autocomplete.Root items={['alpha', 'beta']} inline={props.inline} name="search">
        <StoreProbe storeRef={props.storeRef} />
        {props.children}
        <Autocomplete.Trigger data-testid="trigger" />
        <Autocomplete.Portal keepMounted>
          <Autocomplete.Positioner>
            <Autocomplete.Popup>
              <Show when={props.withPopupInput ?? true}>
                <Autocomplete.Input data-testid="popup-input" />
              </Show>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
    );
  }

  it('publishes an inline transition in a single store transaction', async () => {
    const storeRef: { current: ComboboxStore | null } = { current: null };
    const [inline, setInline] = createSignal(false);

    render(() => <InlineOwnershipFixture inline={inline()} storeRef={storeRef} />);
    await flushMicrotasks();

    const store = storeRef.current!;

    const snapshots: Array<{ inline: boolean; inputOwnsFormValue: boolean }> = [];
    const unsubscribe = store.subscribe(() => {
      snapshots.push({
        inline: store.state.inline,
        inputOwnsFormValue: store.state.inputOwnsFormValue,
      });
    });

    try {
      setInline(true);
      await flushMicrotasks();
    } finally {
      unsubscribe();
    }

    // Catches a forward split (inline published before ownership).
    expect(snapshots.some((snapshot) => snapshot.inline && !snapshot.inputOwnsFormValue)).toBe(
      false,
    );

    // Catches a reverse-order split (ownership published before inline).
    const changed = snapshots.filter(
      (snapshot, index) =>
        index === 0 ||
        snapshot.inline !== snapshots[index - 1].inline ||
        snapshot.inputOwnsFormValue !== snapshots[index - 1].inputOwnsFormValue,
    );

    expect(changed).toHaveLength(1);
  });

  it('settles inputOwnsFormValue through the reactive path when inline is set', async () => {
    const storeRef: { current: ComboboxStore | null } = { current: null };
    const observed: string[] = [];
    const [inline, setInline] = createSignal(false);

    function OwnershipProbe() {
      const store = useComboboxRootContext();
      createEffect(
        () => `${store.select('inline')}:${store.select('inputOwnsFormValue')}`,
        (value) => {
          observed.push(value);
        },
      );
      return null;
    }

    render(() => (
      <InlineOwnershipFixture inline={inline()} storeRef={storeRef}>
        <OwnershipProbe />
      </InlineOwnershipFixture>
    ));
    await flushMicrotasks();

    observed.length = 0;
    setInline(true);
    await flushMicrotasks();

    expect(observed[observed.length - 1]).toBe('true:true');
  });

  it('exposes real commands to a descendant on mount', async () => {
    // Solid's ref callbacks run before the element is attached, where delegated events don't
    // reach their handlers, so the probe fires as soon as it settles instead.
    const handleOpenChange = vi.fn();
    let dispatched = false;

    function EarliestCommandProbe() {
      let element: HTMLElement | undefined;
      onSettled(() => {
        if (element && !dispatched) {
          dispatched = true;
          element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        }
      });
      return (
        <Autocomplete.Trigger
          data-testid="trigger"
          ref={(el: HTMLElement) => {
            element = el;
          }}
        />
      );
    }

    render(() => (
      <Autocomplete.Root items={['alpha', 'beta']} onOpenChange={handleOpenChange}>
        <EarliestCommandProbe />
        <Autocomplete.Portal>
          <Autocomplete.Positioner>
            <Autocomplete.Popup>
              <Autocomplete.Input />
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
    ));
    await flushMicrotasks();

    expect(dispatched).toBe(true);
    expect(handleOpenChange).toHaveBeenCalled();
    expect(handleOpenChange.mock.calls[0][0]).toBe(true);
  });

  it('gives form value ownership to the hidden input when the input is inside the popup', async () => {
    const storeRef: { current: ComboboxStore | null } = { current: null };
    const [withPopupInput, setWithPopupInput] = createSignal(true);

    render(() => (
      <InlineOwnershipFixture
        inline={false}
        storeRef={storeRef}
        withPopupInput={withPopupInput()}
      />
    ));
    await flushMicrotasks();

    const store = storeRef.current!;

    expect(store.state.inputInsidePopup).toBe(true);
    expect(store.state.inputOwnsFormValue).toBe(false);
    expect(screen.getByTestId('popup-input')).not.toHaveAttribute('name');
    expect(namedControls('search')).toHaveLength(1);
    expect(namedControls('search')[0]).toHaveAttribute('aria-hidden', 'true');

    // Unmounting and remounting the popup input re-runs its ref callback, which is the other
    // writer of `inputOwnsFormValue`.
    setWithPopupInput(false);
    await flushMicrotasks();
    expect(namedControls('search')).toHaveLength(1);

    setWithPopupInput(true);
    await flushMicrotasks();
    expect(store.state.inputOwnsFormValue).toBe(false);
    expect(screen.getByTestId('popup-input')).not.toHaveAttribute('name');
    expect(namedControls('search')).toHaveLength(1);
    expect(namedControls('search')[0]).toHaveAttribute('aria-hidden', 'true');
  });

  // Server rendering and hydration are not covered by the jsdom client test setup.
  it.skip('keeps form value ownership across hydration', () => {});

  describe('interaction anchor', () => {
    it('follows the input, and returns to it after a trigger press or a change of open state', async () => {
      const user = userEvent.setup();
      let store!: ComboboxStore;

      function Probe() {
        store = useComboboxRootContext();
        return null;
      }

      render(() => (
        <Combobox.Root items={['apple', 'banana']}>
          <Probe />
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
      ));
      await flushMicrotasks();

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(store.select('anchorElement')).toBe(input);

      // A trigger press opens the popup, and the anchor stays on the input.
      fireEvent.mouseDown(trigger);
      flush();
      await screen.findByRole('listbox');
      await waitFor(() => {
        expect(store.select('anchorElement')).toBe(input);
      });

      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
      expect(store.select('anchorElement')).toBe(input);

      // Positioning clears the anchor while a closed popup stays mounted; reopening restores it.
      store.clearPositioning();
      flush();
      expect(store.select('anchorElement')).toBe(null);
      await user.click(input);
      await screen.findByRole('listbox');
      expect(store.select('anchorElement')).toBe(input);
    });
  });
});
