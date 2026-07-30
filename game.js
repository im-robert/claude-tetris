'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const leaderboardListEl = document.getElementById('leaderboard-list');
const leaderboardStatsEl = document.getElementById('leaderboard-stats');
const overlayLeaderboardListEl = document.getElementById('overlay-leaderboard-list');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const nameEntryEl = document.getElementById('name-entry');
const nameInputEl = document.getElementById('name-input');
const saveScoreBtn = document.getElementById('save-score-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridColor;
let combo, maxCombo;
let pendingEntry = null; // holds the run's stats while awaiting name entry

const THEME_KEY = 'tetris-theme';
const LEADERBOARD_KEY = 'tetris-leaderboard';

function getLeaderboard() {
  return JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) || [];
}

function setLeaderboard(entries) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
}

function qualifiesForLeaderboard(candidateScore) {
  const lb = getLeaderboard();
  if (lb.length < 5) return true;
  return candidateScore > lb[lb.length - 1].score;
}

function addLeaderboardEntry(entry) {
  const lb = getLeaderboard();
  lb.push(entry);
  lb.sort((a, b) => b.score - a.score);
  lb.splice(5);
  setLeaderboard(lb);
  return lb;
}

function renderLeaderboard(highlightEntry) {
  const lb = getLeaderboard();
  const lists = [leaderboardListEl, overlayLeaderboardListEl];
  lists.forEach(list => {
    if (!list) return;
    list.innerHTML = '';
    if (lb.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Sin récords todavía';
      list.appendChild(li);
      return;
    }
    lb.forEach((entry, i) => {
      const li = document.createElement('li');
      if (
        highlightEntry &&
        entry.name === highlightEntry.name &&
        entry.score === highlightEntry.score &&
        entry.lines === highlightEntry.lines &&
        entry.level === highlightEntry.level &&
        entry.maxCombo === highlightEntry.maxCombo
      ) {
        li.classList.add('current-run');
      }
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = `${i + 1}.`;
      const name = document.createElement('span');
      name.className = 'lb-name';
      name.textContent = entry.name;
      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'lb-score';
      scoreSpan.textContent = entry.score.toLocaleString();
      li.appendChild(rank);
      li.appendChild(name);
      li.appendChild(scoreSpan);
      list.appendChild(li);
    });
  });

  if (leaderboardStatsEl) {
    if (lb.length === 0) {
      leaderboardStatsEl.textContent = '';
    } else {
      const bestCombo = Math.max(...lb.map(e => e.maxCombo || 0));
      const bestLines = Math.max(...lb.map(e => e.lines || 0));
      leaderboardStatsEl.textContent = `Mejor combo: ${bestCombo} · Más líneas: ${bestLines}`;
    }
  }
}

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  themeToggle.checked = theme === 'light';
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-color').trim();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');

  if (qualifiesForLeaderboard(score)) {
    pendingEntry = { score, lines, level, maxCombo };
    nameEntryEl.classList.remove('hidden');
    nameInputEl.value = '';
    renderLeaderboard(null);
    nameInputEl.focus();
  } else {
    pendingEntry = null;
    nameEntryEl.classList.add('hidden');
    renderLeaderboard(null);
  }
}

function submitScoreEntry() {
  if (!pendingEntry) return;
  const name = (nameInputEl.value || 'Jugador').trim().slice(0, 12) || 'Jugador';
  const entry = { name, ...pendingEntry };
  addLeaderboardEntry(entry);
  renderLeaderboard(entry);
  nameEntryEl.classList.add('hidden');
  pendingEntry = null;
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  nameEntryEl.classList.add('hidden');
  pendingEntry = null;
  renderLeaderboard(null);
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (document.activeElement === nameInputEl) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

themeToggle.addEventListener('change', () => {
  const theme = themeToggle.checked ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
});

saveScoreBtn.addEventListener('click', submitScoreEntry);

nameInputEl.addEventListener('keydown', e => {
  if (e.code === 'Enter') submitScoreEntry();
});

nameInputEl.addEventListener('blur', () => {
  if (pendingEntry) submitScoreEntry();
});

resetRecordsBtn.addEventListener('click', () => {
  localStorage.removeItem(LEADERBOARD_KEY);
  renderLeaderboard(null);
});

init();
