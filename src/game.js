const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
const muteToggle = document.getElementById("mute-toggle");
const loadingOverlay = document.getElementById("loading-overlay");
const loadingText = document.getElementById("loading-text");
const loadingBar = document.getElementById("loading-bar");

const keys = new Set();
const musicStorageKey = "daniel-platformer-music-muted";
const music = createMusicController();

const danielSheets = {
  idle: loadSheet("assets/daniel-step-sheet.webp", 6, 6, 6.5),
  walk: loadSheet("assets/daniel-walk-sheet.webp", 6, 6, 13),
  turn: loadSheet("assets/daniel-turn-sheet.webp", 6, 6, 24),
  jump: loadSheet("assets/daniel-jump-sheet.webp", 6, 6, 18, {
    referenceFrames: [0, 1, 2, 30, 31, 32, 33, 34, 35],
  }),
  stop: loadSheet("assets/daniel-stop-sheet.webp", 5, 5, 18),
};

const girlSheets = {
  idle: loadSheet("assets/girl-idle-sheet.webp", 6, 6, 6.5),
  walk: loadSheet("assets/girl-walk-sheet.webp", 6, 6, 13),
  turn: loadSheet("assets/girl-turn-sheet.webp", 6, 6, 22),
  jump: loadSheet("assets/girl-jump-sheet.webp", 6, 6, 18, {
    referenceFrames: [0, 1, 2, 30, 31, 32, 33, 34, 35],
  }),
  stop: loadSheet("assets/girl-stop-sheet.webp", 4, 4, 18),
};

const piggybackSheets = {
  idle: loadSheet("assets/piggyback-idle-sheet.webp", 6, 6, 6.5),
  mount: loadSheet("assets/piggyback-mount-sheet.webp", 6, 6, 22),
  dismount: loadSheet("assets/piggyback-dismount-sheet.webp", 6, 6, 22),
  start: loadSheet("assets/piggyback-start-run-sheet.webp", 4, 4, 20),
  stop: loadSheet("assets/piggyback-stop-run-sheet.webp", 6, 6, 20),
  turn: loadSheet("assets/piggyback-turn-sheet.webp", 6, 6, 22),
  run: loadSheet("assets/piggyback-run-sheet.webp", 6, 6, 18),
};

const legacyBackTurn = {
  back: loadImage("assets/daniel-pose-back.webp"),
  backThreeQuarter: loadImage("assets/daniel-pose-back-three-quarter.webp"),
};

const sceneLayers = {
  farBackground: [
    loadLayer("assets/layers/far-sky-pattern.webp", {
      parallax: 0.08,
      alignY: "bottom",
    }),
  ],
  midBackground: [
    loadLayer("assets/layers/mid-landscape-faded.webp", {
      parallax: 0.18,
      alignY: "bottom",
      overlapRatio: 0.06,
    }),
  ],
  foreground: [
    loadLayer("assets/layers/ground-strip-faded.webp", {
      parallax: 1,
      alignY: "ground",
      groundAnchorRatio: 0.68,
      overlapRatio: 0.18,
    }),
  ],
  frontOfSprites: [
    loadLayer("assets/layers/front-foreground-faded.webp", {
      parallax: 1.18,
      alignY: "ground",
      groundAnchorRatio: 0.76,
      overlapRatio: 0.08,
      targetHeightRatio: 0.18,
      minTileWidthRatio: 0.82,
      opacity: 0.28,
    }),
  ],
};

const physics = {
  gravity: 1700,
  acceleration: 1900,
  maxSpeed: 280,
  groundFriction: 0.84,
  airFriction: 0.985,
  jumpVelocity: -690,
};

const characters = [
  createCharacter({
    name: "Daniel",
    kind: "daniel",
    sheets: danielSheets,
    legacyBackTurn,
    heightScale: 1,
    spawnOffsetX: -82,
    controls: {
      left: ["ArrowLeft"],
      right: ["ArrowRight"],
      jump: ["Space", "ArrowUp"],
      pointer: true,
    },
    turnRoutes: ["front", "back"],
  }),
  createCharacter({
    name: "Girl",
    kind: "girl",
    sheets: girlSheets,
    heightScale: 0.9,
    spawnOffsetX: 82,
    controls: {
      left: ["KeyA"],
      right: ["KeyD"],
      jump: ["KeyW"],
      pointer: false,
    },
    turnRoutes: ["front"],
    turnSideToFrontFrames: [0, 6, 12, 18, 19, 20, 21, 22, 23],
  }),
];

const daniel = characters[0];
const girl = characters[1];
const piggyback = createPiggyback();

let width = 0;
let height = 0;
let dpr = 1;
let groundY = 0;
let lastTime = 0;
let elapsed = 0;
let initialized = false;

const camera = {
  x: 0,
  zoom: 1,
};

const input = {
  pointerDown: false,
  pointerX: 0,
};

const mountAssist = {
  active: false,
  facing: 1,
  startedAt: 0,
  targetGirlX: 0,
};

function createMusicController() {
  const audio = new Audio();
  audio.preload = "none";
  audio.volume = 0.42;
  audio.loop = false;
  audio.src = "assets/audio/braided-path.mp3";

  return {
    audio,
    tracks: ["assets/audio/braided-path.mp3", "assets/audio/braided-path-2.mp3"],
    index: 0,
    muted: readStoredMusicMute(),
    unlocked: false,
  };
}

function readStoredMusicMute() {
  try {
    return window.localStorage.getItem(musicStorageKey) === "true";
  } catch {
    return false;
  }
}

