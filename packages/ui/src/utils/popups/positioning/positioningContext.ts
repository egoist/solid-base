import type { FloatingTreeStore } from '../tree/FloatingTreeStore';
import { useFloatingTree } from '../tree/FloatingTree';
import type { PopupInteractionStore, PopupPositioningContext } from '../types';

export interface CreatePositioningContextOptions {
  /**
   * The id of the popup's node in the floating tree (from `createFloatingNodeId()`).
   */
  nodeId?: string | undefined;
  /**
   * External FloatingTree to use when the one provided by context can't be used.
   */
  externalTree?: FloatingTreeStore | undefined;
  /**
   * Extra live properties to expose on the context (such as `refs`, `x`, `y`, `placement`).
   * Copied as property descriptors, so getters stay live.
   */
  extra?: object | undefined;
}

/**
 * Creates the live positioning context of a popup and publishes it where the interactions look
 * for it: `store.context.positioning`, and the popup's floating tree node (so parents and
 * children in the tree can see its open state and elements).
 *
 * `createFloating()` calls it; popups without positioning (Dialog) don't need it.
 */
export function createPositioningContext(
  store: PopupInteractionStore,
  options: CreatePositioningContextOptions = {},
): PopupPositioningContext {
  const { nodeId, externalTree, extra } = options;
  const tree = useFloatingTree(externalTree);

  const elements = {
    get reference() {
      return store.select('anchor');
    },
    get floating() {
      return store.select('positionerElement');
    },
    get domReference() {
      return store.select('anchorElement');
    },
  };

  const context = {
    get open() {
      return store.select('open');
    },
    nodeId,
    get defaultPopupId() {
      return store.select('defaultPopupId');
    },
    elements,
    rootStore: store,
  } as PopupPositioningContext;

  if (extra) {
    Object.defineProperties(context, Object.getOwnPropertyDescriptors(extra));
  }

  store.context.positioning = context;

  if (tree && nodeId != null) {
    const node = tree.nodesRef.current.find((n) => n.id === nodeId);
    if (node) {
      node.context = context;
    }
  }

  return context;
}
