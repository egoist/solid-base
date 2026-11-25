import { createSignal, flush, Show } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import type { Mock } from 'vitest';
import { Avatar } from '..';
import { createImageLoadingStatus } from '../image/createImageLoadingStatus';
import type { ImageLoadingStatus } from '../root/AvatarRoot';

vi.mock('../image/createImageLoadingStatus', () => ({ createImageLoadingStatus: vi.fn() }));

function mockLoadingStatus(getStatus: (src: string | undefined) => ImageLoadingStatus) {
  (createImageLoadingStatus as Mock).mockImplementation(
    (options: { src: () => string | undefined }) => [() => getStatus(options.src()), () => {}],
  );
}

describe('<Avatar.Fallback />', () => {
  beforeEach(() => {
    mockLoadingStatus(() => 'idle');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a span with class, style, ref and render support', () => {
    let refElement: HTMLElement | undefined;
    render(() => (
      <Avatar.Root>
        <Avatar.Fallback
          data-testid="fallback"
          class={(state) => `status-${state.imageLoadingStatus}`}
          style={{ color: 'red' }}
          ref={(element) => {
            refElement = element;
          }}
        >
          AC
        </Avatar.Fallback>
        <Avatar.Fallback render="div" data-testid="div-fallback" />
      </Avatar.Root>
    ));
    const fallback = screen.getByTestId('fallback');
    expect(fallback.tagName).toBe('SPAN');
    expect(fallback).toHaveClass('status-idle');
    expect(fallback.style.color).toBe('red');
    expect(refElement).toBe(fallback);
    expect(screen.getByTestId('div-fallback').tagName).toBe('DIV');
  });

  it('should not render the children if the image loaded', async () => {
    mockLoadingStatus(() => 'loaded');

    render(() => (
      <Avatar.Root>
        <Avatar.Image />
        <Avatar.Fallback data-testid="fallback" />
      </Avatar.Root>
    ));

    await waitFor(() => {
      expect(screen.queryByTestId('fallback')).toBe(null);
    });
  });

  it('should render the fallback if the image fails to load', async () => {
    mockLoadingStatus(() => 'error');

    render(() => (
      <Avatar.Root>
        <Avatar.Image />
        <Avatar.Fallback>AC</Avatar.Fallback>
      </Avatar.Root>
    ));

    await waitFor(() => {
      expect(screen.queryByText('AC')).not.toBe(null);
    });
  });

  it('shows the fallback when a loaded image is unmounted', async () => {
    mockLoadingStatus(() => 'loaded');

    const [showImage, setShowImage] = createSignal(true);

    render(() => (
      <div>
        <button onClick={() => setShowImage(false)}>Hide image</button>
        <Avatar.Root>
          <Show when={showImage()}>
            <Avatar.Image data-testid="image" src="avatar.png" />
          </Show>
          <Avatar.Fallback data-testid="fallback">AC</Avatar.Fallback>
        </Avatar.Root>
      </div>
    ));

    await waitFor(() => {
      expect(screen.queryByTestId('fallback')).toBe(null);
    });
    expect(screen.getByTestId('image')).not.toBe(null);

    fireEvent.click(screen.getByText('Hide image'));
    flush();

    await waitFor(() => {
      expect(screen.getByTestId('fallback')).not.toBe(null);
    });
    expect(screen.queryByTestId('image')).toBe(null);
  });

  describe('prop: delay', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows the fallback when the delay has elapsed', () => {
      render(() => (
        <Avatar.Root>
          <Avatar.Image />
          <Avatar.Fallback delay={100}>AC</Avatar.Fallback>
        </Avatar.Root>
      ));

      expect(screen.queryByText('AC')).toBe(null);

      vi.advanceTimersByTime(100);
      flush();

      expect(screen.queryByText('AC')).not.toBe(null);
    });

    it('shows the fallback immediately when delay is 0', () => {
      mockLoadingStatus(() => 'error');

      render(() => (
        <Avatar.Root>
          <Avatar.Image />
          <Avatar.Fallback delay={0}>AC</Avatar.Fallback>
        </Avatar.Root>
      ));

      // No timers are advanced: `delay={0}` must render synchronously on mount.
      expect(screen.queryByText('AC')).not.toBe(null);
    });

    it('shows the fallback when delay changes to 0', () => {
      mockLoadingStatus(() => 'error');
      const [delay, setDelay] = createSignal<number | undefined>(100);

      render(() => (
        <Avatar.Root>
          <Avatar.Image />
          <Avatar.Fallback delay={delay()}>AC</Avatar.Fallback>
        </Avatar.Root>
      ));

      expect(screen.queryByText('AC')).toBe(null);

      setDelay(0);
      flush();

      expect(screen.queryByText('AC')).not.toBe(null);
    });

    it('keeps the fallback visible when delay changes from undefined to a number', () => {
      mockLoadingStatus(() => 'error');
      const [delay, setDelay] = createSignal<number | undefined>(undefined);

      render(() => (
        <Avatar.Root>
          <Avatar.Image />
          <Avatar.Fallback delay={delay()}>AC</Avatar.Fallback>
        </Avatar.Root>
      ));

      expect(screen.queryByText('AC')).not.toBe(null);

      setDelay(100);
      flush();

      expect(screen.queryByText('AC')).not.toBe(null);
    });

    it('keeps the fallback visible across a number -> undefined -> number delay change', () => {
      mockLoadingStatus(() => 'error');
      const [delay, setDelay] = createSignal<number | undefined>(100);

      render(() => (
        <Avatar.Root>
          <Avatar.Image />
          <Avatar.Fallback delay={delay()}>AC</Avatar.Fallback>
        </Avatar.Root>
      ));

      // Fallback is hidden until the delay elapses.
      expect(screen.queryByText('AC')).toBe(null);

      // Removing the delay before it elapses shows the fallback immediately.
      setDelay(undefined);
      flush();
      expect(screen.queryByText('AC')).not.toBe(null);

      // Restoring the delay must not re-hide the already-visible fallback.
      setDelay(100);
      flush();
      expect(screen.queryByText('AC')).not.toBe(null);
    });
  });

  it('keeps fallback mounted and image unmounted while the image is loading', () => {
    mockLoadingStatus((src) => (src ? 'loading' : 'error'));
    const [showImage, setShowImage] = createSignal(false);

    render(() => (
      <div>
        <button onClick={() => setShowImage(true)}>Show image</button>
        <Avatar.Root>
          <Avatar.Image data-testid="image" src={showImage() ? 'avatar.png' : undefined} />
          <Avatar.Fallback data-testid="fallback">AC</Avatar.Fallback>
        </Avatar.Root>
      </div>
    ));

    expect(screen.queryByTestId('image')).toBe(null);
    expect(screen.getByTestId('fallback')).not.toBe(null);

    fireEvent.click(screen.getByText('Show image'));
    flush();

    expect(screen.queryByTestId('image')).toBe(null);
    expect(screen.getByTestId('fallback')).not.toBe(null);
  });

  it('throws a descriptive error when rendered outside <Avatar.Root>', () => {
    expect(() => render(() => <Avatar.Fallback />)).toThrow(
      'Base UI: AvatarRootContext is missing. Avatar parts must be placed within <Avatar.Root>.',
    );
  });

  // Skipped: the upstream regression test for exit animations needs real CSS animations.
});
