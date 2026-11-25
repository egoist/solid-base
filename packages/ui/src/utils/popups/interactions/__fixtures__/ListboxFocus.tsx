import { createContext, createSignal, useContext, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import {
  CompositeList,
  createCompositeList,
  useCompositeListItem,
} from '../../../../internals/composite/list/CompositeList';
import { createTestFloating, getItemInteractionProps } from '../../testUtils';
import type { ElementProps } from '../../types';
import { createListNavigation } from '../listNavigation';
import { createTypeahead } from '../typeahead';
import { cleanupRef, getFloatingTestProps } from './helpers';

interface SelectContextValue {
  activeIndex: Accessor<number | null>;
  selectedIndex: Accessor<number | null>;
  interactions: ElementProps[];
  handleSelect: (index: number | null) => void;
}

const SelectContext = createContext<SelectContextValue>();

/** @internal */
function Listbox(props: { children: JSX.Element }) {
  const [activeIndex, setActiveIndex] = createSignal<number | null>(1);
  const [selectedIndex, setSelectedIndex] = createSignal<number | null>(null);

  const { store, refs } = createTestFloating({ open: () => true });

  const elementsRef: RefObject<Array<HTMLElement | null>> = { current: [] };
  const labelsRef: RefObject<Array<string | null>> = { current: [] };

  const handleSelect = (index: number | null) => {
    setSelectedIndex(index);
  };

  function handleTypeaheadMatch(index: number | null) {
    setActiveIndex(index);
  }

  const listNav = createListNavigation(store, {
    listRef: elementsRef,
    get activeIndex() {
      return activeIndex();
    },
    get selectedIndex() {
      return selectedIndex();
    },
    onNavigate: (index) => setActiveIndex(index),
    focusItemOnHover: false,
  });
  const typeahead = createTypeahead(store, {
    listRef: labelsRef,
    get activeIndex() {
      return activeIndex();
    },
    get selectedIndex() {
      return selectedIndex();
    },
    onMatch: handleTypeaheadMatch,
  });
  const interactions = [listNav, typeahead];

  const list = createCompositeList({ elementsRef, labelsRef });

  return (
    <SelectContext value={{ activeIndex, selectedIndex, interactions, handleSelect }}>
      <button onClick={() => setSelectedIndex(1)} data-testid="reference" type="button">
        Select
      </button>
      <div
        id={store.select('defaultPopupId')}
        role="listbox"
        {...getFloatingTestProps(interactions, { ref: cleanupRef(refs.setFloating) })}
      >
        <CompositeList list={list}>{props.children}</CompositeList>
      </div>
    </SelectContext>
  );
}

/** @internal */
function Option(props: { label: string }) {
  const select = useContext(SelectContext);

  const { ref, index } = useCompositeListItem({ label: () => props.label });

  const isActive = () => select.activeIndex() === index();
  const isSelected = () => select.selectedIndex() === index();

  const isFocusable = () =>
    // eslint-disable-next-line no-nested-ternary
    select.activeIndex() !== null
      ? isActive()
      : select.selectedIndex() !== null
        ? isSelected()
        : index() === 0;

  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive() && isSelected() ? 'true' : 'false'}
      tabindex={isFocusable() ? 0 : -1}
      style={{
        background: isActive() ? 'cyan' : '',
        'font-weight': isSelected() ? 'bold' : '',
      }}
      {...getItemInteractionProps(select.interactions, {
        ref,
        onClick: () => select.handleSelect(index()),
      })}
    >
      {props.label}
    </button>
  );
}

/**
 * A listbox whose selection can change from outside (port of Floating UI's `ListboxFocus`
 * fixture).
 * @internal
 */
export function Main() {
  return (
    <Listbox>
      <Option label="Apple" />
      <Option label="Blueberry" />
      <Option label="Watermelon" />
      <Option label="Banana" />
    </Listbox>
  );
}
