// Enemy roster. `model` keys public/assets/models/manifest.json; KayKit-rig models share the baked crowd clips.
// Stats are chapter-1 "normal" difficulty values; director.js scales them by chapter, time and difficulty.
const KK = { idle: 'Idle_Combat', move: 'Walking_D_Skeletons', run: 'Running_C', attack: '1H_Melee_Attack_Chop', hit: 'Hit_A', hit2: 'Hit_B', death: 'Death_C_Skeletons', death2: 'Death_A', spawn: 'Skeletons_Awaken_Floor', air: 'Jump_Idle', cast: 'Spellcast_Shoot', taunt: 'Taunt' };
const OG = { idle: 'Idle', move: 'Walk', run: 'Walk', attack: 'Attack', hit: 'Hit', hit2: 'Hit', death: 'Death', death2: 'Death', spawn: 'Spawn', air: 'Hit', cast: 'Attack', taunt: 'Idle' };

const E = (id, name, model, archetype, o) => ({ id, name, model, archetype, scale: 1, radius: 0.55, mass: 1, xp: 1, gold: 1, def: 0, clips: KK, ...o, clips: { ...(o.rig === 'og' ? OG : KK), ...(o.clips || {}) } });

export const ENEMIES = [
  E('skel_minion', '骷髅兵', 'skel_minion', 'melee', { hp: 34, dmg: 9, speed: 3.0, desc: '最常见的亡骨士兵，成群结队地扑来。',
    attack: { range: 1.7, windup: 0.42, recover: 0.55, cd: 1.6, shape: 'arc', r: 2.0, angle: 100 } }),
  E('skel_warrior', '骷髅战士', 'skel_warrior', 'melee', { hp: 72, dmg: 13, speed: 2.8, def: 4, xp: 2, gold: 2, radius: 0.62, mass: 1.4, desc: '持斧握盾的老兵，更耐打。',
    attack: { range: 1.9, windup: 0.5, recover: 0.6, cd: 1.8, shape: 'arc', r: 2.2, angle: 110 }, clips: { attack: '2H_Melee_Attack_Chop' } }),
  E('skel_archer', '骷髅弩手', 'skel_archer', 'ranged', { hp: 30, dmg: 10, speed: 2.9, xp: 2, gold: 2, desc: '保持距离射出弩箭。',
    attack: { range: 11, keep: 7, windup: 0.6, recover: 0.5, cd: 2.4, projectile: { speed: 15, radius: 0.35, kind: 'enemyBolt' } }, clips: { attack: '1H_Ranged_Shoot' } }),
  E('skel_mage', '骷髅法师', 'skel_mage', 'caster', { hp: 46, dmg: 14, speed: 2.6, xp: 3, gold: 2, desc: '在你脚下召唤暗影法阵，偶尔唤醒更多骷髅。',
    attack: { range: 10, keep: 7, windup: 1.0, recover: 0.6, cd: 3.4, aoe: { r: 2.5, at: 'player', vfx: 'darkCircle' } }, summon: { unit: 'skel_minion', count: 2, cd: 11 }, clips: { attack: 'Spellcast_Shoot', cast: 'Spellcast_Summon' } }),
  E('blood_berserker', '血骨狂战', 'blood_berserker', 'charger', { hp: 130, dmg: 22, speed: 3.3, def: 3, xp: 4, gold: 4, radius: 0.65, mass: 1.6, desc: '双斧狂徒，会锁定你直线冲锋。',
    attack: { range: 1.9, windup: 0.45, recover: 0.6, cd: 1.6, shape: 'arc', r: 2.2, angle: 140 }, charge: { range: 11, windup: 0.8, speed: 15, width: 1.8, cd: 5 }, clips: { attack: 'Dualwield_Melee_Attack_Chop', run: 'Running_A' } }),
  E('frost_wizard', '寒骨巫师', 'frost_wizard', 'caster', { hp: 62, dmg: 13, speed: 2.6, xp: 3, gold: 3, desc: '召唤冰霜法阵，命中会减速。',
    attack: { range: 10, keep: 7, windup: 1.0, recover: 0.6, cd: 3.2, aoe: { r: 2.8, at: 'player', vfx: 'iceCircle', status: { slow: 2 } } }, clips: { attack: 'Spellcast_Shoot' } }),
  E('hellfire_skull', '冥火骷髅', 'hellfire_skull', 'exploder', { hp: 30, dmg: 32, speed: 3.6, xp: 2, gold: 2, desc: '浑身燃火的自爆者，靠近后点燃引信。',
    attack: { range: 2.4, windup: 1.0, cd: 99, explode: { r: 3.0 } }, clips: { run: 'Running_A', attack: 'Taunt' } }),
  E('bone_shieldguard', '骨盾卫', 'bone_shieldguard', 'shield', { hp: 150, dmg: 14, speed: 2.4, def: 10, xp: 4, gold: 4, radius: 0.68, mass: 2.2, desc: '正面格挡 80% 伤害，用蓄力技或技能破防。',
    block: 0.8, attack: { range: 1.9, windup: 0.55, recover: 0.6, cd: 1.9, shape: 'arc', r: 2.2, angle: 100 }, clips: { idle: 'Blocking', move: 'Walking_B', attack: '1H_Melee_Attack_Stab' } }),
  E('bone_giant', '骨巨人', 'bone_giant', 'brute', { hp: 420, dmg: 34, speed: 2.2, def: 8, xp: 10, gold: 10, scale: 1.9, radius: 1.1, mass: 6, desc: '巨大的亡骨重装兵，砸地造成范围冲击。',
    attack: { range: 3.2, windup: 1.0, recover: 0.9, cd: 3, aoe: { r: 3.6, at: 'front', offset: 1.8, vfx: 'slam' } }, clips: { attack: '2H_Melee_Attack_Chop', move: 'Walking_A' } }),
  E('shadow_stalker', '暗影刺客骷髅', 'shadow_stalker', 'assassin', { hp: 72, dmg: 18, speed: 3.6, xp: 4, gold: 4, desc: '会闪烁到你身后发动背刺。',
    attack: { range: 1.8, windup: 0.4, recover: 0.5, cd: 1.5, shape: 'arc', r: 2.0, angle: 120 }, blink: { cd: 6, range: 12 }, clips: { attack: 'Dualwield_Melee_Attack_Stab', run: 'Running_A' } }),
  E('ember_archer', '熔火弩手', 'ember_archer', 'ranged', { hp: 46, dmg: 12, speed: 2.9, xp: 3, gold: 3, desc: '射出燃烧弩矢，命中点燃。',
    attack: { range: 12, keep: 8, windup: 0.6, recover: 0.5, cd: 2.2, projectile: { speed: 16, radius: 0.4, kind: 'fireBolt', status: { burn: 2 } } }, clips: { attack: '1H_Ranged_Shoot' } }),
  E('plague_shaman', '毒雾术士', 'plague_shaman', 'caster', { hp: 72, dmg: 8, speed: 2.5, xp: 4, gold: 3, desc: '在你周围留下持续的毒雾。',
    attack: { range: 10, keep: 7, windup: 0.9, recover: 0.6, cd: 4, cloud: { r: 2.6, dur: 5, tick: 0.5 } }, clips: { attack: 'Spellcast_Raise' } }),
  E('bone_standard', '亡骨旗手', 'bone_standard', 'buffer', { hp: 115, dmg: 10, speed: 2.6, def: 4, xp: 5, gold: 5, desc: '战旗光环使周围亡骨移速与伤害 +25%，优先击杀！',
    aura: { r: 7, speed: 0.25, dmg: 0.25 }, attack: { range: 1.8, windup: 0.5, recover: 0.6, cd: 2, shape: 'arc', r: 2, angle: 100 }, clips: { idle: 'Idle_B', taunt: 'Cheer' } }),
  E('slime', '史莱姆', 'slime', 'splitter', { rig: 'og', hp: 85, dmg: 11, speed: 2.7, xp: 2, gold: 2, radius: 0.8, mass: 1.4, desc: '弹跳的胶质怪，被击败后分裂成两只小史莱姆。',
    split: { count: 2, scale: 0.55, hpMult: 0.3 }, attack: { range: 2.0, windup: 0.55, recover: 0.6, cd: 1.8, shape: 'circle', r: 1.8, offset: 1 } }),
  E('vampire_bat', '吸血蝠', 'vampire_bat', 'flyer', { rig: 'og', hp: 22, dmg: 7, speed: 5.0, xp: 1, gold: 1, radius: 0.5, mass: 0.6, desc: '高速掠食的蝠群，无视地形并吸取生命。',
    attack: { range: 1.6, windup: 0.3, recover: 0.4, cd: 1.3, shape: 'circle', r: 1.4, offset: 0.6, lifesteal: 1 } }),
  E('gargoyle', '石像鬼', 'gargoyle', 'brute', { rig: 'og', hp: 320, dmg: 28, speed: 2.6, def: 12, xp: 8, gold: 8, scale: 1.15, radius: 1.0, mass: 5, desc: '石质躯体极为坚硬，双爪重砸地面。',
    attack: { range: 2.8, windup: 0.9, recover: 0.8, cd: 2.8, aoe: { r: 3.2, at: 'front', offset: 1.5, vfx: 'slam' } } }),
  E('lava_imp', '熔岩小鬼', 'lava_imp', 'melee', { rig: 'og', hp: 28, dmg: 8, speed: 4.6, xp: 1, gold: 1, radius: 0.45, mass: 0.7, desc: '敏捷的熔岩小鬼，抓伤会点燃。',
    attack: { range: 1.5, windup: 0.3, recover: 0.4, cd: 1.2, shape: 'arc', r: 1.7, angle: 110, status: { burn: 2 } } }),
  E('thorn_treant', '荆棘树精', 'thorn_treant', 'caster', { rig: 'og', hp: 400, dmg: 20, speed: 1.9, def: 10, xp: 9, gold: 9, scale: 1.0, radius: 1.0, mass: 6, desc: '缓慢而坚韧，召唤藤蔓缠绕你。',
    attack: { range: 9, keep: 3, windup: 1.1, recover: 0.8, cd: 4, aoe: { r: 3, at: 'player', vfx: 'rootsCircle', status: { root: 1.3 } } } }),
];

