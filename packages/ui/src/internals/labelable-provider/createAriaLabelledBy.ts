import { createEffect, createSignal, type Accessor } from 'solid-js';
import { createBaseUiId } from '../baseUiId';

export interface CreateAriaLabelledByParameters {
  /**
   * The `aria-labelledby` passed by the user. Takes precedence over everything else.
   */
  explicitAriaLabelledBy?: Accessor<string | undefined> | undefined;
  /**
   * The id of the associated label (usually `useLabelableContext().labelId`).
   */
  labelId?: Accessor<string | undefined> | undefined;
  /**
   * The element whose native `<label>` (wrapping, sibling, or `for`-associated) is used as a
   * fallback name source. Usually the control's hidden `<input>`.
   */
  labelSource?: Accessor<LabelSource | null | undefined> | undefined;
  /**
   * Whether to fall back to a native label found in the DOM.
   * @default () => true
   */
  enableFallback?: Accessor<boolean | undefined> | undefined;
  /**
   * Used to derive the id given to a fallback label that has none (`${labelSourceId}-label`).
   */
  labelSourceId?: Accessor<string | undefined> | undefined;
  /**
   * The control's `aria-label`. A non-blank value wins over any associated label.
   */
  ariaLabel?: Accessor<string | undefined> | undefined;
}

/**
 * Resolves the `aria-labelledby` of a control that is not natively labelable (e.g. a
 * `<span role="switch">`), including the fallback to a native `<label>` wrapping its hidden input.
 */
export function createAriaLabelledBy(
  params: CreateAriaLabelledByParameters,
): Accessor<string | undefined> {
  const [fallbackAriaLabelledBy, setFallbackAriaLabelledBy] = createSignal<string | undefined>(
    undefined,
  );

  const generatedLabelId = createBaseUiId(() => {
    const sourceId = params.labelSourceId?.();
    return sourceId ? `${sourceId}-label` : undefined;
  });

  // A non-blank `aria-label` wins over any associated label, as it does on native inputs.
  const hasAriaLabel = () => Boolean(params.ariaLabel?.()?.trim());

  // Fallback for <span> controls labelled by a wrapping/sibling native <label>.
  createEffect(
    () => {
      const skip =
        Boolean(params.explicitAriaLabelledBy?.()) ||
        Boolean(params.labelId?.()) ||
        hasAriaLabel() ||
        !(params.enableFallback?.() ?? true);
      return [skip, params.labelSource?.(), generatedLabelId()] as const;
    },
    ([skip, labelSource, generatedId]) => {
      setFallbackAriaLabelledBy(skip ? undefined : getAriaLabelledBy(labelSource, generatedId));
    },
  );

  return () =>
    params.explicitAriaLabelledBy?.() ??
    (hasAriaLabel() ? undefined : params.labelId?.()) ??
    fallbackAriaLabelledBy();
}

function getAriaLabelledBy(labelSource?: LabelSource | null, generatedLabelId?: string) {
  const label = findAssociatedLabel(labelSource);
  if (!label) {
    return undefined;
  }

  if (!label.id && generatedLabelId) {
    label.id = generatedLabelId;
  }

  return label.id || undefined;
}

function findAssociatedLabel(labelSource?: LabelSource | null) {
  if (!labelSource) {
    return undefined;
  }

  // Fast path before the expensive `.labels` read.
  const parent = labelSource.parentElement;
  if (parent && parent.tagName === 'LABEL') {
    return parent as HTMLLabelElement;
  }

  const controlId = labelSource.id;
  if (controlId) {
    const nextSibling = labelSource.nextElementSibling as HTMLLabelElement | null;
    if (nextSibling && nextSibling.htmlFor === controlId) {
      return nextSibling;
    }
  }

  const labels = labelSource.labels;
  return labels && labels[0];
}

export type LabelSource = HTMLElement & {
  labels?: NodeListOf<HTMLLabelElement> | null | undefined;
};
