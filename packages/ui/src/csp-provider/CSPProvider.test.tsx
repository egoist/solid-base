import { render } from '@solidjs/testing-library';
import { ScrollArea } from '../scroll-area';
import { Select } from '../select';
import { CSPProvider } from '.';

function queryDisableScrollbarStyle() {
  const styles = Array.from(document.querySelectorAll('style'));
  return (
    styles.find((element) => element.textContent?.includes('.base-ui-disable-scrollbar')) ?? null
  );
}

const flushFrames = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('<CSPProvider />', () => {
  afterEach(() => {
    queryDisableScrollbarStyle()?.remove();
  });

  it('does not inject style elements when disableStyleElements is true', async () => {
    render(() => (
      <CSPProvider disableStyleElements>
        <ScrollArea.Root>
          <ScrollArea.Viewport />
        </ScrollArea.Root>
      </CSPProvider>
    ));
    await flushFrames();
    expect(queryDisableScrollbarStyle()).toBeNull();
  });

  it('does not inject Select style elements when disableStyleElements is true', async () => {
    render(() => (
      <CSPProvider disableStyleElements>
        <Select.Root defaultOpen>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </CSPProvider>
    ));
    await flushFrames();
    expect(queryDisableScrollbarStyle()).toBeNull();
  });

  it('applies the nonce to injected style elements', async () => {
    render(() => (
      <CSPProvider nonce="test-nonce">
        <ScrollArea.Root>
          <ScrollArea.Viewport />
        </ScrollArea.Root>
      </CSPProvider>
    ));
    await flushFrames();
    const style = queryDisableScrollbarStyle();
    expect(style).not.toBeNull();
    expect(style!.nonce).toBe('test-nonce');
  });

  it('injects style elements by default', async () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport />
      </ScrollArea.Root>
    ));
    await flushFrames();
    expect(queryDisableScrollbarStyle()).not.toBeNull();
  });
});
