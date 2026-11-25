import { render, screen } from '@solidjs/testing-library';
import type { JSX } from '@solidjs/web';
import { Menu } from '..';
import { flushMicrotasks } from '../test-utils';

/**
 * The props every part shares for the conformance checks (upstream `describeConformance`).
 */
interface ConformanceProps {
  'data-testid': string;
  ref: (element: HTMLElement) => void;
  class: string;
  style: JSX.CSSProperties;
  render: (props: any) => JSX.Element;
}

/**
 * Checks that a part forwards its ref, class and style, and renders through `render`.
 */
function describeConformance(
  name: string,
  renderPart: (props: ConformanceProps) => JSX.Element,
  mount: (node: () => JSX.Element) => void,
) {
  it(`${name} forwards ref, class, style and supports render`, async () => {
    let ref: HTMLElement | undefined;
    mount(() =>
      renderPart({
        'data-testid': 'part',
        ref: (element) => {
          ref = element;
        },
        class: 'part-class',
        style: { color: 'red' },
        render: (props) => <section {...props} />,
      }),
    );
    await flushMicrotasks();

    const part = screen.getByTestId('part');
    expect(ref).toBe(part);
    expect(part.tagName).toBe('SECTION');
    expect(part).toHaveClass('part-class');
    expect(part.style.color).toBe('red');
  });
}

describe('Menu filter parts conformance', () => {
  function renderInPopup(
    node: () => JSX.Element,
    filterProps?: Partial<Menu.FilterProvider.Props>,
    withInput = true,
  ) {
    return render(() => (
      <Menu.FilterProvider {...filterProps}>
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                {withInput && <Menu.Input aria-label="Filter" />}
                {node()}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));
  }

  function renderInList(node: () => JSX.Element) {
    return renderInPopup(() => <Menu.List>{node()}</Menu.List>);
  }

  describeConformance(
    'Trigger',
    (props) => <Menu.Trigger {...props} nativeButton={false} />,
    (node) =>
      render(() => (
        <Menu.FilterProvider>
          <Menu.Root>{node()}</Menu.Root>
        </Menu.FilterProvider>
      )),
  );

  describeConformance('Input', (props) => <Menu.Input {...props} />, (node) =>
    renderInPopup(node, undefined, false),
  );

  describeConformance(
    'Clear',
    (props) => <Menu.Clear {...props} nativeButton={false} />,
    (node) => renderInPopup(node, { defaultValue: 'query' }),
  );

  it('excludes Clear from the tab order and accessibility tree', () => {
    renderInPopup(() => <Menu.Clear aria-label="Clear filter" />, { defaultValue: 'query' });

    const clear = screen.getByLabelText('Clear filter');
    expect(clear).toHaveAttribute('tabindex', '-1');
    expect(clear).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('button', { name: 'Clear filter' })).toBe(null);
  });

  describeConformance('Empty', (props) => <Menu.Empty {...props} />, (node) =>
    renderInPopup(node),
  );

  describeConformance('List', (props) => <Menu.List {...props} />, (node) => renderInPopup(node));

  describeConformance(
    'Popup',
    (props) => (
      <Menu.Popup {...props}>
        <Menu.Input aria-label="Filter" />
      </Menu.Popup>
    ),
    (node) =>
      render(() => (
        <Menu.FilterProvider>
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>{node()}</Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      )),
  );

  describeConformance('Item', (props) => <Menu.Item {...props}>Item</Menu.Item>, renderInList);

  describeConformance(
    'LinkItem',
    (props) => (
      <Menu.LinkItem href="#" {...props}>
        Link
      </Menu.LinkItem>
    ),
    renderInList,
  );

  describeConformance(
    'CheckboxItem',
    (props) => <Menu.CheckboxItem {...props}>Checkbox</Menu.CheckboxItem>,
    renderInList,
  );

  describeConformance(
    'RadioGroup',
    (props) => (
      <Menu.RadioGroup {...props}>
        <Menu.RadioItem value="value">Radio</Menu.RadioItem>
      </Menu.RadioGroup>
    ),
    renderInList,
  );

  describeConformance(
    'RadioItem',
    (props) => (
      <Menu.RadioItem value="value" {...props}>
        Radio
      </Menu.RadioItem>
    ),
    (node) => renderInList(() => <Menu.RadioGroup defaultValue="value">{node()}</Menu.RadioGroup>),
  );

  describeConformance('Group', (props) => <Menu.Group {...props} />, renderInList);

  describeConformance('Arrow', (props) => <Menu.Arrow {...props} />, (node) =>
    renderInPopup(node),
  );

  describeConformance(
    'Backdrop',
    (props) => <Menu.Backdrop {...props} />,
    (node) =>
      render(() => (
        <Menu.FilterProvider>
          <Menu.Root open>
            <Menu.Portal>
              {node()}
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter" />
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      )),
  );

  describeConformance('Separator', (props) => <Menu.Separator {...props} />, renderInList);

  describeConformance(
    'SubmenuTrigger',
    (props) => <Menu.SubmenuTrigger {...props}>More</Menu.SubmenuTrigger>,
    (node) =>
      renderInList(() => (
        <Menu.FilterProvider>
          <Menu.SubmenuRoot>{node()}</Menu.SubmenuRoot>
        </Menu.FilterProvider>
      )),
  );

  it('throws when Trigger is rendered without a root or handle', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => render(() => <Menu.Trigger />)).toThrow(
        'Base UI: <Menu.Trigger> must be either used within a <Menu.Root> component or provided with a handle.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it.each([
    ['Input', () => <Menu.Input />],
    ['Clear', () => <Menu.Clear />],
    ['Empty', () => <Menu.Empty />],
  ] as const)('throws when <Menu.%s> is rendered without a filter provider', (part, element) => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => render(element)).toThrow(
        `Base UI: <Menu.${part}> must be placed in a menu wrapped in <Menu.FilterProvider>.`,
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
