import { For, createSignal, flush } from 'solid-js';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { CompositeRoot } from './root/CompositeRoot';
import { CompositeItem } from './item/CompositeItem';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Composite', () => {
  it('moves focus with arrow keys and rovers tabindex', async () => {
    render(() => (
      <CompositeRoot data-testid="root" orientation="horizontal">
        <CompositeItem data-testid="a">a</CompositeItem>
        <CompositeItem data-testid="b">b</CompositeItem>
        <CompositeItem data-testid="c">c</CompositeItem>
      </CompositeRoot>
    ));
    await tick();
    flush();
    const [a, b, c] = ['a', 'b', 'c'].map((id) => screen.getByTestId(id));
    expect(a).toHaveAttribute('tabindex', '0');
    expect(b).toHaveAttribute('tabindex', '-1');
    a.focus();
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    await tick();
    flush();
    expect(document.activeElement).toBe(b);
    expect(b).toHaveAttribute('tabindex', '0');
    expect(a).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(b, { key: 'ArrowRight' });
    await tick();
    fireEvent.keyDown(c, { key: 'ArrowRight' });
    await tick();
    flush();
    expect(document.activeElement).toBe(a);
  });

  it('orders dynamically inserted items by DOM position', async () => {
    const [items, setItems] = createSignal(['a', 'c']);
    render(() => (
      <CompositeRoot>
        <For each={items()}>{(item) => <CompositeItem data-testid={item}>{item}</CompositeItem>}</For>
      </CompositeRoot>
    ));
    await tick();
    setItems(['a', 'b', 'c']);
    flush();
    await tick();
    flush();
    const a = screen.getByTestId('a');
    a.focus();
    fireEvent.keyDown(a, { key: 'ArrowDown' });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('b')));
  });
});
