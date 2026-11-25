import { createSignal, flush, onCleanup, Show } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { FloatingDelayGroup, createDelayGroup } from './FloatingDelayGroup';
import { createTestFloating, getInteractionProps } from '../testUtils';
import { createHoverPopupInteraction } from '../interactions/hoverPopupInteraction';
import { createHoverTriggerInteraction } from '../interactions/hoverTriggerInteraction';
import { getDelay } from '../interactions/hoverShared';

function Popup(props: { label: string; setFloating: (element: HTMLElement | null) => void }) {
  onCleanup(() => props.setFloating(null));
  return (
    <div data-testid={`floating-${props.label}`} ref={(element) => props.setFloating(element)}>
      {props.label}
    </div>
  );
}

function Tooltip(props: { label: string }) {
  const [open, setOpen] = createSignal(false, { ownedWrite: true });
  const [triggerElement, setTriggerElement] = createSignal<Element | null>(null, {
    ownedWrite: true,
  });

  const { refs, store } = createTestFloating({
    open,
    onOpenChange: (nextOpen) => setOpen(nextOpen),
  });

  const { delayRef, isInstantPhase } = createDelayGroup(
    Object.assign(store, { closeForSibling: () => setOpen(false) }),
    {
      get open() {
        return open();
      },
    },
  );
  const hoverReferenceProps = createHoverTriggerInteraction(store, {
    delay: () => delayRef.current,
    get triggerElement() {
      return triggerElement();
    },
  });
  createHoverPopupInteraction(store, {
    closeDelay: () => getDelay(delayRef.current, 'close') ?? 0,
  });
  const referenceProps = getInteractionProps([{ reference: hoverReferenceProps }], 'reference');

  return (
    <>
      <button
        {...referenceProps}
        data-testid={`reference-${props.label}`}
        data-instant-phase={isInstantPhase() ? '' : undefined}
        ref={(node) => {
          refs.setReference(node);
          setTriggerElement(node);
        }}
      />
      <Show when={open()}>
        <Popup label={props.label} setFloating={refs.setFloating} />
      </Show>
    </>
  );
}

function App() {
  return (
    <FloatingDelayGroup delay={{ open: 1000, close: 200 }}>
      <Tooltip label="one" />
      <Tooltip label="two" />
      <Tooltip label="three" />
    </FloatingDelayGroup>
  );
}

function advance(ms: number) {
  vi.advanceTimersByTime(ms);
  flush();
}

function mouseEnter(element: Element) {
  fireEvent.mouseEnter(element);
  flush();
}

function mouseLeave(element: Element) {
  fireEvent.mouseLeave(element);
  flush();
}

