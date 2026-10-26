// Original procedural audio: every SFX and music loop is synthesized live with WebAudio (no sample files).
import { DEBUFF } from '../game/content/debuffs.js';
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const SCALES = { penta: [0, 2, 4, 7, 9], minorPenta: [0, 3, 5, 7, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], harmonicMinor: [0, 2, 3, 5, 7, 8, 11] };
const SONGS = {
  title: { bpm: 84, root: 50, scale: 'dorian', drums: 0.3, pad: 0.9, lead: 0.5, bass: 0.5, prog: [0, 5, 3, 4] },
  graveyard: { bpm: 128, root: 50, scale: 'minorPenta', drums: 1, pad: 0.6, lead: 0.7, bass: 0.9, prog: [0, 3, 5, 4] },
  frostkeep: { bpm: 122, root: 52, scale: 'dorian', drums: 0.8, pad: 0.9, lead: 0.7, bass: 0.7, prog: [0, 5, 3, 6], bell: true },
  inferno: { bpm: 140, root: 45, scale: 'phrygian', drums: 1.2, pad: 0.5, lead: 0.8, bass: 1, prog: [0, 1, 0, 5] },
  shadowcourt: { bpm: 118, root: 49, scale: 'harmonicMinor', drums: 0.9, pad: 0.8, lead: 0.7, bass: 0.9, prog: [0, 5, 3, 4] },
  abyss: { bpm: 136, root: 46, scale: 'phrygian', drums: 1.2, pad: 0.7, lead: 0.8, bass: 1.1, prog: [0, 6, 5, 1] },
  skytemple: { bpm: 126, root: 55, scale: 'lydian', drums: 0.9, pad: 1, lead: 0.8, bass: 0.7, prog: [0, 4, 5, 3], bell: true },
  boss: { bpm: 150, root: 45, scale: 'harmonicMinor', drums: 1.4, pad: 0.6, lead: 1, bass: 1.2, prog: [0, 5, 6, 4] },
  victory: { bpm: 100, root: 55, scale: 'penta', drums: 0.5, pad: 1, lead: 0.9, bass: 0.6, prog: [0, 3, 4, 0], once: true },
  defeat: { bpm: 70, root: 45, scale: 'minorPenta', drums: 0.2, pad: 1, lead: 0.4, bass: 0.5, prog: [0, 5, 3, 0], once: true },
};

