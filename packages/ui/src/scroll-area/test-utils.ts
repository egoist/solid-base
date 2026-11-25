/**
 * jsdom has no layout: define the metrics the scroll area reads from the viewport.
 * `scrollTop`/`scrollLeft` become plain writable values.
 */
export function mockViewportMetrics(
  viewport: HTMLElement | null | undefined,
  {
    clientWidth = 200,
    clientHeight = 200,
    scrollWidth = 1000,
    scrollHeight = 1000,
    scrollTop = 0,
    scrollLeft = 0,
  }: Partial<
    Record<
      'clientWidth' | 'clientHeight' | 'scrollWidth' | 'scrollHeight' | 'scrollTop' | 'scrollLeft',
      number
    >
  > = {},
) {
  if (!viewport) {
    return;
  }
  Object.defineProperties(viewport, {
    clientWidth: { configurable: true, value: clientWidth },
    clientHeight: { configurable: true, value: clientHeight },
    scrollWidth: { configurable: true, value: scrollWidth },
    scrollHeight: { configurable: true, value: scrollHeight },
    scrollTop: { configurable: true, writable: true, value: scrollTop },
    scrollLeft: { configurable: true, writable: true, value: scrollLeft },
  });
}

/**
 * Defines layout sizes on an element.
 */
export function mockElementSize(
  element: HTMLElement,
  sizes: Partial<Record<'offsetWidth' | 'offsetHeight', number>>,
) {
  for (const [key, value] of Object.entries(sizes)) {
    Object.defineProperty(element, key, { configurable: true, value });
  }
}

/**
 * Replaces the pointer capture methods of an element with an in-memory implementation.
 */
export function mockPointerCapture(element: HTMLElement) {
  let capturedId: number | null = null;
  Object.defineProperties(element, {
    setPointerCapture: {
      configurable: true,
      value: (pointerId: number) => {
        capturedId = pointerId;
      },
    },
    hasPointerCapture: {
      configurable: true,
      value: (pointerId: number) => pointerId === capturedId,
    },
    releasePointerCapture: {
      configurable: true,
      value: (pointerId: number) => {
        if (pointerId === capturedId) {
          capturedId = null;
        }
      },
    },
  });
  return {
    dropCapture() {
      capturedId = null;
    },
  };
}
