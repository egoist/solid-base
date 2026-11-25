import { Errored, Show, createSignal } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Menu } from '..';
import { MenuGroupContext } from '../group/MenuGroupContext';
import { act } from '../test-utils';

const testContext: MenuGroupContext = () => {};

function OpenMenu(props: { children: any }) {
  return (
    <Menu.Root open>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>{props.children}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

describe('<Menu.GroupLabel />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <MenuGroupContext value={testContext}>
        <Menu.GroupLabel
          ref={(el) => {
            ref = el;
          }}
          class="label"
          style={{ color: 'red' }}
          render={(props) => <span {...props} />}
        >
          Label
        </Menu.GroupLabel>
      </MenuGroupContext>
    ));
    const label = screen.getByText('Label');
    expect(ref).toBe(label);
    expect(label.tagName).toBe('SPAN');
    expect(label).toHaveClass('label');
    expect(label.style.color).toBe('red');
  });

  it('throws when rendered outside Menu.Group or Menu.RadioGroup', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Menu.GroupLabel />
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent(
      'Base UI: MenuGroupContext is missing. Menu group parts must be used within <Menu.Group> or <Menu.RadioGroup>.',
    );
  });

  describe('a11y attributes', () => {
    it('is hidden from the accessibility tree by default', () => {
      render(() => (
        <OpenMenu>
          <Menu.Group>
            <Menu.GroupLabel>Test group</Menu.GroupLabel>
          </Menu.Group>
        </OpenMenu>
      ));

      const groupLabel = screen.getByText('Test group');
      expect(groupLabel).toHaveAttribute('aria-hidden', 'true');
    });

    it('allows overriding aria-hidden', () => {
      render(() => (
        <OpenMenu>
          <Menu.Group>
            <Menu.GroupLabel aria-hidden={undefined}>Test group</Menu.GroupLabel>
          </Menu.Group>
        </OpenMenu>
      ));

      const groupLabel = screen.getByText('Test group');
      expect(groupLabel).not.toHaveAttribute('aria-hidden');
    });

    it("should reference the generated id in Group's `aria-labelledby`", async () => {
      render(() => (
        <OpenMenu>
          <Menu.Group>
            <Menu.GroupLabel>Test group</Menu.GroupLabel>
          </Menu.Group>
        </OpenMenu>
      ));
      await act(() => {});

      const group = screen.getByRole('group');
      const groupLabel = screen.getByText('Test group');

      expect(group).toHaveAttribute('aria-labelledby', groupLabel.id);
    });

    it("should reference the provided id in Group's `aria-labelledby`", async () => {
      render(() => (
        <OpenMenu>
          <Menu.Group>
            <Menu.GroupLabel id="test-group">Test group</Menu.GroupLabel>
          </Menu.Group>
        </OpenMenu>
      ));
      await act(() => {});

      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-labelledby', 'test-group');
    });

    it("should reference the generated id in RadioGroup's `aria-labelledby`", async () => {
      render(() => (
        <OpenMenu>
          <Menu.RadioGroup>
            <Menu.GroupLabel>Test group</Menu.GroupLabel>
          </Menu.RadioGroup>
        </OpenMenu>
      ));
      await act(() => {});

      const radioGroup = screen.getByRole('group');
      const groupLabel = screen.getByText('Test group');

      expect(radioGroup).toHaveAttribute('aria-labelledby', groupLabel.id);
    });

    it("should reference the provided id in RadioGroup's `aria-labelledby`", async () => {
      render(() => (
        <OpenMenu>
          <Menu.RadioGroup>
            <Menu.GroupLabel id="test-group">Test group</Menu.GroupLabel>
          </Menu.RadioGroup>
        </OpenMenu>
      ));
      await act(() => {});

      const radioGroup = screen.getByRole('group');
      expect(radioGroup).toHaveAttribute('aria-labelledby', 'test-group');
    });

    it('should support GroupLabel when RadioGroup is rendered as Group', async () => {
      render(() => (
        <OpenMenu>
          <Menu.Group render={(props) => <Menu.RadioGroup {...(props as any)} />}>
            <Menu.GroupLabel>Test group</Menu.GroupLabel>
          </Menu.Group>
        </OpenMenu>
      ));
      await act(() => {});

      const radioGroup = screen.getByRole('group');
      const groupLabel = screen.getByText('Test group');

      expect(radioGroup).toHaveAttribute('aria-labelledby', groupLabel.id);
    });

    it('does not let an older label cleanup clear a newer label', async () => {
      const [labels, setLabels] = createSignal<'old' | 'both' | 'new'>('old');
      render(() => (
        <OpenMenu>
          <Menu.Group>
            <Show when={labels() !== 'new'}>
              <Menu.GroupLabel id="old-label">Old</Menu.GroupLabel>
            </Show>
            <Show when={labels() !== 'old'}>
              <Menu.GroupLabel id="new-label">New</Menu.GroupLabel>
            </Show>
          </Menu.Group>
        </OpenMenu>
      ));
      await act(() => {});

      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-labelledby', 'old-label');

      await act(() => setLabels('both'));
      expect(group).toHaveAttribute('aria-labelledby', 'new-label');

      await act(() => setLabels('new'));
      expect(group).toHaveAttribute('aria-labelledby', 'new-label');
    });
  });
});
