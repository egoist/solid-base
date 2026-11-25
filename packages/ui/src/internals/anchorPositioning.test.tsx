import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignal, flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import type { JSX } from '@solidjs/web';
import type { VirtualElement } from '@floating-ui/dom';
import { createRefObject } from '@egoist/solid-base-utils/refObject';
import { DirectionProvider } from '../direction-provider/DirectionProvider';
import { adaptiveOrigin } from '../utils/popups/positioning/adaptiveOriginMiddleware';
import {
  createAnchorPositioning,
  createFloatingRootStore,
  type CreateAnchorPositioningParameters,
  type CreateAnchorPositioningReturnValue,
} from './anchorPositioning';

const shiftSpy = vi.hoisted(() => vi.fn());

vi.mock('@floating-ui/dom', async () => {
  const actual = await vi.importActual<typeof import('@floating-ui/dom')>('@floating-ui/dom');

  return {
    ...actual,
    shift: ((...args: Parameters<typeof actual.shift>) => {
      shiftSpy(...args);
      return actual.shift(...args);
    }) satisfies typeof actual.shift,
  };
});

async function flushMicrotasks() {
  for (let i = 0; i < 3; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    flush();
  }
}

function mockRect(element: Element, rect: { x: number; y: number; width: number; height: number }) {
  element.getBoundingClientRect = () =>
    DOMRect.fromRect({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
}

type Params = Partial<Omit<CreateAnchorPositioningParameters, 'interactionStore'>>;

/**
 * Renders an anchor and a positioner. Positioning parameters are read from `params` lazily, so a
 * test can pass getters.
 */
function TestPositioner(props: {
  params?: Params;
  arrow?: boolean;
  onCreate?: (positioning: CreateAnchorPositioningReturnValue) => void;
}) {
  let anchorElement: HTMLDivElement | undefined;
  const store = createFloatingRootStore({ open: () => true });
  const params = () => props.params ?? {};

  const positioning = createAnchorPositioning({
    interactionStore: store,
    get anchor() {
      return 'anchor' in params() ? params().anchor : () => anchorElement ?? null;
    },
    get mounted() {
      return params().mounted ?? true;
    },
    get keepMounted() {
      return params().keepMounted;
    },
    get positionMethod() {
      return params().positionMethod;
    },
    get side() {
      return params().side;
    },
    get align() {
      return params().align;
    },
    get sideOffset() {
      return params().sideOffset;
    },
    get alignOffset() {
      return params().alignOffset;
    },
    get arrowPadding() {
      return params().arrowPadding;
    },
    get collisionAvoidance() {
      return params().collisionAvoidance ?? { side: 'none', align: 'none' };
    },
    get adaptiveOrigin() {
      return params().adaptiveOrigin;
    },
    get shift() {
      return params().shift;
    },
  });
  props.onCreate?.(positioning);

  return (
    <>
      <div
        data-testid="anchor"
        ref={(element) => {
          anchorElement = element;
          mockRect(element, { x: 100, y: 100, width: 50, height: 20 });
        }}
      >
        anchor
      </div>
      <div
        data-testid="positioner"
        data-side={positioning.side}
        data-align={positioning.align}
        data-physical-side={positioning.physicalSide}
        data-positioned={positioning.isPositioned ? '' : undefined}
        data-anchor-hidden={positioning.anchorHidden ? '' : undefined}
        ref={positioning.refs.setFloating}
        style={positioning.positionerStyles}
      >
        {props.arrow ? (
          <span
            data-testid="arrow"
            data-uncentered={positioning.arrowUncentered ? '' : undefined}
            ref={(element) => {
              mockRect(element, { x: 0, y: 0, width: 10, height: 10 });
              positioning.arrowRef(element);
            }}
            style={positioning.arrowStyles as JSX.CSSProperties}
          />
        ) : null}
      </div>
    </>
  );
}

describe('createAnchorPositioning', () => {
  beforeEach(() => {
    shiftSpy.mockClear();
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 1000,
    });
  });

  afterEach(() => {
    // Restore jsdom's own getters.
    delete (document.documentElement as any).clientWidth;
    delete (document.documentElement as any).clientHeight;
  });

  it('uses the visual viewport for shift by default', async () => {
    render(() => <TestPositioner params={{ collisionAvoidance: { fallbackAxisSide: 'none' } }} />);
    await flushMicrotasks();

    expect(shiftSpy).toHaveBeenCalled();
    expect(shiftSpy.mock.calls[0]?.[0].rootBoundary).toBe(undefined);
  });

  it.each([
    { shift: { rootBoundary: 'layoutViewport' } as const, crossAxis: false },
    { shift: { crossAxis: true, rootBoundary: 'layoutViewport' } as const, crossAxis: true },
  ])('uses the configured shift options', async ({ shift, crossAxis }) => {
    render(() => (
      <TestPositioner params={{ shift, collisionAvoidance: { fallbackAxisSide: 'none' } }} />
    ));
    await flushMicrotasks();

    expect(shiftSpy.mock.calls[0]?.[0].rootBoundary).toBe('layoutViewport');
    expect(shiftSpy.mock.calls[0]?.[0].crossAxis).toBe(crossAxis);
  });

  it('hides the positioner at a fixed position until it is positioned', async () => {
    render(() => <TestPositioner />);
    const positioner = screen.getByTestId('positioner');

    expect(positioner).not.toHaveAttribute('data-positioned');
    expect(positioner.style.position).toBe('fixed');
    expect(positioner.style.opacity).toBe('0');
    expect(positioner.style.top).toBe('0px');
    expect(positioner.style.left).toBe('0px');
    expect(positioner.style.getPropertyValue('--available-width')).toBe('100vw');
    expect(positioner.style.getPropertyValue('--available-height')).toBe('100vh');

    await flushMicrotasks();

    expect(positioner).toHaveAttribute('data-positioned');
    expect(positioner.style.position).toBe('absolute');
    expect(positioner.style.opacity).toBe('');
    // Anchor (100, 100, 50x20); the positioner measures 0x0 in jsdom.
    expect(positioner.style.transform).toBe('translate(125px, 120px)');
  });

  it('sets the positioning CSS variables', async () => {
    render(() => <TestPositioner params={{ sideOffset: 4 }} />);
    await flushMicrotasks();

    const positioner = screen.getByTestId('positioner');
    expect(positioner.style.getPropertyValue('--anchor-width')).toBe('50px');
    expect(positioner.style.getPropertyValue('--anchor-height')).toBe('20px');
    expect(positioner.style.getPropertyValue('--available-width')).toMatch(/px$/);
    expect(positioner.style.getPropertyValue('--available-height')).toMatch(/px$/);
    expect(positioner.style.getPropertyValue('--transform-origin')).toBe('0px -4px');
    expect(positioner.style.transform).toBe('translate(125px, 124px)');
  });

  it.each([
    ['top', 'center', 'top'],
    ['bottom', 'start', 'bottom'],
    ['left', 'end', 'left'],
    ['right', 'center', 'right'],
    ['inline-start', 'center', 'left'],
    ['inline-end', 'end', 'right'],
  ] as const)('reports side %s and align %s', async (side, align, physicalSide) => {
    render(() => <TestPositioner params={{ side, align }} />);
    await flushMicrotasks();

    const positioner = screen.getByTestId('positioner');
    expect(positioner).toHaveAttribute('data-side', side);
    expect(positioner).toHaveAttribute('data-align', align);
    expect(positioner).toHaveAttribute('data-physical-side', physicalSide);
  });

  it('maps logical sides to physical sides in RTL', async () => {
    render(() => (
      <DirectionProvider direction="rtl">
        <TestPositioner params={{ side: 'inline-start' }} />
      </DirectionProvider>
    ));
    await flushMicrotasks();

    const positioner = screen.getByTestId('positioner');
    expect(positioner).toHaveAttribute('data-side', 'inline-start');
    expect(positioner).toHaveAttribute('data-physical-side', 'right');
  });

  it('updates the placement when the side changes', async () => {
    const [side, setSide] = createSignal<'top' | 'bottom'>('bottom');
    render(() => (
      <TestPositioner
        params={{
          get side() {
            return side();
          },
        }}
      />
    ));
    await flushMicrotasks();

    const positioner = screen.getByTestId('positioner');
    expect(positioner).toHaveAttribute('data-side', 'bottom');

    setSide('top');
    await flushMicrotasks();

    expect(positioner).toHaveAttribute('data-side', 'top');
    expect(positioner.style.transform).toBe('translate(125px, 100px)');
  });

  it('passes the offset data to offset functions', async () => {
    const sideOffset = vi.fn(() => 8);
    const alignOffset = vi.fn(() => 3);
    render(() => <TestPositioner params={{ side: 'top', align: 'start', sideOffset, alignOffset }} />);
    await flushMicrotasks();

    expect(sideOffset).toHaveBeenCalledWith({
      side: 'top',
      align: 'start',
      anchor: { width: 50, height: 20 },
      positioner: { width: 0, height: 0 },
    });
    expect(alignOffset).toHaveBeenCalled();
    expect(screen.getByTestId('positioner').style.transform).toBe('translate(103px, 92px)');
  });

  it('positions the arrow', async () => {
    render(() => <TestPositioner arrow />);
    await flushMicrotasks();

    const arrow = screen.getByTestId('arrow');
    expect(arrow.style.position).toBe('absolute');
    // jsdom has no layout: the positioner and the arrow measure 0x0, so the arrow sits at the
    // start of the (empty) positioner, which is centered on the anchor.
    expect(arrow.style.left).toBe('0px');
    expect(arrow.style.top).toBe('');
    expect(arrow).not.toHaveAttribute('data-uncentered');
  });

  it.each([
    ['an element', (element: HTMLElement) => element],
    ['an accessor', (element: HTMLElement) => () => element],
    ['a ref object', (element: HTMLElement) => createRefObject<Element | null>(element)],
  ])('positions against %s passed as `anchor`', async (_, getAnchor) => {
    const customAnchor = document.createElement('div');
    document.body.append(customAnchor);
    mockRect(customAnchor, { x: 300, y: 400, width: 100, height: 10 });

    let positioning: CreateAnchorPositioningReturnValue | undefined;
    render(() => (
      <TestPositioner
        params={{ anchor: getAnchor(customAnchor) }}
        onCreate={(value) => {
          positioning = value;
        }}
      />
    ));
    await flushMicrotasks();

    const reference = positioning?.refs.reference.current as VirtualElement;
    expect(reference.contextElement).toBe(customAnchor);
    expect(screen.getByTestId('positioner').style.transform).toBe('translate(350px, 410px)');

    customAnchor.remove();
  });

  it('positions against a virtual element', async () => {
    const virtualElement: VirtualElement = {
      getBoundingClientRect: () => DOMRect.fromRect({ x: 20, y: 30, width: 0, height: 0 }),
    };
    render(() => <TestPositioner params={{ anchor: virtualElement }} />);
    await flushMicrotasks();

    expect(screen.getByTestId('positioner').style.transform).toBe('translate(20px, 30px)');
  });

  it('positions with physical coordinates when the adaptive origin is enabled', async () => {
    render(() => <TestPositioner params={{ adaptiveOrigin }} />);
    await flushMicrotasks();

    const positioner = screen.getByTestId('positioner');
    expect(positioner.style.left).toBe('125px');
    expect(positioner.style.top).toBe('120px');
    expect(positioner.style.transform).toBe('');
  });

  it('marks the anchor as hidden when it has no size and position', async () => {
    const virtualElement: VirtualElement = {
      getBoundingClientRect: () => DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 }),
    };
    render(() => <TestPositioner params={{ anchor: virtualElement }} />);
    await flushMicrotasks();

    expect(screen.getByTestId('positioner')).toHaveAttribute('data-anchor-hidden');
  });

  it('does not position a kept-mounted popup while it is not mounted', async () => {
    const [mounted, setMounted] = createSignal(false);
    render(() => (
      <TestPositioner
        params={{
          keepMounted: true,
          get mounted() {
            return mounted();
          },
        }}
      />
    ));
    await flushMicrotasks();

    const positioner = screen.getByTestId('positioner');
    expect(positioner).not.toHaveAttribute('data-positioned');

    setMounted(true);
    await flushMicrotasks();

    expect(positioner).toHaveAttribute('data-positioned');

    setMounted(false);
    await flushMicrotasks();

    expect(positioner).not.toHaveAttribute('data-positioned');
    expect(positioner.style.opacity).toBe('0');
  });

  // The upstream lazy flip and late arrow tests rely on real layout (collisions with the viewport
  // and the arrow's measured size), which jsdom doesn't have.
  it.skip('locks a flipped alignment after the popup shrinks', () => {});
  it.skip('centers an arrow that mounts after the popup is positioned', () => {});
});
