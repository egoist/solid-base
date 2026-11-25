import { createEffect, type Accessor } from 'solid-js';
import { platform } from '@egoist/solid-base-utils/platform';

// Word Joiner is invisible and zero-width, so it forces a text mutation without shifting layout.
const LIVE_REGION_MARKER = '⁠';
// Safari VoiceOver needed roughly 200ms to reliably notice the initial polite live-region change.
export const INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY = 200;

function findLastTextNode(root: HTMLElement): Text | null {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let lastTextNode: Text | null = null;

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    if (textNode.nodeValue !== '') {
      lastTextNode = textNode;
    }
  }

  return lastTextNode;
}

/**
 * Appends an invisible marker to the initial text of a polite live region once it mounts, so
 * screen readers announce text that was present from the start. Returns a ref callback.
 *
 * @param present Whether the live region element is currently rendered.
 */
export function createInitialLiveRegionTextMutation<T extends HTMLElement>(
  present: Accessor<boolean> = () => true,
) {
  let rootElement: T | null = null;

  // Only the initial mounted announcement needs the marker; later text updates announce naturally.
  createEffect(present, (isPresent) => {
    if (!isPresent || platform.os.ios) {
      return undefined;
    }

    const root = rootElement;
    if (root == null) {
      return undefined;
    }

    const textNode = findLastTextNode(root);
    if (textNode == null) {
      return undefined;
    }

    const originalValue = textNode.data;
    const markedValue = `${originalValue}${LIVE_REGION_MARKER}`;
    textNode.nodeValue = markedValue;

    const timeout = setTimeout(() => {
      if (textNode.nodeValue === markedValue) {
        textNode.nodeValue = originalValue;
      }
    }, INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);

    return () => {
      clearTimeout(timeout);
      if (textNode.nodeValue === markedValue) {
        textNode.nodeValue = originalValue;
      }
    };
  });

  return (element: T) => {
    rootElement = element;
  };
}
