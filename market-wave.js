import * as THREE from './vendor/three.module.min.js';

// ============================================================================
// TAREN — Market Wave
// Original interactive isometric 3D pixel-mosaic market visualization
// Pure-function deterministic time evaluation for 1080p60 capture + live mode
// ============================================================================

const COLS = 64;
const ROWS = 38;
const TILE_COUNT = COLS * ROWS;
const PITCH = 1.0;
const TILE_SIZE = 0.87;
const MAX_PARTICLES = 900;

const PARAMS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMS.get('capture') === '1';
if (CAPTURE_MODE) document.body.classList.add('capture-mode');

// Deterministic hash helpers (pure functions, zero mutable global RNG state)
function hash1(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
function hash2(a, b) {
  let x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
function hash3(a, b, c) {
  let x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453123;
  return x - Math.floor(x);
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function smoothstep(e0, e1, x) {
  const u = clamp((x - e0) / (e1 - e0), 0, 1);
  return u * u * (3 - 2 * u);
}
function lerpColor3(out, a, b, t) {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}
function hexToRgb01(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function rgb01ToCss(c, alpha = 1) {
  const r = Math.round(clamp(c[0], 0, 1) * 255);
  const g = Math.round(clamp(c[1], 0, 1) * 255);
  const b = Math.round(clamp(c[2], 0, 1) * 255);
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

// ============================================================================
// FOUR ORIGINAL PRESETS (Keys 1-4)
// ============================================================================
const PRESETS = [
  {
    id: 0,
    key: '1',
    code: '01',
    name: 'OPEN LIFT',
    session: 'SESSION 01 · OPENING TAPE',
    bg: hexToRgb01('#05080d'),
    fog: hexToRgb01('#05080d'),
    baseDark: hexToRgb01('#0d1620'),
    baseMid: hexToRgb01('#162c3a'),
    wavePos: hexToRgb01('#219e9d'),
    wavePeak: hexToRgb01('#7cf0cf'),
    candleBull: hexToRgb01('#3ad6b4'),
    candleBear: hexToRgb01('#264c62'),
    wickCol: hexToRgb01('#54a3ab'),
    spikeCol: hexToRgb01('#b5fff0'),
    accent: hexToRgb01('#5ce6c6'),
    accentHex: '#5ce6c6',
    hudMuted: 'rgba(182, 214, 218, 0.56)',
    tapeSpeed: 2.25,
    trendSlope: 0.28,
    volAmp: 1.0,
    extrudeScale: 2.35,
    downExtrude: 0.0,
    rowShiftAmp: 1.35,
    flickerHz: 7.0,
    dispersionRate: 0.42,
    sparsity: 0.0,
    candleStrength: 1.0,
  },
  {
    id: 1,
    key: '2',
    code: '02',
    name: 'BID STORM',
    session: 'SESSION 02 · SURGE TAPE',
    bg: hexToRgb01('#050a07'),
    fog: hexToRgb01('#050a07'),
    baseDark: hexToRgb01('#0c1710'),
    baseMid: hexToRgb01('#163320'),
    wavePos: hexToRgb01('#38b54a'),
    wavePeak: hexToRgb01('#c8ff3d'),
    candleBull: hexToRgb01('#a6f428'),
    candleBear: hexToRgb01('#235c3d'),
    wickCol: hexToRgb01('#7ee85a'),
    spikeCol: hexToRgb01('#efff9e'),
    accent: hexToRgb01('#b9ff3b'),
    accentHex: '#b9ff3b',
    hudMuted: 'rgba(202, 232, 178, 0.58)',
    tapeSpeed: 3.45,
    trendSlope: 0.55,
    volAmp: 1.48,
    extrudeScale: 3.35,
    downExtrude: 0.0,
    rowShiftAmp: 2.75,
    flickerHz: 14.0,
    dispersionRate: 0.85,
    sparsity: 0.0,
    candleStrength: 1.3,
  },
  {
    id: 2,
    key: '3',
    code: '03',
    name: 'DRAWDOWN',
    session: 'SESSION 03 · LIQUIDATION TAPE',
    bg: hexToRgb01('#090608'),
    fog: hexToRgb01('#090608'),
    baseDark: hexToRgb01('#171419'),
    baseMid: hexToRgb01('#2e252c'),
    wavePos: hexToRgb01('#6b5a68'),
    wavePeak: hexToRgb01('#e85673'),
    candleBull: hexToRgb01('#697485'),
    candleBear: hexToRgb01('#c82848'),
    wickCol: hexToRgb01('#9c4458'),
    spikeCol: hexToRgb01('#ff8da3'),
    accent: hexToRgb01('#eb5b78'),
    accentHex: '#eb5b78',
    hudMuted: 'rgba(218, 184, 192, 0.54)',
    tapeSpeed: 2.65,
    trendSlope: -0.62,
    volAmp: 1.28,
    extrudeScale: 2.5,
    downExtrude: 1.0,
    rowShiftAmp: 2.15,
    flickerHz: 9.5,
    dispersionRate: 0.72,
    sparsity: 0.0,
    candleStrength: 1.22,
  },
  {
    id: 3,
    key: '4',
    code: '04',
    name: 'FLASH AFTER-HOURS',
    session: 'SESSION 04 · DARK BOOK',
    bg: hexToRgb01('#040408'),
    fog: hexToRgb01('#040408'),
    baseDark: hexToRgb01('#0a0c14'),
    baseMid: hexToRgb01('#151929'),
    wavePos: hexToRgb01('#23789c'),
    wavePeak: hexToRgb01('#3ce8ff'),
    candleBull: hexToRgb01('#2ee2ff'),
    candleBear: hexToRgb01('#9855f7'),
    wickCol: hexToRgb01('#7b6ef0'),
    spikeCol: hexToRgb01('#e4f9ff'),
    accent: hexToRgb01('#48e5ff'),
    accentHex: '#48e5ff',
    hudMuted: 'rgba(176, 194, 224, 0.54)',
    tapeSpeed: 1.8,
    trendSlope: 0.02,
    volAmp: 1.15,
    extrudeScale: 3.1,
    downExtrude: 0.15,
    rowShiftAmp: 1.85,
    flickerHz: 5.5,
    dispersionRate: 0.92,
    sparsity: 0.72,
    candleStrength: 0.95,
  },
];

function blendPresets(a, b, u) {
  const blend3 = (k) => [
    lerp(a[k][0], b[k][0], u),
    lerp(a[k][1], b[k][1], u),
    lerp(a[k][2], b[k][2], u),
  ];
  return {
    bg: blend3('bg'),
    fog: blend3('fog'),
    baseDark: blend3('baseDark'),
    baseMid: blend3('baseMid'),
    wavePos: blend3('wavePos'),
    wavePeak: blend3('wavePeak'),
    candleBull: blend3('candleBull'),
    candleBear: blend3('candleBear'),
    wickCol: blend3('wickCol'),
    spikeCol: blend3('spikeCol'),
    accent: blend3('accent'),
    tapeSpeed: lerp(a.tapeSpeed, b.tapeSpeed, u),
    trendSlope: lerp(a.trendSlope, b.trendSlope, u),
    volAmp: lerp(a.volAmp, b.volAmp, u),
    extrudeScale: lerp(a.extrudeScale, b.extrudeScale, u),
    downExtrude: lerp(a.downExtrude, b.downExtrude, u),
    rowShiftAmp: lerp(a.rowShiftAmp, b.rowShiftAmp, u),
    flickerHz: lerp(a.flickerHz, b.flickerHz, u),
    dispersionRate: lerp(a.dispersionRate, b.dispersionRate, u),
    sparsity: lerp(a.sparsity, b.sparsity, u),
    candleStrength: lerp(a.candleStrength, b.candleStrength, u),
    primary: u < 0.5 ? a : b,
  };
}

// ============================================================================
// SYNTHETIC MARKET DATA SERIES (pure deterministic functions of tape coordinate)
// ============================================================================
// Smooth 1D seeded value noise for synthetic random walk price components
function valueNoise1D(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash2(i, seed) * 2 - 1;
  const b = hash2(i + 1, seed) * 2 - 1;
  return lerp(a, b, u);
}

// Continuous synthetic price curve in normalized row-space [-1, +1]
function samplePriceCurve(tapeX, t, preset) {
  // Multi-scale oscillators + seeded random-walk harmonics
  const w1 = Math.sin(tapeX * 0.145 - t * 0.35) * 0.34;
  const w2 = Math.sin(tapeX * 0.31 + t * 0.52 + 1.2) * 0.19 * preset.volAmp;
  const w3 = Math.cos(tapeX * 0.63 - t * 0.9) * 0.09 * preset.volAmp;
  const rw =
    valueNoise1D(tapeX * 0.09, 17) * 0.36 +
    valueNoise1D(tapeX * 0.24, 53) * 0.18 +
    valueNoise1D(tapeX * 0.52, 91) * 0.08;
  // Gentle trend tilt across the visible tape window
  const slope = preset.trendSlope * 0.24;
  return clamp(w1 + w2 + w3 + rw + slope, -0.82, 0.82);
}

// Discrete synthetic OHLC candle at integer tape index k
function sampleCandle(candleIdx, t, preset) {
  const x0 = candleIdx * 2.0;
  const x1 = (candleIdx + 1) * 2.0;
  const p0 = samplePriceCurve(x0, t, preset);
  const p1 = samplePriceCurve(x1, t, preset);

  // Add stylized candle body punch & directional bias matching the preset
  const h1 = hash2(candleIdx, 101);
  const h2 = hash2(candleIdx, 203);
  const h3 = hash2(candleIdx, 307);
  const dirBias = preset.trendSlope * 0.16;
  const rawDelta = (p1 - p0) * 1.45 + (h1 - 0.5) * 0.22 * preset.volAmp + dirBias;
  const open = clamp(p0, -0.78, 0.78);
  const close = clamp(open + rawDelta, -0.82, 0.82);
  const bodyLo = Math.min(open, close);
  const bodyHi = Math.max(open, close);
  const wickUp = (0.06 + h2 * 0.22 * preset.volAmp) * (0.7 + 0.3 * Math.sin(t * 2.1 + candleIdx));
  const wickDn = (0.06 + h3 * 0.22 * preset.volAmp) * (0.7 + 0.3 * Math.cos(t * 1.9 - candleIdx));
  const high = clamp(bodyHi + wickUp, -0.88, 0.88);
  const low = clamp(bodyLo - wickDn, -0.88, 0.88);
  const bull = close >= open;
  const bodySize = Math.abs(close - open);
  const vol = clamp(0.18 + bodySize * 2.4 + h1 * 0.42 * preset.volAmp, 0.1, 1.35);

  return { open, close, bodyLo, bodyHi, high, low, bull, bodySize, vol };
}

// ============================================================================
// SCRIPTED CAPTURE CHOREOGRAPHY (15.0s = 900 frames @ 60fps)
// ============================================================================
// Timeline:
//   0.00 - 3.50s : Preset 0 (OPEN LIFT)      + gentle pointer sweep 0.9s..3.2s
//   3.50 - 7.00s : Preset 1 (BID STORM)      + pointer cross & click-shock at 4.95s + breakout 6.15s
//   7.00 - 11.00s: Preset 2 (DRAWDOWN)       + pointer drag wake 7.8s..10.5s + shock at 8.95s
//  11.00 - 15.00s: Preset 3 (FLASH AFTER-HRS)+ violent flash spike detonation at 11.85s + 12.15s + quiet heal
const CAPTURE_SHOCKS = [
  // Bid Storm click-shock (column & crest eruption)
  { id: 1, t0: 4.95, gx: 34.0, gz: 17.5, strength: 1.25, radius: 6.8, seed: 411, style: 'click' },
  // Bid Storm secondary breakout burst
  { id: 2, t0: 6.15, gx: 47.0, gz: 13.5, strength: 0.95, radius: 5.5, seed: 523, style: 'breakout' },
  // Drawdown heavy liquidation crack during pointer drag
  { id: 3, t0: 8.95, gx: 29.0, gz: 21.5, strength: 1.18, radius: 6.5, seed: 719, style: 'drawdown' },
  // Flash After-Hours main violent detonation
  { id: 4, t0: 11.85, gx: 33.5, gz: 18.0, strength: 1.85, radius: 10.2, seed: 911, style: 'flash' },
  // Flash After-Hours sympathetic secondary crack
  { id: 5, t0: 12.18, gx: 42.5, gz: 14.5, strength: 1.25, radius: 7.4, seed: 977, style: 'flash' },
];

function getScriptedPresetState(t) {
  const xfade = 0.34;
  if (t < 3.5 - xfade) return blendPresets(PRESETS[0], PRESETS[0], 0);
  if (t < 3.5 + xfade) return blendPresets(PRESETS[0], PRESETS[1], smoothstep(3.5 - xfade, 3.5 + xfade, t));
  if (t < 7.0 - xfade) return blendPresets(PRESETS[1], PRESETS[1], 0);
  if (t < 7.0 + xfade) return blendPresets(PRESETS[1], PRESETS[2], smoothstep(7.0 - xfade, 7.0 + xfade, t));
  if (t < 11.0 - xfade) return blendPresets(PRESETS[2], PRESETS[2], 0);
  if (t < 11.0 + xfade) return blendPresets(PRESETS[2], PRESETS[3], smoothstep(11.0 - xfade, 11.0 + xfade, t));
  return blendPresets(PRESETS[3], PRESETS[3], 0);
}

// Analytical scripted pointer in grid coordinates (gx in 0..COLS, gz in 0..ROWS) + active intensity
function getScriptedPointer(t) {
  // Segment 1: Open Lift glide (0.85s - 3.25s)
  if (t >= 0.75 && t <= 3.35) {
    const u = smoothstep(0.85, 3.25, t);
    const fade = smoothstep(0.75, 1.05, t) * (1 - smoothstep(3.05, 3.35, t));
    const gx = lerp(16, 48, u);
    const gz = 22.5 - Math.sin(u * Math.PI * 1.4) * 7.0 - u * 3.0;
    return { active: fade, gx, gz, vx: 13.0, vz: -3.0 };
  }
  // Segment 2: Bid Storm sweep across crest into click-shock at 4.95s (3.95s - 6.3s)
  if (t >= 3.85 && t <= 6.4) {
    const u = smoothstep(3.95, 6.25, t);
    const fade = smoothstep(3.85, 4.15, t) * (1 - smoothstep(6.05, 6.4, t));
    // Pause briefly near (34, 17.5) right at t=4.95s for click-shock
    const gx = lerp(18, 50, u) + Math.sin(u * Math.PI * 2) * 1.8;
    const gz = lerp(24.0, 12.5, u) + Math.cos(u * Math.PI * 2.2) * 2.5;
    return { active: fade, gx, gz, vx: 14.5, vz: -5.2 };
  }
  // Segment 3: Drawdown heavy diagonal drag wake (7.65s - 10.65s)
  if (t >= 7.55 && t <= 10.75) {
    const u = smoothstep(7.65, 10.6, t);
    const fade = smoothstep(7.55, 7.9, t) * (1 - smoothstep(10.35, 10.75, t));
    const gx = lerp(49, 15, u);
    const gz = lerp(12.5, 27.5, u) + Math.sin(u * Math.PI * 2.5) * 2.8;
    return { active: fade, gx, gz, vx: -12.0, vz: 5.5 };
  }
  // Segment 4: Flash After-Hours quiet probe before spike (11.15s - 12.45s)
  if (t >= 11.1 && t <= 12.6) {
    const u = smoothstep(11.15, 12.3, t);
    const fade = smoothstep(11.1, 11.35, t) * (1 - smoothstep(12.1, 12.6, t));
    const gx = lerp(26, 36, u);
    const gz = lerp(22, 17.2, u);
    return { active: fade, gx, gz, vx: 8.5, vz: -4.0 };
  }
  return { active: 0, gx: -100, gz: -100, vx: 0, vz: 0 };
}

// ============================================================================
// TWO-DIGIT GLYPH ATLAS (10x10 crisp tabular monospace digits "00".."99")
// ============================================================================
function createDigitAtlasTexture() {
  const size = 1024;
  const cells = 10;
  const cell = size / cells;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 50px "IBM Plex Mono", "Liberation Mono", ui-monospace, monospace';

  for (let i = 0; i < 100; i++) {
    const col = i % 10;
    const row = Math.floor(i / 10);
    const cx = col * cell + cell * 0.5;
    const cy = row * cell + cell * 0.53;
    const str = i < 10 ? `0${i}` : `${i}`;

    // Crisp pure white alpha-mask glyph (tinted in fragment shader)
    ctx.fillStyle = '#ffffff';
    ctx.fillText(str, cx, cy);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = true;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// ============================================================================
// THREE.JS SCENE SETUP
// ============================================================================
const glCanvas = document.getElementById('gl-canvas');
const hudCanvas = document.getElementById('hud-canvas');
const hudCtx = hudCanvas.getContext('2d');

const renderer = new THREE.WebGLRenderer({
  canvas: glCanvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setClearColor(0x040609, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

// Telephoto 3/4 isometric camera (25° FOV = crisp architectural isometric lines + luxury depth)
const camera = new THREE.PerspectiveCamera(25, 16 / 9, 5, 220);
const BASE_CAM_POS = new THREE.Vector3(-18.5, 31.5, 42.0);
const BASE_CAM_TARGET = new THREE.Vector3(0.5, 0.2, 0.5);
camera.position.copy(BASE_CAM_POS);
camera.lookAt(BASE_CAM_TARGET);

// ============================================================================
// SUBSTRATE BASE PLANE (subtle illuminated grid + unquantized price contour)
// Visible beneath shifted rows and spike-dissolved voids!
// ============================================================================
const substrateUniforms = {
  uTime: { value: 0 },
  uBgColor: { value: new THREE.Color('#05080d') },
  uAccent: { value: new THREE.Color('#5ce6c6') },
  uGridSize: { value: new THREE.Vector2(COLS, ROWS) },
  uWavePhase: { value: 0 },
  uTrend: { value: 0.25 },
  uVol: { value: 1.0 },
};

const substrateMat = new THREE.ShaderMaterial({
  uniforms: substrateUniforms,
  transparent: false,
  depthWrite: true,
  vertexShader: `
    varying vec3 vWorldPos;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uBgColor;
    uniform vec3 uAccent;
    uniform vec2 uGridSize;
    uniform float uWavePhase;
    uniform float uTrend;
    uniform float uVol;
    varying vec3 vWorldPos;
    varying vec2 vUv;

    void main() {
      vec2 gridCoord = vWorldPos.xz + uGridSize * 0.5;
      vec2 cellFrac = abs(fract(gridCoord) - 0.5);
      float line = 1.0 - smoothstep(0.46, 0.495, max(cellFrac.x, cellFrac.y));
      float minorGrid = (1.0 - line) * 0.16;

      // Major 8-tile measurement hairlines
      vec2 majorFrac = abs(fract(gridCoord / 8.0) - 0.5);
      float majorLine = smoothstep(0.488, 0.498, max(majorFrac.x, majorFrac.y)) * 0.24;

      // Subtle continuous unquantized wave trace underneath
      float tx = gridCoord.x * 0.5 + uWavePhase;
      float waveZ = 0.5 - 0.32 * (
        sin(tx * 0.145 - uTime * 0.35) * 0.55 +
        sin(tx * 0.31 + uTime * 0.52 + 1.2) * 0.28 * uVol +
        uTrend * 0.25
      );
      float normZ = gridCoord.y / uGridSize.y;
      float distWave = abs(normZ - waveZ);
      float trace = exp(-distWave * 28.0) * 0.26;
      float trace2 = exp(-abs(normZ - (waveZ + 0.12)) * 42.0) * 0.10;

      // Edge vignette fade into deep obsidian void (guarantees zero visible plane seam)
      float edgeMask = smoothstep(0.0, 0.24, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
      float distCenter = length(vWorldPos.xz / vec2(uGridSize.x * 0.56, uGridSize.y * 0.58));
      float fade = (1.0 - smoothstep(0.58, 1.12, distCenter)) * edgeMask;

      vec3 col = uBgColor + uAccent * (minorGrid * 0.35 + majorLine * 0.55 + trace + trace2) * fade;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});

const substrateGeo = new THREE.PlaneGeometry(COLS * 2.1, ROWS * 2.3);
substrateGeo.rotateX(-Math.PI / 2);
const substrateMesh = new THREE.Mesh(substrateGeo, substrateMat);
substrateMesh.position.set(0, -0.06, 0);
scene.add(substrateMesh);

// ============================================================================
// INSTANCED ISOMETRIC MOSAIC TILES (Custom ShaderMaterial)
// ============================================================================
const digitAtlas = createDigitAtlasTexture();
const tileGeo = new THREE.BoxGeometry(TILE_SIZE, 1.0, TILE_SIZE);
// Shift BoxGeometry so y spans [0, 1] — makes upward/downward extrusion super clean!
tileGeo.translate(0, 0.5, 0);

const tileColors = new Float32Array(TILE_COUNT * 3);
const tileDigits = new Float32Array(TILE_COUNT);
// aMeta: x = flash/glow, y = alpha/opacity, z = heightSign (-1 sunken, +1 raised), w = rimStrength
const tileMeta = new Float32Array(TILE_COUNT * 4);

tileGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(tileColors, 3));
tileGeo.setAttribute('aDigit', new THREE.InstancedBufferAttribute(tileDigits, 1));
tileGeo.setAttribute('aMeta', new THREE.InstancedBufferAttribute(tileMeta, 4));

const tileUniforms = {
  uAtlas: { value: digitAtlas },
  uBgColor: { value: new THREE.Color('#05080d') },
  uAccent: { value: new THREE.Color('#5ce6c6') },
  uFogStart: { value: 42.0 },
  uFogEnd: { value: 94.0 },
};

const tileMat = new THREE.ShaderMaterial({
  uniforms: tileUniforms,
  transparent: true,
  depthWrite: true,
  vertexShader: `
    attribute vec3 aColor;
    attribute float aDigit;
    attribute vec4 aMeta;

    varying vec3 vColor;
    varying float vDigit;
    varying vec4 vMeta;
    varying vec3 vNormalLocal;
    varying vec2 vUv;
    varying float vLocalY;
    varying float vCamDist;

    void main() {
      vColor = aColor;
      vDigit = aDigit;
      vMeta = aMeta;
      vNormalLocal = normal;
      vUv = uv;
      vLocalY = position.y; // 0 at base, 1 at top

      vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vec4 mvPos = viewMatrix * worldPos;
      vCamDist = -mvPos.z;
      gl_Position = projectionMatrix * mvPos;
    }
  `,
  fragmentShader: `
    uniform sampler2D uAtlas;
    uniform vec3 uBgColor;
    uniform vec3 uAccent;
    uniform float uFogStart;
    uniform float uFogEnd;

    varying vec3 vColor;
    varying float vDigit;
    varying vec4 vMeta;
    varying vec3 vNormalLocal;
    varying vec2 vUv;
    varying float vLocalY;
    varying float vCamDist;

    void main() {
      float alpha = vMeta.y;
      if (alpha < 0.02) discard;

      float flash = vMeta.x;
      float rimStrength = vMeta.w;
      vec3 baseCol = vColor;

      // Determine face orientation in local box space
      bool isTop = vNormalLocal.y > 0.5;
      bool isBottom = vNormalLocal.y < -0.5;

      vec3 col;
      if (isTop) {
        // Precision mosaic tile face with crisp hairline bevel
        vec2 edge = min(vUv, 1.0 - vUv);
        float borderDist = min(edge.x, edge.y);
        float outerFrame = smoothstep(0.0, 0.055, borderDist);
        float innerRim = (1.0 - smoothstep(0.045, 0.11, borderDist)) * (0.20 + rimStrength * 0.35);

        col = baseCol * (0.86 + 0.14 * outerFrame);
        col += (baseCol * 0.45 + uAccent * 0.25) * innerRim;
        col += vec3(0.85, 0.96, 1.0) * flash * 0.55;

        // Sample crisp two-digit number from 10x10 atlas
        float dIdx = floor(vDigit + 0.5);
        float colIdx = mod(dIdx, 10.0);
        float rowIdx = floor(dIdx / 10.0);

        // Fit glyph cleanly inside tile padding
        vec2 padUv = (vUv - 0.10) / 0.80;
        if (padUv.x > 0.0 && padUv.x < 1.0 && padUv.y > 0.0 && padUv.y < 1.0) {
          // Canvas row 0 is at top -> flipY=true maps row 0 to v = [0.9, 1.0]
          vec2 atlasUv = vec2(
            (colIdx + padUv.x) * 0.1,
            1.0 - (rowIdx + (1.0 - padUv.y)) * 0.1
          );
          float glyph = texture2D(uAtlas, atlasUv).a;

          // Automatic high-legibility ink polarity (dark ink on bright tiles, crisp light ink on dark tiles)
          float luma = dot(col, vec3(0.299, 0.587, 0.114));
          vec3 lightInk = mix(vec3(0.86, 0.94, 0.96), vec3(1.0), clamp(rimStrength + flash, 0.0, 1.0));
          vec3 darkInk = vec3(0.03, 0.05, 0.06);
          vec3 inkCol = luma > 0.48 ? darkInk : lightInk;
          float digitVis = smoothstep(0.04, 0.18, luma + rimStrength * 0.3 + 0.14);
          col = mix(col, inkCol, glyph * (0.58 + 0.36 * digitVis));
        }
      } else if (isBottom) {
        col = baseCol * 0.18;
      } else {
        // Vertical 3D isometric side walls — directional shading for crisp architectural volume
        float sideShade = 0.48;
        if (vNormalLocal.x < -0.5) sideShade = 0.34;      // left-facing wall (shadow side)
        else if (vNormalLocal.z > 0.5) sideShade = 0.62;  // front-facing wall (key-lit side)
        else if (vNormalLocal.x > 0.5) sideShade = 0.52;
        else sideShade = 0.28;

        // Vertical height gradient: darker toward floor, glowing precision lip near top edge
        float grad = mix(0.28, 1.0, pow(clamp(vLocalY, 0.0, 1.0), 0.72));
        float topLip = smoothstep(0.88, 1.0, vLocalY) * (0.28 + rimStrength * 0.42);
        col = baseCol * sideShade * grad + (baseCol * 0.55 + uAccent * 0.35) * topLip;
        col += vec3(0.8, 0.95, 1.0) * flash * 0.42 * vLocalY;
      }

      // Smooth luxury depth fog into near-black background
      float fogFactor = smoothstep(uFogStart, uFogEnd, vCamDist);
      col = mix(col, uBgColor, fogFactor * 0.92);

      gl_FragColor = vec4(col, alpha * (1.0 - fogFactor * 0.35));
    }
  `,
});

const tileMesh = new THREE.InstancedMesh(tileGeo, tileMat, TILE_COUNT);
tileMesh.frustumCulled = false;
scene.add(tileMesh);

// ============================================================================
// INSTANCED QUANTIZED PARTICLES (Edge Dispersion + Volatility Spike Dissolve)
// Sharp square data shards that lift, tumble, shrink, and fade
// ============================================================================
const particleGeo = new THREE.BoxGeometry(0.76, 0.16, 0.76);
const pColors = new Float32Array(MAX_PARTICLES * 3);
const pAlpha = new Float32Array(MAX_PARTICLES);
particleGeo.setAttribute('aPColor', new THREE.InstancedBufferAttribute(pColors, 3));
particleGeo.setAttribute('aPAlpha', new THREE.InstancedBufferAttribute(pAlpha, 1));

const particleUniforms = {
  uBgColor: { value: new THREE.Color('#05080d') },
  uFogStart: { value: 42.0 },
  uFogEnd: { value: 94.0 },
};

const particleMat = new THREE.ShaderMaterial({
  uniforms: particleUniforms,
  transparent: true,
  depthWrite: false,
  vertexShader: `
    attribute vec3 aPColor;
    attribute float aPAlpha;
    varying vec3 vCol;
    varying float vAlpha;
    varying vec3 vN;
    varying float vCamDist;

    void main() {
      vCol = aPColor;
      vAlpha = aPAlpha;
      vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
      vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vec4 mv = viewMatrix * wp;
      vCamDist = -mv.z;
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform vec3 uBgColor;
    uniform float uFogStart;
    uniform float uFogEnd;
    varying vec3 vCol;
    varying float vAlpha;
    varying vec3 vN;
    varying float vCamDist;

    void main() {
      if (vAlpha < 0.015) discard;
      float light = 0.62 + 0.38 * max(0.0, dot(vN, normalize(vec3(0.3, 0.9, 0.4))));
      vec3 col = vCol * light * 1.18;
      float fogF = smoothstep(uFogStart, uFogEnd, vCamDist);
      col = mix(col, uBgColor, fogF * 0.85);
      gl_FragColor = vec4(col, vAlpha * (1.0 - fogF * 0.5));
    }
  `,
});

const particleMesh = new THREE.InstancedMesh(particleGeo, particleMat, MAX_PARTICLES);
particleMesh.frustumCulled = false;
scene.add(particleMesh);

// ============================================================================
// INTERACTIVE STATE (for live mode; bypassed in deterministic capture mode)
// ============================================================================
const liveState = {
  t: 0,
  paused: false,
  presetFrom: 0,
  presetTo: 0,
  presetSwitchTime: -10,
  pointerActive: false,
  pointerGx: -100,
  pointerGz: -100,
  pointerTrail: [], // { t, gx, gz }
  shocks: [],       // { id, t0, gx, gz, strength, radius, seed, style }
  nextShockId: 100,
};

const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();

function screenToGrid(clientX, clientY) {
  const rect = glCanvas.getBoundingClientRect();
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
  if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
    return {
      gx: hitPoint.x + COLS * 0.5 - 0.5,
      gz: hitPoint.z + ROWS * 0.5 - 0.5,
    };
  }
  return null;
}

function gridToScreen(gx, wy, gz, width, height) {
  const v = new THREE.Vector3(gx - COLS * 0.5 + 0.5, wy, gz - ROWS * 0.5 + 0.5);
  v.project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * width,
    y: (-v.y * 0.5 + 0.5) * height,
  };
}

function triggerLiveShock(gx, gz, strength = 1.35) {
  const style = liveState.presetTo === 3 ? 'flash' : liveState.presetTo === 2 ? 'drawdown' : 'click';
  liveState.shocks.push({
    id: liveState.nextShockId++,
    t0: liveState.t,
    gx: clamp(gx, 4, COLS - 5),
    gz: clamp(gz, 4, ROWS - 5),
    strength,
    radius: liveState.presetTo === 3 ? 9.2 : 6.8,
    seed: (liveState.nextShockId * 137) % 997,
    style,
  });
  if (liveState.shocks.length > 8) liveState.shocks.shift();
}

function switchPreset(idx) {
  if (idx < 0 || idx > 3 || idx === liveState.presetTo) return;
  liveState.presetFrom = liveState.presetTo;
  liveState.presetTo = idx;
  liveState.presetSwitchTime = liveState.t;
}

// ============================================================================
// CORE DETERMINISTIC FRAME EVALUATOR (pure function of time t + inputs)
// ============================================================================
const dummy = new THREE.Object3D();
const tmpCol = [0, 0, 0];
const rowShifts = new Float32Array(ROWS);
const colPrices = new Float32Array(COLS);
const colCandles = new Array(COLS);

// Telemetry returned to HUD renderer each frame
const frameTelemetry = {
  t: 0,
  presetIdx: 0,
  presetName: 'OPEN LIFT',
  sessionLabel: 'SESSION 01 · OPENING TAPE',
  accentHex: '#5ce6c6',
  accentRgb: [0.36, 0.9, 0.78],
  vxmDelta: '+1.42%',
  klrVal: '412.8',
  qdtVal: '0.64',
  dispersionPct: 14,
  maxRowShift: 1.2,
  activeParticles: 0,
  pointerScreen: null,
  pointerStrength: 0,
  activeShockRings: [],
};

function evaluateFrame(t, modeCapture) {
  // 1. Resolve active blended preset
  let preset;
  let activePresetIdx;
  if (modeCapture) {
    preset = getScriptedPresetState(t);
    activePresetIdx = preset.primary.id;
  } else {
    const u = smoothstep(liveState.presetSwitchTime, liveState.presetSwitchTime + 0.35, t);
    preset = blendPresets(PRESETS[liveState.presetFrom], PRESETS[liveState.presetTo], u);
    activePresetIdx = liveState.presetTo;
  }

  // 2. Subtle breathing isometric camera dolly (stable, refined, architectural)
  const breath = Math.sin(t * 0.42) * 0.75;
  const driftX = Math.sin(t * 0.27) * 1.1;
  camera.position.set(
    BASE_CAM_POS.x + driftX,
    BASE_CAM_POS.y + breath * 0.55,
    BASE_CAM_POS.z + breath * 0.95
  );
  camera.lookAt(BASE_CAM_TARGET.x + driftX * 0.25, BASE_CAM_TARGET.y, BASE_CAM_TARGET.z);
  camera.updateMatrixWorld();

  // 3. Background & shader uniforms
  const bgColor = new THREE.Color(preset.bg[0], preset.bg[1], preset.bg[2]);
  const accentColor = new THREE.Color(preset.accent[0], preset.accent[1], preset.accent[2]);
  renderer.setClearColor(bgColor, 1);
  tileUniforms.uBgColor.value.copy(bgColor);
  tileUniforms.uAccent.value.copy(accentColor);
  particleUniforms.uBgColor.value.copy(bgColor);
  substrateUniforms.uTime.value = t;
  substrateUniforms.uBgColor.value.copy(bgColor);
  substrateUniforms.uAccent.value.copy(accentColor);
  substrateUniforms.uTrend.value = preset.trendSlope;
  substrateUniforms.uVol.value = preset.volAmp;

  // Tape scroll phase (monotonic continuous flow)
  const tapeScroll = t * 2.55;
  substrateUniforms.uWavePhase.value = tapeScroll * 0.5;

  // 4. Resolve pointer + wake samples + shock events
  const pointer = modeCapture
    ? getScriptedPointer(t)
    : {
        active: liveState.pointerActive ? 1.0 : 0.0,
        gx: liveState.pointerGx,
        gz: liveState.pointerGz,
        vx: 0,
        vz: 0,
      };

  // Build recent pointer wake samples (pure analytical in capture, ring buffer in live)
  const wakeSamples = [];
  if (modeCapture) {
    for (let k = 0; k < 10; k++) {
      const wt = t - k * 0.085;
      if (wt < 0) continue;
      const wp = getScriptedPointer(wt);
      if (wp.active > 0.02) {
        wakeSamples.push({
          gx: wp.gx,
          gz: wp.gz,
          w: wp.active * Math.exp(-k * 0.28),
        });
      }
    }
  } else {
    for (let i = liveState.pointerTrail.length - 1; i >= 0; i--) {
      const s = liveState.pointerTrail[i];
      const age = t - s.t;
      if (age > 1.1) continue;
      wakeSamples.push({
        gx: s.gx,
        gz: s.gz,
        w: Math.exp(-age * 2.6),
      });
    }
  }

  // Active shock events (capture uses fixed timeline; live uses interactive + occasional ambient flash spikes in preset 3)
  let shocks;
  if (modeCapture) {
    shocks = CAPTURE_SHOCKS;
  } else {
    shocks = liveState.shocks;
  }

  // 5. Precompute synthetic price curve & candlesticks across all COLS
  let sumPrice = 0;
  let lastCandle = null;
  for (let c = 0; c < COLS; c++) {
    const tapeX = c + tapeScroll;
    colPrices[c] = samplePriceCurve(tapeX, t, preset);
    sumPrice += colPrices[c];
    const candleIdx = Math.floor(tapeX / 2.0);
    colCandles[c] = sampleCandle(candleIdx, t, preset);
    if (c === COLS - 4) lastCandle = colCandles[c];
  }

  // 6. Compute ROW DISPLACEMENT (whole rows sliding horizontally following moving wave crests & shocks)
  let maxAbsShift = 0;
  for (let r = 0; r < ROWS; r++) {
    const rowNorm = 1.0 - (r / (ROWS - 1)) * 2.0; // +1 at top (-Z, high price), -1 at bottom (+Z, low price)
    // Measure how much the wave crest occupies this price rank
    let crestSignal = 0;
    for (let s = 0; s < 8; s++) {
      const sampleCol = Math.floor((s + 0.5) * (COLS / 8));
      const p = colPrices[sampleCol];
      const prox = Math.exp(-Math.pow((rowNorm - p) * 3.0, 2));
      crestSignal += prox * Math.sin(t * 2.15 + sampleCol * 0.17 + r * 0.24);
    }
    // Quantized strip-coherence: subtle stepped terrace bands so horizontal row shear reads crisply
    const bandIdx = Math.floor(r / 2);
    const bandStep = Math.sin(bandIdx * 1.15 - t * 2.05) * 0.44;
    const baseShear =
      Math.sin(r * 0.42 - t * 2.4) * 0.38 +
      bandStep +
      Math.cos(r * 0.85 + t * 1.55) * 0.22 +
      crestSignal * 0.42;
    let shift = baseShear * preset.rowShiftAmp;

    // Pointer directly pushes & shears nearby rows horizontally!
    if (pointer.active > 0.01) {
      const dz = r - pointer.gz;
      const rowInf = Math.exp(-(dz * dz) / 14.0) * pointer.active;
      const dir = pointer.vx >= 0 ? 1 : -1;
      shift += rowInf * (2.6 * dir + Math.sin(dz * 0.9 + t * 6.0) * 1.15);
    }

    // Wake trail gentle lingering shear
    for (let w = 0; w < wakeSamples.length; w++) {
      const ws = wakeSamples[w];
      const dz = r - ws.gz;
      if (Math.abs(dz) < 6) {
        shift += Math.exp(-(dz * dz) / 9.0) * ws.w * 0.55 * (dz >= 0 ? 1 : -1);
      }
    }

    // Shock events violently shear rows outward from the epicenter!
    for (let s = 0; s < shocks.length; s++) {
      const sk = shocks[s];
      const age = t - sk.t0;
      if (age >= 0 && age < 2.2) {
        const dz = r - sk.gz;
        if (Math.abs(dz) < sk.radius * 1.4) {
          const env = Math.sin(clamp(age / 0.22, 0, 1) * Math.PI * 0.5) * Math.exp(-age * 1.95);
          const band = Math.exp(-(dz * dz) / (sk.radius * 2.2));
          const sign = (r % 2 === 0 ? 1 : -1) * (dz >= 0 ? 1 : -1);
          shift += sign * band * env * sk.strength * 3.1;
        }
      }
    }

    rowShifts[r] = shift;
    if (Math.abs(shift) > maxAbsShift) maxAbsShift = Math.abs(shift);
  }

  // 7. Update all TILE_COUNT instanced tiles & collect deterministic particles
  let pCount = 0;
  let dissolvedTiles = 0;
  const shockRings = [];
  for (let s = 0; s < shocks.length; s++) {
    const sk = shocks[s];
    const age = t - sk.t0;
    if (age >= 0 && age < 1.35) {
      shockRings.push({ sk, age });
    }
  }

  const tileColorAttr = tileGeo.getAttribute('aColor');
  const tileDigitAttr = tileGeo.getAttribute('aDigit');
  const tileMetaAttr = tileGeo.getAttribute('aMeta');

  let idx = 0;
  for (let r = 0; r < ROWS; r++) {
    const rowNorm = 1.0 - (r / (ROWS - 1)) * 2.0; // +1 high price (-Z), -1 low price (+Z)
    const rShift = rowShifts[r];
    const isVolumeBand = r >= ROWS - 6;

    for (let c = 0; c < COLS; c++) {
      const pVal = colPrices[c];
      const candle = colCandles[c];
      const tapeX = c + tapeScroll;
      const inCandleCol = ((Math.floor(tapeX) % 2) + 2) % 2 === 0;

      // Distance from continuous price wave
      const dWave = rowNorm - pVal;
      const absDWave = Math.abs(dWave);
      const waveRibbon = Math.exp(-(absDWave * absDWave) * 10.5);
      const underWave = smoothstep(0.18, -0.55, dWave);

      // Candlestick classification
      const inBody =
        inCandleCol &&
        !isVolumeBand &&
        rowNorm >= candle.bodyLo - 0.045 &&
        rowNorm <= candle.bodyHi + 0.045;
      const inWick =
        inCandleCol &&
        !isVolumeBand &&
        !inBody &&
        rowNorm >= candle.low &&
        rowNorm <= candle.high;

      // Foreground volume histogram bars
      const volRank = (ROWS - 1 - r) / 5.5; // 0 at very front edge, 1 at top of volume band
      const inVolBar = isVolumeBand && volRank < candle.vol * 0.78;

      // Base color & height sampled from the continuous synthetic market field
      let h = 0.14 + underWave * 0.22 + waveRibbon * 0.85;
      let rim = waveRibbon * 0.65;
      let flash = 0.0;
      let alpha = 1.0;

      // Color blend from underlying field
      lerpColor3(tmpCol, preset.baseDark, preset.baseMid, clamp(underWave * 0.85 + 0.12, 0, 1));
      if (waveRibbon > 0.08) {
        lerpColor3(tmpCol, tmpCol, preset.wavePos, clamp(waveRibbon * 0.9, 0, 1));
        if (waveRibbon > 0.58) {
          lerpColor3(tmpCol, tmpCol, preset.wavePeak, (waveRibbon - 0.58) / 0.42 * 0.75);
        }
      }

      // Apply candlestick bodies & wicks
      if (inBody) {
        const cCol = candle.bull ? preset.candleBull : preset.candleBear;
        lerpColor3(tmpCol, tmpCol, cCol, 0.88);
        const bodyBoost = (0.85 + candle.bodySize * 2.8) * preset.candleStrength;
        h += bodyBoost;
        rim = Math.max(rim, 0.9);
      } else if (inWick) {
        lerpColor3(tmpCol, tmpCol, preset.wickCol, 0.62);
        h += 0.42 * preset.candleStrength;
        rim = Math.max(rim, 0.5);
      } else if (inVolBar) {
        const vCol = candle.bull ? preset.wavePos : preset.candleBear;
        lerpColor3(tmpCol, tmpCol, vCol, 0.72);
        h = 0.35 + (1.0 - volRank) * candle.vol * 1.15;
        rim = Math.max(rim, 0.55);
      }

      // Drawdown downward extrusion: bearish bodies & negative wave troughs sink into dark carved trenches!
      let yBase = 0.0;
      let extrudeHeight = h * preset.extrudeScale * 0.42;
      if (preset.downExtrude > 0.05) {
        const sinkSignal =
          (inBody && !candle.bull ? 1.0 : 0.0) * 0.95 +
          smoothstep(0.10, -0.45, dWave) * 0.65;
        if (sinkSignal > 0.22) {
          const sinkDepth = sinkSignal * preset.downExtrude * 2.65;
          yBase = -sinkDepth;
          extrudeHeight = Math.max(0.24, sinkDepth * 0.72 + 0.22);
          // Deepen crimson/rose accent inside trenches so recessed terraces read clearly in 3D
          lerpColor3(tmpCol, tmpCol, preset.candleBear, sinkSignal * preset.downExtrude * 0.55);
        } else if (waveRibbon > 0.48) {
          // Stressed upper rims stay extruded in rose/iron contrast
          extrudeHeight *= 1.18;
        }
      }

      // Flash After-Hours sparsity: dark quiet void except active wave ticks, candles, and shock zones
      if (preset.sparsity > 0.05) {
        const cellRand = hash2(c * 1.31, r * 2.17);
        const keep =
          inBody ||
          inWick ||
          waveRibbon > 0.46 ||
          inVolBar ||
          cellRand > preset.sparsity;
        if (!keep) {
          alpha = lerp(1.0, 0.16, preset.sparsity);
          extrudeHeight = lerp(extrudeHeight, 0.08, preset.sparsity);
          lerpColor3(tmpCol, tmpCol, preset.baseDark, preset.sparsity * 0.85);
        } else if (cellRand > 0.92 && waveRibbon > 0.15) {
          // Sparse sharp cyan/violet ticks in the dark book
          lerpColor3(tmpCol, tmpCol, cellRand > 0.96 ? preset.candleBull : preset.candleBear, 0.75);
          extrudeHeight += 0.55;
          rim = 0.95;
        }
      }

      // Local tile coordinate in grid space (including row shift!)
      const gxShifted = c + rShift;
      let scaleXZ = 1.0;
      let liftY = 0.0;
      let tiltX = 0.0;
      let tiltZ = 0.0;

      // Pointer & Wake local disturbance (lifts/depresses tiles + edge scatter)
      let wakeEnergy = 0.0;
      if (pointer.active > 0.01) {
        const dx = gxShifted - pointer.gx;
        const dz = r - pointer.gz;
        const d2 = dx * dx + dz * dz;
        if (d2 < 44.0) {
          const d = Math.sqrt(d2);
          const ring = Math.exp(-Math.pow((d - 2.2) * 0.65, 2));
          const core = Math.exp(-d2 / 8.5);
          const pInf = pointer.active;
          extrudeHeight += (ring * 1.55 - core * 0.45) * pInf;
          liftY += ring * 0.42 * pInf;
          flash = Math.max(flash, ring * 0.55 * pInf);
          rim = Math.max(rim, ring * 0.9 * pInf);
          lerpColor3(tmpCol, tmpCol, preset.spikeCol, ring * 0.45 * pInf);
          wakeEnergy = Math.max(wakeEnergy, (ring + core * 0.6) * pInf);
        }
      }
      for (let w = 0; w < wakeSamples.length; w++) {
        const ws = wakeSamples[w];
        const dx = gxShifted - ws.gx;
        const dz = r - ws.gz;
        const d2 = dx * dx + dz * dz;
        if (d2 < 20.0) {
          const inf = Math.exp(-d2 / 6.5) * ws.w;
          extrudeHeight += inf * 0.65;
          wakeEnergy = Math.max(wakeEnergy, inf * 0.85);
          lerpColor3(tmpCol, tmpCol, preset.accent, inf * 0.35);
        }
      }

      // VOLATILITY SPIKE & CLICK-SHOCK DISSOLVE + HEAL
      let tileDissolved = false;
      for (let s = 0; s < shocks.length; s++) {
        const sk = shocks[s];
        const age = t - sk.t0;
        if (age < 0 || age > 2.8) continue;

        const dx = c - sk.gx;
        const dz = r - sk.gz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        // Jagged quantized cluster boundary (feels like digital order-book cells fracturing, not a smooth circle)
        const jitter = (hash3(c, r, sk.seed) - 0.5) * 3.1;
        const effR = sk.radius + jitter;
        if (dist > effR * 1.35) continue;

        const normD = dist / Math.max(1.0, effR);
        // Shockwave outward front
        const front = Math.exp(-Math.pow((dist - age * 14.0) * 0.55, 2)) * Math.exp(-age * 1.6);
        extrudeHeight += front * sk.strength * 2.4;
        flash = Math.max(flash, front * 0.85);
        lerpColor3(tmpCol, tmpCol, preset.spikeCol, clamp(front * 0.72, 0, 1));

        // Inside the detonation cluster: Punch UP -> Dissolve into particles -> Heal & snap back!
        if (dist < effR) {
          const delay = normD * 0.16;
          const localAge = age - delay;
          if (localAge >= 0) {
            if (localAge < 0.16) {
              // Phase 1: violent upward extrusion punch right before detonation
              const u = localAge / 0.16;
              extrudeHeight += u * sk.strength * 3.8 * (1.0 - normD * 0.45);
              flash = Math.max(flash, u * 0.95);
              lerpColor3(tmpCol, tmpCol, preset.spikeCol, u * 0.85);
            } else if (localAge < 1.35) {
              // Phase 2: tile vacates the grid (dissolved into particles!)
              tileDissolved = true;
              dissolvedTiles++;
              scaleXZ = 0.001;
              alpha = 0.0;

              // Emit deterministic 3D tumbling quantized shard(s) for this dissolved tile!
              if (pCount < MAX_PARTICLES) {
                const pAge = localAge - 0.16;
                const pLife = 0.85 + hash3(c, r, sk.seed + 19) * 0.55;
                if (pAge < pLife) {
                  const pu = pAge / pLife;
                  const hA = hash3(c, r, sk.seed + 3);
                  const hB = hash3(c, r, sk.seed + 7);
                  const hC = hash3(c, r, sk.seed + 11);
                  const angle = Math.atan2(dz, dx) + (hA - 0.5) * 1.1;
                  const speed = (2.8 + hB * 5.6) * sk.strength * (0.45 + 0.55 * normD);
                  const vUp = (6.2 + hC * 8.2) * sk.strength * (1.0 - normD * 0.3);
                  const px = (gxShifted - COLS * 0.5 + 0.5) + Math.cos(angle) * speed * pAge + rShift * 0.15 * pAge;
                  const pz = (r - ROWS * 0.5 + 0.5) + Math.sin(angle) * speed * pAge;
                  const py = Math.max(0.15, 1.4 + vUp * pAge - 4.4 * pAge * pAge);

                  const pScale = (1.0 - pu * 0.72) * (0.65 + hA * 0.45);
                  dummy.position.set(px, py, pz);
                  dummy.rotation.set(
                    pAge * (2.5 + hA * 5.0) * (hB > 0.5 ? 1 : -1),
                    pAge * (1.8 + hC * 4.5),
                    pAge * (2.2 + hB * 4.8) * (hA > 0.5 ? -1 : 1)
                  );
                  dummy.scale.set(pScale, pScale * (0.9 + hC * 1.1), pScale);
                  dummy.updateMatrix();
                  particleMesh.setMatrixAt(pCount, dummy.matrix);

                  // Color shard brightly with preset spike/accent hue
                  const pColBase = sk.style === 'flash'
                    ? (hA > 0.48 ? preset.candleBull : preset.candleBear)
                    : sk.style === 'drawdown'
                    ? preset.wavePeak
                    : preset.spikeCol;
                  const glowBoost = 1.0 - pu * 0.45;
                  pColors[pCount * 3] = lerp(pColBase[0], 1.0, (1 - pu) * 0.45) * glowBoost;
                  pColors[pCount * 3 + 1] = lerp(pColBase[1], 1.0, (1 - pu) * 0.45) * glowBoost;
                  pColors[pCount * 3 + 2] = lerp(pColBase[2], 1.0, (1 - pu) * 0.45) * glowBoost;
                  pAlpha[pCount] = (1.0 - smoothstep(0.45, 1.0, pu)) * 0.96;
                  pCount++;

                  // For large flash spikes, emit a second finer quantized data-speck per tile!
                  if (sk.strength > 1.4 && hC > 0.35 && pCount < MAX_PARTICLES) {
                    const pScale2 = pScale * 0.48;
                    dummy.position.set(
                      px + (hB - 0.5) * 1.4 * pAge,
                      py + 0.9 + hA * 2.2 * pAge,
                      pz + (hC - 0.5) * 1.4 * pAge
                    );
                    dummy.rotation.set(pAge * 6.5, pAge * 4.1, -pAge * 5.2);
                    dummy.scale.set(pScale2, pScale2, pScale2);
                    dummy.updateMatrix();
                    particleMesh.setMatrixAt(pCount, dummy.matrix);
                    pColors[pCount * 3] = preset.spikeCol[0];
                    pColors[pCount * 3 + 1] = preset.spikeCol[1];
                    pColors[pCount * 3 + 2] = preset.spikeCol[2];
                    pAlpha[pCount] = (1.0 - smoothstep(0.3, 1.0, pu)) * 0.88;
                    pCount++;
                  }
                }
              }
            } else if (localAge < 2.25) {
              // Phase 3: Grid Heal — new tile rises and snaps cleanly back into place!
              const hu = smoothstep(1.35, 2.05, localAge);
              const snapOvershoot = Math.sin(hu * Math.PI) * 0.28;
              scaleXZ = 0.25 + 0.75 * hu;
              yBase -= (1.0 - hu) * 1.4;
              extrudeHeight = extrudeHeight * hu + snapOvershoot * 0.9;
              alpha *= hu;
              flash = Math.max(flash, (1.0 - hu) * 0.55);
            }
          }
        }
      }

      // EDGE DISPERSION: tiles at trailing wave edge, candle breakout rims, or pointer wake
      // break off, shrink, lift slightly, and shed crisp micro-particles
      const edgeBand =
        (absDWave > 0.22 && absDWave < 0.44) ||
        (c < 7 || c > COLS - 8) ||
        wakeEnergy > 0.35;
      if (!tileDissolved && edgeBand) {
        const edgeHash = hash2(c * 3.17, r * 5.23);
        const dispChance =
          (wakeEnergy > 0.35 ? 0.58 : 0.0) +
          (absDWave > 0.22 && absDWave < 0.44 ? 0.24 * preset.dispersionRate : 0.0) +
          (c < 6 || c > COLS - 7 ? 0.42 : 0.0);

        if (edgeHash < dispChance) {
          // Subtle shrink/detach pulse on the edge tile itself
          const cycle = (t * (0.75 + edgeHash * 0.9) + edgeHash * 17.0) % 1.0;
          const edgeDetach = smoothstep(0.15, 0.85, cycle);
          if (c < 5 || c > COLS - 6) {
            // Outer mosaic edges break apart & shrink gently into the void
            const edgeFactor = c < 5 ? (5 - c) / 5 : (c - (COLS - 6)) / 5;
            scaleXZ *= 1.0 - edgeFactor * (0.35 + 0.35 * edgeDetach);
            alpha *= 1.0 - edgeFactor * 0.52;
            liftY += edgeFactor * edgeDetach * 0.65;
            tiltZ = edgeFactor * 0.22 * (edgeHash - 0.5);
          }

          // Spawn deterministic drifting edge-dispersion micro-tile
          if (pCount < MAX_PARTICLES && (wakeEnergy > 0.38 || edgeHash < 0.14 * preset.dispersionRate)) {
            const pu = cycle;
            const driftX = (c > COLS * 0.5 ? 1 : -1) * (0.6 + edgeHash * 2.2) * pu + rShift * 0.25 * pu;
            const driftZ = (dWave >= 0 ? -1 : 1) * (0.5 + edgeHash * 1.8) * pu;
            const py = extrudeHeight + 0.35 + pu * (1.8 + wakeEnergy * 2.4) - pu * pu * 0.6;
            const pScale = (0.58 - pu * 0.46) * (0.75 + 0.5 * wakeEnergy);

            dummy.position.set(
              gxShifted - COLS * 0.5 + 0.5 + driftX,
              py,
              r - ROWS * 0.5 + 0.5 + driftZ
            );
            dummy.rotation.set(pu * 2.4, pu * 3.1 + edgeHash * 6.0, pu * 1.9);
            dummy.scale.set(pScale, pScale * 0.75, pScale);
            dummy.updateMatrix();
            particleMesh.setMatrixAt(pCount, dummy.matrix);

            pColors[pCount * 3] = lerp(tmpCol[0], preset.accent[0], 0.45);
            pColors[pCount * 3 + 1] = lerp(tmpCol[1], preset.accent[1], 0.45);
            pColors[pCount * 3 + 2] = lerp(tmpCol[2], preset.accent[2], 0.45);
            pAlpha[pCount] = Math.sin(pu * Math.PI) * (0.55 + 0.35 * wakeEnergy);
            pCount++;
          }
        }
      }

      // Two-digit flickering synthetic quote (ticks crisply at readable quantized cadence!)
      const tileRate = preset.flickerHz * (0.62 + 0.76 * hash2(c, r + 41));
      const tickStep = Math.floor(t * tileRate + hash2(c + 13, r + 7) * 29.0);
      // Tie digit base to underlying price/candle residual + crisp tick step
      const fieldDigit = Math.floor(Math.abs(pVal * 49.0 + candle.vol * 27.0)) % 100;
      const tickDelta = Math.floor(hash3(c, r, tickStep) * 19.0);
      const digit = (fieldDigit + tickDelta) % 100;

      // Write transform matrix for tile
      const wx = gxShifted - COLS * 0.5 + 0.5;
      const wz = r - ROWS * 0.5 + 0.5;
      const clampedH = Math.max(0.06, extrudeHeight);

      dummy.position.set(wx, yBase + liftY, wz);
      dummy.rotation.set(tiltX, 0, tiltZ);
      dummy.scale.set(scaleXZ, clampedH, scaleXZ);
      dummy.updateMatrix();
      tileMesh.setMatrixAt(idx, dummy.matrix);

      tileColors[idx * 3] = tmpCol[0];
      tileColors[idx * 3 + 1] = tmpCol[1];
      tileColors[idx * 3 + 2] = tmpCol[2];
      tileDigits[idx] = digit;
      tileMeta[idx * 4] = flash;
      tileMeta[idx * 4 + 1] = alpha;
      tileMeta[idx * 4 + 2] = yBase < -0.1 ? -1.0 : 1.0;
      tileMeta[idx * 4 + 3] = rim;
      idx++;
    }
  }

  // Zero out unused particle instances cleanly
  for (let i = pCount; i < MAX_PARTICLES; i++) {
    pAlpha[i] = 0.0;
    dummy.position.set(0, -100, 0);
    dummy.scale.set(0.001, 0.001, 0.001);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    particleMesh.setMatrixAt(i, dummy.matrix);
  }

  tileMesh.instanceMatrix.needsUpdate = true;
  tileColorAttr.needsUpdate = true;
  tileDigitAttr.needsUpdate = true;
  tileMetaAttr.needsUpdate = true;

  particleMesh.instanceMatrix.needsUpdate = true;
  particleGeo.getAttribute('aPColor').needsUpdate = true;
  particleGeo.getAttribute('aPAlpha').needsUpdate = true;

  // Render WebGL scene
  renderer.render(scene, camera);

  // Update HUD telemetry from real synthetic field state
  const avgP = sumPrice / COLS;
  const vxmNum = avgP * 4.2 + preset.trendSlope * 1.85 + Math.sin(t * 1.7) * 0.14;
  const klrNum = 412.0 + avgP * 38.0 + (lastCandle ? lastCandle.close * 14.0 : 0);
  const qdtNum = clamp(0.42 + (lastCandle ? lastCandle.vol * 0.35 : 0.2) + dissolvedTiles * 0.004, 0.08, 0.99);

  frameTelemetry.t = t;
  frameTelemetry.presetIdx = activePresetIdx;
  frameTelemetry.presetName = PRESETS[activePresetIdx].name;
  frameTelemetry.sessionLabel = PRESETS[activePresetIdx].session;
  frameTelemetry.accentHex = PRESETS[activePresetIdx].accentHex;
  frameTelemetry.accentRgb = preset.accent;
  frameTelemetry.vxmDelta = `${vxmNum >= 0 ? '+' : ''}${vxmNum.toFixed(2)}%`;
  frameTelemetry.klrVal = klrNum.toFixed(1);
  frameTelemetry.qdtVal = qdtNum.toFixed(2);
  frameTelemetry.dispersionPct = Math.min(99, Math.round((pCount / 260) * 100));
  frameTelemetry.maxRowShift = maxAbsShift;
  frameTelemetry.activeParticles = pCount;
  frameTelemetry.pointerStrength = pointer.active;
  frameTelemetry.pointerScreen =
    pointer.active > 0.02
      ? gridToScreen(pointer.gx, 0.5, pointer.gz, hudCanvas.width, hudCanvas.height)
      : null;
  frameTelemetry.activeShockRings = shockRings.map(({ sk, age }) => ({
    pt: gridToScreen(sk.gx, 0.6, sk.gz, hudCanvas.width, hudCanvas.height),
    age,
    strength: sk.strength,
  }));

  renderHud();
}

// ============================================================================
// REFINED EDITORIAL TYPOGRAPHY & MINIMAL HUD (rendered on 2D canvas overlay)
// ============================================================================
function renderHud() {
  const W = hudCanvas.width;
  const H = hudCanvas.height;
  const scale = W / 1920;
  const ctx = hudCtx;
  ctx.clearRect(0, 0, W, H);

  const mX = Math.round(56 * scale);
  const mY = Math.round(48 * scale);
  const acc = frameTelemetry.accentRgb;
  const accCss = rgb01ToCss(acc, 1.0);
  const accSoft = rgb01ToCss(acc, 0.42);

  // Subtle corner vignette + top/bottom dark editorial scrims so typography is always razor-legible
  const vig = ctx.createRadialGradient(W * 0.52, H * 0.52, W * 0.28, W * 0.5, H * 0.5, W * 0.74);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(3,5,8,0.48)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  const topScrim = ctx.createLinearGradient(0, 0, 0, Math.round(135 * scale));
  topScrim.addColorStop(0, 'rgba(4, 6, 10, 0.86)');
  topScrim.addColorStop(0.58, 'rgba(4, 6, 10, 0.42)');
  topScrim.addColorStop(1, 'rgba(4, 6, 10, 0.0)');
  ctx.fillStyle = topScrim;
  ctx.fillRect(0, 0, W, Math.round(135 * scale));

  const botScrim = ctx.createLinearGradient(0, H - Math.round(145 * scale), 0, H);
  botScrim.addColorStop(0, 'rgba(4, 6, 10, 0.0)');
  botScrim.addColorStop(0.42, 'rgba(4, 6, 10, 0.52)');
  botScrim.addColorStop(1, 'rgba(4, 6, 10, 0.92)');
  ctx.fillStyle = botScrim;
  ctx.fillRect(0, H - Math.round(145 * scale), W, Math.round(145 * scale));

  // Subtle pointer wake reticle (clean precision Swiss crosshair, no cheesy sci-fi HUD)
  if (frameTelemetry.pointerScreen && frameTelemetry.pointerStrength > 0.04) {
    const p = frameTelemetry.pointerScreen;
    const a = frameTelemetry.pointerStrength * 0.72;
    const r = 18 * scale;
    ctx.save();
    ctx.strokeStyle = rgb01ToCss(acc, a);
    ctx.lineWidth = Math.max(1, 1.25 * scale);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();

    const tick = 6 * scale;
    ctx.beginPath();
    ctx.moveTo(p.x - r - tick, p.y);
    ctx.lineTo(p.x - r + 2 * scale, p.y);
    ctx.moveTo(p.x + r - 2 * scale, p.y);
    ctx.lineTo(p.x + r + tick, p.y);
    ctx.moveTo(p.x, p.y - r - tick);
    ctx.lineTo(p.x, p.y - r + 2 * scale);
    ctx.moveTo(p.x, p.y + r - 2 * scale);
    ctx.lineTo(p.x, p.y + r + tick);
    ctx.stroke();

    ctx.fillStyle = rgb01ToCss(acc, a);
    ctx.fillRect(p.x - 1.5 * scale, p.y - 1.5 * scale, 3 * scale, 3 * scale);
    ctx.restore();
  }

  // Subtle expanding square pulse on active click/spike shocks
  for (const sr of frameTelemetry.activeShockRings) {
    const u = sr.age / 1.35;
    const a = (1.0 - u) * (1.0 - u) * 0.55;
    const sz = (18 + u * 125 * sr.strength) * scale;
    ctx.save();
    ctx.translate(sr.pt.x, sr.pt.y);
    ctx.scale(1.0, 0.58); // isometric foreshortening
    ctx.rotate(Math.PI * 0.25);
    ctx.strokeStyle = rgb01ToCss(acc, a);
    ctx.lineWidth = Math.max(1, 1.5 * scale);
    ctx.strokeRect(-sz * 0.5, -sz * 0.5, sz, sz);
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // TOP-LEFT: Original Wordmark (TAREN) + 2x2 Quantized Emblem + Piece Title
  // --------------------------------------------------------------------------
  ctx.save();
  // Tiny geometric 2x2 tile emblem
  const sq = Math.round(6.5 * scale);
  const gap = Math.round(2.5 * scale);
  const ex = mX;
  const ey = mY + Math.round(3 * scale);
  ctx.fillStyle = 'rgba(240, 246, 250, 0.94)';
  ctx.fillRect(ex, ey, sq, sq);
  ctx.fillRect(ex + sq + gap, ey + sq + gap, sq, sq);
  ctx.fillStyle = accCss;
  ctx.fillRect(ex + sq + gap, ey, sq, sq);
  ctx.strokeStyle = 'rgba(240, 246, 250, 0.42)';
  ctx.lineWidth = Math.max(1, scale);
  ctx.strokeRect(ex + 0.5, ey + sq + gap + 0.5, sq - 1, sq - 1);

  // Wordmark: TAREN
  const wmX = ex + (sq * 2 + gap) + Math.round(14 * scale);
  ctx.font = `600 ${Math.round(18 * scale)}px "Plus Jakarta Sans", "Liberation Sans", sans-serif`;
  ctx.fillStyle = 'rgba(244, 248, 252, 0.96)';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  drawTrackedText(ctx, 'TAREN', wmX, mY + Math.round(1 * scale), 3.6 * scale);

  // Subtle vertical hairline divider + piece title
  const divX = wmX + Math.round(92 * scale);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(divX, mY + Math.round(3 * scale), Math.max(1, scale), Math.round(16 * scale));

  ctx.font = `500 ${Math.round(15 * scale)}px "Plus Jakarta Sans", "Liberation Sans", sans-serif`;
  ctx.fillStyle = 'rgba(226, 236, 244, 0.86)';
  drawTrackedText(ctx, 'MARKET WAVE', divX + Math.round(18 * scale), mY + Math.round(2.5 * scale), 2.4 * scale);

  // Quiet secondary edition caption directly underneath
  ctx.font = `400 ${Math.round(11 * scale)}px "IBM Plex Mono", "Liberation Mono", monospace`;
  ctx.fillStyle = 'rgba(186, 204, 218, 0.50)';
  drawTrackedText(
    ctx,
    'QUANTIZED ORDER-FLOW MOSAIC  ·  ISOMETRIC 04',
    ex,
    mY + Math.round(31 * scale),
    1.1 * scale
  );
  ctx.restore();

  // --------------------------------------------------------------------------
  // TOP-RIGHT: Synthetic Session Label, Timestamp & Invented Series Codes
  // --------------------------------------------------------------------------
  ctx.save();
  const rx = W - mX;
  const baseSec = 9 * 3600 + 42 * 60 + 14 + frameTelemetry.t;
  const hh = String(Math.floor(baseSec / 3600) % 24).padStart(2, '0');
  const mm = String(Math.floor((baseSec % 3600) / 60)).padStart(2, '0');
  const ss = String(Math.floor(baseSec % 60)).padStart(2, '0');
  const cs = String(Math.floor((baseSec - Math.floor(baseSec)) * 100)).padStart(2, '0');
  const ts = `${hh}:${mm}:${ss}.${cs} UTC`;

  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.font = `500 ${Math.round(12 * scale)}px "IBM Plex Mono", "Liberation Mono", monospace`;
  ctx.fillStyle = 'rgba(232, 240, 246, 0.84)';
  ctx.fillText(`${frameTelemetry.sessionLabel}   /   ${ts}`, rx, mY + Math.round(3 * scale));

  // Synthetic invented series codes (VXM, KLR, QDT — not real tickers)
  ctx.font = `400 ${Math.round(11.5 * scale)}px "IBM Plex Mono", "Liberation Mono", monospace`;
  const seriesLine = `VXM ${frameTelemetry.vxmDelta}    ·    KLR ${frameTelemetry.klrVal}    ·    QDT ${frameTelemetry.qdtVal}`;
  ctx.fillStyle = 'rgba(196, 214, 224, 0.56)';
  ctx.fillText(seriesLine, rx, mY + Math.round(28 * scale));

  // Small live accent pip next to session label
  const pipX = rx - ctx.measureText(`${frameTelemetry.sessionLabel}   /   ${ts}`).width - 14 * scale;
  ctx.fillStyle = accCss;
  ctx.fillRect(pipX, mY + Math.round(6.5 * scale), 5 * scale, 5 * scale);
  ctx.restore();

  // --------------------------------------------------------------------------
  // BOTTOM-LEFT: Discreet Preset Selector Strip (Active Preset Clearly Marked)
  // --------------------------------------------------------------------------
  ctx.save();
  const by = H - mY - Math.round(26 * scale);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let curX = mX;

  for (let i = 0; i < PRESETS.length; i++) {
    const p = PRESETS[i];
    const active = i === frameTelemetry.presetIdx;
    const itemW = Math.round(154 * scale);

    // Top micro hairline bar
    ctx.fillStyle = active ? accCss : 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(curX, by, itemW - Math.round(14 * scale), active ? Math.max(1.5, 2 * scale) : Math.max(1, scale));

    ctx.font = `${active ? 600 : 400} ${Math.round(11.5 * scale)}px "IBM Plex Mono", "Liberation Mono", monospace`;
    ctx.fillStyle = active ? 'rgba(246, 250, 252, 0.95)' : 'rgba(182, 198, 210, 0.42)';
    ctx.fillText(`${p.code}  ${p.name}`, curX, by + Math.round(9 * scale));
    curX += itemW;
  }
  ctx.restore();

  // --------------------------------------------------------------------------
  // BOTTOM-RIGHT: Quiet Quantized Telemetry (Row Shift, Dispersion, Rate)
  // --------------------------------------------------------------------------
  ctx.save();
  const ry = H - mY - Math.round(17 * scale);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.font = `400 ${Math.round(11 * scale)}px "IBM Plex Mono", "Liberation Mono", monospace`;
  ctx.fillStyle = 'rgba(186, 204, 218, 0.48)';
  const shiftStr = `+${frameTelemetry.maxRowShift.toFixed(1)} PX-R`;
  const dispStr = `DISP ${String(frameTelemetry.dispersionPct).padStart(2, '0')}%`;
  const hint = CAPTURE_MODE ? '60.0 HZ  ·  SYNTHETIC' : 'CLICK SHOCK  ·  SPACE PULSE  ·  1–4 PRESETS';
  ctx.fillText(`SHIFT ${shiftStr}    ·    ${dispStr}    ·    ${hint}`, W - mX, ry);

  // Subtle accent micro rule above bottom-right telemetry
  ctx.fillStyle = accSoft;
  ctx.fillRect(W - mX - Math.round(48 * scale), ry - Math.round(9 * scale), Math.round(48 * scale), Math.max(1, scale));
  ctx.restore();
}

function drawTrackedText(ctx, text, x, y, tracking) {
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
}

// ============================================================================
// RESIZE HANDLING
// ============================================================================
function resize(width, height, dpr = 1) {
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  hudCanvas.width = Math.round(width * dpr);
  hudCanvas.height = Math.round(height * dpr);
}

function resizeToWindow() {
  if (CAPTURE_MODE) {
    resize(1920, 1080, 1);
  } else {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    resize(window.innerWidth, window.innerHeight, dpr);
  }
}

window.addEventListener('resize', resizeToWindow);
resizeToWindow();

// ============================================================================
// LIVE INTERACTIVITY (Pointer wake, Click/Space Shock, Keys 1-4, P, R)
// ============================================================================
if (!CAPTURE_MODE) {
  const onPointerMove = (e) => {
    const pt = screenToGrid(e.clientX, e.clientY);
    if (!pt) return;
    liveState.pointerActive = true;
    liveState.pointerGx = pt.gx;
    liveState.pointerGz = pt.gz;
    liveState.pointerTrail.push({ t: liveState.t, gx: pt.gx, gz: pt.gz });
    if (liveState.pointerTrail.length > 28) liveState.pointerTrail.shift();
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerleave', () => {
    liveState.pointerActive = false;
  });
  window.addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('#preset-hits')) return;
    const pt = screenToGrid(e.clientX, e.clientY);
    if (pt) {
      liveState.pointerActive = true;
      liveState.pointerGx = pt.gx;
      liveState.pointerGz = pt.gz;
      triggerLiveShock(pt.gx, pt.gz, liveState.presetTo === 3 ? 1.75 : 1.32);
    }
  });

  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchPreset(Number(btn.dataset.preset));
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === '1') switchPreset(0);
    else if (e.key === '2') switchPreset(1);
    else if (e.key === '3') switchPreset(2);
    else if (e.key === '4') switchPreset(3);
    else if (e.code === 'Space') {
      e.preventDefault();
      const gx = liveState.pointerActive ? liveState.pointerGx : COLS * 0.52;
      const gz = liveState.pointerActive ? liveState.pointerGz : ROWS * 0.48;
      triggerLiveShock(gx, gz, liveState.presetTo === 3 ? 1.85 : 1.35);
    } else if (e.key === 'p' || e.key === 'P') {
      liveState.paused = !liveState.paused;
    } else if (e.key === 'r' || e.key === 'R') {
      liveState.t = 0;
      liveState.shocks = [];
      liveState.pointerTrail = [];
      liveState.presetFrom = 0;
      liveState.presetTo = 0;
      liveState.presetSwitchTime = -10;
    }
  });

  let lastTs = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - lastTs) / 1000);
    lastTs = now;
    if (!liveState.paused) {
      liveState.t += dt;
    }
    evaluateFrame(liveState.t, false);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ============================================================================
// DETERMINISTIC CAPTURE HOOK (pure function of frameIndex @ 60fps)
// ============================================================================
const compositeCanvas = document.createElement('canvas');
compositeCanvas.width = 1920;
compositeCanvas.height = 1080;
const compositeCtx = compositeCanvas.getContext('2d');

window.__marketWave = {
  renderFrame(frameIndex) {
    const t = frameIndex / 60;
    evaluateFrame(t, true);
  },
  grabPngDataUrl(frameIndex) {
    const t = frameIndex / 60;
    evaluateFrame(t, true);
    compositeCtx.drawImage(glCanvas, 0, 0, 1920, 1080);
    compositeCtx.drawImage(hudCanvas, 0, 0, 1920, 1080);
    return compositeCanvas.toDataURL('image/png');
  },
  setPreset(idx) {
    switchPreset(idx);
  },
  getInfo() {
    return {
      cols: COLS,
      rows: ROWS,
      tiles: TILE_COUNT,
      maxParticles: MAX_PARTICLES,
      renderer: renderer.getContext().getParameter(renderer.getContext().RENDERER),
      size: [glCanvas.width, glCanvas.height],
      telemetry: { ...frameTelemetry },
    };
  },
};

// If capture mode, render frame 0 immediately so initial state is crisp
if (CAPTURE_MODE) {
  evaluateFrame(0, true);
}