function storeMusicMute(muted) {
  try {
    window.localStorage.setItem(musicStorageKey, String(muted));
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
}

function setMusicMuted(muted) {
  music.muted = muted;
  music.audio.muted = muted;
  muteToggle.classList.toggle("is-muted", muted);
  muteToggle.setAttribute("aria-pressed", String(muted));
  muteToggle.setAttribute("aria-label", muted ? "Unmute music" : "Mute music");
  muteToggle.title = muted ? "Unmute music" : "Mute music";
  storeMusicMute(muted);

  if (muted) {
    music.audio.pause();
  }
}

function playMusic() {
  if (music.muted) return;
  music.unlocked = true;
  music.audio.play().catch(() => {
    music.unlocked = false;
  });
}

function unlockMusic() {
  if (music.unlocked || music.muted) return;
  playMusic();
}

function toggleMusicMute() {
  setMusicMuted(!music.muted);
  if (!music.muted) {
    playMusic();
  }
}

function advanceMusicTrack() {
  music.index = (music.index + 1) % music.tracks.length;
  music.audio.src = music.tracks[music.index];
  playMusic();
}

function updateLoadingProgress(loaded, total) {
  const percent = total ? Math.round((loaded / total) * 100) : 100;
  loadingText.textContent = `Loading ${percent}%`;
  loadingBar.style.width = `${percent}%`;
}

function finishLoadingProgress() {
  loadingText.textContent = "Ready";
  loadingBar.style.width = "100%";
  loadingOverlay.classList.add("is-done");
  window.setTimeout(() => {
    loadingOverlay.hidden = true;
  }, 360);
}

function showLoadingError() {
  loadingText.textContent = "Loading failed";
  loadingBar.style.width = "100%";
}

function loadImage(src) {
  const image = new Image();
  image.src = src;
  return image;
}

function loadLayer(src, options = {}) {
  return {
    image: loadImage(src),
    parallax: options.parallax ?? 1,
    alignY: options.alignY ?? "bottom",
    groundAnchorRatio: options.groundAnchorRatio ?? 0.68,
    overlapRatio: options.overlapRatio ?? 0,
    targetHeightRatio: options.targetHeightRatio ?? null,
    minTileWidthRatio: options.minTileWidthRatio ?? 1,
    opacity: options.opacity ?? 1,
  };
}

function loadSheet(src, cols, rows, fps, options = {}) {
  return {
    image: loadImage(src),
    cols,
    rows,
    fps,
    frameBounds: [],
    referenceHeight: 1,
    referenceFrames: options.referenceFrames ?? null,
  };
}

function createCharacter(config) {
  return {
    ...config,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    grounded: true,
    facing: 1,
    visualFacing: 1,
    jump: {
      queued: false,
      wasHeld: false,
      startedAt: -Infinity,
      landedAt: -Infinity,
      landingDuration: 0.26,
    },
    locomotion: {
      active: false,
      type: "start",
      startedAt: 0,
      duration: 0.34,
      facing: 1,
      lastAxis: 0,
    },
    turn: {
      active: false,
      from: 1,
      to: 1,
      route: "front",
      startedAt: 0,
      duration: 0.44,
    },
    history: [],
  };
}

function createPiggyback() {
  return {
    name: "Piggyback",
    kind: "piggyback",
    sheets: piggybackSheets,
    heightScale: 1.16,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    grounded: true,
    facing: 1,
    visualFacing: 1,
    state: "off",
    transitionStartedAt: 0,
    transitionDuration: 0,
    turnFrom: 1,
    turnTo: 1,
    pendingTurnFacing: 0,
    locomotionLastAxis: 0,
    history: [],
  };
}

function median(values) {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function buildSheetFrameBounds(sheet) {
  const cellW = Math.round(sheet.image.naturalWidth / sheet.cols);
  const cellH = Math.round(sheet.image.naturalHeight / sheet.rows);
  const scratch = document.createElement("canvas");
  scratch.width = sheet.image.naturalWidth;
  scratch.height = sheet.image.naturalHeight;
  const scratchCtx = scratch.getContext("2d", { willReadFrequently: true });
  const frameCount = sheet.cols * sheet.rows;

  scratchCtx.drawImage(sheet.image, 0, 0);
  sheet.frameBounds = [];
  const frameHeights = [];

  for (let frame = 0; frame < frameCount; frame += 1) {
    const cellX = (frame % sheet.cols) * cellW;
    const cellY = Math.floor(frame / sheet.cols) * cellH;
    const data = scratchCtx.getImageData(cellX, cellY, cellW, cellH).data;
    let minX = cellW;
    let minY = cellH;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < cellH; y += 1) {
      for (let x = 0; x < cellW; x += 1) {
        const alpha = data[(y * cellW + x) * 4 + 3];
        if (alpha > 8) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      sheet.frameBounds.push({ x: cellX, y: cellY, w: cellW, h: cellH });
      frameHeights.push(cellH);
      continue;
    }

    const pad = 2;
    const sourceX = Math.max(0, minX - pad);
    const sourceY = Math.max(0, minY - pad);
    const sourceRight = Math.min(cellW - 1, maxX + pad);
    const sourceBottom = Math.min(cellH - 1, maxY + pad);
    const sourceW = sourceRight - sourceX + 1;
    const sourceH = sourceBottom - sourceY + 1;

    sheet.frameBounds.push({
      x: cellX + sourceX,
      y: cellY + sourceY,
      w: sourceW,
      h: sourceH,
    });
    frameHeights.push(sourceH);
  }

  const referenceFrames = sheet.referenceFrames ?? frameHeights.map((_, index) => index);
  const referenceHeights = referenceFrames.map((index) => frameHeights[index]).filter(Boolean);
  sheet.referenceHeight = median(referenceHeights.length ? referenceHeights : frameHeights);
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(320, window.innerWidth);
  height = Math.max(320, window.innerHeight);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  groundY = Math.round(height * 0.79);

  if (!initialized) {
    characters.forEach((character) => {
      character.x = width * 0.5 + character.spawnOffsetX;
      character.y = groundY;
    });
    piggyback.x = daniel.x;
    piggyback.y = groundY;
    camera.zoom = cameraTargetZoom();
    camera.x = cameraWorldLeftFor(averageFocusX(), camera.zoom);
    initialized = true;
  } else {
    characters.forEach((character) => {
      character.y = Math.min(character.y, groundY);
    });
    if (isPiggybackVisible()) {
      piggyback.y = Math.min(piggyback.y, groundY);
      syncCharactersToPiggyback();
    }
    camera.zoom = cameraTargetZoom();
    camera.x = cameraWorldLeftFor(averageFocusX(), camera.zoom);
  }
}

function hasKey(...names) {
  return names.some((name) => keys.has(name));
}

function hasAnyKey(names) {
  return names.some((name) => keys.has(name));
}

function movementAxis(character) {
  let axis = 0;
  if (hasAnyKey(character.controls.left)) axis -= 1;
  if (hasAnyKey(character.controls.right)) axis += 1;

  if (character.controls.pointer && input.pointerDown) {
    const deadZone = width * 0.12;
    if (input.pointerX < width * 0.5 - deadZone) axis -= 1;
    if (input.pointerX > width * 0.5 + deadZone) axis += 1;
  }

  return Math.max(-1, Math.min(1, axis));
}

function wantsJump(character) {
  const keyboardJump = hasAnyKey(character.controls.jump);
  const pointerJump = character.controls.pointer && input.pointerDown && input.pointerX > width * 0.38 && input.pointerX < width * 0.62;
  return keyboardJump || pointerJump;
}

function wantsRewind() {
  return hasKey("ShiftLeft", "ShiftRight", "KeyR");
}

function update(dt) {
  const rewinding = wantsRewind();
  if (isPiggybackVisible()) {
    updatePiggyback(dt, rewinding);
  } else if (mountAssist.active) {
    updateMountAssist(dt, rewinding);
  } else {
    characters.forEach((character) => updateCharacter(character, dt, rewinding));
  }
  updateCamera(dt);
}

function updateCharacter(character, dt, rewinding) {
  if (rewinding && character.history.length > 2) {
    const past = character.history.pop();
    character.x = past.x;
    character.y = past.y;
    character.vx = past.vx * 0.35;
    character.vy = past.vy * 0.35;
    character.grounded = past.grounded;
    character.facing = past.facing;
    character.visualFacing = past.visualFacing ?? past.facing;
    character.turn.active = false;
    character.locomotion.active = false;
    character.locomotion.lastAxis = 0;
    character.jump.landedAt = character.grounded ? elapsed : -Infinity;
    character.jump.wasHeld = true;
    return;
  }

  const wasGrounded = character.grounded;
  const axis = movementAxis(character);
  if (axis !== 0) {
    const nextFacing = axis > 0 ? 1 : -1;
    if (nextFacing !== character.facing) {
      if (character.grounded) {
        startTurn(character, nextFacing);
      } else {
        character.turn.active = false;
        character.visualFacing = nextFacing;
      }
    }
    if (character.grounded && character.locomotion.lastAxis === 0 && !character.turn.active) {
      startLocomotionTransition(character, "start", nextFacing);
    }
    character.vx += axis * physics.acceleration * dt;
    character.facing = nextFacing;
  } else if (character.grounded && character.locomotion.lastAxis !== 0 && Math.abs(character.vx) > 38 && !character.turn.active) {
    startLocomotionTransition(character, "stop", character.visualFacing);
  }

  const friction = character.grounded ? physics.groundFriction : physics.airFriction;
  character.vx *= Math.pow(friction, dt * 60);
  character.vx = Math.max(-physics.maxSpeed, Math.min(physics.maxSpeed, character.vx));

  const jumpHeld = wantsJump(character);
  const jumpPressed = character.jump.queued || (jumpHeld && !character.jump.wasHeld);
  character.jump.queued = false;
  if (jumpPressed && character.grounded) {
    character.vy = physics.jumpVelocity;
    character.grounded = false;
    character.jump.startedAt = elapsed;
    character.jump.landedAt = -Infinity;
    character.turn.active = false;
    character.locomotion.active = false;
  }
  character.jump.wasHeld = jumpHeld;

  character.vy += physics.gravity * dt;
  character.x += character.vx * dt;
  character.y += character.vy * dt;

  if (character.y >= groundY) {
    character.y = groundY;
    character.vy = 0;
    character.grounded = true;
    if (!wasGrounded) {
      character.jump.landedAt = elapsed;
    }
  }

  updateTurn(character);
  updateLocomotionTransition(character);

  character.history.push({
    x: character.x,
    y: character.y,
    vx: character.vx,
    vy: character.vy,
    grounded: character.grounded,
    facing: character.facing,
    visualFacing: character.visualFacing,
  });
  const maxHistory = Math.round(5 / Math.max(dt, 1 / 120));
  if (character.history.length > maxHistory) character.history.splice(0, character.history.length - maxHistory);
  character.locomotion.lastAxis = axis;
}

function isPiggybackVisible() {
  return piggyback.state !== "off";
}

function isPiggybackMounted() {
  return ["idle", "start", "run", "stop", "turn"].includes(piggyback.state);
}

function canStartPiggybackMount() {
  if (isPiggybackVisible()) return false;
  if (!daniel.grounded || !girl.grounded) return false;
  if (daniel.turn.active || girl.turn.active) return false;
  return Math.abs(girl.x - mountGirlX(mountAssist.facing)) < 16 && Math.abs(daniel.y - girl.y) < 8;
}

function tryTogglePiggyback() {
  if (piggyback.state === "off") {
    startMountAssist();
    return;
  }

  if (isPiggybackMounted() && piggyback.grounded) {
    startPiggybackDismount();
  }
}

function startMountAssist() {
  if (mountAssist.active || isPiggybackVisible()) return;
  if (!daniel.grounded || !girl.grounded) return;
  if (daniel.turn.active || girl.turn.active) return;

  const facing = girl.x <= daniel.x ? 1 : -1;
  mountAssist.active = true;
  mountAssist.facing = facing;
  mountAssist.startedAt = elapsed;
  mountAssist.targetGirlX = mountGirlX(facing);
  resetCharacterMotion(daniel, facing);
  girl.turn.active = false;
  girl.jump.queued = false;
  girl.jump.wasHeld = false;
}

function updateMountAssist(dt, rewinding) {
  if (rewinding) {
    mountAssist.active = false;
    return;
  }

  const facing = mountAssist.facing;
  resetCharacterMotion(daniel, facing);
  mountAssist.targetGirlX = mountGirlX(facing);
  girl.y = groundY;
  girl.vy = 0;
  girl.grounded = true;
  girl.jump.queued = false;
  girl.jump.wasHeld = false;

  const remaining = mountAssist.targetGirlX - girl.x;
  const arrived = Math.abs(remaining) <= 8;
  const timedOut = elapsed - mountAssist.startedAt > 2.4;

  if (arrived || timedOut) {
    girl.x = mountAssist.targetGirlX;
    girl.vx = 0;
    girl.facing = facing;
    girl.visualFacing = facing;
    girl.locomotion.active = false;
    girl.locomotion.lastAxis = 0;
    startPiggybackMount(facing);
    return;
  }

  const axis = remaining > 0 ? 1 : -1;
  const speed = Math.min(215, Math.max(88, Math.abs(remaining) * 5.2));
  if (girl.locomotion.lastAxis === 0 || girl.visualFacing !== axis) {
    startLocomotionTransition(girl, "start", axis);
  }
  girl.turn.active = false;
  girl.facing = axis;
  girl.visualFacing = axis;
  girl.vx = axis * speed;
  girl.x += girl.vx * dt;

  if ((axis > 0 && girl.x > mountAssist.targetGirlX) || (axis < 0 && girl.x < mountAssist.targetGirlX)) {
    girl.x = mountAssist.targetGirlX;
  }

  updateLocomotionTransition(girl);
  girl.locomotion.lastAxis = axis;
}

function mountGirlX(facing) {
  return daniel.x - facing * 78;
}

function startPiggybackMount(facingOverride = null) {
  if (!canStartPiggybackMount()) return;

  const facing = facingOverride ?? daniel.visualFacing ?? daniel.facing ?? 1;
  mountAssist.active = false;
  piggyback.state = "mounting";
  piggyback.transitionStartedAt = elapsed;
  piggyback.transitionDuration = 1.12;
  piggyback.x = (daniel.x + girl.x) * 0.5;
  piggyback.y = groundY;
  piggyback.vx = 0;
  piggyback.vy = 0;
  piggyback.grounded = true;
  piggyback.facing = facing;
  piggyback.visualFacing = facing;
  piggyback.turnFrom = facing;
  piggyback.turnTo = facing;
  piggyback.pendingTurnFacing = 0;
  piggyback.locomotionLastAxis = 0;
  piggyback.history = [];
  resetCharacterMotion(daniel, facing);
  resetCharacterMotion(girl, facing);
}

function startPiggybackDismount() {
  piggyback.state = "dismounting";
  piggyback.transitionStartedAt = elapsed;
  piggyback.transitionDuration = 1.08;
  piggyback.vx = 0;
  piggyback.vy = 0;
  piggyback.y = groundY;
  piggyback.grounded = true;
  piggyback.pendingTurnFacing = 0;
  piggyback.locomotionLastAxis = 0;
}

function resetCharacterMotion(character, facing) {
  character.vx = 0;
  character.vy = 0;
  character.y = groundY;
  character.grounded = true;
  character.facing = facing;
  character.visualFacing = facing;
  character.turn.active = false;
  character.locomotion.active = false;
  character.locomotion.lastAxis = 0;
  character.jump.queued = false;
  character.jump.wasHeld = false;
}

function updatePiggyback(dt, rewinding) {
  if (rewinding && piggyback.history.length > 2 && isPiggybackMounted()) {
    const past = piggyback.history.pop();
    piggyback.x = past.x;
    piggyback.y = past.y;
    piggyback.vx = past.vx * 0.35;
    piggyback.vy = past.vy * 0.35;
    piggyback.facing = past.facing;
    piggyback.visualFacing = past.visualFacing ?? past.facing;
    piggyback.state = past.state;
    piggyback.turnFrom = past.turnFrom ?? past.facing;
    piggyback.turnTo = past.turnTo ?? past.facing;
    piggyback.pendingTurnFacing = past.pendingTurnFacing ?? 0;
    piggyback.locomotionLastAxis = 0;
    syncCharactersToPiggyback();
    return;
  }

  if (piggyback.state === "mounting") {
    updatePiggybackTransition("idle");
    syncCharactersToPiggyback();
    return;
  }

  if (piggyback.state === "dismounting") {
    updatePiggybackTransition("off");
    if (piggyback.state === "off") {
      finishPiggybackDismount();
    } else {
      syncCharactersToPiggyback();
    }
    return;
  }

  const axis = movementAxis(daniel);
  const inputFacing = axis === 0 ? 0 : axis > 0 ? 1 : -1;

  if (inputFacing !== 0 && inputFacing !== piggyback.facing) {
    requestPiggybackTurn(inputFacing);
  }

  const turningOrPreparing = piggyback.state === "turn" || piggyback.pendingTurnFacing !== 0;
  if (axis !== 0) {
    if (!turningOrPreparing) {
      piggyback.facing = inputFacing;
      piggyback.visualFacing = inputFacing;
      if (piggyback.locomotionLastAxis === 0 && piggyback.state !== "start") {
        startPiggybackLocomotion("start", 0.34);
      }
      piggyback.vx += axis * physics.acceleration * 1.28 * dt;
    }
  } else if (!turningOrPreparing && piggyback.locomotionLastAxis !== 0 && Math.abs(piggyback.vx) > 58 && piggyback.state !== "stop") {
    startPiggybackLocomotion("stop", 0.48);
  }

  const friction = axis === 0 || turningOrPreparing ? 0.78 : 0.94;
  piggyback.vx *= Math.pow(friction, dt * 60);
  const maxSpeed = physics.maxSpeed * 1.48;
  piggyback.vx = Math.max(-maxSpeed, Math.min(maxSpeed, piggyback.vx));
  piggyback.x += piggyback.vx * dt;
  piggyback.y = groundY;
  piggyback.vy = 0;
  piggyback.grounded = true;

  updatePiggybackLocomotion(axis);
  syncCharactersToPiggyback();
  recordPiggybackHistory(dt);
  piggyback.locomotionLastAxis = axis;
}

function updatePiggybackTransition(nextState) {
  const progress = (elapsed - piggyback.transitionStartedAt) / piggyback.transitionDuration;
  if (progress >= 1) {
    piggyback.state = nextState;
    piggyback.transitionStartedAt = elapsed;
  }
}

function startPiggybackLocomotion(state, duration) {
  piggyback.state = state;
  piggyback.transitionStartedAt = elapsed;
  piggyback.transitionDuration = duration;
}

function requestPiggybackTurn(nextFacing) {
  if (piggyback.state === "turn" || piggyback.pendingTurnFacing === nextFacing) return;

  piggyback.pendingTurnFacing = nextFacing;
  const needsBraking = Math.abs(piggyback.vx) > 72 || piggyback.state === "run" || piggyback.state === "start";
  if (needsBraking) {
    startPiggybackLocomotion("stop", 0.22);
    return;
  }

  startPiggybackTurn(nextFacing);
}

function startPiggybackTurn(nextFacing) {
  const from = piggyback.visualFacing || piggyback.facing || 1;
  piggyback.state = "turn";
  piggyback.turnFrom = from;
  piggyback.turnTo = nextFacing;
  piggyback.facing = nextFacing;
  piggyback.visualFacing = from;
  piggyback.pendingTurnFacing = 0;
  piggyback.transitionStartedAt = elapsed;
  piggyback.transitionDuration = 0.4;
}

function finishPiggybackTurn(axis) {
  piggyback.facing = piggyback.turnTo;
  piggyback.visualFacing = piggyback.turnTo;
  piggyback.state = axis === piggyback.turnTo ? "start" : "idle";
  piggyback.transitionStartedAt = elapsed;
  piggyback.transitionDuration = piggyback.state === "start" ? 0.24 : 0;
}

function updatePiggybackLocomotion(axis) {
  if (piggyback.state === "turn" && elapsed - piggyback.transitionStartedAt >= piggyback.transitionDuration) {
    finishPiggybackTurn(axis);
    return;
  }

  if (piggyback.state === "start" && elapsed - piggyback.transitionStartedAt >= piggyback.transitionDuration) {
    piggyback.state = axis === 0 ? "stop" : "run";
    piggyback.transitionStartedAt = elapsed;
    piggyback.transitionDuration = 0.42;
  }

  if (piggyback.state === "stop" && elapsed - piggyback.transitionStartedAt >= piggyback.transitionDuration) {
    if (piggyback.pendingTurnFacing !== 0) {
      startPiggybackTurn(piggyback.pendingTurnFacing);
      return;
    }

    piggyback.state = axis === 0 || Math.abs(piggyback.vx) < 34 ? "idle" : "run";
  }

  if (piggyback.state === "idle" && Math.abs(piggyback.vx) > 72) {
    piggyback.state = "run";
  }
}

function syncCharactersToPiggyback() {
  daniel.x = piggyback.x;
  daniel.y = piggyback.y;
  daniel.vx = piggyback.vx;
  daniel.vy = 0;
  daniel.grounded = true;
  daniel.facing = piggyback.facing;
  daniel.visualFacing = piggyback.visualFacing;

  girl.x = piggyback.x - piggyback.visualFacing * 42;
  girl.y = piggyback.y;
  girl.vx = piggyback.vx;
  girl.vy = 0;
  girl.grounded = true;
  girl.facing = piggyback.facing;
  girl.visualFacing = piggyback.visualFacing;
}

function finishPiggybackDismount() {
  const facing = piggyback.visualFacing || 1;
  resetCharacterMotion(daniel, facing);
  resetCharacterMotion(girl, facing);
  daniel.x = piggyback.x + facing * 44;
  girl.x = piggyback.x - facing * 66;
  daniel.y = groundY;
  girl.y = groundY;
  piggyback.vx = 0;
  piggyback.history = [];
}

function recordPiggybackHistory(dt) {
  piggyback.history.push({
    x: piggyback.x,
    y: piggyback.y,
    vx: piggyback.vx,
    vy: piggyback.vy,
    facing: piggyback.facing,
    visualFacing: piggyback.visualFacing,
    state: piggyback.state,
    turnFrom: piggyback.turnFrom,
    turnTo: piggyback.turnTo,
    pendingTurnFacing: piggyback.pendingTurnFacing,
  });
  const maxHistory = Math.round(5 / Math.max(dt, 1 / 120));
  if (piggyback.history.length > maxHistory) {
    piggyback.history.splice(0, piggyback.history.length - maxHistory);
  }
}

function startTurn(character, nextFacing) {
  character.turn.active = true;
  character.turn.from = character.visualFacing;
  character.turn.to = nextFacing;
  character.turn.route = character.turnRoutes[Math.floor(Math.random() * character.turnRoutes.length)];
  character.turn.startedAt = elapsed;
}

function updateTurn(character) {
  if (!character.turn.active) return;

  const progress = (elapsed - character.turn.startedAt) / character.turn.duration;
  if (progress >= 1) {
    character.turn.active = false;
    character.visualFacing = character.turn.to;
  }
}

function startLocomotionTransition(character, type, facing) {
  character.locomotion.active = true;
  character.locomotion.type = type;
  character.locomotion.facing = facing;
  character.locomotion.startedAt = elapsed;
}

function updateLocomotionTransition(character) {
  if (!character.locomotion.active) return;

  if (!character.grounded || character.turn.active) {
    character.locomotion.active = false;
    return;
  }

  if (elapsed - character.locomotion.startedAt >= character.locomotion.duration) {
    character.locomotion.active = false;
  }
}

function currentSpriteHeight(character) {
  const base = Math.round(Math.min(382, Math.max(245, height * 0.52)));
  return base * character.heightScale * camera.zoom;
}

function averageFocusX() {
  if (isPiggybackVisible()) return piggyback.x;
  return characters.reduce((sum, character) => sum + character.x, 0) / characters.length;
}

function updateCamera(dt) {
  const targetZoom = cameraTargetZoom();
  const follow = 1 - Math.pow(0.002, dt);
  const zoomFollow = 1 - Math.pow(0.01, dt);
  camera.zoom += (targetZoom - camera.zoom) * zoomFollow;
  const targetX = cameraWorldLeftFor(averageFocusX(), camera.zoom);
  camera.x += (targetX - camera.x) * follow;
}

function worldToScreenX(x) {
  return (x - camera.x) * camera.zoom;
}

function worldToScreenY(y) {
  return groundY - (groundY - y) * camera.zoom;
}

function cameraWorldLeftFor(centerX, zoom) {
  return centerX - width / Math.max(0.001, zoom) * 0.5;
}

function cameraTargetZoom() {
  if (isPiggybackVisible()) return 1;

  const span = Math.abs(daniel.x - girl.x);
  const zoomStartSpan = width * 0.45;
  const zoomFullSpan = width * 0.98;
  const zoomReleaseSpan = zoomStartSpan * 0.82;
  if (span <= zoomReleaseSpan) return 1;

  const zoomAlreadyEngaged = camera.zoom < 0.995;
  if (!areCharactersActivelySeparating()) {
    return zoomAlreadyEngaged ? camera.zoom : 1;
  }
  if (span <= zoomStartSpan) return 1;

  const progress = Math.max(0, Math.min(1, (span - zoomStartSpan) / Math.max(1, zoomFullSpan - zoomStartSpan)));
  return 1 - progress * 0.3;
}

function areCharactersActivelySeparating() {
  const leftCharacter = daniel.x <= girl.x ? daniel : girl;
  const rightCharacter = leftCharacter === daniel ? girl : daniel;
  return leftCharacter.vx < -35 && rightCharacter.vx > 35;
}

function positiveModulo(value, size) {
  return ((value % size) + size) % size;
}

function drawStage() {
  ctx.fillStyle = "#eadfbb";
  ctx.fillRect(0, 0, width, height);
  drawLayerStack(sceneLayers.farBackground);
  drawLayerStack(sceneLayers.midBackground);
  drawGround();
  drawLayerStack(sceneLayers.foreground);
}

function drawGround() {
  ctx.fillStyle = "#6f7c52";
  ctx.fillRect(0, groundY, width, height - groundY);

  ctx.fillStyle = "#4f6548";
  ctx.fillRect(0, groundY + 12, width, height - groundY - 12);

  ctx.fillStyle = "rgba(55, 66, 43, 0.26)";
  ctx.fillRect(0, groundY - 3, width, 6);
}

function drawLayerStack(layers) {
  layers.forEach(drawTiledLayer);
}

function drawTiledLayer(layer) {
  const image = layer.image;
  if (!image.complete || !image.naturalWidth) return;

  const zoom = layerZoom(layer);
  const scale = layerScale(layer) * zoom;
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  const drawY = layerY(layer, drawH);
  const stepX = drawW * (1 - layer.overlapRatio);
  const offsetX = -positiveModulo(camera.x * layer.parallax * zoom, stepX);

  ctx.save();
  ctx.globalAlpha = layer.opacity;
  for (let x = offsetX - drawW; x < width + drawW; x += stepX) {
    ctx.drawImage(image, x, drawY, drawW, drawH);
  }
  ctx.restore();
}

function layerZoom(layer) {
  return layer.alignY === "ground" ? camera.zoom : 1;
}

function layerScale(layer) {
  const image = layer.image;
  if (layer.targetHeightRatio) {
    const heightScale = (height * layer.targetHeightRatio) / image.naturalHeight;
    const widthScale = (width * layer.minTileWidthRatio) / image.naturalWidth;
    return Math.max(heightScale, widthScale);
  }

  if (layer.alignY !== "ground") {
    return Math.max(width / image.naturalWidth, height / image.naturalHeight);
  }

  const belowGroundHeight = Math.max(1, height - groundY);
  const sourceBelowGround = Math.max(1, image.naturalHeight * (1 - layer.groundAnchorRatio));
  return Math.max(width / image.naturalWidth, belowGroundHeight / sourceBelowGround);
}

function layerY(layer, drawH) {
  if (layer.alignY === "top") return 0;
  if (layer.alignY === "ground") return groundY - drawH * layer.groundAnchorRatio;
  return height - drawH;
}

function drawCharacter(character, x, feetY, t, options = {}) {
  const pose = selectCharacterFrame(character, t, options);
  drawPose(character, pose, x, feetY, t, options);
}

function drawPiggyback(t) {
  const pose = selectPiggybackFrame(t);
  drawPose(piggyback, pose, worldToScreenX(piggyback.x), worldToScreenY(piggyback.y), t);
}

function drawPose(actor, pose, x, feetY, t, options = {}) {
  const image = pose.sheet ? pose.sheet.image : pose.image;
  if (!image.complete || !image.naturalWidth) return;

  const alpha = options.alpha ?? 1;
  const ghost = options.ghost ?? false;
  const source = frameSource(pose);
  const imageScale = currentSpriteHeight(actor) / frameScaleHeight(pose);
  const drawH = source.h * imageScale;
  const drawW = source.w * imageScale;
  const isJumpPose = pose.sheet && actor.sheets.jump && pose.sheet === actor.sheets.jump;
  const bob = ghost || actor.turn?.active || isJumpPose || actor.kind === "piggyback" ? 0 : Math.sin(t * 2.15 + 0.7) * 0.9;
  const lean = ghost || actor.kind === "piggyback" ? 0 : Math.max(-0.055, Math.min(0.055, actor.vx / physics.maxSpeed * 0.06));
  const originX = -drawW * 0.5;
  const originY = -drawH;

  if (!ghost) {
    const heightAboveGround = Math.max(0, groundY - feetY);
    const shadowScale = Math.max(0.45, 1 - heightAboveGround / 520);
    ctx.save();
    ctx.globalAlpha = 0.18 + shadowScale * 0.08;
    ctx.fillStyle = "rgb(55, 58, 45)";
    ctx.beginPath();
    ctx.ellipse(x, groundY + 3, drawW * 0.28 * shadowScale, 11 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(x, feetY + bob);
  ctx.scale(options.facing ?? pose.facing, 1);
  ctx.rotate(lean);
  ctx.globalAlpha = alpha;

  ctx.drawImage(image, source.x, source.y, source.w, source.h, originX, originY, drawW, drawH);

  ctx.restore();
}

function frameSource(pose) {
  if (!pose.sheet) {
    return {
      x: 0,
      y: 0,
      w: pose.image.naturalWidth,
      h: pose.image.naturalHeight,
    };
  }

  const sheet = pose.sheet;
  const cellW = sheet.image.naturalWidth / sheet.cols;
  const cellH = sheet.image.naturalHeight / sheet.rows;
  const frame = pose.index % (sheet.cols * sheet.rows);
  const bounds = sheet.frameBounds[frame];
  if (bounds) return bounds;

  return {
    x: (frame % sheet.cols) * cellW,
    y: Math.floor(frame / sheet.cols) * cellH,
    w: cellW,
    h: cellH,
  };
}

function frameScaleHeight(pose) {
  if (!pose.sheet) return pose.image.naturalHeight;
  return pose.sheet.referenceHeight || frameSource(pose).h;
}

function selectCharacterFrame(character, t, options = {}) {
  if (options.ghost) {
    return {
      sheet: character.sheets.idle,
      index: 0,
      facing: options.facing ?? character.visualFacing,
    };
  }

  if (character.turn.active) return selectTurnFrame(character);

  if (!character.grounded || elapsed - character.jump.landedAt < character.jump.landingDuration) {
    return selectJumpFrame(character);
  }

  if (character.locomotion.active) return selectLocomotionFrame(character);

  const walking = Math.abs(character.vx) > 24 || movementAxis(character) !== 0;
  const sheet = walking ? character.sheets.walk : character.sheets.idle;
  const frameCount = sheet.cols * sheet.rows;
  return {
    sheet,
    index: Math.floor(t * sheet.fps) % frameCount,
    facing: character.visualFacing,
  };
}

function selectPiggybackFrame(t) {
  if (piggyback.state === "mounting") {
    return {
      sheet: piggyback.sheets.mount,
      index: transitionFrameIndex(piggyback.sheets.mount),
      facing: piggyback.visualFacing,
    };
  }

  if (piggyback.state === "dismounting") {
    return {
      sheet: piggyback.sheets.dismount,
      index: transitionFrameIndex(piggyback.sheets.dismount),
      facing: piggyback.visualFacing,
    };
  }

  if (piggyback.state === "start") {
    return {
      sheet: piggyback.sheets.start,
      index: transitionFrameIndex(piggyback.sheets.start),
      facing: piggyback.visualFacing,
    };
  }

  if (piggyback.state === "stop") {
    return {
      sheet: piggyback.sheets.stop,
      index: transitionFrameIndex(piggyback.sheets.stop),
      facing: piggyback.visualFacing,
    };
  }

  if (piggyback.state === "turn") {
    return {
      sheet: piggyback.sheets.turn,
      index: transitionFrameIndex(piggyback.sheets.turn),
      facing: piggyback.turnFrom === 1 ? 1 : -1,
    };
  }

  const walking = piggyback.state === "run" || Math.abs(piggyback.vx) > 52;
  const sheet = walking ? piggyback.sheets.run : piggyback.sheets.idle;
  return {
    sheet,
    index: Math.floor(t * sheet.fps) % (sheet.cols * sheet.rows),
    facing: piggyback.visualFacing,
  };
}

function transitionFrameIndex(sheet) {
  const frameCount = sheet.cols * sheet.rows;
  const raw = (elapsed - piggyback.transitionStartedAt) / Math.max(0.001, piggyback.transitionDuration);
  const progress = Math.max(0, Math.min(0.999, raw));
  const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  return Math.min(frameCount - 1, Math.floor(eased * frameCount));
}

function selectLocomotionFrame(character) {
  const frameCount = character.sheets.stop.cols * character.sheets.stop.rows;
  const raw = (elapsed - character.locomotion.startedAt) / character.locomotion.duration;
  const progress = Math.max(0, Math.min(0.999, raw));
  const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  const forwardIndex = Math.min(frameCount - 1, Math.floor(eased * frameCount));

  return {
    sheet: character.sheets.stop,
    index: character.locomotion.type === "start" ? frameCount - 1 - forwardIndex : forwardIndex,
    facing: character.locomotion.facing,
  };
}

function selectJumpFrame(character) {
  const landingAge = elapsed - character.jump.landedAt;
  if (character.grounded && landingAge >= 0 && landingAge < character.jump.landingDuration) {
    const landingFrames = [24, 25, 26, 27, 28, 29];
    const index = Math.min(landingFrames.length - 1, Math.floor((landingAge / character.jump.landingDuration) * landingFrames.length));
    return {
      sheet: character.sheets.jump,
      index: landingFrames[index],
      facing: character.visualFacing,
    };
  }

  const age = elapsed - character.jump.startedAt;
  let index = 13;
  if (age < 0.08) {
    index = 8;
  } else if (age < 0.16) {
    index = 10;
  } else if (character.vy < -420) {
    index = 12;
  } else if (character.vy < -190) {
    index = 14;
  } else if (character.vy < 90) {
    index = 17;
  } else if (character.vy < 390) {
    index = 20;
  } else {
    index = 23;
  }

  return {
    sheet: character.sheets.jump,
    index,
    facing: character.visualFacing,
  };
}

function selectTurnFrame(character) {
  const raw = (elapsed - character.turn.startedAt) / character.turn.duration;
  const progress = Math.max(0, Math.min(0.999, raw));
  const frames = character.kind === "daniel" ? danielTurnFrames(character) : mirroredFrontTurnFrames(character);
  const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  return frames[Math.min(frames.length - 1, Math.floor(eased * frames.length))];
}

function danielTurnFrames(character) {
  if (character.turn.route === "back") return danielBackTurnFrames(character);
  return danielFrontTurnFrames(character);
}

function danielFrontTurnFrames(character) {
  const rightToLeft = [11, 12, 15, 18, 19, 20, 21, 22, 23, 25, 27, 29, 31, 35];
  const indices = character.turn.from === 1 ? rightToLeft : [...rightToLeft].reverse();
  return indices.map((index) => ({
    sheet: character.sheets.turn,
    index,
    facing: 1,
  }));
}

function danielBackTurnFrames(character) {
  const fromRight = [
    { sheet: character.sheets.turn, index: 11, facing: 1 },
    { image: character.legacyBackTurn.backThreeQuarter, facing: 1 },
    { image: character.legacyBackTurn.back, facing: 1 },
    { image: character.legacyBackTurn.backThreeQuarter, facing: -1 },
    { sheet: character.sheets.turn, index: 35, facing: 1 },
  ];

  if (character.turn.from === 1) return fromRight;
  return [...fromRight].reverse();
}

function mirroredFrontTurnFrames(character) {
  const sideToFront = character.turnSideToFrontFrames;
  const frontToSide = [...sideToFront].reverse().slice(1);
  return [
    ...sideToFront.map((index) => ({
      sheet: character.sheets.turn,
      index,
      facing: character.turn.from,
    })),
    ...frontToSide.map((index) => ({
      sheet: character.sheets.turn,
      index,
      facing: character.turn.to,
    })),
  ];
}

function drawTimeEchoes(t) {
  if (isPiggybackVisible() || mountAssist.active) return;

  characters.forEach((character) => {
    const shouldShow = wantsRewind() || (!character.locomotion.active && Math.abs(character.vx) > 85);
    if (!shouldShow || character.history.length < 12) return;

    const samples = [12, 24, 38, 54];
    for (let i = samples.length - 1; i >= 0; i -= 1) {
      const frame = character.history[character.history.length - samples[i]];
      if (!frame) continue;
      const alpha = wantsRewind() ? 0.1 + i * 0.035 : 0.035 + i * 0.016;
      drawCharacter(character, worldToScreenX(frame.x), worldToScreenY(frame.y), t - i * 0.08, {
        alpha,
        ghost: true,
        facing: frame.visualFacing ?? frame.facing,
      });
    }
  });
}

function render(t) {
  drawStage();
  drawTimeEchoes(t);
  if (isPiggybackVisible()) {
    drawPiggyback(t);
  } else {
    characters
      .slice()
      .sort((a, b) => a.y - b.y)
      .forEach((character) => {
        drawCharacter(character, worldToScreenX(character.x), worldToScreenY(character.y), t);
      });
  }
  drawLayerStack(sceneLayers.frontOfSprites);
}

function frame(now) {
  const seconds = now / 1000;
  const dt = Math.min(0.034, lastTime ? seconds - lastTime : 1 / 60);
  lastTime = seconds;
  elapsed += dt;
  update(dt);
  render(elapsed);
  requestAnimationFrame(frame);
}

function updatePointer(event) {
  input.pointerX = event.clientX;
}

function resetInput() {
  keys.clear();
  input.pointerDown = false;
  mountAssist.active = false;
  characters.forEach((character) => {
    character.jump.queued = false;
    character.jump.wasHeld = false;
  });
  piggyback.locomotionLastAxis = 0;
  piggyback.pendingTurnFacing = 0;
}

window.addEventListener("resize", resize);
window.addEventListener("blur", resetInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) resetInput();
});

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "ShiftLeft", "ShiftRight", "KeyA", "KeyD", "KeyW", "KeyS", "KeyR", "KeyM"].includes(event.code)) {
    event.preventDefault();
  }
  if (event.code === "KeyM" && !event.repeat) {
    toggleMusicMute();
    return;
  }
  unlockMusic();
  if (event.code === "KeyS" && !event.repeat) {
    tryTogglePiggyback();
  }
  characters.forEach((character) => {
    if (character.controls.jump.includes(event.code)) {
      character.jump.queued = true;
    }
  });
  keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

