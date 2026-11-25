import { For, flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Tooltip } from '..';
import { OPEN_DELAY } from '../utils/constants';
import { flushMicrotasks, renderWithProps } from '../../dialog/test-utils';

/**
 * Advances the fake clock and flushes Solid's queued updates.
 */
async function tick(ms: number) {
  vi.advanceTimersByTime(ms);
  flush();
  await flushMicrotasks();
}

function hover(trigger: HTMLElement) {
  fireEvent.mouseEnter(trigger);
  fireEvent.mouseMove(trigger);
}

function SingleTooltip() {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger />
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup>Content</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

describe('<Tooltip.Provider />', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('prop: delay', () => {
    it('waits for the delay before showing the tooltip', async () => {
      render(() => (
        <Tooltip.Provider delay={10_000}>
          <SingleTooltip />
        </Tooltip.Provider>
      ));

      const trigger = screen.getByRole('button');

      hover(trigger);

      await flushMicrotasks();

      expect(screen.queryByText('Content')).toBe(null);

      await tick(1_000);

      expect(screen.queryByText('Content')).toBe(null);

      await tick(9_000);

      expect(screen.queryByText('Content')).not.toBe(null);
    });

    it('respects delay=0', async () => {
      render(() => (
        <Tooltip.Provider delay={0}>
          <SingleTooltip />
        </Tooltip.Provider>
      ));

      const trigger = screen.getByRole('button');

      hover(trigger);

      await flushMicrotasks();

      await tick(0);

      expect(screen.queryByText('Content')).not.toBe(null);
    });

    it('respects trigger delay prop over provider delay prop', async () => {
      render(() => (
        <Tooltip.Provider delay={10}>
          <Tooltip.Root>
            <Tooltip.Trigger delay={100} />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ));

      const trigger = screen.getByRole('button');

      hover(trigger);

      await flushMicrotasks();

      expect(screen.queryByText('Content')).toBe(null);

      await tick(99);

      expect(screen.queryByText('Content')).toBe(null);

      await tick(1);

      expect(screen.queryByText('Content')).not.toBe(null);
    });
  });

  describe('prop: closeDelay', () => {
    it('waits for the closeDelay before hiding the tooltip', async () => {
      render(() => (
        <Tooltip.Provider closeDelay={400}>
          <SingleTooltip />
        </Tooltip.Provider>
      ));

      const trigger = screen.getByRole('button');

      hover(trigger);

      await flushMicrotasks();

      await tick(OPEN_DELAY);

      expect(screen.queryByText('Content')).not.toBe(null);

      fireEvent.mouseLeave(trigger);

      await flushMicrotasks();

      await tick(300);

      expect(screen.queryByText('Content')).not.toBe(null);

      await tick(300);

      expect(screen.queryByText('Content')).toBe(null);
    });

    it('uses the latest closeDelay after the prop updates', async () => {
      const { setProps } = renderWithProps(
        (props: { closeDelay: number }) => (
          <Tooltip.Provider closeDelay={props.closeDelay}>
            <SingleTooltip />
          </Tooltip.Provider>
        ),
        { closeDelay: 400 },
      );

      const trigger = screen.getByRole('button');

      hover(trigger);

      await flushMicrotasks();

      await tick(OPEN_DELAY);

      expect(screen.queryByText('Content')).not.toBe(null);

      await setProps({ closeDelay: 1000 });

      fireEvent.mouseLeave(trigger);

      await flushMicrotasks();

      await tick(999);

      expect(screen.queryByText('Content')).not.toBe(null);

      await tick(1);

      expect(screen.queryByText('Content')).toBe(null);
    });
  });

  describe('prop: timeout', () => {
    function TwoTooltips(props: { timeout: number; providerDelay?: number; triggerDelay?: number }) {
      return (
        <Tooltip.Provider delay={props.providerDelay ?? 100} timeout={props.timeout}>
          <For each={['One', 'Two']}>
            {(name) => (
              <Tooltip.Root>
                <Tooltip.Trigger delay={props.triggerDelay}>{name}</Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup>{`Content ${name}`}</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}
          </For>
        </Tooltip.Provider>
      );
    }

    it('opens an adjacent tooltip instantly while the group is active', async () => {
      render(() => <TwoTooltips timeout={400} />);

      const first = screen.getByRole('button', { name: 'One' });
      const second = screen.getByRole('button', { name: 'Two' });

      hover(first);
      await flushMicrotasks();
      await tick(100);

      expect(screen.queryByText('Content One')).not.toBe(null);

      fireEvent.mouseLeave(first);
      hover(second);
      await flushMicrotasks();
      await tick(0);

      expect(screen.queryByText('Content Two')).not.toBe(null);
      expect(screen.queryByText('Content One')).toBe(null);
    });

    it('respects a trigger delay over delay=0 outside the instant phase', async () => {
      render(() => <TwoTooltips timeout={400} providerDelay={0} triggerDelay={100} />);

      const first = screen.getByRole('button', { name: 'One' });
      const second = screen.getByRole('button', { name: 'Two' });

      hover(first);
      await flushMicrotasks();

      await tick(99);
      expect(screen.queryByText('Content One')).toBe(null);

      await tick(1);
      expect(screen.queryByText('Content One')).not.toBe(null);

      fireEvent.mouseLeave(first);
      hover(second);
      await flushMicrotasks();
      await tick(0);

      expect(screen.queryByText('Content Two')).not.toBe(null);
      expect(screen.queryByText('Content One')).toBe(null);

      fireEvent.mouseLeave(second);
      await flushMicrotasks();
      await tick(400);

      hover(first);
      await flushMicrotasks();

      await tick(99);
      expect(screen.queryByText('Content One')).toBe(null);

      await tick(1);
      expect(screen.queryByText('Content One')).not.toBe(null);
    });

    it('requires the full delay again once the timeout elapses', async () => {
      render(() => <TwoTooltips timeout={400} />);

      const first = screen.getByRole('button', { name: 'One' });
      const second = screen.getByRole('button', { name: 'Two' });

      hover(first);
      await flushMicrotasks();
      await tick(100);

      expect(screen.queryByText('Content One')).not.toBe(null);

      fireEvent.mouseLeave(first);
      await flushMicrotasks();
      await tick(400);

      hover(second);
      await flushMicrotasks();

      expect(screen.queryByText('Content Two')).toBe(null);

      await tick(100);

      expect(screen.queryByText('Content Two')).not.toBe(null);
    });
  });
});
