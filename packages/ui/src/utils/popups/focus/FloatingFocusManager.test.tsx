import { Show, createEffect, createRenderEffect, createSignal, flush, getOwner, omit, runWithOwner } from 'solid-js';
import { render as renderRoot, type JSX } from '@solidjs/web';
import { fireEvent, render, screen, waitFor, within } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type { HTMLProps } from '../../../internals/types';
import type { InteractionType } from '../interactions/enhancedClickHandler';
import { FloatingFocusManager } from './FloatingFocusManager';
import type { FloatingFocusManagerProps } from './FloatingFocusManager';
import {
  FloatingNode,
  FloatingTree,
  createFloatingNodeId,
  useFloatingParentNodeId,
} from '../tree/FloatingTree';
import { FloatingPortal } from '../portal/FloatingPortal';
import { createClick } from '../interactions/click';
import { createDismiss } from '../interactions/dismiss';
import { createHoverPopupInteraction } from '../interactions/hoverPopupInteraction';
import { createHoverTriggerInteraction } from '../interactions/hoverTriggerInteraction';
import { createTestFloating, getInteractionProps } from '../testUtils';
import type { ElementProps } from '../types';
import { Main as Navigation } from '../interactions/__fixtures__/Navigation';
import { cleanupRef, getFloatingTestProps } from '../interactions/__fixtures__/helpers';

const isJSDOM = /jsdom/.test(window.navigator.userAgent);

/** Lets queued microtasks (and the Solid updates they schedule) run. */
async function flushMicrotasks() {
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
    flush();
  }
}

/** `fireEvent.*` followed by a flush, like React's `act()`-wrapped `fireEvent`. */
const fire = new Proxy(fireEvent, {
  apply(target, thisArg, args) {
    const result = (target as any)(...args);
    flush();
    return result;
  },
  get(target, key) {
    const method = (target as any)[key];
    return (...args: any[]) => {
      const result = method(...args);
      flush();
      return result;
    };
  },
}) as typeof fireEvent;

function act(fn: () => void) {
  fn();
  flush();
}

async function waitForTimeout() {
  await new Promise((resolve) => {
    setTimeout(resolve);
  });
  flush();
}

// TODO (@Janpot) It looks like the toHaveFocus assertion from @mui/internal-test-utils
// is not working correctly with iframes and nested documents. Helper as a workaround
// until fixed.
function isFocused(element: Element): boolean {
  let doc = element.ownerDocument;
  let current: Element = element;

  while (doc) {
    if (doc.activeElement !== current) {
      return false;
    }

    // Move up to the parent document
    const frame = doc.defaultView?.frameElement; // the <iframe> hosting this doc
    if (!frame) {
      return true;
    }

    current = frame;
    doc = frame.ownerDocument;
  }

  return true;
}

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
    (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    },
  );

  Object.defineProperty(HTMLElement.prototype, 'inert', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

type AppProps = Partial<
  Omit<FloatingFocusManagerProps, 'initialFocus' | 'store'> & {
    initialFocus?: 'two' | boolean;
  }
>;

function App(props: AppProps) {
  const ref: RefObject<HTMLElement | null> = { current: null };
  const [open, setOpen] = createSignal(false);
  const { refs, store } = createTestFloating({
    open,
    onOpenChange: (value) => setOpen(value),
  });
  const managerProps = omit(props, 'initialFocus', 'children');

  return (
    <>
      <button data-testid="reference" ref={refs.setReference} onClick={() => setOpen(!open())} />
      <Show when={open()}>
        <FloatingFocusManager
          {...managerProps}
          initialFocus={props.initialFocus === 'two' ? ref : props.initialFocus}
          store={store}
        >
          <div role="dialog" ref={cleanupRef(refs.setFloating)} data-testid="floating">
            <button data-testid="one">close</button>
            <button
              data-testid="two"
              ref={(element) => {
                ref.current = element;
              }}
            >
              confirm
            </button>
            <button data-testid="three" onClick={() => setOpen(false)}>
              x
            </button>
            {props.children}
          </div>
        </FloatingFocusManager>
      </Show>
      <div tabindex={0} data-testid="last">
        outside
      </div>
    </>
  );
}

function RadioApp() {
  const [open, setOpen] = createSignal(false);
  const { refs, store } = createTestFloating({
    open,
    onOpenChange: (value) => setOpen(value),
  });

  return (
    <>
      <button data-testid="reference" ref={refs.setReference} onClick={() => setOpen(!open())} />
      <Show when={open()}>
        <FloatingFocusManager store={store}>
          <div role="dialog" ref={cleanupRef(refs.setFloating)}>
            <input type="radio" name="group" data-testid="radio-one" />
            <input type="radio" name="group" checked data-testid="radio-two" />
            <button data-testid="after-radio">after</button>
          </div>
        </FloatingFocusManager>
      </Show>
    </>
  );
}

function MouseDownApp() {
  const [open, setOpen] = createSignal(false);
  const { refs, store } = createTestFloating({
    open,
    onOpenChange: (value) => setOpen(value),
  });
  const interactions = [createClick(store, { event: 'mousedown' })];

  return (
    <>
      <button
        data-testid="reference"
        {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })}
      />
      <Show when={open()}>
        <FloatingFocusManager store={store}>
          <div
            role="dialog"
            {...getFloatingTestProps(interactions, { ref: cleanupRef(refs.setFloating) })}
          >
            <button data-testid="one">close</button>
          </div>
        </FloatingFocusManager>
      </Show>
    </>
  );
}

interface DialogProps {
  open?: boolean;
  render: (props: { close: () => void }) => JSX.Element;
  /** Renders the reference element with the given props (upstream clones its `children`). */
  reference: (props: HTMLProps) => JSX.Element;
}

function Dialog(props: DialogProps) {
  // eslint-disable-next-line solid/reactivity
  const [open, setOpen] = createSignal(props.open ?? false);
  const nodeId = createFloatingNodeId();

  const { refs, store } = createTestFloating({
    open,
    onOpenChange: (value) => setOpen(value),
    nodeId,
  });

  const interactions = [createClick(store), createDismiss(store, { bubbles: false })];

  return (
    <FloatingNode id={nodeId}>
      {props.reference(getInteractionProps(interactions, 'reference', { ref: refs.setReference }))}
      <FloatingPortal>
        <Show when={open()}>
          <FloatingFocusManager store={store}>
            <div {...getFloatingTestProps(interactions, { ref: cleanupRef(refs.setFloating) })}>
              {props.render({
                close: () => setOpen(false),
              })}
            </div>
          </FloatingFocusManager>
        </Show>
      </FloatingPortal>
    </FloatingNode>
  );
}

