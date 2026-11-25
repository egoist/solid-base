import type { Accessor } from 'solid-js';
import { isHTMLElement, isShadowRoot } from '@floating-ui/utils/dom';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { closest, getTarget } from '@egoist/solid-base-utils/shadowDom';
import { createRegisteredLabelId } from '../../utils/createRegisteredLabelId';
import type { HTMLProps } from '../types';
import { useLabelableContext, type StateSetter } from './LabelableContext';

export interface CreateLabelParameters {
  /**
   * The label `id`. A generated id is used when it returns `undefined`.
   */
  id?: Accessor<string | undefined> | undefined;
  /**
   * Control id used when no labelable context control id exists.
   */
  fallbackControlId?: Accessor<string | null | undefined> | undefined;
  /**
   * Whether the rendered element is a native `<label>`.
   * @default () => false
   */
  native?: Accessor<boolean | undefined> | undefined;
  /**
   * Additional callback to sync the current label id with local component state.
   */
  setLabelId?: StateSetter<string | undefined> | undefined;
  /**
   * Custom focus handler for non-native labels.
   * If omitted, focus behavior targets the resolved control id.
   */
  focusControl?:
    | ((event: MouseEvent, controlId: string | null | undefined) => void)
    | undefined;
}

export type CreateLabelReturnValue = HTMLProps;

/**
 * Returns the (live) props of a label: its registered `id`, plus `for` and text-selection
 * prevention for native labels, or click-to-focus behavior for non-native ones.
 */
export function createLabel(params: CreateLabelParameters = {}): CreateLabelReturnValue {
  const context = useLabelableContext();
  const native = () => params.native?.() ?? false;

  const id = createRegisteredLabelId(
    () => params.id?.(),
    (next) => {
      context.setLabelId(next);
      params.setLabelId?.(next);
    },
  );

  const resolvedControlId = () => context.controlId() ?? params.fallbackControlId?.();

  function focusControl(event: MouseEvent) {
    const controlId = resolvedControlId();
    if (params.focusControl) {
      params.focusControl(event, controlId);
      return;
    }

    if (!controlId) {
      return;
    }

    const controlElement = getControlById(event.currentTarget as Element, controlId);
    if (isHTMLElement(controlElement)) {
      focusElementWithVisible(controlElement);
    }
  }

  function handleInteraction(event: MouseEvent) {
    const target = getTarget(event) as HTMLElement | null;
    if (closest(target, 'button,input,select,textarea')) {
      return;
    }

    // Prevent text selection when double clicking label.
    if (!event.defaultPrevented && event.detail > 1) {
      event.preventDefault();
    }

    if (native()) {
      return;
    }

    focusControl(event);
  }

  return {
    get id() {
      return id();
    },
    get for() {
      return native() ? (resolvedControlId() ?? undefined) : undefined;
    },
    onMouseDown(event: MouseEvent) {
      if (native()) {
        handleInteraction(event);
      }
    },
    onClick(event: MouseEvent) {
      if (!native()) {
        handleInteraction(event);
      }
    },
    onPointerDown(event: PointerEvent) {
      if (!native()) {
        event.preventDefault();
      }
    },
  };
}

export function getControlById(label: Element, id: string) {
  let root = label.getRootNode();
  while (isShadowRoot(root)) {
    const element = root.getElementById(id);
    if (element) {
      return element;
    }
    root = root.host.getRootNode();
  }
  return ownerDocument(label).getElementById(id);
}

export function focusElementWithVisible(element: HTMLElement) {
  element.focus({
    // Available from Chrome 144+ (January 2026).
    // Safari and Firefox already support it.
    focusVisible: true,
  } as FocusOptions);
}
