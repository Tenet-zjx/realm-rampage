export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az; return dx * dx + dz * dz; };
export const dist = (ax, az, bx, bz) => Math.sqrt(dist2(ax, az, bx, bz));
export const angleOf = (x, z) => Math.atan2(x, z); // 0 = +Z (model forward)
export const dirX = (a) => Math.sin(a);
export const dirZ = (a) => Math.cos(a);
export const wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
export const turnTowards = (a, target, maxStep) => { const d = wrapAngle(target - a); return a + clamp(d, -maxStep, maxStep); };
export const DEG = Math.PI / 180;

/** Shape test in the XZ plane. Origin (ox, oz), facing angle `face`, point (px, pz) with radius pr. */
export function inShape(shape, ox, oz, face, px, pz, pr = 0) {
  const dx = px - ox, dz = pz - oz;
  switch (shape.shape) {
    case 'circle': { const r = shape.r + pr; return dx * dx + dz * dz <= r * r; }
    case 'ring': { const d = Math.hypot(dx, dz); return d <= shape.r + pr && d >= (shape.inner ?? shape.r - (shape.width ?? 1.5)) - pr; }
    case 'arc': {
      const d = Math.hypot(dx, dz); if (d > shape.range + pr) return false; if (d < 0.9 + pr) return true;
      const a = Math.abs(wrapAngle(Math.atan2(dx, dz) - face)); return a <= (shape.angle * DEG) / 2 + Math.atan2(pr, d);
    }
    case 'line': {
      const fx = Math.sin(face), fz = Math.cos(face);
      const along = dx * fx + dz * fz; const side = Math.abs(dx * fz - dz * fx);
      const back = shape.back ? -shape.length : -0.6;
      return along >= back - pr && along <= shape.length + pr && side <= shape.width / 2 + pr;
    }
    default: return false;
  }
}
/** Broad-phase radius of a shape around its origin. */
export function shapeReach(shape) {
  switch (shape.shape) {
    case 'circle': case 'ring': return shape.r;
    case 'arc': return shape.range;
    case 'line': return shape.length + shape.width;
    default: return 4;
  }
}
