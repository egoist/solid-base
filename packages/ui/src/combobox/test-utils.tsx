import { createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Combobox } from '.';
import { useComboboxRootContext } from './root/ComboboxRootContext';
/**
 * Test helpers shared by the Combobox and Autocomplete tests (Solid replacements of
 * `@mui/internal-test-utils`). Add Combobox-specific fixtures here rather than per test file.
 */
export {
  act,
  createRef,
  flushMicrotasks,
  renderWithProps,
  renderWithUser,
  wait,
  waitSingleFrame,
} from '../dialog/test-utils';

/**
 * A combobox whose items shrink to the selected item once the popup finished closing.
 */
export function AsyncItemsCombobox() {
  const [items, setItems] = createSignal(['Apple', 'Banana', 'Cherry']);
  let selectedValue: string | null = null;

  return (
    <Combobox.Root
      items={items()}
      onValueChange={(value: string | null) => {
        selectedValue = value;
      }}
      onOpenChangeComplete={(open) => {
        if (!open && selectedValue) {
          setItems([selectedValue]);
        }
      }}
    >
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
  );
}

export function SelectedIndexProbe() {
  const store = useComboboxRootContext();
  return (
    <div data-testid="selected-index">
      {store.select('selectedIndex') === null ? 'null' : `${store.select('selectedIndex')}`}
    </div>
  );
}

export function ActiveIndexProbe() {
  const store = useComboboxRootContext();
  return (
    <div data-testid="active-index">
      {store.select('activeIndex') === null ? 'null' : `${store.select('activeIndex')}`}
    </div>
  );
}

export function ClearActiveIndexButton() {
  const store = useComboboxRootContext();
  return (
    <button type="button" onClick={() => store.context.setIndices({ activeIndex: null })}>
      Clear highlight
    </button>
  );
}

export function getHiddenControl() {
  // Outside of forms it's `type="hidden"`, which has no role.
  return document.querySelector<HTMLInputElement>('input[aria-hidden="true"]')!;
}

export function MultiplePopupCombobox(props: {
  items?: readonly string[];
  defaultValue?: string[];
  onItemHighlighted?: Combobox.Root.Props<string, true>['onItemHighlighted'];
}): JSX.Element {
  return (
    <Combobox.Root
      items={props.items ?? ['apple', 'banana', 'cherry']}
      multiple
      defaultValue={props.defaultValue ?? ['apple', 'banana']}
      onItemHighlighted={props.onItemHighlighted}
    >
      <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
      <ActiveIndexProbe />
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup>
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

export function isElementOrAncestorInert(element: HTMLElement) {
  let current: HTMLElement | null = element;
  while (current) {
    if (
      current.getAttribute('aria-hidden') === 'true' ||
      current.hasAttribute('inert') ||
      current.hasAttribute('data-base-ui-inert')
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}
