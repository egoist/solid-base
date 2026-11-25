import { createSignal, flush, Show } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { resolveRenderedAriaLabel } from './resolveRenderedAriaLabel';
import { createRenderedId, resolveRenderedId } from './resolveRenderedId';

describe('resolveRenderedId', () => {
  it('prefers the id prop over the fallback, keeping empty ids', () => {
    expect(resolveRenderedId({ id: 'custom' }, 'fallback')).toBe('custom');
    expect(resolveRenderedId({}, 'fallback')).toBe('fallback');
    expect(resolveRenderedId({ id: '' }, 'fallback')).toBe('');
  });

  it('createRenderedId publishes explicit ids only while mounted', () => {
    const [id, setId] = createSignal<string | undefined>('explicit');
    const [shown, setShown] = createSignal(true);
    const published = vi.fn();

    function Element(props: { id?: string }) {
      const [renderedId, ref] = createRenderedId(props, () => 'generated', published);
      return <div ref={ref} data-testid="el" id={renderedId()} />;
    }

    render(() => (
      <Show when={shown()}>
        <Element id={id()} />
      </Show>
    ));

    expect(screen.getByTestId('el')).toHaveAttribute('id', 'explicit');
    expect(published).toHaveBeenLastCalledWith('explicit');

    setId(undefined);
    flush();
    expect(screen.getByTestId('el')).toHaveAttribute('id', 'generated');
    expect(published).toHaveBeenLastCalledWith(undefined);

    setId('next');
    flush();
    expect(published).toHaveBeenLastCalledWith('next');

    setShown(false);
    flush();
    expect(published).toHaveBeenLastCalledWith(undefined);
  });
});

describe('resolveRenderedAriaLabel', () => {
  it('returns the aria-label prop', () => {
    expect(resolveRenderedAriaLabel({ 'aria-label': 'Name' })).toBe('Name');
    expect(resolveRenderedAriaLabel({})).toBe(undefined);
  });
});
