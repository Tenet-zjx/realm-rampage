import * as THREE from 'three';

// Individually animated characters: the hero, bosses and hero-shaped summons (mirror images / illusions).
const FADE = 0.08;

function createAnimated(ch) {
  const mixer = new THREE.AnimationMixer(ch.root);
  const actions = new Map();
  const get = (name) => {
    if (!name) return null;
    if (actions.has(name)) return actions.get(name);
    const clip = ch.clips.get(name); if (!clip) return null;
    const a = mixer.clipAction(clip); actions.set(name, a); return a;
  };
  let current = null, currentName = '';
  return {
    mixer, get,
    /** Loop or one-shot play with crossfade. */
    play(name, { loop = true, timeScale = 1, fade = FADE, restart = false, clamp = false } = {}) {
      const a = get(name); if (!a) return null;
      if (currentName === name && !restart) { a.timeScale = timeScale; return a; }
      a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.timeScale = timeScale;
      a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = clamp || !loop;
      if (current && current !== a) a.crossFadeFrom(current, fade, false);
      a.play(); current = a; currentName = name;
      return a;
    },
    /** Scrub a clip window manually (attacks): t in [0,1] maps to [from, to] of clip duration. */
    scrub(name, f, from = 0, to = 1, fade = 0.05) {
      const a = get(name); if (!a) return;
      if (currentName !== name) { a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; if (current && current !== a) a.crossFadeFrom(current, fade, false); a.play(); current = a; currentName = name; }
      a.paused = false; a.timeScale = 0;
      a.time = a.getClip().duration * (from + (to - from) * Math.min(1, Math.max(0, f)));
    },
    forceNext() { currentName = ''; },
    get name() { return currentName; },
    update(dt) { mixer.update(dt); },
  };
}

