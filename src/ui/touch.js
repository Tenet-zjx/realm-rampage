import { h } from './dom.js';
import { SKILL } from '../game/content/skills.js';

// Mobile controls: floating joystick on the left half, action cluster on the right.
export function createTouch(root, input) {
  const el = h('div', { id: 'touch' });
  el.innerHTML = `<div class="zone"></div><div class="stick hidden"><div class="knob"></div></div>
    <button class="tb atk" data-a="light">攻</button><button class="tb mid" data-a="heavy">蓄</button><button class="tb mid" data-a="dodge">闪</button>
    <button class="tb mid musou" data-a="musou">双</button>
    <button class="tb sm sk" data-a="skill0">1</button><button class="tb sm sk" data-a="skill1">2</button><button class="tb sm sk" data-a="skill2">3</button><button class="tb sm sk" data-a="skill3">4</button>
    <button class="tb sm" data-a="item0">装</button><button class="tb sm" data-a="belt0">药</button>`;
  root.append(el);
  const stick = el.querySelector('.stick'), knob = el.querySelector('.knob'), zone = el.querySelector('.zone');
  let sid = null, ox = 0, oy = 0;
  zone.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; sid = t.identifier; ox = t.clientX; oy = t.clientY; stick.classList.remove('hidden'); stick.style.left = `${ox - 65}px`; stick.style.top = `${oy - 65}px`; input.touch.active = true; e.preventDefault(); }, { passive: false });
  zone.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === sid) { let dx = t.clientX - ox, dy = t.clientY - oy; const d = Math.hypot(dx, dy), m = 55; if (d > m) { dx *= m / d; dy *= m / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; input.touch.x = dx / m; input.touch.z = dy / m; } e.preventDefault(); }, { passive: false });
  const end = (e) => { for (const t of e.changedTouches) if (t.identifier === sid) { sid = null; input.touch.active = false; input.touch.x = 0; input.touch.z = 0; knob.style.transform = ''; stick.classList.add('hidden'); } };
  zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
  const repeat = new Map();
  el.querySelectorAll('.tb').forEach((b) => {
    const a = b.dataset.a;
    b.addEventListener('touchstart', (e) => { e.preventDefault(); b.classList.add('down'); input.press(a); if (a === 'light') repeat.set(a, setInterval(() => input.press('light'), 180)); }, { passive: false });
    const up = (e) => { e.preventDefault(); b.classList.remove('down'); clearInterval(repeat.get(a)); repeat.delete(a); };
    b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
  });
  function layout() {
    const W = window.innerWidth, H = window.innerHeight, k = Math.min(1, Math.max(0.62, (H - 40) / 330)), br = 18, bb = 14;
    el.querySelectorAll('.tb').forEach((b) => { b.style.transform = `scale(${k})`; b.style.transformOrigin = 'top left'; });
    const place = (sel, x, y) => { const n = el.querySelector(sel); n.style.left = `${x}px`; n.style.top = `${y}px`; };
    const ax = W - br - 86 * k, ay = H - bb - 86 * k;
    place('[data-a=light]', ax, ay);
    place('[data-a=heavy]', ax - 74 * k, ay + 28 * k); place('[data-a=dodge]', ax + 14 * k, ay - 70 * k); place('[data-a=musou]', ax - 74 * k, ay - 46 * k);
    const sk = el.querySelectorAll('.sk'); const pos = [[-150, 44], [-142, -24], [-108, -88], [-44, -128]];
    sk.forEach((b, i) => { b.style.left = `${ax + pos[i][0] * k}px`; b.style.top = `${ay + pos[i][1] * k}px`; });
    place('[data-a=item0]', ax + 34 * k, ay - 128 * k); place('[data-a=belt0]', ax - 196 * k, ay - 40 * k);
  }
  layout(); window.addEventListener('resize', layout);
  return {
    el,
    update(game) {
      el.querySelector('.musou').classList.toggle('ready', game.player.musou >= 100);
      el.querySelectorAll('.sk').forEach((b, i) => { const id = game.skills.slots[i]; const o = id && game.skills.owned.get(id); b.textContent = id ? SKILL[id].glyph || SKILL[id].name[0] : '·'; if (o) { const k = o.cd > 0 && o.max ? o.cd / o.max : 0; b.style.background = k > 0 ? `conic-gradient(rgba(0,0,0,0.75) ${k * 100}%, rgba(20,16,30,0.6) 0)` : ''; } });
    },
    setVisible(v) { el.style.display = v ? '' : 'none'; },
  };
}
