import { render, screen } from '@solidjs/testing-library';
import { Combobox } from '..';

describe('<Combobox.Collection />', () => {
  it('renders filtered items', () => {
    render(() => (
      <Combobox.Root items={['alpha', 'beta', 'alpine']} defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Collection>
                  {(item: string) => (
                    <Combobox.Item value={item} data-testid={`item-${item}`}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.Collection>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.getByTestId('item-alpha')).not.toBe(null);
    expect(screen.getByTestId('item-beta')).not.toBe(null);
    expect(screen.getByTestId('item-alpine')).not.toBe(null);
  });

  it('renders nothing when a nested group does not provide items', () => {
    render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Group data-testid="group">
                  <Combobox.Collection>{(item: string) => <span>{item}</span>}</Combobox.Collection>
                </Combobox.Group>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.getByTestId('group')).toBeEmptyDOMElement();
  });

  it('renders the items of a group', () => {
    const groups = [
      { value: 'fruits', items: ['apple', 'banana'] },
      { value: 'vegetables', items: ['carrot'] },
    ];
    render(() => (
      <Combobox.Root items={groups} defaultOpen>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(group: (typeof groups)[number]) => (
                  <Combobox.Group items={group.items} data-testid={`group-${group.value}`}>
                    <Combobox.Collection>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.Collection>
                  </Combobox.Group>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.getByTestId('group-fruits')).toHaveTextContent('applebanana');
    expect(screen.getByTestId('group-vegetables')).toHaveTextContent('carrot');
  });
});
