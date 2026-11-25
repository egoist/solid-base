import { createEffect, onCleanup, untrack, type Accessor } from 'solid-js';

interface ResolveRenderedIdProps {
  id?: string | undefined;
}

/**
 * Resolves an element's id. In this port, `render` is a tag name or a function that receives the
 * props (and is expected to use the id passed to it), so the component's `id` prop wins over the
 * fallback. Returns `''` when the element renders with an explicitly empty id, which consumers
 * must treat as "no id" rather than falling back to the generated one.
 */
export function resolveRenderedId(props: ResolveRenderedIdProps, fallbackId: string | undefined) {
  return props.id ?? fallbackId;
}

/**
 * Resolves the element's id and returns a ref that publishes it to the owner while mounted.
 * A generated fallback is never published as an override, so removing an explicit id lets the
 * element return to the generated one.
 */
export function createRenderedId(
  props: ResolveRenderedIdProps,
  defaultId: Accessor<string | undefined>,
  setId: ((id: string | undefined) => void) | undefined,
): readonly [Accessor<string | undefined>, (element: Element) => void] {
  const id = () => resolveRenderedId(props, defaultId());
  const registeredId = () => {
    const current = id();
    return current === defaultId() ? undefined : current;
  };

  let mounted = false;

  createEffect(registeredId, (next) => {
    if (mounted) {
      setId?.(next);
    }
  });

  onCleanup(() => {
    if (mounted) {
      mounted = false;
      setId?.(undefined);
    }
  });

  const ref = () => {
    mounted = true;
    setId?.(untrack(registeredId));
  };

  return [id, ref] as const;
}
