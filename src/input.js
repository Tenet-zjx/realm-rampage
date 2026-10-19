// Keyboard / mouse / touch input -> per-frame snapshot { move, aim, pressed{...} } with edge-triggered presses.
const KEYMAP = {
  KeyJ: 'light', KeyK: 'heavy', Space: 'dodge', KeyL: 'musou', ShiftLeft: 'dodge', ShiftRight: 'dodge',
  KeyU: 'skill0', KeyI: 'skill1', KeyO: 'skill2', KeyP: 'skill3', KeyY: 'skill4', Digit1: 'skill0', Digit2: 'skill1', Digit3: 'skill2', Digit4: 'skill3', Digit5: 'skill4',
  KeyQ: 'skill0', KeyE: 'skill1', KeyR: 'skill2', KeyF: 'skill3',
  KeyZ: 'item0', KeyX: 'item1', KeyC: 'item2', Digit6: 'belt0', Digit7: 'belt1', Digit8: 'belt2', Digit9: 'belt3',
  KeyB: 'shop', Escape: 'pause', Tab: 'stats', KeyM: 'map',
};

export function createInput(canvas, { unproject } = {}) {
  const held = new Set();
  let pressed = {};
  const touch = { x: 0, z: 0, active: false };
  let mouse = { x: 0, y: 0, lastMove: -1e9, inside: false };
  const listeners = new Set();
  const press = (action) => { pressed[action] = true; for (const l of listeners) l(action); };

  window.addEventListener('keydown', (e) => {
    if (e.target?.tagName === 'INPUT') return;
    const a = KEYMAP[e.code];
    if (!a) return;
    if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    if (!e.repeat) press(a);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('mousemove', (e) => { mouse = { x: e.clientX, y: e.clientY, lastMove: performance.now(), inside: true }; });
  canvas.addEventListener('mouseleave', () => { mouse.inside = false; });
  canvas.addEventListener('mousedown', (e) => { mouse.lastMove = performance.now(); mouse.x = e.clientX; mouse.y = e.clientY; if (e.button === 0) press('light'); if (e.button === 2) press('heavy'); if (e.button === 1) press('dodge'); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

  return {
    press, touch,
    onPress(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    useMouseAim: true,
    snapshot() {
      let x = 0, z = 0;
      if (held.has('KeyW') || held.has('ArrowUp')) z -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) z += 1;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      if (touch.active) { x = touch.x; z = touch.z; }
      const len = Math.hypot(x, z);
      if (len > 1) { x /= len; z /= len; }
      let aim = null;
      if (this.useMouseAim && mouse.inside && performance.now() - mouse.lastMove < 2500 && unproject) aim = unproject(mouse.x, mouse.y);
      const snap = { move: { x, z }, aim, pressed };
      pressed = {};
      return snap;
    },
    clear() { pressed = {}; held.clear(); },
    held: (a) => [...held].some((code) => KEYMAP[code] === a),
  };
}
