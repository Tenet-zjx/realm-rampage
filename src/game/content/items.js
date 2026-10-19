// In-run items (DOTA2-style shop + auto-crafting), neutral relics, runes and out-of-run meta shop items.
// All names are original. `stats` use the shared stat keys from game/stats.js; `active` uses skill actions.
const C = (id, name, cost, rarity, stats, glyph, cat) => ({ id, name, cost, rarity, stats, glyph, cat, type: 'component' });

export const COMPONENTS = [
  C('c_iron_sword', '铁剑', 300, 'common', { atkFlat: 8 }, '剑', 'attack'),
  C('c_broadsword', '阔剑', 750, 'uncommon', { atkFlat: 16 }, '阔', 'attack'),
  C('c_mithril', '秘银大剑', 1400, 'rare', { atkFlat: 26 }, '银', 'attack'),
  C('c_hatchet', '战斧头', 450, 'common', { atkFlat: 6, atkSpeed: 0.05 }, '斧', 'attack'),
  C('c_gloves', '迅捷手套', 450, 'common', { atkSpeed: 0.12 }, '套', 'attack'),
  C('c_blade_joy', '欢欣之刃', 900, 'uncommon', { crit: 0.06 }, '欢', 'attack'),
  C('c_vamp_mask', '吸血面具', 600, 'common', { lifesteal: 0.04 }, '面', 'attack'),
  C('c_demon_edge', '恶魔刀锋', 2000, 'mythical', { atkFlat: 40 }, '魔', 'attack'),
  C('c_relic', '圣者遗物', 2400, 'mythical', { atkFlat: 46, skillDmg: 0.06 }, '遗', 'attack'),
  C('c_str_belt', '力量腰带', 450, 'common', { hpFlat: 120, atkFlat: 3 }, '带', 'defense'),
  C('c_chainmail', '锁子甲', 550, 'common', { def: 7 }, '锁', 'defense'),
  C('c_plate', '板甲', 1300, 'rare', { def: 14 }, '甲', 'defense'),
  C('c_ring_protect', '护卫指环', 350, 'common', { def: 3, regenPct: 0.001 }, '戒', 'defense'),
  C('c_vitality_gem', '生命宝石', 1100, 'uncommon', { hpFlat: 280 }, '命', 'defense'),
  C('c_vit_orb', '活力之球', 600, 'common', { hpFlat: 120, regenPct: 0.0015 }, '活', 'defense'),
  C('c_cloak', '抗魔斗篷', 550, 'common', { dmgReduction: 0.05 }, '篷', 'defense'),
  C('c_buckler', '圆盾', 500, 'common', { block: 0.05, def: 2 }, '盾', 'defense'),
  C('c_ring_health', '回复指环', 700, 'uncommon', { regenPct: 0.0035 }, '复', 'defense'),
  C('c_robe', '法师长袍', 650, 'common', { skillDmg: 0.08 }, '袍', 'magic'),
  C('c_int_cloak', '智力斗篷', 450, 'common', { skillDmg: 0.05, cdr: 0.02 }, '智', 'magic'),
  C('c_energy_orb', '能量之球', 1000, 'uncommon', { cdr: 0.05, musouGain: 0.1 }, '能', 'magic'),
  C('c_crystal', '魔晶', 900, 'uncommon', { skillDmg: 0.05, area: 0.06 }, '晶', 'magic'),
  C('c_ghost_staff', '幽魂法杖', 700, 'uncommon', { area: 0.08 }, '杖', 'magic'),
  C('c_point_booster', '能量增幅器', 1200, 'uncommon', { hpFlat: 200, cdr: 0.03 }, '增', 'magic'),
  C('c_elven_band', '精灵布带', 450, 'common', { atkSpeed: 0.05, speedMult: 0.03 }, '灵', 'utility'),
  C('c_agi_slippers', '敏捷便鞋', 450, 'common', { crit: 0.03, speedMult: 0.03 }, '便', 'utility'),
  C('c_boots', '速度之靴', 500, 'common', { speedMult: 0.1 }, '靴', 'utility'),
  C('c_crown', '秘法王冠', 450, 'common', { atkFlat: 3, hpFlat: 50, cdr: 0.015 }, '冠', 'utility'),
  C('c_lucky_coin', '幸运币', 400, 'common', { luck: 6, goldGain: 0.06 }, '币', 'utility'),
  C('c_lodestone', '磁石', 300, 'common', { pickup: 0.3 }, '磁', 'utility'),
];

