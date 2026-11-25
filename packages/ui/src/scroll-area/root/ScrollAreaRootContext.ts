import { createContext, useContext, type Accessor } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type {
  Coords,
  HiddenState,
  OverflowEdges,
  Size,
  ScrollAreaRootState,
} from './ScrollAreaRoot';

export interface ScrollAreaRootContext {
  cornerSize: Accessor<Size>;
  setCornerSize: (size: Size) => void;
  thumbSize: Accessor<Size>;
  setThumbSize: (size: Size) => void;
  hasMeasuredScrollbar: Accessor<boolean>;
  setHasMeasuredScrollbar: (measured: boolean) => void;
  touchModality: Accessor<boolean>;
  hovering: Accessor<boolean>;
  setHovering: (hovering: boolean) => void;
  scrollingX: Accessor<boolean>;
  scrollingY: Accessor<boolean>;
  viewportRef: RefObject<HTMLDivElement | null>;
  scrollbarYRef: RefObject<HTMLDivElement | null>;
  thumbYRef: RefObject<HTMLDivElement | null>;
  scrollbarXRef: RefObject<HTMLDivElement | null>;
  thumbXRef: RefObject<HTMLDivElement | null>;
  cornerRef: RefObject<HTMLDivElement | null>;
  handlePointerDown: (event: PointerEvent & { currentTarget: Element }) => void;
  handlePointerMove: (event: PointerEvent) => void;
  handlePointerUp: (event: PointerEvent) => void;
  handleScroll: (scrollPosition: Coords) => void;
  disableViewportSnap: () => void;
  rootId: Accessor<string>;
  hiddenState: Accessor<HiddenState>;
  setHiddenState: (state: HiddenState) => void;
  overflowEdges: Accessor<OverflowEdges>;
  setOverflowEdges: (edges: OverflowEdges) => void;
  viewportState: ScrollAreaRootState;
  overflowEdgeThreshold: Accessor<OverflowEdges<number>>;
}

export const ScrollAreaRootContext = createContext<ScrollAreaRootContext | null>(null);

export function useScrollAreaRootContext() {
  const context = useContext(ScrollAreaRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: ScrollAreaRootContext is missing. ScrollArea parts must be placed within <ScrollArea.Root>.',
    );
  }
  return context;
}