describe('FloatingDelayGroup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('groups delays correctly', () => {
    render(() => <App />);
    flush();

    mouseEnter(screen.getByTestId('reference-one'));

    advance(1);
    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    advance(999);
    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    mouseEnter(screen.getByTestId('reference-two'));

    advance(1);
    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-two')).toBeInTheDocument();

    mouseEnter(screen.getByTestId('reference-three'));

    advance(1);
    expect(screen.queryByTestId('floating-two')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    mouseLeave(screen.getByTestId('reference-three'));

    advance(1);
    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    advance(199);
    expect(screen.queryByTestId('floating-three')).not.toBeInTheDocument();
  });

  it('timeoutMs', () => {
    function TimeoutApp() {
      return (
        <FloatingDelayGroup delay={{ open: 1000, close: 100 }} timeoutMs={500}>
          <Tooltip label="one" />
          <Tooltip label="two" />
          <Tooltip label="three" />
        </FloatingDelayGroup>
      );
    }

    render(() => <TimeoutApp />);
    flush();

    mouseEnter(screen.getByTestId('reference-one'));

    advance(1000);

    mouseLeave(screen.getByTestId('reference-one'));

    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    advance(499);
    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    mouseEnter(screen.getByTestId('reference-two'));

    advance(1);
    expect(screen.getByTestId('floating-two')).toBeInTheDocument();

    mouseEnter(screen.getByTestId('reference-three'));

    advance(1);
    expect(screen.queryByTestId('floating-two')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    mouseLeave(screen.getByTestId('reference-three'));

    advance(1);
    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    advance(99);
    expect(screen.queryByTestId('floating-three')).not.toBeInTheDocument();
  });

  // Upstream replays the lifecycle effects under React Strict Mode; Solid has no Strict Mode, so
  // this only checks that the instant phase ends once the group times out.
  it('resets the instant phase after the group times out', () => {
    render(() => (
      <FloatingDelayGroup delay={{ open: 1000, close: 0 }} timeoutMs={50}>
        <Tooltip label="one" />
        <Tooltip label="two" />
      </FloatingDelayGroup>
    ));
    flush();

    mouseEnter(screen.getByTestId('reference-one'));
    advance(1000);

    mouseEnter(screen.getByTestId('reference-two'));
    advance(1);

    const secondReference = screen.getByTestId('reference-two');
    expect(secondReference).toHaveAttribute('data-instant-phase');

    mouseLeave(secondReference);
    advance(50);

    expect(secondReference).not.toHaveAttribute('data-instant-phase');
  });

  it('keeps the active context when an inactive consumer unmounts', () => {
    function Test() {
      const [showSecond, setShowSecond] = createSignal(true);

      return (
        <FloatingDelayGroup delay={{ open: 1000, close: 100 }} timeoutMs={500}>
          <Tooltip label="one" />
          <Show when={showSecond()}>
            <Tooltip label="two" />
          </Show>
          <Tooltip label="three" />
          <button type="button" onClick={() => setShowSecond(false)}>
            Remove inactive
          </button>
        </FloatingDelayGroup>
      );
    }

    render(() => <Test />);
    flush();

    mouseEnter(screen.getByTestId('reference-one'));

    advance(1000);
    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove inactive' }));
    flush();
    expect(screen.queryByTestId('reference-two')).not.toBeInTheDocument();

    mouseEnter(screen.getByTestId('reference-three'));

    advance(1);
    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-three')).toBeInTheDocument();
  });

  it('keeps the timeout active when the last closed consumer unmounts', () => {
    function Test() {
      const [showFirst, setShowFirst] = createSignal(true);

      return (
        <FloatingDelayGroup delay={{ open: 1000, close: 100 }} timeoutMs={500}>
          <Show when={showFirst()}>
            <Tooltip label="one" />
          </Show>
          <Tooltip label="two" />
          <button type="button" onClick={() => setShowFirst(false)}>
            Remove closed
          </button>
        </FloatingDelayGroup>
      );
    }

    render(() => <Test />);
    flush();

    mouseEnter(screen.getByTestId('reference-one'));

    advance(1000);

    mouseLeave(screen.getByTestId('reference-one'));

    advance(100);
    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove closed' }));
    flush();
    expect(screen.queryByTestId('reference-one')).not.toBeInTheDocument();

    mouseEnter(screen.getByTestId('reference-two'));

    advance(1);
    expect(screen.getByTestId('floating-two')).toBeInTheDocument();
  });

  // Upstream also counts React re-renders of each consumer; Solid components don't re-render, so
  // only the grouping behavior is checked.
  it('keeps grouping active until timeoutMs elapses after a close', () => {
    render(() => (
      <FloatingDelayGroup delay={{ open: 1000, close: 100 }} timeoutMs={500}>
        <Tooltip label="one" />
        <Tooltip label="two" />
        <Tooltip label="three" />
      </FloatingDelayGroup>
    ));
    flush();

    mouseEnter(screen.getByTestId('reference-one'));

    advance(1000);

    mouseLeave(screen.getByTestId('reference-one'));

    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    advance(499);
    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    mouseEnter(screen.getByTestId('reference-two'));

    advance(1);
    expect(screen.getByTestId('floating-two')).toBeInTheDocument();
    // The group was still active, so the second tooltip opened in the instant phase.
    expect(screen.getByTestId('reference-two')).toHaveAttribute('data-instant-phase');
  });

  it('uses the delay without a provider', () => {
    render(() => <Tooltip label="solo" />);
    flush();

    mouseEnter(screen.getByTestId('reference-solo'));
    // Without a provider the group delay is 0.
    advance(0);
    expect(screen.getByTestId('floating-solo')).toBeInTheDocument();
  });
});