const R = (id, name, rarity, parts, recipe, stats, o = {}) => ({ id, name, rarity, parts, recipe, stats, type: 'crafted', ...o });
export const CRAFTED = [
  R('i_cleaver', '裂地战斧', 'rare', ['c_hatchet', 'c_broadsword', 'c_ring_health'], 300, { atkFlat: 12, regenPct: 0.002 }, { glyph: '裂', cat: 'attack', desc: '普攻与蓄力技对目标周围 150° 造成 35% 分裂伤害。', procs: [{ id: 'cleave', pct: 0.35, r: 3.6 }], upgrade: 'a_worldsplitter' }),
  R('i_frenzy_blade', '狂暴之刃', 'legendary', ['c_blade_joy', 'c_demon_edge'], 900, { atkFlat: 12, crit: 0.12, critDmg: 0.45 }, { glyph: '狂', cat: 'attack', desc: '大幅提升暴击。', upgrade: 'a_godslayer' }),
  R('i_crusher', '碎甲重锤', 'rare', ['c_mithril', 'c_iron_sword'], 400, { atkFlat: 20 }, { glyph: '碎', cat: 'attack', desc: '命中使敌人易伤 4%，可叠 5 层，持续 5 秒。', procs: [{ id: 'armorBreak', per: 0.04, max: 5, dur: 5 }] }),
  R('i_thunder', '雷鸣双刃', 'mythical', ['c_gloves', 'c_mithril'], 600, { atkSpeed: 0.08, atkFlat: 10 }, { glyph: '鸣', cat: 'attack', desc: '命中 25% 概率释放 4 跳连锁闪电（60% 攻击）。', procs: [{ id: 'chainOnHit', chance: 0.25, jumps: 4, dmg: 0.6 }], upgrade: 'a_thunder_grip' }),
  R('i_bloodfang', '噬血獠牙', 'rare', ['c_vamp_mask', 'c_str_belt'], 400, { lifesteal: 0.06, hpFlat: 60, atkFlat: 4 }, { glyph: '獠', cat: 'attack', desc: '主动·血怒：5 秒内吸血 +25%。', active: { cd: 30, act: { do: 'buff', dur: 5, stats: { lifesteal: 0.25 }, vfx: 'bloodRage' } }, upgrade: 'a_satan' }),
  R('i_unyield', '不屈护符', 'legendary', ['c_str_belt', 'c_plate'], 1000, { hpFlat: 150, def: 6 }, { glyph: '屈', cat: 'defense', desc: '主动·不屈：6 秒内免疫控制并减伤 50%。', active: { cd: 50, act: { do: 'buff', dur: 6, stats: { ccImmune: 1, dmgReduction: 0.5 }, vfx: 'goldenAura' } }, upgrade: 'a_titan_ward' }),
  R('i_thorn_mail', '荆棘铠甲', 'rare', ['c_chainmail', 'c_broadsword'], 500, { def: 8, atkFlat: 10, thorns: 0.25 }, { glyph: '棘', cat: 'defense', desc: '反弹 25% 受到伤害。主动：4 秒内反弹 100%。', active: { cd: 25, act: { do: 'buff', dur: 4, stats: { thorns: 1 }, vfx: 'thornShell' } } }),
  R('i_aegis', '永恒之盾', 'mythical', ['c_vitality_gem', 'c_buckler', 'c_ring_health'], 300, { hpFlat: 250, block: 0.12, regenPct: 0.003 }, { glyph: '恒', cat: 'defense', desc: '高额格挡与回复。', upgrade: 'a_crimson' }),
  R('i_codex', '奥术法典', 'rare', ['c_robe', 'c_int_cloak'], 600, { skillDmg: 0.18, cdr: 0.04 }, { glyph: '典', cat: 'magic', desc: '技能伤害大幅提升。', upgrade: 'a_astral_codex' }),
  R('i_void_staff', '虚空法杖', 'mythical', ['c_energy_orb', 'c_crystal', 'c_robe'], 0, { cdr: 0.15, skillDmg: 0.08, skillLifesteal: 0.06 }, { glyph: '虚', cat: 'magic', desc: '冷却缩减与技能吸血。' }),
  R('i_refresher', '刷新宝球', 'legendary', ['c_energy_orb', 'c_energy_orb'], 1600, { cdr: 0.08, regenPct: 0.002 }, { glyph: '刷', cat: 'magic', desc: '主动·刷新：立刻重置所有技能与装备冷却。', active: { cd: 70, special: 'refresh' } }),
  R('i_blink', '闪烁宝珠', 'uncommon', ['c_lodestone', 'c_elven_band'], 600, { atkSpeed: 0.04 }, { glyph: '闪', cat: 'utility', desc: '主动·闪烁：向前方瞬移 10 米。', active: { cd: 9, act: { do: 'blink', range: 10, forward: true, vfx: 'blink' } }, upgrade: 'a_swift_heart' }),
  R('i_wind_boots', '疾风战靴', 'rare', ['c_boots', 'c_elven_band'], 300, { speedMult: 0.15, atkSpeed: 0.08 }, { glyph: '疾', cat: 'utility', desc: '主动·疾风：3 秒内移速 +35%。', active: { cd: 18, act: { do: 'buff', dur: 3, stats: { speedMult: 0.35 }, vfx: 'windTrail' } } }),
  R('i_phase_boots', '相位战靴', 'uncommon', ['c_boots', 'c_chainmail'], 0, { speedMult: 0.12, def: 5 }, { glyph: '相', cat: 'utility', desc: '主动·相位：向前冲刺 6 米，穿过敌人造成伤害。', active: { cd: 12, act: { do: 'dash', length: 6, width: 2, dmg: 1.2, invuln: true, vfx: 'phaseDash' } } }),
  R('i_radiance', '圣辉之冠', 'legendary', ['c_relic', 'c_crown'], 800, { atkFlat: 12, hpFlat: 60 }, { glyph: '辉', cat: 'attack', desc: '灼烧 4 米内敌人，每秒 45% 攻击。', procs: [{ id: 'burnAura', r: 4, dps: 0.45 }], upgrade: 'a_sun_crown' }),
  R('i_midas', '炼金护符', 'rare', ['c_lucky_coin', 'c_gloves'], 900, { goldGain: 0.2, atkSpeed: 0.05 }, { glyph: '金', cat: 'utility', desc: '主动·点金：将最近的普通敌人化为 120 金币与经验。', active: { cd: 40, special: 'transmute', gold: 120 } }),
  R('i_vanguard', '先锋盾', 'uncommon', ['c_vitality_gem', 'c_ring_health'], 0, { hpFlat: 300, block: 0.06 }, { glyph: '锋', cat: 'defense', desc: '生命与格挡。' }),
  R('i_heart', '巨人之心', 'legendary', ['c_vitality_gem', 'c_vitality_gem', 'c_plate'], 1000, { hpFlat: 950, regenPct: 0.008 }, { glyph: '心', cat: 'defense', desc: '海量生命与回复。', upgrade: 'a_titan_heart' }),
  R('i_winter_eye', '凛冬之眼', 'mythical', ['c_vit_orb', 'c_int_cloak', 'c_agi_slippers', 'c_point_booster'], 0, { hpFlat: 240, skillDmg: 0.05, crit: 0.03 }, { glyph: '凛', cat: 'magic', desc: '攻击使敌人减速 1.5 秒。', procs: [{ id: 'chillOnHit', dur: 1.5 }], upgrade: 'a_eternal_winter' }),
  R('i_butterfly', '蝶翼', 'legendary', ['c_agi_slippers', 'c_blade_joy', 'c_elven_band'], 700, { evasion: 0.18, atkSpeed: 0.25, crit: 0.04 }, { glyph: '蝶', cat: 'utility', desc: '18% 闪避与大量攻速。' }),
  R('i_monkey', '金纹战棍', 'mythical', ['c_hatchet', 'c_demon_edge'], 400, { atkFlat: 22, atkSpeed: 0.1 }, { glyph: '棍', cat: 'attack', desc: '命中 35% 概率追加 70% 攻击的金纹打击。', procs: [{ id: 'bonusStrike', chance: 0.35, dmg: 0.7 }] }),
  R('i_sange', '散华', 'uncommon', ['c_str_belt', 'c_hatchet'], 400, { hpFlat: 120, atkFlat: 6 }, { glyph: '散', cat: 'attack', desc: '命中 20% 概率使敌人减速。', procs: [{ id: 'maim', chance: 0.2, dur: 1.5 }] }),
  R('i_yasha', '夜叉', 'uncommon', ['c_agi_slippers', 'c_gloves'], 400, { atkSpeed: 0.12, speedMult: 0.06, crit: 0.02 }, { glyph: '夜', cat: 'attack', desc: '攻速与移速。' }),
  R('i_sange_yasha', '散夜对剑', 'legendary', ['i_sange', 'i_yasha'], 0, { hpFlat: 200, atkFlat: 12, atkSpeed: 0.18, speedMult: 0.1 }, { glyph: '对', cat: 'attack', desc: '散华与夜叉合璧，命中 30% 概率减速。', procs: [{ id: 'maim', chance: 0.3, dur: 2 }] }),
  R('i_mirror_ward', '镜光法球', 'mythical', ['c_ring_protect', 'c_energy_orb', 'c_point_booster'], 600, { cdr: 0.05, def: 4 }, { glyph: '镜', cat: 'defense', desc: '每 12 秒抵挡一次伤害。', procs: [{ id: 'spellShield', every: 12 }] }),
  R('i_frost_relic', '寒霜神器', 'legendary', ['c_plate', 'c_robe'], 800, { def: 14, skillDmg: 0.06 }, { glyph: '霜', cat: 'defense', desc: '主动·寒潮：冻结 8 米内敌人 1.5 秒，造成 200% 攻击伤害。', active: { cd: 30, act: { do: 'strike', at: 'self', area: { shape: 'circle', r: 8 }, dmg: 2, status: { freeze: 1.5 }, vfx: 'frostNova', tags: ['frost'] } } }),
  R('i_dragon_lance', '龙息长枪', 'rare', ['c_int_cloak', 'c_robe'], 1000, { skillDmg: 0.08 }, { glyph: '龙', cat: 'magic', desc: '主动·龙息：向最近敌人射出贯穿光束，造成 800% 攻击伤害。', active: { cd: 18, act: { do: 'strike', at: 'aimLine', area: { shape: 'line', length: 14, width: 1.6 }, dmg: 8, vfx: 'laser', tags: ['arcane'] } } }),
  R('i_cyclone', '风暴权杖', 'uncommon', ['c_int_cloak', 'c_elven_band'], 400, { speedMult: 0.06, skillDmg: 0.04 }, { glyph: '旋', cat: 'magic', desc: '主动·龙卷：在前方卷起敌人 2.5 秒。', active: { cd: 22, act: { do: 'strike', at: 'forward', offset: 5, area: { shape: 'circle', r: 4 }, dmg: 0.6, launch: 9, stun: 2.5, vfx: 'tornado' } } }),
  R('i_orchid', '紫怨', 'rare', ['c_int_cloak', 'c_gloves', 'c_crystal'], 0, { atkSpeed: 0.1, skillDmg: 0.06 }, { glyph: '怨', cat: 'magic', desc: '主动·沉默：使最强的敌人沉默 5 秒并受到伤害 +30%。', active: { cd: 18, act: { do: 'mark', count: 1, range: 14, strongest: true, dur: 5, dps: 0, silence: true, vulnerable: 0.3, vfx: 'huntMark' } }, upgrade: 'a_bloodthorn' }),
  R('i_rod', '束缚之杖', 'uncommon', ['c_robe', 'c_vit_orb'], 300, { hpFlat: 100, skillDmg: 0.05 }, { glyph: '缚', cat: 'magic', desc: '主动·束缚：定身目标区域敌人 2 秒。', active: { cd: 18, act: { do: 'strike', at: 'target', range: 12, area: { shape: 'circle', r: 4 }, dmg: 0.5, status: { root: 2 }, vfx: 'roots' } } }),
  R('i_glimmer', '微光披风', 'rare', ['c_cloak', 'c_ring_protect'], 500, { dmgReduction: 0.06, def: 3 }, { glyph: '微', cat: 'defense', desc: '主动·微光：隐身 2.5 秒并减伤 30%。', active: { cd: 20, act: { do: 'buff', dur: 2.5, stealth: true, stats: { dmgReduction: 0.3 }, vfx: 'smoke' } } }),
  R('i_urn', '灵魂之瓮', 'uncommon', ['c_ring_health', 'c_crown'], 200, { regenPct: 0.002 }, { glyph: '瓮', cat: 'defense', desc: '主动·灵魂治疗：4 秒内回复 15% 生命。', active: { cd: 15, act: { do: 'buff', dur: 4, healOverTime: 0.15, vfx: 'healAura' } } }),
  R('i_pipe', '洞察烟斗', 'mythical', ['c_cloak', 'c_ring_health', 'c_ring_protect'], 600, { dmgReduction: 0.12, regenPct: 0.003 }, { glyph: '斗', cat: 'defense', desc: '主动·屏障：获得 30% 最大生命的护盾。', active: { cd: 40, act: { do: 'buff', dur: 6, shield: 0.3, vfx: 'shieldBubble' } } }),
];

