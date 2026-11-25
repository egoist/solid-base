import { createSignal, flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { useMediaQuery } from '.';

function createMatchMedia(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  const mediaQueryList = {
    matches: initialMatches,
    addEventListener: vi.fn((_type: string, listener: () => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_type: string, listener: () => void) => {
      listeners.delete(listener);
    }),
  };
  const matchMedia = vi.fn(() => mediaQueryList) as unknown as typeof window.matchMedia;

  return {
    matchMedia,
    listeners,
    setMatches(matches: boolean) {
      mediaQueryList.matches = matches;
      listeners.forEach((listener) => listener());
    },
  };
}

describe('useMediaQuery', () => {
  function Test(props: { query: string; options: useMediaQuery.Options }) {
    const matches = useMediaQuery(() => props.query, props.options);
    return <span data-testid="result">{String(matches())}</span>;
  }

  it('returns defaultMatches when matchMedia is unavailable', () => {
    render(() => <Test query="(min-width: 600px)" options={{ matchMedia: null }} />);

    expect(screen.getByTestId('result')).toHaveTextContent('false');

    render(() => (
      <Test query="(min-width: 600px)" options={{ matchMedia: null, defaultMatches: true }} />
    ));

    expect(screen.getAllByTestId('result')[1]).toHaveTextContent('true');
  });

  it('subscribes to the provided matchMedia and updates on change', () => {
    const media = createMatchMedia(false);

    const { unmount } = render(() => (
      <Test query="@media (min-width: 600px)" options={{ matchMedia: media.matchMedia }} />
    ));

    expect(media.matchMedia).toHaveBeenCalledWith('(min-width: 600px)');
    expect(screen.getByTestId('result')).toHaveTextContent('false');

    media.setMatches(true);
    flush();

    expect(screen.getByTestId('result')).toHaveTextContent('true');

    unmount();

    expect(media.listeners.size).toBe(0);
  });

  it('resubscribes when the query changes', () => {
    const lists = new Map<string, ReturnType<typeof createMatchMedia>>();
    const matchMedia = vi.fn((query: string) => {
      if (!lists.has(query)) {
        lists.set(query, createMatchMedia(query.includes('600')));
      }
      return lists.get(query)!.matchMedia(query);
    }) as unknown as typeof window.matchMedia;
    const [query, setQuery] = createSignal('(min-width: 600px)');

    render(() => <Test query={query()} options={{ matchMedia }} />);

    expect(screen.getByTestId('result')).toHaveTextContent('true');

    setQuery('(min-width: 900px)');
    flush();

    expect(screen.getByTestId('result')).toHaveTextContent('false');
    expect(lists.get('(min-width: 600px)')!.listeners.size).toBe(0);
    expect(lists.get('(min-width: 900px)')!.listeners.size).toBe(1);

    lists.get('(min-width: 900px)')!.setMatches(true);
    flush();

    expect(screen.getByTestId('result')).toHaveTextContent('true');
  });

  it('accepts a static query string', () => {
    const media = createMatchMedia(true);

    function StaticTest() {
      const matches = useMediaQuery('(prefers-reduced-motion: reduce)', {
        matchMedia: media.matchMedia,
      });
      return <span data-testid="result">{String(matches())}</span>;
    }

    render(() => <StaticTest />);

    expect(media.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(screen.getByTestId('result')).toHaveTextContent('true');
  });

  // Skipped: the `ssrMatchMedia`/`noSsr` server snapshot tests need a server renderer.
});
