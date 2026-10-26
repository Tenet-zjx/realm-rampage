// Designed vector icons for every skill, item, rune, hero and faction (no text glyphs).
// Each icon = faction/category background + 1–4 emblem layers drawn from icon-shapes.js, rendered as an SVG data URL.
import { SHAPES } from './icon-shapes.js';
import { SKILL } from '../game/content/skills.js';
import { ITEM } from '../game/content/items.js';
import { FACTION } from '../game/content/factions.js';

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));

// palette per theme: main emblem colour + accent colour
const THEME = {
  fire: ['#ff7a2a', '#ffd76a'], frost: ['#6fd8ff', '#ffffff'], storm: ['#7aa8ff', '#ffe24a'], shadow: ['#a35cff', '#ff5a9a'], holy: ['#ffd76a', '#ffffff'],
  nature: ['#6fdc5a', '#ffd76a'], blade: ['#d9e2ec', '#ffcf4a'], arcane: ['#ff5cd6', '#8ab4ff'], earth: ['#d9a05b', '#ff8a3a'], blood: ['#ff3b4e', '#ffd0d0'],
  steel: ['#c8d2e0', '#ffcf4a'], gold: ['#ffcf4a', '#ff7a3a'], red: ['#ff5a5a', '#ffd76a'], green: ['#6fdc5a', '#ffffff'], blue: ['#5aa8ff', '#ffffff'], purple: ['#b070ff', '#ffd76a'],
  orange: ['#ff9a3a', '#fff0a0'], white: ['#eef4ff', '#ffd76a'], dark: ['#7a6a9a', '#ff5a5a'], brown: ['#c08a50', '#ffd76a'], teal: ['#4ad8c0', '#ffffff'], pink: ['#ff7ac0', '#ffffff'],
};
const BG_PATTERN = {
  fire: 'rays', frost: 'hex', storm: 'zig', shadow: 'mist', holy: 'rays', nature: 'dots', blade: 'diag', arcane: 'runes', earth: 'cracks', blood: 'dots',
};

