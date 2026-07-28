# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Classic Tetris implemented in vanilla JavaScript, HTML5 Canvas, and CSS. No dependencies, no build process, no package.json.

## Running the game

Open `index.html` directly in a browser, or serve it locally:

```bash
python3 -m http.server 8000
npx serve .
php -S localhost:8000
```

There are no build, lint, or test commands — this project has none configured.

## Architecture

Three files, no modules/bundler — `game.js` is loaded directly via a `<script>` tag in `index.html` and relies on globals.

- `index.html` — DOM structure: main `<canvas id="board">` (300×600), a `<canvas id="next-canvas">` for the next-piece preview, the score/lines/level panel, and the pause/game-over overlay.
- `style.css` — dark/retro visual theme (flexbox layout, backdrop-filter overlays).
- `game.js` — all game logic, organized around a small set of core mechanics:
  - **Board model**: `ROWS × COLS` matrix where each cell is `0` (empty) or a color index 1–7 identifying a locked piece.
  - **Pieces**: the 7 tetrominoes (`PIECES`) as square matrices. Rotation (`rotateCW`) transposes + reverses rows; `tryRotate` applies wall kicks by testing offsets `[0, -1, 1, -2, 2]` until a non-colliding position is found.
  - **Collision** (`collide`): checks board bounds and overlap with locked cells.
  - **Game loop** (`loop`): driven by `requestAnimationFrame`, accumulates elapsed time (`dropAccum`) and advances the piece down a row once `dropInterval` is exceeded.
  - **Locking/clearing** (`lockPiece` → `merge` + `clearLines` + `spawn`): completed rows are spliced out and empty rows unshifted at the top.
  - **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by current `level`; hard drop adds 2 pts/cell, soft drop 1 pt/row.
  - **Level/speed**: level increases every 10 lines cleared; `dropInterval = max(100, 1000 - (level-1)*90)` ms.
  - **Ghost piece** (`ghostY`): projects the current piece straight down to its landing row, drawn at `globalAlpha = 0.2`.
  - Game state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, timing vars) lives in module-level `let` bindings, not a class/object — keep this in mind when adding features that need new state.

### Control flow

`init()` creates the board, spawns pieces, and starts `loop()`. Keydown events (`ArrowLeft/Right/Down/Up`, `KeyX` for rotate, `Space` for hard drop, `KeyP` for pause) mutate `current` directly and call `updateHUD()`. A newly spawned piece that immediately collides triggers `endGame()`.

### Tunable constants (top of `game.js`)

`COLS`, `ROWS`, `BLOCK` (cell size in px), `COLORS`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `width`/`height` attributes of `<canvas id="board">` in `index.html` to match (`COLS × BLOCK` and `ROWS × BLOCK`).
