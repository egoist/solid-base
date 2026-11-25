import { render, screen } from '@solidjs/testing-library';
import { Accordion } from '..';

describe('<Accordion.Header />', () => {
  it('throws when rendered outside an Accordion.Item', () => {
    expect(() => render(() => <Accordion.Header />)).toThrow(
      'Base UI: AccordionItemContext is missing. Accordion parts must be placed within <Accordion.Item>.',
    );
  });

  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Accordion.Root>
        <Accordion.Item>
          <Accordion.Header
            data-testid="header"
            ref={(el) => {
              ref = el;
            }}
            class="header"
            style={{ color: 'red' }}
            render={(props, state) => <h4 {...props} data-state-open={String(state.open)} />}
          />
        </Accordion.Item>
      </Accordion.Root>
    ));
    const header = screen.getByTestId('header');
    expect(ref).toBe(header);
    expect(header.tagName).toBe('H4');
    expect(header).toHaveClass('header');
    expect(header).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(header).toHaveAttribute('data-state-open', 'false');
    expect(header).toHaveAttribute('data-closed');
  });

  it('renders an h3 by default', () => {
    render(() => (
      <Accordion.Root>
        <Accordion.Item>
          <Accordion.Header>Heading</Accordion.Header>
        </Accordion.Item>
      </Accordion.Root>
    ));
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Heading');
  });
});
