import { createSignal, untrack, type Accessor, type Setter } from 'solid-js';
import { createControllableSignal } from '@egoist/solid-base-utils/controlled';
import { createBaseUiId } from '../../internals/baseUiId';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import {
  createTransitionStatus,
  type TransitionStatus,
} from '../../internals/transitionStatus';
import type { CollapsibleRoot } from './CollapsibleRoot';

export interface CreateCollapsibleRootParameters {
  /**
   * Whether the collapsible panel is currently open (controlled).
   */
  open: Accessor<boolean | undefined>;
  /**
   * Whether the collapsible panel is initially open. Only read once.
   * @default false
   */
  defaultOpen?: Accessor<boolean | undefined> | undefined;
  /**
   * Event handler called when the panel is opened or closed.
   */
  onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: Accessor<boolean>;
}

export interface CreateCollapsibleRootReturnValue {
  defaultPanelId: Accessor<string>;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: Accessor<boolean>;
  handleTrigger: (event: MouseEvent | KeyboardEvent) => void;
  /**
   * Whether the collapsible panel is mounted for transition and hidden-state
   * purposes. This can be `false` while the element remains in the DOM when
   * `keepMounted` or `hiddenUntilFound` is enabled.
   */
  mounted: Accessor<boolean>;
  /**
   * Whether the collapsible panel is currently open.
   */
  open: Accessor<boolean>;
  panelId: Accessor<string | undefined>;
  setMounted: (nextMounted: boolean) => void;
  setOpen: (open: boolean) => void;
  /**
   * Registers the id of the panel: `undefined` uses the generated fallback, `null` means the
   * panel unmounted.
   */
  setPanelIdState: Setter<string | null | undefined>;
  transitionStatus: Accessor<TransitionStatus>;
}

/**
 * The open state, transition status and panel id registration shared by the collapsible
 * parts (also used by `Accordion.Item`).
 */
export function createCollapsibleRoot(
  parameters: CreateCollapsibleRootParameters,
): CreateCollapsibleRootReturnValue {
  const [openState, setOpenState] = createControllableSignal<boolean>({
    value: parameters.open,
    defaultValue: () => parameters.defaultOpen?.() ?? false,
  });
  const open = () => openState() ?? false;

  const { mounted, setMounted, transitionStatus } = createTransitionStatus(open, {
    enableIdleState: true,
    deferEndingState: true,
  });

  const defaultPanelId = createBaseUiId();
  // `undefined` uses the initial generated fallback; `null` means the panel unmounted.
  const [registeredPanelId, setPanelIdState] = createSignal<string | null | undefined>(undefined);
  const panelId = () => {
    const registered = registeredPanelId();
    return registered === null ? undefined : (registered ?? defaultPanelId());
  };

  function handleTrigger(event: MouseEvent | KeyboardEvent) {
    const nextOpen = !untrack(open);
    const eventDetails = createChangeEventDetails(REASONS.triggerPress, event);

    parameters.onOpenChange(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setOpenState(nextOpen);
  }

  return {
    defaultPanelId,
    disabled: parameters.disabled,
    handleTrigger,
    mounted,
    open,
    panelId,
    setMounted,
    setOpen: (next) => setOpenState(next),
    setPanelIdState,
    transitionStatus,
  };
}