const ART = (id, name, rarity, parts, recipe, stats, o) => R(id, name, rarity, parts, recipe, stats, { artifact: true, ...o });
export const ARTIFACTS = [
  ART('a_worldsplitter', '灭世巨斧', 'immortal', ['i_cleaver', 'c_relic'], 1200, { atkFlat: 50, regenPct: 0.004 }, { glyph: '灭', cat: 'attack', desc: '分裂伤害 65%，每第 6 次命中引发地裂（4 米，250% 攻击）。', procs: [{ id: 'cleave', pct: 0.65, r: 4.5 }, { id: 'nthQuake', n: 6, r: 4, dmg: 2.5 }] }),
  ART('a_godslayer', '弑神之刃', 'immortal', ['i_frenzy_blade', 'c_demon_edge'], 1500, { atkFlat: 45, crit: 0.2, critDmg: 0.8 }, { glyph: '弑', cat: 'attack', desc: '极致暴击：暴击率 +20%，暴击伤害 +80%。' }),
  ART('a_thunder_grip', '雷神之握', 'ancient', ['i_thunder', 'c_point_booster'], 1000, { atkSpeed: 0.15, atkFlat: 20, hpFlat: 150 }, { glyph: '握', cat: 'attack', desc: '35% 概率 6 跳连锁闪电。主动·静电护盾：8 秒内受击时电击攻击者。', procs: [{ id: 'chainOnHit', chance: 0.35, jumps: 6, dmg: 0.8 }], active: { cd: 30, act: { do: 'buff', dur: 8, staticShield: 1.2, vfx: 'staticPulse' } } }),
  ART('a_satan', '魔血狂魂', 'ancient', ['i_bloodfang', 'c_demon_edge'], 1100, { lifesteal: 0.14, atkFlat: 30, hpFlat: 120 }, { glyph: '魂', cat: 'attack', desc: '主动·邪血：6 秒内吸血 +80%。', active: { cd: 30, act: { do: 'buff', dur: 6, stats: { lifesteal: 0.8 }, vfx: 'bloodRage' } } }),
  ART('a_titan_ward', '泰坦圣印', 'immortal', ['i_unyield', 'c_relic'], 1500, { hpFlat: 300, def: 15, atkFlat: 30 }, { glyph: '印', cat: 'defense', desc: '主动·圣印：8 秒免疫控制、减伤 60% 并反弹 50% 伤害。', active: { cd: 45, act: { do: 'buff', dur: 8, stats: { ccImmune: 1, dmgReduction: 0.6, thorns: 0.5 }, vfx: 'goldenAura' } } }),
  ART('a_crimson', '赤红壁垒', 'ancient', ['i_aegis', 'c_plate'], 900, { hpFlat: 350, block: 0.2, def: 12, regenPct: 0.004 }, { glyph: '赤', cat: 'defense', desc: '主动·赤红：获得 25% 最大生命护盾。', active: { cd: 30, act: { do: 'buff', dur: 6, shield: 0.25, vfx: 'shieldBubble' } } }),
  ART('a_astral_codex', '星界法典', 'immortal', ['i_codex', 'c_relic'], 1300, { skillDmg: 0.4, cdr: 0.1, atkFlat: 20 }, { glyph: '星', cat: 'magic', desc: '技能伤害 +40%，主动技能 10% 概率再次释放。', procs: [{ id: 'echo', delay: 0.4, chance: 0.1 }] }),
  ART('a_swift_heart', '迅捷之心', 'ancient', ['i_blink', 'c_blade_joy'], 1200, { atkSpeed: 0.15, crit: 0.08, speedMult: 0.08 }, { glyph: '迅', cat: 'utility', desc: '主动·迅闪：瞬移 12 米，之后 2 次攻击必定暴击。', active: { cd: 5, act: { do: 'blink', range: 12, forward: true, vfx: 'blink', grantCrits: 2 } } }),
  ART('a_sun_crown', '烈阳王冠', 'immortal', ['i_radiance', 'c_vitality_gem'], 1500, { atkFlat: 30, hpFlat: 300 }, { glyph: '阳', cat: 'attack', desc: '灼烧 6 米内敌人，每秒 90% 攻击，并使其 20% 概率攻击落空。', procs: [{ id: 'burnAura', r: 6, dps: 0.9, blind: 0.2 }] }),
  ART('a_titan_heart', '泰坦之心', 'immortal', ['i_heart', 'c_vitality_gem'], 1600, { hpFlat: 1800, regenPct: 0.015 }, { glyph: '泰', cat: 'defense', desc: '传说中的不灭之心。' }),
  ART('a_eternal_winter', '永冬冰冠', 'ancient', ['i_winter_eye', 'c_crystal'], 1200, { hpFlat: 360, skillDmg: 0.12, crit: 0.05 }, { glyph: '冬', cat: 'magic', desc: '命中 10% 概率冰冻 1 秒，并使周围敌人持续减速。', procs: [{ id: 'freezeOnHit', chance: 0.1, dur: 1 }, { id: 'chillAura', r: 5 }] }),
  ART('a_bloodthorn', '血棘', 'ancient', ['i_orchid', 'c_blade_joy'], 900, { atkSpeed: 0.15, skillDmg: 0.1, crit: 0.08 }, { glyph: '血', cat: 'magic', desc: '主动·血棘：沉默最强敌人 6 秒，其受到伤害 +50% 且必被暴击。', active: { cd: 18, act: { do: 'mark', count: 1, range: 15, strongest: true, dur: 6, dps: 0, silence: true, vulnerable: 0.5, alwaysCrit: true, vfx: 'huntMark' } } }),
];

