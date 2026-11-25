import { render, screen } from '@solidjs/testing-library';
import { Toolbar } from '..';
import { ToolbarRootContext, type ToolbarRootContextValue } from '../root/ToolbarRootContext';
import {
  CompositeRootContext,
  type CompositeRootContextValue,
} from '../../internals/composite/root/CompositeRootContext';
import { NOOP } from '../../internals/noop';

const testCompositeContext: CompositeRootContextValue = {
  highlightedIndex: () => 0,
  onHighlightedIndexChange: NOOP,
  highlightItemOnHover: () => false,
  relayKeyboardEvent: NOOP,
};

const testToolbarContext: ToolbarRootContextValue = {
  disabled: false,
  orientation: 'horizontal',
};

describe('<Toolbar.Link />', () => {
  it('conformance: forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <ToolbarRootContext value={testToolbarContext}>
        <CompositeRootContext value={testCompositeContext}>
          <Toolbar.Link
            href="#"
            ref={(el) => {
              ref = el;
            }}
            class={(state) => `orientation-${state.orientation}`}
            style={{ color: 'red' }}
            render={(props) => <a {...props} data-custom="" />}
          />
        </CompositeRootContext>
      </ToolbarRootContext>
    ));
    const link = screen.getByRole('link');
    expect(ref).toBe(link);
    expect(link).toHaveAttribute('data-custom');
    expect(link).toHaveClass('orientation-horizontal');
    expect(link).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(link).toHaveAttribute('data-orientation', 'horizontal');
  });

  describe('ARIA attributes', () => {
    it('renders an anchor', () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Link data-testid="link" href="https://base-ui.com" />
        </Toolbar.Root>
      ));

      expect(screen.getByTestId('link')).toBe(screen.getByRole('link'));
    });
  });
});
