export const DIFFICULTIES = [
  { id: 'easy', name: '简单割草', desc: '敌人脆弱、成群涌来，尽情享受一刀一片的爽快。', color: '#7bd88f',
    hp: 0.5, dmg: 0.4, density: 1.35, elite: 0.5, affixes: [0, 0], telegraph: 1.25, reward: 0.8, revive: 2, rarityBonus: 0.05, bossPhases: 0 },
  { id: 'normal', name: '适中', desc: '标准体验：敌我有来有回，需要合理闪避与搭配。', color: '#e8d27a',
    hp: 1.0, dmg: 1.0, density: 1.0, elite: 1.0, affixes: [0, 1], telegraph: 1.0, reward: 1.0, revive: 1, rarityBonus: 0.1, bossPhases: 0 },
  { id: 'hard', name: '困难', desc: '精英更多、预警更短，精英带 1 个词缀。', color: '#f0a050',
    hp: 1.6, dmg: 1.5, density: 1.1, elite: 1.6, affixes: [1, 1], telegraph: 0.85, reward: 1.5, revive: 1, rarityBonus: 0.18, bossPhases: 0 },
  { id: 'hell', name: '地狱', desc: '精英带 2–3 个暗黑式词缀，Boss 多一个阶段，无法复活。', color: '#e04848',
    hp: 2.6, dmg: 2.4, density: 1.2, elite: 2.3, affixes: [2, 3], telegraph: 0.75, reward: 2.2, revive: 0, rarityBonus: 0.3, bossPhases: 1 },
];
export const DIFFICULTY = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d]));
