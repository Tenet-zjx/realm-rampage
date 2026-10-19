// Ten factions. Owning N distinct skills of a faction (active/auto/passive) activates tiers 2/4/6/8.
// Bonus effects use the shared modifier format: { stats: {key: value}, procs: [{ id, ...params }] } — see game/procs.js.
export const FACTIONS = [
  { id: 'fire', name: '烈焰', color: '#ff7a2a', glow: '#ffb347', glyph: '炎', desc: '燃烧与爆炸',
    tiers: [
      { n: 2, text: '燃烧伤害 +30%', stats: { burnPower: 0.3 } },
      { n: 4, text: '燃烧中的敌人死亡时爆炸（2.5 米，40% 攻击）', procs: [{ id: 'burnExplode', r: 2.5, dmg: 0.4 }] },
      { n: 6, text: '技能命中有 8% 概率召唤一颗陨石', procs: [{ id: 'meteorOnSkill', chance: 0.08, dmg: 2.2 }] },
      { n: 8, text: '派系觉醒·焚天：全部火系伤害 +50%，周身燃起烈焰光环', stats: { fireDmg: 0.5 }, procs: [{ id: 'awakenAura', faction: 'fire', r: 3.5, dmg: 0.35, status: { burn: 2 } }] },
    ] },
  { id: 'frost', name: '霜寒', color: '#6fd8ff', glow: '#c8f4ff', glyph: '霜', desc: '减速、冰冻与碎裂',
    tiers: [
      { n: 2, text: '减速效果 +20%，冰冻时间 +15%', stats: { slowPower: 0.2, freezePower: 0.15 } },
      { n: 4, text: '对冰冻敌人的伤害 +40%', stats: { vsFrozen: 0.4 } },
      { n: 6, text: '冰冻敌人被击杀时碎裂，冻结周围 2 米敌人', procs: [{ id: 'shatter', r: 2.2, freeze: 1.2, dmg: 0.6 }] },
      { n: 8, text: '派系觉醒·永冬：每 6 秒释放一次寒潮新星', procs: [{ id: 'periodicNova', every: 6, r: 7, dmg: 1.6, status: { freeze: 1.5 }, palette: 'frost' }] },
    ] },
  { id: 'storm', name: '雷霆', color: '#7aa8ff', glow: '#e6f0ff', glyph: '雷', desc: '连锁闪电与眩晕',
    tiers: [
      { n: 2, text: '连锁弹跳 +1，雷系伤害 +15%', stats: { chainJumps: 1, stormDmg: 0.15 } },
      { n: 4, text: '暴击时 35% 概率释放连锁闪电', procs: [{ id: 'chainOnCrit', chance: 0.35, jumps: 4, dmg: 0.8 }] },
      { n: 6, text: '眩晕时间 +30%，被眩晕的敌人受到伤害 +25%', stats: { stunPower: 0.3, vsStunned: 0.25 } },
      { n: 8, text: '派系觉醒·天罚：每 4 秒落下 6 道天雷', procs: [{ id: 'periodicBolts', every: 4, count: 6, dmg: 2.2 }] },
    ] },
  { id: 'shadow', name: '暗影', color: '#a35cff', glow: '#d9b8ff', glyph: '影', desc: '吸血、斩杀与召唤',
    tiers: [
      { n: 2, text: '技能吸血 +4%', stats: { skillLifesteal: 0.04 } },
      { n: 4, text: '击杀叠加灵魂（上限 60），每层伤害 +0.5%', procs: [{ id: 'soulStacks', per: 0.005, max: 60 }] },
      { n: 6, text: '对生命低于 15% 的普通敌人直接斩杀', procs: [{ id: 'execute', below: 0.15 }] },
      { n: 8, text: '派系觉醒·冥王：召唤物伤害与生命 +60%，击杀 15% 概率唤起亡魂', stats: { summonPower: 0.6 }, procs: [{ id: 'raiseOnKill', chance: 0.15, dur: 12 }] },
    ] },
  { id: 'holy', name: '圣光', color: '#ffd76a', glow: '#fff4c2', glyph: '圣', desc: '护盾、治疗与神圣打击',
    tiers: [
      { n: 2, text: '受到治疗 +25%，每秒回复 0.5% 生命', stats: { healPower: 0.25, regenPct: 0.005 } },
      { n: 4, text: '每 10 秒获得 12% 最大生命的护盾', procs: [{ id: 'periodicShield', every: 10, pct: 0.12 }] },
      { n: 6, text: '治疗溢出量转化为对周围敌人的神圣伤害', procs: [{ id: 'overhealNova', r: 4 }] },
      { n: 8, text: '派系觉醒·炽天：致命伤害改为免疫 3 秒（60 秒冷却）', procs: [{ id: 'cheatDeath', cd: 60, dur: 3 }] },
    ] },
  { id: 'nature', name: '狂野', color: '#6fdc5a', glow: '#c9ff9e', glyph: '野', desc: '剧毒、缠绕与野兽',
    tiers: [
      { n: 2, text: '中毒伤害 +30%，缠绕时间 +20%', stats: { poisonPower: 0.3, rootPower: 0.2 } },
      { n: 4, text: '中毒的敌人死亡时将毒素扩散给附近 3 个敌人', procs: [{ id: 'poisonSpread', count: 3, r: 4 }] },
      { n: 6, text: '召唤的野兽数量 +1，野兽获得吸血', stats: { beastCount: 1 } },
      { n: 8, text: '派系觉醒·万物：每 8 秒在周围生长荆棘丛', procs: [{ id: 'periodicThorns', every: 8, r: 6, dmg: 1.4, status: { root: 1.5, poison: 3 } }] },
    ] },
  { id: 'blade', name: '剑刃', color: '#d9e2ec', glow: '#ffe28a', glyph: '刃', desc: '暴击、旋斩与突进',
    tiers: [
      { n: 2, text: '暴击率 +6%', stats: { crit: 0.06 } },
      { n: 4, text: '暴击伤害 +35%，普攻伤害 +15%', stats: { critDmg: 0.35, lightDmg: 0.15 } },
      { n: 6, text: '每次暴击使技能冷却缩短 0.15 秒', procs: [{ id: 'critRefresh', amount: 0.15 }] },
      { n: 8, text: '派系觉醒·剑圣：普攻挥出剑气（6 米，60% 攻击）', procs: [{ id: 'swordWave', len: 6, dmg: 0.6 }] },
    ] },
  { id: 'arcane', name: '奥术', color: '#ff5cd6', glow: '#ffc4f1', glyph: '奥', desc: '牵引、时停与法术强化',
    tiers: [
      { n: 2, text: '技能冷却 -8%', stats: { cdr: 0.08 } },
      { n: 4, text: '技能伤害 +20%，范围 +10%', stats: { skillDmg: 0.2, area: 0.1 } },
      { n: 6, text: '释放主动技能后 3 秒内，普攻发射奥术飞弹', procs: [{ id: 'spellblade', dur: 3, dmg: 0.5 }] },
      { n: 8, text: '派系觉醒·星界：主动技能 20% 概率不进入冷却', procs: [{ id: 'freeCast', chance: 0.2 }] },
    ] },
  { id: 'earth', name: '大地', color: '#d9a05b', glow: '#ffd9a0', glyph: '岩', desc: '击飞、护甲与地形',
    tiers: [
      { n: 2, text: '护甲 +12，击退 +20%', stats: { def: 12, knockback: 0.2 } },
      { n: 4, text: '挑空的敌人落地时造成冲击（2 米，50% 攻击）', procs: [{ id: 'landingShock', r: 2, dmg: 0.5 }] },
      { n: 6, text: '受到伤害 -12%，霸体期间再 -15%', stats: { dmgReduction: 0.12, armorReduction: 0.15 } },
      { n: 8, text: '派系觉醒·山岳：每移动 12 米自动释放一次回音震地', procs: [{ id: 'stepQuake', dist: 12, r: 6, dmg: 2, status: { stun: 0.6 } }] },
    ] },
  { id: 'blood', name: '鲜血', color: '#ff3b4e', glow: '#ff9aa6', glyph: '血', desc: '以血换伤、狂暴与斩杀',
    tiers: [
      { n: 2, text: '吸血 +3%，生命低于 50% 时攻击 +15%', stats: { lifesteal: 0.03 }, procs: [{ id: 'lowHpAtk', below: 0.5, atk: 0.15 }] },
      { n: 4, text: '流血伤害 +40%，暴击附加流血', stats: { bleedPower: 0.4 }, procs: [{ id: 'bleedOnCrit', dps: 0.3, dur: 3 }] },
      { n: 6, text: '每损失 10% 生命，攻速 +6%', procs: [{ id: 'berserk', per: 0.06 }] },
      { n: 8, text: '派系觉醒·血神：击杀回复 1% 最大生命，过量治疗转化为护盾', procs: [{ id: 'killHeal', pct: 0.01 }, { id: 'overhealShield', cap: 0.3 }] },
    ] },
];
export const FACTION = Object.fromEntries(FACTIONS.map((f) => [f.id, f]));

