import { createEffect, flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Select } from '.';
import { useSelectRootContext } from './root/SelectRootContext';
import { SelectStore, createSelectStoreContext, selectors, type State } from './store';
import { createChangeEventDetails } from '../internals/createBaseUIEventDetails';
import { REASONS } from '../internals/reasons';
import { createInitialPopupStoreState } from '../utils/popups/store';
import { defaultItemEquality } from '../internals/itemEquality';
import { renderWithProps } from './test-utils';

function createState(overrides: Partial<State> = {}): State {
  return {
    ...createInitialPopupStoreState<unknown>(),
    id: undefined,
    labelId: undefined,
    modal: true,
    selectionMode: 'single',
    disabled: false,
    readOnly: false,
    required: false,
    highlightItemOnHover: true,
    itemToStringLabel: undefined,
    itemToStringValue: undefined,
    isItemEqualToValue: defaultItemEquality,
    selectedValue: null,
    items: undefined,
    forceMounted: false,
    openMethod: null,
    activeIndex: null,
    selectedIndex: null,
    triggerElement: null,
    listElement: null,
    popupSide: null,
    scrollUpArrowVisible: false,
    scrollDownArrowVisible: false,
    hasScrollArrows: false,
    ...overrides,
  };
}

describe('select store synchronization', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('publishes synchronized values in a single store transaction', async () => {
    // The Solid store binds these keys to the Root's props: a reactive observer sees them change
    // together, in one flush, instead of upstream's `subscribe` snapshots.
    let store: SelectStore | null = null;
    const snapshots: Array<{ id: string | undefined; modal: boolean; disabled: boolean }> = [];

    function StoreProbe() {
      const current = useSelectRootContext();
      store = current;
      createEffect(
        () => ({
          id: current.select('id'),
          modal: current.select('modal'),
          disabled: current.select('disabled'),
        }),
        (snapshot) => {
          snapshots.push(snapshot);
        },
      );
      return null;
    }

    const { setProps } = renderWithProps(
      (props: { id: string; modal: boolean; disabled: boolean }) => (
        <Select.Root id={props.id} modal={props.modal} disabled={props.disabled}>
          <StoreProbe />
          <Select.Trigger />
        </Select.Root>
      ),
      { id: 'first', modal: true, disabled: false },
    );

    expect(store).not.toBe(null);
    snapshots.length = 0;

    await setProps({ id: 'second', modal: false, disabled: true });

    expect(snapshots.some((snapshot) => snapshot.id === 'second' && snapshot.modal)).toBe(false);
    expect(snapshots.some((snapshot) => snapshot.id === 'first' && !snapshot.modal)).toBe(false);
    expect(snapshots.some((snapshot) => snapshot.id === 'second' && !snapshot.disabled)).toBe(
      false,
    );
    expect(snapshots.some((snapshot) => snapshot.id === 'first' && snapshot.disabled)).toBe(false);
    expect(snapshots).toContainEqual({ id: 'second', modal: false, disabled: true });
  });

  it('provides setOpen to a descendant ref callback on the first commit', () => {
    const handleOpenChange = vi.fn();
    let invoked = false;

    function CommandProbe() {
      const store = useSelectRootContext();

      return (
        <div
          ref={(element) => {
            if (element && !invoked) {
              invoked = true;
              store.setOpen(true, createChangeEventDetails(REASONS.none));
            }
          }}
        />
      );
    }

    render(() => (
      <Select.Root onOpenChange={handleOpenChange}>
        <CommandProbe />
        <Select.Trigger />
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="alpha">alpha</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));
    flush();

    expect(invoked).toBe(true);
    expect(handleOpenChange).toHaveBeenCalled();
    expect(handleOpenChange.mock.calls[0][0]).toBe(true);
    expect(screen.getByRole('listbox')).not.toBe(null);
  });

  // Upstream relies on React re-running a descendant's ref callback on re-render, before the Root
  // synchronizes its props in a layout effect. Solid ref callbacks run once, and the store reads
  // the bound `disabled` prop directly, so there is no such window.
  it.skip('synchronizes an updated disabled prop after descendant ref callbacks', () => {});
});

describe('select store selectors', () => {
  it('hasSelectedValue treats empty and null values as unselected', () => {
    expect(selectors.hasSelectedValue(createState({ selectedValue: null }))).toBe(false);
    expect(selectors.hasSelectedValue(createState({ selectedValue: '' }))).toBe(false);
    expect(selectors.hasSelectedValue(createState({ selectedValue: 'a' }))).toBe(true);
    expect(
      selectors.hasSelectedValue(createState({ selectionMode: 'multiple', selectedValue: [] })),
    ).toBe(false);
    expect(
      selectors.hasSelectedValue(createState({ selectionMode: 'multiple', selectedValue: ['a'] })),
    ).toBe(true);
    expect(
      selectors.hasSelectedValue(
        createState({ selectedValue: { id: 1 }, itemToStringValue: () => '' }),
      ),
    ).toBe(false);
  });

  it('isSelected compares with the comparer, item first', () => {
    const comparer = vi.fn((item: any, value: any) => item.id === value.id);
    const state = createState({
      selectionMode: 'multiple',
      selectedValue: [{ id: 2 }],
      isItemEqualToValue: comparer,
    });
    expect(selectors.isSelected(state, { id: 2, item: true })).toBe(true);
    expect(comparer.mock.calls[0][0]).toEqual({ id: 2, item: true });
    expect(selectors.isSelected(state, { id: 1 })).toBe(false);
  });

  it('isActiveWhileOpen follows the effective open state', () => {
    expect(selectors.isActiveWhileOpen(createState({ activeIndex: 1 }), 1)).toBe(false);
    expect(selectors.isActiveWhileOpen(createState({ activeIndex: 1, open: true }), 1)).toBe(true);
    expect(
      selectors.isActiveWhileOpen(
        createState({ activeIndex: 1, open: false, openProp: true } as Partial<State>),
        1,
      ),
    ).toBe(true);
  });

  it('hasNullItemLabel is only computed when enabled', () => {
    const state = createState({ items: [{ value: null, label: 'None' }] });
    expect(selectors.hasNullItemLabel(state, false)).toBe(false);
    expect(selectors.hasNullItemLabel(state, true)).toBe(true);
  });

  it('anchors to the trigger element and resets highlight state on unmount', () => {
    const store = new SelectStore(createState(), createSelectStoreContext(null), selectors);
    const trigger = document.createElement('button');
    store.set('triggerElement', trigger);
    expect(store.state.anchorElement).toBe(trigger);

    store.update({ activeIndex: 2, scrollUpArrowVisible: true, scrollDownArrowVisible: true });
    store.resetOnUnmount();
    expect(store.state.activeIndex).toBe(null);
    expect(store.state.scrollUpArrowVisible).toBe(false);
    expect(store.state.scrollDownArrowVisible).toBe(false);
  });
});
