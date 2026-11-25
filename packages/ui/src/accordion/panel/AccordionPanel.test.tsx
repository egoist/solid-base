import { render, screen } from '@solidjs/testing-library';
import { Accordion } from '..';

const PANEL_CONTENT = 'This is panel content';

describe('<Accordion.Panel />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Accordion.Root>
        <Accordion.Item>
          <Accordion.Panel
            keepMounted
            data-testid="panel"
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.open ? 'open' : 'closed')}
            style={{ color: 'red' }}
            render={(props, state) => <section {...props} data-hidden-state={String(state.hidden)} />}
          />
        </Accordion.Item>
      </Accordion.Root>
    ));
    const panel = screen.getByTestId('panel');
    expect(ref).toBe(panel);
    expect(panel.tagName).toBe('SECTION');
    expect(panel).toHaveClass('closed');
    expect(panel).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(panel).toHaveAttribute('data-hidden-state', 'true');
    expect(panel).toHaveAttribute('hidden');
    expect(panel.style.getPropertyValue('--accordion-panel-height')).toBe('auto');
    expect(panel.style.getPropertyValue('--accordion-panel-width')).toBe('auto');
  });

  it('warns when a panel enables hiddenUntilFound and disables keepMounted', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      render(() => (
        <Accordion.Root>
          <Accordion.Item>
            <Accordion.Panel hiddenUntilFound keepMounted={false}>
              {PANEL_CONTENT}
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));

      expect(warnSpy).toHaveBeenCalledWith(
        'Base UI: The `keepMounted={false}` prop on an `Accordion.Panel` is ignored when `hiddenUntilFound` is enabled on the panel or root, since the panel must remain mounted while closed.',
      );
      expect(screen.getByText(PANEL_CONTENT).getAttribute('hidden')).toBe('until-found');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('suppresses the initial keyframe animation from inline styles when rendered open', () => {
    render(() => (
      <Accordion.Root defaultValue={[0]}>
        <Accordion.Item value={0}>
          <Accordion.Header>
            <Accordion.Trigger>Trigger</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel
            data-testid="panel"
            style={{
              'animation-duration': '100ms',
              'animation-name': 'panel-slide-down',
              'animation-timing-function': 'linear',
            }}
          >
            {PANEL_CONTENT}
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));

    const panel = screen.getByTestId('panel');

    expect(panel.style.animationName).toBe('none');
    expect(panel.style.animationDuration).toBe('100ms');
  });

  it('passes root keepMounted to closed panels', () => {
    render(() => (
      <Accordion.Root keepMounted>
        <Accordion.Item value={0}>
          <Accordion.Header>
            <Accordion.Trigger>Trigger</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>{PANEL_CONTENT}</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));

    expect(screen.getByText(PANEL_CONTENT)).toHaveAttribute('hidden');
  });

  it('passes root hiddenUntilFound to closed panels and allows panel overrides', () => {
    render(() => (
      <Accordion.Root hiddenUntilFound keepMounted>
        <Accordion.Item value={0}>
          <Accordion.Header>
            <Accordion.Trigger>Trigger 1</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>{PANEL_CONTENT}</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value={1}>
          <Accordion.Header>
            <Accordion.Trigger>Trigger 2</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel hiddenUntilFound={false} keepMounted={false}>
            Overridden panel
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));

    expect(screen.getByText(PANEL_CONTENT).getAttribute('hidden')).toBe('until-found');
    expect(screen.queryByText('Overridden panel')).toBe(null);
  });

  it('opens a hiddenUntilFound panel on beforematch', () => {
    const onValueChange = vi.fn();
    render(() => (
      <Accordion.Root hiddenUntilFound onValueChange={onValueChange}>
        <Accordion.Item value="a">
          <Accordion.Header>
            <Accordion.Trigger>Trigger</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>{PANEL_CONTENT}</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));

    const panel = screen.getByText(PANEL_CONTENT);
    panel.dispatchEvent(new window.Event('beforematch', { bubbles: true }));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toEqual(['a']);
    expect(onValueChange.mock.calls[0][1].reason).toBe('none');
  });

  // The CSS transition and React.Activity suites need a real browser (skipped in jsdom
  // upstream too); Solid has no `Activity` equivalent.
});