canvas.addEventListener("pointerdown", (event) => {
  unlockMusic();
  canvas.focus();
  input.pointerDown = true;
  updatePointer(event);
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (input.pointerDown) updatePointer(event);
});

canvas.addEventListener("pointerup", (event) => {
  input.pointerDown = false;
  canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener("pointercancel", () => {
  resetInput();
});

muteToggle.addEventListener("click", () => {
  toggleMusicMute();
  canvas.focus();
});

music.audio.addEventListener("ended", advanceMusicTrack);
setMusicMuted(music.muted);

const characterSheets = [...characters.flatMap((character) => Object.values(character.sheets)), ...Object.values(piggybackSheets)];
const characterImages = characters.flatMap((character) => Object.values(character.legacyBackTurn ?? {}));
const layerImages = Object.values(sceneLayers).flat().map((layer) => layer.image);
const runtimeImages = [...characterSheets.map((sheet) => sheet.image), ...characterImages, ...layerImages];
let loadedImages = 0;

Promise.all(
  runtimeImages.map(
    (image) =>
      new Promise((resolve, reject) => {
        const done = () => {
          loadedImages += 1;
          updateLoadingProgress(loadedImages, runtimeImages.length);
          resolve();
        };

        if (image.complete && image.naturalWidth) {
          done();
          return;
        }

        image.addEventListener("load", done, { once: true });
        image.addEventListener("error", reject, { once: true });
      }),
  ),
).then(() => {
  characterSheets.forEach(buildSheetFrameBounds);
  resize();
  canvas.focus();
  finishLoadingProgress();
  requestAnimationFrame(frame);
}).catch((error) => {
  showLoadingError();
  throw error;
});
