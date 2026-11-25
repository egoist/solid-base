import type { PopupEvents } from './types';

/**
 * A tiny synchronous event emitter. Each popup owns one (`store.context.events`) to let its
 * interactions talk to each other (`openchange`, `droppedclose`, hover/list navigation events…).
 */
export function createEventEmitter(): PopupEvents {
  const map = new Map<string, Set<(data: any) => void>>();
  return {
    emit(event: string, data?: any) {
      map.get(event)?.forEach((listener) => listener(data));
    },
    on(event: string, listener: (data: any) => void) {
      if (!map.has(event)) {
        map.set(event, new Set());
      }
      map.get(event)!.add(listener);
    },
    off(event: string, listener: (data: any) => void) {
      map.get(event)?.delete(listener);
    },
  };
}
