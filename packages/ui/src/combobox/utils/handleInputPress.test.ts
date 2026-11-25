import { handleInputPress } from './handleInputPress';
import type { ComboboxStore } from '../store';

describe('handleInputPress', () => {
  it('handles an event whose target is not an Element', () => {
    const focus = vi.fn();
    const preventDefault = vi.fn();
    const currentTarget = document.createElement('div');
    const textNode = document.createTextNode('padding');
    // Solid handlers receive native events.
    const event = {
      currentTarget,
      target: textNode,
      preventDefault,
    } as unknown as MouseEvent;
    const store = {
      state: {
        openOnInputClick: false,
      },
      context: {
        inputRef: { current: { focus } },
      },
    } as unknown as ComboboxStore;

    handleInputPress(event, store, false);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
  });
});
