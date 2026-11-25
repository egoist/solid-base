import { render, screen } from '@solidjs/testing-library';
import { Toolbar } from '..';

describe('<Toolbar.Separator />', () => {
  it('conformance: forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Toolbar.Root>
        <Toolbar.Separator
          ref={(el) => {
            ref = el;
          }}
          class={(state) => `orientation-${state.orientation}`}
          style={{ color: 'red' }}
          render={(props) => <hr {...props} />}
        />
      </Toolbar.Root>
    ));
    const separator = screen.getByRole('separator');
    expect(ref).toBe(separator);
    expect(separator.tagName).toBe('HR');
    expect(separator).toHaveClass('orientation-vertical');
    expect(separator).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it.each([
    ['horizontal', 'vertical'],
    ['vertical', 'horizontal'],
  ] as const)('uses a %s separator in a %s toolbar', (separatorOrientation, toolbarOrientation) => {
    render(() => (
      <Toolbar.Root orientation={toolbarOrientation}>
        <Toolbar.Separator />
      </Toolbar.Root>
    ));

    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', separatorOrientation);
  });

  it('allows its orientation to be overridden', () => {
    render(() => (
      <Toolbar.Root orientation="horizontal">
        <Toolbar.Separator orientation="horizontal" />
      </Toolbar.Root>
    ));

    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('throws a descriptive error when rendered outside Toolbar.Root', () => {
    expect(() => render(() => <Toolbar.Separator />)).toThrow(
      'Base UI: ToolbarRootContext is missing. Toolbar parts must be placed within <Toolbar.Root>.',
    );
  });
});
