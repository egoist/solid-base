/**
 * Whether a resolved Solid child renders anything. `null`, `undefined`, booleans and empty strings
 * render nothing; arrays render something when any of their items do.
 */
export function isRenderableNode(node: unknown): boolean {
  if (node == null || typeof node === 'boolean' || node === '') {
    return false;
  }
  if (Array.isArray(node)) {
    return node.some(isRenderableNode);
  }
  return true;
}
