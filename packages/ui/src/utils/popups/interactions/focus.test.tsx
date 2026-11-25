import { createSignal, flush, onCleanup, Show } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { createTestFloating, getInteractionProps } from '../testUtils';
import { createFocus } from './focus';

function Popup(props: { setFloating: (element: HTMLElement | null) => void }) {
  onCleanup(() => props.setFloating(null));
  return <div role="tooltip" ref={(element) => props.setFloating(element)} />;
}

describe('createFocus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderApp(options: Parameters<typeof createFocus>[1] = {}) {
    function App() {
      const [open, setOpen] = createSignal(false, { ownedWrite: true });
      const { refs, store } = createTestFloating({
        open,
        onOpenChange: (nextOpen) => setOpen(nextOpen),
      });
      const focus = createFocus(store, options);
      const referenceProps = getInteractionProps([focus], 'reference');

      return (
        <>
          <button {...referenceProps} ref={refs.setReference} />
          <button data-testid="other" />
          <Show when={open()}>
            <Popup setFloating={refs.setFloating} />
          </Show>
        </>
      );
    }

    render(() => <App />);
    flush();
  }

  it('opens on focus and closes on blur', () => {
    renderApp();
    const button = screen.getAllByRole('button')[0];

    button.focus();
    flush();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    screen.getByTestId('other').focus();
    vi.advanceTimersByTime(0);
    flush();
    expect(screen.queryByRole('tooltip')).toBe(null);
  });

  it('respects the open delay', () => {
    renderApp({ delay: 100 });
    const button = screen.getAllByRole('button')[0];

    button.focus();
    vi.advanceTimersByTime(99);
    flush();
    expect(screen.queryByRole('tooltip')).toBe(null);

    vi.advanceTimersByTime(1);
    flush();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('does not reopen when focus is restored after leaving the tab', () => {
    renderApp({ delay: 100 });
    const button = screen.getAllByRole('button')[0];

    button.focus();
    flush();

    window.dispatchEvent(new Event('blur'));
    fireEvent.focus(button);

    vi.advanceTimersByTime(200);
    flush();

    expect(screen.queryByRole('tooltip')).toBe(null);
  });

  it('does nothing while disabled', () => {
    renderApp({ enabled: false });
    const button = screen.getAllByRole('button')[0];

    button.focus();
    flush();
    expect(screen.queryByRole('tooltip')).toBe(null);
  });
});
