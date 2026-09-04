// Append-only, frame-numbered, serializable log with hash(). GDD 5.3.
// The log is the ground truth for replays, debrief curves, balancing and
// feedback issues. Same seed + same operator inputs => identical hash().
import { fnv1a } from '../core/Rng';
import type { GameEvent } from './events';

export const LOG_VERSION = 1;

export interface SessionLogHeader {
  version: number;
  seed: number;
  profileId: string;
  buildHash: string;
  configHash: string;
}

export interface LogEntry {
  /** Simulation frame at which the event occurred. */
  f: number;
  e: GameEvent;
}

export interface SessionLogJson {
  header: SessionLogHeader;
  entries: LogEntry[];
}

export class SessionLog {
  private readonly entries: LogEntry[] = [];

  constructor(readonly header: SessionLogHeader) {}

  append(frame: number, event: GameEvent): void {
    this.entries.push({ f: frame, e: event });
  }

  get length(): number {
    return this.entries.length;
  }

  all(): readonly LogEntry[] {
    return this.entries;
  }

  filter<K extends GameEvent['type']>(type: K): Array<LogEntry & { e: Extract<GameEvent, { type: K }> }> {
    return this.entries.filter((x): x is LogEntry & { e: Extract<GameEvent, { type: K }> } => x.e.type === type);
  }

  toJSON(): SessionLogJson {
    return { header: { ...this.header }, entries: this.entries.slice() };
  }

  static fromJSON(json: SessionLogJson): SessionLog {
    const log = new SessionLog({ ...json.header });
    for (const entry of json.entries) log.append(entry.f, entry.e);
    return log;
  }

  /** FNV-1a over canonical JSON. Synchronous, identical in Bun, Node and browsers. */
  hash(): string {
    return fnv1a(canonicalJson(this.toJSON())).toString(16).padStart(8, '0');
  }
}

/** JSON with object keys sorted recursively so the hash does not depend on insertion order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}
