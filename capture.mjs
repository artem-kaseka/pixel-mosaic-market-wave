#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = __dirname;
const VERTICAL = process.argv.includes('--vertical');
const WIDTH = VERTICAL ? 1080 : 1920;
const HEIGHT = VERTICAL ? 1920 : 1080;
const FPS = 60;
const TOTAL_FRAMES = 900; // 15.00 seconds
const DURATION = TOTAL_FRAMES / FPS;

const CHROME_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error('Could not find Chrome/Chromium binary');
}

function startStaticServer(rootDir) {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = (req.url || '/').split('?')[0];
      const rel = cleanUrl === '/' ? 'index.html' : cleanUrl.replace(/^\/+/, '');
      const fullPath = path.resolve(rootDir, rel);
      if (!fullPath.startsWith(rootDir) || !fs.existsSync(fullPath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(fullPath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(fullPath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method && this.listeners.has(msg.method)) {
        for (const fn of this.listeners.get(msg.method)) fn(msg.params);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function launchBrowser() {
  const chromeBin = findChrome();
  const port = 9300 + Math.floor(Math.random() * 800);
  const profileDir = path.join(PROJECT_DIR, `.tmp_chrome_profile_${process.pid}`);
  fs.mkdirSync(profileDir, { recursive: true });

  const proc = spawn(
    chromeBin,
    [
      '--headless=new',
      `--user-data-dir=${profileDir}`,
      `--remote-debugging-port=${port}`,
      '--remote-allow-origins=*',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--ignore-gpu-blocklist',
      '--no-first-run',
      '--no-default-browser-check',
      `--window-size=${WIDTH},${HEIGHT}`,
      '--hide-scrollbars',
      '--mute-audio',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let stderrBuf = '';
  proc.stderr.on('data', (c) => {
    stderrBuf += c.toString();
  });

  let targetWs = null;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) {
          targetWs = page.webSocketDebuggerUrl;
          break;
        }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }

  if (!targetWs) {
    proc.kill('SIGKILL');
    fs.rmSync(profileDir, { recursive: true, force: true });
    throw new Error('Failed to connect to headless Chrome CDP:\n' + stderrBuf.slice(-1200));
  }

  const cdp = new CDPClient(targetWs);
  await cdp.connect();
  return { proc, cdp, profileDir };
}

// ============================================================================
// Subtle Original Synthesized Market-Data Ambience (48 kHz 16-bit Stereo WAV)
// Low obsidian data hum, precision soft quote ticks, muted spike accents
// ============================================================================
function synthesizeMarketAudioWav(outPath, durationSec) {
  const sr = 48000;
  const numSamples = Math.round(sr * durationSec);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  let seed = 48271931;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const smoothstep = (e0, e1, x) => {
    const u = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return u * u * (3 - 2 * u);
  };

  let lpL = 0, lpR = 0;

  // Base continuous hum + filtered air floor synced to 4 presets
  for (let i = 0; i < numSamples; i++) {
    const t = i / sr;
    const masterEnv = smoothstep(0, 0.35, t) * (1 - smoothstep(durationSec - 0.55, durationSec, t));

    const w0 = 1 - smoothstep(3.2, 3.8, t);
    const w1 = smoothstep(3.2, 3.8, t) * (1 - smoothstep(6.7, 7.3, t));
    const w2 = smoothstep(6.7, 7.3, t) * (1 - smoothstep(10.7, 11.3, t));
    const w3 = smoothstep(10.7, 11.3, t);

    // Subtle deep harmonic bed (clean Swiss-minimalist sub-hum)
    const f0 = 65.41 * w0 + 73.42 * w1 + 55.0 * w2 + 49.0 * w3; // C2 -> D2 -> A1 -> G1
    const sub = Math.sin(2 * Math.PI * f0 * t) * 0.055 + Math.sin(2 * Math.PI * f0 * 2.0 * t) * 0.018;
    const fifth = Math.sin(2 * Math.PI * (f0 * 3.0) * t + Math.sin(t * 0.8) * 0.3) * (0.014 * w0 + 0.018 * w1 + 0.012 * w2 + 0.008 * w3);

    // Ultra-soft filtered noise bed
    const nL = rand() * 2 - 1;
    const nR = rand() * 2 - 1;
    const cut = 0.016 * w0 + 0.032 * w1 + 0.020 * w2 + 0.011 * w3;
    lpL += cut * (nL - lpL);
    lpR += cut * (nR - lpR);
    const airAmp = 0.026 * w0 + 0.042 * w1 + 0.034 * w2 + 0.018 * w3;

    left[i] = (sub + fifth * 0.92 + lpL * airAmp) * masterEnv;
    right[i] = (sub + fifth * 1.08 + lpR * airAmp) * masterEnv;
  }

  // Precision soft mechanical quote ticks (cadence adapts to preset energy)
  let tt = 0.15;
  while (tt < durationSec - 0.35) {
    const step = tt < 3.5 ? 0.14 : tt < 7.0 ? 0.075 : tt < 11.0 ? 0.115 : 0.22;
    const startIdx = Math.floor(tt * sr);
    const len = Math.min(numSamples - startIdx, Math.floor(0.018 * sr));
    const freq = tt < 3.5 ? 1650 : tt < 7.0 ? 2250 : tt < 11.0 ? 1180 : 2800;
    const f = freq * (0.85 + rand() * 0.35);
    const pan = (rand() - 0.5) * 1.1;
    const gL = Math.cos(((pan + 1) * Math.PI) / 4);
    const gR = Math.sin(((pan + 1) * Math.PI) / 4);
    const amp = (tt >= 11.0 && tt < 11.8 ? 0.008 : 0.016) * (0.6 + rand() * 0.6);

    for (let k = 0; k < len; k++) {
      const dt = k / sr;
      const env = Math.exp(-dt * 260);
      const val = Math.sin(2 * Math.PI * f * dt) * env * amp;
      left[startIdx + k] += val * gL;
      right[startIdx + k] += val * gR;
    }
    tt += step * (0.65 + rand() * 0.7);
  }

  // Muted spike accents synced directly to CAPTURE_SHOCKS
  const accents = [
    { t: 4.95, f: 392.0, sub: 82.4, amp: 0.11, dec: 0.65, pan: 0.15, scatter: 12 }, // Bid Storm click-shock
    { t: 6.15, f: 523.25, sub: 98.0, amp: 0.07, dec: 0.45, pan: 0.38, scatter: 8 }, // Breakout
    { t: 8.95, f: 220.0, sub: 61.7, amp: 0.10, dec: 0.78, pan: -0.22, scatter: 10 }, // Drawdown crack
    { t: 11.85, f: 659.25, sub: 55.0, amp: 0.16, dec: 1.15, pan: 0.10, scatter: 28 }, // Flash spike detonation
    { t: 12.18, f: 783.99, sub: 65.4, amp: 0.09, dec: 0.85, pan: 0.32, scatter: 16 }, // Aftershock
  ];

  for (const ac of accents) {
    const s0 = Math.floor(ac.t * sr);
    const len = Math.min(numSamples - s0, Math.floor(ac.dec * 2.5 * sr));
    const gL = Math.cos(((ac.pan + 1) * Math.PI) / 4);
    const gR = Math.sin(((ac.pan + 1) * Math.PI) / 4);
    for (let k = 0; k < len; k++) {
      const dt = k / sr;
      const atk = Math.min(1, dt / 0.008);
      const envSub = atk * Math.exp(-dt / (ac.dec * 0.45));
      const envHi = atk * Math.exp(-dt / (ac.dec * 0.28));
      const sVal =
        Math.sin(2 * Math.PI * (ac.sub * (1.0 - dt * 0.15)) * dt) * envSub * ac.amp * 0.85 +
        Math.sin(2 * Math.PI * ac.f * dt) * envHi * ac.amp * 0.32;
      left[s0 + k] += sVal * gL;
      right[s0 + k] += sVal * gR;
    }

    // Subtle crystalline particle-dissolve scatter ticks after detonation
    for (let g = 0; g < ac.scatter; g++) {
      const gt = ac.t + 0.06 + rand() * ac.dec * 0.95;
      const gs0 = Math.floor(gt * sr);
      const glen = Math.min(numSamples - gs0, Math.floor(0.032 * sr));
      const gf = 1400 + rand() * 2600;
      const gpan = (rand() - 0.5) * 1.4;
      const ggL = Math.cos(((gpan + 1) * Math.PI) / 4);
      const ggR = Math.sin(((gpan + 1) * Math.PI) / 4);
      const gamp = ac.amp * 0.14 * (1 - g / (ac.scatter + 2));
      for (let k = 0; k < glen; k++) {
        const dt = k / sr;
        const val = Math.sin(2 * Math.PI * gf * dt) * Math.exp(-dt * 150) * gamp;
        left[gs0 + k] += val * ggL;
        right[gs0 + k] += val * ggR;
      }
    }
  }

  // Write 16-bit PCM Stereo WAV
  const dataBytes = numSamples * 4;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);

  let off = 44;
  for (let i = 0; i < numSamples; i++) {
    const vL = Math.max(-0.92, Math.min(0.92, left[i]));
    const vR = Math.max(-0.92, Math.min(0.92, right[i]));
    buf.writeInt16LE(Math.round(vL * 32767), off);
    buf.writeInt16LE(Math.round(vR * 32767), off + 2);
    off += 4;
  }
  fs.writeFileSync(outPath, buf);
}

async function evalJs(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.exceptionDetails) {
    throw new Error('Page JS error: ' + JSON.stringify(res.exceptionDetails));
  }
  return res.result?.value;
}

async function grabFramePng(cdp, frameIndex) {
  const dataUrl = await evalJs(cdp, `window.__marketWave.grabPngDataUrl(${frameIndex})`);
  const comma = dataUrl.indexOf(',');
  return Buffer.from(dataUrl.slice(comma + 1), 'base64');
}

async function main() {
  const args = process.argv.slice(2);
  const previewOnly = args.includes('--preview-stills');
  const crfArg = args.find((a) => a.startsWith('--crf='));
  const crf = crfArg ? crfArg.split('=')[1] : '21';

  const { server, port } = await startStaticServer(PROJECT_DIR);
  const { proc: chromeProc, cdp, profileDir } = await launchBrowser();

  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
    });

    cdp.on('Runtime.consoleAPICalled', (ev) => {
      if (ev.type === 'error' || ev.type === 'warning') {
        console.error('[Browser]', ev.type, ev.args.map((a) => a.value || a.description).join(' '));
      }
    });

    const loadDone = new Promise((resolve) => cdp.on('Page.loadEventFired', resolve));
    const query = VERTICAL ? '?capture=1&vertical=1' : '?capture=1';
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html${query}` });
    await loadDone;
    await evalJs(cdp, 'document.fonts ? document.fonts.ready : Promise.resolve()');
    await new Promise((r) => setTimeout(r, 250));

    // Check WebGL engine, render speed, and strict bit-for-bit determinism
    const check = await evalJs(
      cdp,
      `(() => {
        const t0 = performance.now();
        for (let i = 0; i < 30; i++) window.__marketWave.renderFrame(i);
        const dt30 = performance.now() - t0;
        const a = window.__marketWave.grabPngDataUrl(120);
        window.__marketWave.renderFrame(420);
        const b = window.__marketWave.grabPngDataUrl(120);
        return {
          info: window.__marketWave.getInfo(),
          msPerFrame: +(dt30 / 30).toFixed(2),
          deterministic: a === b,
          samplePngBytes: a.length,
        };
      })()`
    );
    console.log('Engine check:', JSON.stringify(check));
    if (!check.deterministic) {
      throw new Error('Determinism check failed: identical frame index produced different PNG!');
    }

    if (previewOnly) {
      const stillsDir = VERTICAL ? path.join(PROJECT_DIR, 'stills', 'vertical') : path.join(PROJECT_DIR, 'stills');
      fs.mkdirSync(stillsDir, { recursive: true });
      const previewFrames = [
        { f: 90, name: '01_open_lift_1.5s.png' },
        { f: 260, name: '02_bid_storm_4.3s.png' },
        { f: 315, name: '03_click_shock_particles_5.25s.png' },
        { f: 545, name: '04_drawdown_wake_9.08s.png' },
        { f: 735, name: '05_flash_spike_dissolve_12.25s.png' },
        { f: 840, name: '06_flash_heal_14.0s.png' },
      ];
      for (const item of previewFrames) {
        const png = await grabFramePng(cdp, item.f);
        fs.writeFileSync(path.join(stillsDir, item.name), png);
        console.log(`Saved ${path.relative(PROJECT_DIR, path.join(stillsDir, item.name))} (${png.length} bytes)`);
      }
      return;
    }

    // Full deterministic 900-frame 60fps encode piped to ffmpeg
    const wavPath = path.join(PROJECT_DIR, '.tmp_market_audio.wav');
    const mp4Name = VERTICAL
      ? 'pixel-mosaic-market-wave-vertical-1080x1920-60fps.mp4'
      : 'pixel-mosaic-market-wave-1080p60.mp4';
    const mp4Path = path.join(PROJECT_DIR, mp4Name);
    console.log('Synthesizing 15.0s subtle stereo market ambience (48 kHz)...');
    synthesizeMarketAudioWav(wavPath, DURATION);

    const ffmpegArgs = [
      '-y',
      '-f', 'image2pipe',
      '-vcodec', 'png',
      '-framerate', String(FPS),
      '-i', 'pipe:0',
      '-i', wavPath,
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c:v', 'libx264',
      '-profile:v', 'high',
      '-preset', 'slow',
      '-crf', String(crf),
      '-maxrate', '19M',
      '-bufsize', '28M',
      '-pix_fmt', 'yuv420p',
      '-r', String(FPS),
      '-c:a', 'aac',
      '-ar', '48000',
      '-ac', '2',
      '-b:a', '128k',
      '-shortest',
      '-movflags', '+faststart',
      mp4Path,
    ];

    console.log(`Encoding ${TOTAL_FRAMES} frames @ ${WIDTH}x${HEIGHT} ${FPS}fps (CRF ${crf})...`);
    const ff = spawn('ffmpeg', ffmpegArgs, { stdio: ['pipe', 'inherit', 'pipe'] });
    let ffStderr = '';
    ff.stderr.on('data', (chunk) => {
      ffStderr += chunk.toString();
    });
    const ffDone = new Promise((resolve, reject) => {
      ff.on('error', reject);
      ff.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}:\n${ffStderr.slice(-1500)}`));
      });
    });

    const tStart = Date.now();
    for (let f = 0; f < TOTAL_FRAMES; f++) {
      const png = await grabFramePng(cdp, f);
      if (!ff.stdin.write(png)) {
        await new Promise((r) => ff.stdin.once('drain', r));
      }
      if ((f + 1) % 150 === 0 || f === TOTAL_FRAMES - 1) {
        const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
        console.log(`Rendered & piped frame ${f + 1}/${TOTAL_FRAMES} (${elapsed}s elapsed)`);
      }
    }
    ff.stdin.end();
    await ffDone;

    if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
    const stat = fs.statSync(mp4Path);
    console.log(`Done! ${mp4Path} (${(stat.size / (1024 * 1024)).toFixed(2)} MB, ${stat.size} bytes)`);
  } finally {
    cdp.close();
    chromeProc.kill('SIGTERM');
    await new Promise((r) => {
      const timer = setTimeout(() => {
        chromeProc.kill('SIGKILL');
        r();
      }, 1500);
      chromeProc.once('exit', () => {
        clearTimeout(timer);
        r();
      });
    });
    server.close();
    try {
      fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {}
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
