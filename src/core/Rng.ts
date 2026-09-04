// Seeded PRNG (mulberry32) with fork() for independent streams.
// GDD 5.1: every random source goes through Rng; same seed => same session.
// Streams used: 'world' (segments/game), 'human' (guest error), 'humanPredict' (overlay ghost).

/** 32-bit FNV-1a over a string. Used for seed derivation and log hashing. */
export function fnv1a(input: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32: small, fast, good enough for a game. Returns a () => [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private readonly nextFloat: () => number;
  /** Number of draws so far; useful for debugging determinism breaks. */
  draws = 0;

  constructor(readonly seed: number, readonly label = 'root') {
    this.nextFloat = mulberry32(seed);
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.draws++;
    return this.nextFloat();
  }

  /** Uniform in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Normal distribution via Box-Muller. Always consumes exactly two draws. */
  gaussian(mean = 0, sigma = 1): number {
    let u = this.next();
    const v = this.next();
    if (u <= 1e-12) u = 1e-12; // avoid log(0)
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + sigma * z;
  }

  pick<T>(items: readonly T[]): T {
    const item = items[Math.floor(this.next() * items.length)];
    if (item === undefined) throw new Error('Rng.pick on empty array');
    return item;
  }

  /** Independent stream derived from this seed and a label. Does not consume a draw. */
  fork(label: string): Rng {
    return new Rng(fnv1a(`${this.seed}:${label}`), `${this.label}/${label}`);
  }
}