// Allied units (summons) reuse enemy models with an ally tint.
export const ALLIES = {
  ally_skeleton: { name: '骷髅仆从', model: 'skel_warrior', hp: 120, dmg: 0.5, speed: 4.2, radius: 0.55, attack: { range: 1.8, cd: 1.0, r: 2, angle: 120 }, clips: KK, tint: [0.35, 1, 0.55] },
  ally_treant: { name: '荆棘树卫', model: 'thorn_treant', hp: 400, dmg: 0.9, speed: 3.2, radius: 0.9, scale: 0.7, attack: { range: 2.4, cd: 1.6, r: 3, angle: 360, status: { root: 0.5 } }, clips: OG, tint: [0.5, 1, 0.4], taunt: 5 },
  ally_gargoyle: { name: '石像守卫', model: 'gargoyle', hp: 900, dmg: 1.4, speed: 3.4, radius: 1.0, scale: 0.95, attack: { range: 2.8, cd: 1.8, r: 3.3, angle: 360, stun: 0.5 }, clips: OG, tint: [1, 0.85, 0.5], taunt: 7 },
  ally_mirror: { name: '星界分身', model: 'mage', hero: true, hp: 300, dmg: 0.6, speed: 6, radius: 0.5, ranged: true, attack: { range: 11, cd: 0.45, projectile: 'star' }, tint: [0.6, 0.5, 1] },
  ally_shadow: { name: '影分身', model: 'rogue', hero: true, hp: 250, dmg: 0.5, speed: 7, radius: 0.5, attack: { range: 2.2, cd: 0.4, r: 2.6, angle: 160 }, tint: [0.4, 0.2, 0.7] },
  ally_illusion: { name: '幻象', model: 'self', hero: true, hp: 400, dmg: 0.4, speed: 6.5, radius: 0.5, attack: { range: 2.4, cd: 0.6, r: 2.8, angle: 150 }, tint: [0.4, 0.7, 1] },
  ally_decoy: { name: '诱饵', model: 'skel_minion', hp: 600, dmg: 0, speed: 0, radius: 0.6, attack: null, clips: KK, tint: [1, 0.9, 0.3], taunt: 9 },
};

