# Daniel Platformer

Small browser platformer prototype for Daniel and Kerem, built as a static
canvas app with hand-painted sprite sheets and layered parallax backgrounds.

## Run

```bash
cd /Users/isaacshochat/Documents/daniel-platformer
python3 -m http.server 8765
```

Open <http://127.0.0.1:8765/>.

## Controls

- Daniel: left/right arrows to move; Space or up arrow to jump
- Girl: A/D to move; W to jump
- Girl near Daniel: S to hop on for a piggyback ride; S again to hop off
- Shift or R: rewind recent movement
- M or the speaker button: mute/unmute background music
- Touch/drag left or right side: move; center touch: jump

The camera follows the midpoint between Daniel and Kerem, easing out up to 30% when they separate so both stay in frame for moderate splits.

## Project Layout

- `index.html` loads the canvas and module script.
- `styles.css` owns the full-viewport page shell.
- `src/game.js` contains game state, input, physics, animation, camera, and drawing.
- `assets/` contains sprite sheets, cutouts, and background layers.
- `tools/` contains one-off asset extraction helpers.

Runtime image files use WebP copies for faster loading. The original PNG assets stay in the repo next to the WebP files as source-quality originals.

## Assets

- `assets/daniel-idle-sheet.png` is the original supplied sheet.
- `assets/daniel-idle-cutout.png` is the first extracted transparent model.
- `assets/daniel-pose-*.png` are the lower-row pose cutouts used for direction changes.
- `assets/daniel-step-sheet.png` is the newer 6x6 stepping-in-place sheet.
- `assets/daniel-walk-sheet.png` is the newer 6x6 walking sheet.
- `assets/daniel-turn-sheet.png` is the newer 6x6 front-facing turn sheet.
- `assets/daniel-jump-sheet.png` is the newer 6x6 jump sheet.
- `assets/daniel-stop-sheet.png` is the newer 5x5 stopping sheet, also played in reverse for starting to walk.
- `assets/girl-*.png` are the second character sheets for idle, walking, turning, jumping, and stopping.
- `assets/piggyback-*.png` are the combined Daniel-and-girl sheets for mounting, dismounting, idle, turning, start-run, stop-run, and running.
- `assets/layers/front-foreground-faded.png` is the low-opacity plant silhouette layer drawn in front of the characters.
- `assets/audio/braided-path*.mp3` are the background music tracks.
- `tools/extract_daniel.py` regenerates the cutouts from the sheet.

The current character animation uses the newer sprite sheets: mirrored stepping-in-place while idle, stop-sheet reverse when starting to walk, the walking sheet while moving, the stop sheet when releasing movement, the jump sheet while airborne and landing, and the turn sheet when changing direction. The front-facing 180-degree turn uses the new turn sheet; the optional back-facing turn still uses the earlier back-view cutouts because the newer sheets do not include a back view.
