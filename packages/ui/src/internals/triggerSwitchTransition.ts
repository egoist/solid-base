import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { canWaitForAnimations, createAnimationsFinished } from './animationsFinished';

/**
 * Popover and Menu declare different `instantType` unions, so only the members
 * this primitive touches are typed.
 */
export interface TriggerSwitchStore {
  /**
   * Derives what reading `instantType` returns from its stored value (see `ReactiveStore.derive`).
   * Returns a function removing the derivation.
   */
  derive(
    key: 'instantType',
    fn: (stored: string | undefined) => string | undefined,
  ): () => void;
}

export interface CreateTriggerSwitchTransitionParameters {
  store: TriggerSwitchStore;
  /**
   * The trigger element that currently owns the popup.
   * Read lazily (pass a getter for a reactive value).
   */
  readonly domReference: Element | null | undefined;
  /**
   * The positioner element, whose animations the restoration waits for.
   * Read lazily (pass a getter for a reactive value).
   */
  readonly positionerElement: HTMLElement | null | undefined;
  /**
   * Whether the popup is open.
   * Read lazily (pass a getter for a reactive value).
   */
  readonly open: boolean;
}

/**
 * A move of an open popup from one trigger to another.
 */
interface TriggerMove {
  readonly from: Element;
  readonly to: Element;
}

interface AnchoringState {
  /** The last trigger the popup was anchored to. */
  readonly trigger: Element | null;
  /** The move of the current open cycle, if the popup moved to another trigger while open. */
  readonly move: TriggerMove | null;
  /** Whether the popup has closed since this positioner mounted. */
  readonly closed: boolean;
}

/**
 * Lets the positioner animate while a popup moves between detached triggers.
 *
 * The positioner is normally marked instant, so a hand-off from one trigger to
 * another would teleport. `instantType` reads as cleared for the duration of the
 * move, which lets it transition, and as `trigger-change` once the move's
 * animations finish.
 *
 * Both are derived from the trigger and the open state, in the same flush as
 * they change, through a derivation of the store's `instantType`. A move belongs
 * to the open cycle it started in: closing ends it (cancelling a pending
 * restoration), so a popup that closes and reopens on the same trigger mid-exit
 * keeps its own transition, and a controlled reopen that changes only the `open`
 * prop doesn't inherit `trigger-change`. A stored `trigger-change` is dropped
 * once the popup closes too.
 *
 * Parameters are read lazily, like Solid props:
 * `createTriggerSwitchTransition({ store, get domReference() { return store.select('anchorElement') }, ... })`.
 */
export function createTriggerSwitchTransition(
  parameters: CreateTriggerSwitchTransitionParameters,
): void {
  const { store } = parameters;

  const runOnceAnimationsFinish = createAnimationsFinished(() => parameters.positionerElement);

  const anchoring = createMemo<AnchoringState>(
    (previous) => {
      const trigger = parameters.domReference ?? null;
      const lastTrigger = previous?.trigger ?? null;
      const closed = previous?.closed ?? false;

      if (!parameters.open) {
        return { trigger: trigger ?? lastTrigger, move: null, closed: true };
      }

      // The trigger element can also change while the popup is closing, when a trigger is
      // replaced by a new element: only a change while open is a move to animate.
      if (trigger && lastTrigger && trigger !== lastTrigger) {
        return { trigger, move: { from: lastTrigger, to: trigger }, closed };
      }

      return { trigger: trigger ?? lastTrigger, move: previous?.move ?? null, closed };
    },
    { name: 'createTriggerSwitchTransition.anchoring', equals: isSameAnchoringState },
  );

  // The move whose animations have finished.
  const [finishedMove, setFinishedMove] = createSignal<TriggerMove | null>(null, {
    name: 'createTriggerSwitchTransition.finishedMove',
  });

  const removeDerivation = store.derive('instantType', (stored) => {
    const { move, closed } = anchoring();
    if (move) {
      const positionerElement = parameters.positionerElement;
      if (positionerElement == null) {
        return undefined;
      }
      // Without observable animations, the move is over at once.
      if (!canWaitForAnimations(positionerElement)) {
        return 'trigger-change';
      }
      return finishedMove() === move ? 'trigger-change' : undefined;
    }

    return closed && stored === 'trigger-change' ? undefined : stored;
  });
  onCleanup(removeDerivation);

  // Waits for the move's animations. Ending the move (closing, or moving again) cancels it.
  createEffect(
    () => anchoring().move,
    (move) => {
      if (!move) {
        return undefined;
      }

      const abortController = new AbortController();
      runOnceAnimationsFinish(() => setFinishedMove(move), abortController.signal);
      return () => {
        abortController.abort();
      };
    },
  );
}

function isSameAnchoringState(a: AnchoringState | undefined, b: AnchoringState) {
  return a !== undefined && a.trigger === b.trigger && a.move === b.move && a.closed === b.closed;
}
