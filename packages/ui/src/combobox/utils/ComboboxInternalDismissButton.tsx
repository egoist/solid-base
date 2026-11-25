import { visuallyHiddenInput } from '@egoist/solid-base-utils/visuallyHidden';
import { renderElement } from '../../internals/renderElement';
import { createButton } from '../../internals/use-button/createButton';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useComboboxRootContext } from '../root/ComboboxRootContext';

/**
 * A visually hidden button that lets touch screen reader users close the popup.
 * @internal
 */
export function ComboboxInternalDismissButton(props: {
  ref: (element: HTMLSpanElement) => void;
  /** Whether the button is hidden (it stays in the DOM). */
  hidden?: boolean | undefined;
}) {
  const store = useComboboxRootContext();

  const { buttonRef, getButtonProps } = createButton({
    native: () => false,
  });

  return renderElement(
    'span',
    {},
    {
      ref: [props.ref, buttonRef],
      props: [
        {
          onClick(event: MouseEvent) {
            store.setOpen(
              false,
              createChangeEventDetails(
                REASONS.closePress,
                event,
                event.currentTarget as HTMLElement,
              ),
            );
          },
        },
        getButtonProps,
        {
          'aria-label': 'Dismiss',
          get hidden() {
            return props.hidden || undefined;
          },
          tabindex: undefined,
          style: visuallyHiddenInput,
        },
      ],
    },
  );
}
