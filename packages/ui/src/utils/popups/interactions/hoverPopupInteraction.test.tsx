import { createSignal, flush, onCleanup, Show } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { createTestFloating } from '../testUtils';
import { createHoverPopupInteraction } from './hoverPopupInteraction';
import { createHoverTriggerInteraction } from './hoverTriggerInteraction';

function Popup(props: { setFloating: (element: HTMLElement | null) => void }) {
  onCleanup(() => props.setFloating(null));
  return <div role="tooltip" ref={(element) => props.setFloating(element)} />;
}

function advance(ms: number) {
  vi.advanceTimersByTime(ms);
  flush();
}

describe('createHoverPopupInteraction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderApp(closeDelay?: number) {
    function App() {
      const [open, setOpen] = createSignal(false, { ownedWrite: true });
      const [triggerElement, setTriggerElement] = createSignal<Element | null>(null, {
        ownedWrite: true,
      });
      const { refs, store } = createTestFloating({
        open,
        onOpenChange: (nextOpen) => setOpen(nextOpen),
      });
      const referenceProps = createHoverTriggerInteraction(store, {
        get triggerElement() {
          return triggerElement();
        },
        delay: { close: closeDelay },
      });
      createHoverPopupInteraction(store, { closeDelay });

      return (
        <>
          <button
            {...referenceProps}
            ref={(node) => {
              refs.setReference(node);
              setTriggerElement(node);
            }}
          />
          <Show when={open()}>
            <Popup setFloating={refs.setFloating} />
          </Show>
        </>
      );
    }

    render(() => <App />);
    flush();
  }

  it('closes after the close delay when the pointer leaves the floating element', () => {
    renderApp(100);

    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    flush();

    const tooltip = screen.getByRole('tooltip');
    fireEvent(button, new MouseEvent('mouseleave', { relatedTarget: tooltip }));
    fireEvent.mouseEnter(tooltip);
    fireEvent.mouseLeave(tooltip);
    flush();

    advance(99);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    advance(1);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps the popup open when the floating element is entered before closeDelay elapses', () => {
    renderApp(500);

    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    flush();

    const tooltip = screen.getByRole('tooltip');
    fireEvent(button, new MouseEvent('mouseleave', { relatedTarget: tooltip }));

    advance(499);

    fireEvent.mouseEnter(tooltip);

    advance(500);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(tooltip);

    advance(499);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    advance(1);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
