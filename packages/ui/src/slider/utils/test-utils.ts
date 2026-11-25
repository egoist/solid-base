type Touches = Array<Pick<Touch, 'identifier' | 'clientX' | 'clientY'>>;

export function createTouches(touches: Touches) {
  return {
    changedTouches: touches.map((touch) =>
      // jsdom has no `Touch` constructor: plain objects carry the fields the slider reads.
      typeof Touch === 'undefined'
        ? { target: document.body, ...touch }
        : new Touch({
            target: document.body,
            ...touch,
          }),
    ),
  };
}

export function getHorizontalSliderRect(width = 100) {
  return new DOMRect(0, 0, width, 10);
}
