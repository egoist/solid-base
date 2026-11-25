import { getComputedStyle } from '@floating-ui/utils/dom';

export function getOffset(
  element: Element | null | undefined,
  prop: 'margin' | 'padding',
  axis: 'x' | 'y',
): number {
  if (!element) {
    return 0;
  }

  const styles = getComputedStyle(element);
  const key = `${prop}${axis === 'x' ? 'Inline' : 'Block'}` as const;
  // Environments without logical properties support (jsdom) report empty strings.
  const start = parseFloat(styles[`${key}Start`]) || 0;

  // Safari misreports `marginInlineEnd` in RTL.
  // We have to assume the start/end values are symmetrical, which is likely.
  if (axis === 'x' && prop === 'margin') {
    return start * 2;
  }

  return start + (parseFloat(styles[`${key}End`]) || 0);
}
