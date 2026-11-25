import { render, screen } from '@solidjs/testing-library';
import { Combobox } from '..';
import { INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY } from '../../internals/initialLiveRegionTextMutation';
import { flushMicrotasks } from '../test-utils';

vi.mock('@egoist/solid-base-utils/platform', async () => {
  const actual = await vi.importActual<typeof import('@egoist/solid-base-utils/platform')>(
    '@egoist/solid-base-utils/platform',
  );

  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: { ...actual.platform.os, ios: true, apple: true },
    },
  };
});

describe('<Combobox.Status /> iOS', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips the initial text mutation', async () => {
    render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Status data-testid="status">Searching…</Combobox.Status>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));
    await flushMicrotasks();

    expect(screen.getByRole('status')).toBe(screen.getByTestId('status'));
    expect(screen.getByTestId('status').textContent).toBe('Searching…');

    vi.advanceTimersByTime(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);

    expect(screen.getByTestId('status').textContent).toBe('Searching…');
  });
});
