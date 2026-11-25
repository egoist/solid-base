import { createSignal, flush, omit } from 'solid-js';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { renderElement, type RenderElementComponentProps } from './renderElement';
import type { BaseUIEvent } from '../types';

interface DemoState {
  pressed: boolean;
}

function Demo(props: RenderElementComponentProps<DemoState> & Record<string, any>) {
  const [pressed, setPressed] = createSignal(false);
  const state: DemoState = {
    get pressed() {
      return pressed();
    },
  };
  const elementProps = omit(props, 'render', 'class', 'style');
  return renderElement('button', props, {
    state,
    props: [
      {
        get 'aria-pressed'() {
          return pressed();
        },
        onClick() {
          setPressed((value) => !value);
        },
        class: 'internal',
      },
      elementProps,
    ],
  });
}

describe('renderElement', () => {
  it('renders the default tag with merged props and state attributes', () => {
    const clicks: string[] = [];
    render(() => (
      <Demo
        data-testid="demo"
        class={(state: DemoState) => (state.pressed ? 'on' : 'off')}
        style={{ color: 'red' }}
        onClick={() => clicks.push('user')}
      >
        Label
      </Demo>
    ));
    const button = screen.getByTestId('demo');
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveClass('internal', 'off');
    expect(button.style.color).toBe('red');
    expect(button.textContent).toBe('Label');

    fireEvent.click(button);
    flush();
    expect(clicks).toEqual(['user']);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('data-pressed', '');
    expect(button).toHaveClass('on');
    expect(button).not.toHaveClass('off');
  });

  it('lets user handlers prevent internal handlers', () => {
    render(() => (
      <Demo
        data-testid="demo"
        onClick={(event: BaseUIEvent<MouseEvent>) => event.preventBaseUIHandler()}
      />
    ));
    const button = screen.getByTestId('demo');
    fireEvent.click(button);
    flush();
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('supports a tag name and a render function', () => {
    let refEl: HTMLElement | undefined;
    render(() => (
      <>
        <Demo data-testid="span" render="span" />
        <Demo
          data-testid="link"
          ref={(el: HTMLElement) => (refEl = el)}
          render={(p: any, state: DemoState) => (
            <a {...p} href="#x">
              {state.pressed ? 'yes' : 'no'}
            </a>
          )}
        />
      </>
    ));
    expect(screen.getByTestId('span').tagName).toBe('SPAN');
    expect(screen.getByTestId('span')).not.toHaveAttribute('type');
    const link = screen.getByTestId('link');
    expect(link.tagName).toBe('A');
    expect(refEl).toBe(link);
    fireEvent.click(link);
    flush();
    expect(link.textContent).toBe('yes');
    // Same element: the render function is not called again.
    expect(screen.getByTestId('link')).toBe(link);
  });

  it('reacts to switching the render prop', () => {
    const [tag, setTag] = createSignal<'span' | 'div'>('span');
    render(() => <Demo data-testid="d" render={tag()} />);
    expect(screen.getByTestId('d').tagName).toBe('SPAN');
    setTag('div');
    flush();
    expect(screen.getByTestId('d').tagName).toBe('DIV');
  });
});