describe('FloatingFocusManager', () => {
  describe.skipIf(!isJSDOM)('JSDOM-only coverage', () => {
    describe('prop: initialFocus', () => {
      test('default behavior focuses first tabbable element', async () => {
        render(() => <App />);

        fire.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('one')).toHaveFocus();
      });

      test('default behavior focuses the checked radio in a named group', async () => {
        render(() => <RadioApp />);

        fire.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('radio-two')).toHaveFocus();
      });

      test('ref', async () => {
        render(() => <App initialFocus="two" />);
        fire.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('two')).toHaveFocus();
      });

      test('respects autoFocus', async () => {
        // Solid has no `autoFocus` prop: focus the input once it is inserted, like React does
        // during its commit phase (before effects run).
        function AutoFocusInput() {
          const [input, setInput] = createSignal<HTMLInputElement | null>(null, {
            ownedWrite: true,
          });
          createRenderEffect(input, (element) => {
            if (element?.isConnected) {
              element.focus();
            }
          });
          return <input autofocus data-testid="input" ref={(element) => setInput(element)} />;
        }

        render(() => (
          <App>
            <AutoFocusInput />
          </App>
        ));
        fire.click(screen.getByTestId('reference'));
        await flushMicrotasks();
        expect(screen.getByTestId('input')).toHaveFocus();
      });

      test('focuses without a frame delay when a screen reader press opens it', async () => {
        render(() => <MouseDownApp />);

        // A screen reader press is a `mousedown` with `detail: 0`.
        fire.mouseDown(screen.getByTestId('reference'), { detail: 0 });

        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
        await flushMicrotasks();

        expect(screen.getByTestId('one')).toHaveFocus();
      });

      test('keeps the frame delay for a real mouse press', async () => {
        render(() => <MouseDownApp />);

        fire.mouseDown(screen.getByTestId('reference'), { detail: 1 });

        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
        await flushMicrotasks();

        expect(screen.getByTestId('one')).not.toHaveFocus();
      });
    });

    describe('prop: returnFocus', () => {
      test('when true', async () => {
        const [returnFocus, setReturnFocus] = createSignal(true);
        render(() => <App returnFocus={returnFocus()} />);

        screen.getByTestId('reference').focus();
        fire.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('one')).toHaveFocus();

        act(() => screen.getByTestId('two').focus());

        act(() => setReturnFocus(false));

        expect(screen.getByTestId('two')).toHaveFocus();

        fire.click(screen.getByTestId('three'));
        expect(screen.getByTestId('reference')).not.toHaveFocus();
      });

      test('when false', async () => {
        render(() => <App returnFocus={false} />);

        screen.getByTestId('reference').focus();
        fire.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('one')).toHaveFocus();

        fire.click(screen.getByTestId('three'));
        expect(screen.getByTestId('reference')).not.toHaveFocus();
      });

      test('ref', async () => {
        function Test() {
          const ref: RefObject<HTMLElement | null> = { current: null };
          return (
            <div>
              <input />
              <input
                data-testid="focus-target"
                ref={(element) => {
                  ref.current = element;
                }}
              />
              <input />
              <App returnFocus={ref} />
            </div>
          );
        }

        render(() => <Test />);
        screen.getByTestId('reference').focus();
        fire.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        fire.click(screen.getByTestId('three'));
        await flushMicrotasks();
        expect(screen.getByTestId('focus-target')).toHaveFocus();
      });

      test('always returns to the reference for nested elements', async () => {
        function NestedDialog(props: DialogProps) {
          const parentId = useFloatingParentNodeId();

          if (parentId == null) {
            return (
              <FloatingTree>
                <Dialog {...props} />
              </FloatingTree>
            );
          }

          return <Dialog {...props} />;
        }

        render(() => (
          <NestedDialog
            render={({ close }) => (
              <>
                <NestedDialog
                  render={(nested) => (
                    <button onClick={nested.close} data-testid="close-nested-dialog" />
                  )}
                  reference={(props) => <button data-testid="open-nested-dialog" {...props} />}
                />
                <button onClick={close} data-testid="close-dialog" />
              </>
            )}
            reference={(props) => <button data-testid="open-dialog" {...props} />}
          />
        ));

        await userEvent.click(screen.getByTestId('open-dialog'));
        await userEvent.click(screen.getByTestId('open-nested-dialog'));

        expect(screen.getByTestId('close-nested-dialog')).toBeInTheDocument();

        fire.pointerDown(document.body);

        expect(screen.queryByTestId('close-nested-dialog')).not.toBeInTheDocument();

        fire.pointerDown(document.body);

        expect(screen.queryByTestId('close-dialog')).not.toBeInTheDocument();
      });

      test('return to the first focusable descendent of the reference, if the reference is not focusable', async () => {
        render(() => (
          <Dialog
            render={({ close }) => <button onClick={close} data-testid="close-dialog" />}
            reference={(props) => (
              <div data-testid="non-focusable-reference" {...props}>
                <button data-testid="open-dialog" />
              </div>
            )}
          />
        ));
        screen.getByTestId('open-dialog').focus();
        await userEvent.keyboard('{Enter}');

        expect(screen.getByTestId('close-dialog')).toBeInTheDocument();

        // Upstream presses `{Esc}`, whose legacy `key` ('Esc') React's synthetic events normalize
        // to 'Escape'. Native events aren't normalized.
        await userEvent.keyboard('{Escape}');

        expect(screen.queryByTestId('close-dialog')).not.toBeInTheDocument();

        expect(screen.getByTestId('open-dialog')).toHaveFocus();
      });

      test.each([
        { name: 'modal', modal: true },
        { name: 'non-modal', modal: false },
      ])(
        'preserves tabbable context next to reference element if removed ($name)',
        async ({ modal }) => {
          function TestApp() {
            const [isOpen, setIsOpen] = createSignal(false);
            const [removed, setRemoved] = createSignal(false);

            const { refs, store } = createTestFloating({
              open: isOpen,
              onOpenChange: (value) => setIsOpen(value),
            });

            const interactions = [createClick(store)];

            return (
              <>
                <Show when={!removed()}>
                  <button
                    {...getInteractionProps(interactions, 'reference', {
                      ref: cleanupRef(refs.setReference),
                    })}
                    data-testid="reference"
                  />
                </Show>
                <Show when={isOpen()}>
                  <FloatingPortal>
                    <FloatingFocusManager store={store} modal={modal}>
                      <div
                        {...getFloatingTestProps(interactions, {
                          ref: cleanupRef(refs.setFloating),
                        })}
                      >
                        <button
                          data-testid="remove"
                          onClick={() => {
                            setRemoved(true);
                            setIsOpen(false);
                          }}
                        >
                          remove
                        </button>
                      </div>
                    </FloatingFocusManager>
                  </FloatingPortal>
                </Show>
                <button data-testid="fallback" />
              </>
            );
          }

          render(() => <TestApp />);

          fire.click(screen.getByTestId('reference'));
          await flushMicrotasks();

          fire.click(screen.getByTestId('remove'));
          await flushMicrotasks();

          await userEvent.tab();

          expect(screen.getByTestId('fallback')).toHaveFocus();
        },
      );

      function ClickDismissApp() {
        const [isOpen, setIsOpen] = createSignal(false);

        const { refs, store } = createTestFloating({
          open: isOpen,
          onOpenChange: (value) => setIsOpen(value),
        });

        const interactions = [createClick(store), createDismiss(store)];

        return (
          <>
            <button {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })}>
              reference
            </button>
            <Show when={isOpen()}>
              <FloatingFocusManager store={store}>
                <div
                  {...getFloatingTestProps(interactions, { ref: cleanupRef(refs.setFloating) })}
                  data-testid="floating"
                />
              </FloatingFocusManager>
            </Show>
          </>
        );
      }

      test.skipIf(!isJSDOM)(
        'does not return focus to reference on outside press when preventScroll is not supported',
        async () => {
          render(() => <ClickDismissApp />);

          await userEvent.click(screen.getByText('reference'));
          await flushMicrotasks();

          expect(screen.getByTestId('floating')).toHaveFocus();

          await userEvent.click(document.body);
          await flushMicrotasks();

          expect(screen.getByText('reference')).not.toHaveFocus();
        },
      );

      test('returns focus to reference on outside press when preventScroll is supported', async () => {
        const originalFocus = HTMLElement.prototype.focus;
        Object.defineProperty(HTMLElement.prototype, 'focus', {
          configurable: true,
          writable: true,
          value(options: any) {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            options && options.preventScroll;
            return originalFocus.call(this, options);
          },
        });

        try {
          render(() => <ClickDismissApp />);

          await userEvent.click(screen.getByText('reference'));
          await flushMicrotasks();

          expect(screen.getByTestId('floating')).toHaveFocus();

          await userEvent.click(document.body);
          await flushMicrotasks();

          expect(screen.getByText('reference')).toHaveFocus();
        } finally {
          HTMLElement.prototype.focus = originalFocus;
        }
      });

      test('passes focusVisible when returning focus after keyboard close', async () => {
        render(() => <ClickDismissApp />);

        const reference = screen.getByText('reference');
        await userEvent.click(reference);
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toHaveFocus();

        const focusSpy = vi.spyOn(reference, 'focus');

        try {
          await userEvent.keyboard('{Escape}');

          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({
              preventScroll: true,
              focusVisible: true,
            });
          });
        } finally {
          focusSpy.mockRestore();
        }
      });

      test('omits focusVisible when returning focus after pointer close', async () => {
        render(() => <ClickDismissApp />);

        const reference = screen.getByText('reference');
        await userEvent.click(reference);
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toHaveFocus();

        const focusSpy = vi.spyOn(reference, 'focus');

        try {
          // Closing with a pointer must not force `:focus-visible`; `focusVisible`
          // is omitted entirely so the browser's own heuristics decide.
          await userEvent.click(reference);

          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
          });
          expect(focusSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({ focusVisible: true }),
          );
        } finally {
          focusSpy.mockRestore();
        }
      });

      test('does not return focus while open when the reference changes', async () => {
        const [useSecond, setUseSecond] = createSignal(false);

        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);

          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          const interactions = [createClick(store)];
          let first: HTMLElement | undefined;
          let second: HTMLElement | undefined;

          // Upstream switches which button receives `refs.setReference`.
          createEffect(useSecond, (value) => {
            refs.setReference((value ? second : first) ?? null);
          });

          return (
            <>
              <button
                data-testid="first"
                {...getInteractionProps(interactions, 'reference', {
                  ref: (element: HTMLElement) => {
                    first = element;
                  },
                })}
              />
              <button
                data-testid="second"
                ref={(element) => {
                  second = element;
                }}
              />
              <Show when={isOpen()}>
                <FloatingFocusManager store={store}>
                  <div
                    {...getFloatingTestProps(interactions, { ref: cleanupRef(refs.setFloating) })}
                  >
                    <button data-testid="child" />
                    <button data-testid="close" onClick={() => setIsOpen(false)} />
                  </div>
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <TestApp />);

        await userEvent.click(screen.getByTestId('first'));
        await flushMicrotasks();

        const child = screen.getByTestId('child');
        act(() => child.focus());

        // The return-focus effect re-arms for the new reference while the popup stays open, so
        // the cleanup's queued return focus must be cancelled rather than yank focus mid-open.
        act(() => setUseSecond(true));
        await flushMicrotasks();

        expect(child).toHaveFocus();

        await userEvent.click(screen.getByTestId('close'));
        await flushMicrotasks();

        // The cancelled job must not have left return focus suppressed for the real close.
        expect(screen.getByTestId('second')).toHaveFocus();
      });

      test('does not insert fallback element when return element is falsy', async () => {
        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);

          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          const interactions = [createClick(store)];

          return (
            <>
              <button
                data-testid="reference"
                {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })}
              />
              <FloatingPortal>
                <Show when={isOpen()}>
                  <FloatingFocusManager store={store} returnFocus={() => undefined}>
                    <div
                      {...getFloatingTestProps(interactions, {
                        ref: cleanupRef(refs.setFloating),
                      })}
                    >
                      <button data-testid="close" onClick={() => setIsOpen(false)} />
                    </div>
                  </FloatingFocusManager>
                </Show>
              </FloatingPortal>
            </>
          );
        }

        render(() => <TestApp />);

        const reference = screen.getByTestId('reference');
        await userEvent.click(reference);
        await flushMicrotasks();

        expect(reference.nextElementSibling).toBeNull();

        await userEvent.click(screen.getByTestId('close'));

        await waitFor(() => {
          expect(screen.queryByTestId('close')).toBeNull();
        });

        expect(reference.nextElementSibling).toBeNull();
      });
    });

    describe('iframe focus navigation', () => {
      function IframeContent(props: { iframe: HTMLElement }) {
        return (
          <div>
            <a href="#">prev iframe link</a>
            <Popover
              portalRef={props.iframe}
              render={() => (
                <div data-testid="popover">
                  <a href="#">popover link 1</a>
                  <a href="#">popover link 2</a>
                </div>
              )}
              reference={(referenceProps) => <button {...referenceProps}>Open</button>}
            />
            <a href="#">next iframe link</a>
          </div>
        );
      }

      function Popover(props: {
        reference: (props: HTMLProps) => JSX.Element;
        render: () => JSX.Element;
        portalRef?: HTMLElement;
      }) {
        const [open, setOpen] = createSignal(false);

        const { refs, store } = createTestFloating({
          open,
          onOpenChange: (value) => setOpen(value),
        });

        const interactions = [createClick(store), createDismiss(store)];

        return (
          <>
            {props.reference(
              getInteractionProps(interactions, 'reference', { ref: refs.setReference }),
            )}
            <Show when={open()}>
              <FloatingPortal container={props.portalRef}>
                <FloatingFocusManager store={store} modal={false}>
                  <div
                    {...getFloatingTestProps(interactions, { ref: cleanupRef(refs.setFloating) })}
                  >
                    {props.render()}
                  </div>
                </FloatingFocusManager>
              </FloatingPortal>
            </Show>
          </>
        );
      }

      let disposeIframe: (() => void) | undefined;

      afterEach(() => {
        disposeIframe?.();
        disposeIframe = undefined;
      });

      function IframeApp() {
        let innerRoot!: HTMLDivElement;
        const owner = getOwner();

        createEffect(
          () => undefined,
          () => {
            const iframe = document.createElement('iframe');
            iframe.setAttribute('data-testid', 'iframe');
            iframe.src = 'about:blank';
            iframe.style.height = '300px';

            innerRoot.appendChild(iframe);

            // Properly open, write, and close the iframe document.
            const iframeDoc = iframe.contentWindow?.document;
            if (iframeDoc) {
              iframeDoc.open();
              iframeDoc.write(`<div id="rootIframe"></div>`);
              iframeDoc.close();
            }

            const root = iframe.contentWindow?.document.getElementById('rootIframe');
            if (root) {
              // A separate root in the iframe, like upstream's `ReactDOMClient.createRoot`.
              disposeIframe = runWithOwner(owner, () =>
                renderRoot(() => <IframeContent iframe={root} />, root),
              );
            }
          },
        );

        return (
          <>
            <a href="#">Outside link 1</a>
            <div
              id="innerRoot"
              ref={(element) => {
                innerRoot = element;
              }}
            />
            <a href="#">Outside link 2</a>
          </>
        );
      }

      // "Should not already be working"(?) when trying to click within the iframe
      // https://github.com/react/react/pull/32441
      test.skipIf(!isJSDOM)('tabs from the popover to the next element in the iframe', async () => {
        render(() => <IframeApp />);

        const iframe: HTMLIFrameElement = await screen.findByTestId('iframe');
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        const iframeWithin = iframeDoc ? within(iframeDoc.body) : screen;

        // The popover renders inside an iframe, so user-event needs an instance for the
        // iframe's document.
        const user = userEvent.setup({ document: iframeDoc });

        await user.click(iframeWithin.getByRole('button', { name: 'Open' }));

        // Solid clones its templates from the top-level document, so the elements keep the parent
        // window's prototypes and jest-dom's `toBeInTheDocument` rejects them as non-elements.
        expect(iframeDoc!.body.contains(iframeWithin.getByTestId('popover'))).toBe(true);

        await user.tab();
        await user.tab();

        expect(isFocused(iframeWithin.getByText('next iframe link'))).toBe(true);
      });

      // "Should not already be working"(?) when trying to click within the iframe
      // https://github.com/react/react/pull/32441
      test.skipIf(!isJSDOM)(
        'shift+tab from the popover to the previous element in the iframe',
        async () => {
          render(() => <IframeApp />);

          const iframe: HTMLIFrameElement = await screen.findByTestId('iframe');
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          const iframeWithin = iframeDoc ? within(iframeDoc.body) : screen;

          const user = userEvent.setup({ document: iframeDoc });

          await user.click(iframeWithin.getByRole('button', { name: 'Open' }));

          // See above: jest-dom rejects elements with the parent window's prototypes.
          expect(iframeDoc!.body.contains(iframeWithin.getByTestId('popover'))).toBe(true);

          await user.tab({ shift: true });

          expect(isFocused(iframeWithin.getByRole('button', { name: 'Open' }))).toBe(true);
        },
      );
    });

    describe('prop: modal', () => {
      test('when true', async () => {
        render(() => <App modal />);

        fire.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await userEvent.tab();
        expect(screen.getByTestId('two')).toHaveFocus();

        await userEvent.tab();
        expect(screen.getByTestId('three')).toHaveFocus();

        await userEvent.tab();
        expect(screen.getByTestId('one')).toHaveFocus();

        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('three')).toHaveFocus();

        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('two')).toHaveFocus();

        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('one')).toHaveFocus();

        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('three')).toHaveFocus();

        await userEvent.tab();
        expect(screen.getByTestId('one')).toHaveFocus();
      });

      test('wraps focus within the same frame as the Tab', async () => {
        render(() => <App modal />);

        fire.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        act(() => screen.getByTestId('three').focus());
        expect(screen.getByTestId('three')).toHaveFocus();

        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);

        await userEvent.tab();
        expect(screen.getByTestId('one')).toHaveFocus();

        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('three')).toHaveFocus();
      });

      test('when false', async () => {
        render(() => <App modal={false} />);

        fire.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await userEvent.tab();
        expect(screen.getByTestId('two')).toHaveFocus();

        await userEvent.tab();
        expect(screen.getByTestId('three')).toHaveFocus();

        await userEvent.tab();

        // Wait for the setTimeout that wraps onOpenChange(false).
        await waitForTimeout();

        // Focus leaving the floating element closes it.
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        expect(screen.getByTestId('last')).toHaveFocus();
      });

      test('closeOnFocusOut: false keeps a non-modal element open when focus leaves', async () => {
        render(() => <App modal={false} closeOnFocusOut={false} />);

        fire.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toBeInTheDocument();

        await userEvent.tab();
        expect(screen.getByTestId('two')).toHaveFocus();

        await userEvent.tab();
        expect(screen.getByTestId('three')).toHaveFocus();

        // Move focus out of the floating element entirely.
        await userEvent.tab();

        // Wait for the (potential) setTimeout that wraps onOpenChange(false).
        await waitForTimeout();

        // With `closeOnFocusOut={false}`, focus leaving the floating element does not close it.
        expect(screen.getByTestId('floating')).toBeInTheDocument();
        expect(screen.getByTestId('last')).toHaveFocus();
      });

      test('clicking a nested click trigger does not suppress the next focus-out close', async () => {
        function TestApp() {
          const [open, setOpen] = createSignal(false);
          const { refs, store } = createTestFloating({
            open,
            onOpenChange: (value) => setOpen(value),
          });

          return (
            <>
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setOpen(true)}
              />
              <Show when={open()}>
                <FloatingFocusManager store={store} modal={false}>
                  <div role="dialog" ref={cleanupRef(refs.setFloating)} data-testid="floating">
                    <button data-base-ui-click-trigger="" data-testid="nested-trigger" />
                  </div>
                </FloatingFocusManager>
              </Show>
              <button data-testid="last" />
            </>
          );
        }

        render(() => <TestApp />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await userEvent.click(screen.getByTestId('nested-trigger'));
        await waitForTimeout();

        await userEvent.tab();
        await waitForTimeout();

        expect(screen.queryByTestId('floating')).not.toBeInTheDocument();
        expect(screen.getByTestId('last')).toHaveFocus();
      });

      test('false - comboboxes do not hide all other nodes', async () => {
        function TestApp() {
          const [open, setOpen] = createSignal(false);
          const { refs, store } = createTestFloating({
            open,
            onOpenChange: (value) => setOpen(value),
          });

          return (
            <>
              <input
                role="combobox"
                data-testid="reference"
                ref={refs.setReference}
                onFocus={() => setOpen(true)}
              />
              <button data-testid="btn-1" />
              <button data-testid="btn-2" />
              <Show when={open()}>
                <FloatingFocusManager store={store} modal={false}>
                  <div role="listbox" ref={cleanupRef(refs.setFloating)} data-testid="floating" />
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <TestApp />);

        fire.focus(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('reference')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('floating')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('inert');
      });

      test('fallback to floating element when it has no tabbable content', async () => {
        function TestApp() {
          const { refs, store } = createTestFloating({ open: () => true });
          return (
            <>
              <button data-testid="reference" ref={refs.setReference} />
              <FloatingFocusManager store={store} modal>
                <div ref={refs.setFloating} data-testid="floating" tabindex={-1} />
              </FloatingFocusManager>
            </>
          );
        }

        render(() => <TestApp />);
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('floating')).toHaveFocus();
        });
        await userEvent.tab();
        expect(screen.getByTestId('floating')).toHaveFocus();
        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('floating')).toHaveFocus();
      });

      test('mixed modality and nesting', async () => {
        interface Props {
          open?: boolean;
          modal?: boolean;
          render: (props: { close: () => void }) => JSX.Element;
          reference?: (props: HTMLProps) => JSX.Element;
          sideChildren?: JSX.Element;
        }

        function MixedDialog(props: Props) {
          const [internalOpen, setOpen] = createSignal(false);
          const nodeId = createFloatingNodeId();
          const open = () => (props.open !== undefined ? props.open : internalOpen());

          const { refs, store } = createTestFloating({
            open,
            onOpenChange: (value) => setOpen(value),
            nodeId,
          });

          const interactions = [createClick(store), createDismiss(store, { bubbles: false })];

          return (
            <FloatingNode id={nodeId}>
              {props.reference?.(
                getInteractionProps(interactions, 'reference', { ref: refs.setReference }),
              )}
              <FloatingPortal>
                <Show when={open()}>
                  <FloatingFocusManager store={store} modal={props.modal ?? true}>
                    <div
                      {...getFloatingTestProps(interactions, {
                        ref: cleanupRef(refs.setFloating),
                      })}
                    >
                      {props.render({
                        close: () => setOpen(false),
                      })}
                    </div>
                  </FloatingFocusManager>
                </Show>
              </FloatingPortal>
              {props.sideChildren}
            </FloatingNode>
          );
        }

        function NestedDialog(props: Props) {
          const parentId = useFloatingParentNodeId();

          if (parentId == null) {
            return (
              <FloatingTree>
                <MixedDialog {...props} />
              </FloatingTree>
            );
          }

          return <MixedDialog {...props} />;
        }

        function TestApp() {
          const [sideDialogOpen, setSideDialogOpen] = createSignal(false);
          return (
            <NestedDialog
              modal={false}
              render={({ close }) => (
                <>
                  <button onClick={close} data-testid="close-dialog" />
                  <button
                    onClick={() => setSideDialogOpen(true)}
                    data-testid="open-nested-dialog"
                  />
                </>
              )}
              sideChildren={
                <NestedDialog
                  modal
                  open={sideDialogOpen()}
                  render={({ close }) => (
                    <button onClick={close} data-testid="close-nested-dialog" />
                  )}
                />
              }
              reference={(props) => <button data-testid="open-dialog" {...props} />}
            />
          );
        }

        render(() => <TestApp />);

        await userEvent.click(screen.getByTestId('open-dialog'));
        await userEvent.click(screen.getByTestId('open-nested-dialog'));

        expect(screen.getByTestId('close-dialog')).toBeInTheDocument();
        expect(screen.getByTestId('close-nested-dialog')).toBeInTheDocument();
      });

      test('true - applies aria-hidden to outside nodes', async () => {
        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);
          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          return (
            <>
              <input
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setIsOpen((v) => !v)}
              />
              <div data-testid="outside-wrapper">
                <div data-testid="aria-live" aria-live="polite" />
                <button data-testid="btn-1" />
                <button data-testid="btn-2" />
              </div>
              <Show when={isOpen()}>
                <FloatingFocusManager store={store}>
                  <div ref={cleanupRef(refs.setFloating)} data-testid="floating" />
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <TestApp />);

        fire.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('reference')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByTestId('floating')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('aria-live')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('btn-1')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByTestId('btn-2')).toHaveAttribute('aria-hidden', 'true');

        fire.click(screen.getByTestId('reference'));

        expect(screen.getByTestId('reference')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('aria-live')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('aria-hidden');
      });

      test('true - keeps supplied inside elements outside the floating node exposed to assistive tech', async () => {
        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);
          let dismissElement: HTMLButtonElement | null = null;
          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          return (
            <>
              <input
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setIsOpen((v) => !v)}
              />
              <div data-testid="outside-wrapper">
                <button data-testid="outside-button" />
              </div>
              <Show when={isOpen()}>
                <FloatingFocusManager store={store} getInsideElements={() => [dismissElement]}>
                  <div ref={cleanupRef(refs.setFloating)} data-testid="floating" />
                  <button
                    ref={(element) => {
                      dismissElement = element;
                    }}
                    data-testid="dismiss"
                  />
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <TestApp />);

        fire.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('dismiss')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('outside-wrapper')).toHaveAttribute('aria-hidden', 'true');
      });

      test('false - does not apply inert to outside nodes', async () => {
        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);
          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          return (
            <>
              <input
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setIsOpen((v) => !v)}
              />
              <div data-testid="outside-wrapper">
                <div data-testid="aria-live" aria-live="polite" />
                <button data-testid="btn-1" />
                <button data-testid="btn-2" />
              </div>
              <Show when={isOpen()}>
                <FloatingFocusManager store={store} modal={false}>
                  <div role="listbox" ref={cleanupRef(refs.setFloating)} data-testid="floating" />
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <TestApp />);

        fire.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('aria-live')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('reference')).toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('outside-wrapper')).toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-base-ui-inert');

        fire.click(screen.getByTestId('reference'));

        expect(screen.getByTestId('reference')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('outside-wrapper')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-base-ui-inert');
      });

      test('false - keeps marker on top-level outside ancestor when reference has siblings', async () => {
        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);
          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          return (
            <>
              <div data-testid="outside-wrapper">
                <input
                  data-testid="reference"
                  ref={refs.setReference}
                  onClick={() => setIsOpen((v) => !v)}
                />
                <button data-testid="btn-1" />
                <button data-testid="btn-2" />
                <div data-testid="nested-wrapper">
                  <button data-testid="nested-btn" />
                </div>
              </div>
              <div data-testid="outside-sibling" />
              <Show when={isOpen()}>
                <FloatingFocusManager store={store} modal={false}>
                  <div role="listbox" ref={cleanupRef(refs.setFloating)} data-testid="floating" />
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <TestApp />);

        fire.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('outside-wrapper')).toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('outside-sibling')).toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('reference')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('nested-wrapper')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('nested-btn')).not.toHaveAttribute('data-base-ui-inert');

        fire.click(screen.getByTestId('reference'));

        expect(screen.getByTestId('outside-wrapper')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('outside-sibling')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('reference')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('nested-wrapper')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('nested-btn')).not.toHaveAttribute('data-base-ui-inert');
      });
    });

    describe('prop: disabled', () => {
      test('true -> false', async () => {
        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);
          const [disabled, setDisabled] = createSignal(true);

          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          return (
            <>
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setIsOpen((v) => !v)}
              />
              <button data-testid="toggle" onClick={() => setDisabled((v) => !v)} />
              <Show when={isOpen()}>
                <FloatingFocusManager store={store} disabled={disabled()}>
                  <div ref={cleanupRef(refs.setFloating)} data-testid="floating" role="dialog" />
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <TestApp />);

        fire.click(screen.getByTestId('reference'));
        await flushMicrotasks();
        expect(screen.getByTestId('floating')).not.toHaveFocus();
        fire.click(screen.getByTestId('toggle'));
        await flushMicrotasks();
        await waitFor(() => {
          expect(screen.getByTestId('floating')).toHaveFocus();
        });
      });

      test('when false', async () => {
        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);
          const [disabled, setDisabled] = createSignal(false);

          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          const interactions = [createClick(store)];

          return (
            <>
              <button
                data-testid="reference"
                {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })}
              />
              <button data-testid="toggle" onClick={() => setDisabled((v) => !v)} />
              <Show when={isOpen()}>
                <FloatingFocusManager store={store} disabled={disabled()}>
                  <div
                    data-testid="floating"
                    {...getFloatingTestProps(interactions, { ref: cleanupRef(refs.setFloating) })}
                  />
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <TestApp />);

        fire.click(screen.getByTestId('reference'));
        await flushMicrotasks();
        expect(screen.getByTestId('floating')).toHaveFocus();
      });

      test('supports keepMounted behavior', async () => {
        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);

          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          const interactions = [createClick(store), createDismiss(store)];

          return (
            <>
              <button
                data-testid="reference"
                {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })}
              />
              <FloatingFocusManager store={store} disabled={!isOpen()} modal={false}>
                <div
                  data-testid="floating"
                  {...getFloatingTestProps(interactions, { ref: refs.setFloating })}
                >
                  <button data-testid="child" />
                </div>
              </FloatingFocusManager>
              <button data-testid="after" />
            </>
          );
        }

        render(() => <TestApp />);

        await flushMicrotasks();

        expect(screen.getByTestId('floating')).not.toHaveFocus();

        fire.click(screen.getByTestId('reference'));

        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('child')).toHaveFocus();
        });

        await userEvent.tab();

        expect(screen.getByTestId('after')).toHaveFocus();

        await userEvent.tab({ shift: true });

        fire.click(screen.getByTestId('reference'));

        expect(screen.getByTestId('child')).toHaveFocus();

        await userEvent.keyboard('{Escape}');

        expect(screen.getByTestId('reference')).toHaveFocus();
      });

      test('treats a returnFocus resolver returning true as explicit', async () => {
        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);
          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          return (
            <>
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setIsOpen(true)}
              />
              <button data-testid="close" onClick={() => setIsOpen(false)} />
              <Show when={isOpen()}>
                <FloatingFocusManager store={store} returnFocus={() => true}>
                  <div ref={cleanupRef(refs.setFloating)}>
                    <button data-testid="child" />
                  </div>
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <TestApp />);

        await userEvent.click(screen.getByTestId('reference'));
        await waitFor(() => {
          expect(screen.getByTestId('child')).toHaveFocus();
        });

        await userEvent.click(screen.getByTestId('close'));

        await waitFor(() => {
          expect(screen.getByTestId('reference')).toHaveFocus();
        });
      });

      test('uses the latest explicitReturnFocus value without moving focus while open', async () => {
        const [explicitReturnFocus, setExplicitReturnFocus] = createSignal(true);

        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);
          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          return (
            <>
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setIsOpen(true)}
              />
              <button data-testid="close" onClick={() => setIsOpen(false)} />
              <Show when={isOpen()}>
                <FloatingFocusManager
                  store={store}
                  explicitReturnFocus={explicitReturnFocus()}
                  modal={false}
                >
                  <div ref={cleanupRef(refs.setFloating)}>
                    <button data-testid="child" />
                  </div>
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <TestApp />);

        await userEvent.click(screen.getByTestId('reference'));
        await waitFor(() => {
          expect(screen.getByTestId('child')).toHaveFocus();
        });

        act(() => setExplicitReturnFocus(false));
        expect(screen.getByTestId('child')).toHaveFocus();

        const close = screen.getByTestId('close');
        await userEvent.click(close);
        expect(close).toHaveFocus();
      });

      test('resets close modality between keep-mounted open sessions', async () => {
        const finalFocus = vi.fn((_closeType: InteractionType) => true);

        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);

          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          const interactions = [createClick(store), createDismiss(store)];

          return (
            <>
              <button
                data-testid="reference"
                {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })}
              />
              <button data-testid="controlled-open" onClick={() => setIsOpen(true)} />
              <button data-testid="controlled-close" onClick={() => setIsOpen(false)} />
              <FloatingPortal>
                <FloatingFocusManager
                  store={store}
                  disabled={!isOpen()}
                  returnFocus={finalFocus}
                >
                  <div {...getFloatingTestProps(interactions, { ref: refs.setFloating })}>
                    <button data-testid="child" />
                  </div>
                </FloatingFocusManager>
              </FloatingPortal>
            </>
          );
        }

        render(() => <TestApp />);

        const reference = screen.getByTestId('reference');
        const focusSpy = vi.spyOn(reference, 'focus');

        try {
          await userEvent.click(reference);
          await waitFor(() => {
            expect(screen.getByTestId('child')).toHaveFocus();
          });

          await userEvent.keyboard('{Escape}');
          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({
              preventScroll: true,
              focusVisible: true,
            });
          });
          expect(finalFocus).toHaveBeenLastCalledWith('keyboard');

          focusSpy.mockClear();

          await userEvent.click(reference);
          await waitFor(() => {
            expect(screen.getByTestId('child')).toHaveFocus();
          });

          fire.click(screen.getByTestId('controlled-close'));

          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
          });
          expect(focusSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({ focusVisible: true }),
          );
          expect(finalFocus).toHaveBeenLastCalledWith('');

          focusSpy.mockClear();
          finalFocus.mockClear();

          fire.click(screen.getByTestId('controlled-open'));
          await waitFor(() => {
            expect(screen.getByTestId('child')).toHaveFocus();
          });

          fire.pointerDown(reference, { pointerType: 'mouse' });
          fire.click(screen.getByTestId('controlled-close'));

          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
          });
          expect(focusSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({ focusVisible: true }),
          );
          expect(finalFocus).toHaveBeenCalledWith('');

          focusSpy.mockClear();
          finalFocus.mockClear();

          fire.click(screen.getByTestId('controlled-open'));
          await waitFor(() => {
            expect(screen.getByTestId('child')).toHaveFocus();
          });

          fire.click(reference, { detail: 0 });

          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({
              preventScroll: true,
              focusVisible: true,
            });
          });
          expect(finalFocus).toHaveBeenCalledWith('keyboard');
        } finally {
          focusSpy.mockRestore();
        }
      });

      test.each<{
        name: string;
        pointerType: string | null;
        detail: number;
        expected: InteractionType;
      }>([
        {
          name: 'zero detail after a mouse pointerdown',
          pointerType: 'mouse',
          detail: 0,
          expected: 'keyboard',
        },
        {
          name: 'nonzero detail after a touch pointerdown',
          pointerType: 'touch',
          detail: 1,
          expected: 'touch',
        },
        {
          name: 'nonzero detail after a pen pointerdown',
          pointerType: 'pen',
          detail: 1,
          expected: 'pen',
        },
        {
          name: 'nonzero detail without a pointerdown',
          pointerType: null,
          detail: 1,
          expected: 'mouse',
        },
      ])(
        'classifies a click with an empty pointerType: $name',
        async ({ pointerType, detail, expected }) => {
          const finalFocus = vi.fn((_closeType: InteractionType) => true);

          function TestApp() {
            const [isOpen, setIsOpen] = createSignal(true);

            const { refs, store } = createTestFloating({
              open: isOpen,
              onOpenChange: (value) => setIsOpen(value),
            });

            const interactions = [createClick(store)];

            return (
              <>
                <button
                  data-testid="reference"
                  {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })}
                />
                <FloatingPortal>
                  <Show when={isOpen()}>
                    <FloatingFocusManager store={store} returnFocus={finalFocus}>
                      <div
                        {...getFloatingTestProps(interactions, {
                          ref: cleanupRef(refs.setFloating),
                        })}
                      >
                        <button data-testid="child" />
                      </div>
                    </FloatingFocusManager>
                  </Show>
                </FloatingPortal>
              </>
            );
          }

          render(() => <TestApp />);

          const reference = screen.getByTestId('reference');

          if (pointerType) {
            fire.pointerDown(reference, { pointerType });
          }
          // Synthesized click shape: `PointerEvent` with an empty `pointerType`.
          fire(
            reference,
            new PointerEvent('click', { bubbles: true, cancelable: true, detail, pointerType: '' }),
          );

          await waitFor(() => {
            expect(finalFocus).toHaveBeenCalledWith(expected);
          });
        },
      );

      test('preserves keyboard close modality when reopening before focus restoration', async () => {
        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);
          const [reopenOnClose, setReopenOnClose] = createSignal(false);

          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          const interactions = [createClick(store), createDismiss(store)];

          createEffect(
            () => [isOpen(), reopenOnClose()] as const,
            ([open, reopen]) => {
              if (!open && reopen) {
                setReopenOnClose(false);
                setIsOpen(true);
              }
            },
          );

          return (
            <>
              <span data-testid="open-state">{String(isOpen())}</span>
              <button
                data-testid="reference"
                {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })}
              />
              <button data-testid="reopen-on-close" onClick={() => setReopenOnClose(true)} />
              <FloatingPortal>
                <FloatingFocusManager store={store} disabled={!isOpen()}>
                  <div {...getFloatingTestProps(interactions, { ref: refs.setFloating })}>
                    <button data-testid="child" />
                  </div>
                </FloatingFocusManager>
              </FloatingPortal>
            </>
          );
        }

        render(() => <TestApp />);

        const reference = screen.getByTestId('reference');
        const focusSpy = vi.spyOn(reference, 'focus');

        try {
          await userEvent.click(reference);
          await waitFor(() => {
            expect(screen.getByTestId('child')).toHaveFocus();
          });

          fire.click(screen.getByTestId('reopen-on-close'));
          await userEvent.keyboard('{Escape}');

          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({
              preventScroll: true,
              focusVisible: true,
            });
          });
          expect(screen.getByTestId('open-state')).toHaveTextContent('true');
        } finally {
          focusSpy.mockRestore();
        }
      });

      test('clears outside pointer state between keep-mounted open sessions', async () => {
        let readInsideReactTree: () => boolean | undefined = () => false;

        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);

          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          readInsideReactTree = () => store.context.insideReactTree;

          const interactions = [createClick(store), createDismiss(store)];

          return (
            <>
              <span data-testid="open-state">{String(isOpen())}</span>
              <button data-testid="before" />
              <button
                data-testid="reference"
                {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })}
              />
              <FloatingPortal>
                <FloatingFocusManager store={store} disabled={!isOpen()} modal={false}>
                  <div
                    data-testid="floating"
                    {...getFloatingTestProps(interactions, { ref: refs.setFloating })}
                  >
                    <button data-testid="child" />
                  </div>
                </FloatingFocusManager>
              </FloatingPortal>
              <button data-testid="after" />
            </>
          );
        }

        render(() => <TestApp />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('child')).toHaveFocus();
        });

        fire.pointerDown(screen.getByTestId('after'));
        await flushMicrotasks();

        expect(screen.getByTestId('open-state')).toHaveTextContent('false');

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('child')).toHaveFocus();
        });

        fire.focusOut(screen.getByTestId('child'), {
          relatedTarget: screen.getByTestId('after'),
        });

        expect(readInsideReactTree()).toBe(true);
      });
    });

    describe('non-modal + FloatingPortal', () => {
      function PortalApp(props: {
        managerProps?: Partial<FloatingFocusManagerProps>;
        portalOwnerRole?: JSX.AriaAttributes['role'];
      }) {
        const [open, setOpen] = createSignal(false);
        const { refs, store } = createTestFloating({
          open,
          onOpenChange: (value) => setOpen(value),
        });

        return (
          <>
            <span tabindex={0} data-testid="first" />
            <button data-testid="reference" ref={refs.setReference} onClick={() => setOpen(true)} />
            <FloatingPortal portalOwnerRole={props.portalOwnerRole}>
              <Show when={open()}>
                <FloatingFocusManager {...props.managerProps} store={store} modal={false}>
                  <div data-testid="floating" ref={cleanupRef(refs.setFloating)}>
                    <span tabindex={0} data-testid="inside" />
                  </div>
                </FloatingFocusManager>
              </Show>
            </FloatingPortal>
            <span tabindex={0} data-testid="last" />
          </>
        );
      }

      test('focuses inside element, tabbing out focuses last document element', async () => {
        render(() => <PortalApp />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('inside')).toHaveFocus();

        await userEvent.tab();

        expect(screen.queryByTestId('floating')).not.toBeInTheDocument();
        expect(screen.getByTestId('last')).toHaveFocus();
      });

      test.each([
        { name: 'nextFocusableElement', shift: false, expected: 'last' },
        { name: 'previousFocusableElement', shift: true, expected: 'reference' },
      ])(
        'falls back to the outside focus guard when $name is an empty ref',
        async ({ name, shift, expected }) => {
          const emptyRef = { current: null };

          render(() => <PortalApp managerProps={{ [name]: emptyRef }} />);

          await userEvent.click(screen.getByTestId('reference'));
          await flushMicrotasks();

          expect(screen.getByTestId('inside')).toHaveFocus();

          await userEvent.tab({ shift });

          expect(screen.getByTestId(expected)).toHaveFocus();
        },
      );

      test('does not mark reference siblings due to outside focus guards', async () => {
        function TestApp() {
          const [open, setOpen] = createSignal(false);
          const { refs, store } = createTestFloating({
            open,
            onOpenChange: (value) => setOpen(value),
          });

          return (
            <>
              <div data-testid="reference-wrapper">
                <button
                  data-testid="reference"
                  ref={refs.setReference}
                  onClick={() => setOpen(true)}
                />
                <span data-testid="reference-sibling-1" />
                <span data-testid="reference-sibling-2" />
              </div>
              <FloatingPortal>
                <Show when={open()}>
                  <FloatingFocusManager store={store} modal={false}>
                    <div data-testid="floating" ref={cleanupRef(refs.setFloating)}>
                      <span tabindex={0} data-testid="inside" />
                    </div>
                  </FloatingFocusManager>
                </Show>
              </FloatingPortal>
            </>
          );
        }

        render(() => <TestApp />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toBeInTheDocument();
        expect(screen.getByTestId('reference')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('reference-sibling-1')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('reference-sibling-2')).not.toHaveAttribute('data-base-ui-inert');
      });

      test('renders the aria-owns owner without changing regular reference semantics', async () => {
        render(() => <PortalApp />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        const reference = screen.getByTestId('reference');
        const portalNode = screen.getByTestId('floating').closest('[data-base-ui-portal]');
        const portalNodeId = portalNode?.id ?? '';
        const owner = portalNode?.ownerDocument.querySelector('span[aria-owns]');

        expect(portalNodeId).not.toBe('');
        expect(owner).not.toHaveAttribute('role');
        expect(owner).toHaveAttribute('aria-owns', portalNodeId);
        expect(reference).not.toHaveAttribute('aria-owns');
      });

      test('supports setting the aria-owns owner role explicitly', async () => {
        render(() => <PortalApp portalOwnerRole="group" />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        const portalNode = screen.getByTestId('floating').closest('[data-base-ui-portal]');
        const owner = portalNode?.ownerDocument.querySelector('span[aria-owns]');

        expect(portalNode).not.toBe(null);
        expect(owner).toHaveAttribute('role', 'group');
      });

      test('shift+tab', async () => {
        render(() => <PortalApp />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await userEvent.tab({ shift: true });

        expect(screen.getByTestId('floating')).toBeInTheDocument();

        await userEvent.tab({ shift: true });

        expect(screen.queryByTestId('floating')).not.toBeInTheDocument();
      });
    });

    describe('Navigation', () => {
      test('does not focus reference when hovering it', async () => {
        render(() => <Navigation />);
        await userEvent.hover(screen.getByText('Product'));
        await userEvent.unhover(screen.getByText('Product'));
        expect(screen.getByText('Product')).not.toHaveFocus();
      });

      test('returns focus to reference when floating element was opened by hover but is closed by esc key', async () => {
        render(() => <Navigation />);
        await userEvent.hover(screen.getByText('Product'));
        await flushMicrotasks();
        await userEvent.keyboard('{Escape}');
        expect(screen.getByText('Product')).toHaveFocus();
      });

      test('returns focus to reference when floating element was opened by hover but is closed by an explicit close button', async () => {
        render(() => <Navigation />);
        await userEvent.hover(screen.getByText('Product'));
        await flushMicrotasks();
        await userEvent.click(screen.getByText('Close').parentElement!);
        await userEvent.keyboard('{Tab}');
        expect(screen.getByText('Close')).toHaveFocus();
        await userEvent.keyboard('{Enter}');
        expect(screen.getByText('Product')).toHaveFocus();
      });

      test('does not re-open after closing via escape key', async () => {
        render(() => <Navigation />);
        await userEvent.hover(screen.getByText('Product'));
        await userEvent.keyboard('{Escape}');
        expect(screen.queryByText('Link 1')).not.toBeInTheDocument();
      });

      test('closes when unhovering floating element even when focus is inside it', async () => {
        render(() => <Navigation />);
        await userEvent.hover(screen.getByText('Product'));
        await userEvent.click(screen.getByTestId('subnavigation'));
        await userEvent.unhover(screen.getByTestId('subnavigation'));
        await userEvent.hover(screen.getByText('Product'));
        await userEvent.unhover(screen.getByText('Product'));
        expect(screen.queryByTestId('subnavigation')).not.toBeInTheDocument();
      });
    });
  });

  describe('prop: closeOnFocusOut', () => {
    // The floating element stays mounted after it closes, as a popup does during its exit
    // animation or after `preventUnmountOnClose()`.
    function KeptMountedApp(props: { onOpenChange: (open: boolean, reason: string) => void }) {
      const [open, setOpen] = createSignal(true);
      const { refs, store } = createTestFloating({
        open,
        onOpenChange(nextOpen, eventDetails) {
          props.onOpenChange(nextOpen, eventDetails.reason);
          setOpen(nextOpen);
        },
      });

      return (
        <>
          <FloatingFocusManager store={store} modal={false} initialFocus={false} closeOnFocusOut>
            <div
              role="dialog"
              ref={refs.setFloating}
              data-testid="floating"
              data-open={String(open())}
            />
          </FloatingFocusManager>
          <button data-testid="close" onClick={() => setOpen(false)}>
            close
          </button>
          <button data-testid="reference" ref={refs.setReference} />
          <button data-testid="last" />
        </>
      );
    }

    test.each([
      {
        name: 'closes the floating element while it is open',
        closeFirst: false,
        expectedCalls: [[false, 'focus-out']],
      },
      {
        name: 'does not close again a floating element that already closed',
        closeFirst: true,
        expectedCalls: [],
      },
    ])('focus leaving the reference $name', async ({ closeFirst, expectedCalls }) => {
      const handleOpenChange = vi.fn();
      render(() => <KeptMountedApp onOpenChange={handleOpenChange} />);

      if (closeFirst) {
        fire.click(screen.getByTestId('close'));
      }
      expect(screen.getByTestId('floating')).toHaveAttribute('data-open', String(!closeFirst));

      act(() => screen.getByTestId('reference').focus());
      await userEvent.tab();
      await flushMicrotasks();

      expect(screen.getByTestId('last')).toHaveFocus();
      expect(handleOpenChange.mock.calls).toEqual(expectedCalls);
    });
  });

  describe('prop: restoreFocus', () => {
    function RestoreApp(props: { restoreFocus?: boolean | 'popup' }) {
      const [isOpen, setIsOpen] = createSignal(false);
      const [removed, setRemoved] = createSignal(false);
      const twoRef: RefObject<HTMLElement | null> = { current: null };

      const { refs, store } = createTestFloating({
        open: isOpen,
        onOpenChange: (value) => setIsOpen(value),
      });

      const interactions = [createClick(store)];

      return (
        <>
          <button onClick={() => setRemoved(true)}>remove</button>
          <button
            {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })}
            data-testid="reference"
          />
          <Show when={isOpen()}>
            <FloatingFocusManager
              store={store}
              restoreFocus={props.restoreFocus ?? true}
              initialFocus={twoRef}
            >
              <div
                {...getFloatingTestProps(interactions, { ref: cleanupRef(refs.setFloating) })}
                data-testid="floating"
              >
                <button>one</button>
                <Show when={!removed()}>
                  <button
                    ref={(element) => {
                      twoRef.current = element;
                    }}
                  >
                    two
                  </button>
                </Show>
                <button>three</button>
              </div>
            </FloatingFocusManager>
          </Show>
        </>
      );
    }

    test.skipIf(isJSDOM)(
      'true: restores focus to nearest tabbable element if currently focused element is removed',
      async () => {
        render(() => <RestoreApp />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        const two = screen.getByRole('button', { name: 'two' });
        const three = screen.getByRole('button', { name: 'three' });
        const remove = screen.getByText('remove');

        expect(two).toHaveFocus();

        fire.click(remove);

        await waitFor(() => {
          expect(three).toHaveFocus();
        });
      },
    );

    test.skipIf(isJSDOM)(
      'false: does not restore focus to nearest tabbable element if currently focused element is removed',
      async () => {
        render(() => <RestoreApp restoreFocus={false} />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        const two = screen.getByRole('button', { name: 'two' });
        const remove = screen.getByText('remove');

        expect(two).toHaveFocus();

        fire.click(remove);
        await flushMicrotasks();

        await waitFor(() => {
          expect(document.body).toHaveFocus();
        });
      },
    );

    // Holds animation frames until the test runs them, so that focus can move in between.
    function holdAnimationFrames() {
      const frames: FrameRequestCallback[] = [];
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        frames.push(callback);
        return frames.length;
      });
      return () => {
        frames.splice(0).forEach((callback) => callback(performance.now()));
      };
    }

    test.skipIf(isJSDOM)(
      'popup: keeps focus that moved elsewhere before the deferred re-focus',
      async () => {
        render(() => <RestoreApp restoreFocus="popup" />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        const two = screen.getByRole('button', { name: 'two' });
        const three = screen.getByRole('button', { name: 'three' });

        expect(two).toHaveFocus();

        const runAnimationFrames = holdAnimationFrames();
        fire.click(screen.getByText('remove'));
        await flushMicrotasks();
        expect(screen.getByTestId('floating')).toHaveFocus();

        // the app moves focus before the next frame
        three.focus();
        runAnimationFrames();

        expect(three).toHaveFocus();
      },
    );

    test.skipIf(isJSDOM)(
      'popup: re-focuses the popup when focus is still lost on the next frame',
      async () => {
        render(() => <RestoreApp restoreFocus="popup" />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByRole('button', { name: 'two' })).toHaveFocus();

        const runAnimationFrames = holdAnimationFrames();
        fire.click(screen.getByText('remove'));
        await flushMicrotasks();
        const floating = screen.getByTestId('floating');
        expect(floating).toHaveFocus();

        // focus is lost again before the next frame
        floating.blur();
        expect(document.body).toHaveFocus();
        runAnimationFrames();

        expect(floating).toHaveFocus();
      },
    );

    test('restores focus to the nearest tabbable element when the focused element becomes hidden', async () => {
      render(() => <RestoreApp />);

      await userEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      const two = screen.getByRole('button', { name: 'two' });
      const three = screen.getByRole('button', { name: 'three' });

      expect(two).toHaveFocus();

      document.body.tabIndex = -1;
      two.style.visibility = 'hidden';
      document.body.focus();

      try {
        await waitFor(() => {
          expect(three).toHaveFocus();
        });
      } finally {
        document.body.removeAttribute('tabindex');
      }
    });
  });

  describe.skipIf(!isJSDOM)(
    'JSDOM-only coverage: combobox, focus return, hover and tabIndex scenarios',
    () => {
      function createComboboxRole(isOpen: () => boolean): ElementProps {
        return {
          reference: {
            get 'aria-expanded'() {
              return isOpen();
            },
            get 'aria-controls'() {
              return isOpen() ? 'floating' : undefined;
            },
          },
          floating: {
            id: 'floating',
            role: 'listbox',
          },
        };
      }

      test('trapped combobox prevents focus moving outside floating element', async () => {
        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);

          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          const interactions = [createComboboxRole(isOpen), createDismiss(store), createClick(store)];

          return (
            <div class="App">
              <input
                {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })}
                data-testid="input"
                role="combobox"
              />
              <Show when={isOpen()}>
                <FloatingFocusManager store={store}>
                  <div
                    {...getFloatingTestProps(interactions, { ref: cleanupRef(refs.setFloating) })}
                  >
                    <button>one</button>
                    <button>two</button>
                  </div>
                </FloatingFocusManager>
              </Show>
            </div>
          );
        }

        render(() => <TestApp />);
        await userEvent.click(screen.getByTestId('input'));
        await flushMicrotasks();
        expect(screen.getByTestId('input')).not.toHaveFocus();
        expect(screen.getByRole('button', { name: 'one' })).toHaveFocus();
        await userEvent.tab();
        expect(screen.getByRole('button', { name: 'two' })).toHaveFocus();
        await userEvent.tab();
        expect(screen.getByRole('button', { name: 'one' })).toHaveFocus();
        await flushMicrotasks();
      });

      test('untrapped combobox creates non-modal focus management', async () => {
        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);

          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          const interactions = [createComboboxRole(isOpen), createDismiss(store), createClick(store)];

          return (
            <>
              <input
                {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })}
                data-testid="input"
                role="combobox"
              />
              <Show when={isOpen()}>
                <FloatingPortal>
                  <FloatingFocusManager store={store} initialFocus={false} modal={false}>
                    <div
                      {...getFloatingTestProps(interactions, {
                        ref: cleanupRef(refs.setFloating),
                      })}
                    >
                      <button>one</button>
                      <button>two</button>
                    </div>
                  </FloatingFocusManager>
                </FloatingPortal>
              </Show>
              <button>outside</button>
            </>
          );
        }

        render(() => <TestApp />);
        await userEvent.click(screen.getByTestId('input'));
        await flushMicrotasks();
        expect(screen.getByTestId('input')).toHaveFocus();
        await userEvent.tab();
        expect(screen.getByRole('button', { name: 'one' })).toHaveFocus();
        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('input')).toHaveFocus();
      });

      test('returns focus to last connected element', async () => {
        function Drawer(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
          const { refs, store } = createTestFloating({
            open: () => props.open,
            onOpenChange: (value) => props.onOpenChange(value),
          });
          const interactions = [createDismiss(store)];

          return (
            <FloatingFocusManager store={store}>
              <div {...getFloatingTestProps(interactions, { ref: cleanupRef(refs.setFloating) })}>
                <button data-testid="child-reference" />
              </div>
            </FloatingFocusManager>
          );
        }

        function Parent() {
          const [isOpen, setIsOpen] = createSignal(false);
          const [isDrawerOpen, setIsDrawerOpen] = createSignal(false);

          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          const interactions = [createDismiss(store), createClick(store)];

          return (
            <>
              <button
                {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })}
                data-testid="parent-reference"
              />
              <Show when={isOpen()}>
                <FloatingFocusManager store={store}>
                  <div
                    {...getFloatingTestProps(interactions, { ref: cleanupRef(refs.setFloating) })}
                  >
                    Parent Floating
                    <button
                      data-testid="parent-floating-reference"
                      onClick={() => {
                        setIsDrawerOpen(true);
                        setIsOpen(false);
                      }}
                    />
                  </div>
                </FloatingFocusManager>
              </Show>
              <Show when={isDrawerOpen()}>
                <Drawer open={isDrawerOpen()} onOpenChange={(value) => setIsDrawerOpen(value)} />
              </Show>
            </>
          );
        }

        render(() => <Parent />);
        await userEvent.click(screen.getByTestId('parent-reference'));
        await flushMicrotasks();
        expect(screen.getByTestId('parent-floating-reference')).toHaveFocus();
        await userEvent.click(screen.getByTestId('parent-floating-reference'));
        await flushMicrotasks();
        expect(screen.getByTestId('child-reference')).toHaveFocus();
        await userEvent.keyboard('{Escape}');
        expect(screen.getByTestId('parent-reference')).toHaveFocus();
      });

      test('focus is placed on element with floating props when floating element is a wrapper', async () => {
        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);

          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          const role: ElementProps = {
            reference: {
              'aria-haspopup': 'dialog',
              get 'aria-expanded'() {
                return isOpen();
              },
              get 'aria-controls'() {
                return isOpen() ? 'floating' : undefined;
              },
            },
            floating: {
              id: 'floating',
              role: 'dialog',
            },
          };

          const interactions = [role];

          return (
            <>
              <button
                {...getInteractionProps(interactions, 'reference', {
                  ref: refs.setReference,
                  onClick: () => setIsOpen((v) => !v),
                })}
              />
              <Show when={isOpen()}>
                <FloatingFocusManager store={store}>
                  <div ref={cleanupRef(refs.setFloating)} data-testid="outer">
                    <div {...getFloatingTestProps(interactions)} data-testid="inner" />
                  </div>
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <TestApp />);

        await userEvent.click(screen.getByRole('button'));
        await flushMicrotasks();

        expect(screen.getByTestId('inner')).toHaveFocus();
      });

      test.each([
        { name: 'floating element closes upon tabbing out of modal combobox', modal: undefined },
        {
          name: 'untrapped typeable combobox closes on second tab sequence (click -> tab -> click -> tab)',
          modal: true,
        },
      ])('$name', async ({ modal }) => {
        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);

          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          const interactions = [createClick(store)];

          return (
            <>
              <input
                {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })}
                data-testid="input"
                role="combobox"
              />
              <Show when={isOpen()}>
                <FloatingFocusManager store={store} initialFocus={false} modal={modal}>
                  <div
                    {...getFloatingTestProps(interactions, { ref: cleanupRef(refs.setFloating) })}
                    data-testid="floating"
                  >
                    <button tabindex={-1}>one</button>
                  </div>
                </FloatingFocusManager>
              </Show>
              <button data-testid="after" />
            </>
          );
        }

        render(() => <TestApp />);

        await userEvent.click(screen.getByTestId('input'));
        await flushMicrotasks();

        expect(screen.getByTestId('input')).toHaveFocus();

        await userEvent.tab();
        await flushMicrotasks();

        expect(screen.getByTestId('after')).toHaveFocus();

        if (modal) {
          expect(screen.queryByTestId('floating')).not.toBeInTheDocument();

          await userEvent.click(screen.getByTestId('input'));
          await flushMicrotasks();

          expect(screen.getByTestId('input')).toHaveFocus();

          await userEvent.tab();
          await flushMicrotasks();

          expect(screen.getByTestId('after')).toHaveFocus();
          expect(screen.queryByTestId('floating')).not.toBeInTheDocument();
        }
      });

      function HoverApp(props: { outside?: boolean }) {
        const [isOpen, setIsOpen] = createSignal(false);

        const { refs, store, elements } = createTestFloating({
          open: isOpen,
          onOpenChange: (value) => setIsOpen(value),
        });

        const hoverReferenceProps = createHoverTriggerInteraction(store, {
          get triggerElement() {
            return elements.reference();
          },
        });
        createHoverPopupInteraction(store);

        const interactions: ElementProps[] = [{ reference: hoverReferenceProps }];

        return (
          <>
            <button
              {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })}
              data-testid="reference"
            />
            <Show when={isOpen()}>
              <FloatingFocusManager store={store}>
                <div
                  {...getFloatingTestProps(interactions, { ref: cleanupRef(refs.setFloating) })}
                  data-testid="floating"
                />
              </FloatingFocusManager>
            </Show>
            <Show when={props.outside}>
              <button>outside</button>
            </Show>
          </>
        );
      }

      test('focus does not return to reference when floating element is triggered by hover', async () => {
        render(() => <HoverApp />);

        const reference = screen.getByTestId('reference');

        act(() => reference.focus());

        await userEvent.hover(reference);
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toHaveFocus();

        await userEvent.unhover(screen.getByTestId('floating'));

        expect(screen.queryByTestId('floating')).toBe(null);
        expect(screen.getByTestId('reference')).not.toHaveFocus();
      });

      test('uses aria-hidden instead of inert on outside nodes if opened with hover and modal=true', async () => {
        render(() => <HoverApp outside />);

        await userEvent.hover(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByText('outside')).not.toHaveAttribute('inert');
        expect(screen.getByText('outside')).toHaveAttribute('aria-hidden', 'true');
      });

      test('floating element with no focusable elements and no listbox role gets tabIndex=0 when initialFocus is -1', async () => {
        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);

          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          return (
            <>
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setIsOpen(true)}
              />
              <Show when={isOpen()}>
                <FloatingFocusManager store={store} initialFocus={false} modal={false}>
                  <div ref={cleanupRef(refs.setFloating)} data-testid="floating" role="dialog" />
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <TestApp />);

        const reference = screen.getByTestId('reference');
        await userEvent.click(reference);
        await flushMicrotasks();
        fire.focusOut(reference);
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '0');
      });

      test('floating element with managed tabIndex is downgraded once content becomes tabbable', async () => {
        const [hasTabbableContent, setHasTabbableContent] = createSignal(false);

        function TestApp() {
          const { refs, store } = createTestFloating({
            open: () => true,
            onOpenChange() {},
          });

          return (
            <>
              <button data-testid="reference" ref={refs.setReference} />
              <FloatingFocusManager store={store} initialFocus={false} modal={false}>
                <div ref={refs.setFloating} data-testid="floating" role="dialog">
                  <Show when={hasTabbableContent()}>
                    <button data-testid="inside" />
                  </Show>
                </div>
              </FloatingFocusManager>
            </>
          );
        }

        render(() => <TestApp />);
        await flushMicrotasks();

        const reference = screen.getByTestId('reference');
        reference.focus();

        expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('floating')).toHaveAttribute('data-tabindex', '0');

        act(() => setHasTabbableContent(true));
        await flushMicrotasks();

        fire.focusOut(reference, { relatedTarget: screen.getByTestId('inside') });
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '-1');
        expect(screen.getByTestId('floating')).toHaveAttribute('data-tabindex', '-1');
      });

      test('floating element with listbox role ignores tabIndex setting', async () => {
        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);

          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          const interactions = [createClick(store)];

          return (
            <>
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setIsOpen(true)}
                {...getInteractionProps(interactions, 'reference')}
              >
                ref
              </button>
              <Show when={isOpen()}>
                <FloatingFocusManager store={store} initialFocus={false} modal={false}>
                  <div
                    ref={cleanupRef(refs.setFloating)}
                    role="listbox"
                    data-testid="floating"
                    {...getFloatingTestProps(interactions)}
                  >
                    floating
                  </div>
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <TestApp />);
        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '-1');
      });

      test('handles manual tabindex on dialog floating element', async () => {
        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);

          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          return (
            <>
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setIsOpen(true)}
              />
              <Show when={isOpen()}>
                <FloatingFocusManager store={store} modal={false}>
                  <div ref={cleanupRef(refs.setFloating)} data-testid="floating" role="dialog" />
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <TestApp />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '0');
        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('reference')).toHaveFocus();
        await userEvent.tab();
        expect(screen.getByTestId('floating')).toHaveFocus();
      });

      test('standard tabbing back and forth of a non-modal floating element', async () => {
        function TestApp() {
          const [isOpen, setIsOpen] = createSignal(false);

          const { refs, store } = createTestFloating({
            open: isOpen,
            onOpenChange: (value) => setIsOpen(value),
          });

          const interactions = [createClick(store)];

          return (
            <>
              <button
                data-testid="reference"
                {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })}
              />
              <Show when={isOpen()}>
                <FloatingPortal>
                  <FloatingFocusManager store={store} modal={false}>
                    <div
                      {...getFloatingTestProps(interactions, {
                        ref: cleanupRef(refs.setFloating),
                      })}
                      data-testid="floating"
                      role="dialog"
                    >
                      <button data-testid="inner">inner</button>
                    </div>
                  </FloatingFocusManager>
                </FloatingPortal>
              </Show>
            </>
          );
        }
        render(() => <TestApp />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '-1');
        expect(screen.getByTestId('inner')).toHaveFocus();
        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('reference')).toHaveFocus();
        await userEvent.tab();
        expect(screen.getByTestId('inner')).toHaveFocus();
      });
    },
  );
});
