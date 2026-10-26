// Biomes, adventure chapters, objectives, endless/daily config and event nodes.
export const BIOMES = {
  graveyard: { name: '亡骨墓园', sky: '#1d1a2b', fog: '#2a2440', fogNear: 18, fogFar: 70, ground: ['#3a3a48', '#2c2c38', '#4a4458'], light: '#c8c0ff', sun: '#ffd9a8', ambient: 'motes', accent: '#7cff9a', props: ['pillar', 'column', 'rubble_large', 'rubble_half', 'wall_broken', 'barrier_column', 'torch_lit', 'trunk_large_A', 'banner_thin_blue', 'floor_dirt_large_rocky'] },
  frostkeep: { name: '霜狱要塞', sky: '#16223a', fog: '#3a5878', fogNear: 16, fogFar: 64, ground: ['#4c5c72', '#3e4c62', '#5e7088'], light: '#cfe6ff', sun: '#e8f4ff', ambient: 'snow', accent: '#7ad8ff', props: ['wall', 'wall_corner', 'wall_cracked', 'pillar_decorated', 'barrier', 'barrel_large', 'crates_stacked', 'banner_patternA_blue', 'torch_mounted', 'column'] },
  inferno: { name: '熔火炼狱', sky: '#200a08', fog: '#4a1608', fogNear: 14, fogFar: 60, ground: ['#3a2420', '#2a1814', '#4a2c22'], light: '#ffb070', sun: '#ff9a50', ambient: 'embers', accent: '#ff7a2a', props: ['rubble_large', 'rubble_half', 'pillar', 'wall_broken', 'barrier_corner', 'keg', 'torch_lit', 'floor_tile_big_spikes', 'banner_shield_red', 'sword_shield_broken'] },
  shadowcourt: { name: '暗影王庭', sky: '#120a1e', fog: '#2a1640', fogNear: 14, fogFar: 62, ground: ['#2e2440', '#221a32', '#3a2c52'], light: '#b08aff', sun: '#d0b0ff', ambient: 'wisps', accent: '#a35cff', props: ['wall_arched', 'wall_pillar', 'pillar_decorated', 'column', 'banner_patternA_red', 'candle_triple', 'table_long_broken', 'chest_gold', 'torch_mounted', 'wall_gated'] },
  abyss: { name: '深渊王座', sky: '#0a0612', fog: '#1e0a2a', fogNear: 12, fogFar: 56, ground: ['#241830', '#1a1024', '#2e1c3c'], light: '#ff6aa8', sun: '#c070ff', ambient: 'void', accent: '#ff3b8e', props: ['pillar', 'rubble_large', 'wall_broken', 'barrier_column', 'floor_tile_big_spikes', 'banner_shield_red', 'torch_lit', 'column', 'wall_cracked', 'coin_stack_large'] },
  skytemple: { name: '天穹神殿', sky: '#3a5a8a', fog: '#9ab8e0', fogNear: 20, fogFar: 80, ground: ['#8c8678', '#7c766a', '#9c968a'], light: '#fff4d8', sun: '#fff0c0', ambient: 'feathers', accent: '#ffd76a', props: ['pillar_decorated', 'column', 'wall_arched', 'banner_patternA_blue', 'banner_shield_green', 'chest_gold', 'coin_stack_large', 'candle_triple', 'wall_pillar', 'barrier_column'] },
};

// Objective archetypes for battle nodes.
export const OBJECTIVES = {
  slay: { name: '歼灭', icon: '斩', desc: (o) => `击败 ${o.count} 名敌人` },
  officers: { name: '斩将', icon: '将', desc: (o) => `击破 ${o.count} 名敌将` },
  capture: { name: '攻占据点', icon: '旗', desc: (o) => `攻占 ${o.count} 处据点` },
  defend: { name: '守护水晶', icon: '晶', desc: (o) => `守护水晶 ${o.time} 秒` },
  escape: { name: '突围', icon: '突', desc: () => '杀出重围，抵达传送门' },
  survive: { name: '坚守', icon: '守', desc: (o) => `坚持 ${o.time} 秒` },
  elite: { name: '精英讨伐', icon: '精', desc: () => '击败精英首领' },
  boss: { name: '首领战', icon: '王', desc: (o) => `击败 ${o.bossName || '首领'}` },
};

