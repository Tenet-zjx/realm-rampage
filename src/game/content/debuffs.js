// Negative effects enemies can put on the hero. `cc` debuffs are blocked by crowd-control immunity and
// broken by musou; `max` marks stacking debuffs (status value = stacks added, duration = `dur`).
// Status values for non-stacking debuffs are durations in seconds. `scale` multiplies incoming durations.
export const DEBUFFS = [
  { id: 'slow', name: '减速', color: '#7ad8ff', dur: 2, desc: '移动速度 -40%。' },
  { id: 'freeze', name: '冰冻', color: '#aee8ff', cc: true, dur: 1, scale: 0.6, desc: '被冻结，无法行动。' },
  { id: 'root', name: '缠绕', color: '#7aff9a', cc: true, dur: 1, scale: 0.6, desc: '无法移动与闪避。' },
  { id: 'burn', name: '灼烧', color: '#ff8a3a', dur: 2, desc: '每秒损失 1.6% 最大生命。' },
  { id: 'webbed', name: '蛛网', color: '#e8e2d0', max: 3, dur: 4, desc: '每层移速 -18%、闪避距离缩短；叠满 3 层被蛛网缚住 1.2 秒。' },
  { id: 'poison', name: '剧毒', color: '#86ff3a', max: 10, dur: 5, desc: '每层每秒损失 0.36% 最大生命，治疗效果 -40%。' },
  { id: 'fear', name: '恐惧', color: '#b07aff', cc: true, dur: 1.6, desc: '惊恐地逃离施法者，无法攻击与施法。' },
  { id: 'tether', name: '噬魂链接', color: '#4affd8', dur: 5, desc: '无双值被持续吸取（无双耗尽后吸取生命）。远离怨灵 11 米或击败它即可挣脱。' },
  { id: 'frostbite', name: '冻伤', color: '#9adfff', max: 5, dur: 5, desc: '每层移速与攻速 -7%；叠满 5 层冻结 1.4 秒。' },
  { id: 'hex', name: '妖术', color: '#8aff5a', cc: true, dur: 2, desc: '被变成青蛙：无法攻击、施法与闪避，移速 -35%。' },
  { id: 'silence', name: '沉默', color: '#c27aff', cc: true, dur: 3, desc: '无法释放技能与装备主动效果。' },
  { id: 'hooked', name: '钩锁', color: '#ffa04a', cc: true, dur: 0.55, desc: '被铁钩拖向狱卒并短暂眩晕。' },
  { id: 'petrify', name: '石化', color: '#c8bca4', cc: true, dur: 1.6, desc: '被石化凝视，无法行动，但受到的伤害 -50%。' },
  { id: 'confuse', name: '迷乱', color: '#ff7ad8', cc: true, dur: 3, desc: '神志错乱，移动方向颠倒。' },
  { id: 'corrode', name: '腐蚀', color: '#d4ff3a', max: 5, dur: 7, desc: '每层护甲 -12%、受到的伤害 +5%。' },
  { id: 'bomb', name: '定时炸弹', color: '#ff5a3a', dur: 4, desc: '倒计时结束时爆炸，伤害你与周围的敌人。爆炸瞬间闪避可完全规避。' },
  { id: 'timeslow', name: '时间迟滞', color: '#ffd76a', dur: 3.5, desc: '移速与攻速 -40%，技能冷却速度减半。' },
  { id: 'bleed', name: '流血', color: '#ff3a4a', max: 5, dur: 5, desc: '每层每秒损失 0.3% 最大生命；移动时伤害 ×3。' },
  { id: 'blind', name: '致盲', color: '#8a8ab8', dur: 3, desc: '视野变暗，普攻与蓄力技有 35% 几率落空。' },
];
export const DEBUFF = Object.fromEntries(DEBUFFS.map((d) => [d.id, d]));

// Gaze meter: standing in a basilisk's gaze cone fills it; full = petrified.
export const GAZE = { fill: 1 / 1.5, decay: 0.45, immune: 2.5 };
