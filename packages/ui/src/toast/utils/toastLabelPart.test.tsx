import { Show, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { expect, vi, describe, it } from 'vitest';
import { Toast } from '..';
import { List, Button, render, renderWithProps, screen } from './test-utils';

interface LabelPartCase {
  name: string;
  Part: Component<any>;
  field: 'title' | 'description';
  attribute: string;
}

const cases: LabelPartCase[] = [
  { name: 'Toast.Title', Part: Toast.Title, field: 'title', attribute: 'aria-labelledby' },
  {
    name: 'Toast.Description',
    Part: Toast.Description,
    field: 'description',
    attribute: 'aria-describedby',
  },
];

describe('createToastLabelPart', () => {
  describe.each(cases)('<$name />', ({ Part, field, attribute }) => {
    function renderInRoot(
      node: () => JSX.Element,
      toast: Toast.Root.ToastObject = { id: 'test' },
    ) {
      return render(() => (
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root toast={toast} data-testid="root">
              {node()}
            </Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>
      ));
    }

    async function addToastFromManager() {
      const { user } = render(() => (
        <Toast.Provider>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));

      await user.click(screen.getByRole('button', { name: 'add' }));
    }

    it('throws a descriptive error when rendered outside <Toast.Root>', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        expect(() => render(() => <Part />)).toThrow(
          'Base UI: ToastRootContext is missing. Toast parts must be used within <Toast.Root>.',
        );
      } finally {
        errorSpy.mockRestore();
      }
    });

    it(`renders the toast ${field} by default`, async () => {
      await addToastFromManager();

      expect(screen.getByTestId(field)).toHaveTextContent(field);
    });

    it(`adds ${attribute} to the root element`, async () => {
      await addToastFromManager();

      expect(screen.getByTestId('root')).toHaveAttribute(attribute, screen.getByTestId(field).id);
    });

    it('does not render if it has no children', async () => {
      function AddButton() {
        const { add } = Toast.useToastManager();
        return (
          <button type="button" onClick={() => add({ [field]: undefined })}>
            add
          </button>
        );
      }

      const { user } = render(() => (
        <Toast.Provider>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>
      ));

      await user.click(screen.getByRole('button', { name: 'add' }));

      expect(screen.getByTestId('root')).not.toHaveAttribute(attribute);
      expect(screen.queryByTestId(field)).toBe(null);
    });

    it('renders a numeric zero child', () => {
      renderInRoot(() => <Part>{0}</Part>);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('conformance: forwards ref, class and style', () => {
      let ref: HTMLElement | undefined;
      renderInRoot(
        () => (
          <Part
            ref={(el: HTMLElement) => {
              ref = el;
            }}
            class={(state: { type: string | undefined }) => `type-${state.type}`}
            style={{ color: 'red' }}
          >
            content
          </Part>
        ),
        { id: 'test', type: 'info' },
      );
      const element = screen.getByText('content');
      expect(ref).toBe(element);
      expect(element).toHaveClass('type-info');
      expect(element).toHaveAttribute('data-type', 'info');
      expect(element).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });

    describe('prop: render', () => {
      // Deviation: a Solid render function can't be inspected for its own children without
      // calling it, so a render function's static content doesn't count as content. Pass the
      // content as children of the part instead.
      it('renders content passed as children with a render function', () => {
        renderInRoot(() => (
          <Part render={(props: JSX.HTMLAttributes<HTMLDivElement>) => <div {...props} />}>
            render prop content
          </Part>
        ));

        expect(screen.getByText('render prop content').tagName).toBe('DIV');
      });

      it(`wires ${attribute} to a part rendered through the render prop`, () => {
        renderInRoot(() => (
          <Part render="div">render prop content</Part>
        ));

        expect(screen.getByTestId('root')).toHaveAttribute(
          attribute,
          screen.getByText('render prop content').id,
        );
      });

      it(`renders the toast ${field} through a childless render prop`, () => {
        renderInRoot(
          () => <Part render={(props: JSX.HTMLAttributes<HTMLDivElement>) => <div {...props} />} />,
          { id: 'test', [field]: 'Toast content' },
        );

        expect(screen.getByText('Toast content')).toBeInTheDocument();
      });

      it('does not render a childless render prop when there is no content', () => {
        renderInRoot(() => (
          <Part
            render={(props: JSX.HTMLAttributes<HTMLDivElement>) => (
              <div {...props} data-testid="part-render" />
            )}
          />
        ));

        expect(screen.queryByTestId('part-render')).toBe(null);
        expect(screen.getByTestId('root')).not.toHaveAttribute(attribute);
      });
    });

    it(`clears ${attribute} from the root when the content is removed`, async () => {
      function Fixture() {
        const [content, setContent] = createSignal<string | null>('Toast content');
        return (
          <Toast.Provider>
            <Toast.Viewport>
              <Toast.Root toast={{ id: 'test' }} data-testid="root">
                <Part id="part">{content()}</Part>
              </Toast.Root>
            </Toast.Viewport>
            <button type="button" onClick={() => setContent(null)}>
              clear
            </button>
          </Toast.Provider>
        );
      }

      const { user } = render(() => <Fixture />);

      const rootElement = screen.getByTestId('root');
      expect(rootElement).toHaveAttribute(attribute, 'part');

      await user.click(screen.getByRole('button', { name: 'clear' }));

      expect(screen.queryByText('Toast content')).toBe(null);
      expect(rootElement).not.toHaveAttribute(attribute);
    });

    it('does not let an older part cleanup clear a newer part', async () => {
      function Fixture(props: { parts: 'old' | 'both' | 'new' }) {
        return (
          <Toast.Provider>
            <Toast.Viewport>
              <Toast.Root toast={{ id: 'test' }} data-testid="root">
                <Show when={props.parts !== 'new'}>
                  <Part id="old-part">Old</Part>
                </Show>
                <Show when={props.parts !== 'old'}>
                  <Part id="new-part">New</Part>
                </Show>
              </Toast.Root>
            </Toast.Viewport>
          </Toast.Provider>
        );
      }

      const { setProps } = renderWithProps(Fixture, { parts: 'old' });

      const root = screen.getByTestId('root');
      expect(root).toHaveAttribute(attribute, 'old-part');

      await setProps({ parts: 'both' });
      expect(root).toHaveAttribute(attribute, 'new-part');

      await setProps({ parts: 'new' });
      expect(root).toHaveAttribute(attribute, 'new-part');
    });
  });
});
