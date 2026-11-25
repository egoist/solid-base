const DISABLE_SCROLLBAR_CLASS_NAME = 'base-ui-disable-scrollbar';
const STYLE_ELEMENT_ATTRIBUTE = 'data-base-ui-disable-scrollbar';

export const styleDisableScrollbar = {
  class: DISABLE_SCROLLBAR_CLASS_NAME,
  /**
   * Injects the scrollbar-hiding stylesheet into the element's document (once per document).
   */
  inject(target: Node | null | undefined, nonce?: string) {
    const doc = target?.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
    if (!doc || doc.head.querySelector(`style[${STYLE_ELEMENT_ATTRIBUTE}]`)) {
      return;
    }
    const style = doc.createElement('style');
    style.setAttribute(STYLE_ELEMENT_ATTRIBUTE, '');
    if (nonce) {
      style.nonce = nonce;
    }
    style.textContent = `.${DISABLE_SCROLLBAR_CLASS_NAME}{scrollbar-width:none}.${DISABLE_SCROLLBAR_CLASS_NAME}::-webkit-scrollbar{display:none}`;
    doc.head.prepend(style);
  },
};
