import { createSignal, flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Tabs } from '..';

async function settle() {
  for (let i = 0; i < 3; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    flush();
  }
}

async function renderAndSettle(ui: () => any) {
  const result = render(ui);
  await settle();
  return result;
}

/**
 * jsdom has no layout: give every tab a 100x40 box laid out horizontally inside the tab list.
 */
function mockLayout() {
  const prototype = HTMLElement.prototype;
  const original = {
    offsetWidth: Object.getOwnPropertyDescriptor(prototype, 'offsetWidth')!,
    offsetHeight: Object.getOwnPropertyDescriptor(prototype, 'offsetHeight')!,
    offsetLeft: Object.getOwnPropertyDescriptor(prototype, 'offsetLeft')!,
    offsetParent: Object.getOwnPropertyDescriptor(prototype, 'offsetParent')!,
    scrollWidth: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth')!,
    scrollHeight: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight')!,
    getBoundingClientRect: prototype.getBoundingClientRect,
  };

  const tabIndex = (element: HTMLElement) =>
    element.getAttribute('role') === 'tab'
      ? Array.from(element.parentElement!.querySelectorAll('[role="tab"]')).indexOf(element)
      : -1;
  const isList = (element: Element) => element.getAttribute('role') === 'tablist';

  Object.defineProperties(prototype, {
    offsetWidth: {
      configurable: true,
      get(this: HTMLElement) {
        if (isList(this)) {
          return 300;
        }
        return tabIndex(this) >= 0 ? 100 : 0;
      },
    },
    offsetHeight: {
      configurable: true,
      get(this: HTMLElement) {
        return isList(this) || tabIndex(this) >= 0 ? 40 : 0;
      },
    },
    offsetLeft: {
      configurable: true,
      get(this: HTMLElement) {
        const index = tabIndex(this);
        return index >= 0 ? index * 100 : 0;
      },
    },
    offsetParent: {
      configurable: true,
      get(this: HTMLElement) {
        return tabIndex(this) >= 0 ? this.parentElement : null;
      },
    },
  });
  Object.defineProperties(Element.prototype, {
    scrollWidth: {
      configurable: true,
      get(this: Element) {
        return isList(this) ? 300 : 0;
      },
    },
    scrollHeight: {
      configurable: true,
      get(this: Element) {
        return isList(this) ? 40 : 0;
      },
    },
  });
  prototype.getBoundingClientRect = function getBoundingClientRect(this: HTMLElement) {
    const index = tabIndex(this);
    const left = index >= 0 ? index * 100 : 0;
    const width = isList(this) ? 300 : this.offsetWidth;
    const height = this.offsetHeight;
    return {
      left,
      top: 0,
      right: left + width,
      bottom: height,
      width,
      height,
      x: left,
      y: 0,
      toJSON() {},
    } as DOMRect;
  };

  return () => {
    Object.defineProperties(prototype, {
      offsetWidth: original.offsetWidth,
      offsetHeight: original.offsetHeight,
      offsetLeft: original.offsetLeft,
      offsetParent: original.offsetParent,
    });
    Object.defineProperties(Element.prototype, {
      scrollWidth: original.scrollWidth,
      scrollHeight: original.scrollHeight,
    });
    prototype.getBoundingClientRect = original.getBoundingClientRect;
  };
}

