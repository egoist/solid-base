import { onCleanup } from 'solid-js';
import { Timeout } from './timeout';

type IntervalId = number;

const EMPTY = 0 as IntervalId;

export class Interval extends Timeout {
  static create() {
    return new Interval();
  }

  /**
   * Executes `fn` at `delay` interval, clearing any previously scheduled call.
   */
  start(delay: number, fn: Function) {
    this.clear();
    this.currentId = setInterval(() => {
      fn();
    }, delay) as unknown as number;
  }

  clear = () => {
    if (this.currentId !== EMPTY) {
      clearInterval(this.currentId as IntervalId);
      this.currentId = EMPTY;
    }
  };
}

/**
 * A `setInterval` wrapper that is cleared automatically when the owning scope is disposed.
 */
export function createInterval(): Interval {
  const interval = Interval.create();
  onCleanup(interval.clear);
  return interval;
}
