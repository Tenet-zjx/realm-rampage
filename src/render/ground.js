import * as THREE from 'three';

// Procedural, seamlessly tiling ground per biome: colour + height-derived normal map (stone relief) and,
// for burning / void biomes, an emissive map of glowing cracks. Cobbles are periodic Voronoi cells;
// marble biomes use offset tiles. Generated once per biome change (~768² px).
const S = 768;

const STYLE = {
  graveyard: { mode: 'cells', cells: 7, crack: 5, moss: '#4f6a3c', dirt: '#2e2620', relief: 2.4 },
  frostkeep: { mode: 'cells', cells: 6, crack: 4, snow: '#e6eef8', ice: '#9ad8ff', relief: 2.0 },
  inferno: { mode: 'cells', cells: 6, crack: 7, glow: '#ff6a1a', glowCore: '#ffd27a', relief: 2.8 },
  shadowcourt: { mode: 'tiles', tiles: 6, crack: 3, vein: '#6a4a8a', rune: '#a35cff', relief: 1.6 },
  abyss: { mode: 'cells', cells: 5, crack: 6, glow: '#ff3b8e', glowCore: '#ffc0e0', relief: 2.6 },
  skytemple: { mode: 'tiles', tiles: 5, crack: 3, vein: '#c8c0b0', inlay: '#e8c060', relief: 1.4 },
};

