import { createSignal, flush } from 'solid-js';
import { render } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { ReactiveStore } from '../utils/popups/reactiveStore';
import { createTriggerSwitchTransition } from './triggerSwitchTransition';

describe('createTriggerSwitchTransition', () => {
  function setup(initialInstantType: string | undefined = 'trigger-change') {
    const store = new ReactiveStore<{ open: boolean; instantType: string | undefined }>(
      { open: true, instantType: initialInstantType },
      {},
    );
    const [domReference, setDomReference] = createSignal<Element | null>(null, {
      ownedWrite: true,
    });

    const positioner = document.createElement('div');
    let finishAnimations: () => void = () => {};
    // An animation that keeps running until `finishAnimations()` is called.
    positioner.getAnimations = () => [
      {
        finished: new Promise<void>((resolve) => {
          finishAnimations = resolve;
        }),
        effect: { getTiming: () => ({ iterations: 1, duration: 100 }) },
      } as unknown as Animation,
    ];

    function Fixture() {
      createTriggerSwitchTransition({
        store,
        get domReference() {
          return domReference();
        },
        positionerElement: positioner,
        get open() {
          return store.select('open');
        },
      });
      return null;
    }

    render(() => <Fixture />);

    const trigger1 = document.createElement('button');
    const trigger2 = document.createElement('button');

    async function waitForFrame() {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }

    return {
      store,
      setDomReference,
      trigger1,
      trigger2,
      finishAnimations: async () => {
        await waitForFrame();
        finishAnimations();
        await Promise.resolve();
        await Promise.resolve();
      },
    };
  }

  it('lets the positioner animate while it moves to another trigger', async () => {
    const { store, setDomReference, trigger1, trigger2, finishAnimations } = setup();

    setDomReference(trigger1);
    flush();
    expect(store.state.instantType).toBe('trigger-change');

    setDomReference(trigger2);
    flush();
    expect(store.state.instantType).toBe(undefined);

    await finishAnimations();
    expect(store.state.instantType).toBe('trigger-change');
  });

  it('cancels the restoration when the popup closes', async () => {
    const { store, setDomReference, trigger1, trigger2, finishAnimations } = setup();

    setDomReference(trigger1);
    flush();
    setDomReference(trigger2);
    flush();

    store.set('open', false);
    flush();
    store.set('open', true);
    flush();

    await finishAnimations();
    expect(store.state.instantType).toBe(undefined);
  });

  it('drops `trigger-change` when the popup closes', () => {
    const { store } = setup();

    store.set('open', false);
    flush();
    expect(store.state.instantType).toBe(undefined);
  });

  it('keeps other instant types when the popup closes', () => {
    const { store } = setup('dismiss');

    store.set('open', false);
    flush();
    expect(store.state.instantType).toBe('dismiss');
  });

  it('does nothing when the trigger changes while closed', async () => {
    const { store, setDomReference, trigger1, trigger2, finishAnimations } = setup('click');

    setDomReference(trigger1);
    flush();
    store.set('open', false);
    flush();

    setDomReference(trigger2);
    flush();
    expect(store.state.instantType).toBe('click');

    await finishAnimations();
    expect(store.state.instantType).toBe('click');
  });
});