// Dual-faction synergies: active when both factions have >= `need` skills (default 2).
export const SYNERGIES = [
  { id: 'syn_thermal', name: '冰火两重', a: 'fire', b: 'frost', text: '冰冻的敌人受到火焰伤害时爆炸（3 米，150% 攻击）', procs: [{ id: 'thermalShock', r: 3, dmg: 1.5 }] },
  { id: 'syn_superconduct', name: '超导', a: 'storm', b: 'frost', text: '闪电命中冰冻/减速目标时额外弹跳 3 次，伤害 +30%', procs: [{ id: 'superconduct', jumps: 3, dmg: 0.3 }] },
  { id: 'syn_wildfire', name: '雷火燎原', a: 'storm', b: 'fire', text: '雷系伤害点燃目标，燃烧敌人受雷击 +35% 伤害', procs: [{ id: 'wildfire', burn: 2, bonus: 0.35 }] },
  { id: 'syn_twilight', name: '暮光', a: 'shadow', b: 'holy', text: '你的治疗量的 60% 转化为对附近敌人的暗影伤害', procs: [{ id: 'twilight', ratio: 0.6, r: 5 }] },
  { id: 'syn_plague', name: '瘟疫', a: 'shadow', b: 'nature', text: '敌人死亡时传播剧毒，暗影伤害对中毒目标 +30%', procs: [{ id: 'plague', r: 3.5, poison: 3, bonus: 0.3 }] },
  { id: 'syn_stormblade', name: '剑雷', a: 'blade', b: 'storm', text: '暴击时释放落雷（2 米，80% 攻击）', procs: [{ id: 'critBolt', r: 2, dmg: 0.8 }] },
  { id: 'syn_starfire', name: '星火', a: 'arcane', b: 'fire', text: '牵引类技能结束时引发火焰爆炸，漩涡中敌人持续燃烧', procs: [{ id: 'starfire', dmg: 2, burn: 3 }] },
  { id: 'syn_timeslash', name: '时停斩', a: 'arcane', b: 'blade', text: '被时停/眩晕的敌人受到的剑刃与普攻伤害翻倍', procs: [{ id: 'timeslash', mult: 1.0 }] },
  { id: 'syn_grace', name: '自然神恩', a: 'holy', b: 'nature', text: '召唤物每秒回复 3% 生命，召唤时为你回复 3% 生命', procs: [{ id: 'grace', regen: 0.03, heal: 0.03 }] },
  { id: 'syn_frostblade', name: '寒刃', a: 'frost', b: 'blade', text: '投射物穿透 +2，对冰冻目标暴击率 +25%', stats: { pierce: 2 }, procs: [{ id: 'frostCrit', crit: 0.25 }] },
  { id: 'syn_magma', name: '熔岩', a: 'fire', b: 'earth', text: '击飞/落地冲击留下 3 秒熔岩地面（每秒 40% 攻击）', procs: [{ id: 'magmaGround', dur: 3, dps: 0.4 }] },
  { id: 'syn_permafrost', name: '永冻冰川', a: 'frost', b: 'earth', text: '冰冻时间 +30%，冰冻敌人被击中时受到额外 20% 物理伤害', stats: { freezePower: 0.3 }, procs: [{ id: 'brittle', bonus: 0.2 }] },
  { id: 'syn_bloodmoon', name: '血月', a: 'blood', b: 'shadow', text: '吸血量翻倍，满血时溢出吸血转为暗影伤害', stats: { lifestealMult: 1 }, procs: [{ id: 'overflowShadow' }] },
  { id: 'syn_sacrament', name: '圣血契约', a: 'blood', b: 'holy', text: '每次施法消耗 2% 生命，伤害 +25%，治疗 +40%', stats: { skillDmg: 0.25, healPower: 0.4 }, procs: [{ id: 'bloodCast', cost: 0.02 }] },
  { id: 'syn_gale', name: '风暴之野', a: 'storm', b: 'nature', text: '移速 +12%，召唤物攻击附带闪电', stats: { speed: 0.12 }, procs: [{ id: 'beastLightning', dmg: 0.4 }] },
  { id: 'syn_runeblade', name: '符文之刃', a: 'arcane', b: 'earth', text: '护甲的 50% 转化为技能伤害加成（%）', procs: [{ id: 'armorToSkill', ratio: 0.5 }] },
  { id: 'syn_massacre', name: '血刃屠戮', a: 'blood', b: 'blade', text: '击杀后 2 秒内暴击率 +20%、攻速 +20%', procs: [{ id: 'killFrenzy', dur: 2, crit: 0.2, atkSpeed: 0.2 }] },
  { id: 'syn_ironwood', name: '铁木', a: 'earth', b: 'nature', text: '荆棘反伤 +80%，站立不动 1 秒后受到伤害 -20%', stats: { thorns: 0.8 }, procs: [{ id: 'standGuard', delay: 1, dr: 0.2 }] },
  { id: 'syn_judgement', name: '神裁雷光', a: 'holy', b: 'storm', text: '对精英与 Boss 伤害 +25%，每 3 秒对最近精英降下神雷', stats: { vsElite: 0.25 }, procs: [{ id: 'eliteBolt', every: 3, dmg: 3 }] },
  { id: 'syn_voidfire', name: '虚空之焰', a: 'arcane', b: 'shadow', text: '技能命中 15% 概率产生小型黑洞（1.5 秒）', procs: [{ id: 'miniHole', chance: 0.15, dur: 1.5, r: 3 }] },
];

