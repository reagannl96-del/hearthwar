# Hearthwar

A fast-paced, single-player village war game in the spirit of Tribal Wars, with a
3D autumn village, AI rulers, and a pace built so you can really advance within a day.

## Play

- **Easiest:** double-click `Play.bat`. The first run installs dependencies, then
  the game opens in your browser at http://localhost:5173.
- **No server:** run `npm run build` once, then open `dist/index.html` directly.
  It is one self-contained file.

Your realm saves automatically in the browser (every ~20 seconds and whenever you
leave the tab). Use **Settings → Export save** to back it up or move it to another browser.

## What's in the game

- **17 buildings** with Tribal Wars-style costs, build times and requirements,
  shown in a 3D low-poly village (drag to pan, scroll to zoom, right-drag to rotate).
  Models change as buildings level up: longhouse → hall → stone keep, palisade → stone walls.
- **12 unit types**, smithy research with upgrade levels, recruitment queues, militia.
- **Combat** with the Tribal Wars formulas: unit classes, wall bonus, rams, catapults,
  luck, morale, scouting, loot and hiding place.
- **Noblemen and crowns**, loyalty, conquest, and **noble trains** (Rally point → Noble train):
  a clearing wave plus up to five noble waves that land 100 ms apart.
- **AI rulers** with personalities (raider, warlord, defender, conqueror). They build,
  farm barbarians, trade, dodge attacks, scout, attack each other and you, form tribes,
  retaliate, and conquer villages with their own noble trains.
- **Extras:** farm assistant with auto-repeating raids, scavenging, paladin with
  legendary items, market and trading post, battle simulator, quests and achievements,
  rankings, a news chronicle, bonus villages, and beginner protection.
- **Single-player time controls:** pause, 2×/4× fast-forward, skip ahead, and optional
  offline progress (the world keeps running while the game is closed).

## World speed

Pick a pace when founding a realm (and change it later in Settings):

| Pace     | Economy | Marching | Feel |
|----------|---------|----------|------|
| Relaxed  | 60×     | 35×      | check in a few times a day |
| Standard | 150×    | 80×      | first nobleman within a day |
| Blitz    | 400×    | 200×     | a whole war in one evening |

## Online multiplayer

One shared world with Google sign-in: website on Vercel, game server on Railway,
accounts and saves in Supabase. **See [DEPLOY.md](DEPLOY.md) for the step-by-step setup.**
To try it locally with a fake sign-in: `npm run server:local` + `npm run dev:online`.

## Architecture

- `src/engine/` is pure game logic with no DOM. The same code can run in Node.
- Every player action is a serializable message (`applyAction` in `engine/actions.ts`).
- The UI only reads player-scoped views (`engine/view.ts`), so fog of war is enforced.
- `src/host/local.ts` runs a single-player world in the browser; `src/host/remote.ts` plays the
  shared world through `server/index.ts`, which runs the same engine in Node.
- `src/engine/shadow.ts` is the fog of war: players only ever receive what they may see.

## Development

```
npm run dev        # dev server
npm test           # engine tests (combat, full player flows, 16h AI simulation)
npm run build      # typecheck + single-file build in dist/
```
