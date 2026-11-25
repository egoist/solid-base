import { createEffect, createMemo, createSignal, onCleanup, untrack, type Accessor } from 'solid-js';
import { isDev } from '@solidjs/web';
import { addEventListener } from '@egoist/solid-base-utils/addEventListener';
import { AnimationFrame } from '@egoist/solid-base-utils/animationFrame';
import { Timeout } from '@egoist/solid-base-utils/timeout';
import { warn } from '@egoist/solid-base-utils/warn';
import { ownerWindow } from '@egoist/solid-base-utils/owner';
import type { HTMLProps } from '../../internals/types';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';
import { createAnimationsFinished } from '../../internals/animationsFinished';
import type { TransitionStatus } from '../../internals/transitionStatus';
import * as CollapsiblePanelDataAttributes from './CollapsiblePanelDataAttributes';
import type { CollapsibleRoot } from '../root/CollapsibleRoot';

type AnimationType = 'css-transition' | 'css-animation' | 'none';

interface Dimensions {
  height: number | undefined;
  width: number | undefined;
}

const EMPTY_DIMENSIONS: Dimensions = {
  height: undefined,
  width: undefined,
};

export interface CreateCollapsiblePanelParameters {
  /**
   * Allows the browser's built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   */
  hiddenUntilFound: Accessor<boolean>;
  /**
   * The `id` attribute of the panel.
   */
  id: Accessor<string | undefined>;
  /**
   * Whether to keep the element in the DOM while the panel is closed.
   * This prop is ignored when `hiddenUntilFound` is used.
   */
  keepMounted: Accessor<boolean>;
  /**
   * Whether the collapsible panel is mounted for transition and hidden-state
   * purposes. This can be `false` while the element remains in the DOM when
   * `keepMounted` or `hiddenUntilFound` is enabled.
   */
  mounted: Accessor<boolean>;
  onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
  /**
   * Whether the collapsible panel is currently open.
   */
  open: Accessor<boolean>;
  setMounted: (nextMounted: boolean) => void;
  setOpen: (nextOpen: boolean) => void;
  transitionStatus: Accessor<TransitionStatus>;
}

export interface CreateCollapsiblePanelReturnValue {
  height: Accessor<number | undefined>;
  /**
   * Live props for the panel element.
   */
  props: HTMLProps;
  ref: (element: HTMLElement) => void;
  shouldPreventOpenAnimation: Accessor<boolean>;
  shouldRender: Accessor<boolean>;
  transitionStatus: Accessor<TransitionStatus>;
  width: Accessor<number | undefined>;
}

/**
 * The open/close logic of a collapsible panel: it measures the panel to expose its size as CSS
 * variables, sequences the CSS transition or keyframe animation, and supports
 * `hidden="until-found"`.
 */