// layer: [shape, x=32, y=32, scale=1, rot=0, colour ('a' accent | theme name | hex), flip]
const L = (s, x = 32, y = 32, k = 1, r = 0, c = 0, flip = 0) => [s, x, y, k, r, c, flip];
const SKILL_ICONS = {
  fire_dragon_wave: [L('dragon', 32, 30, 0.95), L('flame', 52, 46, 0.32, 40, 'a')], fire_strike_array: [L('rune', 32, 38, 0.85, 0, 'a'), L('flame', 32, 26, 0.72)], fire_meteor: [L('meteor')],
  fire_inferno: [L('flame', 19, 38, 0.52, -18), L('flame', 45, 38, 0.52, 18), L('flame', 32, 30, 0.82, 0, 'a')], fire_orbit: [L('rings', 32, 32, 0.95, 0, 'a'), L('flame', 32, 12, 0.32), L('flame', 50, 42, 0.32, 120), L('flame', 14, 42, 0.32, 240)],
  fire_trail: [L('foot', 30, 34, 0.85), L('flame', 48, 46, 0.4, 0, 'a')], fire_bomb: [L('fireball')], fire_heart: [L('heart', 32, 34, 0.92), L('flame', 32, 30, 0.5, 0, 'a')],
  fire_kindle: [L('spark', 32, 32, 0.95, 0, 'a'), L('flame', 32, 34, 0.55)], fire_phoenix: [L('phoenix')],
  frost_nova: [L('rings', 32, 32, 1, 0, 'a'), L('snowflake', 32, 32, 0.72)], frost_shards: [L('shards')], frost_glacier: [L('spikes', 32, 40, 0.95), L('crystal', 32, 22, 0.42, 0, 'a')],
  frost_zero: [L('bubble', 32, 32, 0.98), L('snowflake', 32, 32, 0.62, 0, 'a')], frost_field: [L('spiral', 32, 32, 0.95, 0, 'a'), L('snowflake', 20, 22, 0.42), L('snowflake', 44, 26, 0.38), L('snowflake', 30, 46, 0.46)],
  frost_orb: [L('orb', 32, 32, 0.85), L('shards', 32, 32, 0.5, 0, 'a')], frost_ring: [L('rings'), L('snowflake', 32, 32, 0.32, 0, 'a')], frost_heart: [L('heart'), L('crystal', 32, 30, 0.42, 0, 'a')],
  frost_armor: [L('shield'), L('snowflake', 32, 30, 0.5, 0, 'a')], frost_shatter: [L('crystal', 26, 30, 0.7, -20), L('crack', 42, 34, 0.6, 0, 'a')],
  storm_chain: [L('chain', 32, 32, 0.95, 0, 'steel'), L('bolt', 32, 32, 0.68, 0, 'a')], storm_wrath: [L('cloud', 32, 22, 0.92), L('bolt', 32, 46, 0.58, 0, 'a')], storm_hammer: [L('hammer', 32, 32, 0.9), L('bolt', 46, 46, 0.38, 20, 'a')],
  storm_ball: [L('orb', 32, 32, 0.9), L('bolt', 32, 32, 0.55, 0, 'a')], storm_cloud: [L('cloud', 32, 24, 1), L('bolt', 22, 48, 0.34, 0, 'a'), L('bolt', 42, 50, 0.34, 0, 'a')], storm_spark: [L('spark', 32, 32, 1, 0, 'a'), L('bolt', 32, 32, 0.4)],
  storm_field: [L('magnet', 32, 30, 0.85), L('spark', 32, 52, 0.32, 0, 'a')], storm_static: [L('bolt', 22, 32, 0.62, -15), L('bolt', 42, 32, 0.62, 15, 'a')], storm_conductor: [L('spear', 32, 32, 0.95), L('bolt', 18, 48, 0.32, 0, 'a')],
  storm_overload: [L('burst', 32, 32, 0.98, 0, 'a'), L('bolt', 32, 32, 0.6)],
  shadow_raze: [L('skull', 32, 26, 0.62), L('rings', 14, 52, 0.28, 0, 'a'), L('rings', 32, 55, 0.28, 0, 'a'), L('rings', 50, 52, 0.28, 0, 'a')], shadow_requiem: [L('wave', 32, 50, 0.62, 0, 'a'), L('ghost', 32, 28, 0.78)],
  shadow_step: [L('hood', 30, 32, 0.88), L('foot', 50, 50, 0.3, 0, 'a')], shadow_doom: [L('doom')], shadow_skulls: [L('skullbones')], shadow_bats: [L('bat', 32, 26, 0.9), L('bat', 18, 48, 0.42, 0, 'a'), L('bat', 46, 50, 0.42, 0, 'a')],
  shadow_tendrils: [L('tentacle', 22, 34, 0.75, -10), L('tentacle', 42, 34, 0.75, 10, 'a', 1)], shadow_souls: [L('scythe'), L('ghost', 46, 44, 0.34, 0, 'a')], shadow_vampire: [L('fang')], shadow_cloak: [L('hood')],
  holy_wave: [L('wave', 32, 38, 1), L('sun', 32, 16, 0.38, 0, 'a')], holy_hammer: [L('hammer', 32, 28, 0.88, 180), L('burst', 32, 52, 0.36, 0, 'a')], holy_guardian: [L('wing', 18, 30, 0.62, 0, 0, 1), L('wing', 46, 30, 0.62), L('shield', 32, 38, 0.5, 0, 'a')],
  holy_seraph: [L('wing', 18, 26, 0.55, 10, 0, 1), L('wing', 46, 26, 0.55, -10), L('wing', 18, 42, 0.48, -18, 0, 1), L('wing', 46, 42, 0.48, 18), L('halo', 32, 22, 0.5, 0, 'a')],
  holy_ward: [L('rune'), L('cross', 32, 32, 0.42, 0, 'a')], holy_smite: [L('spear', 32, 34, 1, 0, 'a'), L('sun', 50, 13, 0.34)], holy_halo: [L('halo', 32, 34, 1.05)], holy_faith: [L('book'), L('cross', 44, 42, 0.3, 0, 'a')],
  holy_aegis: [L('shield'), L('cross', 32, 30, 0.48, 0, 'a')], holy_martyr: [L('heart', 32, 36, 0.92), L('halo', 32, 14, 0.52, 0, 'a')],
  nature_poison_nova: [L('burst', 32, 32, 0.98, 0, 'a'), L('drop', 32, 32, 0.58)], nature_overgrowth: [L('vines')], nature_treants: [L('tree')], nature_fury: [L('foot', 32, 34, 0.95), L('leaf', 50, 12, 0.32, 0, 'a')],
  nature_spores: [L('mushroom')], nature_swarm: [L('bee')], nature_thorns: [L('thorns')], nature_toxin: [L('flask'), L('skull', 32, 46, 0.28, 0, 'a')], nature_regrowth: [L('leaf'), L('plus', 46, 46, 0.34, 0, 'a')],
  nature_bark: [L('shield', 32, 32, 1, 0, 'brown'), L('leaf', 32, 30, 0.45)],
  blade_fury: [L('tornado', 32, 32, 0.95, 0, 'a'), L('blades3', 32, 32, 0.72)], blade_omnislash: [L('swords'), L('spark', 32, 32, 0.5, 0, 'a')], blade_crescent: [L('crescent', 34, 30, 0.9, 45), L('crescent', 24, 40, 0.48, 45, 'a')],
  blade_god: [L('fist'), L('spark', 50, 12, 0.32, 0, 'a')], blade_swords: [L('blades3')], blade_flurry: [L('sword', 28, 36, 0.78, 30, 'a'), L('sword', 34, 30, 0.86, 30)], blade_phantom: [L('wave', 16, 40, 0.42, 90, 'a'), L('sword', 36, 30, 0.9, 60)],
  blade_edge: [L('sword', 32, 32, 1.05, 45)], blade_master: [L('swords')], blade_coup: [L('sword', 32, 30, 0.9, 180), L('drop', 48, 50, 0.32, 0, 'red')],
  arcane_blackhole: [L('spiral')], arcane_chrono: [L('clock'), L('rune', 32, 34, 0.42, 0, 'a')], arcane_sunstrike: [L('sun', 32, 16, 0.52, 0, 'a'), L('crystal', 32, 44, 0.42, 180)], arcane_missiles: [L('star', 16, 42, 0.38), L('star', 32, 24, 0.46, 0, 'a'), L('star', 48, 42, 0.38)],
  arcane_rift: [L('portal')], arcane_runes: [L('rune')], arcane_gravity: [L('rings'), L('up', 32, 32, 0.36, 180, 'a')], arcane_mastery: [L('book')], arcane_haste: [L('hourglass'), L('spark', 48, 48, 0.3, 0, 'a')],
  arcane_echo: [L('rings', 32, 32, 1, 0, 'a'), L('star', 32, 32, 0.45)],
  earth_fissure: [L('crack'), L('rock', 15, 52, 0.28, 0, 'a')], earth_echo: [L('rings', 32, 50, 0.52, 0, 'a'), L('fist', 32, 24, 0.72, 180)], earth_spikes: [L('spikes')], earth_boulder: [L('boulder')],
  earth_shards: [L('rock', 20, 22, 0.44), L('rock', 44, 22, 0.4, 30, 'a'), L('rock', 32, 46, 0.5, 60)], earth_quake: [L('wave', 32, 42, 0.95), L('crack', 32, 18, 0.38, 0, 'a')], earth_golem: [L('totem', 32, 32, 0.95)],
  earth_stone: [L('shield'), L('rock', 32, 30, 0.45, 0, 'a')], earth_tremor: [L('rings', 32, 42, 0.8), L('crack', 32, 20, 0.42, 0, 'a')], earth_titan: [L('mountain')],
  blood_rage: [L('drop', 32, 36, 0.92), L('fang', 32, 18, 0.38, 0, 'white')], blood_rite: [L('rune', 32, 32, 1, 0, 'a'), L('drop', 32, 32, 0.48)], blood_nova: [L('burst', 32, 32, 1), L('drop', 32, 32, 0.42, 0, 'a')],
  blood_scythe: [L('scythe')], blood_mist: [L('cloud', 32, 28, 0.92), L('drop', 22, 50, 0.24), L('drop', 34, 54, 0.22), L('drop', 44, 48, 0.24)], blood_spikes: [L('spikes'), L('drop', 32, 12, 0.24, 0, 'a')],
  blood_leech: [L('chain', 32, 34, 0.9, 0, 'steel'), L('heart', 48, 14, 0.3)], blood_thirst: [L('fang')], blood_frenzy: [L('claw')], blood_pact: [L('heart'), L('chain', 32, 32, 0.62, 0, 'steel')],
  // universal passives
  u_atk: [L('sword', 32, 32, 1, 0, 'red')], u_crit: [L('target', 32, 32, 1, 0, 'gold')], u_critdmg: [L('skull', 32, 34, 0.8, 0, 'red'), L('spark', 46, 16, 0.36, 0, 'gold')], u_atkspeed: [L('daggers', 32, 32, 1, 0, 'orange')],
  u_speed: [L('boot', 30, 34, 0.82, 0, 'teal'), L('wing', 46, 22, 0.42, 0, 'white')], u_area: [L('rings', 32, 32, 1, 0, 'purple')], u_cdr: [L('hourglass', 32, 32, 1, 0, 'blue')], u_duration: [L('infinity', 32, 32, 1, 0, 'teal')],
  u_projectile: [L('arrow', 24, 36, 0.7, -10, 'steel'), L('arrow', 38, 30, 0.7, 10, 'gold')], u_hp: [L('heart', 32, 32, 1, 0, 'red')], u_armor: [L('shield', 32, 32, 1, 0, 'steel')], u_regen: [L('heart', 32, 34, 0.9, 0, 'green'), L('plus', 46, 46, 0.34, 0, 'white')],
  u_lifesteal: [L('drop', 32, 32, 0.9, 0, 'red'), L('heart', 46, 46, 0.3, 0, 'pink')], u_magnet: [L('magnet', 32, 32, 1, 0, 'red')], u_luck: [L('clover', 32, 32, 1, 0, 'green')], u_greed: [L('coins', 32, 32, 1, 0, 'gold')],
  u_wisdom: [L('scroll', 32, 32, 1, 0, 'blue')], u_musou: [L('flame', 32, 30, 0.85, 0, 'orange'), L('fist', 32, 40, 0.55, 0, 'gold')], u_dodge: [L('feather', 32, 32, 1, 0, 'teal')], u_knockback: [L('burst', 40, 30, 0.6, 0, 'orange'), L('fist', 26, 36, 0.7, -90, 'steel')],
  u_pierce: [L('target', 32, 32, 0.75, 0, 'red'), L('arrow', 32, 32, 0.95, 0, 'steel')], u_control: [L('chain', 32, 32, 1, 0, 'steel')], u_summon: [L('flag', 32, 32, 1, 0, 'purple')], u_skilldmg: [L('orb', 32, 32, 1, 0, 'purple')],
  u_lightdmg: [L('wave', 22, 42, 0.5, 45, 'white'), L('sword', 36, 30, 0.9, 45, 'steel')], u_elite: [L('dragon', 30, 30, 0.8, 0, 'red'), L('sword', 44, 40, 0.5, 30, 'steel')], u_shield: [L('bubble', 32, 32, 1, 0, 'blue')],
  u_block: [L('shield', 32, 32, 1, 0, 'brown'), L('spark', 32, 30, 0.35, 0, 'white')], u_revive: [L('ankh', 32, 32, 1, 0, 'gold')], u_combo: [L('fist', 32, 38, 0.7, 0, 'orange'), L('spark', 18, 16, 0.32, 0, 'gold'), L('spark', 46, 18, 0.28, 0, 'gold')],
  // evolutions
  fire_dragon_roar: [L('dragon', 32, 30, 1), L('flame', 52, 46, 0.38, 30, 'a'), L('flame', 56, 28, 0.28, 60, 'a')], fire_cataclysm: [L('meteor', 22, 24, 0.58), L('meteor', 44, 36, 0.68), L('burst', 32, 54, 0.36, 0, 'a')], fire_sun_ring: [L('sun', 32, 32, 1.05, 0, 'a'), L('flame', 32, 32, 0.4)],
  frost_blizzard_lance: [L('shards', 32, 32, 1), L('snowflake', 32, 48, 0.34, 0, 'a')], frost_eternal: [L('snowflake', 32, 36, 0.95), L('halo', 32, 12, 0.48, 0, 'a')], frost_titan_spike: [L('crystals')],
  storm_arc_storm: [L('bolt', 18, 32, 0.6, -20), L('bolt', 32, 32, 0.75, 0, 'a'), L('bolt', 46, 32, 0.6, 20)], storm_mjolnir: [L('refresh', 32, 32, 1, 0, 'a'), L('hammer', 32, 32, 0.66)], storm_thor: [L('cloud', 32, 20, 0.82), L('bolt', 18, 46, 0.38), L('bolt', 32, 48, 0.44, 0, 'a'), L('bolt', 46, 46, 0.38)],
  shadow_raze_storm: [L('skull', 32, 32, 0.6), L('rings', 13, 14, 0.28, 0, 'a'), L('rings', 51, 14, 0.28, 0, 'a'), L('rings', 32, 56, 0.28, 0, 'a')], shadow_bat_lord: [L('bat', 32, 32, 1), L('crown', 32, 14, 0.34, 0, 'gold')], shadow_doom_eternal: [L('doom'), L('infinity', 32, 57, 0.32, 0, 'a')],
  holy_archangel: [L('wing', 16, 30, 0.66, 0, 0, 1), L('wing', 48, 30, 0.66), L('sword', 32, 36, 0.72, 0, 'a'), L('halo', 32, 12, 0.42)], holy_judgement_day: [L('hammer', 18, 24, 0.48, 180), L('hammer', 46, 24, 0.48, 180), L('hammer', 32, 40, 0.62, 180, 'a')],
  nature_plague_nova: [L('burst', 32, 32, 1, 0, 'a'), L('skull', 32, 32, 0.5)], nature_world_tree: [L('tree', 32, 36, 0.95), L('halo', 32, 10, 0.4, 0, 'a')], blade_tempest: [L('tornado'), L('swords', 32, 32, 0.6, 0, 'a')],
  blade_thousand: [L('blades3', 32, 32, 1), L('blades3', 32, 32, 0.6, 60, 'a')], blade_omnislash_god: [L('swords'), L('halo', 32, 10, 0.42, 0, 'a')], arcane_singularity: [L('spiral'), L('star', 32, 32, 0.34, 0, 'a')],
  arcane_barrage: [L('star', 14, 40, 0.3), L('star', 24, 22, 0.34), L('star', 32, 44, 0.38, 0, 'a'), L('star', 42, 20, 0.34), L('star', 52, 40, 0.3)], earth_avalanche: [L('mountain'), L('boulder', 44, 48, 0.38, 0, 'a')],
  earth_ragnarok: [L('mountain', 32, 40, 0.64, 0, 'a'), L('crack', 32, 30, 0.9)], blood_cataclysm: [L('wave', 32, 42, 1), L('drop', 32, 18, 0.48, 0, 'a')], blood_moon_scythe: [L('crescent', 30, 30, 0.9, -20, 'a'), L('scythe', 32, 34, 0.8)],
  // hero exclusives
  hx_knight_charge: [L('shield', 28, 32, 0.9), L('up', 50, 32, 0.34, 90, 'a')], hx_knight_banner: [L('banner')], hx_knight_aegis: [L('shield'), L('star', 32, 30, 0.42, 0, 'a')],
  hx_barb_rage: [L('flame', 32, 32, 0.95, 0, 'red'), L('axe', 32, 38, 0.5, 0, 'steel')], hx_barb_leap: [L('axe', 32, 28, 0.8), L('crack', 32, 52, 0.34, 90, 'a')], hx_barb_warcry: [L('horn')],
  hx_mage_clone: [L('star', 22, 30, 0.55), L('star', 42, 34, 0.55, 0, 'a')], hx_mage_mana: [L('orb'), L('spark', 50, 12, 0.3, 0, 'a')], hx_mage_blink: [L('portal', 32, 32, 0.82), L('spark', 50, 50, 0.3, 0, 'a')],
  hx_rogue_poison: [L('daggers'), L('drop', 32, 52, 0.28, 0, 'green')], hx_rogue_shadow: [L('hood', 22, 34, 0.6, 0, 'dark'), L('hood', 42, 34, 0.6)], hx_rogue_combo: [L('claw'), L('star', 50, 12, 0.3, 0, 'a')],
  hx_assassin_mark: [L('target', 32, 32, 1, 0, 'red')], hx_assassin_traps: [L('target', 32, 42, 0.6), L('fireball', 32, 22, 0.5, 0, 'orange')], hx_assassin_vanish: [L('hood'), L('cloud', 32, 50, 0.5, 0, 'a')],
  hx_necro_lich: [L('crown', 32, 16, 0.5, 0, 'a'), L('skull', 32, 38, 0.7)], hx_necro_plague: [L('skull'), L('drop', 48, 50, 0.3, 0, 'green')], hx_necro_bonearmor: [L('shield'), L('skull', 32, 30, 0.44, 0, 'a')],
};

