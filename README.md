# Browser Platformer Prototype

Small browser platformer prototype built as a static canvas app with sprite
sheets, layered parallax backgrounds, and background music.

## Generation Notice

The art, music, and code in this repository were generated with assistance from
large language models and related AI generation tools.

## Run

```bash
python3 -m http.server 8765
```

Open <http://127.0.0.1:8765/>.

## Controls

- Player 1: left/right arrows to move; Space or up arrow to jump
- Player 2: A/D to move; W to jump
- Player 2 near Player 1: S to hop on for a piggyback ride; S again to hop off
- Piggyback ride: left/right arrows to run; Space or up arrow to jump; release and hold Space again while airborne to fly; while holding Space, use up/down arrows to climb or descend
- Shift or R: rewind recent movement
- M or the speaker button: mute/unmute background music
- Touch/drag left or right side: move; center touch: jump

The camera follows the midpoint between the two players, easing out up to 30%
when they separate so both stay in frame for moderate splits.

## Project Layout

- `index.html` loads the canvas and module script.
- `styles.css` owns the full-viewport page shell.
- `src/game.js` contains game state, input, physics, animation, camera, and drawing.
- `assets/` contains sprite sheets, cutouts, and background layers.
- `tools/` contains one-off asset extraction helpers.

Runtime image files use WebP copies for faster loading. The original PNG assets stay in the repo next to the WebP files as source-quality originals.

## Assets

- `assets/` contains generated character sheets, cutouts, parallax layers, and
  background music.
- Character sheets cover idle, walking, turning, jumping, stopping, mounting,
  dismounting, running, flying, and landing animations.
- `assets/layers/` contains background and foreground layers.
- `assets/audio/` contains the generated background music tracks.
- `tools/` contains one-off asset extraction helpers.

The current character animation uses the newer sprite sheets: mirrored stepping-in-place while idle, stop-sheet reverse when starting to walk, the walking sheet while moving, the stop sheet when releasing movement, the jump sheet while airborne and landing, and the turn sheet when changing direction. Piggyback mode adds a combined jump, hold-to-fly transition, flying loop, and landing animation. The front-facing 180-degree turn uses the new turn sheet; the optional back-facing turn still uses the earlier back-view cutouts because the newer sheets do not include a back view.