const K = (id, name, cost, glyph, desc, use) => ({ id, name, cost, glyph, desc, use, type: 'consumable', rarity: 'common', stack: 9 });
export const CONSUMABLES = [
  K('k_heal_potion', '治疗药剂', 150, '药', '立即回复 35% 生命。', { heal: 0.35 }),
  K('k_big_heal', '大治疗药剂', 350, '愈', '立即回复 70% 生命，并在 5 秒内额外回复 20%。', { heal: 0.7, hot: 0.2, dur: 5 }),
  K('k_musou_potion', '无双药剂', 400, '双', '无双槽 +60。', { musou: 60 }),
  K('k_rage_potion', '狂暴药剂', 300, '暴', '10 秒内攻击 +40%。', { buff: { dur: 10, stats: { atkMult: 0.4 } } }),
  K('k_shield_potion', '护盾药剂', 300, '护', '获得 30% 最大生命的护盾，持续 8 秒。', { buff: { dur: 8, shield: 0.3 } }),
  K('k_speed_potion', '疾风药剂', 200, '风', '10 秒内移速 +40%。', { buff: { dur: 10, stats: { speedMult: 0.4 } } }),
  K('k_reroll_scroll', '重铸卷轴', 250, '铸', '重抽次数 +1。', { rerolls: 1 }),
  K('k_banish_scroll', '放逐卷轴', 250, '逐', '放逐次数 +1。', { banishes: 1 }),
  K('k_tp_scroll', '传送卷轴', 200, '传', '瞬移到当前目标附近或远离敌群的安全处。', { teleport: true }),
  K('k_bomb', '炸弹', 250, '炸', '向前方投掷炸弹，4 米内造成 500% 攻击伤害。', { act: { do: 'strike', at: 'forward', offset: 5, delay: 0.5, area: { shape: 'circle', r: 4 }, dmg: 5, kb: 6, launch: 5, vfx: 'meteor', tags: ['fire'] } }),
  K('k_decoy', '诱饵', 200, '饵', '放置诱饵 6 秒，吸引附近敌人攻击。', { act: { do: 'summon', unit: 'ally_decoy', count: 1, dur: 6, power: 1 } }),
  K('k_xp_tome', '经验之书', 500, '书', '立即获得升到下一级所需的经验。', { levelUp: 1 }),
  K('k_clarity', '清明药水', 300, '清', '所有技能冷却减少 50%。', { cooldownCut: 0.5 }),
  K('k_holy_water', '圣水', 250, '圣', '清除负面状态并无敌 3 秒。', { buff: { dur: 3, invuln: true } }),
  K('k_lucky_dice', '幸运骰子', 400, '骰', '下一次升级的三选一必出稀有及以上。', { luckyDraft: 1 }),
  K('k_tango', '树之祭祀', 120, '祭', '6 秒内每秒回复 2% 生命。', { hot: 0.12, dur: 6 }),
];

