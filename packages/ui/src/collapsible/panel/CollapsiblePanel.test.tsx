import { Show, createSignal, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Collapsible } from '..';
import { REASONS } from '../../internals/reasons';

const PANEL_CONTENT = 'This is panel content';

function fireBeforeMatch(element: Element) {
  fireEvent(element, new window.Event('beforematch', { bubbles: true, cancelable: false }));
}

describe('<Collapsible.Panel />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Panel
          data-testid="panel"
          ref={(el) => {
            ref = el;
          }}
          class={(state) => (state.open ? 'open' : 'closed')}
          style={{ color: 'red' }}
          render={(props, state) => (
            <section {...props} data-status={String(state.transitionStatus)} />
          )}
        />
      </Collapsible.Root>
    ));
    const panel = screen.getByTestId('panel');
    expect(ref).toBe(panel);
    expect(panel.tagName).toBe('SECTION');
    expect(panel).toHaveClass('open');
    expect(panel).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(panel).toHaveAttribute('data-status', 'idle');
    expect(panel).toHaveAttribute('data-open');
  });

  it('exposes the panel size as CSS variables', () => {
    render(() => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Panel data-testid="panel" />
      </Collapsible.Root>
    ));
    const panel = screen.getByTestId('panel');
    expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
    expect(panel.style.getPropertyValue('--collapsible-panel-width')).toBe('auto');
  });

  it('measures the panel while opening and resets to `auto` once open', async () => {
    const scrollHeight = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockImplementation(() => 120);
    const scrollWidth = vi
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockImplementation(() => 200);
    try {
      const heights: string[] = [];
      render(() => (
        <Collapsible.Root>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel
            data-testid="panel"
            ref={(el) => {
              new MutationObserver(() => {
                heights.push(el.style.getPropertyValue('--collapsible-panel-height'));
              }).observe(el, { attributes: true, attributeFilter: ['style'] });
            }}
          />
        </Collapsible.Root>
      ));
      fireEvent.click(screen.getByRole('button'));
      flush();
      const panel = screen.getByTestId('panel');
      await waitFor(() => {
        expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
      });
      expect(heights).toContain('120px');
      expect(panel).not.toHaveAttribute('data-starting-style');
    } finally {
      scrollHeight.mockRestore();
      scrollWidth.mockRestore();
    }
  });

  it('warns when hiddenUntilFound overrides keepMounted={false}', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      render(() => (
        <Collapsible.Root>
          <Collapsible.Panel hiddenUntilFound keepMounted={false}>
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>
      ));

      expect(warnSpy).toHaveBeenCalledWith(
        'Base UI: The `keepMounted={false}` prop on `Collapsible.Panel` is ignored when `hiddenUntilFound` is enabled, since the panel must remain mounted while closed.',
      );
      expect(screen.getByText(PANEL_CONTENT).getAttribute('hidden')).toBe('until-found');
    } finally {
      warnSpy.mockRestore();
    }
  });

  describe('prop: keepMounted', () => {
    it('does not unmount the panel when true', async () => {
      const [open, setOpen] = createSignal(false);
      render(() => (
        <Collapsible.Root open={open()} onOpenChange={setOpen}>
          <Collapsible.Trigger />
          <Collapsible.Panel keepMounted>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>
      ));

      const trigger = screen.getByRole('button');

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);
      expect(screen.queryByText(PANEL_CONTENT)).not.toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-closed');

      fireEvent.click(trigger);
      flush();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger.getAttribute('aria-controls')).toBe(
        screen.queryByText(PANEL_CONTENT)?.getAttribute('id'),
      );
      expect(screen.queryByText(PANEL_CONTENT)).toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-open');
      expect(trigger).toHaveAttribute('data-panel-open');

      fireEvent.click(trigger);
      flush();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger.getAttribute('aria-controls')).toBe(null);
      expect(screen.queryByText(PANEL_CONTENT)).not.toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-closed');
    });

    it('hides the panel after external controlled close when true and no animations are applied', async () => {
      const user = userEvent.setup();
      const [open, setOpen] = createSignal(false);
      render(() => (
        <>
          <Collapsible.Root open={open()} onOpenChange={setOpen}>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel keepMounted>{PANEL_CONTENT}</Collapsible.Panel>
          </Collapsible.Root>
          <button type="button" onClick={() => setOpen(!open())}>
            toggle externally
          </button>
        </>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const externalTrigger = screen.getByRole('button', { name: 'toggle externally' });
      const panel = screen.getByText(PANEL_CONTENT);

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(panel).toHaveAttribute('hidden');
      expect(panel).toHaveAttribute('data-closed');
      expect(panel).not.toHaveAttribute('data-ending-style');

      await user.click(externalTrigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(panel).not.toHaveAttribute('hidden');
      expect(panel).toHaveAttribute('data-open');

      await user.click(externalTrigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await waitFor(() => expect(panel).toHaveAttribute('hidden'));
      expect(panel).toHaveAttribute('data-closed');
      expect(panel).not.toHaveAttribute('data-ending-style');
    });
  });

  it('unmounts a panel that mounts after the close has already entered the ending phase', async () => {
    const renderedStatuses: Array<Collapsible.Panel.State['transitionStatus']> = [];

    render(() => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel
          // A render function is called once in Solid: the conditional lives in `<Show>`.
          render={(props, state) => (
            <Show
              when={
                (renderedStatuses.push(state.transitionStatus),
                state.open || state.transitionStatus === 'ending')
              }
            >
              <div {...props} />
            </Show>
          )}
        >
          {PANEL_CONTENT}
        </Collapsible.Panel>
      </Collapsible.Root>
    ));

    expect(screen.getByText(PANEL_CONTENT)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trigger' }));
    flush();

    await waitFor(() => {
      expect(renderedStatuses).toContain('ending');
    });
    await waitFor(() => {
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });
  });

  describe('keyframe mount animation', () => {
    it('suppresses the initial keyframe animation from inline styles when rendered open', async () => {
      const user = userEvent.setup();
      render(() => (
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel
            data-testid="panel"
            keepMounted
            style={{ 'animation-duration': '100ms', 'animation-name': 'panel-slide-down' }}
          >
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>
      ));

      const panel = screen.getByTestId('panel');
      expect(panel.style.animationName).toBe('none');
      expect(panel.style.animationDuration).toBe('100ms');

      // Once closed, the next open runs the author-defined animation.
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByRole('button'));
      expect(panel).toHaveAttribute('data-open');
      expect(panel.style.animationName).toBe('panel-slide-down');
    });
  });

  // jsdom doesn't implement `hidden="until-found"` nor `beforematch`: the event is dispatched
  // manually to exercise the listener.
  describe('prop: hiddenUntilFound', () => {
    it('uses `hidden="until-found"` to hide panel when true', () => {
      const handleOpenChange = vi.fn();

      render(() => (
        <Collapsible.Root defaultOpen={false} onOpenChange={handleOpenChange}>
          <Collapsible.Trigger />
          <Collapsible.Panel hiddenUntilFound keepMounted>
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>
      ));

      const panel = screen.getByText(PANEL_CONTENT);
      expect(panel.getAttribute('hidden')).toBe('until-found');

      fireBeforeMatch(panel);
      flush();

      expect(handleOpenChange.mock.calls.length).toBe(1);
      expect(handleOpenChange.mock.calls[0][0]).toBe(true);
      expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.none);
      expect(panel).toHaveAttribute('data-open');
      expect(panel).not.toHaveAttribute('hidden');
    });

    it('keeps the panel hidden when beforematch is canceled', async () => {
      render(() => (
        <Collapsible.Root
          onOpenChange={(_open, details) => {
            details.cancel();
          }}
        >
          <Collapsible.Trigger />
          <Collapsible.Panel hiddenUntilFound>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>
      ));

      const panel = screen.getByText(PANEL_CONTENT);
      // Emulates the browser revealing the match.
      panel.removeAttribute('hidden');
      fireBeforeMatch(panel);
      flush();

      expect(panel).toHaveAttribute('data-closed');
      await waitFor(() => expect(panel.getAttribute('hidden')).toBe('until-found'));
    });

    it('re-collapses the panel when a controlled open state never arrives', async () => {
      const handleOpenChange = vi.fn();
      render(() => (
        <Collapsible.Root open={false} onOpenChange={handleOpenChange}>
          <Collapsible.Trigger />
          <Collapsible.Panel hiddenUntilFound>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>
      ));

      const panel = screen.getByText(PANEL_CONTENT);
      panel.removeAttribute('hidden');
      fireBeforeMatch(panel);
      flush();

      expect(handleOpenChange).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(panel.getAttribute('hidden')).toBe('until-found'));
      expect(panel).toHaveAttribute('data-closed');
    });
  });

  // Upstream's CSS transition/animation, React.Activity and real `beforematch` suites need a
  // browser with layout and CSS animations (they're skipped in jsdom upstream too); Solid has no
  // `Activity` equivalent.
});
