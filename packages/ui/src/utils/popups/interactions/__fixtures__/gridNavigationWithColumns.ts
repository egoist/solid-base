import { gridNavigation } from '../gridNavigation';

/**
 * Binds the number of columns of `gridNavigation` (its last, optional argument).
 */
export function gridNavigationWithColumns(cols: number): typeof gridNavigation {
  return (
    event,
    prevIndex,
    listRef,
    orientation,
    loopFocus,
    rtl,
    disabledIndices,
    minIndex,
    maxIndex,
  ) =>
    gridNavigation(
      event,
      prevIndex,
      listRef,
      orientation,
      loopFocus,
      rtl,
      disabledIndices,
      minIndex,
      maxIndex,
      cols,
    );
}
