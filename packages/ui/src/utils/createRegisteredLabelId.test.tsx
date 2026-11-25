import { createSignal, flush, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { render, screen } from '@solidjs/testing-library';
import { createRegisteredLabelId } from './createRegisteredLabelId';

describe('createRegisteredLabelId', () => {
  type Setter = Parameters<typeof createRegisteredLabelId>[1];

  function Label(props: { id: string; setLabelId: Setter; children?: JSX.Element }) {
    const registeredId = createRegisteredLabelId(() => props.id, props.setLabelId);
    return <span id={registeredId()}>{props.children}</span>;
  }

  it('does not let an older label cleanup clear a newer label', () => {
    const [labels, setLabels] = createSignal<'old' | 'both' | 'new'>('old');
    const [labelId, setLabelId] = createSignal<string | undefined>(undefined);

    render(() => (
      <>
        <div data-testid="target" aria-labelledby={labelId()} />
        <Show when={labels() !== 'new'}>
          <Label id="old-label" setLabelId={(next) => setLabelId(next as any)}>
            Old
          </Label>
        </Show>
        <Show when={labels() !== 'old'}>
          <Label id="new-label" setLabelId={(next) => setLabelId(next as any)}>
            New
          </Label>
        </Show>
      </>
    ));

    const target = screen.getByTestId('target');
    expect(target).toHaveAttribute('aria-labelledby', 'old-label');

    setLabels('both');
    flush();
    expect(target).toHaveAttribute('aria-labelledby', 'new-label');

    setLabels('new');
    flush();
    expect(target).toHaveAttribute('aria-labelledby', 'new-label');
  });

  it('generates an id when none is given', () => {
    const [labelId, setLabelId] = createSignal<string | undefined>(undefined);
    function Generated() {
      const id = createRegisteredLabelId(() => undefined, (next) => setLabelId(next as any));
      return <span data-testid="label" id={id()} />;
    }
    render(() => <Generated />);
    expect(screen.getByTestId('label').id).toMatch(/^base-ui-/);
    expect(labelId()).toBe(screen.getByTestId('label').id);
  });
});
