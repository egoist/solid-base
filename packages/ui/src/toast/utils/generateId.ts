let counter = 0;

/**
 * Generates a unique id for a toast added imperatively (outside of rendering).
 */
export function generateId(prefix: string) {
  counter += 1;
  return `${prefix}-${Math.random().toString(36).slice(2, 6)}-${counter}`;
}
