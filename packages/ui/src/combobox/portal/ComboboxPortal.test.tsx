import { render, screen } from '@solidjs/testing-library';
import { Combobox } from '..';
import { useComboboxPortalContext } from './ComboboxPortalContext';

describe('<Combobox.Portal />', () => {
  it('forwards ref, class, style and renders a portal container into the body', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Combobox.Root open>
        <Combobox.Portal
          data-testid="portal"
          ref={(el) => {
            ref = el;
          }}
          class="portal"
          style={{ color: 'red' }}
        >
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup" />
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const portal = screen.getByTestId('portal');
    expect(ref).toBe(portal);
    expect(portal).toBeInstanceOf(window.HTMLDivElement);
    expect(portal.parentElement).toBe(document.body);
    expect(portal).toHaveClass('portal');
    expect(portal).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(portal).toContainElement(screen.getByTestId('popup'));
  });

  it('is not rendered while closed unless kept mounted', () => {
    render(() => (
      <Combobox.Root>
        <Combobox.Portal data-testid="portal">
          <Combobox.Positioner />
        </Combobox.Portal>
        <Combobox.Portal data-testid="kept" keepMounted>
          <Combobox.Positioner data-testid="positioner" />
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.queryByTestId('portal')).toBe(null);
    expect(screen.getByTestId('kept')).not.toBe(null);
    expect(screen.getByTestId('positioner')).toHaveAttribute('hidden');
  });
});

describe('ComboboxPortalContext', () => {
  it('throws a descriptive error when used outside <Combobox.Portal>', () => {
    function Consumer() {
      useComboboxPortalContext();
      return null;
    }

    expect(() => render(() => <Consumer />)).toThrow('Base UI: <Combobox.Portal> is missing.');
  });
});
