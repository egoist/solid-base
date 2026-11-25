// Shared helpers of the Select tests (Solid replacements of `@mui/internal-test-utils`).
export {
  act,
  createRef,
  flushMicrotasks,
  renderWithProps,
  renderWithUser,
  wait,
  waitSingleFrame,
} from '../dialog/test-utils';

/**
 * Whether the tests run in jsdom (always, in this repo). Tests that upstream skips in jsdom
 * (`describe.skipIf(isJSDOM)`) are skipped here too.
 */
export const isJSDOM = true;