export function createUnitRenderer(scene, assets) {
  const units = new Map(); // key -> view
  const loading = new Set();
  const handBone = (root) => { let b = null; root.traverse((o) => { if (o.isBone && o.name === 'handslotr') b = o; if (o.isBone && !b && o.name.startsWith('handslot') && o.name.endsWith('r')) b = o; }); return b; };

  async function spawn(key, model, { skin = 0, scale = 1, shadow = true } = {}) {
    if (units.has(key) || loading.has(key)) return;
    loading.add(key);
    const ch = await assets.character(model, { skin });
    loading.delete(key);
    ch.root.scale.setScalar(scale);
    ch.root.traverse((o) => { if (o.isMesh) { o.castShadow = shadow; o.receiveShadow = false; o.frustumCulled = false; } });
    scene.add(ch.root);
    const anim = createAnimated(ch);
    const view = { key, ch, anim, root: ch.root, hand: handBone(ch.root), scale, alive: true, mats: ch.materials, lastState: '', deathPlayed: false };
    units.set(key, view);
    return view;
  }
  function remove(key) {
    const v = units.get(key); if (!v) return;
    scene.remove(v.root);
    v.root.traverse((o) => { if (o.isMesh) o.geometry?.dispose(); });
    units.delete(key);
  }
  const setFlash = (v, amount, color) => { for (const m of v.mats) { const u = m.userData.rr; if (!u) continue; u.uFlash.value.set(color?.r ?? 1, color?.g ?? 1, color?.b ?? 1, amount); } };
  const setTint = (v, rgb, amount) => { for (const m of v.mats) { const u = m.userData.rr; if (!u) continue; u.uTint.value.set(rgb[0], rgb[1], rgb[2], amount); } };
  const setDissolve = (v, d) => { for (const m of v.mats) { const u = m.userData.rr; if (u) u.uDissolve.value = d; } };
  const setStone = (v, k) => { for (const m of v.mats) { const u = m.userData.rr; if (u) u.uStone.value = k; } };
  const handWorld = (v, out, tip = 0) => {
    if (!v.hand) return out.copy(v.root.position).setY(1.2);
    v.hand.updateWorldMatrix(true, false);
    out.set(0, tip, 0).applyMatrix4(v.hand.matrixWorld);
    return out;
  };

  function syncHero(game, dt, view) {
    const p = game.player, hero = game.hero, a = view.anim;
    view.root.position.set(p.x, p.y, p.z);
    view.root.rotation.y = p.face;
    const D = p.debuffs || {}, has = (id) => (D[id]?.t || 0) > 0;
    const hexed = has('hex'), stone = has('petrify'), frozen = has('freeze');
    view.hexK = (view.hexK ?? 0) + ((hexed ? 1 : 0) - (view.hexK ?? 0)) * Math.min(1, dt * 12);
    view.stoneK = (view.stoneK ?? 0) + ((stone ? 1 : 0) - (view.stoneK ?? 0)) * Math.min(1, dt * 8);
    const sc = view.scale * (game.stats?.scale || 1) * (1 - view.hexK * 0.45);
    view.root.scale.set(sc, sc * (hexed ? 0.9 + Math.abs(Math.sin(game.time * 9)) * 0.15 : 1), sc);
    if (hexed && p.state === 'move') view.root.position.y = p.y + Math.abs(Math.sin(game.time * 9)) * 0.35;
    const clips = hero.clips;
    if (p.dead) { if (a.name !== clips.death) a.play(clips.death, { loop: false, fade: 0.15 }); }
    else if (has('hooked')) a.play('Hit_B', { loop: false, timeScale: 1.2 });
    else if (stone || frozen) { /* pose holds below */ }
    else if (p.state === 'musou') {
      const ms = p.musouState, m = hero.musou;
      const finishing = ms && ms.t >= ms.dur * 0.72;
      a.play(finishing ? m.clips[1] : m.clips[0], { loop: !finishing, timeScale: finishing ? 1.4 : 1.6 });
    } else if (p.state === 'omnislash') a.play('Dualwield_Melee_Attack_Slice', { loop: true, timeScale: 2.4 });
    else if (p.forced) a.play(p.forced.arc ? 'Jump_Full_Short' : clips.dodge, { loop: false, timeScale: 1.6 });
    else if (p.state === 'dodge') a.play(clips.dodge, { loop: false, timeScale: 1.5 });
    else if (p.state === 'attack' && p.move) { const mv = p.move; a.scrub(mv.def.clip, mv.t / mv.dur, mv.def.from ?? 0, mv.def.to ?? 1); }
    else if (p.channelT > 0) a.play('Spellcasting', { loop: true, timeScale: 1.4 });
    else if (p.castAnim?.clip && p.castAnim.t < p.castAnim.dur) a.play(p.castAnim.clip, { loop: false, timeScale: 2.2, restart: view.lastCast !== p.castAnim, fade: 0.05 });
    else if (p.state === 'move') a.play(clips.run, { loop: true, timeScale: Math.max(0.8, game.stats.speed / 6.4) });
    else a.play(clips.idle, { loop: true });
    view.lastCast = p.castAnim;
    const fb = D.frostbite?.t > 0 ? D.frostbite.stacks : 0;
    a.update(stone || frozen ? 0 : dt * (has('timeslow') ? 0.6 : 1) * (1 - fb * 0.07));
    setStone(view, view.stoneK);
    // feedback
    setFlash(view, Math.max(p.hurtFlash * 0.9, p.invuln > 0 && p.state === 'dodge' ? 0.15 : 0), p.hurtFlash > 0 ? { r: 1, g: 0.2, b: 0.15 } : { r: 0.6, g: 0.8, b: 1 });
    const buffTint = p.buffs.find((b) => b.vfx === 'bloodRage') ? [1, 0.4, 0.4] : p.buffs.find((b) => b.vfx === 'godStrength') ? [1, 0.85, 0.4] : p.trueMusou && p.state === 'musou' ? [1, 0.4, 0.2] : null;
    const pulse = 0.5 + Math.sin(game.time * 8) * 0.5;
    const dTint = frozen ? [[0.55, 0.85, 1.3], 0.6] : hexed ? [[0.45, 1.25, 0.35], 0.7] : has('fear') ? [[0.7, 0.4, 1.1], 0.3 + pulse * 0.2] : has('confuse') ? [[1.3, 0.5, 1.1], 0.2 + pulse * 0.25]
      : has('root') ? [[0.5, 1.1, 0.4], 0.35] : has('timeslow') ? [[1.2, 1.0, 0.5], 0.25] : D.poison?.t > 0 ? [[0.55, 1.2, 0.35], 0.12 + Math.min(10, D.poison.stacks) * 0.025 * pulse]
      : D.corrode?.t > 0 ? [[1.0, 1.2, 0.3], 0.1 + D.corrode.stacks * 0.04] : fb ? [[0.6, 0.9, 1.3], fb * 0.07] : D.webbed?.t > 0 ? [[1.2, 1.2, 1.1], D.webbed.stacks * 0.12] : null;
    if (dTint && !buffTint) setTint(view, dTint[0], dTint[1]);
    else setTint(view, buffTint || [1, 1, 1], buffTint ? 0.35 : 0);
    view.root.visible = !(p.stealthT > 0 && Math.floor(game.time * 20) % 3 === 0);
  }

  function syncBoss(game, dt, e, view) {
    const a = view.anim, c = e.def.clips;
    view.root.position.set(e.x, (e.def.fly || 0) + Math.sin(game.time * 2) * (e.def.fly ? 0.2 : 0), e.z);
    view.root.rotation.y = e.face;
    if (e.dying) { if (!view.deathPlayed) { a.play(c.death, { loop: false, fade: 0.2 }); view.deathPlayed = true; } setDissolve(view, Math.max(0, (e.deathT - 2.2) / 1.2)); }
    else if (e.state === 'spawn') a.play(c.spawn || c.idle, { loop: false, timeScale: (e.def.og ? 1 : 1.3) });
    else if (e.state === 'pattern') a.play(e.pattern?.clip || c.attack, { loop: e.pattern?.chargeRun || /Spinning|Spellcasting|Running/.test(e.pattern?.clip || ''), timeScale: e.stateT < (e.pattern?.windup || 1) ? 0.75 : 1.4 });
    else if (e.state === 'recover') a.play(c.idle, { loop: true });
    else if (e.state === 'move') a.play(c.move || c.idle, { loop: true, timeScale: 1.1 });
    else a.play(c.idle, { loop: true });
    a.update(dt * (e.status.stun || e.status.freeze ? 0.1 : 1));
    setFlash(view, e.flash * 0.8, { r: 1, g: 0.95, b: 0.9 });
    const phaseTint = e.phase >= (e.phases || 2) ? [1, 0.35, 0.3] : null;
    setTint(view, phaseTint || [1, 1, 1], phaseTint ? 0.25 + Math.sin(game.time * 6) * 0.1 : 0);
  }

  function syncAllyHero(game, dt, al, view) {
    const a = view.anim;
    view.root.position.set(al.x, 0, al.z);
    view.root.rotation.y = al.face;
    const hero = game.hero;
    if (al.state === 'attack') a.play(al.def.ranged ? 'Spellcast_Shoot' : 'Dualwield_Melee_Attack_Slice', { loop: true, timeScale: 1.8 });
    else if (al.state === 'move') a.play('Running_A', { loop: true });
    else a.play(hero.clips.idle, { loop: true });
    a.update(dt);
    const t = al.def.tint || [0.5, 0.6, 1];
    setTint(view, t, 0.55);
    setFlash(view, 0.25 + Math.sin(game.time * 8 + al.uid) * 0.08, { r: t[0], g: t[1], b: t[2] });
  }

  return {
    units, spawn, remove, handWorld,
    sync(game, dt) {
      const seen = new Set(['hero']);
      const hv = units.get('hero');
      if (!hv) spawn('hero', game.hero.model, { skin: game.meta?.skin || 0 });
      else syncHero(game, dt, hv);
      for (const e of game.bosses) {
        const key = `boss${e.uid}`; seen.add(key);
        const v = units.get(key);
        if (!v) spawn(key, e.model, { scale: e.scale });
        else syncBoss(game, dt, e, v);
      }
      for (const al of game.allies) {
        if (!al.hero) continue;
        const key = `ally${al.uid}`; seen.add(key);
        const v = units.get(key);
        if (!v) spawn(key, al.model, { scale: 1, shadow: false });
        else syncAllyHero(game, dt, al, v);
      }
      for (const key of [...units.keys()]) if (!seen.has(key)) remove(key);
    },
    hero: () => units.get('hero'),
    bossView: (uid) => units.get(`boss${uid}`),
    reset() { for (const key of [...units.keys()]) if (key !== 'hero') remove(key); },
    swapHero() { remove('hero'); },
  };
}