export function createAudio(settings = {}) {
  let ctx = null, master, sfxBus, musicBus, noiseBuf, comp;
  let vol = { music: settings.music ?? 0.5, sfx: settings.sfx ?? 0.8 };
  const rate = new Map();
  let voices = 0;
  let song = null, songName = '', seqTimer = null, step = 0, nextTime = 0, boss = false;

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp);
    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = vol.music * 0.55; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  const unlock = () => { if (init() && ctx.state === 'suspended') ctx.resume(); if (songName && !seqTimer) startSeq(); };
  window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);

  // ---------------------------------------------------------- primitives
  function env(g, t, a, peak, d, sus = 0) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus || 0.0001), t + a + d); }
  function osc(type, f0, f1, t, dur, peak, dest, { a = 0.005, detune = 0, filter } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); o.detune.value = detune;
    env(g, t, a, peak, dur); let n = o; if (filter) { const f = ctx.createBiquadFilter(); f.type = filter.type || 'lowpass'; f.frequency.value = filter.f; f.Q.value = filter.q || 1; o.connect(f); n = f; }
    n.connect(g); g.connect(dest); o.start(t); o.stop(t + a + dur + 0.05);
  }
  function noise(t, dur, peak, dest, { type = 'bandpass', f0 = 1000, f1, q = 1, a = 0.003 } = {}) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); f.Q.value = q;
    const g = ctx.createGain(); env(g, t, a, peak, dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + a + dur + 0.05);
  }
  const pan = (p) => { const n = ctx.createStereoPanner(); n.pan.value = Math.max(-1, Math.min(1, p)); n.connect(sfxBus); return n; };

  // ---------------------------------------------------------- sfx recipes
  const FX = {
    swing: (t, d) => noise(t, 0.16, 0.18, d, { f0: 600, f1: 2600, q: 1.2 }),
    hit: (t, d) => { osc('sine', 150, 55, t, 0.12, 0.45, d); noise(t, 0.05, 0.25, d, { f0: 2500, q: 0.8 }); },
    crit: (t, d) => { FX.hit(t, d); osc('triangle', 1760, 1200, t, 0.18, 0.18, d); osc('sine', 2637, 2000, t + 0.01, 0.22, 0.1, d); },
    kill: (t, d) => { noise(t, 0.09, 0.28, d, { f0: 1800, f1: 600, q: 2 }); osc('square', 220, 90, t, 0.07, 0.08, d, { filter: { f: 1200 } }); },
    killBig: (t, d) => { osc('sine', 90, 40, t, 0.5, 0.7, d); noise(t, 0.4, 0.4, d, { type: 'lowpass', f0: 1800, f1: 200 }); osc('triangle', 660, 440, t, 0.4, 0.15, d); },
    explode: (t, d) => { osc('sine', 110, 35, t, 0.45, 0.6, d); noise(t, 0.5, 0.45, d, { type: 'lowpass', f0: 2500, f1: 150 }); },
    thunder: (t, d) => { for (let i = 0; i < 4; i++) noise(t + i * 0.025, 0.08, 0.3, d, { f0: 3000 + Math.random() * 3000, q: 0.5 }); osc('sawtooth', 120, 40, t, 0.35, 0.2, d, { filter: { f: 800 } }); },
    cast_fire: (t, d) => { noise(t, 0.5, 0.35, d, { type: 'lowpass', f0: 300, f1: 2400, q: 0.8, a: 0.05 }); osc('sawtooth', 80, 160, t, 0.4, 0.12, d, { filter: { f: 600 } }); },
    cast_frost: (t, d) => { [0, 4, 7, 12].forEach((s, i) => osc('triangle', NOTE(88 + s), 0, t + i * 0.035, 0.5, 0.09, d)); noise(t, 0.3, 0.15, d, { type: 'highpass', f0: 5000 }); },
    cast_storm: (t, d) => { FX.thunder(t, d); osc('square', 1200, 300, t, 0.15, 0.06, d); },
    cast_shadow: (t, d) => { osc('sawtooth', 70, 50, t, 0.6, 0.18, d, { detune: -20, filter: { f: 400 } }); osc('sawtooth', 70, 52, t, 0.6, 0.18, d, { detune: 25, filter: { f: 400 } }); noise(t, 0.4, 0.1, d, { f0: 300, q: 6 }); },
    cast_holy: (t, d) => { [0, 4, 7, 11, 16].forEach((s, i) => osc('sine', NOTE(76 + s), 0, t + i * 0.02, 0.9, 0.07, d, { a: 0.02 })); },
    cast_nature: (t, d) => { [0, 7, 12].forEach((s, i) => osc('triangle', NOTE(67 + s), NOTE(67 + s) * 0.98, t + i * 0.05, 0.25, 0.12, d)); noise(t, 0.2, 0.1, d, { f0: 1500, q: 3 }); },
    cast_blade: (t, d) => { osc('triangle', 3200, 2400, t, 0.35, 0.12, d); osc('sine', 4800, 4000, t, 0.25, 0.06, d); FX.swing(t, d); },
    cast_arcane: (t, d) => { osc('sine', 400, 1600, t, 0.4, 0.15, d); osc('sine', 600, 2400, t + 0.05, 0.35, 0.1, d); noise(t, 0.3, 0.08, d, { type: 'highpass', f0: 6000 }); },
    cast_earth: (t, d) => { osc('sine', 70, 30, t, 0.6, 0.7, d); noise(t, 0.5, 0.35, d, { type: 'lowpass', f0: 600, f1: 80 }); },
    cast_blood: (t, d) => { noise(t, 0.25, 0.3, d, { type: 'lowpass', f0: 900, f1: 200, q: 4 }); osc('sine', 120, 60, t, 0.3, 0.3, d); },
    levelup: (t, d) => { [0, 4, 7, 12, 16].forEach((s, i) => osc('triangle', NOTE(72 + s), 0, t + i * 0.06, 0.3, 0.14, d)); },
    reveal: (t, d, tier = 4) => { const n = Math.min(8, 3 + tier); for (let i = 0; i < n; i++) osc('sine', NOTE(64 + SCALES.lydian[i % 7] + 12 * Math.floor(i / 7)), 0, t + i * 0.05, 0.8, 0.07 + tier * 0.006, d, { a: 0.01 }); if (tier >= 6) { noise(t, 1.2, 0.12, d, { type: 'highpass', f0: 7000, a: 0.3 }); osc('sine', NOTE(40), NOTE(52), t, 1.2, 0.3, d, { a: 0.1 }); } },
    musou: (t, d) => { [0, 7, 12, 16, 19].forEach((s) => osc('sawtooth', NOTE(50 + s), 0, t, 1.2, 0.08, d, { a: 0.02, filter: { f: 2400 } })); FX.killBig(t, d); },
    coin: (t, d) => { osc('square', 1975, 0, t, 0.06, 0.06, d, { filter: { f: 4000 } }); osc('square', 2637, 0, t + 0.05, 0.12, 0.06, d, { filter: { f: 4000 } }); },
    buy: (t, d) => { FX.coin(t, d); FX.coin(t + 0.08, d); },
    deny: (t, d) => osc('square', 180, 120, t, 0.18, 0.08, d, { filter: { f: 900 } }),
    click: (t, d) => osc('sine', 900, 700, t, 0.05, 0.1, d),
    pick: (t, d) => { osc('triangle', NOTE(79), 0, t, 0.15, 0.15, d); osc('triangle', NOTE(86), 0, t + 0.06, 0.25, 0.12, d); },
    reroll: (t, d) => { for (let i = 0; i < 4; i++) osc('square', 600 + i * 150, 0, t + i * 0.03, 0.04, 0.05, d, { filter: { f: 3000 } }); },
    open: (t, d) => osc('triangle', 500, 900, t, 0.12, 0.1, d),
    dodge: (t, d) => noise(t, 0.2, 0.18, d, { f0: 3000, f1: 800, q: 0.7 }),
    hurt: (t, d) => { osc('sine', 120, 50, t, 0.18, 0.5, d); noise(t, 0.1, 0.2, d, { type: 'lowpass', f0: 900 }); },
    block: (t, d) => { osc('square', 800, 600, t, 0.08, 0.08, d, { filter: { f: 2500 } }); osc('triangle', 2400, 2000, t, 0.12, 0.06, d); },
    boss: (t, d) => { osc('sawtooth', 70, 45, t, 1.4, 0.3, d, { a: 0.1, filter: { f: 500 } }); osc('sawtooth', 72, 46, t, 1.4, 0.25, d, { a: 0.1, filter: { f: 500 } }); noise(t, 1.2, 0.2, d, { type: 'lowpass', f0: 700, f1: 200, a: 0.1 }); },
    gong: (t, d) => { [1, 2.76, 5.4].forEach((m, i) => osc('sine', 110 * m, 110 * m * 0.99, t, 1.6 - i * 0.3, 0.2 / (i + 1), d, { a: 0.005 })); },
    taiko: (t, d) => { osc('sine', 80, 45, t, 0.35, 0.8, d); noise(t, 0.08, 0.2, d, { type: 'lowpass', f0: 1200 }); },
    warning: (t, d) => osc('square', 880, 880, t, 0.08, 0.04, d, { filter: { f: 2000 } }),
    victory: (t, d) => { [0, 4, 7, 12].forEach((s, i) => osc('triangle', NOTE(67 + s), 0, t + i * 0.12, 0.6, 0.15, d)); FX.gong(t + 0.5, d); },
    defeat: (t, d) => { [12, 7, 3, 0].forEach((s, i) => osc('sawtooth', NOTE(57 + s), 0, t + i * 0.22, 0.6, 0.08, d, { filter: { f: 900 } })); },
    rune: (t, d) => { osc('sine', 300, 1200, t, 0.5, 0.15, d); FX.reveal(t + 0.1, d, 3); },
    shoot: (t, d) => noise(t, 0.08, 0.12, d, { f0: 2500, f1: 1200, q: 2 }),
    heal: (t, d) => [0, 4, 7].forEach((s, i) => osc('sine', NOTE(76 + s), 0, t + i * 0.04, 0.3, 0.06, d)),
    // v1.1 debuffs and special-enemy abilities
    debuff: (t, d, kind = 'dot') => {
      if (kind === 'cc') { osc('square', 330, 140, t, 0.3, 0.1, d, { filter: { f: 1400 } }); osc('sine', 165, 70, t, 0.35, 0.3, d); noise(t, 0.2, 0.12, d, { f0: 600, q: 3 }); }
      else if (kind === 'stack') { osc('triangle', 520, 380, t, 0.09, 0.08, d); noise(t, 0.06, 0.06, d, { f0: 3000, q: 2 }); }
      else { osc('sawtooth', 220, 150, t, 0.22, 0.06, d, { filter: { f: 900 } }); noise(t, 0.18, 0.1, d, { type: 'lowpass', f0: 1200, f1: 300 }); }
    },
    resist: (t, d) => { osc('triangle', 1320, 1760, t, 0.12, 0.08, d); osc('sine', 2640, 0, t + 0.03, 0.15, 0.05, d); },
    cleanse: (t, d) => { [0, 7, 12, 19].forEach((s, i) => osc('sine', NOTE(79 + s), 0, t + i * 0.035, 0.5, 0.07, d, { a: 0.01 })); noise(t, 0.4, 0.08, d, { type: 'highpass', f0: 6000, a: 0.05 }); },
    fuse: (t, d) => osc('square', 1400, 1400, t, 0.05, 0.05, d, { filter: { f: 3000 } }),
    scream: (t, d) => { osc('sawtooth', 900, 1500, t, 0.5, 0.07, d, { a: 0.05, filter: { type: 'bandpass', f: 1400, q: 4 } }); osc('sawtooth', 960, 1380, t, 0.5, 0.06, d, { a: 0.05, filter: { type: 'bandpass', f: 1500, q: 4 } }); noise(t, 0.6, 0.12, d, { f0: 2200, f1: 900, q: 1.5, a: 0.06 }); },
    chain: (t, d) => { for (let i = 0; i < 5; i++) osc('square', 2200 + Math.random() * 800, 0, t + i * 0.035, 0.03, 0.04, d, { filter: { f: 5000 } }); noise(t, 0.2, 0.1, d, { f0: 4000, q: 2 }); },
    tether: (t, d) => { osc('sine', 220, 180, t, 0.9, 0.12, d, { a: 0.1 }); osc('sine', 331, 270, t, 0.9, 0.06, d, { a: 0.1 }); },
    petrify: (t, d) => { noise(t, 0.5, 0.35, d, { type: 'lowpass', f0: 900, f1: 120, q: 2 }); osc('sine', 90, 50, t, 0.4, 0.4, d); for (let i = 0; i < 6; i++) noise(t + 0.05 + i * 0.04, 0.03, 0.12, d, { f0: 2500 + i * 300, q: 4 }); },
  };
  let fuseNext = 0;
  const LIMIT = { debuff: 0.12, scream: 0.4, chain: 0.3, tether: 0.8, fuse: 0.1, hit: 0.035, crit: 0.06, kill: 0.03, swing: 0.05, shoot: 0.06, coin: 0.05, block: 0.08, explode: 0.08, thunder: 0.1, hurt: 0.15, warning: 0.25 };
  function play(name, arg, p = 0, gain = 1) {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const lim = LIMIT[name] || 0.03;
    if ((rate.get(name) || 0) > now) return;
    rate.set(name, now + lim);
    if (voices > 28) return;
    voices++; setTimeout(() => voices--, 400);
    const fn = FX[name]; if (!fn) return;
    const g = ctx.createGain(); g.gain.value = gain; g.connect(pan(p));
    fn(now + 0.005, g, arg);
  }

  // ---------------------------------------------------------- music sequencer
  function startSeq() {
    if (!ctx || seqTimer) return;
    step = 0; nextTime = ctx.currentTime + 0.1;
    seqTimer = setInterval(schedule, 25);
  }
  function stopSeq() { clearInterval(seqTimer); seqTimer = null; }
  function schedule() {
    if (!song || !ctx) return;
    const s = boss ? SONGS.boss : song;
    const spb = 60 / s.bpm / 4; // 16th notes
    while (nextTime < ctx.currentTime + 0.15) {
      playStep(s, step, nextTime);
      nextTime += spb; step++;
      if (s.once && step >= 64) { stopSeq(); return; }
    }
  }
  function playStep(s, i, t) {
    const sc = SCALES[s.scale], bar = Math.floor(i / 16) % s.prog.length, deg = s.prog[bar], beat = i % 16;
    const chordRoot = s.root + sc[deg % sc.length] + 12 * Math.floor(deg / sc.length);
    const d = musicBus;
    if (s.drums > 0) {
      if (beat % 8 === 0 || (s.drums > 1 && beat === 10)) osc('sine', 110, 40, t, 0.22, 0.55 * s.drums, d);
      if (beat === 4 || beat === 12) noise(t, 0.14, 0.22 * s.drums, d, { f0: 1800, q: 0.7 });
      if (beat % 2 === 0) noise(t, 0.03, 0.06 * s.drums, d, { type: 'highpass', f0: 7000 });
      if (s.drums > 1.1 && beat % 4 === 2) osc('sine', 160, 70, t, 0.12, 0.2, d);
    }
    if (s.bass && beat % 4 === 0) osc('sawtooth', NOTE(chordRoot - 12), 0, t, 0.28, 0.12 * s.bass, d, { filter: { f: 500 } });
    if (s.pad && beat === 0) for (const k of [0, 2, 4]) osc('triangle', NOTE(chordRoot + sc[k % sc.length]), 0, t, 2.2, 0.035 * s.pad, d, { a: 0.4 });
    if (s.lead && [0, 3, 6, 10, 12, 14].includes(beat) && Math.random() < 0.75) {
      const n = chordRoot + 12 + sc[Math.floor(Math.random() * sc.length)];
      osc(s.bell ? 'sine' : 'triangle', NOTE(n), 0, t, s.bell ? 0.6 : 0.25, 0.06 * s.lead, d, { a: 0.01 });
    }
  }

  return {
    play,
    music(name) {
      const s = SONGS[name] || SONGS.graveyard;
      boss = false;
      if (songName === name) return;
      songName = name; song = s;
      stopSeq();
      if (ctx && ctx.state === 'running') startSeq();
    },
    setVolumes(st) { vol = { music: st.music, sfx: st.sfx }; if (ctx) { sfxBus.gain.value = vol.sfx; musicBus.gain.value = vol.music * 0.55; } },
    /** Per-frame state sounds: the time-bomb fuse beeps faster as it burns down. */
    tick(game) {
      const b = game.player.debuffs?.bomb;
      if (!(b?.t > 0) || game.status !== 'playing') { fuseNext = 0; return; }
      const now = performance.now() / 1000;
      if (now >= fuseNext) { play('fuse', null, 0, 0.5 + (1 - b.t / b.dur) * 0.6); fuseNext = now + Math.max(0.12, b.t / b.dur * 0.7); }
    },
    /** Map simulation events to sounds. */
    event(ev, game) {
      const px = game.player.x;
      const p = (x) => (x == null ? 0 : Math.max(-0.8, Math.min(0.8, (x - px) / 18)));
      switch (ev.type) {
        case 'attack': play('swing', null, 0, ev.kind === 'charge' ? 1.4 : 1); break;
        case 'hit': if (ev.source !== 'dot') play(ev.crit ? 'crit' : 'hit', null, p(ev.x), ev.elite ? 1.2 : 0.7); break;
        case 'kill': play(ev.boss || ev.elite ? 'killBig' : 'kill', null, p(ev.x), 0.7); break;
        case 'cast': play(`cast_${ev.faction || 'arcane'}`, null, 0, 0.9); break;
        case 'levelup': play('levelup'); break;
        case 'musou': if (ev.phase === 'start') play('musou'); if (ev.phase === 'finish') play('explode', null, 0, 1.4); break;
        case 'gold': play('coin', null, 0, 0.5); break;
        case 'dodge': play('dodge'); break;
        case 'playerHit': play(ev.blocked ? 'block' : 'hurt'); break;
        case 'bossSpawn': play('boss'); boss = true; break;
        case 'bossDeath': play('killBig'); play('gong'); boss = false; break;
        case 'multikill': play('taiko'); break;
        case 'banner': if (ev.style === 'officer') play('gong'); if (ev.style === 'danger') play('warning'); break;
        case 'explode': play('explode', null, p(ev.x), 0.8); break;
        case 'shoot': play('shoot'); break;
        case 'rune': play('rune'); break;
        case 'craft': play('reveal', 5); break;
        case 'evolve': play('reveal', 7); break;
        case 'blocked': play('block', null, p(ev.x), 0.6); break;
        case 'heal': if (ev.amount > 30) play('heal'); break;
        case 'stageClear': play('victory'); break;
        case 'debuff': play('debuff', DEBUFF[ev.id]?.cc ? 'cc' : DEBUFF[ev.id]?.max && !ev.fresh ? 'stack' : 'dot', 0, 0.8); if (ev.id === 'tether' && ev.fresh) play('tether'); break;
        case 'debuffResist': play('resist'); break;
        case 'cleanse': play('cleanse'); break;
        case 'tetherBreak': play('block', null, 0, 1.2); break;
        case 'petrified': play('petrify'); break;
        case 'bombExplode': play('explode', null, 0, ev.dodged ? 0.6 : 1.3); if (ev.dodged) play('resist'); break;
        case 'enemyCast': if (ev.kind === 'hook') play('chain', null, p(ev.x), 0.9); else if (ev.name === '凄厉尖啸') play('scream', null, p(ev.x), 0.9); else play('warning', null, p(ev.x), 0.7); break;
        case 'actionBlocked': play('deny', null, 0, 0.6); break;
        default: break;
      }
    },
  };
}
