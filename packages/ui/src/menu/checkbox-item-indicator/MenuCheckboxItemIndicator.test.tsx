import { Errored, createSignal } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Menu } from '..';

function TestMenu(props: { children: any; checked?: boolean }) {
  return (
    <Menu.Root open modal={false}>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            <Menu.CheckboxItem checked={props.checked}>{props.children}</Menu.CheckboxItem>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

describe('<Menu.CheckboxItemIndicator />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <TestMenu>
          <Menu.CheckboxItemIndicator
            keepMounted
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.checked ? 'checked' : 'unchecked')}
            style={{ color: 'red' }}
            render={(props) => <i {...props} />}
            data-testid="indicator"
          />
        </TestMenu>
      ));

      const indicator = screen.getByTestId('indicator');
      expect(ref).toBe(indicator);
      expect(indicator.tagName).toBe('I');
      expect(indicator).toHaveClass('unchecked');
      expect(indicator).toHaveAttribute('aria-hidden', 'true');
      expect(indicator).toHaveAttribute('data-unchecked');
      expect(indicator.style.color).toBe('red');
    });
  });

  it('throws when rendered outside Menu.CheckboxItem', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Menu.CheckboxItemIndicator />
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent(
      'Base UI: MenuCheckboxItemContext is missing. MenuCheckboxItem parts must be placed within <Menu.CheckboxItem>.',
    );
  });

  it('renders only while the item is checked', async () => {
    const [checked, setChecked] = createSignal(true);
    render(() => (
      <div>
        <button onClick={() => setChecked(false)}>Close</button>
        <TestMenu checked={checked()}>
          <Menu.CheckboxItemIndicator data-testid="indicator" />
        </TestMenu>
      </div>
    ));

    const indicator = screen.getByTestId('indicator');
    expect(indicator).toHaveAttribute('data-checked');

    fireEvent.click(screen.getByText('Close'));

    await waitFor(() => {
      expect(screen.queryByTestId('indicator')).toBe(null);
    });
  });

  it('keeps the indicator mounted with `keepMounted`', async () => {
    const [checked, setChecked] = createSignal(true);
    render(() => (
      <div>
        <button onClick={() => setChecked(false)}>Close</button>
        <TestMenu checked={checked()}>
          <Menu.CheckboxItemIndicator data-testid="indicator" keepMounted />
        </TestMenu>
      </div>
    ));

    fireEvent.click(screen.getByText('Close'));

    await waitFor(() => {
      expect(screen.getByTestId('indicator')).toHaveAttribute('data-unchecked');
    });
  });

  // Skipped: exit animations need a real browser (jsdom has no animations).
  it.skip('should remove the indicator when the animation finishes', () => {});
  it.skip('keeps the indicator mounted to play its exit animation when unchecked without keepMounted', () => {});
});
