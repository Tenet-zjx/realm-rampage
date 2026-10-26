# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project
幻域无双 · Realm Rampage — a 3D fantasy musou-style action roguelike for the browser (desktop first, touch supported). Three.js + Vite, plain ES modules, no framework, no TypeScript. All player-facing text is Simplified Chinese (English only for the game name). README.md / DESIGN.md are Chinese and record per-version decisions; only claim results that were actually verified.

`/Users/jason/AGENTS.md` describes an unrelated dashboard project; ignore it here.

## Commands
```sh
npm ci                 # npm cache in ~/.npm is root-owned on this machine: export npm_config_cache="$TMPDIR/realm-npm-cache"
npm run dev            # Vite on 127.0.0.1:5190
npm test               # node --test tests/*.test.js
npm run test:ui        # build + Playwright (tests/ui, playwright.config.mjs) on its own dev server :5199, local Chrome
npm run build          # dist/ — NOTE: the public cpolar URL serves dist/, so a build changes the live site
npm run assets:fetch   # download pinned KayKit CC0 sources into art/source/ (gitignored)
npm run models:build   # headless Blender: process sources -> public/assets/models/*.glb + manifest.json
./scripts/public-preview.sh start|stop|status|update   # LaunchAgents: vite preview :4180 + cpolar wildwoodguardiansgame
```

## Dev tooling
- `window.__realmApi` (dev only): `startRun(sel)`, `game`, `renderer`, `actions`, `profile`, `input`.
- Visual QA scripts (need `npm run dev`): `node scripts/play.mjs <mode> <hero> <secs> <outPrefix> [w h chapter]`, `node scripts/vfxcheck.mjs <out> <skillIds> [hero] [bossId]`, `node scripts/threatcheck.mjs <out> [enemyIds] [w h]` (special enemies + debuff HUD), `node scripts/uicheck.mjs <out> [w h]`, `node scripts/objcheck.mjs <out>`, `node scripts/shot.mjs <url> <png>`, `/icons.html?set=skills|items|misc|threats` (icon gallery); `npm run bench` writes docs/verification/benchmark.json. All use local Chrome via Playwright.
- Balance sweep (no browser): `node scripts/balance.mjs [chapters] [difficulties] [heroes] [seed]` — scripted bot, prints result, min HP and which debuffs landed.
- `/viewer.html?ids=knight,skel_minion&clip=Idle` (dev only) previews models.
- npm cache: use `npm_config_cache=$TMPDIR/realm-npm-cache` (the default ~/.npm cache is root-owned here).

## Conventions
- Simulation (`src/game/`) is pure data + logic, no THREE/DOM, seeded RNG; presentation reads `game.events` each frame.
- Data tables in `src/game/content/` are the single source of truth for heroes, skills, factions, items, enemies, stages.
- Rarity and faction must always be shown as text, never by colour alone.
- Every enemy area attack must show a ground telegraph matching its real hit radius. Decal `angle` = game facing (uv +y points along `sin/cos(angle)`).
- Hero debuffs live in `content/debuffs.js` + `game/debuffs.js` (`applyDebuff`, `debuffMods`); `cc` debuffs are blocked by CC immunity and broken by musou. Special enemies declare `debuffs`, `ability`, `squadMax`, `maxAlive`.
- Blender: creature `anim()` keys use world axes for 'l'/'s' (x right, y back, z up) and bone-local Euler for 'r'.
- Commits: Conventional Commits.
