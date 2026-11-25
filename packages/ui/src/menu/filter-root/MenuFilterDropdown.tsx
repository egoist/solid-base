import { createEffect, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createControllableSignal } from '@egoist/solid-base-utils/controlled';
import { useMenubarContext } from '../../menubar/MenubarContext';
import { isVirtualPointerEvent } from '../../utils/popups/event';
import { FilterDropdownRoot } from '../../filter-dropdown/root/FilterDropdownRoot';
import { createFilterDropdownCloseQuery } from '../../filter-dropdown/root/createFilterDropdownCloseQuery';
import type { FilterDropdownFilter } from '../../filter-dropdown/root/FilterDropdownRootContext';
import type { FilterDropdownActiveIndexConnection } from '../../filter-dropdown/root/FilterDropdownRoot';
import { useMenuRootContext } from '../root/MenuRootContext';
import { REASONS } from '../../internals/reasons';
import type { BaseUIEvent, HTMLProps } from '../../internals/types';
import type { MenuFilterProvider } from '../filter-provider/MenuFilterProvider';
import { MenuFilterImplContext } from './MenuFilterContext';
import { MENU_FILTER_IMPL } from './MenuFilterImpl';
import { createMenuFilterKeyDown } from './useMenuFilterKeyDown';

export interface MenuFilterDropdownProps {
  value: string | undefined;
  defaultValue: string | undefined;
  onValueChange: MenuFilterProvider.Props['onValueChange'];
  filter: FilterDropdownFilter | null | undefined;
  autoHighlight: boolean | 'always';
  locale: Intl.LocalesArgument | undefined;
  children?: JSX.Element;
}

/**
 * Reads the menu store, which is only available below the menu root, and hands the filter
 * engine the list the menu navigates and the command that moves its highlight. The query is
 * owned here; the menu root keeps sole ownership of the open state.
 */
export function MenuFilterDropdown(props: MenuFilterDropdownProps): JSX.Element {
  const { store } = useMenuRootContext();

  const open = () => store.select('open');
  const mounted = () => store.select('mounted');

  const [value, setValue] = createControllableSignal<string>({
    value: () => props.value,
    defaultValue: () => props.defaultValue ?? '',
  });

  function handleValueChange(nextValue: string, eventDetails: MenuFilterProvider.ChangeEventDetails) {
    props.onValueChange?.(nextValue, eventDetails);
    if (!eventDetails.isCanceled) {
      setValue(nextValue);
    }
  }

  const query = createFilterDropdownCloseQuery({
    open,
    mounted,
    value,
    onValueChange: handleValueChange,
  });

  store.set('filterTriggerProps', createFilterTriggerProps(() => value() !== ''));

  // Only `setOpen` records a keyboard open, so a controlled close that bypasses it must not leave
  // the next programmatic open looking like one.
  createEffect(open, (isOpen) => {
    if (!isOpen) {
      store.set('keyboardOpen', false);
    }
  });

  // The menu shows the highlight the filter resolves. Every highlight write is reported, so a
  // resolved highlight gives way to the next write even when it stores the index already stored.
  function connectActiveIndex(connection: FilterDropdownActiveIndexConnection) {
    const unsubscribe = store.subscribeActiveIndexWrites(connection.written);
    const removeDerivation = store.derive('activeIndex', connection.resolve);
    onCleanup(() => {
      removeDerivation();
      unsubscribe();
    });
  }

  // Trust the rendered element's id once it exists: an explicitly empty id must not fall back to a
  // registered id that no element carries.
  const triggerId = () => {
    const activeTriggerElement = store.select('activeTriggerElement');
    return activeTriggerElement ? activeTriggerElement.id || null : store.select('activeTriggerId');
  };

  return (
    <MenuFilterImplContext value={MENU_FILTER_IMPL}>
      <FilterDropdownRoot
        filter={props.filter}
        autoHighlight={props.autoHighlight}
        locale={props.locale}
        open={open()}
        openedByKeyboard={store.select('keyboardOpen')}
        disabled={store.select('disabled')}
        value={value()}
        query={query()}
        onValueChange={handleValueChange}
        triggerId={triggerId()}
        listRef={store.context.itemDomElements}
        getActiveIndex={() => store.selectStored('activeIndex')}
        setActiveIndex={(index: number | null) => store.setActiveIndex(index, REASONS.none)}
        connectActiveIndex={connectActiveIndex}
        focusOwnerRef={store.context.virtualFocusRef}
      >
        {props.children}
      </FilterDropdownRoot>
    </MenuFilterImplContext>
  );
}

/**
 * The props a filterable menu adds to its triggers: dialog semantics, screen reader press
 * tracking, and a relay of list navigation typed on the trigger to the input, since the input
 * holds real focus while the popup is open.
 */
function createFilterTriggerProps(hasValue: () => boolean): HTMLProps {
  const { store } = useMenuRootContext();
  const isInMenubar = useMenubarContext(true) != null;

  const handleInputKeyDown = createMenuFilterKeyDown(hasValue);

  return {
    'aria-haspopup': 'dialog',
    onPointerDown(event: PointerEvent) {
      store.context.virtualPress = isVirtualPointerEvent(event);
    },
    onKeyDown(event: BaseUIEvent<KeyboardEvent>) {
      const focusOwner = store.context.virtualFocusRef?.current;
      if (!store.select('open') || !focusOwner || isInMenubar) {
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        focusOwner.focus({ preventScroll: true });
        handleInputKeyDown(event);
        event.preventDefault();
        event.preventBaseUIHandler();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        // Cross-axis keys drive submenu open/close, which the trigger must not relay.
        event.preventBaseUIHandler();
      } else if (isTypeaheadKey(event)) {
        focusOwner.focus({ preventScroll: true });
      }
    },
  } as HTMLProps;
}

function isTypeaheadKey(event: KeyboardEvent) {
  return (
    event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey
  );
}
