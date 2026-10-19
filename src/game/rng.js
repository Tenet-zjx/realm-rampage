// Seeded xorshift128+ style generator (32-bit). Deterministic so tests can replay runs.
export function createRng(seed = 1) {
  let a = (seed >>> 0) || 0x9e3779b9, b = 0x243f6a88 ^ a, c = 0xb7e15162, d = 0x85a308d3 ^ (a << 7);
  const next = () => {
    const t = b << 9; let r = a * 5; r = ((r << 7) | (r >>> 25)) * 9;
    c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = (d << 11) | (d >>> 21);
    return (r >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  const rng = {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => Math.floor(lo + (hi - lo + 1) * next()),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    sign: () => (next() < 0.5 ? -1 : 1),
    angle: () => next() * Math.PI * 2,
    weighted(items, weightOf) {
      let total = 0; for (const it of items) total += Math.max(0, weightOf(it));
      if (total <= 0) return items[0];
      let r = next() * total;
      for (const it of items) { r -= Math.max(0, weightOf(it)); if (r <= 0) return it; }
      return items[items.length - 1];
    },
    shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
    fork: () => createRng(Math.floor(next() * 4294967296)),
  };
  return rng;
}
export const hashString = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
