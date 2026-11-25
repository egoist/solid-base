import { onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { activeElement, contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { FilterDropdownList } from '../../filter-dropdown/list/FilterDropdownList';
import { mergeProps } from '../../merge-props/mergeProps';
import { createMenuFilterKeyDown } from './useMenuFilterKeyDown';
import { isMainOrientationKey } from '../../utils/popups/interactions/listNavigation';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuList } from '../list/MenuList';
import { useCompositeListContext } from '../../internals/composite/list/CompositeList';
import {
  useFilterDropdownItemContext,
  useFilterDropdownRootContext,
} from '../../filter-dropdown/root/FilterDropdownRootContext';
import { resolvePopupLabel } from '../popup/MenuPopup';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { moveHighlightFrom } from './moveHighlightFrom';
import { refocusOwner } from '../../filter-dropdown/utils/refocusOwner';

/**
 * The list of a filterable menu: it takes the `menu` role while the popup is a dialog holding
 * the input, and it forwards keys that land on it to the input.
 */
export function MenuFilterList(componentProps: MenuList.Props): JSX.Element {
  const rootContext = useMenuRootContext();
  const { store } = rootContext;
  const direction = useDirection();
  const filterContext = useFilterDropdownRootContext();
  const { onItemsChange, focusOwnerRef } = filterContext;
  const { listRef } = useFilterDropdownItemContext();
  const compositeList = useCompositeListContext();

  const handleInputKeyDown = createMenuFilterKeyDown(() => filterContext.value !== '');

  function handleKeyDown(event: KeyboardEvent) {
    const owner = focusOwnerRef.current;
    const target = getTarget(event) as Element;
    const currentTarget = event.currentTarget as HTMLElement;
    const ownerFocused = owner != null && activeElement(ownerDocument(owner)) === owner;
    const fromNestedPopup = !contains(currentTarget, target);
    // Keys the input forwards to its highlighted item arrive here while the input still holds
    // focus, and a nested popup's keys bubble through this component tree from outside the list.
    if (owner == null || ownerFocused || fromNestedPopup) {
      if (
        event.which !== 229 &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        isMainOrientationKey(event.key, rootContext.orientation)
      ) {
        // Keep main-axis keys from reaching this popup's own list navigation, which lost its
        // place while the nested popup held focus. A plain submenu that closes on the key hands
        // focus back and lets it through, so move on from its trigger as a plain parent would.
        event.stopPropagation();
        const trigger = fromNestedPopup && ownerFocused ? getNestedPopupTrigger(target) : undefined;
        if (trigger) {
          moveHighlightFrom(store, trigger, event, {
            orientation: rootContext.orientation,
            rtl: direction() === 'rtl',
            loopFocus: rootContext.loopFocus,
            allowEscape: rootContext.allowEscape,
          });
        }
      }
      return;
    }

    // An item that already acted on the key (Enter and Space activate it) keeps it.
    if (event.defaultPrevented) {
      return;
    }

    // Real focus can land inside the list while the input still owns the keyboard: a scrollbar
    // press focuses the list itself, and a screen reader following `aria-activedescendant`
    // focuses the highlighted item. Hand focus back and route the key as the input would; a
    // typing key's default action follows the moved focus into the input.
    refocusOwner(owner);
    handleInputKeyDown(event);
  }

  // The item whose `aria-controls` popup holds `target`. The popup shares the target's root,
  // which is a shadow root when it's portaled into one.
  function getNestedPopupTrigger(target: Element) {
    const root = target.getRootNode() as Document | ShadowRoot;
    return listRef.current.find((item): item is HTMLElement => {
      const popupId = item?.getAttribute('aria-controls');
      return (
        popupId != null &&
        isHTMLElement(item) &&
        contains(root.getElementById(popupId), target)
      );
    });
  }

  // `null` distinguishes the initial registration from a list emptied by filtering.
  let previousItems: readonly (HTMLElement | null)[] | null = null;

  // The composite list notifies subscribers before its `onMapChange`, so the positioner reports
  // the highlight against the settled registry only after the items change has been resolved.
  function handleItemMapChange() {
    const items = [...listRef.current];
    const changed =
      previousItems === null ||
      previousItems.length !== items.length ||
      items.some((item, index) => item !== previousItems![index]);

    if (changed && previousItems !== null) {
      onItemsChange(previousItems);
    }
    previousItems = items;
  }

  const unsubscribe = compositeList?.subscribeMapChange?.(handleItemMapChange);
  if (unsubscribe) {
    onCleanup(unsubscribe);
  }

  const listProps = mergeProps<MenuList.Props>(
    {
      role: 'menu',
      get 'aria-labelledby'() {
        return resolvePopupLabel(componentProps, null, filterContext.triggerId ?? null);
      },
      get 'aria-orientation'() {
        return rootContext.orientation === 'horizontal' ? 'horizontal' : undefined;
      },
      onKeyDown: handleKeyDown,
    },
    componentProps,
  );

  return <FilterDropdownList {...listProps} />;
}