// Elite affixes (Diablo style). Hard: 1, Hell: 2–3.
export const AFFIXES = [
  { id: 'berserk', name: '狂暴', color: '#ff4a3a', desc: '移速 +30%，伤害 +25%' },
  { id: 'frozen', name: '冰冻', color: '#7ad8ff', desc: '周期性在你附近生成冰冻法球' },
  { id: 'teleport', name: '传送', color: '#c27aff', desc: '会传送到你身边' },
  { id: 'splitter', name: '分裂', color: '#7aff9a', desc: '死亡时分裂出两个复制体' },
  { id: 'shielded', name: '护盾', color: '#ffe27a', desc: '周期性获得护盾' },
  { id: 'vampiric', name: '吸血', color: '#ff7a9a', desc: '造成伤害时回复生命' },
  { id: 'reflect', name: '反射', color: '#d0d0ff', desc: '反弹 15% 受到的伤害' },
  { id: 'summoner', name: '召唤', color: '#9aff7a', desc: '每 8 秒召唤骷髅兵' },
  { id: 'burning', name: '燃烧大地', color: '#ff9a3a', desc: '行走留下火焰地面' },
  { id: 'chain', name: '雷电链', color: '#7aa8ff', desc: '周期性对你释放预警雷击' },
];
export const AFFIX = Object.fromEntries(AFFIXES.map((a) => [a.id, a]));