const N = (tier, id, name, glyph, desc, stats, procs) => ({ id, name, tier, glyph, desc, stats: stats || {}, procs: procs || [], type: 'neutral', rarity: ['uncommon', 'rare', 'mythical', 'legendary', 'immortal'][tier - 1] });
export const NEUTRALS = [
  N(1, 'n_greed_ring', '贪婪之戒', '贪', '金币获取 +15%。', { goldGain: 0.15 }),
  N(1, 'n_guard_bracer', '守卫者护腕', '腕', '护甲 +6，格挡 +5%。', { def: 6, block: 0.05 }),
  N(1, 'n_nimble_chain', '灵动手链', '链', '攻速 +10%。', { atkSpeed: 0.1 }),
  N(1, 'n_mystic_stone', '秘术石', '秘', '技能冷却 -6%。', { cdr: 0.06 }),
  N(1, 'n_gale_feather', '疾风羽毛', '羽', '移速 +10%。', { speedMult: 0.1 }),
  N(1, 'n_wrath_pendant', '怒火吊坠', '怒', '无双充能 +20%。', { musouGain: 0.2 }),
  N(1, 'n_glow_moss', '微光苔藓', '苔', '每秒回复 0.5% 生命。', { regenPct: 0.005 }),
  N(1, 'n_bone_charm', '碎骨护符', '骨', '击杀 3% 概率回复 5% 生命。', {}, [{ id: 'killHealChance', chance: 0.03, pct: 0.05 }]),
  N(2, 'n_hourglass', '时光沙漏', '沙', '闪避冷却 -30%。', { dodgeCdr: 0.3 }),
  N(2, 'n_bat_fang', '吸血蝠牙', '牙', '吸血 +5%。', { lifesteal: 0.05 }),
  N(2, 'n_ice_shard', '冰晶碎片', '冰', '命中 8% 概率冰冻 0.6 秒。', {}, [{ id: 'freezeOnHit', chance: 0.08, dur: 0.6 }]),
  N(2, 'n_thunder_bell', '雷鸣铃', '铃', '每 5 秒电击附近 3 名敌人（120% 攻击）。', {}, [{ id: 'periodicZap', every: 5, count: 3, dmg: 1.2 }]),
  N(2, 'n_boomerang', '回旋镖', '镖', '投射物 +1。', { projectiles: 1 }),
  N(2, 'n_elf_cloak', '精灵披风', '披', '闪避 +8%。', { evasion: 0.08 }),
  N(2, 'n_war_drum', '战鼓', '鼓', '连击数每 25 层伤害 +2%（上限 10 层）。', { comboDmg: 0.02 }),
  N(2, 'n_lava_heart', '熔岩之心', '熔', '灼烧 3 米内敌人，每秒 25% 攻击。', {}, [{ id: 'burnAura', r: 3, dps: 0.25 }]),
  N(3, 'n_mad_mask', '狂人面具', '狂', '攻速 +30%，受到伤害 +10%。', { atkSpeed: 0.3, dmgTaken: 0.1 }),
  N(3, 'n_sage_eye', '智者之眼', '眼', '经验获取 +20%。', { xpGain: 0.2 }),
  N(3, 'n_seer_crystal', '先知水晶', '先', '幸运 +15。', { luck: 15 }),
  N(3, 'n_undying_bone', '不朽骨片', '朽', '每关一次：受到致命伤害时保留 1 点生命并无敌 1.5 秒。', {}, [{ id: 'stageCheatDeath', dur: 1.5 }]),
  N(3, 'n_shadow_blade', '暗影之刃', '暗', '暴击率 +10%。', { crit: 0.1 }),
  N(3, 'n_spirit_tear', '圣灵之泪', '泪', '受到治疗 +30%，每秒回复 0.4%。', { healPower: 0.3, regenPct: 0.004 }),
  N(3, 'n_giant_belt', '巨人腰带', '巨', '最大生命 +15%。', { hpMult: 0.15, size: 0.05 }),
  N(3, 'n_star_shard', '星辰碎片', '辰', '技能伤害 +15%。', { skillDmg: 0.15 }),
  N(4, 'n_dragon_scale', '龙鳞', '鳞', '受到伤害 -15%。', { dmgReduction: 0.15 }),
  N(4, 'n_storm_eye', '风暴之眼', '暴', '暴击 40% 概率释放 3 跳闪电。', {}, [{ id: 'chainOnCrit', chance: 0.4, jumps: 3, dmg: 0.7 }]),
  N(4, 'n_blood_moon', '血月宝石', '月', '吸血 +10%，生命低于 40% 时攻击 +25%。', { lifesteal: 0.1 }, [{ id: 'lowHpAtk', below: 0.4, atk: 0.25 }]),
  N(4, 'n_arcane_compass', '秘法罗盘', '罗', '范围 +20%。', { area: 0.2 }),
  N(4, 'n_vanguard_horn', '先锋号角', '号', '召唤物伤害与生命 +40%。', { summonPower: 0.4 }),
  N(4, 'n_time_sand', '时之沙', '时', '技能冷却 -15%。', { cdr: 0.15 }),
  N(4, 'n_demon_horn', '魔王之角', '角', '攻击 +25%。', { atkMult: 0.25 }),
  N(4, 'n_angel_feather', '守护天使羽', '天', '每局一次：受到致命伤害时满血复活。', {}, [{ id: 'phoenix', r: 5, dmg: 3, heal: 1 }]),
  N(5, 'n_chaos_orb', '混沌宝珠', '混', '所有伤害 +25%，命中随机附加燃烧/冰冻/眩晕。', { dmgMult: 0.25 }, [{ id: 'chaosProc', chance: 0.12 }]),
  N(5, 'n_divine_sword', '神圣之剑', '圣', '攻击 +60%。', { atkMult: 0.6 }),
  N(5, 'n_endless_blade', '无尽之刃', '尽', '暴击伤害 +100%。', { critDmg: 1.0 }),
  N(5, 'n_eternal_heart', '永恒之心', '恒', '最大生命 +40%，每秒回复 1%。', { hpMult: 0.4, regenPct: 0.01 }),
  N(5, 'n_astral_gate', '星界之门', '门', '技能冷却 -30%。', { cdr: 0.3 }),
  N(5, 'n_apocalypse', '天启之书', '启', '技能伤害 +40%。', { skillDmg: 0.4 }),
  N(5, 'n_godspear', '屠神之矛', '矛', '对精英与 Boss 伤害 +50%。', { vsElite: 0.5 }),
  N(5, 'n_fate_wheel', '命运之轮', '命', '幸运 +40，金币获取翻倍。', { luck: 40, goldGain: 1.0 }),
];

