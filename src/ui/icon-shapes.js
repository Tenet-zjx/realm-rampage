// Hand-authored vector emblems for skill / item icons. Every shape is drawn in a 64×64 box centred on (32, 32).
// A shape receives a colour set { fill, line, light, dark, accent, white } and returns SVG markup.
const L = (f, w = 2.2) => `stroke="${f.line}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const P = (d, fill, f, w) => `<path d="${d}" fill="${fill}" ${f ? L(f, w) : ''}/>`;
const S = (d, color, w, o = 1) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${o}"/>`;
const C = (cx, cy, r, fill, f, w) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${f ? L(f, w) : ''}/>`;
const E = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const rot = (deg, inner) => `<g transform="rotate(${deg} 32 32)">${inner}</g>`;
const tr = (x, y, s, r, inner) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s}) translate(-32 -32)">${inner}</g>`;
const star = (n, R, r, cx = 32, cy = 32, phase = -90) => {
  let d = '';
  for (let i = 0; i < n * 2; i++) { const a = ((phase + (i * 180) / n) * Math.PI) / 180, rr = i % 2 ? r : R; d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`; }
  return d + 'Z';
};
const spiralD = (turns = 2.6, r0 = 3, r1 = 25) => {
  let d = ''; const N = 70;
  for (let i = 0; i <= N; i++) { const t = i / N, a = t * turns * Math.PI * 2, r = r0 + (r1 - r0) * t; d += `${i ? 'L' : 'M'}${(32 + Math.cos(a) * r).toFixed(1)} ${(32 + Math.sin(a) * r).toFixed(1)}`; }
  return d;
};

const SWORD = (f) => P('M32 3L37.5 11V40H26.5V11Z', f.fill, f) + S('M32 9V37', f.light, 1.6, 0.8) + P('M16 40H48L45.5 46H18.5Z', f.accent, f) + P('M29 46H35V56H29Z', f.dark, f) + C(32, 59.5, 3.4, f.accent, f, 1.6);
const FLAME = (f) => P('M32 4C35 15 44 20 47 30C51 43 45 56 32 58C19 56 13 43 17 31C19 25 24 22 25 15C29 20 30 25 31 27C34 21 34 13 32 4Z', f.fill, f)
  + P('M32 25C35 32 41 36 40 45C39 51 36 55 32 55C27 55 23 51 24 44C25 38 30 36 32 25Z', f.light) + P('M32 39C34 43 36 46 35 50C34 52 33 53 32 53C30 53 28 51 29 48C30 45 32 43 32 39Z', f.white, null);
const DROP = (f) => P('M32 5C39 19 49 28 49 40A17 17 0 0 1 15 40C15 28 25 19 32 5Z', f.fill, f) + E(25, 40, 3.5, 6, f.light, 'opacity="0.7" transform="rotate(20 25 40)"');
const BOLT = (f) => P('M38 3L14 36H29L22 61L50 24H35L44 3Z', f.fill, f) + S('M37 8L22 32H32', f.white, 1.6, 0.7);
const SKULL = (f) => P('M32 7C45 7 54 16 54 28C54 36 50 41 45 43V51C45 53 43 55 41 55H23C21 55 19 53 19 51V43C14 41 10 36 10 28C10 16 19 7 32 7Z', f.fill, f)
  + E(25, 28, 5.5, 6.5, f.dark) + E(39, 28, 5.5, 6.5, f.dark) + C(25, 29, 1.8, f.accent) + C(39, 29, 1.8, f.accent) + P('M32 35L28.5 42H35.5Z', f.dark) + S('M25 47V53M30 47V54M34 47V54M39 47V53', f.dark, 1.8);
const HEART = (f) => P('M32 55C14 41 7 31 7 21C7 13 13 7 21 7C26 7 30 10 32 14C34 10 38 7 43 7C51 7 57 13 57 21C57 31 50 41 32 55Z', f.fill, f) + S('M16 14C12 17 11 22 13 26', f.white, 2.4, 0.7);
const SHIELD = (f) => P('M32 5L53 12C53 35 46 49 32 59C18 49 11 35 11 12Z', f.fill, f) + P('M32 11L47 16C47 33 42 44 32 52C22 44 17 33 17 16Z', 'none', { line: f.light }, 1.6);
const CRESCENT = (f) => P('M42 6A27 27 0 1 0 42 58A21 21 0 1 1 42 6Z', f.fill, f);
const WING = (f) => P('M6 44C12 24 30 10 58 8C50 15 48 19 42 23C50 23 54 26 56 29C47 33 41 34 35 34C41 37 45 41 45 46C35 46 24 47 6 44Z', f.fill, f) + S('M14 40C26 32 38 22 52 12M22 42C32 38 40 34 50 30M28 44C34 42 38 40 42 40', f.light, 1.4, 0.7);
const LEAF = (f) => P('M10 54C10 28 27 10 55 9C55 37 37 54 10 54Z', f.fill, f) + S('M12 52C24 40 36 28 52 12M24 40L22 30M32 32L34 22M30 36L40 38M20 44L30 46', f.dark, 1.5, 0.8);
const ORB = (f) => C(32, 32, 21, f.fill, f) + C(32, 32, 13, f.light, null) + C(32, 32, 7, f.white, null) + E(24, 22, 6, 4, f.white, 'opacity="0.55" transform="rotate(-35 24 22)"');
const GEM = (f) => P('M18 8H46L58 24L32 58L6 24Z', f.fill, f) + S('M6 24H58M18 8L26 24L32 58M46 8L38 24L32 58M26 24L32 8L38 24', f.light, 1.3, 0.8) + P('M18 8L26 24H6Z', f.white, null).replace('/>', ' opacity="0.35"/>');
const POTION = (f) => P('M26 4H38V8H36V19C46 22 52 30 52 40C52 51 43 59 32 59C21 59 12 51 12 40C12 30 18 22 28 19V8H26Z', '#dfe8f0', f)
  + P('M14.5 40C20 36 26 44 32 40C38 36 44 44 49.5 40C49.5 50 42 56.5 32 56.5C22 56.5 14.5 50 14.5 40Z', f.fill) + C(26, 46, 2, f.white) + C(36, 50, 1.4, f.white) + E(22, 30, 3, 6, f.white, 'opacity="0.6" transform="rotate(30 22 30)"') + P('M26 4H38V8H26Z', '#8a5a2a', f, 1.4);
const CROWN = (f) => P('M7 46L11 15L22 29L32 9L42 29L53 15L57 46Z', f.fill, f) + P('M8 46H56V55H8Z', f.dark, f) + C(32, 50.5, 3, f.accent) + C(20, 50.5, 2.2, f.accent) + C(44, 50.5, 2.2, f.accent) + C(32, 9, 2.5, f.white) + C(11, 15, 2, f.white) + C(53, 15, 2, f.white);
const HOURGLASS = (f) => P('M15 5H49V10H15ZM15 54H49V59H15Z', f.dark, f) + P('M18 10H46C46 22 36 28 36 32C36 36 46 42 46 54H18C18 42 28 36 28 32C28 28 18 22 18 10Z', 'rgba(220,240,255,0.35)', f, 1.6)
  + P('M22 14H42C40 20 34 24 32 28C30 24 24 20 22 14Z', f.fill) + P('M21 52H43C41 46 34 43 32 40C30 43 23 46 21 52Z', f.fill) + S('M32 30V40', f.fill, 1.4);
const BOOK = (f) => P('M6 14C16 10 26 12 32 18C38 12 48 10 58 14V52C48 48 38 50 32 56C26 50 16 48 6 52Z', f.fill, f) + S('M32 18V55', f.line, 2) + S('M12 20C18 18 24 19 28 22M12 28C18 26 24 27 28 30M36 22C40 19 46 18 52 20M36 30C40 27 46 26 52 28', f.light, 1.5, 0.8) + C(42, 40, 4, f.accent);
const SCROLL = (f) => P('M16 10H46V50H16Z', '#f2e2c0', f) + E(16, 10, 5, 4, f.fill, `stroke="${f.line}" stroke-width="2"`) + E(46, 50, 5, 4, f.fill, `stroke="${f.line}" stroke-width="2"`) + S('M22 20H40M22 27H40M22 34H36', '#8a6a40', 1.6) + C(36, 42, 4, f.accent);
const BOOT = (f) => P('M18 4H36V33L52 41C56 43 57 49 54 54L52 56H16C14 56 14 54 14 52Z', f.fill, f) + P('M16 8H38V14H16Z', f.dark, f, 1.5) + S('M16 47H54', f.dark, 1.6);
const ARROW = (f) => S('M12 52L48 16', f.line, 5.5) + S('M12 52L48 16', '#c8a070', 3) + P('M54 10L38 15L49 26Z', f.fill, f) + P('M10 46L16 52L12 58L6 52Z', f.accent, f, 1.4) + P('M16 42L22 48L18 54L12 48Z', f.accent, f, 1.4);
const AXE = (f) => P('M30.5 6H34.5V60H30.5Z', '#8a5a2a', f, 1.6) + P('M34 9C47 6 57 15 56 31C49 26 41 25 34 28Z', f.fill, f) + S('M38 12C46 12 52 18 53 26', f.white, 1.4, 0.6) + P('M30.5 12L22 15L30.5 19Z', f.dark, f, 1.4);
const HAMMER = (f) => P('M30 26H34V60H30Z', '#8a5a2a', f, 1.6) + P('M15 7H49L53 11V23L49 27H15L11 23V11Z', f.fill, f) + S('M22 7V27M42 7V27', f.dark, 2) + S('M16 11H48', f.white, 1.4, 0.5);
const EYE = (f) => P('M4 32C14 16 50 16 60 32C50 48 14 48 4 32Z', '#f4efe6', f) + C(32, 32, 11, f.fill, null) + E(32, 32, 3, 9, f.dark) + C(28, 28, 2.5, f.white);
const CLOUD = (f) => P('M14 44A10 10 0 0 1 16 25A15 15 0 0 1 44 20A12 12 0 0 1 52 44Z', f.fill, f) + S('M18 30A11 11 0 0 1 40 24', f.light, 1.6, 0.7);
const ROCK = (f) => P('M14 47L9 30L20 15L39 11L53 21L57 40L45 54L24 57Z', f.fill, f) + S('M20 15L28 30L9 30M28 30L45 32L53 21M45 32L45 54M28 30L24 57', f.dark, 1.4, 0.7) + P('M20 15L39 11L28 30Z', f.light, null).replace('/>', ' opacity="0.45"/>');
const MOUNTAIN = (f) => P('M3 56L21 22L29 32L41 11L61 56Z', f.fill, f) + P('M41 11L48 26L44 24L40 28L36 22Z', f.white, null) + P('M21 22L25 30L21 29L18 31Z', f.white, null);
const CRYSTAL = (f) => P('M32 3L45 16V45L32 61L19 45V16Z', f.fill, f) + S('M32 3V61M19 16L32 23L45 16M19 45L32 38L45 45', f.light, 1.3, 0.75) + P('M32 3L19 16L32 23Z', f.white, null).replace('/>', ' opacity="0.5"/>');
const CRYSTALS = (f) => tr(20, 36, 0.62, -22, CRYSTAL(f)) + tr(44, 36, 0.62, 22, CRYSTAL(f)) + tr(32, 30, 0.82, 0, CRYSTAL(f));
const SHARD = (f) => P('M32 32L27 4L37 4Z', f.fill, f, 1.6);
const SHARDS = (f) => [-50, -25, 0, 25, 50].map((r) => rot(r, P('M32 34L28 6L36 6Z', f.fill, f, 1.6) + S('M32 30L31 9', f.white, 1, 0.6))).join('');
const SNOWFLAKE = (f) => [0, 60, 120, 180, 240, 300].map((r) => rot(r, S('M32 32V7M32 15L25 9M32 15L39 9M32 23L26 18M32 23L38 18', f.line, 6) + S('M32 32V7M32 15L25 9M32 15L39 9M32 23L26 18M32 23L38 18', f.light, 3))).join('') + P(star(6, 7, 7, 32, 32, 0), f.fill, f, 1.5);
const SUN = (f) => [0, 45, 90, 135, 180, 225, 270, 315].map((r) => rot(r, P('M32 2L36 14H28Z', f.accent, f, 1.4))).join('') + C(32, 32, 14, f.fill, f) + C(28, 28, 5, f.white, null).replace('/>', ' opacity="0.5"/>');
const STAR = (f) => P(star(5, 27, 11.5), f.fill, f) + P(star(5, 15, 6.5), f.light);
const SPARK = (f) => P('M32 3L37 27L61 32L37 37L32 61L27 37L3 32L27 27Z', f.fill, f) + P('M32 14L34.5 29.5L50 32L34.5 34.5L32 50L29.5 34.5L14 32L29.5 29.5Z', f.white, null);
const SPIRAL = (f) => S(spiralD(), f.line, 8) + S(spiralD(), f.fill, 5) + S(spiralD(2.6, 3, 25), f.light, 1.6, 0.7) + C(32, 32, 5, f.dark, f, 1.5);
const RINGS = (f) => [24, 17, 10].map((r, i) => `<circle cx="32" cy="32" r="${r}" fill="none" stroke="${f.line}" stroke-width="6"/><circle cx="32" cy="32" r="${r}" fill="none" stroke="${i % 2 ? f.light : f.fill}" stroke-width="3.5"/>`).join('') + C(32, 32, 4, f.white);
const WAVE = (f) => [0, 1, 2].map((i) => { const d = `M${8 + i * 2} ${50 - i * 12}C${20} ${34 - i * 12} ${44} ${34 - i * 12} ${56 - i * 2} ${50 - i * 12}`; return S(d, f.line, 7) + S(d, i ? f.light : f.fill, 4); }).join('');
const RUNE = (f) => `<circle cx="32" cy="32" r="25" fill="none" stroke="${f.line}" stroke-width="5"/><circle cx="32" cy="32" r="25" fill="none" stroke="${f.fill}" stroke-width="2.5"/><circle cx="32" cy="32" r="17" fill="none" stroke="${f.light}" stroke-width="1.5"/>`
  + S(star(6, 17, 17, 32, 32, -90).replace(/L/g, ' L'), f.light, 1.4) + S('M32 15L46.7 40.5L17.3 40.5Z', f.fill, 2) + S('M32 49L17.3 23.5L46.7 23.5Z', f.fill, 2) + C(32, 32, 3.5, f.white) + [0, 60, 120, 180, 240, 300].map((r) => rot(r, C(32, 7, 2.4, f.accent))).join('');
const PORTAL = (f) => E(32, 32, 17, 27, f.dark, `stroke="${f.line}" stroke-width="2"`) + E(32, 32, 13, 22, f.fill) + `<path d="${spiralD(1.8, 2, 13)}" fill="none" stroke="${f.white}" stroke-width="2" transform="translate(0 0) scale(1 1.6) translate(0 -12)"/>`;
const CHAIN = (f) => [0, 1, 2].map((i) => `<ellipse cx="${18 + i * 14}" cy="${46 - i * 14}" rx="10" ry="6" transform="rotate(-45 ${18 + i * 14} ${46 - i * 14})" fill="none" stroke="${f.line}" stroke-width="7"/><ellipse cx="${18 + i * 14}" cy="${46 - i * 14}" rx="10" ry="6" transform="rotate(-45 ${18 + i * 14} ${46 - i * 14})" fill="none" stroke="${f.fill}" stroke-width="4"/>`).join('');
const TARGET = (f) => C(32, 32, 25, f.fill, f) + C(32, 32, 17, f.white, null) + C(32, 32, 10, f.fill, null) + C(32, 32, 4, f.white, null) + S('M32 2V18M32 46V62M2 32H18M46 32H62', f.line, 3);
const SCYTHE = (f) => S('M44 6L18 60', f.line, 6) + S('M44 6L18 60', '#8a5a2a', 3.5) + P('M44 7C30 3 14 10 6 25C17 18 30 17 43 22Z', f.fill, f) + S('M40 10C30 9 20 13 13 19', f.white, 1.3, 0.6);
const FANG = (f) => P('M14 8H50C49 22 42 32 38 52C35 42 33 32 32 22C31 32 29 42 26 52C22 32 15 22 14 8Z', '#f8f2e6', f) + P('M14 8H50V14H14Z', f.fill, f, 1.6) + P('M38 52C37 46 36 42 35 38L40 40Z', f.accent);
const CLAW = (f) => [0, 1, 2].map((i) => { const d = `M${14 + i * 12} 8C${22 + i * 12} 24 ${20 + i * 12} 42 ${10 + i * 12} 58`; return S(d, f.line, 7) + S(d, f.fill, 4) + S(d, f.white, 1.2, 0.6); }).join('');
const HOOK = (f) => S('M40 4V32C40 46 30 54 20 50C14 47 12 40 16 34', f.line, 8) + S('M40 4V32C40 46 30 54 20 50C14 47 12 40 16 34', f.fill, 5) + P('M12 30L20 34L14 40Z', f.fill, f, 1.4) + C(40, 6, 4, f.dark, f, 1.6);
const FLAG = (f) => P('M14 6H18V60H14Z', '#8a6a3a', f, 1.4) + P('M18 8C28 4 36 14 52 8V34C36 40 28 30 18 34Z', f.fill, f) + C(32, 21, 5, f.accent);
const DICE = (f) => P('M10 18L32 6L54 18V44L32 58L10 44Z', '#f4efe6', f) + S('M10 18L32 30L54 18M32 30V58', '#b8b0a0', 1.4) + C(32, 18, 3, f.fill) + C(21, 34, 3, f.fill) + C(21, 44, 3, f.fill) + C(43, 34, 3, f.fill) + C(43, 44, 3, f.fill) + C(32, 39, 2.5, f.fill);
const ANKH = (f) => P('M28 27C20 24 18 14 24 8C28 4 36 4 40 8C46 14 44 24 36 27V30H48V36H36V58H28V36H16V30H28ZM32 11C28 11 26 14 26 18C26 22 29 24 32 24C35 24 38 22 38 18C38 14 36 11 32 11Z', f.fill, f);
const CHEST = (f) => P('M8 28H56V55H8Z', '#8a5a2a', f) + P('M8 28C8 18 16 12 32 12C48 12 56 18 56 28Z', '#a06a32', f) + P('M6 26H58V32H6Z', f.fill, f, 1.6) + P('M27 30H37V42H27Z', f.fill, f, 1.6) + C(32, 36, 2, f.dark) + S('M8 44H56', f.fill, 2.5);
const FEATHER = (f) => P('M50 6C30 10 16 26 12 50L15 58L18 51C38 46 52 30 50 6Z', f.fill, f) + S('M50 6C40 20 28 36 15 56', f.white, 1.6, 0.85) + S('M42 14L48 22M36 22L44 30M30 30L38 38M24 38L32 44', f.dark, 1, 0.6);
const BELL = (f) => P('M32 6C42 6 46 14 46 26V40L52 48H12L18 40V26C18 14 22 6 32 6Z', f.fill, f) + C(32, 53, 4.5, f.dark, f, 1.6) + S('M24 16C22 22 22 30 22 36', f.white, 1.6, 0.6) + C(32, 6, 3, f.dark, f, 1.4);
const HORN = (f) => P('M6 52C22 50 38 40 46 18L56 10L55 22C51 42 32 58 8 58Z', f.fill, f) + S('M14 54C28 52 42 42 50 22', f.light, 1.6, 0.7) + S('M20 51L22 57M30 48L33 54M38 42L42 47', f.dark, 1.5);
const HALO = (f) => E(32, 22, 22, 9, 'none', `stroke="${f.line}" stroke-width="7"`) + E(32, 22, 22, 9, 'none', `stroke="${f.fill}" stroke-width="4"`) + E(32, 22, 22, 9, 'none', `stroke="${f.white}" stroke-width="1.2" opacity="0.8"`) + P(star(4, 10, 3, 32, 44), f.light, f, 1.2);
const THORNS = (f) => `<circle cx="32" cy="32" r="18" fill="none" stroke="${f.line}" stroke-width="8"/><circle cx="32" cy="32" r="18" fill="none" stroke="${f.fill}" stroke-width="5"/>` + [0, 40, 80, 120, 160, 200, 240, 280, 320].map((r) => rot(r, P('M29 14L32 2L35 14Z', '#e8d8b0', f, 1.2))).join('');
const VINES = (f) => S('M8 58C14 40 30 44 26 28C22 14 36 6 48 8', f.line, 7) + S('M8 58C14 40 30 44 26 28C22 14 36 6 48 8', f.fill, 4) + S('M30 58C36 46 50 48 52 34', f.line, 6) + S('M30 58C36 46 50 48 52 34', f.fill, 3.5) + tr(18, 40, 0.3, -30, LEAF(f)) + tr(34, 14, 0.3, 40, LEAF(f)) + tr(50, 40, 0.28, 10, LEAF(f));
const TENTACLE = (f) => P('M14 60C10 44 20 36 28 30C36 24 38 16 30 10C40 12 46 22 40 32C34 42 26 46 28 60Z', f.fill, f) + [0, 1, 2, 3].map((i) => C(26 + (i % 2) * 6, 52 - i * 9, 2.2, f.light)).join('');
const FOOT = (f) => E(32, 40, 12, 17, f.fill, `stroke="${f.line}" stroke-width="2"`) + C(22, 16, 4.5, f.fill, f, 1.6) + C(30, 12, 4.8, f.fill, f, 1.6) + C(39, 13, 4.5, f.fill, f, 1.6) + C(46, 19, 4, f.fill, f, 1.6);
const TORNADO = (f) => [[32, 10, 24, 6], [33, 20, 19, 5], [31, 29, 14, 4.5], [33, 37, 10, 4], [31, 45, 7, 3.5], [32, 53, 4, 3]].map(([x, y, rx, ry]) => E(x, y, rx, ry, 'none', `stroke="${f.line}" stroke-width="5"`) + E(x, y, rx, ry, 'none', `stroke="${f.fill}" stroke-width="2.8"`)).join('');
const GHOST = (f) => P('M15 57V28C15 16 23 7 32 7C41 7 49 16 49 28V57L43 51L37 57L32 51L27 57L21 51Z', f.fill, f) + E(26, 28, 4, 5.5, f.dark) + E(38, 28, 4, 5.5, f.dark) + E(32, 40, 4, 5, f.dark) + C(26, 27, 1.5, f.accent) + C(38, 27, 1.5, f.accent);
const BAT = (f) => P('M32 22C28 18 24 20 22 24C18 18 10 18 4 24C10 26 14 30 14 37C20 32 26 34 32 41C38 34 44 32 50 37C50 30 54 26 60 24C54 18 46 18 42 24C40 20 36 18 32 22Z', f.fill, f) + P('M28 20L30 13L32 19L34 13L36 20Z', f.fill, f, 1.4) + C(29.5, 25, 1.4, f.accent) + C(34.5, 25, 1.4, f.accent);
const BEE = (f) => E(22, 22, 9, 6, 'rgba(230,245,255,0.8)', `stroke="${f.line}" stroke-width="1.6" transform="rotate(-30 22 22)"`) + E(42, 22, 9, 6, 'rgba(230,245,255,0.8)', `stroke="${f.line}" stroke-width="1.6" transform="rotate(30 42 22)"`)
  + E(32, 38, 12, 16, f.fill, `stroke="${f.line}" stroke-width="2"`) + S('M21 34H43M20 41H44M23 48H41', f.dark, 4) + P('M30 54L32 61L34 54Z', f.dark) + C(32, 20, 6, f.dark, f, 1.6);
const SPIDER = (f) => [-1, 1].map((s) => [0, 1, 2, 3].map((i) => S(`M32 34L${32 + s * (14 + i * 2)} ${22 + i * 8}L${32 + s * (24 + i * 2)} ${30 + i * 9}`, f.line, 4.5) + S(`M32 34L${32 + s * (14 + i * 2)} ${22 + i * 8}L${32 + s * (24 + i * 2)} ${30 + i * 9}`, f.dark, 2.4)).join('')).join('')
  + E(32, 42, 11, 13, f.fill, `stroke="${f.line}" stroke-width="2"`) + C(32, 24, 7, f.fill, f) + P('M32 34L28 42L32 50L36 42Z', f.accent) + C(29, 22, 1.6, f.white) + C(35, 22, 1.6, f.white);
const BURST = (f) => P(star(12, 29, 14), f.fill, f) + P(star(12, 17, 8), f.light) + C(32, 32, 6, f.white);
const CROSS = (f) => P('M27 4H37L38 22L56 23V33L38 34L37 60H27L26 34L8 33V23L26 22Z', f.fill, f) + S('M32 10V54M14 28H50', f.white, 1.4, 0.6);
const PLUS = (f) => P('M25 8H39V25H56V39H39V56H25V39H8V25H25Z', f.fill, f) + S('M28 12V26', f.white, 1.6, 0.6);
const UPARROW = (f) => P('M32 4L56 30H42V58H22V30H8Z', f.fill, f) + S('M32 10L48 27', f.white, 1.6, 0.6);
const INFINITY = (f) => { const d = 'M32 32C24 20 8 20 8 32C8 44 24 44 32 32C40 20 56 20 56 32C56 44 40 44 32 32Z'; return S(d, f.line, 9) + S(d, f.fill, 5.5) + S(d, f.white, 1.2, 0.6); };
const CLOCK = (f) => C(32, 34, 24, '#f2ead8', f) + C(32, 34, 20, 'none', { line: f.fill }, 2.5) + S('M32 34V18M32 34L43 41', f.line, 3) + C(32, 34, 2.5, f.fill) + P('M26 4H38V10H26Z', f.fill, f, 1.4);
const REFRESH = (f) => S('M50 26A19 19 0 0 0 14 24', f.line, 9) + S('M50 26A19 19 0 0 0 14 24', f.fill, 5.5) + P('M8 18L18 30L22 14Z', f.fill, f, 1.4) + S('M14 38A19 19 0 0 0 50 40', f.line, 9) + S('M14 38A19 19 0 0 0 50 40', f.light, 5.5) + P('M56 46L46 34L42 50Z', f.light, f, 1.4);
const FIST = (f) => P('M17 28C17 22 21 19 25 19H44C48 19 51 22 51 26V41C51 51 44 57 34 57H28C21 57 17 52 17 46Z', f.fill, f) + S('M28 19V31M37 19V31M45 20V31M17 33H30', f.dark, 1.8) + P('M17 33C13 33 11 37 13 41L23 45L28 38Z', f.fill, f, 1.6);
const MAGNET = (f) => S('M16 10V32A16 16 0 0 0 48 32V10', f.line, 15) + S('M16 10V32A16 16 0 0 0 48 32V10', f.fill, 11) + P('M10.5 6H21.5V16H10.5ZM42.5 6H53.5V16H42.5Z', '#e8ecf4', f, 1.6) + S('M20 34A12 12 0 0 0 30 44', f.white, 1.6, 0.6);
const COIN = (f) => C(32, 32, 24, f.fill, f) + C(32, 32, 19, 'none', { line: f.dark }, 1.6) + P('M26 26H38V38H26Z', f.dark, f, 1.4) + S('M20 18C24 14 28 13 32 13', f.white, 2, 0.7);
const COINS = (f) => tr(22, 40, 0.6, 0, COIN(f)) + tr(42, 40, 0.6, 0, COIN(f)) + tr(32, 24, 0.7, 0, COIN(f));
const CLOVER = (f) => [0, 90, 180, 270].map((r) => rot(r + 45, P('M32 32C26 26 20 20 24 14C28 9 32 12 32 16C32 12 36 9 40 14C44 20 38 26 32 32Z', f.fill, f, 1.6))).join('') + S('M32 34C36 44 40 50 46 58', f.dark, 3) + C(32, 32, 3, f.light);
const KEY = (f) => `<circle cx="20" cy="22" r="11" fill="none" stroke="${f.line}" stroke-width="8"/><circle cx="20" cy="22" r="11" fill="none" stroke="${f.fill}" stroke-width="4.5"/>` + S('M28 30L54 56', f.line, 8) + S('M28 30L54 56', f.fill, 4.5) + S('M44 46L38 52M50 52L44 58', f.line, 7) + S('M44 46L38 52M50 52L44 58', f.fill, 3.5);
const RING = (f) => `<circle cx="32" cy="38" r="17" fill="none" stroke="${f.line}" stroke-width="10"/><circle cx="32" cy="38" r="17" fill="none" stroke="${f.fill}" stroke-width="6.5"/><circle cx="32" cy="38" r="17" fill="none" stroke="${f.white}" stroke-width="1.2" opacity="0.6"/>` + tr(32, 18, 0.42, 0, GEM({ ...f, fill: f.accent }));
const BELT = (f) => P('M4 24H60V40H4Z', f.fill, f) + P('M24 20H40V44H24Z', f.accent, f) + P('M28 25H36V39H28Z', f.dark, null) + S('M8 32H22M42 32H56', f.dark, 1.6, 0.8);
const HOOD = (f) => P('M32 4C48 4 56 20 56 58H8C8 20 16 4 32 4Z', f.fill, f) + P('M32 22C40 22 45 30 45 41C40 46 24 46 19 41C19 30 24 22 32 22Z', f.dark) + C(27, 35, 2, f.accent) + C(37, 35, 2, f.accent);
const MASK = (f) => P('M8 18C20 12 44 12 56 18C56 40 46 54 32 57C18 54 8 40 8 18Z', f.fill, f) + P('M14 26C18 22 26 22 28 28C24 32 18 32 14 26ZM50 26C46 22 38 22 36 28C40 32 46 32 50 26Z', f.dark) + S('M22 44C28 48 36 48 42 44', f.dark, 2) + S('M32 14V24', f.accent, 3);
const GLOVE = (f) => P('M20 56V30C20 26 22 24 25 24V12C25 9 29 9 29 12V22H31V8C31 5 35 5 35 8V22H37V10C37 7 41 7 41 10V24H43V16C43 13 47 13 47 16V40C47 50 42 56 34 56Z', f.fill, f) + P('M18 50H48V58H18Z', f.dark, f, 1.6);
const BOULDER = (f) => ROCK(f) + S('M6 50C2 46 2 40 4 36M58 30C61 34 61 40 59 44', f.light, 2, 0.6);
const METEOR = (f) => tr(24, 42, 0.62, 0, ROCK(f)) + [0, 1, 2].map((i) => S(`M${32 + i * 3} ${30 - i * 5}L${56 - i * 2} ${6 + i * 3}`, f.accent, 6 - i * 1.4, 0.85)).join('') + tr(24, 42, 0.62, 0, P('M30 10C38 14 44 22 44 32', 'none', { line: f.white }, 2));
const FIREBALL = (f) => tr(40, 24, 0.75, 45, FLAME(f)) + C(24, 40, 15, f.fill, f) + C(24, 40, 9, f.light) + C(21, 37, 4, f.white);
const DRAGON = (f) => P('M5 40C9 30 18 24 28 22L35 9L40 20C48 20 54 24 59 30L50 32L57 38L46 38C42 44 34 48 24 48L16 57L16 46C12 46 8 44 5 40Z', f.fill, f) + C(40, 27, 2.6, f.accent) + S('M28 22L33 30M20 30L26 36M46 38C40 40 34 40 30 38', f.dark, 1.6) + P('M35 9L38 4L40 20Z', f.light, f, 1.2);
const PHOENIX = (f) => tr(18, 26, 0.55, -20, WING(f)) + tr(46, 26, 0.55, 20, `<g transform="translate(64 0) scale(-1 1)">${WING(f)}</g>`) + E(32, 34, 6, 12, f.fill, `stroke="${f.line}" stroke-width="2"`) + C(32, 20, 5, f.fill, f, 1.6) + tr(32, 52, 0.4, 180, FLAME(f));
const SWORDS = (f) => tr(32, 32, 0.85, -38, SWORD(f)) + tr(32, 32, 0.85, 38, SWORD(f));
const BLADES3 = (f) => [0, 120, 240].map((r) => tr(32, 32, 0.5, r, `<g transform="translate(0 -22)">${SWORD(f)}</g>`)).join('') + C(32, 32, 5, f.accent, f, 1.4);
const SKULLBONES = (f) => S('M10 50L54 14M10 14L54 50', f.line, 9) + S('M10 50L54 14M10 14L54 50', '#efe6d0', 5.5) + tr(32, 30, 0.7, 0, SKULL(f));
const DOOM = (f) => P('M14 22C6 14 6 4 12 2C12 10 16 14 22 16ZM50 22C58 14 58 4 52 2C52 10 48 14 42 16Z', f.dark, f, 1.6) + SKULL(f);
const FLASK = (f) => POTION(f);
const BUBBLE = (f) => C(32, 32, 25, f.fill, f) + C(32, 32, 25, 'none', { line: f.white }, 1.2) + E(24, 22, 8, 5, f.white, 'opacity="0.6" transform="rotate(-35 24 22)"') + C(42, 42, 3, f.white, null);
const CRACK = (f) => P('M30 2L36 2L32 18L40 26L30 38L36 48L28 62L26 50L20 42L28 30L22 22Z', f.fill, f) + S('M32 18L48 14M30 38L14 40M36 48L50 54', f.fill, 2.5);
const SPIKES = (f) => [12, 24, 36, 48].map((x, i) => P(`M${x - 7} 56L${x} ${16 + (i % 2) * 10}L${x + 7} 56Z`, f.fill, f, 1.6)).join('') + P('M2 56H62V60H2Z', f.dark, f, 1.4);
const SPEAR = (f) => S('M10 58L46 14', f.line, 6) + S('M10 58L46 14', '#c8a070', 3.2) + P('M56 4L42 12L52 22Z', f.fill, f) + S('M40 22L46 28', f.accent, 3);
const STAFF = (f) => S('M18 58L42 18', f.line, 6) + S('M18 58L42 18', '#a07040', 3.2) + C(46, 14, 9, f.fill, f) + C(46, 14, 5, f.white, null) + S('M36 18C38 10 44 6 52 8', f.accent, 2);
const DAGGERS = (f) => tr(24, 34, 0.62, -20, SWORD(f)) + tr(40, 34, 0.62, 20, SWORD(f));
const CROSSBOW = (f) => S('M8 22C20 12 44 12 56 22', f.line, 7) + S('M8 22C20 12 44 12 56 22', '#a07040', 4) + S('M8 22L32 30L56 22', f.light, 1.4) + P('M28 14H36V58H28Z', '#8a5a2a', f, 1.6) + P('M32 4L37 14H27Z', f.fill, f, 1.4);
const BANNER = (f) => FLAG(f);
const DUMMY = (f) => S('M32 20V60M16 30H48', f.line, 7) + S('M32 20V60M16 30H48', '#c8a070', 4) + C(32, 14, 9, '#e8d8b0', f) + S('M28 13L30 15M36 13L34 15M28 18H36', f.dark, 1.5) + P('M22 30H42L38 46H26Z', f.fill, f, 1.6);
const WOLF = (f) => P('M10 8L22 22H42L54 8L52 30C52 44 44 56 32 58C20 56 12 44 12 30Z', f.fill, f) + P('M26 46L32 54L38 46Z', f.dark) + P('M20 30L28 34L22 36ZM44 30L36 34L42 36Z', f.accent) + S('M32 40V46', f.dark, 1.6);
const LIZARD = (f) => P('M6 40C10 30 20 26 30 26L40 18L44 26C52 26 58 30 60 36L48 38L58 44H44C36 46 22 48 12 46Z', f.fill, f) + C(40, 32, 3, f.accent) + E(40, 32, 1, 2.6, f.dark) + P('M30 26L34 14L38 22L42 12L44 26Z', f.light, f, 1.2);
const TOTEM = (f) => P('M24 6H40V60H24Z', '#8a5a2a', f) + tr(32, 22, 0.55, 0, MASK(f)) + tr(32, 46, 0.4, 0, MASK(f));
const TREE = (f) => P('M27 36H37L39 58H25Z', '#7a4a22', f) + S('M32 44L24 52M33 48L40 54', '#5a3418', 2) + P('M32 4C44 4 53 12 53 22C57 26 57 34 52 38C48 44 40 44 32 42C24 44 16 44 12 38C7 34 7 26 11 22C11 12 20 4 32 4Z', f.fill, f) + C(24, 20, 5, f.light, null) + C(40, 26, 4, f.light, null) + C(30, 32, 3, f.light, null);
const MUSHROOM = (f) => P('M25 30H39L42 56H22Z', '#efe6d0', f) + P('M7 32C7 16 19 7 32 7C45 7 57 16 57 32C49 29 15 29 7 32Z', f.fill, f) + C(22, 18, 4, f.white, null) + C(38, 14, 3, f.white, null) + C(45, 24, 3.5, f.white, null) + C(30, 23, 2.5, f.white, null);
const DRUM = (f) => P('M10 22V44C10 52 54 52 54 44V22Z', f.fill, f) + E(32, 22, 22, 8, '#f2e6cc', `stroke="${f.line}" stroke-width="2"`) + S('M14 26L22 46L30 26L38 46L46 26L52 42', f.light, 1.6) + S('M40 6L30 20M50 8L36 20', '#8a5a2a', 3);
const COMPASS = (f) => C(32, 32, 25, '#2a2438', f) + C(32, 32, 20, 'none', { line: f.fill }, 2) + P('M32 8L37 32L32 56L27 32Z', f.fill, f, 1.2) + P('M32 8L37 32H27Z', f.accent) + C(32, 32, 3, f.white);
const GEARHAND = UPARROW;

// v1.1 debuff / special-enemy emblems
const BOMB = (f) => C(29, 38, 19, f.fill, f) + E(22, 31, 5.5, 3.5, f.light, 'opacity="0.7" transform="rotate(-35 22 31)"') + P('M37 17L43 11L49 17L43 23Z', f.dark, f, 1.6)
  + S('M46 14C50 8 53 10 55 6', f.accent, 2.4) + P(star(4, 7, 2.2, 56, 6), f.white) + P(star(4, 4, 1.4, 56, 6), f.accent);
const WEB = (f) => {
  let spokes = '', rings = '';
  const N = 8, pt = (i, r) => [32 + Math.cos((i / N) * Math.PI * 2 - 0.2) * r, 32 + Math.sin((i / N) * Math.PI * 2 - 0.2) * r];
  for (let i = 0; i < N; i++) { const [x, y] = pt(i, 29); spokes += `M32 32L${x.toFixed(1)} ${y.toFixed(1)}`; }
  for (const r of [7, 14, 21, 28]) for (let i = 0; i < N; i++) { const [x0, y0] = pt(i, r), [x1, y1] = pt(i + 1, r), [mx, my] = pt(i + 0.5, r * 0.8); rings += `${i ? '' : `M${x0.toFixed(1)} ${y0.toFixed(1)}`}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`; }
  return S(spokes, f.line, 3.6) + S(rings, f.line, 3.2) + S(spokes, f.fill, 1.7) + S(rings, f.fill, 1.5) + C(32, 32, 2.5, f.fill);
};
const FROG = (f) => E(32, 42, 22, 14, f.fill, `stroke="${f.line}" stroke-width="2.2"`) + C(20, 26, 8.5, f.fill, f) + C(44, 26, 8.5, f.fill, f) + C(20, 26, 5, f.white) + C(44, 26, 5, f.white)
  + C(21, 27, 2.4, '#141414') + C(45, 27, 2.4, '#141414') + S('M19 44C25 49 39 49 45 44', f.dark, 2.2) + E(24, 40, 3, 2, f.light, 'opacity="0.6"')
  + P('M10 52L4 58L14 57L18 54Z', f.dark, f, 1.4) + P('M54 52L60 58L50 57L46 54Z', f.dark, f, 1.4) + C(30, 50, 1.6, f.dark) + C(38, 49, 1.4, f.dark);
const NOSIGN = (f) => `<circle cx="32" cy="32" r="24" fill="none" stroke="${f.line}" stroke-width="8.5"/><circle cx="32" cy="32" r="24" fill="none" stroke="${f.fill}" stroke-width="5.5"/>`
  + S('M15.5 15.5L48.5 48.5', f.line, 8.5) + S('M15.5 15.5L48.5 48.5', f.fill, 5.5);
const SCREAM = (f) => P('M32 8C44 8 50 18 50 30C50 44 46 56 32 58C18 56 14 44 14 30C14 18 20 8 32 8Z', f.fill, f) + E(25, 27, 4, 6, f.dark, 'transform="rotate(12 25 27)"') + E(39, 27, 4, 6, f.dark, 'transform="rotate(-12 39 27)"')
  + E(32, 44, 5.5, 9, f.dark) + C(25, 28, 1.6, f.accent) + C(39, 28, 1.6, f.accent) + S('M9 20C4 28 4 38 9 46M5 14C-2 26 -2 40 5 52', f.accent, 2.2, 0.85) + S('M55 20C60 28 60 38 55 46M59 14C66 26 66 40 59 52', f.accent, 2.2, 0.85);

export const SHAPES = {
  bomb: BOMB, web: WEB, frog: FROG, nosign: NOSIGN, scream: SCREAM,
  sword: SWORD, flame: FLAME, drop: DROP, bolt: BOLT, skull: SKULL, heart: HEART, shield: SHIELD, crescent: CRESCENT, wing: WING, leaf: LEAF, orb: ORB, gem: GEM, potion: POTION,
  crown: CROWN, hourglass: HOURGLASS, book: BOOK, scroll: SCROLL, boot: BOOT, arrow: ARROW, axe: AXE, hammer: HAMMER, eye: EYE, cloud: CLOUD, rock: ROCK, mountain: MOUNTAIN, crystal: CRYSTAL,
  crystals: CRYSTALS, shard: SHARD, shards: SHARDS, snowflake: SNOWFLAKE, sun: SUN, star: STAR, spark: SPARK, spiral: SPIRAL, rings: RINGS, wave: WAVE, rune: RUNE, portal: PORTAL, chain: CHAIN,
  target: TARGET, scythe: SCYTHE, fang: FANG, claw: CLAW, hook: HOOK, flag: FLAG, dice: DICE, ankh: ANKH, chest: CHEST, feather: FEATHER, bell: BELL, horn: HORN, halo: HALO, thorns: THORNS,
  vines: VINES, tentacle: TENTACLE, foot: FOOT, tornado: TORNADO, ghost: GHOST, bat: BAT, bee: BEE, spider: SPIDER, burst: BURST, cross: CROSS, plus: PLUS, up: UPARROW, infinity: INFINITY,
  clock: CLOCK, refresh: REFRESH, fist: FIST, magnet: MAGNET, coin: COIN, coins: COINS, clover: CLOVER, key: KEY, ring: RING, belt: BELT, hood: HOOD, mask: MASK, glove: GLOVE, boulder: BOULDER,
  meteor: METEOR, fireball: FIREBALL, dragon: DRAGON, phoenix: PHOENIX, swords: SWORDS, blades3: BLADES3, skullbones: SKULLBONES, doom: DOOM, flask: FLASK, bubble: BUBBLE, crack: CRACK,
  tree: TREE, mushroom: MUSHROOM, drum: DRUM, compass: COMPASS,
  spikes: SPIKES, spear: SPEAR, staff: STAFF, daggers: DAGGERS, crossbow: CROSSBOW, banner: BANNER, dummy: DUMMY, wolf: WOLF, lizard: LIZARD, totem: TOTEM, gear: GEARHAND,
};
export { tr };
