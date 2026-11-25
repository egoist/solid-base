import { createContext, createUniqueId, onCleanup, untrack, useContext } from 'solid-js';
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
export function createFloatingNodeId(externalTree?: FloatingTreeStore): string {
  const id = createUniqueId();
  const tree = useFloatingTree(externalTree);
  const parentId = useFloatingParentNodeId();

  if (tree) {
    const node: FloatingNodeType = { id, parentId };
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
