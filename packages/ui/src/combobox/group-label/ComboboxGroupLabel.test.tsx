import { Show, createSignal } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Combobox } from '..';
import { flushMicrotasks } from '../test-utils';

describe('<Combobox.GroupLabel />', () => {
  it('forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Combobox.Root open>
        <Combobox.Group>
          <Combobox.GroupLabel
            data-testid="label"
            ref={(el) => {
              ref = el;
            }}
            class="label"
            style={{ color: 'red' }}
            render={(props) => <section {...props} />}
          />
        </Combobox.Group>
      </Combobox.Root>
    ));

    const label = screen.getByTestId('label');
    expect(ref).toBe(label);
    expect(label.tagName).toBe('SECTION');
    expect(label).toHaveClass('label');
    expect(label).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  describe('a11y attributes', () => {
    function renderLabel(label: () => import('@solidjs/web').JSX.Element) {
      return render(() => (
        <Combobox.Root open>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Group>{label()}</Combobox.Group>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));
    }

    it('wires to group aria-labelledby', () => {
      renderLabel(() => <Combobox.GroupLabel>Label</Combobox.GroupLabel>);

      const group = screen.getByRole('group');
      const label = screen.getByText('Label');
      expect(group).toHaveAttribute('aria-labelledby', label.id);
    });

    it('is hidden from the accessibility tree by default', () => {
      renderLabel(() => <Combobox.GroupLabel>Label</Combobox.GroupLabel>);

      expect(screen.getByText('Label')).toHaveAttribute('aria-hidden', 'true');
    });

    it('allows overriding aria-hidden', () => {
      renderLabel(() => <Combobox.GroupLabel aria-hidden={undefined}>Label</Combobox.GroupLabel>);

      expect(screen.getByText('Label')).not.toHaveAttribute('aria-hidden');
    });

    it('uses provided id in aria-labelledby', () => {
      renderLabel(() => <Combobox.GroupLabel id="test-group">Label</Combobox.GroupLabel>);

      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-labelledby', 'test-group');
    });

    it('does not let an older label cleanup clear a newer label', async () => {
      const [labels, setLabels] = createSignal<'old' | 'both' | 'new'>('old');

      render(() => (
        <Combobox.Root open>
          <Combobox.Group>
            <Show when={labels() !== 'new'}>
              <Combobox.GroupLabel id="old-label">Old</Combobox.GroupLabel>
            </Show>
            <Show when={labels() !== 'old'}>
              <Combobox.GroupLabel id="new-label">New</Combobox.GroupLabel>
            </Show>
          </Combobox.Group>
        </Combobox.Root>
      ));
      await flushMicrotasks();

      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-labelledby', 'old-label');

      setLabels('both');
      await flushMicrotasks();
      expect(group).toHaveAttribute('aria-labelledby', 'new-label');

      setLabels('new');
      await flushMicrotasks();
      expect(group).toHaveAttribute('aria-labelledby', 'new-label');
    });
  });
});