const ITEM_ICONS = {
  c_iron_sword: ['steel', [L('sword')]], c_broadsword: ['steel', [L('sword', 32, 32, 1.1, 0)]], c_mithril: ['blue', [L('sword', 32, 32, 1.1, 45)]], c_hatchet: ['brown', [L('axe')]], c_gloves: ['brown', [L('glove')]],
  c_blade_joy: ['gold', [L('sword', 32, 32, 0.95, 30), L('star', 48, 14, 0.3, 0, 'a')]], c_vamp_mask: ['red', [L('mask')]], c_demon_edge: ['red', [L('sword', 32, 32, 1.05, 30), L('flame', 46, 46, 0.36, 0, 'dark')]],
  c_relic: ['gold', [L('gem', 32, 36, 0.8), L('halo', 32, 12, 0.45, 0, 'white')]], c_str_belt: ['red', [L('belt')]], c_chainmail: ['steel', [L('shield'), L('chain', 32, 30, 0.42, 0, 'a')]], c_plate: ['steel', [L('shield')]],
  c_ring_protect: ['steel', [L('ring')]], c_vitality_gem: ['green', [L('gem')]], c_vit_orb: ['green', [L('orb')]], c_cloak: ['purple', [L('hood')]], c_buckler: ['brown', [L('shield', 32, 32, 0.85)]],
  c_ring_health: ['green', [L('ring'), L('plus', 48, 48, 0.3, 0, 'white')]], c_robe: ['blue', [L('hood')]], c_int_cloak: ['purple', [L('hood', 32, 32, 0.9), L('star', 32, 52, 0.25, 0, 'a')]], c_energy_orb: ['blue', [L('orb')]],
  c_crystal: ['purple', [L('crystal')]], c_ghost_staff: ['teal', [L('staff')]], c_point_booster: ['blue', [L('gem', 32, 36, 0.8), L('up', 32, 14, 0.32, 0, 'white')]], c_elven_band: ['green', [L('belt')]],
  c_agi_slippers: ['teal', [L('boot')]], c_boots: ['brown', [L('boot')]], c_crown: ['gold', [L('crown')]], c_lucky_coin: ['gold', [L('coin')]], c_lodestone: ['red', [L('magnet')]],
  i_cleaver: ['steel', [L('axe', 26, 32, 0.95), L('axe', 38, 32, 0.95, 0, 0, 1)]], i_frenzy_blade: ['red', [L('sword', 32, 32, 1, 30), L('claw', 32, 32, 0.6, 0, 'a')]], i_crusher: ['steel', [L('hammer')]],
  i_thunder: ['blue', [L('daggers'), L('bolt', 32, 32, 0.5, 0, 'gold')]], i_bloodfang: ['red', [L('fang')]], i_unyield: ['gold', [L('shield'), L('star', 32, 30, 0.42, 0, 'white')]], i_thorn_mail: ['brown', [L('thorns', 32, 32, 1, 0, 'a'), L('shield', 32, 32, 0.6)]],
  i_aegis: ['blue', [L('shield'), L('halo', 32, 12, 0.4, 0, 'gold')]], i_codex: ['purple', [L('book')]], i_void_staff: ['purple', [L('staff'), L('spiral', 46, 14, 0.3, 0, 'a')]], i_refresher: ['blue', [L('refresh')]],
  i_blink: ['purple', [L('orb', 32, 34, 0.8), L('spark', 46, 14, 0.36, 0, 'a')]], i_wind_boots: ['teal', [L('boot', 28, 34, 0.85), L('wing', 46, 22, 0.42, 0, 'white')]], i_phase_boots: ['purple', [L('boot', 30, 34, 0.85), L('portal', 48, 20, 0.34, 0, 'a')]],
  i_radiance: ['gold', [L('sun', 32, 30, 0.95, 0, 'orange'), L('crown', 32, 36, 0.5)]], i_midas: ['gold', [L('glove'), L('coin', 44, 20, 0.32, 0, 'a')]], i_vanguard: ['red', [L('shield')]], i_heart: ['red', [L('heart')]],
  i_winter_eye: ['blue', [L('eye'), L('snowflake', 32, 32, 0.3, 0, 'white')]], i_butterfly: ['teal', [L('wing', 18, 32, 0.6, 0, 0, 1), L('wing', 46, 32, 0.6)]], i_monkey: ['gold', [L('staff', 32, 32, 1, 0)]],
  i_sange: ['red', [L('sword', 32, 32, 1, -30)]], i_yasha: ['green', [L('sword', 32, 32, 1, 30)]], i_sange_yasha: ['red', [L('sword', 32, 32, 0.9, -38), L('sword', 32, 32, 0.9, 38, 'green')]], i_mirror_ward: ['blue', [L('bubble'), L('orb', 32, 32, 0.4, 0, 'a')]],
  i_frost_relic: ['blue', [L('crystal'), L('snowflake', 32, 32, 0.4, 0, 'white')]], i_dragon_lance: ['red', [L('spear'), L('flame', 50, 12, 0.3, 0, 'orange')]], i_cyclone: ['teal', [L('tornado')]], i_orchid: ['purple', [L('eye')]],
  i_rod: ['brown', [L('staff'), L('chain', 22, 44, 0.42, 0, 'steel')]], i_glimmer: ['blue', [L('hood'), L('spark', 48, 14, 0.32, 0, 'a')]], i_urn: ['purple', [L('flask')]], i_pipe: ['green', [L('bubble'), L('horn', 32, 34, 0.5, 0, 'brown')]],
  a_worldsplitter: ['red', [L('crack', 32, 32, 0.9, 0, 'orange'), L('axe', 32, 32, 0.85)]], a_godslayer: ['gold', [L('sword', 32, 32, 1.1, 45), L('skull', 46, 46, 0.3, 0, 'red')]], a_thunder_grip: ['blue', [L('glove'), L('bolt', 32, 30, 0.5, 0, 'gold')]],
  a_satan: ['red', [L('mask'), L('drop', 32, 54, 0.26, 0, 'a')]], a_titan_ward: ['gold', [L('shield'), L('crown', 32, 28, 0.42, 0, 'white')]], a_crimson: ['red', [L('burst', 32, 32, 0.95, 0, 'orange'), L('shield', 32, 32, 0.68)]],
  a_astral_codex: ['purple', [L('book'), L('star', 32, 20, 0.36, 0, 'a')]], a_swift_heart: ['teal', [L('heart', 32, 34, 0.85), L('wing', 46, 18, 0.4, 0, 'white')]], a_sun_crown: ['gold', [L('sun', 32, 32, 1.05, 0, 'orange'), L('crown', 32, 34, 0.55)]],
  a_titan_heart: ['red', [L('mountain', 32, 40, 0.7, 0, 'brown'), L('heart', 32, 26, 0.6)]], a_eternal_winter: ['blue', [L('crown'), L('snowflake', 32, 32, 0.4, 0, 'white')]], a_bloodthorn: ['red', [L('thorns'), L('drop', 32, 32, 0.36, 0, 'a')]],
  k_heal_potion: ['red', [L('potion')]], k_big_heal: ['red', [L('potion'), L('plus', 48, 14, 0.3, 0, 'white')]], k_musou_potion: ['orange', [L('potion'), L('flame', 48, 14, 0.3, 0, 'gold')]],
  k_rage_potion: ['red', [L('potion'), L('fist', 48, 14, 0.3, 0, 'orange')]], k_shield_potion: ['blue', [L('potion'), L('shield', 48, 14, 0.3, 0, 'white')]], k_speed_potion: ['green', [L('potion'), L('wing', 48, 14, 0.32, 0, 'white')]],
  k_reroll_scroll: ['gold', [L('scroll'), L('refresh', 44, 44, 0.36, 0, 'blue')]], k_banish_scroll: ['red', [L('scroll'), L('cross', 44, 44, 0.32, 45, 'red')]], k_tp_scroll: ['blue', [L('scroll'), L('portal', 44, 44, 0.34, 0, 'purple')]],
  k_bomb: ['dark', [L('fireball', 32, 32, 1, 0, 'orange')]], k_decoy: ['brown', [L('dummy')]], k_xp_tome: ['blue', [L('book'), L('up', 32, 16, 0.3, 0, 'gold')]], k_clarity: ['blue', [L('potion'), L('hourglass', 48, 14, 0.3, 0, 'white')]],
  k_holy_water: ['white', [L('potion', 32, 32, 1, 0, 'blue'), L('cross', 32, 44, 0.3, 0, 'white')]], k_lucky_dice: ['red', [L('dice')]], k_tango: ['green', [L('leaf')]],
  n_greed_ring: ['gold', [L('ring')]], n_guard_bracer: ['steel', [L('shield', 32, 32, 0.85)]], n_nimble_chain: ['gold', [L('chain')]], n_mystic_stone: ['purple', [L('crystal')]], n_gale_feather: ['teal', [L('feather')]],
  n_wrath_pendant: ['red', [L('gem', 32, 34, 0.75), L('flame', 32, 14, 0.3, 0, 'orange')]], n_glow_moss: ['green', [L('leaf'), L('spark', 46, 46, 0.3, 0, 'white')]], n_bone_charm: ['white', [L('skullbones')]], n_hourglass: ['gold', [L('hourglass')]],
  n_bat_fang: ['purple', [L('fang')]], n_ice_shard: ['blue', [L('crystal', 32, 32, 1, 25)]], n_thunder_bell: ['blue', [L('bell'), L('bolt', 48, 14, 0.3, 0, 'gold')]], n_boomerang: ['brown', [L('crescent', 32, 32, 0.9, 90)]],
  n_elf_cloak: ['green', [L('hood')]], n_war_drum: ['red', [L('drum')]], n_lava_heart: ['orange', [L('heart'), L('flame', 32, 32, 0.4, 0, 'gold')]], n_mad_mask: ['red', [L('mask')]], n_sage_eye: ['blue', [L('eye')]],
  n_seer_crystal: ['purple', [L('crystals')]], n_undying_bone: ['white', [L('skull')]], n_shadow_blade: ['dark', [L('sword', 32, 32, 1, 45)]], n_spirit_tear: ['white', [L('drop', 32, 32, 1, 0, 'blue')]], n_giant_belt: ['brown', [L('belt')]],
  n_star_shard: ['purple', [L('star')]], n_dragon_scale: ['red', [L('shield'), L('dragon', 32, 30, 0.42, 0, 'gold')]], n_storm_eye: ['blue', [L('eye'), L('bolt', 32, 32, 0.32, 0, 'gold')]], n_blood_moon: ['red', [L('crescent')]],
  n_arcane_compass: ['purple', [L('compass')]], n_vanguard_horn: ['brown', [L('horn')]], n_time_sand: ['gold', [L('hourglass', 32, 32, 1, 20)]], n_demon_horn: ['dark', [L('horn', 32, 32, 1, 0, 'red')]], n_angel_feather: ['gold', [L('feather', 32, 32, 1, 0, 'white')]],
  n_chaos_orb: ['purple', [L('orb'), L('spiral', 32, 32, 0.5, 0, 'a')]], n_divine_sword: ['gold', [L('sword', 32, 36, 0.95), L('halo', 32, 10, 0.38, 0, 'white')]], n_endless_blade: ['steel', [L('sword', 32, 30, 0.9, 45), L('infinity', 32, 54, 0.3, 0, 'a')]],
  n_eternal_heart: ['red', [L('heart', 32, 36, 0.9), L('halo', 32, 12, 0.42, 0, 'gold')]], n_astral_gate: ['purple', [L('portal')]], n_apocalypse: ['red', [L('book'), L('skull', 32, 44, 0.28, 0, 'white')]], n_godspear: ['gold', [L('spear')]], n_fate_wheel: ['gold', [L('rune')]],
  m_revive_cross: ['gold', [L('ankh')]], m_mystery_chest: ['brown', [L('chest')]], m_xp_book: ['blue', [L('book'), L('up', 32, 16, 0.3, 0, 'gold')]], m_lucky_charm: ['green', [L('clover')]], m_wealth_charm: ['gold', [L('coins')]],
  m_faction_stone: ['purple', [L('rune', 32, 32, 1, 0, 'a'), L('crystal', 32, 32, 0.5)]], m_rarity_ticket: ['gold', [L('scroll'), L('star', 44, 44, 0.32, 0, 'purple')]], m_extra_slot_key: ['gold', [L('key')]], m_starter_gold: ['gold', [L('chest', 32, 38, 0.8), L('coin', 32, 18, 0.34)]],
  m_reroll_pack: ['blue', [L('refresh')]], m_banish_pack: ['red', [L('cross', 32, 32, 0.9, 45)]], m_musou_seal: ['orange', [L('flame', 32, 30, 0.9), L('fist', 32, 42, 0.5, 0, 'gold')]], m_elixir: ['green', [L('potion')]], m_war_banner: ['red', [L('flag')]],
  m_magnet_charm: ['gold', [L('magnet')]], m_neutral_box: ['purple', [L('chest')]], m_recipe_book: ['gold', [L('book'), L('hammer', 46, 46, 0.32, 0, 'steel')]], m_double_draft: ['blue', [L('dice', 24, 34, 0.7), L('dice', 42, 30, 0.7, 0, 'gold')]],
  m_evolve_catalyst: ['green', [L('flask'), L('spark', 48, 14, 0.32, 0, 'gold')]], m_boss_bane: ['red', [L('dragon', 30, 30, 0.82), L('sword', 46, 40, 0.5, 30, 'steel')]],
  rune_dd: ['blue', [L('swords')]], rune_haste: ['red', [L('boot', 30, 34, 0.8), L('bolt', 48, 18, 0.34, 0, 'gold')]], rune_illusion: ['gold', [L('hood', 22, 34, 0.55), L('hood', 42, 34, 0.55, 0, 'a')]], rune_invis: ['purple', [L('eye'), L('cloud', 32, 46, 0.5, 0, 'dark')]],
  rune_regen: ['green', [L('heart'), L('plus', 46, 46, 0.3, 0, 'white')]], rune_arcane: ['pink', [L('star')]], rune_shield: ['teal', [L('bubble')]], rune_bounty: ['orange', [L('coins')]],
};
const HERO_ICONS = {
  knight: ['holy', [L('shield', 28, 34, 0.8), L('sword', 40, 30, 0.7, 30, 'steel')]], barbarian: ['blood', [L('axe', 32, 32, 1, 15, 'steel')]], mage: ['arcane', [L('staff', 32, 32, 1)]],
  rogue: ['blade', [L('daggers')]], assassin: ['shadow', [L('hood', 32, 30, 0.85), L('crossbow', 32, 46, 0.42, 0, 'steel')]], necromancer: ['shadow', [L('staff', 40, 32, 0.8, 0, 'green'), L('skull', 26, 32, 0.6, 0, 'white')]],
};
const FACTION_ICONS = { fire: 'flame', frost: 'snowflake', storm: 'bolt', shadow: 'skull', holy: 'sun', nature: 'leaf', blade: 'sword', arcane: 'star', earth: 'mountain', blood: 'drop' };