// Spawn table rows: [enemyId, unlockSecond, weight]. Squads are drawn from these.
export const CHAPTERS = [
  { id: 1, name: '亡骨墓园', biome: 'graveyard', boss: 'boss_bone_colossus', level: 1, desc: '亡者从墓穴中苏醒。斩开第一条血路！',
    spawn: [['skel_minion', 0, 10], ['skel_warrior', 20, 4], ['skel_archer', 35, 3], ['vampire_bat', 50, 3], ['skel_mage', 80, 2], ['bone_standard', 120, 1], ['slime', 60, 2],
      ['web_spider', 40, 2], ['dire_wolf', 70, 2], ['acid_slime', 110, 1], ['bomber', 150, 1]],
    elites: ['bone_giant', 'skel_warrior', 'blood_berserker'], objectives: ['slay', 'officers', 'capture', 'slay', 'defend'], hpScale: 1.0, dmgScale: 1.0 },
  { id: 2, name: '霜狱要塞', biome: 'frostkeep', boss: 'boss_frost_lich', level: 2, desc: '永冻的要塞里，巫妖王的寒骨军团严阵以待。',
    spawn: [['skel_minion', 0, 8], ['skel_warrior', 0, 4], ['frost_wizard', 20, 3], ['skel_archer', 10, 3], ['bone_shieldguard', 40, 2], ['vampire_bat', 30, 3], ['bone_standard', 90, 1],
      ['frost_lizard', 15, 3], ['banshee', 45, 1], ['chain_jailer', 70, 1], ['time_warden', 110, 1], ['dire_wolf', 30, 2]],
    elites: ['bone_giant', 'bone_shieldguard', 'frost_wizard'], objectives: ['slay', 'capture', 'officers', 'escape', 'defend'], hpScale: 1.8, dmgScale: 1.35 },
  { id: 3, name: '熔火炼狱', biome: 'inferno', boss: 'boss_lava_golem', level: 3, desc: '大地在燃烧，熔岩小鬼成群涌出裂缝。',
    spawn: [['lava_imp', 0, 9], ['hellfire_skull', 15, 4], ['ember_archer', 10, 3], ['skel_warrior', 0, 3], ['blood_berserker', 45, 2], ['gargoyle', 90, 1], ['slime', 30, 2],
      ['bomber', 10, 2], ['basilisk', 50, 1], ['acid_slime', 20, 2], ['venom_spider', 40, 2], ['dire_wolf', 0, 2]],
    elites: ['gargoyle', 'blood_berserker', 'bone_giant'], objectives: ['slay', 'officers', 'survive', 'capture', 'escape'], hpScale: 3.0, dmgScale: 1.8 },
  { id: 4, name: '暗影王庭', biome: 'shadowcourt', boss: 'boss_fallen_knight', level: 4, desc: '堕落骑士的王庭，暗影刺客潜伏在每个角落。',
    spawn: [['skel_minion', 0, 7], ['shadow_stalker', 10, 4], ['skel_mage', 0, 3], ['plague_shaman', 30, 2], ['bone_shieldguard', 20, 3], ['vampire_bat', 0, 4], ['bone_standard', 60, 1], ['thorn_treant', 100, 1],
      ['shadow_bat', 0, 4], ['soul_wraith', 30, 1], ['hex_doctor', 50, 1], ['myconid', 20, 2], ['nullifier', 70, 1], ['web_spider', 0, 2]],
    elites: ['shadow_stalker', 'thorn_treant', 'bone_giant'], objectives: ['officers', 'capture', 'defend', 'slay', 'escape'], hpScale: 4.8, dmgScale: 2.4 },
  { id: 5, name: '深渊王座', biome: 'abyss', boss: 'boss_abyss_lord', level: 5, desc: '一切的源头。深渊领主正在等待你的挑战。',
    spawn: [['skel_warrior', 0, 6], ['blood_berserker', 0, 3], ['hellfire_skull', 0, 3], ['shadow_stalker', 10, 3], ['plague_shaman', 20, 2], ['gargoyle', 40, 2], ['frost_wizard', 20, 2], ['bone_standard', 30, 1], ['lava_imp', 0, 4],
      ['venom_spider', 0, 2], ['soul_wraith', 20, 1], ['nullifier', 30, 1], ['chain_jailer', 20, 1], ['basilisk', 60, 1], ['time_warden', 50, 1], ['shadow_bat', 0, 3], ['bomber', 10, 1]],
    elites: ['gargoyle', 'bone_giant', 'thorn_treant', 'blood_berserker'], objectives: ['slay', 'officers', 'capture', 'survive', 'defend'], hpScale: 7.0, dmgScale: 3.1 },
  { id: 6, name: '天穹神殿', biome: 'skytemple', boss: 'boss_fallen_seraph', level: 6, hidden: true, desc: '（隐藏）神殿之上，堕天的炽天使俯瞰众生。困难难度通关第五章后解锁。',
    spawn: [['skel_warrior', 0, 5], ['gargoyle', 0, 3], ['frost_wizard', 0, 2], ['ember_archer', 0, 3], ['shadow_stalker', 0, 3], ['thorn_treant', 30, 2], ['bone_standard', 20, 2], ['vampire_bat', 0, 4],
      ['time_warden', 0, 1], ['banshee', 0, 1], ['hex_doctor', 10, 1], ['nullifier', 10, 1], ['frost_lizard', 0, 2], ['myconid', 20, 1], ['shadow_bat', 0, 3]],
    elites: ['gargoyle', 'thorn_treant', 'bone_giant', 'shadow_stalker'], objectives: ['officers', 'slay', 'capture', 'survive', 'escape'], hpScale: 10, dmgScale: 3.8 },
];

