import { describe, expect, it } from 'vitest';
import { createRefObject } from '@egoist/solid-base-utils/refObject';
import { createInitialPopupStoreState, createPopupStoreContext } from '../store';
import type { PopupOpenChangeEventDetails } from '../store';
import {
  ValuePopupStore,
  valuePopupSelectors,
  type ValuePopupContext,
  type ValuePopupState,
} from './ValuePopupStore';

class TestValuePopupStore extends ValuePopupStore<
  ValuePopupState,
  ValuePopupContext<PopupOpenChangeEventDetails>,
  typeof valuePopupSelectors,
  PopupOpenChangeEventDetails
> {
  constructor() {
    super(
      {
        ...createInitialPopupStoreState<unknown>(),
        id: undefined,
        labelId: undefined,
        isItemEqualToValue: Object.is,
        selectedValue: null,
        selectionMode: 'single',
        forceMounted: false,
        openMethod: null,
        activeIndex: null,
        selectedIndex: null,
        triggerElement: null,
        listElement: null,
        popupSide: null,
        disabled: false,
        readOnly: false,
        required: false,
        modal: false,
      },
      {
        ...createPopupStoreContext(),
        listRef: createRefObject<Array<HTMLElement | null>>([]),
        labelsRef: createRefObject<Array<string | null>>([]),
        valuesRef: createRefObject<Array<any>>([]),
      },
      valuePopupSelectors,
    );
  }

  protected getAnchorElement(state: Readonly<ValuePopupState>) {
    return state.triggerElement;
  }
}

describe('ValuePopupStore', () => {
  it('anchors to the element returned by `getAnchorElement`', () => {
    const store = new TestValuePopupStore();
    const trigger = document.createElement('button');

    store.set('triggerElement', trigger);
    expect(store.state.anchorElement).toBe(trigger);
    expect(store.select('anchor')).toBe(trigger);
  });

  it('restores the anchor element when the open state or the positioner changes', () => {
    const store = new TestValuePopupStore();
    const trigger = document.createElement('button');
    const other = document.createElement('button');
    store.set('triggerElement', trigger);

    // A press on another element moves the anchor away.
    store.set('anchorElement', other);
    expect(store.state.anchorElement).toBe(other);

    store.set('open', true);
    expect(store.state.anchorElement).toBe(trigger);

    store.set('anchorElement', other);
    store.set('positionerElement', document.createElement('div'));
    expect(store.state.anchorElement).toBe(trigger);
  });

  it('does not anchor to the active trigger', () => {
    const store = new TestValuePopupStore();
    const trigger = document.createElement('button');
    const activeTrigger = document.createElement('button');
    store.set('triggerElement', trigger);

    store.update({ mounted: true, activeTriggerElement: activeTrigger });
    expect(store.state.anchorElement).toBe(trigger);
    expect(store.select('anchor')).toBe(trigger);
  });

  it('prefers the anchor override', () => {
    const store = new TestValuePopupStore();
    const trigger = document.createElement('button');
    const override = document.createElement('div');
    store.update({ triggerElement: trigger, anchorOverride: override });

    expect(store.select('anchor')).toBe(override);
    expect(store.select('isActive', 2)).toBe(false);
    store.set('activeIndex', 2);
    expect(store.select('isActive', 2)).toBe(true);
  });
});
