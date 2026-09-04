// Typed event bus over the GameEvent union. GDD 5.3.
// Handlers run synchronously in subscription order so the SessionLog stays ordered.
import type { GameEvent, GameEventOf, GameEventType } from '../session/events';

type Handler<K extends GameEventType> = (event: GameEventOf<K>) => void;
type AnyHandler = (event: GameEvent) => void;

export class EventBus {
  private handlers = new Map<GameEventType, Set<AnyHandler>>();
  private anyHandlers = new Set<AnyHandler>();

  on<K extends GameEventType>(type: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as AnyHandler);
    return () => set?.delete(handler as AnyHandler);
  }

  /** Receives every event; used by SessionLog and the psychology engine. */
  onAny(handler: AnyHandler): () => void {
    this.anyHandlers.add(handler);
    return () => this.anyHandlers.delete(handler);
  }

  emit(event: GameEvent): void {
    for (const h of this.anyHandlers) h(event);
    const set = this.handlers.get(event.type);
    if (set) for (const h of set) h(event);
  }
}
