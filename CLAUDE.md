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
npm run test:ui        # build + Playwright against vite preview :4180 using local Chrome
npm run build          # dist/ — NOTE: the public cpolar URL serves dist/, so a build changes the live site
npm run assets:fetch   # download pinned KayKit CC0 sources into art/source/ (gitignored)
npm run models:build   # headless Blender: process sources -> public/assets/models/*.glb + manifest.json
./scripts/public-preview.sh start|stop|status|update   # LaunchAgents: vite preview :4180 + cpolar wildwoodguardiansgame
```

## Conventions
- Simulation (`src/game/`) is pure data + logic, no THREE/DOM, seeded RNG; presentation reads `game.events` each frame.
- Data tables in `src/game/content/` are the single source of truth for heroes, skills, factions, items, enemies, stages.
- Rarity and faction must always be shown as text, never by colour alone.
- Every enemy area attack must show a ground telegraph matching its real hit radius.
- Commits: Conventional Commits.
