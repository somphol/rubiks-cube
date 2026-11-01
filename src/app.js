/* ============================================================
   CUBELAB — interactive 3D Rubik's Cube
   Three.js scene + drag controls + Kociemba two-phase solver
   ============================================================ */

(() => {
  "use strict";

  /* ------------------------------------------------------------
     tiny helpers
     ------------------------------------------------------------ */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));

  const displayMove = (move) => move.replace(/'/g, "′").replace(/2/g, "2");

  function formatTime(ms) {
    const safe = Math.max(0, Math.round(ms));
    const minutes = Math.floor(safe / 60000);
    const seconds = Math.floor((safe % 60000) / 1000);
    const tenths = Math.floor((safe % 1000) / 100);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
  }

  function fatal(title, detail) {
    const layer = document.createElement("div");
    layer.className = "fatal";
    layer.innerHTML = `<div class="fatal-card"><h1>${escapeHtml(title)}</h1><p>${detail}</p></div>`;
    document.body.appendChild(layer);
  }

  if (!window.THREE) {
    fatal(
      "Could not load Three.js",
      "The 3D engine is loaded from a CDN. Check your internet connection and reload the page. The app itself is a single HTML file, but Three.js is fetched once from jsDelivr."
    );
    return;
  }
  if (!window.Cube) {
    fatal(
      "Could not load the cube solver",
      "The embedded cube.js model did not initialize. Try reloading the page, or open the browser console for details."
    );
    return;
  }
  if (!THREE.OrbitControls) {
    fatal(
      "Could not load camera controls",
      "Three.js loaded, but OrbitControls did not. Check your internet connection and reload the page."
    );
    return;
  }

  /* ------------------------------------------------------------
     constants
     ------------------------------------------------------------ */

  const FACE_COLORS = {
    U: 0xffffff,
    R: 0xc4162b,
    F: 0x009e3a,
    D: 0xffc400,
    L: 0xff6a00,
    B: 0x1d4ed8,
  };

  const FACE_NORMALS = {
    U: new THREE.Vector3(0, 1, 0),
    R: new THREE.Vector3(1, 0, 0),
    F: new THREE.Vector3(0, 0, 1),
    D: new THREE.Vector3(0, -1, 0),
    L: new THREE.Vector3(-1, 0, 0),
    B: new THREE.Vector3(0, 0, -1),
  };

  const FACE_OFFSETS = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 };
  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  const AXIS_VECTORS = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 1, 0),
    z: new THREE.Vector3(0, 0, 1),
  };

  // Canonical quarter-turn angles, derived from the standard cubie
  // permutations used by cube.js (and Kociemba's convention).
  const MOVE_DEFS = {
    R: { axis: "x", layer: 1, angle: -Math.PI / 2 },
    L: { axis: "x", layer: -1, angle: Math.PI / 2 },
    U: { axis: "y", layer: 1, angle: -Math.PI / 2 },
    D: { axis: "y", layer: -1, angle: Math.PI / 2 },
    F: { axis: "z", layer: 1, angle: -Math.PI / 2 },
    B: { axis: "z", layer: -1, angle: Math.PI / 2 },
    M: { axis: "x", layer: 0, angle: Math.PI / 2 },
    E: { axis: "y", layer: 0, angle: Math.PI / 2 },
    S: { axis: "z", layer: 0, angle: -Math.PI / 2 },
  };

  // For a positive rotation about the given axis and layer, which move
  // is canonical, and is the positive direction the unprimed one?
  const AXIS_MOVES = {
    x: { "1": ["R", -1], "-1": ["L", 1], "0": ["M", 1] },
    y: { "1": ["U", -1], "-1": ["D", 1], "0": ["E", 1] },
    z: { "1": ["F", -1], "-1": ["B", 1], "0": ["S", -1] },
  };

  const FACE_KEYS = ["U", "D", "L", "R", "F", "B"];
  const BEST_KEY = "cubelab.best.v1";
  const SOUND_KEY = "cubelab.sound.v1";
  const SPEED_KEY = "cubelab.speed.v1";
  const STEP_KEY = "cubelab.step.v1";

  const isCompact = () => window.matchMedia("(max-width: 720px)").matches;
  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------
     persistent preferences
     ------------------------------------------------------------ */

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage may be unavailable under file:// or private mode */
    }
  }

  function loadBest() {
    const value = readJSON(BEST_KEY, null);
    if (value && Number.isFinite(value.ms) && value.ms > 0) return value;
    return null;
  }

  const storedSound = readJSON(SOUND_KEY, true);
  const storedSpeed = Number(readJSON(SPEED_KEY, 330));
  const storedStep = readJSON(STEP_KEY, false) === true;

  /* ------------------------------------------------------------
     application state
     ------------------------------------------------------------ */

  const state = {
    cube: new Cube(),
    history: [],
    moveCount: 0,
    timer: { start: 0, elapsed: 0, running: false },
    mode: "idle", // idle | scrambling | solving | solved | undo
    speed: [150, 330, 650].includes(storedSpeed) ? storedSpeed : 330,
    step: storedStep,
    stepWaiting: false,
    sound: storedSound !== false,
    paused: false,
    started: false,
    scrambled: false,
    assisted: false,
    celebrating: false,
    session: 0,
    solution: [],
    solutionIndex: 0,
    best: loadBest(),
    solverReady: false,
  };

  /* ------------------------------------------------------------
     DOM references
     ------------------------------------------------------------ */

  const canvas = $("#stage");
  const statusPill = $("#statusPill");
  const statusText = $("#statusText");
  const stateLabel = $("#stateLabel");
  const timerEl = $("#timer");
  const moveCountEl = $("#moveCount");
  const bestTimeEl = $("#bestTime");
  const historyList = $("#historyList");
  const historyCount = $("#historyCount");
  const copyBtn = $("#copyBtn");
  const banner = $("#banner");
  const bannerKicker = $("#bannerKicker");
  const bannerMove = $("#bannerMove");
  const bannerSub = $("#bannerSub");
  const bannerBar = $("#bannerBar");
  const facePad = $("#facePad");
  const scrambleBtn = $("#scrambleBtn");
  const solveBtn = $("#solveBtn");
  const autoBtn = $("#autoBtn");
  const cineExit = $("#cineExit");
  const cinePause = $("#cinePause");
  const cinePauseText = $("#cinePauseText");
  const undoBtn = $("#undoBtn");
  const resetBtn = $("#resetBtn");
  const pauseBtn = $("#pauseBtn");
  const pauseText = $("#pauseText");
  const soundBtn = $("#soundBtn");
  const soundOnIcon = $("#soundOnIcon");
  const soundOffIcon = $("#soundOffIcon");
  const helpBtn = $("#helpBtn");
  const toastEl = $("#toast");
  const victoryModal = $("#victory");
  const victorySub = $("#victorySub");
  const victoryTime = $("#victoryTime");
  const victoryMoves = $("#victoryMoves");
  const victoryBest = $("#victoryBest");
  const victoryReset = $("#victoryReset");
  const victoryScramble = $("#victoryScramble");
  const helpModal = $("#help");
  const solverLayer = $("#solverLayer");
  const solverSub = $("#solverSub");

  const faceButtons = $$(".move-btn", facePad);
  const speedButtons = $$(".speed-btn");

  /* ------------------------------------------------------------
     audio — synthesized mechanical clicks, no assets
     ------------------------------------------------------------ */

  const Sound = (() => {
    let ctx = null;
    let noiseBuffer = null;

    const FACE_PITCH = { U: 7, R: 5, F: 3, D: 0, L: 2, B: 4, M: 1, E: 6, S: 8 };

    function ensure() {
      if (!state.sound) return null;
      try {
        if (!ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return null;
          ctx = new AudioCtx();
        }
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        return ctx;
      } catch {
        return null;
      }
    }

    function getNoise() {
      if (!ctx) return null;
      if (noiseBuffer) return noiseBuffer;
      const length = Math.floor(ctx.sampleRate * 0.09);
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        const env = Math.pow(1 - i / length, 3.2);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      return noiseBuffer;
    }

    function click(face, volume = 1) {
      if (!state.sound) return;
      const audio = ensure();
      if (!audio) return;
      try {
        const t = audio.currentTime;
        const pitch = FACE_PITCH[face] ?? 4;
        const out = audio.createGain();
        out.gain.value = 0.5 * volume;
        out.connect(audio.destination);

        // sharp plastic tick
        const noise = audio.createBufferSource();
        noise.buffer = getNoise();
        const band = audio.createBiquadFilter();
        band.type = "bandpass";
        band.frequency.value = 1650 + pitch * 95;
        band.Q.value = 1.15;
        const ng = audio.createGain();
        ng.gain.setValueAtTime(0.0001, t);
        ng.gain.exponentialRampToValueAtTime(0.22 * volume, t + 0.004);
        ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
        noise.connect(band).connect(ng).connect(out);
        noise.start(t);
        noise.stop(t + 0.1);

        // low mechanical body
        const osc = audio.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(155 + pitch * 14, t);
        osc.frequency.exponentialRampToValueAtTime(72, t + 0.075);
        const og = audio.createGain();
        og.gain.setValueAtTime(0.0001, t);
        og.gain.exponentialRampToValueAtTime(0.11 * volume, t + 0.006);
        og.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
        osc.connect(og).connect(out);
        osc.start(t);
        osc.stop(t + 0.12);
      } catch {
        /* audio is a nice-to-have */
      }
    }

    function chime() {
      if (!state.sound) return;
      const audio = ensure();
      if (!audio) return;
      try {
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
        notes.forEach((freq, index) => {
          const t = audio.currentTime + index * 0.085;
          const osc = audio.createOscillator();
          const gain = audio.createGain();
          osc.type = index < 3 ? "triangle" : "sine";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
          osc.connect(gain).connect(audio.destination);
          osc.start(t);
          osc.stop(t + 0.75);
        });
      } catch {
        /* ignore */
      }
    }

    return { ensure, click, chime };
  })();

  /* ------------------------------------------------------------
     three.js scene
     ------------------------------------------------------------ */

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch (error) {
    fatal(
      "WebGL is unavailable",
      "This browser could not create a WebGL context. Try enabling hardware acceleration, updating your browser, or opening the page in a recent version of Chrome, Safari, Firefox, or Edge."
    );
    console.error(error);
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCompact() ? 1.75 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    39,
    window.innerWidth / window.innerHeight,
    0.1,
    120
  );
  const CAMERA_HOME = new THREE.Vector3(6.2, 5.5, 8.3);
  const CAMERA_TARGET = new THREE.Vector3(0, -0.1, 0);
  camera.position.copy(CAMERA_HOME);

  function makeEnvironment() {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, "#314766");
    gradient.addColorStop(0.42, "#101724");
    gradient.addColorStop(1, "#05070b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 512);

    const blobs = [
      [190, 120, 190, "rgba(150, 225, 255, 0.52)"],
      [820, 150, 170, "rgba(255, 214, 170, 0.34)"],
      [520, 340, 250, "rgba(105, 130, 255, 0.14)"],
      [70, 390, 160, "rgba(80, 240, 210, 0.1)"],
    ];
    for (const [x, y, radius, color] of blobs) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, color);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    const texture = new THREE.CanvasTexture(c);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.encoding = THREE.sRGBEncoding;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(texture).texture;
    texture.dispose();
    pmrem.dispose();
    scene.environment = env;
  }

  try {
    makeEnvironment();
  } catch (error) {
    // Environment reflections are optional; keep going with lights only.
    console.warn("Environment map unavailable", error);
  }

  scene.add(new THREE.AmbientLight(0xffffff, 0.22));
  scene.add(new THREE.HemisphereLight(0xa8d8ff, 0x24140b, 0.3));

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
  keyLight.position.set(6.5, 9.5, 7.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -7;
  keyLight.shadow.camera.right = 7;
  keyLight.shadow.camera.top = 7;
  keyLight.shadow.camera.bottom = -7;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 32;
  keyLight.shadow.bias = -0.0006;
  keyLight.shadow.normalBias = 0.02;
  keyLight.shadow.radius = 4;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x8fb9ff, 0.38);
  fillLight.position.set(-7.5, 4.5, -4.5);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffd8a8, 0.3);
  rimLight.position.set(0, -5.5, 4.5);
  scene.add(rimLight);

  // soft contact shadow catcher
  const shadowFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.3 })
  );
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = -2.18;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  function makeGlowTexture() {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext("2d");
    const gradient = ctx.createRadialGradient(256, 256, 10, 256, 256, 250);
    gradient.addColorStop(0, "rgba(74, 150, 255, 0.28)");
    gradient.addColorStop(0.4, "rgba(34, 211, 238, 0.1)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    const texture = new THREE.CanvasTexture(c);
    texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  const glowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 13),
    new THREE.MeshBasicMaterial({
      map: makeGlowTexture(),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  glowPlane.rotation.x = -Math.PI / 2;
  glowPlane.position.y = -2.19;
  glowPlane.renderOrder = -1;
  scene.add(glowPlane);

  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.rotateSpeed = 0.82;
  controls.zoomSpeed = 0.86;
  controls.minDistance = 5.6;
  controls.maxDistance = 24;
  controls.minPolarAngle = 0.1;
  controls.maxPolarAngle = Math.PI - 0.1;
  controls.target.copy(CAMERA_TARGET);

  let userMovedCamera = false;
  controls.addEventListener("start", () => {
    userMovedCamera = true;
  });

  function fitCamera() {
    if (userMovedCamera) return;
    const aspect = window.innerWidth / window.innerHeight;
    let scale = 1;
    if (aspect < 0.55) scale = 1.42;
    else if (aspect < 0.8) scale = 1.28;
    else if (aspect < 1.05) scale = 1.12;
    const distance = CAMERA_HOME.length() * scale;
    camera.position
      .copy(CAMERA_TARGET)
      .addScaledVector(CAMERA_HOME.clone().normalize(), distance);
    controls.target.copy(CAMERA_TARGET);
    controls.update();
    controls.saveState();
  }

  fitCamera();

  /* ------------------------------------------------------------
     cinematic camera director
     ------------------------------------------------------------ */

  const DEG = Math.PI / 180;

  const CINEMA = {
    active: false,
    cameraCancelled: false,
    anim: null,
    saved: null,
    damping: true,
  };

  // Camera viewpoints that make each face readable. The angles are a
  // three-quarter view: enough of the working face to follow the turn,
  // enough of the neighbouring faces to keep the cube legible.
  const CINEMA_FACE_VIEW = {
    F: { theta: 18, phi: 62 },
    R: { theta: 72, phi: 62 },
    L: { theta: -72, phi: 62 },
    B: { theta: 162, phi: 62 },
    U: { theta: 28, phi: 34 },
    D: { theta: 28, phi: 118 },
  };

  const cinemaDirection = new THREE.Vector3();

  function cameraAspectScale() {
    const aspect = window.innerWidth / window.innerHeight;
    if (aspect < 0.55) return 1.42;
    if (aspect < 0.8) return 1.28;
    if (aspect < 1.05) return 1.12;
    return 1;
  }

  function cinematicDistance() {
    return CAMERA_HOME.length() * cameraAspectScale() * 0.94;
  }

  function directionFromSpherical(theta, phi, out = new THREE.Vector3()) {
    const sinPhi = Math.sin(phi);
    return out.set(
      sinPhi * Math.sin(theta),
      Math.cos(phi),
      sinPhi * Math.cos(theta)
    );
  }

  function sphericalFromDirection(direction) {
    const v = direction.clone().normalize();
    return {
      theta: Math.atan2(v.x, v.z),
      phi: Math.acos(clamp(v.y, -1, 1)),
    };
  }

  function shortestAngle(from, to) {
    let delta = (to - from) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
  }

  function cinematicTurnDuration() {
    if (prefersReducedMotion()) return 140;
    return clamp(state.speed * 1.55, 280, 900);
  }

  function cinematicCameraDuration() {
    if (prefersReducedMotion()) return 0;
    return clamp(state.speed * 1.35, 260, 760);
  }

  function animateCinemaCamera({ theta, phi, distance, duration }) {
    return new Promise((resolve) => {
      if (!CINEMA.active || CINEMA.cameraCancelled || duration <= 0) {
        resolve();
        return;
      }
      const fromOffset = camera.position.clone().sub(controls.target);
      const from = sphericalFromDirection(fromOffset);
      CINEMA.anim = {
        fromTheta: from.theta,
        toTheta: from.theta + shortestAngle(from.theta, theta),
        fromPhi: from.phi,
        toPhi: phi,
        fromDistance: fromOffset.length(),
        toDistance: distance,
        fromTarget: controls.target.clone(),
        toTarget: CAMERA_TARGET.clone(),
        start: performance.now(),
        duration,
        resolve,
      };
    });
  }

  function updateCinemaCamera(now) {
    const anim = CINEMA.anim;
    if (!anim) return;
    const t = anim.duration <= 0 ? 1 : clamp((now - anim.start) / anim.duration, 0, 1);
    const eased = easeInOutCubic(t);
    const theta = anim.fromTheta + (anim.toTheta - anim.fromTheta) * eased;
    const phi = anim.fromPhi + (anim.toPhi - anim.fromPhi) * eased;
    const distance =
      anim.fromDistance + (anim.toDistance - anim.fromDistance) * eased;
    controls.target.lerpVectors(anim.fromTarget, anim.toTarget, eased);
    camera.position
      .copy(controls.target)
      .addScaledVector(
        directionFromSpherical(theta, phi, cinemaDirection),
        distance
      );
    if (t >= 1) {
      CINEMA.anim = null;
      anim.resolve();
    }
  }

  function currentCameraDirection() {
    return camera.position.clone().sub(controls.target).normalize();
  }

  function faceIsVisible(face, threshold = 0.22) {
    const normal = FACE_NORMALS[face] || FACE_NORMALS.F;
    return currentCameraDirection().dot(normal) >= threshold;
  }

  function faceViewFor(move) {
    const face = move[0];
    if (face === "M") return CINEMA_FACE_VIEW.R;
    if (face === "E") return CINEMA_FACE_VIEW.U;
    if (face === "S") return CINEMA_FACE_VIEW.F;
    return CINEMA_FACE_VIEW[face] || CINEMA_FACE_VIEW.F;
  }

  function faceForVisibility(move) {
    const face = move[0];
    if (face === "M") return "R";
    if (face === "E") return "U";
    if (face === "S") return "F";
    return face;
  }

  async function cinemaFocus(move) {
    if (!CINEMA.active || CINEMA.cameraCancelled || prefersReducedMotion()) return;
    // Stay planted while the working face is already readable. This keeps
    // most solves on a calm hero view instead of whipping between angles.
    if (faceIsVisible(faceForVisibility(move))) return;
    const view = faceViewFor(move);
    await animateCinemaCamera({
      theta: view.theta * DEG,
      phi: view.phi * DEG,
      distance: cinematicDistance(),
      duration: cinematicCameraDuration(),
    });
  }

  async function cinemaIntro() {
    if (!CINEMA.active || CINEMA.cameraCancelled || prefersReducedMotion()) return;
    updateBanner({
      kicker: state.step ? "STEP" : "AUTO SOLVE",
      move: "Ready",
      sub: state.step
        ? "Click Next to begin the solve."
        : "The two-phase solver found a path home.",
      progress: 0,
    });
    await animateCinemaCamera({
      theta: Math.atan2(CAMERA_HOME.x, CAMERA_HOME.z),
      phi: Math.acos(clamp(CAMERA_HOME.y / CAMERA_HOME.length(), -1, 1)),
      distance: cinematicDistance(),
      duration: 900,
    });
    await wait(220);
  }

  async function cinemaOutro() {
    clearLayerGlow();
    if (!CINEMA.active || CINEMA.cameraCancelled || prefersReducedMotion()) return;
    updateBanner({
      kicker: "SOLVED",
      move: "Done",
      sub: "Every sticker is home.",
      progress: 1,
    });
    await animateCinemaCamera({
      theta: Math.atan2(CAMERA_HOME.x, CAMERA_HOME.z) + 0.25,
      phi:
        Math.acos(clamp(CAMERA_HOME.y / CAMERA_HOME.length(), -1, 1)) - 0.06,
      distance: cinematicDistance() * 1.12,
      duration: 1000,
    });
  }

  function beginCinematic() {
    if (CINEMA.active) return;
    CINEMA.active = true;
    CINEMA.cameraCancelled = false;
    CINEMA.anim = null;
    CINEMA.saved = {
      position: camera.position.clone(),
      target: controls.target.clone(),
    };
    CINEMA.damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.autoRotate = false;
    // Reduced-motion viewers keep camera control; the solve still plays.
    controls.enabled = prefersReducedMotion();
    document.body.classList.add("cinematic");
  }

  function endCinematic({ restore = false } = {}) {
    if (!CINEMA.active) return;
    CINEMA.active = false;
    const pending = CINEMA.anim;
    CINEMA.anim = null;
    if (pending) pending.resolve();
    document.body.classList.remove("cinematic");
    controls.enabled = true;
    controls.enableDamping = CINEMA.damping;
    controls.autoRotate = false;
    clearLayerGlow();
    if (restore && CINEMA.saved) {
      camera.position.copy(CINEMA.saved.position);
      controls.target.copy(CINEMA.saved.target);
      controls.update();
    }
    CINEMA.saved = null;
  }

  function cancelCinematicCamera() {
    if (!CINEMA.active || CINEMA.cameraCancelled) return;
    CINEMA.cameraCancelled = true;
    const pending = CINEMA.anim;
    CINEMA.anim = null;
    if (pending) pending.resolve();
    document.body.classList.remove("cinematic");
    controls.enabled = true;
    controls.enableDamping = CINEMA.damping;
    controls.autoRotate = false;
    toast("Camera control returned to you.", 1700);
  }

  /* ------------------------------------------------------------
     cube geometry
     ------------------------------------------------------------ */

  const cubeGroup = new THREE.Group();
  scene.add(cubeGroup);

  const bodyGeometry = THREE.RoundedBoxGeometry
    ? new THREE.RoundedBoxGeometry(0.96, 0.96, 0.96, 4, 0.045)
    : new THREE.BoxGeometry(0.96, 0.96, 0.96);

  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x06080d,
    roughness: 0.28,
    metalness: 0.58,
    clearcoat: 0.7,
    clearcoatRoughness: 0.22,
    envMapIntensity: 1.25,
  });

  function roundedRectShape(width, height, radius) {
    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -height / 2;
    const r = Math.min(radius, width / 2, height / 2);
    shape.moveTo(x + r, y);
    shape.lineTo(x + width - r, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + r);
    shape.lineTo(x + width, y + height - r);
    shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    shape.lineTo(x + r, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    return shape;
  }

  const stickerGeometry = new THREE.ShapeGeometry(roundedRectShape(0.88, 0.88, 0.11), 6);

  const stickerMaterials = {};
  for (const face of FACE_KEYS) {
    const color = new THREE.Color(FACE_COLORS[face]);
    stickerMaterials[face] = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.25,
      metalness: 0.03,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.78,
      emissive: color.clone().multiplyScalar(0.02),
    });
  }

  const cubelets = [];
  const bodyMeshes = [];
  const stickerMeshes = [];

  // A dark core so the gaps never show the background through the cube.
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.98, 0.98), bodyMaterial);
  core.castShadow = false;
  core.receiveShadow = false;
  cubeGroup.add(core);

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue;

        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData.home = new THREE.Vector3(x, y, z);

        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        body.receiveShadow = true;
        body.userData.cubelet = group;
        group.add(body);
        bodyMeshes.push(body);

        const faces = [];
        if (y === 1) faces.push("U");
        if (y === -1) faces.push("D");
        if (x === 1) faces.push("R");
        if (x === -1) faces.push("L");
        if (z === 1) faces.push("F");
        if (z === -1) faces.push("B");

        for (const face of faces) {
          const normal = FACE_NORMALS[face];
          // Each sticker gets its own material so the cinematic director can
          // pulse just the layer that is turning.
          const material = stickerMaterials[face].clone();
          const sticker = new THREE.Mesh(stickerGeometry, material);
          sticker.position.copy(normal).multiplyScalar(0.4815);
          sticker.quaternion.setFromUnitVectors(Z_AXIS, normal);
          sticker.userData = {
            color: face,
            normal: normal.clone(),
            cubelet: group,
            baseColor: material.color.clone(),
            baseEmissive: material.emissive.clone(),
            glow: 0,
            glowTarget: 0,
          };
          group.add(sticker);
          stickerMeshes.push(sticker);
        }

        cubeGroup.add(group);
        cubelets.push(group);
      }
    }
  }

  /* ------------------------------------------------------------
     cinematic layer glow
     ------------------------------------------------------------ */

  const glowStickers = new Set();
  const GLOW_TINT = new THREE.Color(0x9ff7ff);

  function setLayerGlow(selected, on) {
    for (const cubelet of selected) {
      for (const child of cubelet.children) {
        if (!child.userData || !child.userData.baseColor) continue;
        child.userData.glowTarget = on ? 1 : 0;
        glowStickers.add(child);
      }
    }
  }

  function clearLayerGlow() {
    for (const sticker of stickerMeshes) {
      sticker.userData.glowTarget = 0;
      glowStickers.add(sticker);
    }
  }

  function updateStickerGlow(dt) {
    if (!glowStickers.size) return;
    const k = 1 - Math.exp(-dt * 12);
    for (const sticker of glowStickers) {
      const data = sticker.userData;
      data.glow += (data.glowTarget - data.glow) * k;
      const glow = data.glow;
      sticker.material.emissive
        .copy(data.baseColor)
        .multiplyScalar(0.02 + glow * 0.34)
        .lerp(GLOW_TINT, glow * 0.14);
      sticker.material.emissiveIntensity = 1 + glow * 0.32;
      sticker.scale.setScalar(1 + glow * 0.02);
      if (data.glowTarget === 0 && glow < 0.008) {
        data.glow = 0;
        sticker.material.emissive.copy(data.baseEmissive);
        sticker.material.emissiveIntensity = 1;
        sticker.scale.setScalar(1);
        glowStickers.delete(sticker);
      }
    }
  }

  /* ------------------------------------------------------------
     visual <-> logical sync (also used by the self-test)
     ------------------------------------------------------------ */

  function stickerFacelet(sticker) {
    const cubelet = sticker.userData.cubelet;
    const normal = sticker.userData.normal
      .clone()
      .applyQuaternion(cubelet.quaternion);
    const x = Math.round(cubelet.position.x);
    const y = Math.round(cubelet.position.y);
    const z = Math.round(cubelet.position.z);

    if (Math.abs(normal.y) > 0.5) {
      if (normal.y > 0) return { face: "U", row: z + 1, col: x + 1 };
      return { face: "D", row: 1 - z, col: x + 1 };
    }
    if (Math.abs(normal.x) > 0.5) {
      if (normal.x > 0) return { face: "R", row: 1 - y, col: 1 - z };
      return { face: "L", row: 1 - y, col: z + 1 };
    }
    if (normal.z > 0) return { face: "F", row: 1 - y, col: x + 1 };
    return { face: "B", row: 1 - y, col: 1 - x };
  }

  function getVisualFacelets() {
    const out = new Array(54).fill("?");
    for (const sticker of stickerMeshes) {
      const { face, row, col } = stickerFacelet(sticker);
      out[FACE_OFFSETS[face] + row * 3 + col] = sticker.userData.color;
    }
    return out.join("");
  }

  function checkSync() {
    return getVisualFacelets() === state.cube.asString();
  }

  function isVisuallySolved() {
    const facelets = getVisualFacelets();
    for (let face = 0; face < 6; face++) {
      const slice = facelets.slice(face * 9, face * 9 + 9);
      if (!slice.split("").every((color) => color === slice[0])) return false;
    }
    return true;
  }

  /* ------------------------------------------------------------
     timer + stats
     ------------------------------------------------------------ */

  function timerMs() {
    return state.timer.running
      ? performance.now() - state.timer.start
      : state.timer.elapsed;
  }

  function startTimer() {
    if (state.timer.running) return;
    state.timer.start = performance.now() - state.timer.elapsed;
    state.timer.running = true;
  }

  function stopTimer() {
    if (!state.timer.running) return;
    state.timer.elapsed = performance.now() - state.timer.start;
    state.timer.running = false;
    updateTimerDisplay();
  }

  function resetTimer() {
    state.timer.running = false;
    state.timer.start = 0;
    state.timer.elapsed = 0;
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    timerEl.textContent = formatTime(timerMs());
  }

  function updateBestDisplay() {
    bestTimeEl.textContent = state.best ? formatTime(state.best.ms) : "—";
  }

  function saveBest(ms, moves) {
    if (!state.best || ms < state.best.ms) {
      state.best = { ms, moves, date: new Date().toISOString() };
      writeJSON(BEST_KEY, state.best);
      updateBestDisplay();
      return true;
    }
    return false;
  }

  setInterval(() => {
    if (state.timer.running) updateTimerDisplay();
  }, 47);

  function updateStats() {
    moveCountEl.textContent = String(state.moveCount);
    historyCount.textContent = String(state.history.length);
    updateTimerDisplay();
    updateBestDisplay();
  }

  function setStatus(text, tone) {
    statusText.textContent = text;
    statusPill.dataset.tone = tone;
    const label =
      text === "Ready"
        ? "Solved"
        : text === "In Play"
          ? "Scrambled"
          : text;
    stateLabel.textContent = label;
  }

  function refreshStatus() {
    if (state.mode === "scrambling") {
      setStatus("Scrambling", "scramble");
      return;
    }
    if (state.mode === "solving") {
      if (state.step && state.stepWaiting) {
        setStatus("Step", "solve");
        return;
      }
      setStatus(state.paused ? "Paused" : "Solving", state.paused ? "scramble" : "solve");
      return;
    }
    if (state.mode === "solved" || state.celebrating) {
      setStatus("Solved", "solved");
      return;
    }
    if (state.scrambled && !state.started) {
      setStatus("Scrambled", "scramble");
      return;
    }
    if (state.started) {
      setStatus("In Play", "ready");
      return;
    }
    setStatus("Ready", "ready");
  }

  /* ------------------------------------------------------------
     move history
     ------------------------------------------------------------ */

  function baseFace(move) {
    return move[0] || "U";
  }

  function renderHistory() {
    historyCount.textContent = String(state.history.length);
    if (!state.history.length) {
      historyList.innerHTML =
        '<span class="history-empty">Your moves will appear here. Drag a sticker or use the dock below.</span>';
      return;
    }
    const visible = state.history.slice(-240);
    const prefix =
      state.history.length > visible.length
        ? '<span class="history-empty">…</span>'
        : "";
    historyList.innerHTML =
      prefix +
      visible
        .map((entry) => {
          const face = baseFace(entry.move);
          const source = entry.source === "solver" ? " source-solver" : " source-user";
          return `<span class="move-chip f-${escapeHtml(face)}${source}" title="${escapeHtml(
            entry.source === "solver" ? "Solver move" : "Your move"
          )}">${escapeHtml(displayMove(entry.move))}</span>`;
        })
        .join("");
    historyList.scrollTop = historyList.scrollHeight;
  }

  function recordMove(move, source) {
    state.history.push({ move, source });
    state.moveCount++;
    state.started = true;
    state.scrambled = true;
    if (!state.timer.running && source !== "scramble") startTimer();
    updateStats();
    renderHistory();
    refreshStatus();
    setButtons();
  }

  function invertMove(move) {
    const base = move[0];
    const mod = move.slice(1);
    if (mod === "") return base + "'";
    if (mod === "'") return base;
    return base + "2";
  }

  /* ------------------------------------------------------------
     turn animation + queue
     ------------------------------------------------------------ */

  let queue = [];
  let isAnimating = false;
  let stepGate = null;
  let epoch = 0;
  let currentTurn = null;

  function parseMove(move) {
    const base = move[0];
    const mod = move.slice(1);
    const def = MOVE_DEFS[base];
    if (!def || (mod !== "" && mod !== "'" && mod !== "2")) {
      throw new Error(`Unknown move: ${move}`);
    }
    const factor = mod === "'" ? -1 : mod === "2" ? 2 : 1;
    return {
      base,
      mod,
      axis: def.axis,
      layer: def.layer,
      angle: def.angle * factor,
    };
  }

  function waitForStep() {
    if (!state.step) return Promise.resolve();
    return new Promise((resolve) => {
      stepGate = { resolve };
      state.stepWaiting = true;
      refreshStatus();
      setButtons();
    });
  }

  function releaseStep() {
    const gate = stepGate;
    stepGate = null;
    state.stepWaiting = false;
    if (gate) gate.resolve();
    refreshStatus();
    setButtons();
  }

  function advanceStep() {
    if (!state.step || !state.stepWaiting) return;
    releaseStep();
  }

  function performMove(move, options = {}) {
    return new Promise((resolve) => {
      queue.push({
        move,
        options,
        resolve,
        token: epoch,
      });
      pump();
      setButtons();
    });
  }

  function pump() {
    if (isAnimating) return;
    const item = queue.shift();
    if (!item) return;
    if (item.token !== epoch) {
      item.resolve({ cancelled: true });
      pump();
      return;
    }
    isAnimating = true;
    startTurn(item);
  }

  function startTurn(item) {
    const { move, options, resolve, token } = item;
    let parsed;
    try {
      parsed = parseMove(move);
    } catch (error) {
      console.warn(error);
      isAnimating = false;
      resolve({ cancelled: true });
      pump();
      return;
    }

    const axisVector = AXIS_VECTORS[parsed.axis];
    const selected = cubelets.filter(
      (cubelet) => Math.round(cubelet.position[parsed.axis]) === parsed.layer
    );
    if (options.highlightLayer) {
      clearLayerGlow();
      setLayerGlow(selected, true);
    }
    const starts = selected.map((cubelet) => ({
      cubelet,
      position: cubelet.position.clone(),
      quaternion: cubelet.quaternion.clone(),
    }));

    const duration = Math.max(0, options.duration ?? 300);
    const rotation = new THREE.Quaternion();
    const startedAt = performance.now();
    currentTurn = { move, parsed, starts, rotation, axisVector };

    function applyAt(eased) {
      rotation.setFromAxisAngle(axisVector, parsed.angle * eased);
      for (const start of starts) {
        start.cubelet.position.copy(start.position).applyQuaternion(rotation);
        start.cubelet.quaternion.copy(rotation).multiply(start.quaternion);
      }
    }

    function finish() {
      rotation.setFromAxisAngle(axisVector, parsed.angle);
      for (const start of starts) {
        start.cubelet.position.copy(start.position).applyQuaternion(rotation);
        start.cubelet.position.set(
          Math.round(start.cubelet.position.x),
          Math.round(start.cubelet.position.y),
          Math.round(start.cubelet.position.z)
        );
        start.cubelet.quaternion
          .copy(rotation)
          .multiply(start.quaternion)
          .normalize();
      }

      state.cube.move(move);

      if (options.record !== false) {
        recordMove(move, options.source || "user");
      }

      if (options.onComplete) {
        try {
          options.onComplete();
        } catch (error) {
          console.error(error);
        }
      }

      Sound.click(parsed.base, options.soundVolume ?? 1);

      if (options.checkSolved !== false) {
        checkSolved(options.source || "user");
      }

      isAnimating = false;
      currentTurn = null;
      resolve({ cancelled: false });
      pump();
      setButtons();
    }

    function frame(now) {
      if (token !== epoch) {
        isAnimating = false;
        currentTurn = null;
        resolve({ cancelled: true });
        pump();
        return;
      }
      const progress = duration <= 0 ? 1 : clamp((now - startedAt) / duration, 0, 1);
      applyAt(easeInOutCubic(progress));
      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        finish();
      }
    }

    if (duration <= 0) {
      applyAt(1);
      finish();
    } else {
      requestAnimationFrame(frame);
    }
  }

  /* ------------------------------------------------------------
     solved / victory
     ------------------------------------------------------------ */

  const confetti = [];
  const confettiGeometry = new THREE.BoxGeometry(0.055, 0.012, 0.09);
  const confettiColors = [
    0x5ee7f5, 0x818cf8, 0xfbbf24, 0x34d399, 0xfb7185, 0xffffff, 0xff7a18,
    0x2f6bff,
  ].map((color) => new THREE.MeshBasicMaterial({ color }));

  function clearConfetti() {
    for (const particle of confetti) scene.remove(particle);
    confetti.length = 0;
  }

  function spawnConfetti() {
    clearConfetti();
    const count = isCompact() ? 90 : 150;
    for (let i = 0; i < count; i++) {
      const particle = new THREE.Mesh(
        confettiGeometry,
        confettiColors[i % confettiColors.length]
      );
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.1 + Math.random() * 1.7;
      particle.position.set(
        Math.cos(angle) * radius,
        (Math.random() - 0.25) * 2.4,
        Math.sin(angle) * radius
      );
      particle.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      particle.userData.velocity = new THREE.Vector3(
        Math.cos(angle) * (1.2 + Math.random() * 2.2),
        2.2 + Math.random() * 3.8,
        Math.sin(angle) * (1.2 + Math.random() * 2.2)
      );
      particle.userData.spin = new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14
      );
      particle.userData.life = 2.6 + Math.random() * 2;
      particle.userData.age = 0;
      scene.add(particle);
      confetti.push(particle);
    }
  }

  function updateConfetti(dt) {
    for (let i = confetti.length - 1; i >= 0; i--) {
      const particle = confetti[i];
      particle.userData.age += dt;
      const life = particle.userData.life;
      if (particle.userData.age >= life) {
        scene.remove(particle);
        confetti.splice(i, 1);
        continue;
      }
      particle.userData.velocity.y -= 7.4 * dt;
      particle.position.addScaledVector(particle.userData.velocity, dt);
      particle.rotation.x += particle.userData.spin.x * dt;
      particle.rotation.y += particle.userData.spin.y * dt;
      particle.rotation.z += particle.userData.spin.z * dt;
      const fade = Math.min(1, (life - particle.userData.age) / 0.55);
      particle.scale.setScalar(fade);
    }
  }

  let cameraOrbitTimer = 0;

  function celebrateCamera() {
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.35;
    clearTimeout(cameraOrbitTimer);
    cameraOrbitTimer = setTimeout(() => {
      controls.autoRotate = false;
    }, 5200);
  }

  function showVictory(ms, assisted, isBest) {
    victoryTime.textContent = formatTime(ms);
    victoryMoves.textContent = String(state.moveCount);
    victoryBest.textContent = state.best ? formatTime(state.best.ms) : "—";
    if (isBest) {
      victorySub.textContent = "New personal best. Every sticker is home.";
    } else if (assisted) {
      victorySub.textContent = `Solved with the two-phase solver in ${state.solution.length || state.moveCount} moves.`;
    } else {
      victorySub.textContent = "Every sticker is home. Beautifully done.";
    }
    openModal("victory");
  }

  function onSolved(source) {
    if (state.celebrating) return;
    state.celebrating = true;
    state.mode = "solved";
    stopTimer();
    refreshStatus();
    setButtons();

    const ms = timerMs();
    const assisted = source === "solver" || state.assisted;
    let isBest = false;
    if (!assisted && state.started && ms > 400 && state.moveCount > 0) {
      isBest = saveBest(ms, state.moveCount);
    }

    Sound.chime();
    spawnConfetti();
    celebrateCamera();
    hideBanner();

    setTimeout(() => {
      if (state.celebrating) showVictory(ms, assisted, isBest);
    }, 700);
  }

  function checkSolved(source) {
    if (source === "scramble") return;
    if (!state.cube.isSolved()) return;
    if (!state.started) return;
    if (state.celebrating) return;
    onSolved(source);
  }

  /* ------------------------------------------------------------
     UI state
     ------------------------------------------------------------ */

  let toastTimer = 0;
  let bannerTimer = 0;

  function toast(message, duration = 2200) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), duration);
  }

  function updateBanner({ kicker, move, sub, progress, show = true }) {
    if (kicker !== undefined) bannerKicker.textContent = kicker;
    if (move !== undefined) bannerMove.textContent = move;
    if (sub !== undefined) bannerSub.textContent = sub;
    if (progress !== undefined) {
      bannerBar.style.width = `${clamp(progress, 0, 1) * 100}%`;
    }
    if (show) {
      clearTimeout(bannerTimer);
      banner.classList.add("show");
    }
  }

  function hideBanner() {
    banner.classList.remove("show");
    clearTimeout(bannerTimer);
  }

  function showBannerFor(duration) {
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => banner.classList.remove("show"), duration);
  }

  function updatePauseButton() {
    const stepping = state.step;
    const label = stepping ? "Next" : state.paused ? "Resume" : "Pause";
    const aria = stepping
      ? "Next solver move"
      : state.paused
        ? "Resume solver playback"
        : "Pause solver playback";
    const icon = stepping
      ? '<path d="M6 5v14l11-7z"/><rect x="18" y="5" width="2" height="14" rx="1"/>'
      : state.paused
        ? '<path d="M8 5v14l11-7z"/>'
        : '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>';

    pauseBtn.classList.toggle("show", state.mode === "solving");
    pauseText.textContent = label;
    pauseBtn.setAttribute("aria-label", aria);
    const svg = pauseBtn.querySelector("svg");
    if (svg) svg.innerHTML = icon;

    cinePauseText.textContent = label;
    cinePause.setAttribute("aria-label", aria);
    const cineSvg = cinePause.querySelector("svg");
    if (cineSvg) cineSvg.innerHTML = icon;
  }

  function setButtons() {
    const solving = state.mode === "solving";
    const scrambling = state.mode === "scrambling";
    const lock = solving || scrambling;

    for (const button of faceButtons) button.disabled = lock;

    scrambleBtn.disabled = lock || isAnimating;
    solveBtn.disabled = lock || isAnimating || state.cube.isSolved() || state.celebrating;
    autoBtn.disabled = lock || isAnimating;
    undoBtn.disabled = lock || isAnimating || state.history.length === 0;
    resetBtn.disabled = false;
    const canStep = state.step && state.stepWaiting && !isAnimating;
    pauseBtn.disabled = state.step ? !canStep : !solving;
    cinePause.disabled = state.step ? !canStep : !solving;

    const solveLabel = solveBtn.querySelector("span");
    if (solveLabel) solveLabel.textContent = solving ? "Solving…" : "Solve";
    const autoLabel = autoBtn.querySelector("span");
    if (autoLabel) autoLabel.textContent = solving ? "Auto…" : "Auto Solve";
    const scrambleLabel = scrambleBtn.querySelector("span");
    if (scrambleLabel) scrambleLabel.textContent = scrambling ? "Scrambling…" : "Scramble";

    updatePauseButton();
  }

  function setSpeed(value) {
    const step = value === "step" || value === "Step";
    if (!step && state.stepWaiting) releaseStep();
    state.step = step;
    if (!step) {
      state.speed = Number(value);
      writeJSON(SPEED_KEY, state.speed);
    }
    writeJSON(STEP_KEY, state.step);
    for (const button of speedButtons) {
      const isStep = button.dataset.speed === "step";
      const active = step
        ? isStep
        : !isStep && Number(button.dataset.speed) === state.speed;
      button.classList.toggle("is-active", active);
    }
    setButtons();
  }

  function updateSoundButton() {
    soundOnIcon.style.display = state.sound ? "" : "none";
    soundOffIcon.style.display = state.sound ? "none" : "";
    soundBtn.classList.toggle("is-off", !state.sound);
    soundBtn.setAttribute("aria-label", state.sound ? "Mute sound" : "Enable sound");
  }

  function openModal(id) {
    const modal = id === "victory" ? victoryModal : helpModal;
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.dataset.modal = id;
  }

  function closeModal(id) {
    const modal = id === "victory" ? victoryModal : helpModal;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    if (id === "victory") {
      state.celebrating = false;
      controls.autoRotate = false;
    }
    if (!document.querySelector(".modal-layer.show")) delete document.body.dataset.modal;
  }

  function closeAllModals() {
    closeModal("victory");
    closeModal("help");
  }

  function showSolver(show) {
    solverLayer.classList.toggle("show", show);
    solverLayer.setAttribute("aria-hidden", show ? "false" : "true");
  }

  /* ------------------------------------------------------------
     solver worker — keeps the UI responsive while Kociemba warms up
     ------------------------------------------------------------ */

  let solverWorker = null;
  let solverWorkerFailed = false;

  function initSolverWorker() {
    if (solverWorker) return solverWorker;
    if (solverWorkerFailed) return null;
    if (!window.Worker || !window.Blob || !window.URL) return null;

    const sourceElement = document.getElementById("vendor-source");
    if (!sourceElement) return null;

    try {
      const bootstrap = `
self.onmessage = function (event) {
  var data = event.data || {};
  try {
    if (data.type === "init") {
      Cube.initSolver();
      self.postMessage({ type: "ready" });
    } else if (data.type === "solve") {
      var cube = Cube.fromString(data.state);
      var solution = cube.solve();
      self.postMessage({ type: "solution", id: data.id, solution: solution });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      id: data.id,
      message: String((error && error.message) || error)
    });
  }
};
`;
      const blob = new Blob([sourceElement.textContent, bootstrap], {
        type: "application/javascript",
      });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);
      const pending = new Map();
      let sequence = 0;

      const ready = new Promise((resolve, reject) => {
        const initTimer = setTimeout(
          () => reject(new Error("Solver worker timed out during initialization")),
          25000
        );
        worker.onmessage = (event) => {
          const data = event.data || {};
          if (data.type === "ready") {
            clearTimeout(initTimer);
            resolve();
            return;
          }
          if (data.type === "solution") {
            const job = pending.get(data.id);
            if (job) {
              pending.delete(data.id);
              clearTimeout(job.timer);
              job.resolve(data.solution);
            }
            return;
          }
          if (data.type === "error") {
            const job = pending.get(data.id);
            if (job) {
              pending.delete(data.id);
              clearTimeout(job.timer);
              job.reject(new Error(data.message));
            } else {
              clearTimeout(initTimer);
              reject(new Error(data.message));
            }
          }
        };
        worker.onerror = (event) => {
          clearTimeout(initTimer);
          reject(new Error(event.message || "Solver worker failed"));
        };
      });

      ready.catch(() => {
        solverWorkerFailed = true;
        try {
          worker.terminate();
        } catch {
          /* ignore */
        }
      });

      const wrapper = {
        ready,
        solve(stateString) {
          return new Promise((resolve, reject) => {
            const id = ++sequence;
            const timer = setTimeout(() => {
              pending.delete(id);
              reject(new Error("Solver timed out"));
            }, 15000);
            pending.set(id, { resolve, reject, timer });
            worker.postMessage({ type: "solve", state: stateString, id });
          });
        },
        terminate() {
          try {
            worker.terminate();
          } catch {
            /* ignore */
          }
          URL.revokeObjectURL(url);
        },
      };

      worker.postMessage({ type: "init" });
      solverWorker = wrapper;
      return wrapper;
    } catch (error) {
      console.warn("Solver worker unavailable; using main thread", error);
      solverWorkerFailed = true;
      return null;
    }
  }

  async function computeSolution(onProgress) {
    const worker = initSolverWorker();
    if (worker) {
      try {
        onProgress("Warming up the two-phase solver…");
        await worker.ready;
        onProgress("Searching the solution space…");
        return await worker.solve(state.cube.asString());
      } catch (error) {
        console.warn("Falling back to the main-thread solver", error);
        solverWorkerFailed = true;
        try {
          worker.terminate();
        } catch {
          /* ignore */
        }
        solverWorker = null;
      }
    }

    onProgress("Initializing the two-phase solver…");
    await wait(60);
    if (!state.solverReady) {
      Cube.initSolver();
      state.solverReady = true;
    }
    onProgress("Searching the solution space…");
    await wait(30);
    return state.cube.solve();
  }

  /* ------------------------------------------------------------
     user moves, scramble, solve, undo, reset
     ------------------------------------------------------------ */

  function userMove(move) {
    if (state.mode === "solving" || state.mode === "scrambling") return;
    if (document.body.dataset.modal) return;
    if (CINEMA.active) endCinematic({ restore: false });
    Sound.ensure();

    if (state.mode === "solved" || state.celebrating) {
      state.mode = "idle";
      state.celebrating = false;
      state.history = [];
      state.moveCount = 0;
      state.started = false;
      state.scrambled = false;
      state.assisted = false;
      resetTimer();
      renderHistory();
      updateStats();
      controls.autoRotate = false;
      hideBanner();
    }

    performMove(move, {
      record: true,
      source: "user",
      duration: prefersReducedMotion() ? 160 : 300,
    }).then((result) => {
      if (result.cancelled) return;
      if (state.mode === "idle") refreshStatus();
    });
  }

  function generateScramble(length = 20) {
    const faces = ["U", "R", "F", "D", "L", "B"];
    const modifiers = ["", "'", "2"];
    const axisOf = { U: "y", D: "y", L: "x", R: "x", F: "z", B: "z" };
    const moves = [];
    let lastFace = "";
    let lastAxis = "";
    let beforeLastAxis = "";

    while (moves.length < length) {
      const face = faces[Math.floor(Math.random() * faces.length)];
      const axis = axisOf[face];
      if (face === lastFace) continue;
      // Avoid U D U style redundancy: if the previous two moves share
      // an axis, don't immediately use that axis again.
      if (axis === lastAxis && lastAxis === beforeLastAxis) continue;
      const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
      moves.push(face + modifier);
      beforeLastAxis = lastAxis;
      lastAxis = axis;
      lastFace = face;
    }
    return moves;
  }

  async function scramble() {
    if (state.mode === "solving" || state.mode === "scrambling" || isAnimating) return;
    if (CINEMA.active) endCinematic({ restore: false });
    clearLayerGlow();
    Sound.ensure();
    const session = ++state.session;
    releaseStep();
    closeAllModals();
    state.mode = "scrambling";
    state.celebrating = false;
    state.scrambled = false;
    state.started = false;
    state.assisted = false;
    state.paused = false;
    state.history = [];
    state.moveCount = 0;
    state.solution = [];
    state.solutionIndex = 0;
    resetTimer();
    clearConfetti();
    controls.autoRotate = false;
    updateStats();
    renderHistory();
    refreshStatus();
    setButtons();
    hideBanner();

    const moves = generateScramble(20);
    const duration = prefersReducedMotion() ? 30 : 92;

    for (let i = 0; i < moves.length; i++) {
      if (session !== state.session) return;
      updateBanner({
        kicker: "SCRAMBLING",
        move: displayMove(moves[i]),
        sub: `${i + 1} of ${moves.length} · ${moves
          .slice(Math.max(0, i - 2), i + 3)
          .map(displayMove)
          .join(" ")}`,
        progress: (i + 1) / moves.length,
      });
      await performMove(moves[i], {
        record: false,
        source: "scramble",
        duration,
        checkSolved: false,
        soundVolume: 0.55,
      });
    }

    if (session !== state.session) return;
    state.mode = "idle";
    state.scrambled = true;
    state.started = false;
    state.moveCount = 0;
    state.history = [];
    resetTimer();
    updateStats();
    renderHistory();
    refreshStatus();
    setButtons();
    updateBanner({
      kicker: "SCRAMBLE",
      move: `${moves.length} moves`,
      sub: moves.map(displayMove).join(" "),
      progress: 1,
    });
    showBannerFor(6500);
  }

  function updateSolveBanner(index, moves, cinematic = false) {
    const current = moves[index] || "";
    const upcoming = moves.slice(index + 1, index + 5).map(displayMove).join(" ");
    updateBanner({
      kicker: state.paused
        ? "PAUSED"
        : state.step
          ? `STEP · ${index + 1}/${moves.length}`
          : cinematic
            ? `AUTO SOLVE · ${index + 1}/${moves.length}`
            : `SOLVING · ${index + 1}/${moves.length}`,
      move: displayMove(current),
      sub: state.paused
        ? "Playback paused — press Space or Resume"
        : state.step
          ? upcoming
            ? `Click Next · then ${upcoming}`
            : "Click Next for the final move"
          : upcoming
            ? `Next: ${upcoming}`
            : "Final move",
      progress: (index + 1) / moves.length,
    });
  }

  async function solveCube(options = {}) {
    if (state.mode === "solving" || state.mode === "scrambling" || isAnimating) return;
    if (state.cube.isSolved()) {
      toast("The cube is already solved.");
      return;
    }
    if (typeof Cube.initSolver !== "function") {
      toast("The solver is unavailable in this browser.");
      return;
    }

    const cinematic = options.cinematic === true;
    Sound.ensure();
    const session = ++state.session;
    closeModal("victory");
    state.mode = "solving";
    state.celebrating = false;
    state.paused = false;
    state.assisted = true;
    refreshStatus();
    setButtons();
    if (cinematic) beginCinematic();
    showSolver(true);
    solverSub.textContent = "Initializing the two-phase solver…";
    await wait(70);

    try {
      const solution = await computeSolution((message) => {
        solverSub.textContent = message;
      });
      if (session !== state.session) return;
      const moves = solution.trim() ? solution.trim().split(/\s+/) : [];
      showSolver(false);

      if (!moves.length) {
        if (cinematic) endCinematic({ restore: true });
        if (state.cube.isSolved()) onSolved("solver");
        else toast("No solution found. Try resetting the cube.");
        state.mode = state.cube.isSolved() ? "solved" : "idle";
        refreshStatus();
        setButtons();
        return;
      }

      state.solution = moves;
      state.solutionIndex = 0;
      if (!state.started) {
        state.started = true;
        startTimer();
      }
      refreshStatus();
      setButtons();

      if (cinematic) {
        await cinemaIntro();
        if (session !== state.session) return;
      }

      for (let i = 0; i < moves.length; i++) {
        if (session !== state.session) return;
        while (state.paused && session === state.session) {
          await wait(80);
        }
        if (session !== state.session) return;
        state.solutionIndex = i;
        if (cinematic) {
          await cinemaFocus(moves[i]);
          if (session !== state.session) return;
          while (state.paused && session === state.session) {
            await wait(80);
          }
          if (session !== state.session) return;
        }
        updateSolveBanner(i, moves, cinematic);
        if (state.step) {
          await waitForStep();
          if (session !== state.session) return;
        }
        await performMove(moves[i], {
          record: true,
          source: "solver",
          duration: cinematic ? cinematicTurnDuration() : state.speed,
          highlightLayer: cinematic,
          checkSolved: !cinematic,
        });
        if (session !== state.session) return;
        if (state.celebrating) break;
      }

      if (session !== state.session) return;
      if (cinematic) {
        await cinemaOutro();
        if (session !== state.session) return;
        endCinematic({ restore: false });
      }
      if (state.cube.isSolved()) {
        if (!state.celebrating) onSolved("solver");
      } else {
        state.mode = "idle";
        toast("Playback finished.");
        showBannerFor(2600);
      }
      refreshStatus();
      setButtons();
    } catch (error) {
      console.error(error);
      if (session === state.session) {
        showSolver(false);
        if (cinematic) endCinematic({ restore: true });
      }
      state.mode = "idle";
      refreshStatus();
      setButtons();
      toast("The solver hit an unexpected state. Try Reset.");
    } finally {
      if (session === state.session) {
        showSolver(false);
        if (cinematic) endCinematic({ restore: !state.cube.isSolved() });
        if (state.mode === "solving") {
          state.mode = state.cube.isSolved() ? "solved" : "idle";
          refreshStatus();
          setButtons();
        }
      }
    }
  }

  async function autoSolve() {
    if (state.mode === "solving" || state.mode === "scrambling" || isAnimating) return;
    if (typeof Cube.initSolver !== "function") {
      toast("The solver is unavailable in this browser.");
      return;
    }
    closeAllModals();
    Sound.ensure();

    // A solved cube gets a fresh scramble first so the show has a beginning.
    if (state.cube.isSolved()) {
      toast("Scrambling first, then solving…", 1800);
      await scramble();
      if (state.mode === "solving" || state.mode === "scrambling") return;
    }

    await solveCube({ cinematic: true });
  }

  function togglePause() {
    if (state.mode !== "solving") return;
    if (state.cube.isSolved()) return;
    state.paused = !state.paused;
    updatePauseButton();
    refreshStatus();
    if (state.solution.length) {
      updateSolveBanner(state.solutionIndex, state.solution, CINEMA.active);
    }
    toast(state.paused ? "Playback paused" : "Playback resumed", 1400);
  }

  function undo() {
    if (state.mode === "solving" || state.mode === "scrambling" || isAnimating) return;
    if (!state.history.length) {
      toast("Nothing to undo.");
      return;
    }
    Sound.ensure();
    const last = state.history[state.history.length - 1];
    const inverse = invertMove(last.move);
    state.mode = "undo";
    setButtons();
    performMove(inverse, {
      record: false,
      source: "undo",
      duration: prefersReducedMotion() ? 140 : 260,
      onComplete: () => {
        state.history.pop();
        state.moveCount = Math.max(0, state.moveCount - 1);
        updateStats();
        renderHistory();
      },
    }).then((result) => {
      if (result.cancelled) return;
      if (state.mode === "undo") {
        state.mode = state.cube.isSolved() ? "solved" : "idle";
        refreshStatus();
        setButtons();
      }
    });
  }

  function resetCube({ silent = false } = {}) {
    state.session++;
    epoch++;
    if (CINEMA.active) endCinematic({ restore: false });
    clearLayerGlow();
    releaseStep();
    for (const item of queue) item.resolve({ cancelled: true });
    queue = [];
    isAnimating = false;
    currentTurn = null;

    state.cube = new Cube();
    state.history = [];
    state.moveCount = 0;
    state.started = false;
    state.scrambled = false;
    state.assisted = false;
    state.celebrating = false;
    state.paused = false;
    state.mode = "idle";
    state.solution = [];
    state.solutionIndex = 0;

    resetTimer();
    clearConfetti();
    clearTimeout(cameraOrbitTimer);
    controls.autoRotate = false;

    for (const cubelet of cubelets) {
      cubelet.position.copy(cubelet.userData.home);
      cubelet.quaternion.identity();
    }

    hideBanner();
    closeAllModals();
    showSolver(false);

    updateStats();
    renderHistory();
    refreshStatus();
    setButtons();

    if (!silent) {
      controls.reset();
      toast("Cube reset.");
    }
  }

  /* ------------------------------------------------------------
     drag-to-turn + orbit
     ------------------------------------------------------------ */

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const tempQuaternion = new THREE.Quaternion();
  let dragState = null;

  function snapToAxis(vector) {
    const ax = Math.abs(vector.x);
    const ay = Math.abs(vector.y);
    const az = Math.abs(vector.z);
    if (ax >= ay && ax >= az) {
      return new THREE.Vector3(Math.sign(vector.x) || 1, 0, 0);
    }
    if (ay >= ax && ay >= az) {
      return new THREE.Vector3(0, Math.sign(vector.y) || 1, 0);
    }
    return new THREE.Vector3(0, 0, Math.sign(vector.z) || 1);
  }

  function moveFromAxis(axisName, layer, sign) {
    const entry = AXIS_MOVES[axisName] && AXIS_MOVES[axisName][String(layer)];
    if (!entry) return null;
    const [face, canonicalSign] = entry;
    return sign === canonicalSign ? face : `${face}'`;
  }

  function screenDirection(origin, direction) {
    const rect = canvas.getBoundingClientRect();
    const a = origin.clone().project(camera);
    const b = origin
      .clone()
      .addScaledVector(direction, 0.3)
      .project(camera);
    const dx = (b.x - a.x) * rect.width;
    const dy = -(b.y - a.y) * rect.height;
    const length = Math.hypot(dx, dy) || 1;
    return new THREE.Vector2(dx / length, dy / length);
  }

  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (document.body.dataset.modal || solverLayer.classList.contains("show")) return;
    if (CINEMA.active && !CINEMA.cameraCancelled) {
      // Any grab hands the camera back; the solve keeps playing.
      cancelCinematicCamera();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(bodyMeshes, false);
    if (!hits.length) return;

    const hit = hits[0];
    const cubelet = hit.object.userData.cubelet;
    if (!cubelet) return;

    const normal = snapToAxis(
      hit.face.normal.clone().applyQuaternion(hit.object.getWorldQuaternion(tempQuaternion))
    );

    Sound.ensure();
    controls.enabled = false;
    event.stopPropagation();
    event.preventDefault();
    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }

    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      hitPoint: hit.point.clone(),
      normal,
      cubelet,
      moved: false,
    };
  }

  function onPointerMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    if (Math.hypot(dx, dy) < 9) return;

    if (dragState.moved) {
      event.preventDefault();
      return;
    }

    const drag = new THREE.Vector2(dx, dy);
    drag.normalize();

    const tangents = [];
    for (const axisName of ["x", "y", "z"]) {
      const axis = AXIS_VECTORS[axisName];
      if (Math.abs(axis.dot(dragState.normal)) > 0.5) continue;
      tangents.push(axis.clone(), axis.clone().negate());
    }

    let best = null;
    for (const tangent of tangents) {
      const screen = screenDirection(dragState.hitPoint, tangent);
      const dot = screen.dot(drag);
      if (!best || dot > best.dot) best = { tangent, dot };
    }

    if (!best || best.dot < 0.22) return;

    let axis = new THREE.Vector3()
      .crossVectors(dragState.normal, best.tangent)
      .round();
    if (axis.lengthSq() < 0.5) return;

    let sign = 1;
    if (axis.x + axis.y + axis.z < 0) {
      axis.negate();
      sign = -1;
    }
    const axisName = axis.x !== 0 ? "x" : axis.y !== 0 ? "y" : "z";
    const layer = Math.round(dragState.cubelet.position.dot(axis));
    const move = moveFromAxis(axisName, layer, sign);
    if (!move) return;

    dragState.moved = true;
    event.preventDefault();
    if (navigator.vibrate) navigator.vibrate(8);
    userMove(move);
  }

  function onPointerUp(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    controls.enabled = true;
    if (canvas.releasePointerCapture) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }
    dragState = null;
  }

  canvas.addEventListener("pointerdown", onPointerDown, { capture: true });
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  /* ------------------------------------------------------------
     keyboard
     ------------------------------------------------------------ */

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (target && target.closest && target.closest("input, textarea, select")) return;

    if (event.key === "Escape") {
      if (document.body.dataset.modal) closeAllModals();
      else if (CINEMA.active && !CINEMA.cameraCancelled) cancelCinematicCamera();
      return;
    }

    if (document.body.dataset.modal) return;

    if (event.key === " " || event.code === "Space") {
      if (state.mode === "solving") {
        event.preventDefault();
        if (state.step) advanceStep();
        else togglePause();
      }
      return;
    }

    const key = event.key.toUpperCase();
    if (key === "N" && state.mode === "solving" && state.step) {
      event.preventDefault();
      if (!event.repeat) advanceStep();
      return;
    }

    if (key.length === 1 && FACE_KEYS.includes(key)) {
      event.preventDefault();
      if (event.repeat) return;
      userMove(key + (event.shiftKey ? "'" : ""));
      return;
    }

    if (key === "Z" && !event.shiftKey) {
      event.preventDefault();
      if (!event.repeat) undo();
    }
  });

  /* ------------------------------------------------------------
     UI events
     ------------------------------------------------------------ */

  facePad.addEventListener("click", (event) => {
    const button = event.target.closest("[data-move]");
    if (!button) return;
    userMove(button.dataset.move);
  });

  scrambleBtn.addEventListener("click", () => scramble());
  solveBtn.addEventListener("click", () => solveCube());
  autoBtn.addEventListener("click", () => autoSolve());
  cinePause.addEventListener("click", () =>
    state.step ? advanceStep() : togglePause()
  );
  cineExit.addEventListener("click", () => cancelCinematicCamera());
  undoBtn.addEventListener("click", () => undo());
  resetBtn.addEventListener("click", () => resetCube());
  pauseBtn.addEventListener("click", () =>
    state.step ? advanceStep() : togglePause()
  );

  for (const button of speedButtons) {
    button.addEventListener("click", () => setSpeed(button.dataset.speed));
  }

  soundBtn.addEventListener("click", () => {
    state.sound = !state.sound;
    writeJSON(SOUND_KEY, state.sound);
    updateSoundButton();
    if (state.sound) {
      Sound.ensure();
      Sound.click("U", 0.6);
      toast("Sound on", 1200);
    } else {
      toast("Sound off", 1200);
    }
  });

  helpBtn.addEventListener("click", () => openModal("help"));
  $$("[data-close]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.close));
  });
  for (const layer of [victoryModal, helpModal]) {
    layer.addEventListener("click", (event) => {
      if (event.target === layer) closeModal(layer.id);
    });
  }

  victoryReset.addEventListener("click", () => {
    closeModal("victory");
    resetCube();
  });
  victoryScramble.addEventListener("click", () => {
    closeModal("victory");
    scramble();
  });

  copyBtn.addEventListener("click", async () => {
    if (!state.history.length) {
      toast("No moves to copy yet.");
      return;
    }
    const text = state.history.map((entry) => entry.move).join(" ");
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      toast("Move history copied.");
    } catch {
      toast("Could not access the clipboard.");
    }
  });

  /* ------------------------------------------------------------
     resize + render loop
     ------------------------------------------------------------ */

  function onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 720 ? 1.75 : 2));
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!CINEMA.active) fitCamera();
  }

  window.addEventListener("resize", onResize);

  let lastFrame = performance.now();

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    updateCinemaCamera(now);
    controls.update();
    updateStickerGlow(dt);
    updateConfetti(dt);
    renderer.render(scene, camera);
  }

  /* ------------------------------------------------------------
     boot
     ------------------------------------------------------------ */

  setSpeed(state.step ? "step" : state.speed);
  updateSoundButton();
  updateStats();
  renderHistory();
  refreshStatus();
  setButtons();
  updatePauseButton();
  requestAnimationFrame(animate);

  window.addEventListener("beforeunload", () => {
    if (solverWorker) solverWorker.terminate();
  });

  setTimeout(() => {
    if (!state.started && !state.celebrating) {
      toast("Drag a sticker to turn a layer · drag empty space to orbit", 3800);
    }
  }, 1800);

  /* ------------------------------------------------------------
     debug API + optional self-test
     ------------------------------------------------------------ */

  const params = new URLSearchParams(window.location.search);
  if (params.has("noworker")) solverWorkerFailed = true;

  if (params.has("debug")) {
    window.__cubeLab = {
      state: () => ({
        cube: state.cube.asString(),
        visual: getVisualFacelets(),
        sync: checkSync(),
        solved: state.cube.isSolved(),
        moves: state.moveCount,
        mode: state.mode,
        history: state.history.map((entry) => entry.move),
        solution: state.solution,
        solver: { worker: Boolean(solverWorker), main: state.solverReady },
        assisted: state.assisted,
        started: state.started,
        paused: state.paused,
        step: state.step,
        stepWaiting: state.stepWaiting,
        timerMs: timerMs(),
        best: state.best,
        camera: {
          position: camera.position.toArray(),
          target: controls.target.toArray(),
        },
        cinematic: {
          active: CINEMA.active,
          cameraCancelled: CINEMA.cameraCancelled,
        },
      }),
      move: (move) =>
        performMove(move, {
          duration: 0,
          record: false,
          source: "debug",
          checkSolved: false,
        }),
      sequence: async (moves) => {
        for (const move of moves) {
          await performMove(move, {
            duration: 0,
            record: false,
            source: "debug",
            checkSolved: false,
          });
        }
        return checkSync();
      },
      reset: () => resetCube({ silent: true }),
      scramble,
      solve: solveCube,
      autoSolve,
      setSpeed,
      screenPoint: (face, row, col) => {
        const sticker = stickerMeshes.find((candidate) => {
          const current = stickerFacelet(candidate);
          return current.face === face && current.row === row && current.col === col;
        });
        if (!sticker) return null;
        const rect = canvas.getBoundingClientRect();
        const point = new THREE.Vector3();
        sticker.getWorldPosition(point);
        point.project(camera);
        return {
          x: rect.left + ((point.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - point.y) / 2) * rect.height,
        };
      },
    };
  }

  async function runSelfTest() {
    const output = document.createElement("pre");
    output.id = "selftest";
    output.textContent = "CubeLab self-test\n";
    document.body.appendChild(output);

    let pass = true;
    const log = (line) => {
      output.textContent += `${line}\n`;
    };

    const faceMoves = [];
    for (const face of ["U", "D", "L", "R", "F", "B"]) {
      for (const mod of ["", "'", "2"]) faceMoves.push(face + mod);
    }
    const sliceMoves = [];
    for (const face of ["M", "E", "S"]) {
      for (const mod of ["", "'", "2"]) sliceMoves.push(face + mod);
    }

    for (const move of faceMoves.concat(sliceMoves)) {
      resetCube({ silent: true });
      await performMove(move, {
        duration: 0,
        record: false,
        source: "test",
        checkSolved: false,
      });
      const sync = checkSync();
      log(`${move.padEnd(3)} ${sync ? "ok" : "SYNC FAIL"}`);
      if (!sync) {
        pass = false;
        log(`  visual  ${getVisualFacelets()}`);
        log(`  logical ${state.cube.asString()}`);
      }
    }

    resetCube({ silent: true });
    const sequence = [
      "R", "U", "R'", "U'", "F2", "L", "D'", "B", "R2", "U",
      "F'", "L2", "D", "B'", "U2", "R'", "F", "D2", "M", "E'", "S2",
    ];
    let sequenceOk = true;
    for (const move of sequence) {
      await performMove(move, {
        duration: 0,
        record: false,
        source: "test",
        checkSolved: false,
      });
      if (!checkSync()) {
        sequenceOk = false;
        pass = false;
        log(`sequence sync FAIL after ${move}`);
        log(`  visual  ${getVisualFacelets()}`);
        log(`  logical ${state.cube.asString()}`);
        break;
      }
    }
    log(`sequence  ${sequenceOk ? "ok" : "FAIL"}`);

    const dragCases = [
      ["y", 1, 1, "U'"],
      ["y", 1, -1, "U"],
      ["y", -1, 1, "D"],
      ["y", -1, -1, "D'"],
      ["x", 1, -1, "R"],
      ["x", 1, 1, "R'"],
      ["x", -1, 1, "L"],
      ["z", 1, -1, "F"],
      ["z", 1, 1, "F'"],
      ["z", -1, 1, "B"],
      ["y", 0, 1, "E"],
    ];
    let dragOk = true;
    for (const [axis, layer, sign, expected] of dragCases) {
      const actual = moveFromAxis(axis, layer, sign);
      if (actual !== expected) {
        dragOk = false;
        pass = false;
        log(`drag ${axis}${layer}/${sign}: expected ${expected}, got ${actual}`);
      }
    }
    log(`drag map  ${dragOk ? "ok" : "FAIL"}`);

    const cinemaUi = Boolean(
      document.getElementById("autoBtn") &&
        document.getElementById("cineExit") &&
        document.getElementById("cinePause")
    );
    log(`cinema ui ${cinemaUi ? "ok" : "FAIL"}`);
    if (!cinemaUi) pass = false;

    const stepUi = Boolean(
      document.querySelector('.speed-btn[data-speed="step"]')
    );
    log(`step ui ${stepUi ? "ok" : "FAIL"}`);
    if (!stepUi) pass = false;

    const previousSpeed = state.speed;
    const previousStep = state.step;
    setSpeed("step");
    const stepOn = state.step === true;
    const gate = waitForStep();
    const waiting = state.stepWaiting === true;
    advanceStep();
    await gate;
    const stepped = state.stepWaiting === false;
    setSpeed(previousStep ? "step" : previousSpeed);
    log(`step mode ${stepOn && waiting && stepped ? "ok" : "FAIL"}`);
    if (!stepOn || !waiting || !stepped) pass = false;

    let cinemaViewsOk = true;
    for (const face of FACE_KEYS) {
      const view = CINEMA_FACE_VIEW[face];
      const direction = directionFromSpherical(view.theta * DEG, view.phi * DEG);
      const dot = direction.dot(FACE_NORMALS[face]);
      if (dot < 0.4) {
        cinemaViewsOk = false;
        log(`cinema ${face}: dot ${dot.toFixed(2)}`);
      }
    }
    log(`cinema view ${cinemaViewsOk ? "ok" : "FAIL"}`);
    if (!cinemaViewsOk) pass = false;

    const glowLayer = cubelets.filter(
      (cubelet) => Math.round(cubelet.position.x) === 1
    );
    setLayerGlow(glowLayer, true);
    for (let i = 0; i < 24; i++) updateStickerGlow(1 / 60);
    const glowing = glowLayer.some((cubelet) =>
      cubelet.children.some(
        (child) =>
          child.userData && child.userData.baseColor && child.userData.glow > 0.5
      )
    );
    clearLayerGlow();
    for (let i = 0; i < 60; i++) updateStickerGlow(1 / 60);
    const glowCleared = glowStickers.size === 0;
    log(`layer glow ${glowing && glowCleared ? "ok" : "FAIL"}`);
    if (!glowing || !glowCleared) pass = false;

    try {
      if (typeof Cube.initSolver === "function") {
        Cube.initSolver();
        const solution = state.cube.solve();
        log(`solution  ${solution || "(already solved)"}`);
        for (const move of solution.split(" ").filter(Boolean)) {
          await performMove(move, {
            duration: 0,
            record: false,
            source: "test",
            checkSolved: false,
          });
        }
        const logicalSolved = state.cube.isSolved();
        const finalSync = checkSync();
        const visualSolved = isVisuallySolved();
        log(`logical   ${logicalSolved ? "solved" : "NOT SOLVED"}`);
        log(`visual    ${visualSolved ? "solved" : "NOT SOLVED"}`);
        log(`sync      ${finalSync ? "ok" : "FAIL"}`);
        if (!logicalSolved || !visualSolved || !finalSync) pass = false;
      } else {
        pass = false;
        log("solver    unavailable");
      }
    } catch (error) {
      pass = false;
      log(`solver    ERROR ${error.message}`);
    }

    log(`RESULT    ${pass ? "PASS" : "FAIL"}`);
    document.body.dataset.selftest = pass ? "pass" : "fail";
    document.title = `CubeLab self-test — ${pass ? "PASS" : "FAIL"}`;
  }

  if (params.has("selftest")) {
    runSelfTest().catch((error) => {
      console.error(error);
      document.body.dataset.selftest = "fail";
      const output = document.getElementById("selftest");
      if (output) output.textContent += `\nFATAL ${error.stack || error.message}\n`;
    });
  }
})();