const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function rngOf(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function periodicNoise(rnd, period) {
  const h = new Float32Array(period * period); for (let i = 0; i < h.length; i++) h[i] = rnd();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const x0 = ((xi % period) + period) % period, y0 = ((yi % period) + period) % period, x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h[y0 * period + x0], b = h[y0 * period + x1], c = h[y1 * period + x0], d = h[y1 * period + x1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

export function groundMaps(biomeId, colors, seed = 1) {
  const st = STYLE[biomeId] || STYLE.graveyard;
  const rnd = rngOf(seed + biomeId.length * 131);
  const n4 = periodicNoise(rnd, 4), n12 = periodicNoise(rnd, 12), n48 = periodicNoise(rnd, 48);
  const c0 = hexRgb(colors[0]), c1 = hexRgb(colors[1]), c2 = hexRgb(colors[2]);
  const col = new Uint8ClampedArray(S * S * 4), hgt = new Float32Array(S * S);
  const glow = st.glow ? new Uint8ClampedArray(S * S * 4) : null;
  // cell / tile structure
  const G = st.mode === 'cells' ? st.cells * 2 : st.tiles, cs = S / G;
  const seeds = new Float32Array(G * G * 2), cellRand = new Float32Array(G * G);
  for (let i = 0; i < G * G; i++) { seeds[i * 2] = 0.15 + rnd() * 0.7; seeds[i * 2 + 1] = 0.15 + rnd() * 0.7; cellRand[i] = rnd(); }
  const gl = st.glow ? hexRgb(st.glow) : null, glc = st.glowCore ? hexRgb(st.glowCore) : null;
  const moss = st.moss && hexRgb(st.moss), dirt = st.dirt && hexRgb(st.dirt), snow = st.snow && hexRgb(st.snow), ice = st.ice && hexRgb(st.ice);
  const vein = st.vein && hexRgb(st.vein), rune = st.rune && hexRgb(st.rune), inlay = st.inlay && hexRgb(st.inlay);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let edge, id;
      if (st.mode === 'cells') {
        const gx = Math.floor(x / cs), gy = Math.floor(y / cs);
        let f1 = 1e9, f2 = 1e9, best = 0;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const cx = (gx + ox + G) % G, cy = (gy + oy + G) % G, k = cy * G + cx;
          const sx = (gx + ox + seeds[k * 2]) * cs, sy = (gy + oy + seeds[k * 2 + 1]) * cs;
          const dx = x - sx, dy = y - sy, d = dx * dx + dy * dy;
          if (d < f1) { f2 = f1; f1 = d; best = k; } else if (d < f2) f2 = d;
        }
        edge = (Math.sqrt(f2) - Math.sqrt(f1)) * 0.5; id = best;
      } else {
        const row = Math.floor(y / cs), off = row % 2 ? cs * 0.5 : 0, xx = (x + off) % S, col2 = Math.floor(xx / cs);
        const u = xx - col2 * cs, v = y - row * cs;
        edge = Math.min(u, cs - u, v, cs - v); id = (row % G) * G + (col2 % G);
      }
      const r = cellRand[id];
      const nx = x / S, ny = y / S;
      const big = n4(nx * 4, ny * 4), mid = n12(nx * 12, ny * 12), fine = n48(nx * 48, ny * 48);
      const mortar = 1 - smooth(0, st.crack, edge);
      // stone colour
      const t = r * 0.8 + mid * 0.2;
      let R = c1[0] + (c2[0] - c1[0]) * t, Gc = c1[1] + (c2[1] - c1[1]) * t, B = c1[2] + (c2[2] - c1[2]) * t;
      const shade = 0.78 + fine * 0.22 + big * 0.12 + smooth(st.crack, st.crack * 4, edge) * 0.1;
      R *= shade; Gc *= shade; B *= shade;
      // biome overlays
      if (moss && big > 0.55 && mid > 0.4) { const k = smooth(0.55, 0.75, big) * (0.4 + mortar * 0.6); R += (moss[0] - R) * k; Gc += (moss[1] - Gc) * k; B += (moss[2] - B) * k; }
      if (dirt && big < 0.32) { const k = smooth(0.32, 0.15, big) * 0.7; R += (dirt[0] - R) * k; Gc += (dirt[1] - Gc) * k; B += (dirt[2] - B) * k; }
      if (snow) { const k = smooth(0.42, 0.7, big * 0.7 + mid * 0.3) * (1 - mortar * 0.5); R += (snow[0] - R) * k; Gc += (snow[1] - Gc) * k; B += (snow[2] - B) * k; }
      if (ice && mortar > 0.5 && big > 0.5) { const k = 0.6; R += (ice[0] - R) * k; Gc += (ice[1] - Gc) * k; B += (ice[2] - B) * k; }
      if (vein) { const vv = Math.abs(Math.sin((x * 0.035 + y * 0.012 + mid * 9 + r * 20))); const k = smooth(0.06, 0, vv) * 0.55; R += (vein[0] - R) * k; Gc += (vein[1] - Gc) * k; B += (vein[2] - B) * k; }
      // mortar / cracks
      R += (c0[0] * 0.55 - R) * mortar; Gc += (c0[1] * 0.55 - Gc) * mortar; B += (c0[2] * 0.55 - B) * mortar;
      if (inlay && mortar > 0.35) { R = inlay[0] * (0.7 + fine * 0.3); Gc = inlay[1] * (0.7 + fine * 0.3); B = inlay[2] * (0.7 + fine * 0.3); }
      const i4 = (y * S + x) * 4;
      col[i4] = R; col[i4 + 1] = Gc; col[i4 + 2] = B; col[i4 + 3] = 255;
      // height: domed stones, sunken mortar, fine grain
      hgt[y * S + x] = smooth(0, st.crack * 3.5, edge) * 0.75 + r * 0.12 + fine * 0.1 + mid * 0.06;
      if (glow) {
        // glowing seams only in patches (large noise), thinner than the mortar, brightest at patch centres
        const crack = 1 - smooth(st.crack * 0.15, st.crack * 0.7, edge);
        const zone = smooth(0.48, 0.72, big * 0.75 + mid * 0.25);
        const pulse = crack * zone * (0.45 + mid * 0.55);
        const hot = smooth(0.6, 1, pulse);
        glow[i4] = (gl[0] + (glc[0] - gl[0]) * hot) * pulse; glow[i4 + 1] = (gl[1] + (glc[1] - gl[1]) * hot) * pulse; glow[i4 + 2] = (gl[2] + (glc[2] - gl[2]) * hot) * pulse; glow[i4 + 3] = 255;
        if (pulse > 0.15) { col[i4] *= 0.45; col[i4 + 1] *= 0.32; col[i4 + 2] *= 0.32; }
      }
      if (rune && mortar > 0.6 && r > 0.72) { glowRune(col, i4, rune); }
    }
  }
  // normal map from height (wrapping Sobel)
  const nrm = new Uint8ClampedArray(S * S * 4), k = st.relief;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const xm = (x - 1 + S) % S, xp = (x + 1) % S, ym = (y - 1 + S) % S, yp = (y + 1) % S;
    const dx = (hgt[y * S + xp] - hgt[y * S + xm]) * k, dy = (hgt[yp * S + x] - hgt[ym * S + x]) * k;
    const l = Math.hypot(dx, dy, 1), i4 = (y * S + x) * 4;
    nrm[i4] = (-dx / l * 0.5 + 0.5) * 255; nrm[i4 + 1] = (dy / l * 0.5 + 0.5) * 255; nrm[i4 + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[i4 + 3] = 255;
  }
  const tex = (data, srgb) => {
    const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true; return t;
  };
  return { map: tex(col, true), normalMap: tex(nrm, false), emissiveMap: glow ? tex(glow, true) : null, meters: 14, glowPulse: !!glow };
}

function glowRune(col, i4, rune) { col[i4] = col[i4] * 0.4 + rune[0] * 0.6; col[i4 + 1] = col[i4 + 1] * 0.4 + rune[1] * 0.6; col[i4 + 2] = col[i4 + 2] * 0.4 + rune[2] * 0.6; }