// ------------------------------------------------------------------ renderer
function colorsFor(main, accent) {
  return {
    main: { fill: 'url(#e)', line: mix(main, '#000000', 0.78), light: mix(main, '#ffffff', 0.55), dark: mix(main, '#000000', 0.55), accent: accent, white: '#ffffff' },
    accent: { fill: 'url(#a)', line: mix(accent, '#000000', 0.78), light: mix(accent, '#ffffff', 0.5), dark: mix(accent, '#000000', 0.55), accent: main, white: '#ffffff' },
  };
}
function pattern(kind, c) {
  const o = 'stroke-opacity="0.18"';
  switch (kind) {
    case 'rays': return Array.from({ length: 12 }, (_, i) => `<path d="M32 32L${(32 + Math.cos(i * 0.5236) * 50).toFixed(1)} ${(32 + Math.sin(i * 0.5236) * 50).toFixed(1)}" stroke="${c}" stroke-width="5" ${o}/>`).join('');
    case 'hex': return [[16, 12], [48, 12], [32, 40], [8, 44], [56, 44], [32, 6]].map(([x, y]) => `<path d="M${x} ${y - 7}L${x + 6} ${y - 3.5}V${y + 3.5}L${x} ${y + 7}L${x - 6} ${y + 3.5}V${y - 3.5}Z" fill="none" stroke="${c}" stroke-width="1.2" ${o}/>`).join('');
    case 'zig': return `<path d="M0 14L10 8L20 14L30 8L40 14L50 8L64 14M0 54L10 48L20 54L30 48L40 54L50 48L64 54" fill="none" stroke="${c}" stroke-width="1.6" ${o}/>`;
    case 'mist': return `<circle cx="12" cy="50" r="14" fill="${c}" opacity="0.1"/><circle cx="52" cy="14" r="12" fill="${c}" opacity="0.1"/>`;
    case 'dots': return Array.from({ length: 10 }, (_, i) => `<circle cx="${(i * 37) % 64}" cy="${(i * 23 + 7) % 64}" r="${1 + (i % 3)}" fill="${c}" opacity="0.2"/>`).join('');
    case 'diag': return `<path d="M-8 24L24 -8M-8 48L48 -8M8 72L72 8M32 72L72 32" stroke="${c}" stroke-width="2" ${o}/>`;
    case 'runes': return `<circle cx="32" cy="32" r="28" fill="none" stroke="${c}" stroke-width="1.2" ${o}/><circle cx="32" cy="32" r="22" fill="none" stroke="${c}" stroke-width="0.8" stroke-dasharray="3 4" ${o}/>`;
    case 'cracks': return `<path d="M0 20L14 26L20 40L36 44M64 12L50 22L48 36M40 64L42 52L56 48" fill="none" stroke="${c}" stroke-width="1.4" ${o}/>`;
    default: return '';
  }
}
function layerSvg(layer, base, accentTheme) {
  const [shape, x, y, k, r, c, flip] = layer;
  const fn = SHAPES[shape];
  if (!fn) return { grad: '', svg: '' };
  let cols = base.main;
  let grad = '';
  if (c === 'a') cols = base.accent;
  else if (c && THEME[c]) {
    const [m, a] = THEME[c]; const id = `t${c}`;
    grad = `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(m, '#ffffff', 0.45)}"/><stop offset="0.5" stop-color="${m}"/><stop offset="1" stop-color="${mix(m, '#000000', 0.45)}"/></linearGradient>`;
    cols = { fill: `url(#${id})`, line: mix(m, '#000000', 0.78), light: mix(m, '#ffffff', 0.55), dark: mix(m, '#000000', 0.55), accent: a, white: '#ffffff' };
  }
  const inner = fn(cols);
  const flipT = flip ? ' translate(64 0) scale(-1 1)' : '';
  return { grad, svg: `<g transform="translate(${x} ${y}) rotate(${r}) scale(${k}) translate(-32 -32)${flipT}">${inner}</g>` };
}
export function renderIcon(themeName, layers, { evolved = false, hero = false, bgTheme } = {}) {
  const [main, accent] = THEME[themeName] || THEME.steel;
  const base = colorsFor(main, accent);
  const bgMain = THEME[bgTheme || themeName]?.[0] || main;
  const bgIn = mix(bgMain, '#0a0812', 0.62), bgOut = mix(bgMain, '#05040a', 0.88);
  const parts = layers.map((l) => layerSvg(l, base));
  const grads = [...new Set(parts.map((p) => p.grad).filter(Boolean))].join('');
  const evo = evolved ? `<circle cx="32" cy="32" r="27" fill="url(#ev)" opacity="0.9"/>${[0, 90, 180, 270].map((d) => `<path transform="rotate(${d} 32 32)" d="M32 1L34 7L32 6L30 7Z" fill="#fff6c0"/>`).join('')}` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>
<radialGradient id="bg" cx="0.5" cy="0.42" r="0.7"><stop offset="0" stop-color="${bgIn}"/><stop offset="1" stop-color="${bgOut}"/></radialGradient>
<radialGradient id="ev" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff2a0" stop-opacity="0.55"/><stop offset="0.7" stop-color="#ade55c" stop-opacity="0.18"/><stop offset="1" stop-color="#2ad5ff" stop-opacity="0"/></radialGradient>
<linearGradient id="e" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(main, '#ffffff', 0.5)}"/><stop offset="0.48" stop-color="${main}"/><stop offset="1" stop-color="${mix(main, '#000000', 0.42)}"/></linearGradient>
<linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(accent, '#ffffff', 0.45)}"/><stop offset="0.5" stop-color="${accent}"/><stop offset="1" stop-color="${mix(accent, '#000000', 0.4)}"/></linearGradient>
${grads}
<filter id="gl" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#000" flood-opacity="0.85"/><feDropShadow dx="0" dy="0" stdDeviation="2.6" flood-color="${main}" flood-opacity="0.55"/></filter>
</defs><rect width="64" height="64" fill="url(#bg)"/>${pattern(BG_PATTERN[themeName] || BG_PATTERN[bgTheme] || 'dots', main)}${evo}
<g filter="url(#gl)">${parts.map((p) => p.svg).join('')}</g>${hero ? '<path d="M0 0H18L0 18Z" fill="#ffd76a" opacity="0.9"/>' : ''}
<rect x="1" y="1" width="62" height="62" rx="6" fill="none" stroke="#fff" stroke-opacity="0.08"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const cache = new Map();
const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

