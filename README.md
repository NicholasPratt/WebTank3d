# Cyber Commander

Open `tank.html` in a modern desktop browser and click the game to capture the pointer. All runtime assets are stored locally, so the game works without an internet connection.

## Controls

- `W` / `S`: drive forward or reverse
- `A` / `D`: rotate the hull
- Mouse: aim the turret
- Left mouse: cannon
- Right mouse: machine gun
- `R`: consume a stored power pack
- `Esc`: pause and open settings

## Debug and balancing modes

Append `?debug=1` to expose the `N` wave-skip key. Append `?sandbox=1` for a fixed four-enemy combat encounter. The running game is available as `window.cyberCommander`; call `cyberCommander.debugSnapshot()` in the browser console to capture deterministic balance state. `?sandbox=1&autostart=1` is intended for automated smoke tests.

## Structure

- `tank.html`: accessible page structure and overlays
- `tank.css`: presentation and responsive HUD
- `src/game-config.js`: central balance configuration
- `src/audio-manager.js`: synthesized audio and master volume
- `src/cyber-commander.js`: renderer, entities, combat, AI, progression, and game loop
- `vendor/`: pinned local Three.js r128 and font assets

## Validation

Run:

```sh
node --check src/game-config.js
node --check src/audio-manager.js
node --check src/cyber-commander.js
```

For a browser smoke test, open `tank.html?sandbox=1&autostart=1` and confirm that the HUD reports four threats.
