import { isShadowRoot } from '@floating-ui/utils/dom';

const DISABLE_SCROLLBAR_CLASS_NAME = 'base-ui-disable-scrollbar';
const STYLE_ELEMENT_ATTRIBUTE = 'data-base-ui-disable-scrollbar';

export const styleDisableScrollbar = {
  class: DISABLE_SCROLLBAR_CLASS_NAME,
  /**
   * Injects the scrollbar-hiding stylesheet once per style scope: the shadow root that contains
   * `target`, or its document's `<head>`. Document styles don't reach into shadow trees.
   */
  inject(target: Node | null | undefined, nonce?: string) {
    const doc = target?.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
    if (!doc) {
      return;
    }
    const rootNode = target?.getRootNode();
    const scope = rootNode && isShadowRoot(rootNode) ? rootNode : doc.head;
    if (scope.querySelector(`style[${STYLE_ELEMENT_ATTRIBUTE}]`)) {
      return;
    }
    const style = doc.createElement('style');
    style.setAttribute(STYLE_ELEMENT_ATTRIBUTE, '');
    if (nonce) {
      style.nonce = nonce;
    }
    style.textContent = `.${DISABLE_SCROLLBAR_CLASS_NAME}{scrollbar-width:none}.${DISABLE_SCROLLBAR_CLASS_NAME}::-webkit-scrollbar{display:none}`;
    scope.prepend(style);
  },
};
