import { createSignal, flush, omit } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { useRender } from '.';
import { mergeProps } from '../merge-props';
import type { IntrinsicTagName } from '../internals/types';

describe('useRender', () => {
  it('render props does not overwrite class in a render function when unspecified', () => {
    function TestComponent(props: {
      render: useRender.RenderProp<{}>;
      class?: string;
    }) {
      return useRender({
        get render() {
          return props.render;
        },
        props: {
          get class() {
            return props.class;
          },
        },
      });
    }

    const { container } = render(() => (
      <TestComponent
        render={(props: any) => <span {...props} class={`my-span ${props.class ?? ''}`} />}
      />
    ));

    expect(container.firstElementChild).toHaveAttribute('class', 'my-span ');
  });

  it('refs are handled as expected', () => {
    const refs: Element[][] = [[], []];

    function TestComponent(props: { render: useRender.RenderProp<{}> }) {
      return useRender({
        get render() {
          return props.render;
        },
        ref: [(element: Element) => refs[0].push(element), (element: Element) => refs[1].push(element)],
        props: omit(props, 'render'),
      });
    }

    const { container } = render(() => (
      <TestComponent render={(props: any) => <span {...props} />} />
    ));

    expect(refs[0]).toEqual([container.firstElementChild]);
    expect(refs[1]).toEqual([container.firstElementChild]);
  });

  it('merges a ref passed through props', () => {
    let fromProps: Element | undefined;
    let fromParams: Element | undefined;

    const { container } = render(() =>
      useRender({
        ref: (element: Element) => {
          fromParams = element;
        },
        props: {
          ref: (element: Element) => {
            fromProps = element;
          },
        },
      }),
    );

    expect(fromParams).toBe(container.firstElementChild);
    expect(fromProps).toBe(container.firstElementChild);
  });

  describe('param: defaultTagName', () => {
    it('renders div by default if no defaultTagName and no render params are provided', () => {
      function TestComponent() {
        return useRender({});
      }

      const { container } = render(() => <TestComponent />);
      expect(container.firstElementChild).toHaveProperty('tagName', 'DIV');
    });

    it('renders the element with the default tag with no render prop', () => {
      const [tag, setTag] = createSignal<IntrinsicTagName>('div');

      function TestComponent(props: { defaultTagName: IntrinsicTagName }) {
        return useRender({
          get defaultTagName() {
            return props.defaultTagName;
          },
        });
      }

      const { container } = render(() => <TestComponent defaultTagName={tag()} />);
      expect(container.firstElementChild).toHaveProperty('tagName', 'DIV');

      setTag('span');
      flush();
      expect(container.firstElementChild).toHaveProperty('tagName', 'SPAN');
    });

    it('is overwritten by the render prop', () => {
      const [tag, setTag] = createSignal<IntrinsicTagName>('div');

      function TestComponent(props: {
        render: useRender.RenderProp<{}>;
        defaultTagName: IntrinsicTagName;
      }) {
        return useRender({
          get render() {
            return props.render;
          },
          get defaultTagName() {
            return props.defaultTagName;
          },
        });
      }

      const { container } = render(() => <TestComponent defaultTagName={tag()} render="span" />);
      expect(container.firstElementChild).toHaveProperty('tagName', 'SPAN');

      setTag('a');
      flush();
      expect(container.firstElementChild).toHaveProperty('tagName', 'SPAN');
    });

    it('adds the native defaults of the default element', () => {
      const { container } = render(() => (
        <>
          {useRender({ defaultTagName: 'button' })}
          {useRender({ defaultTagName: 'img' })}
          {useRender({
            defaultTagName: 'button',
            render: (props) => <button type="submit" {...props} />,
          })}
        </>
      ));
      const [button, image, custom] = Array.from(container.children);
      expect(button).toHaveAttribute('type', 'button');
      expect(image).toHaveAttribute('alt', '');
      expect(custom).toHaveAttribute('type', 'submit');
    });
  });

  describe('param: enabled', () => {
    it('renders nothing when disabled', () => {
      const [enabled, setEnabled] = createSignal(false);
      const { container } = render(() =>
        useRender({
          get enabled() {
            return enabled();
          },
          props: { 'data-testid': 'element' },
        }),
      );

      expect(container.firstElementChild).toBe(null);
      setEnabled(true);
      flush();
      expect(screen.getByTestId('element')).toBeInTheDocument();
    });
  });

  describe('param: props', () => {
    it('merges event handlers, classes and styles', () => {
      const log: string[] = [];
      const { container } = render(() =>
        useRender({
          render: 'button',
          props: mergeProps(
            {
              class: 'internal',
              style: { color: 'red', 'font-weight': 'bold' },
              onClick: () => log.push('internal'),
            },
            {
              class: 'external',
              style: { color: 'blue' },
              onClick: () => log.push('external'),
            },
          ),
        }),
      );

      const button = container.firstElementChild as HTMLElement;
      expect(button).toHaveClass('internal', 'external');
      expect(button.style.color).toBe('blue');
      expect(button.style.fontWeight).toBe('bold');
      fireEvent.click(button);
      expect(log).toEqual(['external', 'internal']);
    });

    it('accepts a props getter', () => {
      const { container } = render(() =>
        useRender({
          state: { active: true },
          props: (merged: Record<string, unknown>) => ({ ...merged, title: 'getter' }),
        }),
      );

      expect(container.firstElementChild).toHaveAttribute('title', 'getter');
      expect(container.firstElementChild).toHaveAttribute('data-active', '');
    });
  });

  describe('state to data attributes', () => {
    it('converts state to data attributes automatically', () => {
      function TestComponent() {
        return useRender({
          render: (props) => <button type="button" {...props} />,
          state: {
            active: true,
            index: 42,
          },
        });
      }

      const { container } = render(() => <TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-active', '');
      expect(button).toHaveAttribute('data-index', '42');
    });

    it('updates data attributes when the state changes', () => {
      const [active, setActive] = createSignal(false);
      const { container } = render(() =>
        useRender({
          state: {
            get active() {
              return active();
            },
          },
        }),
      );

      expect(container.firstElementChild).not.toHaveAttribute('data-active');
      setActive(true);
      flush();
      expect(container.firstElementChild).toHaveAttribute('data-active', '');
    });

    it('handles undefined values in state', () => {
      function TestComponent() {
        return useRender({
          render: 'div',
          state: {
            defined: 'value',
            notDefined: undefined,
          },
        });
      }

      const { container } = render(() => <TestComponent />);
      const div = container.firstElementChild;

      expect(div).toHaveAttribute('data-defined', 'value');
      expect(div).not.toHaveAttribute('data-notdefined');
    });

    it('merges state-based data attributes with existing props', () => {
      function TestComponent() {
        return useRender({
          render: (props) => <button type="button" {...props} />,
          state: {
            form: 'login',
          },
          props: {
            class: 'btn-primary',
            id: 'submit-btn',
            'data-existing': 'prop',
          },
        });
      }

      const { container } = render(() => <TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-form', 'login');
      expect(button).toHaveAttribute('class', 'btn-primary');
      expect(button).toHaveAttribute('id', 'submit-btn');
      expect(button).toHaveAttribute('data-existing', 'prop');
    });

    it('props override state-based data attributes', () => {
      function TestComponent() {
        return useRender({
          render: (props) => <button type="button" {...props} />,
          state: {
            active: true,
          },
          props: {
            'data-active': 'false',
          },
        });
      }

      const { container } = render(() => <TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-active', 'false');
    });

    it('handles empty state', () => {
      function TestComponent() {
        return useRender({
          render: 'span',
          state: {},
          props: {
            class: 'test-class',
          },
        });
      }

      const { container } = render(() => <TestComponent />);
      const span = container.firstElementChild;

      expect(span).toHaveAttribute('class', 'test-class');

      const attributeNames = Array.from(span?.attributes ?? [], (attr) => attr.name);
      expect(attributeNames.filter((name) => name.startsWith('data-'))).toEqual([]);
    });

    it('handles undefined state', () => {
      function TestComponent() {
        return useRender({
          render: 'div',
          state: undefined,
          props: {
            class: 'test-class',
            'data-from-props': 'value',
          },
        });
      }

      const { container } = render(() => <TestComponent />);
      const div = container.firstElementChild;

      expect(div).toHaveAttribute('class', 'test-class');
      expect(div).toHaveAttribute('data-from-props', 'value');
    });

    it('converts boolean values in state to data attributes', () => {
      function TestComponent() {
        return useRender({
          render: (props) => <button type="button" {...props} />,
          state: {
            active: true,
            disabled: false,
          },
        });
      }

      const { container } = render(() => <TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-active', '');
      expect(button).not.toHaveAttribute('data-disabled');
    });

    it('converts number values in state to data attributes', () => {
      function TestComponent() {
        return useRender({
          render: 'div',
          state: {
            count: 0,
            index: 42,
            percentage: 99.9,
          },
        });
      }

      const { container } = render(() => <TestComponent />);
      const div = container.firstElementChild;

      expect(div).not.toHaveAttribute('data-count');
      expect(div).toHaveAttribute('data-index', '42');
      expect(div).toHaveAttribute('data-percentage', '99.9');
    });

    it('supports custom stateAttributesMapping for kebab-case conversion', () => {
      function TestComponent() {
        return useRender({
          render: (props) => <button type="button" {...props} />,
          state: {
            isActive: true,
            itemCount: 5,
            userName: 'John',
          },
          stateAttributesMapping: {
            isActive: (value) => (value ? { 'data-is-active': '' } : null),
            itemCount: (value) => ({ 'data-item-count': value.toString() }),
            userName: (value) => ({ 'data-user-name': value }),
          },
        });
      }

      const { container } = render(() => <TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-is-active', '');
      expect(button).toHaveAttribute('data-item-count', '5');
      expect(button).toHaveAttribute('data-user-name', 'John');
    });

    it('passes the state to the render function', () => {
      const { container } = render(() =>
        useRender({
          render: (props, state) => <span {...props}>{state.label}</span>,
          state: { label: 'hello' },
        }),
      );

      expect(container.firstElementChild).toHaveTextContent('hello');
    });
  });
});
