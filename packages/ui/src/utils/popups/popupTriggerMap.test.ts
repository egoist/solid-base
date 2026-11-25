import { describe, expect, it } from 'vitest';
import { PopupTriggerMap } from './popupTriggerMap';

describe('PopupTriggerMap', () => {
  it('adds and retrieves elements by id', () => {
    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    map.add('trigger', button);

    expect(map.getById('trigger')).toBe(button);
    expect(map.hasElement(button)).toBe(true);
    expect(map.hasMatchingElement((el) => el === button)).toBe(true);
    expect(map.size).toBe(1);
  });

  it('replaces an existing element when the id is reused', () => {
    const map = new PopupTriggerMap();
    const first = document.createElement('button');
    const second = document.createElement('button');

    map.add('trigger', first);
    map.add('trigger', second);

    expect(map.getById('trigger')).toBe(second);
    expect(map.hasElement(first)).toBe(false);
    expect(map.hasElement(second)).toBe(true);
    expect(map.size).toBe(1);
  });

  it('deletes elements by id', () => {
    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    map.add('trigger', button);
    map.delete('trigger');

    expect(map.getById('trigger')).toBeUndefined();
    expect(map.hasElement(button)).toBe(false);
    expect(map.hasMatchingElement((el) => el === button)).toBe(false);
    expect(map.size).toBe(0);
  });

  it('does not duplicate when the same element is added twice with the same id', () => {
    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    map.add('trigger', button);
    map.add('trigger', button);

    expect(map.getById('trigger')).toBe(button);
    expect(map.size).toBe(1);
  });

  // Tests run the development build (`isDev` is true), which has the check.
  it('throws in non-production when the same element is registered under multiple ids', () => {
    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    map.add('first', button);
    expect(() => map.add('second', button)).toThrow(
      'Base UI: A trigger element cannot be registered under multiple IDs in PopupTriggerMap.',
    );
  });

  it('allows re-registering an element under a new id after it was deleted', () => {
    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    map.add('first', button);
    map.delete('first');

    expect(() => map.add('second', button)).not.toThrow();
    expect(map.getById('second')).toBe(button);
    expect(map.size).toBe(1);
  });

  it('keeps an unrelated element claim when another id is deleted', () => {
    const map = new PopupTriggerMap();
    const first = document.createElement('button');
    const second = document.createElement('button');

    map.add('first', first);
    map.add('second', second);
    map.delete('second');

    expect(() => map.add('other', first)).toThrow(
      'Base UI: A trigger element cannot be registered under multiple IDs in PopupTriggerMap.',
    );
  });

  it('allows an element evicted by id reuse to register under a new id', () => {
    const map = new PopupTriggerMap();
    const first = document.createElement('button');
    const second = document.createElement('button');

    map.add('trigger', first);
    // `first` is no longer registered under `trigger`, so it may claim another id.
    map.add('trigger', second);

    expect(() => map.add('other', first)).not.toThrow();
    expect(map.getById('other')).toBe(first);
    expect(map.getById('trigger')).toBe(second);
    expect(map.size).toBe(2);
  });

  it('still throws when a re-added element is registered under a second id', () => {
    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    map.add('first', button);
    map.add('first', button);

    expect(() => map.add('second', button)).toThrow(
      'Base UI: A trigger element cannot be registered under multiple IDs in PopupTriggerMap.',
    );
  });

  // Skipped: the dev check is guarded by `isDev` from `@solidjs/web`, a build-time constant that
  // `process.env.NODE_ENV` can't switch off at runtime.
  it.skip(
    'does not throw in production when the same element is registered under multiple ids',
    () => {
      const map = new PopupTriggerMap();
      const button = document.createElement('button');

      map.add('first', button);
      expect(() => map.add('second', button)).not.toThrow();
      expect(map.getById('first')).toBe(button);
      expect(map.getById('second')).toBe(button);
      expect(map.hasElement(button)).toBe(true);
      expect(map.size).toBe(2);
    },
  );
});