export const NODE_TYPES = {
  battle: { name: '战斗', glyph: '战', color: '#d8c8a8' },
  elite: { name: '精英', glyph: '精', color: '#ff8a5a' },
  shop: { name: '商人', glyph: '商', color: '#ffd76a' },
  event: { name: '奇遇', glyph: '?', color: '#9ad8ff' },
  rest: { name: '篝火', glyph: '火', color: '#ffb36a' },
  treasure: { name: '宝藏', glyph: '宝', color: '#e4ae39' },
  boss: { name: '首领', glyph: '王', color: '#ff4a6a' },
};

export const ENDLESS = { biomeCycle: ['graveyard', 'frostkeep', 'inferno', 'shadowcourt', 'abyss', 'skytemple'], waveTime: 45, bossEvery: 5, mutateEvery: 10,
  bosses: ['boss_bone_colossus', 'boss_frost_lich', 'boss_twin_flame', 'boss_lava_golem', 'boss_fallen_knight', 'boss_bone_sovereign', 'boss_abyss_lord', 'boss_fallen_seraph'] };

export const MUTATIONS = [
  { id: 'mut_swift', name: '迅捷', desc: '敌人移速 +20%', mod: { enemySpeed: 0.2 } },
  { id: 'mut_tough', name: '坚韧', desc: '敌人生命 +30%', mod: { enemyHp: 0.3 } },
  { id: 'mut_fury', name: '狂怒', desc: '敌人伤害 +25%', mod: { enemyDmg: 0.25 } },
  { id: 'mut_horde', name: '大军', desc: '敌人数量 +30%', mod: { density: 0.3 } },
  { id: 'mut_elite', name: '精英', desc: '精英出现率翻倍', mod: { elite: 1 } },
  { id: 'mut_volatile', name: '爆裂', desc: '敌人死亡 10% 概率爆炸', mod: { volatile: 0.1 } },
  { id: 'mut_vampiric', name: '嗜血', desc: '敌人攻击吸血', mod: { enemyLifesteal: 0.3 } },
  { id: 'mut_armored', name: '重甲', desc: '敌人护甲 +15', mod: { enemyDef: 15 } },
  { id: 'mut_regen', name: '再生', desc: '敌人每秒回复 2% 生命', mod: { enemyRegen: 0.02 } },
  { id: 'mut_glass', name: '玻璃大炮', desc: '你与敌人伤害均 +40%', mod: { playerDmg: 0.4, enemyDmg: 0.4 } },
];

