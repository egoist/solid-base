import type { JSX } from '@solidjs/web';

/**
 * Restores inline styles saved from an element (kebab-case property names).
 */
export function clearStyles(element: HTMLElement | null, originalStyles: Record<string, string>) {
  if (element) {
    for (const [property, value] of Object.entries(originalStyles)) {
      element.style.setProperty(property, value);
    }
  }
}

export const LIST_FUNCTIONAL_STYLES: JSX.CSSProperties = {
  position: 'relative',
  'max-height': '100%',
  'overflow-x': 'hidden',
  'overflow-y': 'auto',
};
