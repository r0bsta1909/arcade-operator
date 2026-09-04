// Minimal observable store for dashboard state. GDD 5.1: "a 40-line store, not React".
// Renderers/dashboard subscribe; the simulation writes. No dependencies.

export type Unsubscribe = () => void;

export class Store<T> {
  private listeners = new Set<(value: T) => void>();

  constructor(private value: T) {}

  get(): T {
    return this.value;
  }

  set(next: T): void {
    if (Object.is(next, this.value)) return;
    this.value = next;
    for (const l of this.listeners) l(next);
  }

  update(fn: (current: T) => T): void {
    this.set(fn(this.value));
  }

  subscribe(listener: (value: T) => void, emitNow = true): Unsubscribe {
    this.listeners.add(listener);
    if (emitNow) listener(this.value);
    return () => this.listeners.delete(listener);
  }
}
