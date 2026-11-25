import { createContext, createEffect, createUniqueId, onCleanup, untrack, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { FloatingNodeType, FloatingTreeType } from '../types';
import { FloatingTreeStore } from './FloatingTreeStore';

const FloatingNodeContext = createContext<{ id: string | undefined; parentId: string | null } | null>(
  null,
);
const FloatingTreeContext = createContext<FloatingTreeType | null>(null);

/**
 * Returns the parent node id for nested floating elements, if available.
 * Returns `null` for top-level floating elements.
 */
export function useFloatingParentNodeId(): string | null {
  return useContext(FloatingNodeContext)?.id || null;
}

/**
 * Like `useFloatingParentNodeId`, but returns an accessor that follows the parent node's id
 * (a popup with detached triggers moves to the active trigger's node while it's open).
 */
export function useFloatingParentNodeIdAccessor(): () => string | null {
  const context = useContext(FloatingNodeContext);
  return () => context?.id || null;
}

/**
 * Returns the nearest floating tree, if available.
 */
export function useFloatingTree(externalTree?: FloatingTreeStore): FloatingTreeType | null {
  const contextTree = useContext(FloatingTreeContext);
  return externalTree ?? contextTree;
}

/**
 * Registers a node into the `FloatingTree` for the lifetime of the owner, returning its id.
 * Positioning (`createFloating`) attaches the popup's positioning context to the node.
 */
export function createFloatingNodeId(
  externalTree?: FloatingTreeStore | (() => FloatingTreeStore | undefined),
): string {
  const id = createUniqueId();
  const parentId = useFloatingParentNodeIdAccessor();

  // A tree accessor moves the node to the current tree, like upstream's re-registration when the
  // `tree` dependency changes (a submenu follows its parent menu to a detached trigger's tree).
  if (typeof externalTree === 'function') {
    const contextTree = useFloatingTree();
    const node: FloatingNodeType = {
      id,
      get parentId() {
        return parentId();
      },
    };
    createEffect(
      () => externalTree() ?? contextTree,
      (currentTree) => {
        if (!currentTree) {
          return undefined;
        }
        currentTree.addNode(node);
        return () => currentTree.removeNode(node);
      },
    );
    return id;
  }

  const tree = useFloatingTree(externalTree);

  if (tree) {
    // The parent id is live: upstream re-registers the node whenever its parent id changes.
    const node: FloatingNodeType = {
      id,
      get parentId() {
        return parentId();
      },
    };
    tree.addNode(node);
    onCleanup(() => tree.removeNode(node));
  }

  return id;
}

export interface FloatingNodeProps {
  children?: JSX.Element;
  id: string | undefined;
}

/**
 * Provides parent node context for nested floating elements.
 * @internal
 */
export function FloatingNode(props: FloatingNodeProps): JSX.Element {
  const parentId = useFloatingParentNodeId();
  const value = {
    get id() {
      return props.id;
    },
    parentId,
  };
  return <FloatingNodeContext value={value}>{props.children}</FloatingNodeContext>;
}

export interface FloatingTreeProps {
  children?: JSX.Element;
  externalTree?: FloatingTreeStore | undefined;
}

/**
 * Provides context for nested floating elements when they are not children of each other in the
 * DOM. It is needed for:
 * - The `bubbles` option of `createDismiss()`
 * - Nested virtual list navigation
 * - Nested floating elements that each open on hover
 * - Custom communication between parent and child floating elements (`tree.events`)
 * @internal
 */
export function FloatingTree(props: FloatingTreeProps): JSX.Element {
  // The tree is created once: `externalTree` is read once, like a `default*` prop.
  const tree = untrack(() => props.externalTree) ?? new FloatingTreeStore();
  return <FloatingTreeContext value={tree}>{props.children}</FloatingTreeContext>;
}
