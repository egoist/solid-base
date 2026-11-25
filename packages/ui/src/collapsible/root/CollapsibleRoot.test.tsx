import { Show, createSignal, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Collapsible } from '..';
import { REASONS } from '../../internals/reasons';

const PANEL_CONTENT = 'This is panel content';

describe('<Collapsible.Root />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Collapsible.Root
          data-testid="root"
          ref={(el) => {
            ref = el;
          }}
          class="root"
          style={{ color: 'red' }}
          render={(props, state) => <section {...props} data-state-open={String(state.open)} />}
        />
      ));
      const root = screen.getByTestId('root');
      expect(ref).toBe(root);
      expect(root.tagName).toBe('SECTION');
      expect(root).toHaveClass('root');
      expect(root).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(root).toHaveAttribute('data-state-open', 'false');
      expect(root).toHaveAttribute('data-closed');
    });
  });

  describe('ARIA attributes', () => {
    it('sets ARIA attributes', async () => {
      render(() => (
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger />
          <Collapsible.Panel data-testid="panel" />
        </Collapsible.Root>
      ));

      const trigger = screen.getByRole('button');
      const panel = screen.getByTestId('panel');

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-controls');
      expect(trigger.getAttribute('aria-controls')).toBe(panel.getAttribute('id'));
    });

    it('references manual panel id in trigger aria-controls', async () => {
      render(() => (
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger />
          <Collapsible.Panel id="custom-panel-id" data-testid="panel" />
        </Collapsible.Root>
      ));

      const trigger = screen.getByRole('button');
      const panel = screen.getByTestId('panel');

      expect(trigger).toHaveAttribute('aria-controls', 'custom-panel-id');
      expect(panel).toHaveAttribute('id', 'custom-panel-id');
    });

    it('unregisters and restores the generated panel id when the panel remounts', async () => {
      const [panelMounted, setPanelMounted] = createSignal(true);
      render(() => (
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger />
          <Show when={panelMounted()}>
            <Collapsible.Panel data-testid="panel" />
          </Show>
        </Collapsible.Root>
      ));
      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('aria-controls', screen.getByTestId('panel').id);

      setPanelMounted(false);
      flush();
      expect(trigger).not.toHaveAttribute('aria-controls');

      setPanelMounted(true);
      flush();
      expect(trigger).toHaveAttribute('aria-controls', screen.getByTestId('panel').id);
    });
  });

  describe('collapsible status', () => {
    it('disabled status', async () => {
      render(() => (
        <Collapsible.Root disabled>
          <Collapsible.Trigger />
          <Collapsible.Panel data-testid="panel" />
        </Collapsible.Root>
      ));

      const trigger = screen.getByRole('button');

      expect(trigger).toHaveAttribute('data-disabled');
    });

    it('does not toggle or call onOpenChange when clicked while disabled', async () => {
      const handleOpenChange = vi.fn();
      const user = userEvent.setup();

      render(() => (
        <Collapsible.Root disabled onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.click(trigger);

      expect(handleOpenChange).not.toHaveBeenCalled();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });
  });

  describe('BaseUIChangeEventDetails', () => {
    it('calls onOpenChange with eventDetails', async () => {
      const handleOpenChange = vi.fn();
      const user = userEvent.setup();

      render(() => (
        <Collapsible.Root onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await user.click(trigger);

      expect(handleOpenChange.mock.calls.length).toBe(1);
      const [openArg, details] = handleOpenChange.mock.calls[0] as [boolean, any];
      expect(openArg).toBe(true);
      expect(details.reason).toBe(REASONS.triggerPress);
      expect(details.event).toBeInstanceOf(MouseEvent);
      expect(details.isCanceled).toBe(false);
      expect(typeof details.cancel).toBe('function');
      expect(typeof details.allowPropagation).toBe('function');
    });

    it('eventDetails.cancel() prevents opening while uncontrolled', async () => {
      const handleOpenChange = vi.fn(
        (_nextOpen: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => {
          eventDetails.cancel();
        },
      );
      const user = userEvent.setup();

      render(() => (
        <Collapsible.Root onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await user.click(trigger);

      expect(handleOpenChange).toHaveBeenCalledOnce();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });

    it('eventDetails.cancel() prevents closing while uncontrolled', async () => {
      const handleOpenChange = vi.fn(
        (_nextOpen: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => {
          eventDetails.cancel();
        },
      );
      const user = userEvent.setup();

      render(() => (
        <Collapsible.Root defaultOpen onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await user.click(trigger);

      expect(handleOpenChange).toHaveBeenCalledOnce();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);
    });
  });

  // Upstream skips these in jsdom; without CSS motion the panel unmounts once the deferred
  // ending frame ran, so `waitFor` covers the close.
  describe('open state', () => {
    it('controlled trigger presses request open and close state changes', async () => {
      const user = userEvent.setup();
      const [open, setOpen] = createSignal(false);
      render(() => (
        <Collapsible.Root open={open()} onOpenChange={setOpen}>
          <Collapsible.Trigger>trigger</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'trigger' });

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);

      await user.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);

      await user.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await waitFor(() => expect(screen.queryByText(PANEL_CONTENT)).toBe(null));
    });

    it('does not change controlled open state without an external update', async () => {
      const handleOpenChange = vi.fn();
      const user = userEvent.setup();

      render(() => (
        <Collapsible.Root open={false} onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>trigger</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'trigger' });

      await user.click(trigger);

      expect(handleOpenChange).toHaveBeenCalledOnce();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });

    it('controlled mode', async () => {
      const user = userEvent.setup();
      const [open, setOpen] = createSignal(false);
      render(() => (
        <>
          <Collapsible.Root open={open()}>
            <Collapsible.Trigger>trigger</Collapsible.Trigger>
            <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
          </Collapsible.Root>
          <button type="button" onClick={() => setOpen(!open())}>
            toggle
          </button>
        </>
      ));

      const externalTrigger = screen.getByRole('button', { name: 'toggle' });
      const trigger = screen.getByRole('button', { name: 'trigger' });

      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);

      await user.click(externalTrigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-controls');
      expect(screen.queryByText(PANEL_CONTENT)).toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-open');
      expect(trigger).toHaveAttribute('data-panel-open');

      await user.click(externalTrigger);

      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await waitFor(() => expect(screen.queryByText(PANEL_CONTENT)).toBe(null));
    });

    it('uncontrolled mode', async () => {
      const user = userEvent.setup();
      render(() => (
        <Collapsible.Root defaultOpen={false}>
          <Collapsible.Trigger />
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>
      ));

      const trigger = screen.getByRole('button');

      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);

      await user.pointer({ keys: '[MouseLeft]', target: trigger });

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-controls');
      expect(screen.queryByText(PANEL_CONTENT)).toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-open');
      expect(trigger).toHaveAttribute('data-panel-open');

      await user.pointer({ keys: '[MouseLeft]', target: trigger });

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).not.toHaveAttribute('data-panel-open');
      await waitFor(() => expect(screen.queryByText(PANEL_CONTENT)).toBe(null));
    });
  });

  describe('state callbacks', () => {
    it('passes state to class and style callbacks', async () => {
      const user = userEvent.setup();
      render(() => (
        <Collapsible.Root
          data-testid="root"
          class={(state) => (state.open ? 'root-open' : 'root-closed')}
          style={(state) => ({ opacity: state.open ? '1' : '0.5' })}
        >
          <Collapsible.Trigger
            class={(state) => (state.open ? 'trigger-open' : 'trigger-closed')}
            style={(state) => ({ opacity: state.open ? '1' : '0.5' })}
          >
            Trigger
          </Collapsible.Trigger>
          <Collapsible.Panel
            keepMounted
            data-testid="panel"
            class={(state) => (state.open ? 'panel-open' : 'panel-closed')}
            style={(state) => ({ opacity: state.open ? '1' : '0.5' })}
          >
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>
      ));

      const root = screen.getByTestId('root');
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      expect(root).toHaveClass('root-closed');
      expect(root).toHaveStyle({ opacity: '0.5' });
      expect(trigger).toHaveClass('trigger-closed');
      expect(trigger).toHaveStyle({ opacity: '0.5' });
      expect(panel).toHaveClass('panel-closed');
      expect(panel).toHaveStyle({ opacity: '0.5' });

      await user.click(trigger);

      expect(root).toHaveClass('root-open');
      expect(root).toHaveStyle({ opacity: '1' });
      expect(trigger).toHaveClass('trigger-open');
      expect(trigger).toHaveStyle({ opacity: '1' });
      expect(panel).toHaveClass('panel-open');
      expect(panel).toHaveStyle({ opacity: '1' });
    });
  });

  describe('keyboard interactions', () => {
    it.each([{ key: 'Enter' }, { key: 'Space' }])(
      'key: $key does not toggle or call onOpenChange when disabled',
      async ({ key }) => {
        const handleOpenChange = vi.fn();
        const user = userEvent.setup();

        render(() => (
          <Collapsible.Root disabled onOpenChange={handleOpenChange}>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
          </Collapsible.Root>
        ));

        const trigger = screen.getByRole('button');

        await user.keyboard('[Tab]');
        expect(trigger).not.toHaveFocus();

        await user.keyboard(`[${key}]`);

        expect(handleOpenChange).not.toHaveBeenCalled();
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
      },
    );

    it.each([{ key: 'Enter' }, { key: 'Space' }])(
      'key: $key should toggle the Collapsible',
      async ({ key }) => {
        const user = userEvent.setup();
        render(() => (
          <Collapsible.Root defaultOpen={false}>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
          </Collapsible.Root>
        ));

        const trigger = screen.getByRole('button');

        expect(trigger).not.toHaveAttribute('aria-controls');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText(PANEL_CONTENT)).toBe(null);

        await user.keyboard('[Tab]');
        expect(trigger).toHaveFocus();
        await user.keyboard(`[${key}]`);

        expect(trigger).toHaveAttribute('aria-controls');
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(trigger).toHaveAttribute('data-panel-open');
        expect(screen.queryByText(PANEL_CONTENT)).toBeVisible();
        expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-open');

        await user.keyboard(`[${key}]`);

        expect(trigger).not.toHaveAttribute('aria-controls');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(trigger).not.toHaveAttribute('data-panel-open');
        await waitFor(() => expect(screen.queryByText(PANEL_CONTENT)).toBe(null));
      },
    );
  });

  it('closes synchronously-fired clicks', () => {
    render(() => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
      </Collapsible.Root>
    ));
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    flush();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
