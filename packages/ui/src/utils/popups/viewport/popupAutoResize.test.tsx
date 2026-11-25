import { createSignal, flush } from 'solid-js';
import { render, waitFor } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import type { Dimensions } from '@floating-ui/utils';
import { createPopupAutoResize } from './popupAutoResize';

// jsdom has no layout: the popup reports its size through mocked `offsetWidth`/`offsetHeight`.
describe('createPopupAutoResize', () => {
  function setup() {
    const [content, setContent] = createSignal('one', { ownedWrite: true });
    const [mounted, setMounted] = createSignal(true, { ownedWrite: true });
    let size = { width: 100, height: 50 };

    const positioner = document.createElement('div');
    const popup = document.createElement('div');
    Object.defineProperty(popup, 'offsetWidth', { get: () => size.width });
    Object.defineProperty(popup, 'offsetHeight', { get: () => size.height });
    positioner.append(popup);
    document.body.append(positioner);

    const onMeasureLayout = vi.fn();
    const onMeasureLayoutComplete = vi.fn<(previous: Dimensions | null, next: Dimensions) => void>();

    function Fixture() {
      createPopupAutoResize({
        popupElement: popup,
        positionerElement: positioner,
        get mounted() {
          return mounted();
        },
        get content() {
          return content();
        },
        onMeasureLayout,
        onMeasureLayoutComplete,
        side: 'top',
        direction: 'ltr',
      });
      return null;
    }

    render(() => <Fixture />);

    return {
      popup,
      positioner,
      setContent,
      setMounted,
      setSize: (next: typeof size) => {
        size = next;
      },
      onMeasureLayout,
      onMeasureLayoutComplete,
    };
  }

  it('sizes the positioner to the popup when it opens', () => {
    const { popup, positioner, onMeasureLayout, onMeasureLayoutComplete } = setup();

    expect(onMeasureLayout).toHaveBeenCalledTimes(1);
    expect(onMeasureLayoutComplete).toHaveBeenCalledWith(null, { width: 100, height: 50 });
    expect(positioner.style.getPropertyValue('--positioner-width')).toBe('100px');
    expect(positioner.style.getPropertyValue('--positioner-height')).toBe('50px');
    expect(popup.style.getPropertyValue('--popup-width')).toBe('auto');
    expect(popup.style.getPropertyValue('--popup-height')).toBe('auto');
    // Anchoring styles for `side="top"` stay applied while open.
    expect(popup.style.position).toBe('absolute');
    expect(popup.style.bottom).toBe('0px');
    // Measurement overrides are restored.
    expect(popup.style.transform).toBe('');
    expect(positioner.style.getPropertyValue('--available-width')).toBe('');
  });

  it('animates from the previous size when the content changes', async () => {
    const { popup, positioner, setContent, setSize, onMeasureLayoutComplete } = setup();

    setSize({ width: 200, height: 80 });
    setContent('two');
    flush();

    expect(onMeasureLayoutComplete).toHaveBeenLastCalledWith(
      { width: 100, height: 50 },
      { width: 200, height: 80 },
    );
    expect(positioner.style.getPropertyValue('--positioner-width')).toBe('200px');
    // The popup keeps the previous size for a frame so that the change can transition.
    expect(popup.style.getPropertyValue('--popup-width')).toBe('100px');
    expect(popup.style.getPropertyValue('--popup-height')).toBe('50px');

    // Then it is set to the new size and released once animations finish.
    await waitFor(() => {
      expect(popup.style.getPropertyValue('--popup-width')).toBe('auto');
    });
    expect(popup.style.getPropertyValue('--popup-height')).toBe('auto');
  });

  it('measures from scratch after the popup unmounts', () => {
    const { setMounted, setContent, setSize, onMeasureLayoutComplete } = setup();

    setMounted(false);
    flush();
    setSize({ width: 30, height: 20 });
    setContent('two');
    setMounted(true);
    flush();

    expect(onMeasureLayoutComplete).toHaveBeenLastCalledWith(null, { width: 30, height: 20 });
  });
});