export function createCollapsiblePanel(
  parameters: CreateCollapsiblePanelParameters,
): CreateCollapsiblePanelReturnValue {
  const { open, mounted, transitionStatus, setMounted, setOpen } = parameters;

  // The element is kept in a plain variable for imperative reads; the signal lets effects
  // re-run when the rendered element changes.
  let panelNode: HTMLElement | null = null;
  const [panelElement, setPanelElement] = createSignal<HTMLElement | null>(null);
  // Solid doesn't call refs with `null` on unmount: treat a detached element as missing.
  const getPanel = () => (panelNode?.isConnected ? panelNode : null);
  // The latest committed `open` value, for callbacks running outside of reactive scopes.
  let latestOpen = untrack(open);

  let animationType: AnimationType | null = null;
  const [dimensions, setDimensionsUnwrapped] = createSignal<Dimensions>(EMPTY_DIMENSIONS);
  let lastMeasuredDimensions: Dimensions = EMPTY_DIMENSIONS;
  // `beforematch` should reveal the matched content immediately, so the next
  // open cycle skips author-defined motion once and then returns to normal.
  let shouldSkipNextOpen = false;
  // Keyframe mount animations on initially open panels cause a visible layout
  // shift during the server-rendered first paint, so suppress that first open
  // lifecycle until the panel has been closed once. Read once, like a default value.
  // Derived: it stays `true` while the panel is open, and turns `false` for good once it closed.
  const initiallyOpen = untrack(open);
  const shouldPreventOpenAnimation = createMemo<boolean>(
    (prevented) => (prevented ?? initiallyOpen) && open(),
    { name: 'createCollapsiblePanel.shouldPreventOpenAnimation' },
  );
  // Some open paths intentionally bypass motion, but the shared root transition
  // status still advances asynchronously. Override the panel's `starting` status to idle so its
  // data attributes and dimension cleanup reflect the immediate open state. Set on every
  // opening pass (it only applies while the root reports `starting`).
  const [forcePanelIdle, setForcePanelIdle] = createSignal(false, {
    name: 'createCollapsiblePanel.forcePanelIdle',
  });
  let pendingTemporaryStyleRestore: (() => void) | null = null;

  // Only used to handle panel close.
  const runOnceCloseAnimationsFinish = createAnimationsFinished(getPanel);

  const hidden = () => !open() && !mounted();
  const panelTransitionStatus = (): TransitionStatus => {
    const status = transitionStatus();
    return status === 'starting' && forcePanelIdle() ? 'idle' : status;
  };

  const renderedDimensions = (): Dimensions => {
    const current = dimensions();
    if (
      !open() &&
      mounted() &&
      // Restores a previously measured pixel size after the live dimensions have been reset back
      // to `auto`, for CSS keyframe closes.
      animationType === 'css-animation' &&
      current.height === undefined &&
      current.width === undefined
    ) {
      return lastMeasuredDimensions;
    }
    return current;
  };

  const shouldPersistHiddenTransitionStyles = () =>
    parameters.hiddenUntilFound() && hidden() && animationType !== 'css-animation';

  // Most measured dimensions are reused later when CSS keyframe closes need a
  // pixel size after the rendered dimensions have been reset back to `auto`.
  // Passing `false` is only for clearing the current dimensions state.
  function setDimensions(nextDimensions: Dimensions, shouldCacheMeasurement = true) {
    if (shouldCacheMeasurement) {
      lastMeasuredDimensions = nextDimensions;
    }
    setDimensionsUnwrapped(nextDimensions);
  }

  function restorePendingTemporaryStyle() {
    pendingTemporaryStyleRestore?.();
    pendingTemporaryStyleRestore = null;
  }

  function setPendingTemporaryStyleRestore(restore: () => void) {
    restorePendingTemporaryStyle();
    pendingTemporaryStyleRestore = () => {
      pendingTemporaryStyleRestore = null;
      restore();
    };
  }

  onCleanup(() => {
    restorePendingTemporaryStyle();
  });

  createEffect(open, (isOpen) => {
    latestOpen = isOpen;
  });

  // Sequences the open and close passes. It measures the rendered panel (its animation type and
  // size), so it runs once the DOM updated, and reads the current state when it does. It runs
  // when the panel opens (the status is `starting` in the same update) or closes, when the
  // deferred `ending` status lands, and when the element changes; not on the status changes it
  // causes itself by unmounting the panel.
  const isEnding = createMemo(() => transitionStatus() === 'ending', {
    name: 'createCollapsiblePanel.isEnding',
  });

  function readPanelState() {
    return untrack(
      () => [open(), transitionStatus(), shouldPreventOpenAnimation()] as const,
    );
  }

  createEffect(
    () => [open(), isEnding(), shouldPreventOpenAnimation(), panelElement()] as const,
    () => {
      const [isOpen, status, preventOpenAnimation] = readPanelState();
      const panel = getPanel();
      if (!panel) {
        return undefined;
      }

      // `beforematch` can temporarily force a `0s` motion duration so the matched
      // content reveals immediately. Restore the authored duration before detecting
      // the next close animation type, otherwise that first close is misread as
      // "no motion" and the close transition or keyframe gets skipped.
      if (!isOpen && pendingTemporaryStyleRestore) {
        restorePendingTemporaryStyle();
      }

      const nextAnimationType = getAnimationType(panel, preventOpenAnimation);
      animationType = nextAnimationType;

      // Initially open keyframe panels skip their first paint animation to avoid
      // layout shift, but we still need to cache the expanded size so the first
      // close animation can start from pixels instead of `auto`.
      if (
        isOpen &&
        status === 'idle' &&
        preventOpenAnimation &&
        nextAnimationType === 'css-animation'
      ) {
        lastMeasuredDimensions = getDimensions(panel);
        return undefined;
      }

      // Handle the opening pass: measure the expanded size and, when necessary,
      // neutralize author-defined motion so the panel can open immediately.
      if (isOpen && status === 'starting') {
        // `beforematch` opens should reveal the panel immediately so find-in-page
        // does not wait for the author-defined transition or animation to finish.
        const skipNextOpen = shouldSkipNextOpen;
        shouldSkipNextOpen = false;

        setForcePanelIdle(nextAnimationType === 'none' || skipNextOpen);

        if (nextAnimationType === 'none') {
          setDimensions(getDimensions(panel));
          return undefined;
        }

        if (nextAnimationType === 'css-transition') {
          const restoreLayoutStyles = resetLayoutStyles(panel);
          setDimensions(getDimensions(panel));

          if (!skipNextOpen) {
            return restoreLayoutStyles;
          }

          const restoreTransitionDuration = setTemporaryStyle(panel, 'transition-duration', '0s');
          setPendingTemporaryStyleRestore(restoreTransitionDuration);
          return restoreLayoutStyles;
        }

        setDimensions(getDimensions(panel));

        const restoreAnimationName = setTemporaryStyle(panel, 'animation-name', 'none');
        if (!skipNextOpen) {
          restoreAnimationName();
          return undefined;
        }

        const restoreAnimationDuration = setTemporaryStyle(panel, 'animation-duration', '0s');

        restoreAnimationName();
        setPendingTemporaryStyleRestore(restoreAnimationDuration);

        return undefined;
      }

      // Capture the current size as soon as close is requested, before the
      // deferred ending phase applies closed styles. This keeps close transitions
      // starting from a measured pixel value, including interrupted opens. (A closed panel only
      // reports `idle` or `starting` while it's still mounted, before `ending` lands.)
      if (!isOpen && (status === 'idle' || status === 'starting')) {
        if (nextAnimationType === 'none') {
          setDimensions(EMPTY_DIMENSIONS, false);
          setMounted(false);
          return undefined;
        }

        setDimensions(getDimensions(panel));
        return undefined;
      }

      if (status !== 'ending') {
        return undefined;
      }

      // Reachable when the transition status already flipped to `ending` before this effect
      // ran, so the close branch above was skipped. Without motion (or without a size to animate
      // from) there is nothing to wait for: the animation-finished path below unmounts the panel
      // right away.
      if (nextAnimationType === 'none') {
        return undefined;
      }

      const nextDimensions = getDimensions(panel);
      const hasMeasuredSize = nextDimensions.height > 0 || nextDimensions.width > 0;

      if (!hasMeasuredSize) {
        return undefined;
      }

      setDimensions(nextDimensions);

      if (nextAnimationType === 'css-animation') {
        const restoreAnimationName = setTemporaryStyle(panel, 'animation-name', 'none');
        restoreAnimationName();
      }

      return undefined;
    },
  );

  createOpenChangeComplete({
    // Reading the element signal restarts the watch when the rendered element changes.
    enabled: () =>
      panelElement() != null && open() && mounted() && panelTransitionStatus() === 'idle',
    open: () => true,
    element: getPanel,
    onComplete() {
      // Animations report completion through their `finished` promises, so the measured size
      // is rendered for at least one turn before it's reset to `auto`. Keep that ordering when
      // the wait completes synchronously (no animations to inspect, or no animations API).
      queueMicrotask(() => {
        // The animation's `finished` promise can resolve after `open` became `false` but before
        // the effect cleanup aborted it. Clearing the measured size in that window would make
        // the close transition start from `height: 0` instead of the expanded pixel height.
        if (!latestOpen) {
          return;
        }

        setDimensions(EMPTY_DIMENSIONS, false);
      });
    },
  });

  // Closing panels need extra sequencing beyond `createOpenChangeComplete`.
  // This effect runs after the `ending` update has been applied, so
  // `[data-ending-style]` is already present. Chrome can still register the
  // exit transition one frame later when an Accordion closes one item while
  // opening another, so wait one frame before watching animations.
  // See https://github.com/mui/base-ui/issues/3099
  createEffect(
    () => !open() && mounted() && panelTransitionStatus() === 'ending',
    (isEnding) => {
      if (!isEnding) {
        return undefined;
      }

      const panel = getPanel();
      const abortController = new AbortController();

      function handleComplete() {
        // Unmounting a panel that has already reopened would drop it from the DOM.
        if (latestOpen) {
          return;
        }

        setMounted(false);
        setDimensions(EMPTY_DIMENSIONS, false);
      }

      const endingStyleFrame = AnimationFrame.request(() => {
        if (!panel) {
          // A render function can drop the panel element while it closes. There is nothing
          // left to animate, so finish closing instead of staying in the ending phase.
          handleComplete();
          return;
        }
        runOnceCloseAnimationsFinish(handleComplete, abortController.signal);
      });

      return () => {
        AnimationFrame.cancel(endingStyleFrame);
        abortController.abort();
      };
    },
  );

  // Solid may set `hidden` as a boolean property, which drops the `until-found` value: write the
  // attribute directly when necessary.
  createEffect(
    () => {
      panelElement();
      return parameters.hiddenUntilFound() && hidden();
    },
    (shouldHideUntilFound) => {
      const panel = getPanel();
      if (panel && shouldHideUntilFound && panel.getAttribute('hidden') !== 'until-found') {
        panel.setAttribute('hidden', 'until-found');
      }
    },
  );

  createEffect(panelElement, (panel) => {
    if (!panel) {
      return undefined;
    }

    const revealDecisionTimeout = Timeout.create();
    let revertRevealFrame = -1;

    // Reverting must wait until the browser has measured the match. Whether the open arrived is
    // decided in a task, after the update has been applied; the DOM revert then runs in a frame
    // so it stays atomic with respect to paint.
    const scheduleRevealRevert = (revertSkippedMotion: boolean, restoreStartingStyle: boolean) => {
      revealDecisionTimeout.start(0, () => {
        if (latestOpen) {
          return;
        }

        revertRevealFrame = AnimationFrame.request(() => {
          if (latestOpen) {
            return;
          }

          if (revertSkippedMotion) {
            // The open never happened, so the next one is an ordinary open that
            // should keep its author-defined motion.
            shouldSkipNextOpen = false;
          }

          if (restoreStartingStyle) {
            panel.setAttribute(CollapsiblePanelDataAttributes.startingStyle, '');
          }

          panel.setAttribute('hidden', 'until-found');
        });
      });
    };

    const handleBeforeMatch = (event: Event) => {
      const eventDetails = createChangeEventDetails(REASONS.none, event);

      parameters.onOpenChange(true, eventDetails);

      if (eventDetails.isCanceled) {
        // A canceled reveal means the panel must stay hidden, so undo the
        // browser's removal of `hidden` and keep the content searchable.
        scheduleRevealRevert(false, false);
        return;
      }

      shouldSkipNextOpen = true;

      // The browser removes `hidden` and measures the match in the same task that
      // dispatches this event, while the state update below only lands in a later
      // microtask. Panels kept collapsed by persisted starting styles would still
      // be zero-sized at that point and the match highlight is dropped, so drop
      // those styles synchronously here.
      const hadStartingStyle = panel.hasAttribute(CollapsiblePanelDataAttributes.startingStyle);
      panel.removeAttribute(CollapsiblePanelDataAttributes.startingStyle);

      setOpen(true);

      // A controlled panel whose `onOpenChange` is ignored never receives the open
      // state, so return it to the fully closed state once the browser has measured.
      scheduleRevealRevert(true, hadStartingStyle);
    };

    const cleanupBeforeMatchListener = addEventListener(panel, 'beforematch', handleBeforeMatch);

    return () => {
      revealDecisionTimeout.clear();
      AnimationFrame.cancel(revertRevealFrame);
      cleanupBeforeMatchListener();
    };
  });

  const shouldRender = () =>
    parameters.keepMounted() || parameters.hiddenUntilFound() || mounted() || open();

  const props: HTMLProps = {
    get [CollapsiblePanelDataAttributes.startingStyle]() {
      return shouldPersistHiddenTransitionStyles() ? '' : undefined;
    },
    get hidden() {
      if (!hidden()) {
        return undefined;
      }
      return parameters.hiddenUntilFound() ? 'until-found' : true;
    },
    get id() {
      return parameters.id();
    },
  };

  return {
    height: () => renderedDimensions().height,
    props,
    ref: (element) => {
      panelNode = element;
      setPanelElement(element);
    },
    shouldPreventOpenAnimation,
    shouldRender,
    transitionStatus: panelTransitionStatus,
    width: () => renderedDimensions().width,
  };
}

