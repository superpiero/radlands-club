// Small deterministic RNG (sfc32) whose state lives inside GameState,
// so games can be replayed / cloned exactly.

export function seedState(seed: number): number[] {
  // splitmix32 to expand the seed into 4 words
  let s = seed >>> 0;
  const out: number[] = [] as number[];
  for (let i = 0; i < 4; i++) {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    z = (z ^ (z >>> 16)) >>> 0;
    out.push(z);
  }
  if (out.reduce((a, b) => a | b, 0) === 0) out[0] = 1;
  return out;
}

/** Returns float in [0,1) and advances the state array in place. */
export function nextRandom(st: number[]): number {
  let [a, b, c, d] = st;
  a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
  const t = (((a + b) >>> 0) + d) >>> 0;
  d = (d + 1) >>> 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) >>> 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) >>> 0;
  st[0] = a >>> 0; st[1] = b >>> 0; st[2] = c >>> 0; st[3] = d >>> 0;
  return t / 4294967296;
}

export function randInt(st: number[], n: number): number {
  return Math.floor(nextRandom(st) * n);
}

export function shuffleInPlace<T>(st: number[], arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(st, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
