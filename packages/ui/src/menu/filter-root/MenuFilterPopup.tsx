import type { JSX } from '@solidjs/web';
import { createMenuFilterPopup } from './useMenuFilterPopup';
import type { FocusTargetProp } from '../../utils/popups/focus/FloatingFocusManager';
import { MenuPopupPlain } from '../popup/MenuPopup';
import type { MenuPopupProps } from '../popup/MenuPopup';
import { useMenuRootContext } from '../root/MenuRootContext';
import { mergeProps } from '../../merge-props/mergeProps';
import { REASONS } from '../../internals/reasons';

/**
 * A container for the filter input and item list.
 * Renders a `<div>` element with a `dialog` role.
 */
export function MenuFilterPopup(props: MenuPopupProps): JSX.Element {
  const rootContext = useMenuRootContext();
  const { store } = rootContext;

  const interactionProps = createMenuFilterPopup(() => rootContext.orientation);

  // The input holds real focus; the popup is never the focus target.
  const initialFocus = (): FocusTargetProp => {
    const open = store.select('open');
    const parent = store.select('parent');
    const openMethod = store.select('openMethod');
    const lastOpenChangeReason = store.select('lastOpenChangeReason');

    const openedByHover = open && lastOpenChangeReason === REASONS.triggerHover;
    const mayFocusInput =
      parent.type !== 'menu' ||
      (open &&
        (openMethod === 'keyboard' ||
          lastOpenChangeReason === REASONS.listNavigation ||
          lastOpenChangeReason === REASONS.triggerHover ||
          lastOpenChangeReason === REASONS.triggerPress));

    if (!mayFocusInput) {
      return false;
    }
    return () => {
      // A tap would raise the on-screen keyboard, but a screen reader press (such as an iOS
      // VoiceOver double-tap) still reports a touch and needs the input focused.
      const touchOpen =
        (openMethod === 'touch' || openMethod === 'pen') && !store.context.virtualPress;
      if (openedByHover || touchOpen) {
        return false;
      }
      return store.context.virtualFocusRef?.current ?? false;
    };
  };

  const popupProps = mergeProps<MenuPopupProps>(interactionProps, props, { role: 'dialog' });

  return <MenuPopupPlain {...popupProps} initialFocus={initialFocus()} />;
}