describe('<Tabs.Indicator />', () => {
  it('renders a span and forwards class, style, ref and render', async () => {
    let ref: HTMLElement | undefined;
    await renderAndSettle(() => (
      <Tabs.Root defaultValue={1}>
        <Tabs.List>
          <Tabs.Tab value={1} />
          <Tabs.Indicator
            data-testid="indicator"
            class={(state) => `indicator-${state.orientation}`}
            style={{ color: 'red' }}
            ref={(element) => {
              ref = element;
            }}
          />
        </Tabs.List>
      </Tabs.Root>
    ));

    const indicator = screen.getByTestId('indicator');
    expect(indicator.tagName).toBe('SPAN');
    expect(indicator).toHaveAttribute('role', 'presentation');
    expect(indicator).toHaveClass('indicator-horizontal');
    expect(indicator).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(ref).toBe(indicator);
    expect(indicator).toHaveAttribute('data-orientation', 'horizontal');
    expect(indicator).toHaveAttribute('data-activation-direction', 'none');
  });

  it('supports the render prop', async () => {
    await renderAndSettle(() => (
      <Tabs.Root defaultValue={1}>
        <Tabs.List>
          <Tabs.Tab value={1} />
          <Tabs.Indicator render={(props) => <div data-testid="indicator" {...props} />} />
        </Tabs.List>
      </Tabs.Root>
    ));

    expect(screen.getByTestId('indicator').tagName).toBe('DIV');
  });

  it('exposes null active tab state when the selected value has no matching tab', async () => {
    let indicatorState: Tabs.Indicator.State | undefined;

    await renderAndSettle(() => (
      <Tabs.Root value="missing">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Indicator
            render={(props, state) => {
              indicatorState = state;
              return <span data-testid="bubble" {...props} />;
            }}
          />
        </Tabs.List>
      </Tabs.Root>
    ));

    expect(indicatorState!.activeTabPosition).toBe(null);
    expect(indicatorState!.activeTabSize).toBe(null);
    expect(screen.getByTestId('bubble')).toHaveAttribute('hidden');
  });

  it('should not render when no tab is active', async () => {
    await renderAndSettle(() => (
      <Tabs.Root value={null}>
        <Tabs.List>
          <Tabs.Indicator data-testid="bubble" />
        </Tabs.List>
      </Tabs.Root>
    ));

    expect(screen.queryByTestId('bubble')).toBe(null);
  });

  it('stays hidden while the active tab has no size', async () => {
    // jsdom reports zero sizes for every element.
    await renderAndSettle(() => (
      <Tabs.Root value={1}>
        <Tabs.List>
          <Tabs.Tab value={1}>One</Tabs.Tab>
          <Tabs.Indicator data-testid="bubble" />
        </Tabs.List>
      </Tabs.Root>
    ));

    expect(screen.getByTestId('bubble')).toHaveAttribute('hidden');
  });

  describe('with a mocked layout', () => {
    let restoreLayout: () => void;

    beforeEach(() => {
      restoreLayout = mockLayout();
    });

    afterEach(() => {
      restoreLayout();
    });

    function expectVariables(
      indicator: HTMLElement,
      expected: Record<'left' | 'right' | 'top' | 'bottom' | 'width' | 'height', number>,
    ) {
      for (const [name, value] of Object.entries(expected)) {
        expect(indicator.style.getPropertyValue(`--active-tab-${name}`)).toBe(`${value}px`);
      }
    }

    it('sets CSS variables corresponding to the active tab', async () => {
      let indicatorState: Tabs.Indicator.State | undefined;
      await renderAndSettle(() => (
        <Tabs.Root value={2}>
          <Tabs.List>
            <Tabs.Tab value={1}>One</Tabs.Tab>
            <Tabs.Tab value={2}>Two</Tabs.Tab>
            <Tabs.Tab value={3}>Three</Tabs.Tab>
            <Tabs.Indicator
              render={(props, state) => {
                indicatorState = state;
                return <span data-testid="bubble" {...props} />;
              }}
            />
          </Tabs.List>
        </Tabs.Root>
      ));

      const bubble = screen.getByTestId('bubble');
      expect(bubble).not.toHaveAttribute('hidden');
      expectVariables(bubble, { left: 100, right: 100, top: 0, bottom: 0, width: 100, height: 40 });
      expect(indicatorState!.activeTabPosition).toEqual({
        left: 100,
        right: 100,
        top: 0,
        bottom: 0,
      });
      expect(indicatorState!.activeTabSize).toEqual({ width: 100, height: 40 });
    });

    it('updates the position variables when the active tab changes', async () => {
      const [value, setValue] = createSignal(2);
      await renderAndSettle(() => (
        <Tabs.Root value={value()}>
          <Tabs.List>
            <Tabs.Tab value={1}>One</Tabs.Tab>
            <Tabs.Tab value={2}>Two</Tabs.Tab>
            <Tabs.Tab value={3}>Three</Tabs.Tab>
            <Tabs.Indicator data-testid="bubble" />
          </Tabs.List>
        </Tabs.Root>
      ));

      const bubble = screen.getByTestId('bubble');

      setValue(3);
      await settle();
      expectVariables(bubble, { left: 200, right: 0, top: 0, bottom: 0, width: 100, height: 40 });
      expect(bubble).toHaveAttribute('data-activation-direction', 'right');

      setValue(1);
      await settle();
      expectVariables(bubble, { left: 0, right: 200, top: 0, bottom: 0, width: 100, height: 40 });
      expect(bubble).toHaveAttribute('data-activation-direction', 'left');
    });

    it('re-measures when the tab list or a tab resizes', async () => {
      const callbacks: ResizeObserverCallback[] = [];
      const OriginalResizeObserver = globalThis.ResizeObserver;
      globalThis.ResizeObserver = class {
        constructor(callback: ResizeObserverCallback) {
          callbacks.push(callback);
        }

        observe() {}

        unobserve() {}

        disconnect() {}
      } as unknown as typeof ResizeObserver;

      try {
        let width = 100;
        await renderAndSettle(() => (
          <Tabs.Root value={1}>
            <Tabs.List>
              <Tabs.Tab
                value={1}
                ref={(element) => {
                  Object.defineProperty(element, 'offsetWidth', {
                    configurable: true,
                    get: () => width,
                  });
                }}
              >
                One
              </Tabs.Tab>
              <Tabs.Indicator data-testid="bubble" />
            </Tabs.List>
          </Tabs.Root>
        ));

        const bubble = screen.getByTestId('bubble');
        expect(bubble.style.getPropertyValue('--active-tab-width')).toBe('100px');

        width = 150;
        callbacks.forEach((callback) => callback([], {} as ResizeObserver));
        flush();

        expect(bubble.style.getPropertyValue('--active-tab-width')).toBe('150px');
      } finally {
        globalThis.ResizeObserver = OriginalResizeObserver;
      }
    });
  });

  // Upstream's transform/scroll/rotation rendering tests and the pre-hydration script execution
  // tests rely on real layout (browser only). The server-rendering tests (script emitted with the
  // CSP nonce on the server) need a server build of the components, which this jsdom test
  // environment doesn't provide: the `<script>` is only rendered when `isServer` is true.
});
