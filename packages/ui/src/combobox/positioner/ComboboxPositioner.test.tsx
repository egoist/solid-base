import { createSignal } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Combobox } from '..';
import { positionerConformanceTests } from '../../popover/anchoredPopupTestUtils';
import { useComboboxPositionerContext } from './ComboboxPositionerContext';
import { flushMicrotasks, wait } from '../test-utils';

describe('<Combobox.Positioner />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('should not lock body scroll when controlled value={[]} triggers a re-render', async () => {
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');

    function Test() {
      const [, forceRender] = createSignal(0);
      queueMicrotask(() => forceRender(1));

      return (
        <Combobox.Root multiple value={[]}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>
      );
    }

    const { unmount } = render(() => <Test />);

    // Wait for mount + re-render + setTimeout(0) in ScrollLocker.acquire
    await wait(50);

    const bodyOverflowX = document.body.style.overflowX;
    const bodyOverflowY = document.body.style.overflowY;
    const htmlOverflowX = document.documentElement.style.overflowX;
    const htmlOverflowY = document.documentElement.style.overflowY;

    unmount();
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');

    expect(bodyOverflowX).not.toBe('hidden');
    expect(bodyOverflowY).not.toBe('hidden');
    expect(htmlOverflowX).not.toBe('hidden');
    expect(htmlOverflowY).not.toBe('hidden');
  });

  it('forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Combobox.Root open>
        <Combobox.Portal>
          <Combobox.Positioner
            data-testid="positioner"
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.open ? 'positioner open' : 'positioner')}
            style={{ color: 'red' }}
            render={(props, state) => <section {...props} data-state-side={state.side} />}
          />
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const positioner = screen.getByTestId('positioner');
    expect(ref).toBe(positioner);
    expect(positioner.tagName).toBe('SECTION');
    expect(positioner).toHaveClass('positioner', 'open');
    expect(positioner).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(positioner).toHaveAttribute('role', 'presentation');
    expect(positioner).toHaveAttribute('data-open');
    expect(positioner).toHaveAttribute('data-state-side', 'bottom');
  });

  it('marks an empty list with data-empty', async () => {
    render(() => (
      <Combobox.Root open items={[]}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner data-testid="positioner" />
        </Combobox.Portal>
      </Combobox.Root>
    ));
    await flushMicrotasks();

    expect(screen.getByTestId('positioner')).toHaveAttribute('data-empty');
  });

  positionerConformanceTests({
    createComponent: (props) => (
      <Combobox.Root {...props.root}>
        <Combobox.Input {...props.trigger} />
        <Combobox.Portal>
          <Combobox.Positioner {...props.positioner}>
            <Combobox.Popup {...props.popup}>Popup</Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ),
  });

  // Needs real layout (the capped list height must fit below the anchor).
  it.skip('keeps the popup on the preferred side when its capped height fits below tall content', () => {});

  // Needs real layout (measures the anchor width).
  it.skip('default anchor: uses the input when input group is absent', () => {});

  // Needs real layout (measures the anchor width).
  it.skip('default anchor: uses the input group when present', () => {});
});

describe('ComboboxPositionerContext', () => {
  it('throws a descriptive error when a required consumer is outside the positioner', () => {
    function Consumer() {
      useComboboxPositionerContext();
      return null;
    }

    expect(() => render(() => <Consumer />)).toThrow(
      'Base UI: <Combobox.Popup> and <Combobox.Arrow> must be used within the <Combobox.Positioner> component',
    );
  });
});