export function skillIconUrl(id) {
  return memo(`s:${id}`, () => {
    const s = SKILL[id];
    const layers = SKILL_ICONS[id] || [L(FACTION_ICONS[s?.faction] || 'star')];
    const theme = s?.faction || (s?.hero ? 'gold' : 'steel');
    return renderIcon(theme, layers, { evolved: !!s?.evolved, hero: !!s?.hero });
  });
}
export function itemIconUrl(id) {
  return memo(`i:${id}`, () => {
    const spec = ITEM_ICONS[id];
    if (!spec) return renderIcon('steel', [L('gem')]);
    return renderIcon(spec[0], spec[1], { evolved: !!ITEM[id]?.artifact });
  });
}
export function heroIconUrl(id) { return memo(`h:${id}`, () => { const [t, l] = HERO_ICONS[id] || ['steel', [L('sword')]]; return renderIcon(t, l); }); }
export function factionIconUrl(id) { return memo(`f:${id}`, () => renderIcon(id, [L(FACTION_ICONS[id] || 'star', 32, 32, 0.95)])); }
const ENEMY_ICONS = {
  skel_minion: ['white', [L('skull')]], skel_warrior: ['steel', [L('skull', 32, 36, 0.8), L('axe', 46, 20, 0.4, 20)]], skel_archer: ['brown', [L('skull', 30, 34, 0.8), L('crossbow', 46, 18, 0.38, 0, 'steel')]],
  skel_mage: ['purple', [L('skull', 32, 36, 0.8), L('staff', 46, 18, 0.4)]], blood_berserker: ['red', [L('skull', 32, 36, 0.8), L('horn', 20, 16, 0.4, 0, 'white'), L('horn', 44, 16, 0.4, 0, 'white', 1)]],
  frost_wizard: ['blue', [L('skull', 32, 36, 0.8), L('crystal', 32, 12, 0.32, 0, 'white')]], hellfire_skull: ['orange', [L('skull', 32, 36, 0.8), L('flame', 32, 12, 0.36, 0, 'gold')]], bone_shieldguard: ['steel', [L('shield'), L('skull', 32, 30, 0.42, 0, 'white')]],
  bone_giant: ['brown', [L('skull', 32, 32, 1, 0, 'white')]], shadow_stalker: ['dark', [L('hood'), L('daggers', 32, 50, 0.36, 0, 'steel')]], ember_archer: ['orange', [L('skull', 30, 34, 0.8, 0, 'brown'), L('arrow', 46, 18, 0.4, 0, 'orange')]],
  plague_shaman: ['green', [L('skull', 32, 36, 0.8), L('drop', 32, 12, 0.3)]], bone_standard: ['gold', [L('flag')]], slime: ['green', [L('drop', 32, 34, 0.95)]], vampire_bat: ['purple', [L('bat')]], gargoyle: ['steel', [L('mask'), L('horn', 18, 14, 0.36, 0, 'white'), L('horn', 46, 14, 0.36, 0, 'white', 1)]],
  lava_imp: ['orange', [L('flame', 32, 34, 0.8), L('horn', 20, 14, 0.34, 0, 'dark'), L('horn', 44, 14, 0.34, 0, 'dark', 1)]], thorn_treant: ['nature', [L('tree')]],
  web_spider: ['white', [L('web', 32, 32, 1, 0, 'steel'), L('spider', 32, 36, 0.7, 0, 'brown')]], venom_spider: ['green', [L('spider', 32, 34, 0.95, 0, 'dark'), L('drop', 48, 14, 0.32, 0, 'green')]],
  soul_wraith: ['teal', [L('ghost', 30, 32, 0.95, 0, 'dark'), L('chain', 46, 46, 0.38, 0, 'teal')]], banshee: ['white', [L('scream', 32, 32, 0.95, 0, 'white')]],
  basilisk: ['brown', [L('lizard', 32, 36, 0.95, 0, 'green'), L('eye', 46, 14, 0.36, 0, 'gold')]], frost_lizard: ['blue', [L('lizard', 32, 36, 0.95, 0, 'blue'), L('snowflake', 46, 14, 0.32, 0, 'white')]],
  myconid: ['pink', [L('mushroom', 32, 34, 0.95, 0, 'purple'), L('spiral', 48, 14, 0.3, 0, 'green')]], dire_wolf: ['red', [L('wolf', 32, 32, 0.95, 0, 'steel'), L('drop', 48, 50, 0.3, 0, 'red')]],
  hex_doctor: ['green', [L('mask', 30, 30, 0.9, 0, 'brown'), L('frog', 46, 46, 0.36, 0, 'green')]], nullifier: ['purple', [L('skull', 32, 34, 0.75, 0, 'steel'), L('nosign', 32, 32, 1, 0, 'purple')]],
  chain_jailer: ['orange', [L('skull', 28, 36, 0.72, 0, 'brown'), L('hook', 46, 20, 0.42, 0, 'steel')]], bomber: ['red', [L('skull', 24, 40, 0.6, 0, 'brown'), L('bomb', 40, 26, 0.62, 0, 'dark')]],
  time_warden: ['gold', [L('skull', 32, 38, 0.66, 0, 'white'), L('clock', 32, 15, 0.4, 0, 'blue')]], acid_slime: ['green', [L('drop', 32, 34, 0.95, 0, '#c8ff3a'), L('bubble', 47, 18, 0.34, 0, 'green')]],
  shadow_bat: ['dark', [L('bat', 32, 32, 1, 0, 'purple'), L('eye', 32, 52, 0.28, 0, 'pink')]],
};
const DEBUFF_ICONS = {
  slow: ['blue', [L('boot', 30, 34, 0.85, 0, 'steel'), L('snowflake', 47, 16, 0.34, 0, 'white')]], freeze: ['blue', [L('crystals', 32, 32, 0.95, 0, 'frost')]], root: ['green', [L('vines', 32, 32, 0.95, 0, 'nature')]],
  burn: ['orange', [L('flame', 32, 32, 0.95, 0, 'fire')]], webbed: ['white', [L('web', 32, 32, 1, 0, 'white')]], poison: ['green', [L('drop', 32, 32, 0.9, 0, 'green'), L('skull', 32, 39, 0.34, 0, 'dark')]],
  fear: ['purple', [L('scream', 32, 32, 0.95, 0, 'purple')]], tether: ['teal', [L('chain', 32, 32, 0.95, 0, 'teal'), L('ghost', 47, 16, 0.34, 0, 'white')]],
  frostbite: ['blue', [L('snowflake', 32, 32, 0.9, 0, 'frost'), L('drop', 48, 48, 0.3, 0, 'blue')]], hex: ['green', [L('frog', 32, 32, 0.95, 0, 'green')]],
  silence: ['purple', [L('rune', 32, 32, 0.78, 0, 'white'), L('nosign', 32, 32, 1, 0, 'red')]], hooked: ['orange', [L('hook', 32, 32, 0.95, 0, 'steel')]],
  petrify: ['brown', [L('rock', 32, 34, 0.95, 0, 'steel'), L('crack', 32, 32, 0.8, 0, 'dark')]], confuse: ['pink', [L('spiral', 32, 32, 0.95, 0, 'pink')]],
  corrode: ['green', [L('shield', 32, 30, 0.88, 0, 'steel'), L('drop', 42, 44, 0.38, 0, '#c8ff3a')]], bomb: ['red', [L('bomb', 32, 32, 0.95, 0, 'dark')]],
  timeslow: ['gold', [L('hourglass', 32, 32, 0.9, 0, 'gold')]], bleed: ['red', [L('drop', 30, 34, 0.85, 0, 'red'), L('claw', 46, 17, 0.38, 0, 'white')]],
  blind: ['dark', [L('eye', 32, 32, 0.9, 0, 'white'), L('nosign', 32, 32, 1, 0, 'red')]],
};
const NODE_ICONS = { battle: ['steel', [L('swords')]], elite: ['red', [L('doom')]], shop: ['gold', [L('coins')]], event: ['purple', [L('eye')]], rest: ['orange', [L('flame')]], treasure: ['gold', [L('chest')]], boss: ['red', [L('crown', 32, 20, 0.6, 0, 'gold'), L('skull', 32, 40, 0.6)]] };
const EVENT_ICONS = {
  ev_altar: ['blood', [L('rune', 32, 32, 1, 0, 'a'), L('drop', 32, 32, 0.5)]], ev_gamble: ['gold', [L('chest', 30, 36, 0.8), L('dice', 46, 18, 0.4, 0, 'white')]], ev_smith: ['steel', [L('hammer')]], ev_merchant: ['gold', [L('coins')]],
  ev_cursed: ['dark', [L('chest', 32, 38, 0.8, 0, 'brown'), L('skull', 32, 18, 0.4, 0, 'green')]], ev_portal: ['purple', [L('portal')]], ev_shrine: ['holy', [L('halo', 32, 30, 1)]], ev_knight: ['steel', [L('shield', 28, 34, 0.8), L('sword', 42, 30, 0.7, 30, 'gold')]],
  ev_spring: ['blue', [L('drop')]], ev_bandits: ['dark', [L('daggers', 32, 32, 1, 0, 'steel')]], ev_scales: ['gold', [L('refresh')]], ev_astrologer: ['purple', [L('eye', 32, 38, 0.8), L('star', 32, 14, 0.36, 0, 'gold')]], ev_rack: ['steel', [L('swords')]],
  ev_cauldron: ['green', [L('flask')]], ev_statue: ['brown', [L('totem')]], ev_caravan: ['teal', [L('ghost', 32, 32, 0.9), L('coins', 46, 46, 0.36, 0, 'gold')]], ev_training: ['brown', [L('dummy')]], ev_fog: ['white', [L('cloud')]],
  ev_berserker: ['red', [L('flame', 32, 32, 0.95, 0, 'red'), L('axe', 32, 36, 0.5, 0, 'steel')]], ev_guardian: ['blue', [L('shield'), L('star', 32, 30, 0.4, 0, 'gold')]], ev_map: ['brown', [L('scroll')]], ev_scientist: ['green', [L('flask'), L('spark', 48, 14, 0.3, 0, 'gold')]],
  ev_wheel: ['gold', [L('rune')]], ev_blessing: ['holy', [L('drop', 32, 36, 0.8, 0, 'blue'), L('halo', 32, 12, 0.45)]],
};
export const nodeIconUrl = (type) => memo(`n:${type}`, () => { const [t, l] = NODE_ICONS[type] || NODE_ICONS.battle; return renderIcon(t, l); });
export const eventIconUrl = (id) => memo(`v:${id}`, () => { const [t, l] = EVENT_ICONS[id] || ['purple', [L('eye')]]; return renderIcon(t, l); });
export const miscIconUrl = (key) => memo(`m:${key}`, () => ({ rest: renderIcon('orange', [L('flame')]), treasure: renderIcon('gold', [L('chest')]), pause: renderIcon('blue', [L('hourglass')]), result: renderIcon('gold', [L('star')]), gold: renderIcon('gold', [L('coins')]), heal: renderIcon('red', [L('heart'), L('plus', 46, 46, 0.32, 0, 'white')]), buff: renderIcon('gold', [L('up')]) }[key] || renderIcon('steel', [L('star')])));
export function enemyIconUrl(id) { return memo(`e:${id}`, () => { const [t, l] = ENEMY_ICONS[id] || ['red', [L('skull')]]; return renderIcon(t, l); }); }
export function debuffIconUrl(id) { return memo(`d:${id}`, () => { const [t, l] = DEBUFF_ICONS[id] || ['red', [L('skull')]]; return renderIcon(t, l); }); }
export function bossIconUrl() { return memo('boss', () => renderIcon('red', [L('doom')])); }
export const ICON_COVERAGE = { skills: SKILL_ICONS, items: ITEM_ICONS, enemies: ENEMY_ICONS, debuffs: DEBUFF_ICONS };