/**
 * Warns when `keepMounted={false}` is ignored because `hiddenUntilFound` is enabled.
 */
export function createKeepMountedWarning(
  shouldWarn: Accessor<boolean>,
  message: string,
): void {
  if (!isDev) {
    return;
  }
  createEffect(shouldWarn, (value) => {
    if (value) {
      warn(message);
    }
  });
}

function getDimensions(element: HTMLElement) {
  return {
    height: element.scrollHeight,
    width: element.scrollWidth,
  };
}

function getAnimationType(
  element: HTMLElement,
  hasSuppressedMountAnimation: boolean,
): AnimationType {
  const panelStyles = ownerWindow(element).getComputedStyle(element);
  const hasAnimation =
    ((panelStyles.animationName ?? '')
      .split(',')
      .map((name) => name.trim())
      .some((name) => name !== '' && name !== 'none') ||
      hasSuppressedMountAnimation) &&
    hasNonZeroDuration(panelStyles.animationDuration ?? '');
  const hasTransition = hasNonZeroDuration(panelStyles.transitionDuration ?? '');

  if (hasAnimation && hasTransition) {
    if (isDev) {
      warn(
        'CSS transitions and CSS animations both detected on Collapsible or Accordion panel.',
        'Only one of either animation type should be used.',
      );
    }

    return 'css-transition';
  }

  if (hasTransition) {
    return 'css-transition';
  }

  if (hasAnimation) {
    return 'css-animation';
  }

  return 'none';
}