export const RUNES = [
  { id: 'rune_dd', name: '双倍伤害神符', color: '#4aa8ff', glyph: '倍', dur: 12, stats: { dmgMult: 1.0 }, desc: '12 秒内伤害翻倍' },
  { id: 'rune_haste', name: '急速神符', color: '#ff4a4a', glyph: '速', dur: 10, stats: { speedMult: 0.5, atkSpeed: 0.5 }, desc: '10 秒内移速与攻速 +50%' },
  { id: 'rune_illusion', name: '幻象神符', color: '#ffd84a', glyph: '幻', dur: 10, summon: { unit: 'ally_illusion', count: 2 }, desc: '召唤 2 个幻象协同作战' },
  { id: 'rune_invis', name: '隐身神符', color: '#b07aff', glyph: '隐', dur: 8, stealth: true, stats: { speedMult: 0.2 }, desc: '隐身 8 秒，移速 +20%' },
  { id: 'rune_regen', name: '恢复神符', color: '#5aff7a', glyph: '恢', dur: 5, hot: 0.6, desc: '5 秒内回复 60% 生命' },
  { id: 'rune_arcane', name: '奥术神符', color: '#ff5ae0', glyph: '奥', dur: 12, stats: { cdr: 0.4 }, desc: '12 秒内技能冷却 -40%' },
  { id: 'rune_shield', name: '护盾神符', color: '#7affff', glyph: '盾', dur: 10, shield: 0.4, desc: '获得 40% 最大生命护盾' },
  { id: 'rune_bounty', name: '赏金神符', color: '#ffb84a', glyph: '赏', dur: 0, gold: 300, xp: 0.5, desc: '获得 300 金币与半级经验' },
];

