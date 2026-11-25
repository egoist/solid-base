import { createContext, useContext } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type { Orientation } from '../../internals/types';
import type { CompositeListContextValue, CompositeMetadata } from '../../internals/composite';
import type { FieldValidation } from '../../field/root/createFieldValidation';
import type { ThumbMetadata } from '../thumb/SliderThumb';
import type { SliderRoot, SliderRootState } from './SliderRoot';

/**
 * The live context of `<Slider.Root>`. Plain properties are getters: reading them in a tracking
 * scope subscribes to the underlying state.
 */
export interface SliderRootContext {
  /**
   * The index of the active thumb.
   */
  readonly active: number;
  /**
   * The index of the most recently interacted thumb.
   */
  readonly lastUsedThumbIndex: number;
  controlRef: RefObject<HTMLElement | null>;
  readonly dragging: boolean;
  readonly disabled: boolean;
  validation: FieldValidation;
  /**
   * Options to format the value.
   */
  readonly format: Intl.NumberFormatOptions | undefined;
  /**
   * Applies a value from the hidden input or the keyboard. Returns whether it was applied.
   */
  handleInputChange: (valueInput: number, index: number, event: KeyboardEvent | Event) => boolean;
  readonly indicatorPosition: readonly (number | undefined)[];
  readonly inset: boolean;
  /**
   * Whether the slider value is an array, including single-thumb arrays.
   */
  readonly isArrayValue: boolean;
  readonly labelId: string | undefined;
  readonly rootLabelId: string | undefined;
  /**
   * The large step value of the slider when incrementing or decrementing while the shift key is held,
   * or when using Page-Up or Page-Down keys. Snaps to multiples of this value.
   * @default 10
   */
  readonly largeStep: number;
  lastChangeReasonRef: RefObject<SliderRoot.ChangeEventReason>;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   */
  readonly locale: Intl.LocalesArgument | undefined;
  /**
   * The maximum allowed value of the slider.
   */
  readonly max: number;
  /**
   * The minimum allowed value of the slider.
   */
  readonly min: number;
  /**
   * The minimum steps between values in a range slider.
   */
  readonly minStepsBetweenValues: number;
  readonly form: string | undefined;
  readonly name: string | undefined;
  /**
   * Function to be called when drag ends and the pointer is released.
   */
  onValueCommitted: (
    newValue: number | readonly number[],
    data: SliderRoot.CommitEventDetails,
  ) => void;
  /**
   * The component orientation.
   * @default 'horizontal'
   */
  readonly orientation: Orientation;
  pressedThumbCenterOffsetRef: RefObject<number | null>;
  pressedThumbIndexRef: RefObject<number>;
  pressedValuesRef: RefObject<readonly number[] | null>;
  readonly renderBeforeHydration: boolean;
  registerFieldControlRef: (element: HTMLElement | null) => void;
  setActive: (index: number) => void;
  setDragging: (dragging: boolean) => void;
  setIndicatorPosition: (
    updater: (prev: readonly (number | undefined)[]) => (number | undefined)[],
  ) => void;
  /**
   * Registers a mounted `Slider.Label` (which takes `rootLabelId`). Returns the unregister function.
   */
  registerLabel: () => () => void;
  /**
   * Applies a new value through `onValueChange` for keyboard, input, track-press,
   * and drag interactions. Returns `true` when the value was applied, or `false`
   * when it was invalid (NaN), unchanged, or the change was canceled.
   */
  setValue: (newValue: number | number[], details: SliderRoot.ChangeEventDetails) => boolean;
  state: SliderRootState;
  /**
   * The step increment of the slider when incrementing or decrementing. It will snap
   * to multiples of this value. Decimal values are supported.
   * @default 1
   */
  readonly step: number;
  readonly thumbCollisionBehavior: 'push' | 'swap' | 'none';
  /**
   * The registered thumbs (ordered by document position).
   */
  thumbList: CompositeListContextValue<ThumbMetadata>;
  readonly thumbMap: Map<HTMLElement, CompositeMetadata<ThumbMetadata>>;
  /**
   * The mounted thumb elements, ordered by document position (read-only).
   */
  thumbRefs: RefObject<(HTMLElement | null)[]>;
  /**
   * Registers a mounted thumb element. Returns the unregister function.
   */
  registerThumb: (element: HTMLElement) => () => void;
  /**
   * The value(s) of the slider
   */
  readonly values: readonly number[];
}

export const SliderRootContext = createContext<SliderRootContext | null>(null);

export function useSliderRootContext(): SliderRootContext {
  const context = useContext(SliderRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: SliderRootContext is missing. Slider parts must be placed within <Slider.Root>.',
    );
  }
  return context;
}
