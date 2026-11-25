import {
  Show,
  createEffect,
  createMemo,
  createSignal,
  flush,
  onCleanup,
  type Accessor,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { Dimensions } from '@floating-ui/utils';
import { createAnimationFrame } from '@egoist/solid-base-utils/animationFrame';
import { createPreviousValue } from '@egoist/solid-base-utils/previousValue';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { createAnimationsFinished } from '../../../internals/animationsFinished';
import type { StateAttributesMapping } from '../../../internals/getStateAttributesProps';
import type { Side } from '../../../internals/anchorPositioning';
import { useDirection } from '../../../internals/direction-context/DirectionContext';
import type { ReactiveStore } from '../reactiveStore';
import { adaptiveOrigin } from '../positioning/adaptiveOriginMiddleware';
import { createPopupAutoResize } from './popupAutoResize';
import * as CommonPopupCssVars from './CommonPopupCssVars';
import * as CommonViewportDataAttributes from './CommonViewportDataAttributes';

export const popupViewportStateMapping: StateAttributesMapping<{
  activationDirection: string | undefined;
}> = {
  activationDirection: (value) =>
    value
      ? {
          [CommonViewportDataAttributes.activationDirection]: value,
        }
      : null,
};

export interface PopupViewportState {
  /**
   * Direction from which the popup was activated, used for directional animations.
   */
  activationDirection: string | undefined;
  /**
   * Whether the viewport is currently transitioning between contents.
   */
  transitioning: boolean;
}

/**
 * The store members the viewport reads (`activeTriggerElement`, `activeTriggerId`, `open`,
 * `payload`, `mounted`, `popupElement`, `positionerElement`) and writes (`adaptiveOrigin`).
 */
export type PopupViewportStore = Pick<ReactiveStore<any, any, any>, 'select' | 'set'>;

export interface CreatePopupViewportParameters {
  /**
   * Popup store instance for accessing shared popup state.
   */
  store: PopupViewportStore;
  /**
   * Side of the positioner relative to the trigger.
   * Read lazily (pass a getter for a reactive value).
   */
  readonly side: Side;
  /**
   * Viewport children to render in the current container.
   * Read lazily (pass a getter): it is read again each time the current container remounts, so
   * the content is created anew for every trigger.
   */
  readonly children?: JSX.Element;
}

export interface CreatePopupViewportReturnValue {
  /**
   * The viewport children wrapped in current/previous containers as needed.
   */
  children: JSX.Element;
  /**
   * Viewport state used for data attributes and render prop styling. Its properties are getters.
   */
  state: PopupViewportState;
}

interface PreviousContent {
  /**
   * The DOM nodes of the content that was displayed before the active trigger changed.
   */
  readonly nodes: readonly Node[];
}

/**
 * Builds morphing viewport containers for popups that animate between trigger-based content.
 * Handles previous-content snapshots, auto-resize, and state attributes for transitions.
 *
 * The current content is rendered in a `[data-current]` container that remounts (re-reading
 * `children`) whenever the active trigger changes. When the popup moves to another trigger while
 * open, the DOM of the remounted container is kept as a frozen snapshot in an inert
 * `[data-previous]` container until the current container's animations finish.
 *
 * Parameters are read lazily, like Solid props:
 * `createPopupViewport({ store, get side() { return positioner.side }, get children() { return props.children } })`.
 */
export function createPopupViewport(
  parameters: CreatePopupViewportParameters,
): CreatePopupViewportReturnValue {
  const { store } = parameters;

  const direction = useDirection();

  const activeTrigger = () => store.select('activeTriggerElement') as Element | null;
  const activeTriggerId = () => store.select('activeTriggerId') as string | null;
  const open = () => store.select('open') as boolean;
  const payload = () => store.select('payload') as unknown;
  const mounted = () => store.select('mounted') as boolean;

  const previousActiveTrigger = createPreviousValue(() => (open() ? activeTrigger() : null));
  // Remount current content on trigger changes (and once more when payload lags) to avoid DOM reuse flashes.
  // The key bumps immediately on trigger switches, then again if the payload arrives on a later update.
  const currentContentKey = createPopupContentKey(activeTriggerId, payload);

  // The child nodes of the last current container that was disposed by a key change. Solid
  // disposes the old container before its bindings see the new state, so these nodes still show
  // the content as it was right before the change: they become the previous content snapshot.
  let detachedContent: Node[] | null = null;
  const [previousContent, setPreviousContent] = createSignal<PreviousContent | null>(null);

  const [newTriggerOffset, setNewTriggerOffset] = createSignal<Offset | null>(null);

  let currentContainer: HTMLDivElement | null = null;
  let previousContainer: HTMLDivElement | null = null;

  const onAnimationsFinished = createAnimationsFinished(() => currentContainer, true);
  const cleanupFrame = createAnimationFrame();
  let cleanupController: AbortController | null = null;

  const [previousContentDimensions, setPreviousContentDimensions] =
    createSignal<Dimensions | null>(null);

  const [showStartingStyleAttribute, setShowStartingStyleAttribute] = createSignal(false);

  store.set('adaptiveOrigin', adaptiveOrigin);
  onCleanup(() => {
    store.set('adaptiveOrigin', undefined);
  });

  function handleMeasureLayout() {
    currentContainer?.style.setProperty('animation', 'none');
    currentContainer?.style.setProperty('transition', 'none');

    previousContainer?.style.setProperty('display', 'none');
  }

  function handleMeasureLayoutComplete(previousDimensions: Dimensions | null) {
    currentContainer?.style.removeProperty('animation');
    currentContainer?.style.removeProperty('transition');

    previousContainer?.style.removeProperty('display');

    if (previousDimensions) {
      setPreviousContentDimensions(previousDimensions);
    }
  }

  function armViewportCleanup() {
    cleanupController?.abort();
    const controller = new AbortController();
    cleanupController = controller;
    onAnimationsFinished(() => {
      setPreviousContent(null);
      setPreviousContentDimensions(null);
      detachedContent = null;
    }, controller.signal);
  }

  let lastHandledTrigger: Element | null = null;

  createEffect(
    () => open() && mounted(),
    (active) => {
      if (!active) {
        lastHandledTrigger = null;
        detachedContent = null;
      }
    },
  );

  createEffect(
    () => ({
      open: open(),
      activeTrigger: activeTrigger(),
      previousActiveTrigger: previousActiveTrigger(),
    }),
    (values) => {
      // When a trigger changes, keep the content displayed before the change,
      // so we can render both new and old content.
      // `previousActiveTrigger` keeps the last open trigger while closed, so a trigger that
      // remounts while the popup is closed must not start a transition.
      if (
        values.open &&
        values.activeTrigger &&
        values.previousActiveTrigger &&
        values.activeTrigger !== values.previousActiveTrigger &&
        lastHandledTrigger !== values.activeTrigger
      ) {
        // The current container normally remounted with this change. If it did not (the trigger
        // element changed but its id did not), fall back to a copy of the current content.
        const nodes = detachedContent ?? cloneChildNodes(currentContainer);
        detachedContent = null;
        if (!nodes) {
          return;
        }

        setPreviousContent({ nodes });
        setShowStartingStyleAttribute(true);

        // Calculate the relative position between the previous and new trigger,
        // so we can expose it for animation purposes.
        const offset = calculateRelativePosition(
          values.previousActiveTrigger,
          values.activeTrigger,
        );
        setNewTriggerOffset(offset);

        lastHandledTrigger = values.activeTrigger;
      }
    },
  );

  // Arm cleanup after a trigger change, and re-arm it if the current container remounts
  // mid-transition when a lagging payload bumps `currentContentKey`. The remount discards
  // the running entry animation (and with transition-style CSS the replacement mounts at
  // final styles with no animation at all), so re-run the starting-style choreography —
  // otherwise the watcher either strands or fires before the previous container's exit
  // animation finishes.
  createEffect(
    () => [currentContentKey(), previousContent()] as const,
    ([, content]) => {
      if (content == null) {
        return;
      }

      // Abort the stale watcher synchronously. The remount cancels the old container's
      // animations, and the resulting promise rejection would otherwise run the cleanup
      // in a microtask before the re-armed watcher below is in place.
      cleanupController?.abort();

      setShowStartingStyleAttribute(true);

      cleanupFrame.request(() => {
        setShowStartingStyleAttribute(false);
        flush();
        armViewportCleanup();
      });
    },
  );

  // When previous content is present, imperatively populate the previous container with it.
  createEffect(previousContent, (content) => {
    if (!content) {
      previousContainer = null;
      return;
    }
    previousContainer?.replaceChildren(...content.nodes);
  });

  const previousContainerStyle = (): JSX.CSSProperties => {
    const dimensions = previousContentDimensions();
    return {
      ...(dimensions
        ? {
            [CommonPopupCssVars.popupWidth]: `${dimensions.width}px`,
            [CommonPopupCssVars.popupHeight]: `${dimensions.height}px`,
          }
        : null),
      position: 'absolute',
    };
  };

  const children = (
    <>
      <Show when={previousContent()}>
        <div
          data-previous="true"
          inert
          ref={(element) => {
            previousContainer = element;
          }}
          style={previousContainerStyle()}
          data-ending-style={showStartingStyleAttribute() ? undefined : ''}
        />
      </Show>
      <Show when={currentContentKey()} keyed>
        {(_key: string) => {
          let element: HTMLDivElement | undefined;
          onCleanup(() => {
            if (!element) {
              return;
            }
            detachedContent = Array.from(element.childNodes);
            if (currentContainer === element) {
              currentContainer = null;
            }
          });
          return (
            <div
              data-current="true"
              ref={(node) => {
                element = node;
                currentContainer = node;
              }}
              data-starting-style={
                previousContent() != null && showStartingStyleAttribute() ? '' : undefined
              }
            >
              {parameters.children}
            </div>
          );
        }}
      </Show>
    </>
  );

  createPopupAutoResize({
    get popupElement() {
      return store.select('popupElement') as HTMLElement | null;
    },
    get positionerElement() {
      return store.select('positionerElement') as HTMLElement | null;
    },
    get mounted() {
      return mounted();
    },
    get content() {
      return payload();
    },
    onMeasureLayout: handleMeasureLayout,
    onMeasureLayoutComplete: handleMeasureLayoutComplete,
    get side() {
      return parameters.side;
    },
    get direction() {
      return direction();
    },
  });

  const state: PopupViewportState = {
    get activationDirection() {
      return getActivationDirection(newTriggerOffset());
    },
    get transitioning() {
      return previousContent() != null;
    },
  };

  return { children, state };
}

function cloneChildNodes(source: HTMLElement | null): Node[] | null {
  if (!source) {
    return null;
  }
  const doc = ownerDocument(source);
  return Array.from(source.childNodes, (child) => doc.importNode(child, true));
}

export type Offset = {
  horizontal: number;
  vertical: number;
};

/**
 * Returns a string describing the provided offset.
 * It describes both the horizontal and vertical offset, separated by a space.
 *
 * @param offset
 */
export function getActivationDirection(offset: Offset | null): string | undefined {
  if (!offset) {
    return undefined;
  }

  return `${getValueWithTolerance(offset.horizontal, 5, 'right', 'left')} ${getValueWithTolerance(offset.vertical, 5, 'down', 'up')}`;
}

/**
 * Returns a label describing the value (positive/negative) treating values
 * within tolerance as zero.
 *
 * @param value Value to check
 * @param tolerance Tolerance to treat the value as zero.
 * @param positiveLabel
 * @param negativeLabel
 * @returns If 0 < abs(value) < tolerance, returns an empty string. Otherwise returns positiveLabel or negativeLabel.
 */
function getValueWithTolerance(
  value: number,
  tolerance: number,
  positiveLabel: string,
  negativeLabel: string,
) {
  if (value > tolerance) {
    return positiveLabel;
  }

  if (value < -tolerance) {
    return negativeLabel;
  }

  return '';
}

/**
 * Calculates the relative position between centers of two elements.
 */
export function calculateRelativePosition(from: Element, to: Element): Offset {
  const fromRect = from.getBoundingClientRect();
  const toRect = to.getBoundingClientRect();

  const fromCenter = {
    x: fromRect.left + fromRect.width / 2,
    y: fromRect.top + fromRect.height / 2,
  };
  const toCenter = {
    x: toRect.left + toRect.width / 2,
    y: toRect.top + toRect.height / 2,
  };

  return {
    horizontal: toCenter.x - fromCenter.x,
    vertical: toCenter.y - fromCenter.y,
  };
}

/**
 * Returns a key that forces remounting content when triggers change or a payload is updated.
 */
function createPopupContentKey(
  activeTriggerId: Accessor<string | null>,
  payload: Accessor<unknown>,
): Accessor<string> {
  let contentKey = 0;
  let initialized = false;
  let previousActiveTriggerId: string | null = null;
  let previousPayload: unknown;
  let pendingPayloadUpdate = false;

  return createMemo(() => {
    const currentActiveTriggerId = activeTriggerId();
    const currentPayload = payload();

    if (initialized) {
      // Compare against the last seen values to decide whether we need a new DOM subtree.
      const triggerIdChanged = currentActiveTriggerId !== previousActiveTriggerId;
      const payloadChanged = currentPayload !== previousPayload;

      if (triggerIdChanged) {
        // Remount immediately on trigger change; remember if payload hasn't caught up yet.
        contentKey += 1;
        pendingPayloadUpdate = !payloadChanged;
      } else if (pendingPayloadUpdate && payloadChanged) {
        // Payload arrived an update later, so remount once more to avoid reusing the old <img>.
        contentKey += 1;
        pendingPayloadUpdate = false;
      }
    }

    // Persist current values for the next comparison.
    initialized = true;
    previousActiveTriggerId = currentActiveTriggerId;
    previousPayload = currentPayload;

    return `${currentActiveTriggerId ?? 'current'}-${contentKey}`;
  });
}
