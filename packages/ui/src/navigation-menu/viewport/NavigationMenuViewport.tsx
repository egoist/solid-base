import { Show, createEffect, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { contains } from '@egoist/solid-base-utils/shadowDom';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { createBaseUiId } from '../../internals/baseUiId';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { FocusGuard } from '../../utils/popups/focus/FocusGuard';
import {
  getNextTabbable,
  getPreviousTabbable,
  isOutsideEvent,
} from '../../utils/popups/focus/tabbable';
import { useNavigationMenuPositionerContext } from '../positioner/NavigationMenuPositionerContext';

function Guards(props: { children?: JSX.Element }) {
  const context = useNavigationMenuRootContext();
  const hasPositioner = Boolean(useNavigationMenuPositionerContext(true));

  const referenceElement = () => context.positionerElement || context.viewportElement;
  const enabled = () => context.floatingRootStore != null || hasPositioner;

  let beforeInside: HTMLSpanElement | null = null;
  let afterInside: HTMLSpanElement | null = null;

  onCleanup(() => {
    if (context.beforeInsideRef.current === beforeInside) {
      context.beforeInsideRef.current = null;
    }
    if (context.afterInsideRef.current === afterInside) {
      context.afterInsideRef.current = null;
    }
  });

  return (
    <>
      <Show when={enabled()}>
        <FocusGuard
          ref={(element: HTMLSpanElement) => {
            beforeInside = element;
            context.beforeInsideRef.current = element;
          }}
          // `focusin` (React's `onFocus`) runs after the Positioner's capture listener re-enables
          // the tabbable elements inside it, unlike the native `focus` event.
          onFocusIn={(event) => {
            const reference = referenceElement();
            if (reference && isOutsideEvent(event, reference)) {
              getNextTabbable(reference)?.focus();
            } else {
              context.beforeOutsideRef.current?.focus();
            }
          }}
        />
      </Show>
      {props.children}
      <Show when={enabled()}>
        <FocusGuard
          ref={(element: HTMLSpanElement) => {
            afterInside = element;
            context.afterInsideRef.current = element;
          }}
          onFocusIn={(event) => {
            const reference = referenceElement();
            if (reference && isOutsideEvent(event, reference)) {
              getPreviousTabbable(reference)?.focus();
            } else {
              context.afterOutsideRef.current?.focus();
            }
          }}
        />
      </Show>
    </>
  );
}

/**
 * The clipping viewport of the navigation menu's current content.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Navigation Menu](https://base.egoist.dev/components/navigation-menu)
 */
export function NavigationMenuViewport(componentProps: NavigationMenuViewport.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'id');

  const id = createBaseUiId(() => componentProps.id as string | undefined);

  const context = useNavigationMenuRootContext();

  const positioning = useNavigationMenuPositionerContext(true);
  const hasPositioner = Boolean(positioning);
  const domReference = () => context.floatingRootStore?.select('anchorElement') ?? null;

  createEffect(domReference, (element) => {
    if (element) {
      context.prevTriggerElementRef.current = element;
    }
  });

  let viewportElement: HTMLElement | null = null;
  let viewportTargetElement: HTMLElement | null = null;
  onCleanup(() => {
    if (viewportElement && untrack(() => context.viewportElement) === viewportElement) {
      context.setViewportElement(null);
    }
    if (
      viewportTargetElement &&
      untrack(() => context.viewportTargetElement) === viewportTargetElement
    ) {
      context.setViewportTargetElement(null);
    }
  });

  const element = () =>
    renderElement('div', componentProps, {
      ref: (el: HTMLElement) => {
        viewportElement = el;
        context.setViewportElement(el);
      },
      props: [
        {
          get id() {
            return id();
          },
          onFocusOut(event: FocusEvent) {
            const relatedTarget = event.relatedTarget as Element | null;
            const currentTarget = event.currentTarget as Element;

            // If focus is leaving the viewport and not going to the trigger, make it inert
            // to prevent a focus loop.
            if (
              relatedTarget &&
              !contains(currentTarget, relatedTarget) &&
              relatedTarget !== untrack(domReference)
            ) {
              context.setViewportInert(true);
            }
          },
          get inert() {
            return !hasPositioner && context.viewportInert ? true : undefined;
          },
          get children() {
            return hasPositioner ? (
              componentProps.children
            ) : (
              <Guards>
                <div
                  ref={(el: HTMLDivElement) => {
                    viewportTargetElement = el;
                    context.setViewportTargetElement(el);
                  }}
                >
                  {componentProps.children}
                </div>
              </Guards>
            );
          },
        },
        elementProps,
      ],
    });

  return hasPositioner ? <Guards>{element()}</Guards> : element();
}

export interface NavigationMenuViewportState {}

export interface NavigationMenuViewportProps extends BaseUIComponentProps<
  'div',
  NavigationMenuViewportState
> {}

export namespace NavigationMenuViewport {
  export type State = NavigationMenuViewportState;
  export type Props = NavigationMenuViewportProps;
}
