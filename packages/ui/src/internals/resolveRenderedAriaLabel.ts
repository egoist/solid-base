interface ResolveRenderedAriaLabelProps {
  'aria-label'?: string | undefined;
}

/**
 * Resolves an element's `aria-label`. In this port, `render` is a tag name or a function that
 * receives the props, so the component prop is the only source. Render callbacks are expected to
 * keep the `aria-labelledby` passed to them in sync with any `aria-label` they add.
 *
 * @internal
 */
export function resolveRenderedAriaLabel(props: ResolveRenderedAriaLabelProps) {
  return props['aria-label'];
}
