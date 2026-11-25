import type { Accessor } from 'solid-js';
import { isElementDisabled } from '@egoist/solid-base-utils/isElementDisabled';
import { useCompositeRootContext } from '../root/CompositeRootContext';
import { useCompositeListItem } from '../list/CompositeList';
import type { HTMLProps } from '../../types';

export interface CreateCompositeItemParameters<Metadata> {
  metadata?: Metadata | undefined;
}

export interface CreateCompositeItemReturnValue {
  compositeProps: HTMLProps;
  compositeRef: (element: HTMLElement) => void;
  index: Accessor<number>;
  highlighted: Accessor<boolean>;
}

/**
 * Registers an item in the closest composite root and gives it roving `tabindex` behavior.
 */
export function createCompositeItem<Metadata>(
  params: CreateCompositeItemParameters<Metadata> = {},
): CreateCompositeItemReturnValue {
  const root = useCompositeRootContext();
  const { ref, index } = useCompositeListItem({ metadata: params.metadata });
  let item: HTMLElement | null = null;

  const highlighted = () => {
    const currentIndex = index();
    return currentIndex !== -1 && root.highlightedIndex() === currentIndex;
  };

  const compositeProps: HTMLProps = {
    get tabindex() {
      return highlighted() ? 0 : -1;
    },
    onFocus() {
      const currentIndex = index();
      if (currentIndex !== -1) {
        root.onHighlightedIndexChange(currentIndex);
      }
    },
    onMouseMove() {
      if (!root.highlightItemOnHover() || !item) {
        return;
      }
      if (!highlighted() && !isElementDisabled(item)) {
        item.focus();
      }
    },
  };

  return {
    compositeProps,
    compositeRef(element) {
      item = element;
      ref(element);
    },
    index,
    highlighted,
  };
}
