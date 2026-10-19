// Uniform spatial hash for enemies/allies (rebuilt every step; arrays reused to avoid churn).
export function createGrid(cell = 3) {
  const map = new Map();
  const pool = [];
  const keyOf = (cx, cz) => (cx + 1024) * 4096 + (cz + 1024);
  return {
    cell,
    clear() { for (const arr of map.values()) { arr.length = 0; pool.push(arr); } map.clear(); },
    insert(e) {
      const k = keyOf(Math.floor(e.x / cell), Math.floor(e.z / cell));
      let arr = map.get(k); if (!arr) { arr = pool.pop() || []; map.set(k, arr); }
      arr.push(e);
    },
    /** Calls fn(e) for entities whose cell intersects the circle (x, z, r). */
    query(x, z, r, fn) {
      const x0 = Math.floor((x - r) / cell), x1 = Math.floor((x + r) / cell), z0 = Math.floor((z - r) / cell), z1 = Math.floor((z + r) / cell);
      for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
        const arr = map.get(keyOf(cx, cz)); if (!arr) continue;
        for (let i = 0; i < arr.length; i++) fn(arr[i]);
      }
    },
  };
}