// Boss patterns: shapes are telegraphed with the exact hit geometry. `dmg` multiplies boss.dmg.
const pat = (id, name, o) => ({ id, name, weight: 1, cd: 4, windup: 1.1, recover: 0.8, ...o });
export const BOSSES = [
  { id: 'boss_bone_colossus', name: '骨巨人·格鲁姆', title: '第一章首领', model: 'boss_bone_colossus', scale: 2.4, hp: 5200, dmg: 30, speed: 2.6, def: 10, radius: 1.6, kk: true,
    clips: { ...KK, move: 'Walking_A', idle: 'Idle_Combat' },
    patterns: [
      pat('slam', '震地猛击', { clip: '2H_Melee_Attack_Chop', windup: 1.1, shapes: [{ shape: 'circle', at: 'front', offset: 2.6, r: 5.2 }], dmg: 1.4, launch: 6 }),
      pat('sweep', '横扫', { clip: '2H_Melee_Attack_Slice', windup: 0.9, shapes: [{ shape: 'arc', r: 7, angle: 200 }], dmg: 1.1, kb: 6 }),
      pat('charge', '冲锋', { clip: 'Running_A', windup: 0.9, charge: { length: 16, width: 3.2, speed: 22 }, dmg: 1.3, kb: 8 }),
      pat('summon', '亡骨召集', { clip: 'Cheer', windup: 0.8, summon: { unit: 'skel_minion', count: 8 }, cd: 12 }),
      pat('rings', '冲击环', { clip: '2H_Melee_Attack_Chop', windup: 1.0, phase: 2, rings: { count: 3, gap: 0.55, speed: 10, width: 1.4, r: 14 }, dmg: 0.9 }),
    ] },
  { id: 'boss_frost_lich', name: '冰霜巫妖王·维斯瑞克', title: '第二章首领', model: 'boss_frost_lich', scale: 2.2, hp: 6800, dmg: 28, speed: 2.4, def: 8, radius: 1.3, kk: true,
    clips: { ...KK, move: 'Walking_A', idle: 'Idle_Combat', attack: 'Spellcast_Shoot' },
    patterns: [
      pat('nova', '冰霜新星', { clip: 'Spellcast_Raise', windup: 1.1, shapes: [{ shape: 'circle', at: 'self', r: 6.5 }], dmg: 1.2, status: { freeze: 1.2 } }),
      pat('lances', '寒冰长矛', { clip: 'Spellcast_Shoot', windup: 0.8, fan: { count: 9, spread: 80, speed: 16, radius: 0.5, kind: 'iceLance' }, dmg: 0.8, status: { slow: 2 } }),
      pat('blizzard', '暴风雪', { clip: 'Spellcasting', windup: 0.6, rain: { count: 10, r: 2.6, area: 10, around: 'player', delay: 1.1, spread: 0.12 }, dmg: 0.9, status: { slow: 2 } }),
      pat('summon', '寒骨召唤', { clip: 'Spellcast_Summon', windup: 0.8, summon: { unit: 'frost_wizard', count: 3 }, cd: 14 }),
      pat('prison', '冰霜牢笼', { clip: 'Spellcast_Long', windup: 1.4, phase: 2, shapes: [{ shape: 'ring', at: 'player', r: 6, inner: 2.2 }], dmg: 1.4, status: { freeze: 2 } }),
    ] },
  { id: 'boss_lava_golem', name: '熔岩魔像·伊格尼斯', title: '第三章首领', model: 'boss_lava_golem', scale: 1.25, hp: 9200, dmg: 34, speed: 2.2, def: 14, radius: 1.8, og: true,
    clips: { ...OG },
    patterns: [
      pat('slam', '双拳砸地', { clip: 'Attack', windup: 1.15, shapes: [{ shape: 'circle', at: 'front', offset: 2.8, r: 5 }], dmg: 1.5, launch: 7, after: { lava: { r: 3, dur: 4 } } }),
      pat('sweep', '熔岩横扫', { clip: 'Attack2', windup: 1.0, shapes: [{ shape: 'arc', r: 7.5, angle: 240 }], dmg: 1.1, kb: 7, status: { burn: 3 } }),
      pat('meteors', '陨火天降', { clip: 'Cast', windup: 0.7, rain: { count: 12, r: 2.8, area: 12, around: 'player', delay: 1.2, spread: 0.1 }, dmg: 1.0, status: { burn: 3 } }),
      pat('eruption', '地火喷发', { clip: 'Cast', windup: 1.2, phase: 2, lines: { count: 6, length: 16, width: 2.2 }, dmg: 1.3, status: { burn: 3 } }),
    ] },
  { id: 'boss_fallen_knight', name: '堕落骑士·莫德雷克', title: '第四章首领', model: 'boss_fallen_knight', scale: 2.2, hp: 11000, dmg: 36, speed: 3.6, def: 12, radius: 1.3, kk: true,
    clips: { ...KK, idle: '2H_Melee_Idle', move: 'Walking_A', run: 'Running_A' },
    patterns: [
      pat('dashes', '三连突斩', { clip: '2H_Melee_Attack_Stab', windup: 0.7, dashes: { count: 3, length: 12, width: 2.6, gap: 0.55 }, dmg: 1.1, kb: 5 }),
      pat('wave', '暗影剑气', { clip: '2H_Melee_Attack_Slice', windup: 0.8, fan: { count: 3, spread: 40, speed: 18, radius: 1.4, kind: 'darkCrescent', pierce: true }, dmg: 1.2 }),
      pat('pillars', '黑暗之柱', { clip: 'Spellcast_Raise', windup: 0.6, rain: { count: 8, r: 2.4, area: 9, around: 'player', delay: 1.0, spread: 0.15 }, dmg: 1.1 }),
      pat('leap', '处刑跃斩', { clip: '1H_Melee_Attack_Jump_Chop', windup: 1.2, leap: true, shapes: [{ shape: 'circle', at: 'player', r: 5 }], dmg: 1.6, launch: 7 }),
      pat('clones', '暗影分身', { clip: 'Taunt', windup: 0.8, phase: 2, summon: { unit: 'shadow_stalker', count: 4 }, cd: 15 }),
    ] },
  { id: 'boss_abyss_lord', name: '深渊领主·阿巴顿', title: '第五章首领', model: 'boss_abyss_lord', scale: 2.6, hp: 15000, dmg: 40, speed: 3.0, def: 16, radius: 1.6, kk: true, phases: 3,
    clips: { ...KK, idle: '2H_Melee_Idle', move: 'Walking_A', run: 'Running_A' },
    patterns: [
      pat('spin', '深渊旋斧', { clip: '2H_Melee_Attack_Spinning', windup: 0.8, shapes: [{ shape: 'circle', at: 'self', r: 6.5 }], dmg: 1.3, hits: 3, kb: 4 }),
      pat('donut', '深渊之环', { clip: 'Spellcast_Raise', windup: 1.2, shapes: [{ shape: 'ring', at: 'self', r: 13, inner: 5 }], dmg: 1.5 }),
      pat('orbs', '虚空之球', { clip: 'Spellcast_Shoot', windup: 0.7, fan: { count: 6, spread: 360, speed: 7, radius: 0.9, kind: 'voidOrb', homing: 1.2, life: 5 }, dmg: 0.9 }),
      pat('summon', '深渊召唤', { clip: 'Spellcast_Summon', windup: 0.9, summon: { unit: 'blood_berserker', count: 3, elite: true }, cd: 16 }),
      pat('cross', '十字裂地', { clip: '2H_Melee_Attack_Chop', windup: 1.1, phase: 2, cross: { length: 22, width: 3 }, dmg: 1.6 }),
      pat('apocalypse', '天启', { clip: 'Spellcasting', windup: 2.2, phase: 3, safeZones: { count: 3, r: 3.2, area: 13 }, dmg: 2.4 }),
    ] },
  { id: 'boss_fallen_seraph', name: '堕天炽天使·露西菲娅', title: '隐藏章节首领', model: 'boss_fallen_seraph', scale: 2.4, hp: 21000, dmg: 44, speed: 3.4, def: 18, radius: 1.3, kk: true, phases: 3, fly: 0.6,
    clips: { ...KK, move: 'Walking_A', idle: 'Idle', attack: 'Spellcast_Shoot' },
    patterns: [
      pat('beams', '审判光束', { clip: 'Spellcast_Long', windup: 1.0, beams: { count: 4, length: 20, width: 2.2, rotate: 50, dur: 2.4 }, dmg: 0.5 }),
      pat('feathers', '堕羽风暴', { clip: 'Spellcast_Shoot', windup: 0.6, fan: { count: 15, spread: 150, speed: 17, radius: 0.45, kind: 'feather' }, dmg: 0.7 }),
      pat('judgement', '神罚之柱', { clip: 'Spellcast_Raise', windup: 0.6, rain: { count: 14, r: 2.4, area: 12, around: 'player', delay: 1.0, spread: 0.08 }, dmg: 1.0 }),
      pat('dive', '炽翼俯冲', { clip: 'Dodge_Forward', windup: 0.9, charge: { length: 18, width: 3.5, speed: 26 }, dmg: 1.4, kb: 8 }),
      pat('halo', '光环裁决', { clip: 'Spellcasting', windup: 1.4, phase: 2, rings: { count: 4, gap: 0.5, speed: 9, width: 1.6, r: 16 }, dmg: 1.0 }),
      pat('eclipse', '日蚀', { clip: 'Spellcasting', windup: 2.4, phase: 3, safeZones: { count: 2, r: 3, area: 12 }, dmg: 2.6 }),
    ] },
  { id: 'boss_twin_flame', name: '双子将军·炎', title: '无尽模式首领', model: 'boss_twin_flame', scale: 1.9, hp: 6500, dmg: 30, speed: 3.6, def: 10, radius: 1.1, kk: true, twin: 'boss_twin_frost',
    clips: { ...KK, move: 'Walking_A', run: 'Running_A', attack: 'Dualwield_Melee_Attack_Chop' },
    patterns: [
      pat('charge', '炎之突进', { clip: 'Running_A', windup: 0.8, charge: { length: 14, width: 2.8, speed: 20 }, dmg: 1.2, status: { burn: 3 }, after: { trail: { dur: 3 } } }),
      pat('slam', '烈焰双斧', { clip: 'Dualwield_Melee_Attack_Chop', windup: 0.9, shapes: [{ shape: 'arc', r: 5.5, angle: 160 }], dmg: 1.2, status: { burn: 3 } }),
      pat('meteors', '火雨', { clip: 'Cheer', windup: 0.6, rain: { count: 7, r: 2.4, area: 8, around: 'player', delay: 1.0, spread: 0.12 }, dmg: 0.9, status: { burn: 2 } }),
    ] },
  { id: 'boss_twin_frost', name: '双子将军·霜', title: '无尽模式首领', model: 'boss_twin_frost', scale: 1.9, hp: 6500, dmg: 28, speed: 3.8, def: 10, radius: 1.1, kk: true, twin: 'boss_twin_flame',
    clips: { ...KK, move: 'Walking_A', run: 'Running_A', attack: 'Dualwield_Melee_Attack_Slice' },
    patterns: [
      pat('nova', '霜之新星', { clip: 'Dualwield_Melee_Attack_Slice', windup: 0.9, shapes: [{ shape: 'circle', at: 'self', r: 5.5 }], dmg: 1.0, status: { freeze: 1 } }),
      pat('lances', '冰刃风暴', { clip: 'Dualwield_Melee_Attack_Stab', windup: 0.7, fan: { count: 7, spread: 70, speed: 18, radius: 0.45, kind: 'iceLance' }, dmg: 0.8, status: { slow: 2 } }),
      pat('blink', '寒影突袭', { clip: 'Dodge_Forward', windup: 0.6, blink: true, shapes: [{ shape: 'circle', at: 'player', r: 3.5 }], dmg: 1.2, status: { slow: 2 } }),
    ] },
  { id: 'boss_bone_sovereign', name: '万骨之主·萨鲁曼', title: '无尽模式首领', model: 'boss_bone_sovereign', scale: 2.8, hp: 17000, dmg: 38, speed: 2.6, def: 14, radius: 1.6, kk: true, phases: 3,
    clips: { ...KK, move: 'Walking_D_Skeletons', idle: 'Idle_Combat', attack: 'Spellcast_Shoot' },
    patterns: [
      pat('army', '万骨苏醒', { clip: 'Spellcast_Summon', windup: 1.0, summon: { unit: 'skel_warrior', count: 10 }, cd: 12 }),
      pat('spikes', '骨刺长廊', { clip: 'Spellcast_Raise', windup: 1.0, lines: { count: 5, length: 18, width: 2.2, aimed: true }, dmg: 1.2, launch: 6 }),
      pat('souls', '灵魂风暴', { clip: 'Spellcasting', windup: 0.8, fan: { count: 20, spread: 360, speed: 10, radius: 0.6, kind: 'soul' }, dmg: 0.8 }),
      pat('grasp', '冥王之握', { clip: 'Spellcast_Long', windup: 1.3, phase: 2, shapes: [{ shape: 'circle', at: 'player', r: 4.5 }], dmg: 1.6, status: { root: 1.5 } }),
      pat('doomsday', '终末审判', { clip: 'Spellcasting', windup: 2.2, phase: 3, safeZones: { count: 3, r: 3, area: 12 }, dmg: 2.4 }),
    ] },
];

export const ENEMY = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));
export const BOSS = Object.fromEntries(BOSSES.map((b) => [b.id, b]));

// Officers (敌将): named elites with a boss-style health bar and treasure drop.
export const OFFICER_NAMES = ['卡洛斯', '赫姆', '维鲁', '萨克斯', '莫尔', '格里姆', '欧丁', '拉格', '索恩', '巴洛', '奎尔', '德拉肯', '伊瓦尔', '卢克斯', '泽恩', '哈尔'];
export const OFFICER_TITLES = ['骨卫队长', '亡灵百夫长', '冥火督军', '寒骨统领', '血斧屠夫', '暗影猎首', '瘟疫祭司', '战旗领主'];
