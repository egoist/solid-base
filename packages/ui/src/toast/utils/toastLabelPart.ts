import { children as resolveChildren, createMemo, onSettled, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createBaseUiId } from '../../internals/baseUiId';
import { useToastRootContext } from '../root/ToastRootContext';
import { isRenderableNode } from './isRenderableNode';

interface ToastLabelPartProps {
  id?: unknown;
  children?: JSX.Element;
}

/**
 * Shared logic for `Toast.Title` and `Toast.Description`, which only differ by the rendered tag,
 * the fallback content, and which id setter they register with.
 *
 * Resolves the content (the children, or the toast's title/description), and registers the
 * generated id with the root while the part renders something.
 */
export function createToastLabelPart(props: ToastLabelPartProps, part: 'title' | 'description') {
  const rootContext = useToastRootContext();

  const register =
    part === 'title' ? rootContext.registerTitleId : rootContext.registerDescriptionId;

  const resolvedChildren = resolveChildren(() => props.children);
  const content: Accessor<JSX.Element> = () =>
    resolvedChildren() ??
    (part === 'title' ? rootContext.toast.title : rootContext.toast.description);

  const shouldRender = createMemo(() => isRenderableNode(content()));

  const id = createBaseUiId(() => props.id as string | undefined);

  // The part labels (or describes) the toast while it renders something: derived, so the root's
  // `aria-labelledby`/`aria-describedby` update in the same flush as the content.
  onSettled(() => register(() => (shouldRender() ? id() : undefined)));

  return {
    id,
    content,
    shouldRender,
    type: () => rootContext.toast.type,
  };
}