function hasNonZeroDuration(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .some((part) => part !== '' && Number.parseFloat(part) > 0);
}

/**
 * Temporarily overrides an inline style property and returns a cleanup that
 * restores the previous inline value and priority.
 */
function setTemporaryStyle(element: HTMLElement, property: string, value: string): () => void {
  const previousValue = element.style.getPropertyValue(property);
  const previousPriority = element.style.getPropertyPriority(property);

  element.style.setProperty(property, value);

  return () => {
    if (previousValue === '') {
      element.style.removeProperty(property);
      return;
    }

    element.style.setProperty(property, previousValue, previousPriority);
  };
}

/**
 * Temporarily resets inline alignment styles that can distort scroll-based
 * size measurements, then restores them on the next animation frame.
 */
function resetLayoutStyles(element: HTMLElement): () => void {
  const originalLayoutStyles = {
    'justify-content': element.style.justifyContent,
    'align-items': element.style.alignItems,
    'align-content': element.style.alignContent,
    'justify-items': element.style.justifyItems,
  };

  Object.keys(originalLayoutStyles).forEach((key) => {
    element.style.setProperty(key, 'initial', 'important');
  });

  function restoreLayoutStyles() {
    Object.entries(originalLayoutStyles).forEach(([key, value]) => {
      if (value === '') {
        element.style.removeProperty(key);
        return;
      }

      element.style.setProperty(key, value);
    });
  }

  const frame = AnimationFrame.request(restoreLayoutStyles);

  return () => {
    AnimationFrame.cancel(frame);
    restoreLayoutStyles();
  };
}
