import { For, Show, createSignal, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor, within } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { DirectionProvider } from '../../direction-provider';
import type { TextDirection } from '../../direction-provider';
import { Tabs } from '..';

/** Lets registrations (microtasks), effects and animation frames settle. */
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

describe('<Tabs.Root />', () => {
  it('renders a div and forwards class, style, ref and render', async () => {
    let ref: HTMLElement | undefined;
    await renderAndSettle(() => (
      <Tabs.Root
        value={0}
        data-testid="root"
        class={(state) => `orientation-${state.orientation}`}
        style={{ color: 'red' }}
        ref={(element) => {
          ref = element;
        }}
      />
    ));
    const root = screen.getByTestId('root');
    expect(root.tagName).toBe('DIV');
    expect(root).toHaveClass('orientation-horizontal');
    expect(root).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(ref).toBe(root);
    expect(root).toHaveAttribute('data-orientation', 'horizontal');
    expect(root).toHaveAttribute('data-activation-direction', 'none');
  });

  it('supports the render prop', async () => {
    await renderAndSettle(() => (
      <Tabs.Root value={0} render={(props) => <section data-testid="root" {...props} />} />
    ));
    expect(screen.getByTestId('root').tagName).toBe('SECTION');
  });

  describe('prop: children', () => {
    it('should accept a null child', async () => {
      await renderAndSettle(() => (
        <Tabs.Root value={0}>
          {null}
          <Tabs.List>
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));

      expect(screen.getAllByRole('tab')).toHaveLength(1);
    });

    it('should support empty children', async () => {
      const { container } = await renderAndSettle(() => <Tabs.Root value={1} />);

      expect(container.firstElementChild).toBeEmptyDOMElement();
    });

    it('puts the selected child in tab order', async () => {
      const [value, setValue] = createSignal(1);
      await renderAndSettle(() => (
        <Tabs.Root value={value()}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));

      expect(screen.getAllByRole('tab').map((tab) => tab.tabIndex)).toEqual([-1, 0]);

      setValue(0);
      await settle();

      expect(screen.getAllByRole('tab').map((tab) => tab.tabIndex)).toEqual([0, -1]);
    });

    it('sets the aria-labelledby attribute on tab panels to the corresponding tab id', async () => {
      await renderAndSettle(() => (
        <Tabs.Root defaultValue="tab-0">
          <Tabs.List>
            <Tabs.Tab value="tab-0" />
            <Tabs.Tab value="tab-1" id="explicit-tab-id-1" />
            <Tabs.Tab value="tab-2" />
            <Tabs.Tab value="tab-3" id="explicit-tab-id-3" />
          </Tabs.List>
          <Tabs.Panel value="tab-1" keepMounted />
          <Tabs.Panel value="tab-0" keepMounted />
          <Tabs.Panel value="tab-2" keepMounted />
          <Tabs.Panel value="tab-3" keepMounted />
        </Tabs.Root>
      ));

      const tabs = screen.getAllByRole('tab');
      const tabPanels = screen.getAllByRole('tabpanel', { hidden: true });

      expect(tabs[1]).toHaveAttribute('id', 'explicit-tab-id-1');
      expect(tabPanels[0]).toHaveAttribute('aria-labelledby', tabs[1].id);
      expect(tabPanels[1]).toHaveAttribute('aria-labelledby', tabs[0].id);
      expect(tabPanels[2]).toHaveAttribute('aria-labelledby', tabs[2].id);
      expect(tabPanels[3]).toHaveAttribute('aria-labelledby', tabs[3].id);
    });

    it('sets the aria-controls attribute on tabs to the corresponding tab panel id', async () => {
      await renderAndSettle(() => (
        <Tabs.Root defaultValue="tab-0">
          <Tabs.List>
            <Tabs.Tab value="tab-0" />
            <Tabs.Tab value="tab-1" id="explicit-tab-id-1" />
            <Tabs.Tab value="tab-2" />
            <Tabs.Tab value="tab-3" id="explicit-tab-id-3" />
          </Tabs.List>
          <Tabs.Panel value="tab-1" keepMounted />
          <Tabs.Panel value="tab-0" keepMounted />
          <Tabs.Panel value="tab-2" keepMounted />
          <Tabs.Panel value="tab-3" keepMounted />
        </Tabs.Root>
      ));

      const tabs = screen.getAllByRole('tab');
      const tabPanels = screen.getAllByRole('tabpanel', { hidden: true });

      expect(tabs[0]).toHaveAttribute('aria-controls', tabPanels[1].id);
      expect(tabs[1]).toHaveAttribute('aria-controls', tabPanels[0].id);
      expect(tabs[2]).toHaveAttribute('aria-controls', tabPanels[2].id);
      expect(tabs[3]).toHaveAttribute('aria-controls', tabPanels[3].id);
    });

    it('sets aria-controls on the first tab when no value is provided', async () => {
      await renderAndSettle(() => (
        <Tabs.Root>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted />
          <Tabs.Panel value={1} keepMounted />
        </Tabs.Root>
      ));

      const tabs = screen.getAllByRole('tab');
      const tabPanels = screen.getAllByRole('tabpanel', { hidden: true });

      expect(tabs[0]).toHaveAttribute('aria-controls', tabPanels[0].id);
      expect(tabs[1]).toHaveAttribute('aria-controls', tabPanels[1].id);
      expect(tabPanels[0]).toHaveAttribute('aria-labelledby', tabs[0].id);
      expect(tabPanels[1]).toHaveAttribute('aria-labelledby', tabs[1].id);
    });

    it('syncs aria-controls to the mounted tab panel when keepMounted is false', async () => {
      const user = userEvent.setup();
      await renderAndSettle(() => (
        <Tabs.Root defaultValue="tab-0">
          <Tabs.List>
            <Tabs.Tab value="tab-0">Tab 0</Tabs.Tab>
            <Tabs.Tab value="tab-1">Tab 1</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="tab-0">Panel 0</Tabs.Panel>
          <Tabs.Panel value="tab-1">Panel 1</Tabs.Panel>
        </Tabs.Root>
      ));

      const tabs = screen.getAllByRole('tab');
      const [firstTabPanel] = screen.getAllByRole('tabpanel');

      expect(tabs[0]).toHaveAttribute('aria-controls', firstTabPanel.id);
      expect(tabs[1]).not.toHaveAttribute('aria-controls');

      await user.click(tabs[1]);

      await waitFor(() => {
        expect(tabs[1]).toHaveAttribute('aria-controls', screen.getByText('Panel 1').id);
      });

      const [secondTabPanel] = screen.getAllByRole('tabpanel');
      expect(secondTabPanel).toHaveTextContent('Panel 1');
      expect(tabs[0]).not.toHaveAttribute('aria-controls');
    });

    it('cleans and replaces panel registrations', async () => {
      const user = userEvent.setup();
      const [panel, setPanel] = createSignal({ id: 'panel-a', mounted: true, value: 'a' });

      await renderAndSettle(() => (
        <>
          <button type="button" onClick={() => setPanel({ id: 'panel-b', mounted: true, value: 'b' })}>
            replace
          </button>
          <button
            type="button"
            onClick={() => setPanel((current) => ({ ...current, mounted: false }))}
          >
            unmount
          </button>
          <button type="button" onClick={() => setPanel({ id: 'panel-c', mounted: true, value: 'b' })}>
            remount
          </button>
          <Tabs.Root value="a">
            <Tabs.List>
              <Tabs.Tab value="a">A</Tabs.Tab>
              <Tabs.Tab value="b">B</Tabs.Tab>
            </Tabs.List>
            <Show when={panel().mounted ? panel() : false} keyed>
              {(current) => <Tabs.Panel value={current.value} keepMounted />}
            </Show>
          </Tabs.Root>
        </>
      ));
      const [tabA, tabB] = screen.getAllByRole('tab');

      expect(tabA).toHaveAttribute(
        'aria-controls',
        screen.getByRole('tabpanel', { hidden: true }).id,
      );
      expect(tabB).not.toHaveAttribute('aria-controls');

      await user.click(screen.getByRole('button', { name: 'replace' }));
      await settle();
      expect(tabA).not.toHaveAttribute('aria-controls');
      expect(tabB).toHaveAttribute(
        'aria-controls',
        screen.getByRole('tabpanel', { hidden: true }).id,
      );

      await user.click(screen.getByRole('button', { name: 'unmount' }));
      await settle();
      expect(tabA).not.toHaveAttribute('aria-controls');
      expect(tabB).not.toHaveAttribute('aria-controls');

      await user.click(screen.getByRole('button', { name: 'remount' }));
      await settle();
      expect(tabA).not.toHaveAttribute('aria-controls');
      expect(tabB).toHaveAttribute(
        'aria-controls',
        screen.getByRole('tabpanel', { hidden: true }).id,
      );
    });
  });

  describe('prop: value', () => {
    it('should pass selected prop to children', async () => {
      await renderAndSettle(() => (
        <Tabs.Root value={1}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));

      const tabElements = screen.getAllByRole('tab');
      expect(tabElements[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabElements[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('should support values of different types', async () => {
      const tabValues = [0, '1', { value: 2 }, () => 3, Symbol('4'), /5/];

      await renderAndSettle(() => (
        <Tabs.Root>
          <Tabs.List>
            <For each={tabValues}>{(value) => <Tabs.Tab value={value} />}</For>
          </Tabs.List>
          <For each={tabValues}>{(value) => <Tabs.Panel value={value} keepMounted />}</For>
        </Tabs.Root>
      ));

      const tabElements = screen.getAllByRole('tab');
      const tabPanelElements = screen.getAllByRole('tabpanel', { hidden: true });

      for (let index = 0; index < tabValues.length; index += 1) {
        expect(tabPanelElements[index]).toHaveAttribute('aria-labelledby', tabElements[index].id);

        tabElements[index].click();
        // eslint-disable-next-line no-await-in-loop
        await settle();

        expect(tabElements[index]).toHaveAttribute('aria-selected', 'true');
        expect(tabPanelElements[index]).not.toHaveAttribute('hidden');
      }
    });

    it('should support a function as the default value', async () => {
      const functionValue = () => 1;

      await renderAndSettle(() => (
        <Tabs.Root defaultValue={functionValue}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={functionValue} />
          </Tabs.List>
        </Tabs.Root>
      ));

      const tabElements = screen.getAllByRole('tab');
      expect(tabElements[1]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('disabled tabs', () => {
    it('should select the second tab when the first one is disabled', async () => {
      await renderAndSettle(() => (
        <Tabs.Root>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Disabled tab
            </Tabs.Tab>
            <Tabs.Tab value={1}>Enabled tab</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted>
            Disabled panel
          </Tabs.Panel>
          <Tabs.Panel value={1} keepMounted>
            Enabled panel
          </Tabs.Panel>
        </Tabs.Root>
      ));

      const [disabledTab, enabledTab] = screen.getAllByRole('tab');
      const [disabledPanel, enabledPanel] = screen.getAllByRole('tabpanel', { hidden: true });

      expect(disabledTab).toHaveAttribute('aria-selected', 'false');
      expect(enabledTab).toHaveAttribute('aria-selected', 'true');
      expect(disabledPanel).toHaveAttribute('hidden');
      expect(enabledPanel).not.toHaveAttribute('hidden');
      expect(enabledPanel).toHaveTextContent('Enabled panel');
    });

    it('should select the third tab when first two tabs are disabled', async () => {
      await renderAndSettle(() => (
        <Tabs.Root>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1} disabled>
              Tab 1
            </Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
            <Tabs.Tab value={3}>Tab 3</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0}>Panel 0</Tabs.Panel>
          <Tabs.Panel value={1}>Panel 1</Tabs.Panel>
          <Tabs.Panel value={2}>Panel 2</Tabs.Panel>
          <Tabs.Panel value={3}>Panel 3</Tabs.Panel>
        </Tabs.Root>
      ));

      const tabs = screen.getAllByRole('tab');
      expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[3]).toHaveAttribute('aria-selected', 'false');
    });

    it('should still honor explicit defaultValue even if it points to a disabled tab', async () => {
      await renderAndSettle(() => (
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
    });

    it('ignores later defaultValue changes', async () => {
      const [defaultValue, setDefaultValue] = createSignal(0);
      await renderAndSettle(() => (
        <Tabs.Root defaultValue={defaultValue()}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

      setDefaultValue(1);
      await settle();

      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('should still honor explicit value prop even if it points to a disabled tab', async () => {
      await renderAndSettle(() => (
        <Tabs.Root value={0}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
    });

    it('does not set tabindex=0 on disabled tabs when they are programmatically selected', async () => {
      const [value, setValue] = createSignal(1);
      await renderAndSettle(() => (
        <Tabs.Root value={value()}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      const tabs = screen.getAllByRole('tab');
      expect(tabs[1]).toHaveAttribute('tabindex', '0');
      expect(tabs[0]).toHaveAttribute('tabindex', '-1');
      expect(tabs[2]).toHaveAttribute('tabindex', '-1');

      setValue(0);
      await settle();

      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[0]).toHaveAttribute('tabindex', '-1');
      expect(tabs[1]).toHaveAttribute('tabindex', '0');
    });

    it('does not select any tab when all tabs are disabled', async () => {
      await renderAndSettle(() => (
        <Tabs.Root>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1} disabled>
              Tab 1
            </Tabs.Tab>
            <Tabs.Tab value={2} disabled>
              Tab 2
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted>
            Panel 0
          </Tabs.Panel>
          <Tabs.Panel value={1} keepMounted>
            Panel 1
          </Tabs.Panel>
          <Tabs.Panel value={2} keepMounted>
            Panel 2
          </Tabs.Panel>
        </Tabs.Root>
      ));

      const tabs = screen.getAllByRole('tab');
      const panels = screen.getAllByRole('tabpanel', { hidden: true });

      tabs.forEach((tab) => expect(tab).toHaveAttribute('aria-selected', 'false'));
      panels.forEach((panel) => expect(panel).toHaveAttribute('hidden'));
    });
  });

  describe('prop: onValueChange', () => {
    it('when `activateOnFocus = true` should call onValueChange on pointerdown', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      const handlePointerDown = vi.fn();
      await renderAndSettle(() => (
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List activateOnFocus>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} onPointerDown={handlePointerDown} />
          </Tabs.List>
        </Tabs.Root>
      ));

      await user.pointer({ keys: '[MouseLeft>]', target: screen.getAllByRole('tab')[1] });
      expect(handleChange.mock.calls.length).toBe(1);
      expect(handlePointerDown.mock.calls.length).toBe(1);
    });

    it('should call onValueChange when clicking', async () => {
      const handleChange = vi.fn();

      await renderAndSettle(() => (
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));

      fireEvent.click(screen.getAllByRole('tab')[1]);
      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('none');
      expect(handleChange.mock.calls[0][1].event).toBeInstanceOf(MouseEvent);
    });

    it('should not call onValueChange when already active', async () => {
      const handleChange = vi.fn();

      await renderAndSettle(() => (
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));

      fireEvent.click(screen.getAllByRole('tab')[0]);
      expect(handleChange.mock.calls.length).toBe(0);
    });

    it('when `activateOnFocus = true` should call onValueChange if an unactive tab gets focused', async () => {
      const handleChange = vi.fn();

      await renderAndSettle(() => (
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List activateOnFocus>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));

      const [firstTab] = screen.getAllByRole('tab');
      firstTab.focus();
      fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
      await settle();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
    });

    it('when `activateOnFocus = false` should not call onValueChange if an unactive tab gets focused', async () => {
      const handleChange = vi.fn();

      await renderAndSettle(() => (
        <Tabs.Root value={1} onValueChange={handleChange}>
          <Tabs.List activateOnFocus={false}>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));

      screen.getAllByRole('tab')[0].focus();
      await settle();

      expect(handleChange.mock.calls.length).toBe(0);
    });

    it('calls onValueChange when auto-selecting the first tab on mount', async () => {
      const handleChange = vi.fn();

      await renderAndSettle(() => (
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(0);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');
      expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange with the selected value when the implicit default matches a later tab', async () => {
      const handleChange = vi.fn();

      await renderAndSettle(() => (
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(0);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange when the implicit first tab is disabled', async () => {
      const handleChange = vi.fn();

      await renderAndSettle(() => (
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');
      expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('does not cancel automatic value changes', async () => {
      const handleChange = vi.fn(
        (_value: Tabs.Tab.Value, eventDetails: Tabs.Root.ChangeEventDetails) => {
          eventDetails.cancel();
        },
      );

      await renderAndSettle(() => (
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].event).toBeInstanceOf(Event);
      expect(handleChange.mock.calls[0][1].event.type).toBe('base-ui');
      expect(handleChange.mock.calls[0][1].trigger).toBe(undefined);
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('does not move an uncontrolled selection when a user-initiated change is canceled', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn(
        (_value: Tabs.Tab.Value, eventDetails: Tabs.Root.ChangeEventDetails) => {
          if (eventDetails.reason === 'none') {
            eventDetails.cancel();
          }
        },
      );

      await renderAndSettle(() => (
        <Tabs.Root defaultValue={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

      await user.click(tabs[1]);
      await settle();

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('none');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('calls onValueChange with null when all tabs are initially disabled', async () => {
      const handleChange = vi.fn();

      await renderAndSettle(() => (
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1} disabled>
              Tab 1
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(null);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('does not emit missing when an enabled tab appears after all tabs were disabled', async () => {
      const handleChange = vi.fn();
      const [enableSecond, setEnableSecond] = createSignal(false);

      await renderAndSettle(() => (
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1} disabled={!enableSecond()}>
              Tab 1
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(null);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');

      setEnableSecond(true);
      await settle();

      expect(handleChange.mock.calls.length).toBe(1);
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('does not call onValueChange on initial render when defaultValue is provided', async () => {
      const handleChange = vi.fn();

      await renderAndSettle(() => (
        <Tabs.Root defaultValue={1} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      expect(handleChange.mock.calls.length).toBe(0);
      expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('does not call onValueChange on initial render when defaultValue is null', async () => {
      const handleChange = vi.fn();

      await renderAndSettle(() => (
        <Tabs.Root defaultValue={null} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      expect(handleChange.mock.calls.length).toBe(0);
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('treats defaultValue={undefined} as an implicit default when the first tab is disabled', async () => {
      const handleChange = vi.fn();

      await renderAndSettle(() => (
        <Tabs.Root defaultValue={undefined} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange when the selected tab becomes disabled', async () => {
      const handleChange = vi.fn();
      const [disableFirst, setDisableFirst] = createSignal(false);

      await renderAndSettle(() => (
        <Tabs.Root defaultValue={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled={disableFirst()}>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      setDisableFirst(true);
      await settle();

      expect(handleChange).toHaveBeenCalledExactlyOnceWith(
        1,
        expect.objectContaining({ reason: 'disabled', activationDirection: 'none' }),
      );

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange when an explicit disabled default becomes disabled again', async () => {
      const handleChange = vi.fn();
      const [disableFirst, setDisableFirst] = createSignal(true);

      await renderAndSettle(() => (
        <Tabs.Root defaultValue={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled={disableFirst()}>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      expect(handleChange.mock.calls.length).toBe(0);
      expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');

      setDisableFirst(false);
      await settle();

      expect(handleChange.mock.calls.length).toBe(0);
      expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');

      setDisableFirst(true);
      await settle();

      expect(handleChange).toHaveBeenCalledExactlyOnceWith(
        1,
        expect.objectContaining({ reason: 'disabled' }),
      );
      expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange when the selected tab becomes disabled with keepMounted panels', async () => {
      const handleChange = vi.fn();
      const [disableFirst, setDisableFirst] = createSignal(false);

      await renderAndSettle(() => (
        <Tabs.Root defaultValue={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled={disableFirst()}>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted>
            Panel 0
          </Tabs.Panel>
          <Tabs.Panel value={1} keepMounted>
            Panel 1
          </Tabs.Panel>
        </Tabs.Root>
      ));

      setDisableFirst(true);
      await settle();

      expect(handleChange).toHaveBeenCalledExactlyOnceWith(
        1,
        expect.objectContaining({ reason: 'disabled' }),
      );

      const panels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(panels[0]).toHaveAttribute('hidden');
      expect(panels[1]).not.toHaveAttribute('hidden');
    });

    it('calls onValueChange when the selected tab is removed', async () => {
      const handleChange = vi.fn();
      const [showFirstTab, setShowFirstTab] = createSignal(true);

      await renderAndSettle(() => (
        <Tabs.Root defaultValue={0} onValueChange={handleChange}>
          <Tabs.List>
            <Show when={showFirstTab()}>
              <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            </Show>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      setShowFirstTab(false);
      await settle();

      expect(handleChange).toHaveBeenCalledExactlyOnceWith(
        1,
        expect.objectContaining({ reason: 'missing' }),
      );

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[0]).toHaveTextContent('Tab 1');
      expect(tabs[0]).toHaveAttribute('tabindex', '0');
    });

    it('calls onValueChange with null when the selected tab is removed and no tabs remain', async () => {
      const handleChange = vi.fn();
      const [showTab, setShowTab] = createSignal(true);

      await renderAndSettle(() => (
        <Tabs.Root defaultValue={0} onValueChange={handleChange}>
          <Tabs.List>
            <Show when={showTab()}>
              <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            </Show>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted>
            Panel 0
          </Tabs.Panel>
        </Tabs.Root>
      ));

      expect(screen.getByRole('tabpanel')).not.toHaveAttribute('hidden');

      setShowTab(false);
      await settle();

      expect(handleChange).toHaveBeenCalledExactlyOnceWith(
        null,
        expect.objectContaining({ reason: 'missing' }),
      );
      expect(screen.queryAllByRole('tab').length).toBe(0);
      expect(screen.getByRole('tabpanel', { hidden: true })).toHaveAttribute('hidden');
    });

    it('calls onValueChange with null when a populated tab list is replaced by an empty one', async () => {
      const handleChange = vi.fn();
      const [empty, setEmpty] = createSignal(false);

      await renderAndSettle(() => (
        <Tabs.Root defaultValue={0} onValueChange={handleChange}>
          <Show
            when={empty()}
            fallback={
              <Tabs.List>
                <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
              </Tabs.List>
            }
          >
            <Tabs.List />
          </Show>
          <Tabs.Panel value={0} keepMounted>
            Panel 0
          </Tabs.Panel>
        </Tabs.Root>
      ));

      expect(screen.getByRole('tabpanel')).not.toHaveAttribute('hidden');

      setEmpty(true);
      await settle();

      expect(handleChange).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ reason: 'missing' }),
      );

      const panel = screen.getByRole('tabpanel', { hidden: true });
      expect(panel).toHaveAttribute('hidden');
      expect(panel).not.toHaveAttribute('aria-labelledby');
    });

    it('calls onValueChange when an explicit defaultValue points at a tab that is never present', async () => {
      const handleChange = vi.fn();

      await renderAndSettle(() => (
        <Tabs.Root defaultValue={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      expect(handleChange).toHaveBeenCalledExactlyOnceWith(
        1,
        expect.objectContaining({ reason: 'missing' }),
      );
      expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('does not emit a second change when the fallback resolves to the current value', async () => {
      const handleValueChange = vi.fn();

      // Duplicate values are not a supported configuration; this only pins that the automatic
      // fallback settles instead of re-emitting.
      await renderAndSettle(() => (
        <Tabs.Root onValueChange={handleValueChange}>
          <Tabs.List>
            <Tabs.Tab value="a" disabled>
              Stale duplicate
            </Tabs.Tab>
            <Tabs.Tab value="a">A</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.calls[0][0]).toBe('a');
      expect(handleValueChange.mock.calls[0][1].reason).toBe('initial');
    });

    it('does not call onValueChange when a controlled selected tab becomes disabled', async () => {
      const handleChange = vi.fn();
      const [disableFirst, setDisableFirst] = createSignal(false);

      await renderAndSettle(() => (
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled={disableFirst()}>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      setDisableFirst(true);
      await settle();

      expect(handleChange.mock.calls.length).toBe(0);
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('keeps a roving focus entry point when a controlled selected tab is removed', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      const [showLastTab, setShowLastTab] = createSignal(true);

      await renderAndSettle(() => (
        <>
          <button type="button">Before</button>
          <Tabs.Root value={2} onValueChange={handleChange}>
            <Tabs.List>
              <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
              <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
              <Show when={showLastTab()}>
                <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
              </Show>
            </Tabs.List>
          </Tabs.Root>
        </>
      ));

      setShowLastTab(false);
      await settle();

      expect(handleChange).not.toHaveBeenCalled();
      const [firstTab, secondTab] = screen.getAllByRole('tab');
      expect(firstTab).toHaveAttribute('aria-selected', 'false');
      expect(secondTab).toHaveAttribute('aria-selected', 'false');
      expect([firstTab.tabIndex, secondTab.tabIndex]).toEqual([0, -1]);

      screen.getByRole('button', { name: 'Before' }).focus();
      await user.tab();

      expect(firstTab).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      await settle();

      expect(secondTab).toHaveFocus();
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('prop: orientation', () => {
    it('does not add aria-orientation by default', async () => {
      await renderAndSettle(() => (
        <Tabs.Root value={0}>
          <Tabs.List />
        </Tabs.Root>
      ));

      expect(screen.getByRole('tablist')).not.toHaveAttribute('aria-orientation');
    });

    it('adds the proper aria-orientation when vertical', async () => {
      await renderAndSettle(() => (
        <Tabs.Root value={0} orientation="vertical">
          <Tabs.List />
        </Tabs.Root>
      ));

      expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
    });
  });

  describe('pointer navigation', () => {
    it('selects the clicked tab', async () => {
      const user = userEvent.setup();
      await renderAndSettle(() => (
        <Tabs.Root defaultValue={0}>
          <Tabs.List activateOnFocus={false}>
            <Tabs.Tab value={0}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 2</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 3</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted>
            Panel 1
          </Tabs.Panel>
          <Tabs.Panel value={1} keepMounted>
            Panel 2
          </Tabs.Panel>
          <Tabs.Panel value={2} keepMounted>
            Panel 3
          </Tabs.Panel>
        </Tabs.Root>
      ));

      await user.click(screen.getByRole('tab', { name: 'Tab 2' }));
      await settle();

      const panels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(panels[0]).toHaveAttribute('hidden');
      expect(panels[1]).not.toHaveAttribute('hidden');
      expect(panels[2]).toHaveAttribute('hidden');
    });

    it('does not select the clicked disabled tab', async () => {
      const user = userEvent.setup();
      await renderAndSettle(() => (
        <Tabs.Root defaultValue={0}>
          <Tabs.List activateOnFocus={false}>
            <Tabs.Tab value={0}>Tab 1</Tabs.Tab>
            <Tabs.Tab disabled value={1}>
              Tab 2
            </Tabs.Tab>
            <Tabs.Tab value={2}>Tab 3</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted>
            Panel 1
          </Tabs.Panel>
          <Tabs.Panel value={1} keepMounted>
            Panel 2
          </Tabs.Panel>
          <Tabs.Panel value={2} keepMounted>
            Panel 3
          </Tabs.Panel>
        </Tabs.Root>
      ));

      await user.click(screen.getByRole('tab', { name: 'Tab 2' }));
      await settle();

      const panels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(panels[0]).not.toHaveAttribute('hidden');
      expect(panels[1]).toHaveAttribute('hidden');
      expect(panels[2]).toHaveAttribute('hidden');
    });
  });

  describe('keyboard navigation when focus is on a tab', () => {
    const keyboardNavigationCases = [
      {
        name: 'horizontal ltr',
        orientation: 'horizontal',
        direction: 'ltr',
        previousItemKey: 'ArrowLeft',
        nextItemKey: 'ArrowRight',
      },
      {
        name: 'horizontal rtl',
        orientation: 'horizontal',
        direction: 'rtl',
        previousItemKey: 'ArrowRight',
        nextItemKey: 'ArrowLeft',
      },
      {
        name: 'vertical',
        orientation: 'vertical',
        direction: 'ltr',
        previousItemKey: 'ArrowUp',
        nextItemKey: 'ArrowDown',
      },
    ] as const;

    describe.each(keyboardNavigationCases)(
      'when focus is on a tab element in a $name tablist',
      ({ orientation, direction, previousItemKey, nextItemKey }) => {
        function renderTabs(options: {
          value: number;
          activateOnFocus: boolean;
          disabledIndex?: number;
          onValueChange?: (value: any) => void;
          onKeyDown?: (event: KeyboardEvent) => void;
        }) {
          return renderAndSettle(() => (
            <DirectionProvider direction={direction as TextDirection}>
              <Tabs.Root
                onValueChange={options.onValueChange}
                orientation={orientation}
                value={options.value}
              >
                <Tabs.List
                  activateOnFocus={options.activateOnFocus}
                  onKeyDown={options.onKeyDown}
                >
                  <Tabs.Tab value={0} disabled={options.disabledIndex === 0} />
                  <Tabs.Tab value={1} disabled={options.disabledIndex === 1} />
                  <Tabs.Tab value={2} disabled={options.disabledIndex === 2} />
                </Tabs.List>
              </Tabs.Root>
            </DirectionProvider>
          ));
        }

        async function press(target: HTMLElement, key: string) {
          target.focus();
          await settle();
          fireEvent.keyDown(target, { key });
          await settle();
        }

        describe.each([false, true])('with `activateOnFocus = %s`', (activateOnFocus) => {
          it(`${previousItemKey} wraps focus to the last tab from the first tab`, async () => {
            const handleChange = vi.fn();
            const handleKeyDown = vi.fn();
            await renderTabs({
              value: 0,
              activateOnFocus,
              onValueChange: handleChange,
              onKeyDown: handleKeyDown,
            });

            const [firstTab, , lastTab] = screen.getAllByRole('tab');
            await press(firstTab, previousItemKey);

            expect(lastTab).toHaveFocus();
            expect(handleChange.mock.calls.length).toBe(activateOnFocus ? 1 : 0);
            if (activateOnFocus) {
              expect(handleChange.mock.calls[0][0]).toBe(2);
            }
            expect(handleKeyDown.mock.calls.length).toBe(1);
            expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
          });

          it(`${previousItemKey} moves focus to the previous tab`, async () => {
            const handleChange = vi.fn();
            await renderTabs({ value: 1, activateOnFocus, onValueChange: handleChange });

            const [firstTab, secondTab] = screen.getAllByRole('tab');
            await press(secondTab, previousItemKey);

            expect(firstTab).toHaveFocus();
            expect(handleChange.mock.calls.length).toBe(activateOnFocus ? 1 : 0);
          });

          it(`${previousItemKey} moves focus to a disabled tab without activating it`, async () => {
            const handleChange = vi.fn();
            await renderTabs({
              value: 2,
              activateOnFocus,
              disabledIndex: 1,
              onValueChange: handleChange,
            });

            const [, disabledTab, lastTab] = screen.getAllByRole('tab');
            await press(lastTab, previousItemKey);

            expect(disabledTab).toHaveFocus();
            expect(handleChange).not.toHaveBeenCalled();
          });

          it(`${nextItemKey} wraps focus to the first tab from the last tab`, async () => {
            const handleChange = vi.fn();
            await renderTabs({ value: 2, activateOnFocus, onValueChange: handleChange });

            const [firstTab, , lastTab] = screen.getAllByRole('tab');
            await press(lastTab, nextItemKey);

            expect(firstTab).toHaveFocus();
            expect(handleChange.mock.calls.length).toBe(activateOnFocus ? 1 : 0);
          });

          it(`${nextItemKey} moves focus to the next tab`, async () => {
            const handleChange = vi.fn();
            await renderTabs({ value: 1, activateOnFocus, onValueChange: handleChange });

            const [, secondTab, lastTab] = screen.getAllByRole('tab');
            await press(secondTab, nextItemKey);

            expect(lastTab).toHaveFocus();
            expect(handleChange.mock.calls.length).toBe(activateOnFocus ? 1 : 0);
          });

          it(`${nextItemKey} moves focus to a disabled tab without activating it`, async () => {
            const handleChange = vi.fn();
            await renderTabs({
              value: 0,
              activateOnFocus,
              disabledIndex: 1,
              onValueChange: handleChange,
            });

            const [firstTab, disabledTab] = screen.getAllByRole('tab');
            await press(firstTab, nextItemKey);

            expect(disabledTab).toHaveFocus();
            expect(handleChange).not.toHaveBeenCalled();
          });
        });

        it.each(['Shift', 'Control', 'Alt', 'Meta'])(
          'does not move focus when modifier key: %s is pressed',
          async (modifierKey) => {
            const user = userEvent.setup();
            const handleChange = vi.fn();
            const handleKeyDown = vi.fn();
            await renderTabs({
              value: 0,
              activateOnFocus: false,
              onValueChange: handleChange,
              onKeyDown: handleKeyDown,
            });

            const [firstTab] = screen.getAllByRole('tab');

            await user.keyboard('[Tab]');
            expect(firstTab).toHaveFocus();

            await user.keyboard(`{${modifierKey}>}{${nextItemKey}}`);
            await settle();
            expect(firstTab).toHaveFocus();
            expect(handleChange.mock.calls.length).toBe(0);
            expect(handleKeyDown.mock.calls.length).toBe(2);

            await user.keyboard(`{${modifierKey}>}{${previousItemKey}}`);
            await settle();
            expect(firstTab).toHaveFocus();
            expect(handleChange.mock.calls.length).toBe(0);
            expect(handleKeyDown.mock.calls.length).toBe(4);
          },
        );
      },
    );

    describe('when focus is on a tab regardless of orientation', () => {
      it.each([
        { key: 'Home', value: 2, expectedIndex: 0, activateOnFocus: false },
        { key: 'Home', value: 2, expectedIndex: 0, activateOnFocus: true },
        { key: 'End', value: 0, expectedIndex: 2, activateOnFocus: false },
        { key: 'End', value: 0, expectedIndex: 2, activateOnFocus: true },
      ])(
        '$key moves focus with `activateOnFocus = $activateOnFocus`',
        async ({ key, value, expectedIndex, activateOnFocus }) => {
          const handleChange = vi.fn();
          const handleKeyDown = vi.fn();

          await renderAndSettle(() => (
            <Tabs.Root onValueChange={handleChange} value={value}>
              <Tabs.List activateOnFocus={activateOnFocus} onKeyDown={handleKeyDown}>
                <Tabs.Tab value={0} />
                <Tabs.Tab value={1} />
                <Tabs.Tab value={2} />
              </Tabs.List>
            </Tabs.Root>
          ));

          const tabs = screen.getAllByRole('tab');
          tabs[value].focus();
          await settle();
          fireEvent.keyDown(tabs[value], { key });
          await settle();

          expect(tabs[expectedIndex]).toHaveFocus();
          expect(handleChange.mock.calls.length).toBe(activateOnFocus ? 1 : 0);
          if (activateOnFocus) {
            expect(handleChange.mock.calls[0][0]).toBe(expectedIndex);
          }
          expect(handleKeyDown.mock.calls.length).toBe(1);
          expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
        },
      );

      it.each([
        { key: 'Home', value: 2, disabledIndex: 0, activateOnFocus: false },
        { key: 'Home', value: 2, disabledIndex: 0, activateOnFocus: true },
        { key: 'End', value: 0, disabledIndex: 2, activateOnFocus: false },
        { key: 'End', value: 0, disabledIndex: 2, activateOnFocus: true },
      ])(
        '$key moves focus to a disabled tab without activating it (activateOnFocus = $activateOnFocus)',
        async ({ key, value, disabledIndex, activateOnFocus }) => {
          const handleChange = vi.fn();

          await renderAndSettle(() => (
            <Tabs.Root onValueChange={handleChange} value={value}>
              <Tabs.List activateOnFocus={activateOnFocus}>
                <Tabs.Tab value={0} disabled={disabledIndex === 0} />
                <Tabs.Tab value={1} />
                <Tabs.Tab value={2} disabled={disabledIndex === 2} />
              </Tabs.List>
            </Tabs.Root>
          ));

          const tabs = screen.getAllByRole('tab');
          tabs[value].focus();
          await settle();
          fireEvent.keyDown(tabs[value], { key });
          await settle();

          expect(tabs[disabledIndex]).toHaveFocus();
          expect(handleChange).not.toHaveBeenCalled();
        },
      );
    });

    it('should allow to focus first tab when there are no active tabs', async () => {
      await renderAndSettle(() => (
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));

      expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('tabindex'))).toEqual([
        '0',
        '-1',
      ]);
    });
  });

  // jsdom has no layout: tab positions are mocked through `getBoundingClientRect`.
  describe('activation direction', () => {
    function mockTabPositions(orientation: 'horizontal' | 'vertical' = 'horizontal') {
      screen.getAllByRole('tab').forEach((tab, index) => {
        const offset = index * 100;
        tab.getBoundingClientRect = () =>
          ({
            left: orientation === 'horizontal' ? offset : 0,
            top: orientation === 'vertical' ? offset : 0,
            right: 0,
            bottom: 0,
            width: 100,
            height: 100,
            x: 0,
            y: 0,
            toJSON() {},
          }) as DOMRect;
      });
    }

    it.each([
      { orientation: 'horizontal', forward: 'right', backward: 'left' },
      { orientation: 'vertical', forward: 'down', backward: 'up' },
    ] as const)(
      'sets `data-activation-direction` on user activation with orientation=$orientation',
      async ({ orientation, forward, backward }) => {
        const user = userEvent.setup();
        await renderAndSettle(() => (
          <Tabs.Root data-testid="root" orientation={orientation}>
            <Tabs.List>
              <Tabs.Tab value={0} />
              <Tabs.Tab value={1} />
            </Tabs.List>
            <Tabs.Panel value={0} data-testid="panel-0" />
            <Tabs.Panel value={1} data-testid="panel-1" />
          </Tabs.Root>
        ));
        mockTabPositions(orientation);

        const root = screen.getByTestId('root');
        const [tab1, tab2] = screen.getAllByRole('tab');

        expect(root).toHaveAttribute('data-activation-direction', 'none');
        await user.click(tab2);
        await settle();

        expect(root).toHaveAttribute('data-activation-direction', forward);
        expect(screen.getByTestId('panel-1')).toHaveAttribute(
          'data-activation-direction',
          forward,
        );

        await user.click(tab1);
        await settle();

        expect(root).toHaveAttribute('data-activation-direction', backward);
        expect(screen.getByTestId('panel-0')).toHaveAttribute(
          'data-activation-direction',
          backward,
        );
      },
    );

    it('passes the activation direction in the change event details', async () => {
      const handleChange = vi.fn();
      await renderAndSettle(() => (
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));
      mockTabPositions();

      fireEvent.click(screen.getAllByRole('tab')[1]);
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('right');
    });

    it('updates `data-activation-direction` on programmatic value changes', async () => {
      const [value, setValue] = createSignal(0);
      await renderAndSettle(() => (
        <Tabs.Root data-testid="root" value={value()}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));
      mockTabPositions();

      const root = screen.getByTestId('root');
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('data-activation-direction', 'none');

      setValue(1);
      await settle();
      expect(root).toHaveAttribute('data-activation-direction', 'right');
      expect(tabs[1]).toHaveAttribute('data-activation-direction', 'right');

      setValue(0);
      await settle();
      expect(root).toHaveAttribute('data-activation-direction', 'left');
      expect(tabs[0]).toHaveAttribute('data-activation-direction', 'left');
    });

    it('keeps activation direction none after automatic disabled fallback', async () => {
      const [disableFirst, setDisableFirst] = createSignal(false);
      await renderAndSettle(() => (
        <Tabs.Root data-testid="root" defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled={disableFirst()}>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      mockTabPositions();

      setDisableFirst(true);
      await settle();

      expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('root')).toHaveAttribute('data-activation-direction', 'none');
    });

    it('resets `data-activation-direction` when the selection is cleared and restored', async () => {
      const [value, setValue] = createSignal<number | null>(0);
      await renderAndSettle(() => (
        <Tabs.Root data-testid="root" value={value()}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
            <Tabs.Indicator data-testid="indicator" />
          </Tabs.List>
        </Tabs.Root>
      ));
      mockTabPositions();

      const root = screen.getByTestId('root');

      setValue(1);
      await settle();
      expect(root).toHaveAttribute('data-activation-direction', 'right');

      setValue(null);
      await settle();
      expect(root).toHaveAttribute('data-activation-direction', 'none');
      expect(screen.queryByTestId('indicator')).toBe(null);

      setValue(0);
      await settle();
      expect(root).toHaveAttribute('data-activation-direction', 'none');
      expect(screen.getByTestId('indicator')).not.toBe(null);
    });

    it('updates `data-activation-direction` on programmatic change after a canceled click', async () => {
      const user = userEvent.setup();
      const [value, setValue] = createSignal(0);
      await renderAndSettle(() => (
        <Tabs.Root
          data-testid="root"
          value={value()}
          onValueChange={(_value, eventDetails) => {
            eventDetails.cancel();
          }}
        >
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));
      mockTabPositions();

      const root = screen.getByTestId('root');
      await user.click(screen.getAllByRole('tab')[1]);
      await settle();
      expect(root).toHaveAttribute('data-activation-direction', 'none');

      setValue(1);
      await settle();
      expect(root).toHaveAttribute('data-activation-direction', 'right');
    });

    it.each([
      { name: 'numeric values', initial: [0, 1], next: [0, 1, 2], value: 2 },
      {
        name: 'out of order string values',
        initial: ['Overview', 'Projects'],
        next: ['Overview', 'Projects', 'Account'],
        value: 'Account',
      },
    ])(
      'computes the direction when adding and selecting a new tab in one controlled update ($name)',
      async ({ initial, next, value: nextValue }) => {
        const [tabs, setTabs] = createSignal<(string | number)[]>(initial);
        const [value, setValue] = createSignal<string | number>(initial[0]);

        await renderAndSettle(() => (
          <Tabs.Root data-testid="root" value={value()}>
            <Tabs.List>
              <For each={tabs()}>{(tab) => <Tabs.Tab value={tab} />}</For>
            </Tabs.List>
            <For each={tabs()}>
              {(tab) => <Tabs.Panel value={tab} data-testid={`panel-${tab}`} />}
            </For>
          </Tabs.Root>
        ));

        const root = screen.getByTestId('root');
        expect(root).toHaveAttribute('data-activation-direction', 'none');

        // New tabs are laid out after the existing ones.
        const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
        HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(
          this: HTMLElement,
        ) {
          if (this.getAttribute('role') === 'tab') {
            const index = Array.from(this.parentElement!.children).indexOf(this);
            return { left: index * 100, top: 0, width: 100, height: 100 } as DOMRect;
          }
          return originalGetBoundingClientRect.call(this);
        };

        try {
          setTabs(next);
          setValue(nextValue);
          await settle();

          expect(root).toHaveAttribute('data-activation-direction', 'right');
          expect(screen.getByTestId(`panel-${nextValue}`)).toHaveAttribute(
            'data-activation-direction',
            'right',
          );
        } finally {
          HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
        }
      },
    );
  });

  describe('nested tabs', () => {
    it('keeps a nested root independent from the one hosting its panel', async () => {
      const user = userEvent.setup();
      await renderAndSettle(() => (
        <Tabs.Root defaultValue="outer-1">
          <Tabs.List data-testid="outer-list">
            <Tabs.Tab value="outer-1">Outer 1</Tabs.Tab>
            <Tabs.Tab value="outer-2">Outer 2</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="outer-1" data-testid="outer-panel-1">
            <Tabs.Root defaultValue="inner-1">
              <Tabs.List data-testid="inner-list">
                <Tabs.Tab value="inner-1">Inner 1</Tabs.Tab>
                <Tabs.Tab value="inner-2">Inner 2</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="inner-1">Inner panel 1</Tabs.Panel>
              <Tabs.Panel value="inner-2">Inner panel 2</Tabs.Panel>
            </Tabs.Root>
          </Tabs.Panel>
          <Tabs.Panel value="outer-2">Outer panel 2</Tabs.Panel>
        </Tabs.Root>
      ));

      const [outerTab1, outerTab2] = within(screen.getByTestId('outer-list')).getAllByRole('tab');
      const [innerTab1, innerTab2] = within(screen.getByTestId('inner-list')).getAllByRole('tab');

      const outerPanel1 = screen.getByTestId('outer-panel-1');
      const innerPanel1 = screen.getByText('Inner panel 1');

      expect(outerTab1).toHaveAttribute('aria-controls', outerPanel1.id);
      expect(innerTab1).toHaveAttribute('aria-controls', innerPanel1.id);
      expect(innerPanel1).toHaveAttribute('aria-labelledby', innerTab1.id);

      innerTab1.focus();
      await user.keyboard('{ArrowRight}');
      await settle();

      expect(innerTab2).toHaveFocus();
      expect(innerTab2).toHaveAttribute('aria-selected', 'false');

      await user.keyboard('{Enter}');
      await settle();

      expect(innerTab2).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Inner panel 2')).not.toHaveAttribute('hidden');
      expect(outerTab1).toHaveAttribute('aria-selected', 'true');
      expect(outerTab2).toHaveAttribute('aria-selected', 'false');

      await user.click(outerTab2);
      await settle();

      expect(screen.queryByTestId('inner-list')).toBe(null);
      expect(screen.getByText('Outer panel 2')).not.toHaveAttribute('hidden');
    });
  });

  // Upstream's "popups" tests (Tabs inside Popover/Dialog) are not ported: those components
  // aren't part of this package yet.

  describe('highlight synchronization on external value change relative to focus', () => {
    it.each([true, false])(
      'keeps controlled async activation and focus aligned with activateOnFocus=%s',
      async (activateOnFocus) => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        const [value, setValue] = createSignal(0);

        await renderAndSettle(() => (
          <Tabs.Root
            value={value()}
            onValueChange={(nextValue) => {
              onValueChange(nextValue);
              Promise.resolve().then(() => setValue(nextValue));
            }}
          >
            <Tabs.List activateOnFocus={activateOnFocus}>
              <Tabs.Tab value={0}>First</Tabs.Tab>
              <Tabs.Tab value={1} disabled>
                Disabled
              </Tabs.Tab>
              <Tabs.Tab value={2}>Third</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        ));
        const [firstTab, disabledTab, thirdTab] = screen.getAllByRole('tab');

        firstTab.focus();
        await user.keyboard('{ArrowRight}');
        await settle();
        expect(disabledTab).toHaveFocus();
        expect(firstTab).toHaveAttribute('aria-selected', 'true');

        await user.keyboard('{ArrowRight}');
        await settle();
        expect(thirdTab).toHaveFocus();

        expect(onValueChange.mock.calls).toEqual(activateOnFocus ? [[2]] : []);
        if (!activateOnFocus) {
          await user.keyboard('{Enter}');
        }
        await settle();

        expect(thirdTab).toHaveAttribute('aria-selected', 'true');
        expect(thirdTab).toHaveFocus();
        expect(onValueChange).toHaveBeenCalledWith(2);
      },
    );

    it('when focus is outside the tablist, highlight follows the new active tab', async () => {
      const [value, setValue] = createSignal(0);
      await renderAndSettle(() => (
        <Tabs.Root value={value()}>
          <Tabs.List activateOnFocus={false}>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
            <Tabs.Tab value={2} />
          </Tabs.List>
        </Tabs.Root>
      ));

      const tabs = screen.getAllByRole('tab');
      expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);

      setValue(2);
      await settle();
      expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, -1, 0]);

      setValue(1);
      await settle();
      expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);
    });

    it('when focus is inside the tablist, highlight stays put on external change', async () => {
      const [value, setValue] = createSignal(0);
      await renderAndSettle(() => (
        <Tabs.Root value={value()}>
          <Tabs.List activateOnFocus={false}>
            <Tabs.Tab value={0}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 2</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 3</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      const [firstTab, secondTab, thirdTab] = screen.getAllByRole('tab');

      firstTab.focus();
      await settle();
      expect(firstTab.tabIndex).toBe(0);

      setValue(2);
      await settle();

      expect([firstTab.tabIndex, secondTab.tabIndex, thirdTab.tabIndex]).toEqual([0, -1, -1]);
      expect(firstTab).toHaveAttribute('aria-selected', 'false');
      expect(thirdTab).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
      await settle();

      expect(secondTab).toHaveFocus();
      expect(thirdTab).toHaveAttribute('aria-selected', 'true');
      expect(secondTab).toHaveAttribute('aria-selected', 'false');
    });
  });
});
