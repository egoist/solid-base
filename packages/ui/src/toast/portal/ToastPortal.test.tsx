import { describe, expect, it } from 'vitest';
import { Toast } from '..';
import { render, screen } from '../utils/test-utils';

describe('<Toast.Portal />', () => {
  it('renders its children into a portal element in the body', () => {
    let ref: HTMLElement | undefined;
    const { container } = render(() => (
      <Toast.Provider>
        <Toast.Portal
          ref={(el) => {
            ref = el;
          }}
          class="portal"
          data-testid="portal"
        >
          <Toast.Viewport data-testid="viewport" />
        </Toast.Portal>
      </Toast.Provider>
    ));
    const portal = screen.getByTestId('portal');
    expect(ref).toBe(portal);
    expect(portal).toHaveClass('portal');
    expect(portal.parentElement).toBe(document.body);
    expect(container).not.toContainElement(portal);
    expect(portal).toContainElement(screen.getByTestId('viewport'));
  });

  it('renders into a custom container', () => {
    const containerElement = document.createElement('div');
    document.body.appendChild(containerElement);
    render(() => (
      <Toast.Provider>
        <Toast.Portal container={containerElement} data-testid="portal">
          <Toast.Viewport />
        </Toast.Portal>
      </Toast.Provider>
    ));
    expect(screen.getByTestId('portal').parentElement).toBe(containerElement);
    containerElement.remove();
  });
});
