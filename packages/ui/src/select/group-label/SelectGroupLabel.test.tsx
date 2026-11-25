import { render, screen } from '@solidjs/testing-library';
import { Show, createSignal, flush } from 'solid-js';
import { Select } from '..';

describe('<Select.GroupLabel />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Select.Root open>
        <Select.Group>
          <Select.GroupLabel
            ref={(el) => {
              ref = el;
            }}
            class="label"
            style={{ color: 'red' }}
            render={(props) => <section {...props} />}
          >
            Fruits
          </Select.GroupLabel>
        </Select.Group>
      </Select.Root>
    ));
    const label = screen.getByText('Fruits');
    expect(ref).toBe(label);
    expect(label.tagName).toBe('SECTION');
    expect(label).toHaveClass('label');
    expect(label).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('is hidden from the accessibility tree by default', () => {
    render(() => (
      <Select.Root open>
        <Select.Group>
          <Select.GroupLabel>Fruits</Select.GroupLabel>
        </Select.Group>
      </Select.Root>
    ));

    expect(screen.getByText('Fruits')).toHaveAttribute('aria-hidden', 'true');
  });

  it('allows overriding aria-hidden', () => {
    render(() => (
      <Select.Root open>
        <Select.Group>
          <Select.GroupLabel aria-hidden={undefined}>Fruits</Select.GroupLabel>
        </Select.Group>
      </Select.Root>
    ));

    expect(screen.getByText('Fruits')).not.toHaveAttribute('aria-hidden');
  });

  it('throws a descriptive error when rendered outside <Select.Group>', () => {
    // Rendered without a Root: a throw inside the Root's reactive children halts Solid.
    expect(() => render(() => <Select.GroupLabel />)).toThrow(
      'Base UI: SelectGroupContext is missing. SelectGroup parts must be placed within <Select.Group>.',
    );
  });

  it('removes the group aria-labelledby attribute when unmounted', () => {
    const [labelMounted, setLabelMounted] = createSignal(true);
    render(() => (
      <Select.Root open>
        <Select.Group>
          <Show when={labelMounted()}>
            <Select.GroupLabel id="group-label">Fruits</Select.GroupLabel>
          </Show>
        </Select.Group>
      </Select.Root>
    ));
    flush();

    const group = screen.getByRole('group');
    expect(group).toHaveAttribute('aria-labelledby', 'group-label');

    setLabelMounted(false);
    flush();

    expect(screen.queryByText('Fruits')).toBe(null);
    expect(group).not.toHaveAttribute('aria-labelledby');
  });

  it('does not let an older label cleanup clear a newer label', () => {
    const [labels, setLabels] = createSignal<'old' | 'both' | 'new'>('old');
    render(() => (
      <Select.Root open>
        <Select.Group>
          <Show when={labels() !== 'new'}>
            <Select.GroupLabel id="old-label">Old</Select.GroupLabel>
          </Show>
          <Show when={labels() !== 'old'}>
            <Select.GroupLabel id="new-label">New</Select.GroupLabel>
          </Show>
        </Select.Group>
      </Select.Root>
    ));
    flush();

    const group = screen.getByRole('group');
    expect(group).toHaveAttribute('aria-labelledby', 'old-label');

    setLabels('both');
    flush();
    expect(group).toHaveAttribute('aria-labelledby', 'new-label');

    setLabels('new');
    flush();
    expect(group).toHaveAttribute('aria-labelledby', 'new-label');
  });

  it('updates explicit and generated ids', () => {
    const [id, setId] = createSignal<string | undefined>(undefined);
    render(() => (
      <Select.Root open>
        <Select.Group>
          <Select.GroupLabel id={id()}>Fruits</Select.GroupLabel>
        </Select.Group>
      </Select.Root>
    ));
    flush();

    const group = screen.getByRole('group');
    const label = screen.getByText('Fruits');
    const generatedId = label.id;
    expect(group).toHaveAttribute('aria-labelledby', generatedId);

    setId('custom-label');
    flush();
    expect(group).toHaveAttribute('aria-labelledby', 'custom-label');

    setId(undefined);
    flush();
    expect(group).toHaveAttribute('aria-labelledby', generatedId);
  });

  // Skipped: 'replaces and unregisters its label in Strict Mode' (React StrictMode only);
  // ref churn assertions of 'updates explicit and generated ids…' (Solid refs are not reattached).
});