// Triple-faction combos (Invoker style): each faction needs >= 2 skills. Grants an auto-cast ultimate.
export const TRIADS = [
  { id: 'tri_elemental', name: '元素风暴', factions: ['fire', 'frost', 'storm'], skill: 'tri_elemental_storm', text: '每 16 秒召唤火、冰、雷三重风暴轮番轰炸全场' },
  { id: 'tri_abyss', name: '深渊之门', factions: ['shadow', 'blood', 'arcane'], skill: 'tri_abyss_gate', text: '每 18 秒打开深渊之门，吞噬并处决低血敌人' },
  { id: 'tri_genesis', name: '创世之光', factions: ['holy', 'nature', 'earth'], skill: 'tri_genesis', text: '每 20 秒降下创世之光：治疗全满并将敌人石化' },
  { id: 'tri_tempest', name: '万剑归宗', factions: ['blade', 'storm', 'arcane'], skill: 'tri_tempest', text: '每 15 秒召唤 24 把雷霆飞剑贯穿战场' },
  { id: 'tri_inferno', name: '炼狱血祭', factions: ['fire', 'blood', 'shadow'], skill: 'tri_inferno', text: '每 17 秒献祭 5% 生命，引发巨大的炼狱火海' },
  { id: 'tri_glacier', name: '冰河世纪', factions: ['frost', 'earth', 'nature'], skill: 'tri_glacier', text: '每 18 秒冰川从地底升起，冻结并击飞大片敌人' },
];