// Random events (奇遇). Each option: { text, cost?, effect } handled by game/progress.js applyEventOption.
export const EVENTS = [
  { id: 'ev_altar', name: '祭坛献血', glyph: '祭', text: '古老的祭坛渴求鲜血。献上生命，便可窥见强大的力量。', options: [
    { text: '献上 20% 最大生命：选择一张传奇及以上技能', effect: { hpCostMax: 0.2, draft: { minRarity: 'legendary' } } }, { text: '离开', effect: {} }] },
  { id: 'ev_gamble', name: '赌徒宝箱', glyph: '赌', text: '一个上锁的箱子，旁边的赌徒笑着说：“300 金币，一半机会翻四倍。”', options: [
    { text: '支付 300 金币开箱', cost: 300, effect: { gamble: { chance: 0.5, gold: 1200 } } }, { text: '不赌了', effect: {} }] },
  { id: 'ev_smith', name: '铁匠强化', glyph: '匠', text: '流浪铁匠可以为你锻打技能。', options: [
    { text: '免费：随机一个技能 +1 级', effect: { upgradeRandom: 1 } }, { text: '支付 400 金币：选择一个技能 +2 级', cost: 400, effect: { upgradeChoose: 2 } }] },
  { id: 'ev_merchant', name: '流浪商人', glyph: '商', text: '神秘商人只出售中立秘宝。', options: [
    { text: '购买随机秘宝（600 金币）', cost: 600, effect: { neutral: 'tier+1' } }, { text: '离开', effect: {} }] },
  { id: 'ev_cursed', name: '诅咒宝藏', glyph: '咒', text: '宝藏上缠绕着诅咒：拿走它，本章敌人更强。', options: [
    { text: '接受诅咒：获得一张远古及以上技能，本章敌人生命 +20%', effect: { curse: { enemyHp: 0.2 }, draft: { minRarity: 'ancient' } } }, { text: '敬而远之', effect: {} }] },
  { id: 'ev_portal', name: '神秘传送门', glyph: '门', text: '传送门另一侧传来金币的叮当声……', options: [
    { text: '进入奖励关：追击宝藏地精', effect: { bonusStage: 'goblin' } }, { text: '无视', effect: {} }] },
  { id: 'ev_shrine', name: '古老神龛', glyph: '龛', text: '神龛散发着温暖的光芒。', options: [
    { text: '祈祷治愈：回复 50% 生命', effect: { heal: 0.5 } }, { text: '祈求力量：本章攻击 +10%', effect: { chapterStats: { atkMult: 0.1 } } }] },
  { id: 'ev_knight', name: '失落的骑士', glyph: '骑', text: '一名失落的骑士想与你切磋。', options: [
    { text: '接受决斗（精英战）：胜利获得一件配件', effect: { duel: true, rewardComponent: 1 } }, { text: '婉拒', effect: {} }] },
  { id: 'ev_spring', name: '生命泉水', glyph: '泉', text: '清澈的泉水能洗去一切伤痛。', options: [{ text: '饮下泉水：生命全满', effect: { heal: 1 } }] },
  { id: 'ev_bandits', name: '盗贼营地', glyph: '盗', text: '一伙盗贼正在分赃。', options: [
    { text: '突袭营地（精英战）：获得 800 金币', effect: { duel: true, rewardGold: 800 } }, { text: '绕道', effect: {} }] },
  { id: 'ev_scales', name: '命运天平', glyph: '衡', text: '天平一端是你的过去，一端是未知。', options: [
    { text: '失去一个随机被动，获得两张随机技能', effect: { swapPassive: 2 } }, { text: '保持现状', effect: {} }] },
  { id: 'ev_astrologer', name: '星象师', glyph: '星', text: '星象师为你占卜未来的道路。', options: [{ text: '接受占卜：接下来 3 次升级多一个选项', effect: { extraOptions: 3 } }] },
  { id: 'ev_rack', name: '遗弃武器架', glyph: '架', text: '战场上遗弃的武器架，还剩些能用的东西。', options: [{ text: '翻找：获得一件随机配件', effect: { randomComponent: 1 } }] },
  { id: 'ev_cauldron', name: '炼金坩埚', glyph: '锅', text: '冒着泡的坩埚能炼出意想不到的东西。', options: [
    { text: '投入 400 金币：随机获得一件合成装备', cost: 400, effect: { randomCrafted: 1 } }, { text: '离开', effect: {} }] },
  { id: 'ev_statue', name: '献祭雕像', glyph: '像', text: '雕像要求你献出一份力量，回报以黄金。', options: [
    { text: '献祭一个随机技能：获得 900 金币', effect: { sacrificeSkill: 1, gold: 900 } }, { text: '拒绝', effect: {} }] },
  { id: 'ev_caravan', name: '幽灵商队', glyph: '幽', text: '幽灵商队的消耗品半价出售。', options: [{ text: '打开半价商店', effect: { shop: { consumableDiscount: 0.5 } } }] },
  { id: 'ev_training', name: '训练场', glyph: '训', text: '一处废弃的训练场。', options: [{ text: '刻苦训练：获得 1.5 级经验', effect: { xpLevels: 1.5 } }] },
  { id: 'ev_fog', name: '迷雾岔路', glyph: '雾', text: '迷雾中的岔路通往何方？', options: [
    { text: '左路：直接获得一个宝藏', effect: { treasure: 1 } }, { text: '右路：跳过下一场战斗', effect: { skipBattle: 1 } }] },
  { id: 'ev_berserker', name: '狂战士之魂', glyph: '魂', text: '狂战士的亡魂愿意附身于你。', options: [
    { text: '接受附身：本章攻击 +25%，最大生命 -15%', effect: { chapterStats: { atkMult: 0.25, hpMult: -0.15 } } }, { text: '驱散亡魂', effect: {} }] },
  { id: 'ev_guardian', name: '守护者之约', glyph: '约', text: '古代守护者愿与你立约。', options: [
    { text: '立约：本章生命与护甲 +20%，移速 -10%', effect: { chapterStats: { hpMult: 0.2, defMult: 0.2, speedMult: -0.1 } } }, { text: '拒绝', effect: {} }] },
  { id: 'ev_map', name: '宝藏地图', glyph: '图', text: '一张标记着精英巢穴的地图。', options: [{ text: '收下地图：下一个精英额外掉落秘宝', effect: { eliteBonus: 1 } }] },
  { id: 'ev_scientist', name: '疯狂科学家', glyph: '疯', text: '“让我改造你的技能吧！”', options: [
    { text: '改造：随机技能变为同派系更高稀有度技能', effect: { mutateSkill: 1 } }, { text: '逃跑', effect: {} }] },
  { id: 'ev_wheel', name: '命运之轮', glyph: '轮', text: '转动命运之轮，结果无法预测。', options: [{ text: '转动！', effect: { wheel: 1 } }, { text: '不转', effect: {} }] },
  { id: 'ev_blessing', name: '祝福之泉', glyph: '福', text: '泉水中漂浮着六枚祝福符文。', options: [{ text: '取一枚祝福', effect: { blessing: 1 } }] },
];

export const BLESSINGS = [
  { name: '迅风祝福', stats: { speedMult: 0.12 } }, { name: '力量祝福', stats: { atkMult: 0.12 } }, { name: '坚壁祝福', stats: { def: 10, hpMult: 0.08 } },
  { name: '慧心祝福', stats: { cdr: 0.08 } }, { name: '鹰眼祝福', stats: { crit: 0.08 } }, { name: '财富祝福', stats: { goldGain: 0.25 } },
];

export const DAILY_MODIFIERS = MUTATIONS.slice(0, 10);