// Out-of-run shop (permanent gold). `bring` items are consumed when taken into a run (max 3 per run).
const M = (id, name, cost, glyph, desc, effect, o = {}) => ({ id, name, cost, glyph, desc, effect, type: 'meta', bring: true, ...o });
export const META_ITEMS = [
  M('m_revive_cross', '复活十字章', 900, '复', '本局额外复活 1 次。', { revives: 1 }, { rarity: 'legendary' }),
  M('m_mystery_chest', '开局神秘宝箱', 700, '箱', '开局随机获得 1 个稀有及以上技能。', { startSkill: 'rare' }, { rarity: 'mythical' }),
  M('m_xp_book', '经验之书', 500, '书', '本局经验获取 +50%。', { stats: { xpGain: 0.5 } }, { rarity: 'rare' }),
  M('m_lucky_charm', '幸运符', 500, '幸', '本局幸运 +20。', { stats: { luck: 20 } }, { rarity: 'rare' }),
  M('m_wealth_charm', '财运护符', 500, '财', '本局金币获取 +30%。', { stats: { goldGain: 0.3 } }, { rarity: 'rare' }),
  M('m_faction_stone', '派系召唤石', 800, '派', '开局选择一个派系，获得该派系 1 个技能。', { factionPick: 1 }, { rarity: 'mythical' }),
  M('m_rarity_ticket', '稀有度保底券', 900, '券', '前 3 次三选一至少包含 1 张神话及以上。', { rarityTicket: 3 }, { rarity: 'legendary' }),
  M('m_extra_slot_key', '额外技能槽钥匙', 1200, '钥', '本局主动技能槽 +1（5 个）。', { extraSlot: 1 }, { rarity: 'legendary' }),
  M('m_starter_gold', '军资', 400, '军', '开局携带 1500 局内金币。', { runGold: 1500 }, { rarity: 'uncommon' }),
  M('m_reroll_pack', '重铸礼包', 350, '铸', '本局重抽次数 +5。', { rerolls: 5 }, { rarity: 'uncommon' }),
  M('m_banish_pack', '放逐礼包', 350, '逐', '本局放逐次数 +3。', { banishes: 3 }, { rarity: 'uncommon' }),
  M('m_musou_seal', '无双印记', 450, '印', '开局无双槽全满，本局无双充能 +20%。', { musouFull: true, stats: { musouGain: 0.2 } }, { rarity: 'rare' }),
  M('m_elixir', '体魄灵药', 450, '灵', '本局最大生命 +20%。', { stats: { hpMult: 0.2 } }, { rarity: 'rare' }),
  M('m_war_banner', '战旗', 500, '旗', '本局攻击 +15%。', { stats: { atkMult: 0.15 } }, { rarity: 'rare' }),
  M('m_magnet_charm', '吸金磁石', 250, '磁', '本局拾取范围 +60%。', { stats: { pickup: 0.6 } }, { rarity: 'common' }),
  M('m_neutral_box', '秘宝匣', 700, '匣', '开局获得 1 件二阶中立秘宝。', { neutralTier: 2 }, { rarity: 'mythical' }),
  M('m_recipe_book', '合成秘典', 600, '典', '本局合成卷轴价格 -50%。', { recipeDiscount: 0.5 }, { rarity: 'rare' }),
  M('m_double_draft', '双抉择', 800, '抉', '本局三选一改为四选一。', { draftOptions: 1 }, { rarity: 'legendary' }),
  M('m_evolve_catalyst', '进化催化剂', 1000, '化', '本局技能进化不再需要指定被动。', { freeEvolve: true }, { rarity: 'ancient' }),
  M('m_boss_bane', '屠魔符', 500, '屠', '本局对 Boss 伤害 +25%。', { stats: { vsBoss: 0.25 } }, { rarity: 'rare' }),
];

export const ALL_ITEMS = [...COMPONENTS, ...CRAFTED, ...ARTIFACTS, ...CONSUMABLES, ...NEUTRALS];
export const ITEM = Object.fromEntries([...ALL_ITEMS, ...META_ITEMS, ...RUNES].map((i) => [i.id, i]));

/** Total gold cost of an item including all sub-parts and recipes. */
export function itemTotalCost(id) {
  const it = ITEM[id];
  if (!it) return 0;
  if (it.type === 'component' || it.type === 'consumable') return it.cost;
  return (it.recipe || 0) + it.parts.reduce((s, p) => s + itemTotalCost(p), 0);
}
