import { createSignal, flush, Show } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import { createRefObject } from '@egoist/solid-base-utils/refObject';
import { REASONS } from '../../internals/reasons';
import { createTriggerFocusGuards, type TriggerFocusGuardStore } from './triggerFocusGuards';

// The upstream suite (`useTriggerFocusGuards.test.tsx`) runs in a real browser only (it relies on
// native Tab key handling) and drives full Popover/Menu components. These tests exercise the
// handlers directly with synthetic focus events instead.
describe('createTriggerFocusGuards', () => {
  function setup(options: { unmountGuardsOnClose?: boolean } = {}) {
    const [open, setOpen] = createSignal(true, { ownedWrite: true });
    let positioner: HTMLElement | null = null;
    let trigger: HTMLElement | null = null;

    const store: TriggerFocusGuardStore = {
      setOpen: vi.fn((nextOpen: boolean) => {
        if (options.unmountGuardsOnClose) {
          setOpen(nextOpen);
        }
      }),
      select: () => positioner,
      context: {
        beforeTriggerFocusGuardRef: createRefObject<HTMLElement | null>(null),
        beforeContentFocusGuardRef: createRefObject<HTMLElement | null>(null),
        triggerFocusTargetRef: createRefObject<HTMLElement | null>(null),
      },
    };

    function Fixture() {
      const guards = createTriggerFocusGuards(store, () => trigger);
      return (
        <div>
          <button data-testid="before">Before</button>
          <Show when={open()}>
            <span
              data-testid="pre-guard"
              tabindex={0}
              ref={(element) => {
                store.context.beforeTriggerFocusGuardRef.current = element;
              }}
              onFocus={guards.handlePreFocusGuardFocus}
            />
          </Show>
          <button
            data-testid="trigger"
            tabindex={-1}
            ref={(element) => {
              trigger = element;
            }}
          >
            Toggle
          </button>
          <Show when={open()}>
            <span
              data-testid="focus-target"
              tabindex={0}
              ref={(element) => {
                store.context.triggerFocusTargetRef.current = element;
              }}
              onFocus={guards.handleFocusTargetFocus}
            />
          </Show>
          <div
            data-testid="positioner"
            ref={(element) => {
              positioner = element;
            }}
          >
            <span
              data-testid="content-guard"
              tabindex={0}
              ref={(element) => {
                store.context.beforeContentFocusGuardRef.current = element;
              }}
            />
            <button data-testid="inside">Inside</button>
          </div>
          <button data-testid="after">After</button>
        </div>
      );
    }

    render(() => <Fixture />);
    return { store };
  }

  it('closes the popup and moves focus before the trigger when the pre guard is focused', () => {
    const { store } = setup();
    const guard = screen.getByTestId('pre-guard');

    fireEvent.focus(guard, { relatedTarget: screen.getByTestId('trigger') });
    flush();

    expect(store.setOpen).toHaveBeenCalledTimes(1);
    const [nextOpen, details] = (store.setOpen as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(nextOpen).toBe(false);
    expect(details.reason).toBe(REASONS.focusOut);
    expect(details.trigger).toBe(guard);
    expect(details.event.type).toBe('focus');
    expect(screen.getByTestId('before')).toHaveFocus();
  });

  it('closes the popup and moves focus past the popup when tabbing out of it', () => {
    const { store } = setup();

    fireEvent.focus(screen.getByTestId('focus-target'), {
      relatedTarget: screen.getByTestId('inside'),
    });
    flush();

    expect(store.setOpen).toHaveBeenCalledTimes(1);
    expect((store.setOpen as ReturnType<typeof vi.fn>).mock.calls[0][1].reason).toBe(
      REASONS.focusOut,
    );
    // The popup's own tabbable elements are skipped.
    expect(screen.getByTestId('after')).toHaveFocus();
  });

  it('moves focus into the popup when the focus target is reached from outside', () => {
    const { store } = setup();

    fireEvent.focus(screen.getByTestId('focus-target'), {
      relatedTarget: screen.getByTestId('trigger'),
    });
    flush();

    expect(store.setOpen).not.toHaveBeenCalled();
    expect(screen.getByTestId('content-guard')).toHaveFocus();
  });

  it('resolves the tab destination from the trigger when the guard unmounts on close', () => {
    const { store } = setup({ unmountGuardsOnClose: true });
    const guard = screen.getByTestId('pre-guard');

    fireEvent.focus(guard, { relatedTarget: screen.getByTestId('trigger') });

    expect(store.setOpen).toHaveBeenCalledTimes(1);
    expect(guard.isConnected).toBe(false);
    expect(screen.getByTestId('before')).toHaveFocus();
  });
});
