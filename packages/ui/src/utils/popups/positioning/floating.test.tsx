import { expect, test, vi } from 'vitest';
import { flush } from 'solid-js';
import { render } from '@solidjs/testing-library';
import type { VirtualElement } from '@floating-ui/dom';
import { PopupTriggerMap } from '../popupTriggerMap';
import { FloatingRootStore } from '../floating-root/FloatingRootStore';
import { createFloating, type CreateFloatingReturnValue } from './floating';

async function flushMicrotasks() {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  flush();
}

function Test(props: {
  rootStore: FloatingRootStore;
  onCreate(value: CreateFloatingReturnValue): void;
}) {
  // eslint-disable-next-line solid/reactivity
  props.onCreate(createFloating({ rootStore: props.rootStore }));
  return null;
}

test('uses the supplied root store while preserving DOM and position references', async () => {
  const referenceElement = document.createElement('button');
  const positionerElement = document.createElement('div');
  document.body.append(referenceElement, positionerElement);

  try {
    const store = new FloatingRootStore({
      open: true,
      anchorElement: referenceElement,
      positionerElement,
      triggerElements: new PopupTriggerMap(),
      defaultPopupId: undefined,
      nested: false,
      onOpenChange: vi.fn(),
    });
    let floating: CreateFloatingReturnValue | undefined;

    render(() => (
      <Test
        rootStore={store}
        onCreate={(value) => {
          floating = value;
        }}
      />
    ));
    await flushMicrotasks();

    expect(floating?.context.rootStore).toBe(store);
    expect(store.context.positioning).toBe(floating?.context);
    expect(floating?.refs.floating.current).toBe(positionerElement);
    expect(floating?.refs.domReference.current).toBe(referenceElement);

    const anchorOverride: VirtualElement = {
      getBoundingClientRect: () => new DOMRect(1, 2, 3, 4),
    };

    floating?.refs.setPositionReference(anchorOverride);
    await flushMicrotasks();

    expect(floating?.refs.reference.current).toBe(anchorOverride);
    expect(floating?.elements.reference).toBe(anchorOverride);
    expect(store.state.anchorElement).toBe(referenceElement);
    expect(floating?.refs.domReference.current).toBe(referenceElement);
  } finally {
    referenceElement.remove();
    positionerElement.remove();
  }
});

test('computes the position once both elements are present', async () => {
  const referenceElement = document.createElement('button');
  const positionerElement = document.createElement('div');
  document.body.append(referenceElement, positionerElement);
  referenceElement.getBoundingClientRect = () => new DOMRect(10, 20, 30, 40);

  try {
    const store = new FloatingRootStore({
      open: true,
      anchorElement: referenceElement,
      positionerElement,
      triggerElements: new PopupTriggerMap(),
      defaultPopupId: undefined,
      nested: false,
      onOpenChange: vi.fn(),
    });
    let floating: CreateFloatingReturnValue | undefined;

    render(() => (
      <Test
        rootStore={store}
        onCreate={(value) => {
          floating = value;
        }}
      />
    ));

    expect(floating?.isPositioned).toBe(false);
    expect(floating?.floatingStyles).toEqual({
      position: 'absolute',
      left: '0px',
      top: '0px',
      transform: 'translate(0px, 0px)',
    });

    await flushMicrotasks();

    expect(floating?.isPositioned).toBe(true);
    expect(floating?.placement).toBe('bottom');
    expect(floating?.x).toBe(25);
    expect(floating?.y).toBe(60);
    expect(floating?.floatingStyles).toMatchObject({ transform: 'translate(25px, 60px)' });
  } finally {
    referenceElement.remove();
    positionerElement.remove();
  }
});
