// Convierte design/login-bg/index.html en el vídeo de fondo del login (mismo enfoque que HyperFrames:
// se busca cada instante de la línea de tiempo, se captura el fotograma y ffmpeg los une).
// Uso: node scripts/render-login-bg.mjs   → public/media/login-bg.{mp4,jpg}
// Se ejecuta en cada publicación (npm run build). Si algo falla, avisa y la publicación sigue:
// la pantalla de entrada se queda con el fondo liso.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'design', 'login-bg', 'index.html');
const out = path.join(root, 'public', 'media');
const tmp = path.join(root, '.render-frames');
const FPS = 30, DURATION = 10, SIZE = 1080;


const chrome = [process.env.CHROME, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'].find((p) => p && existsSync(p));
let ffmpeg = 'ffmpeg';
try { ffmpeg = (await import('ffmpeg-static')).default || 'ffmpeg'; } catch { /* se usa el ffmpeg del sistema */ }

try {
  if (existsSync(path.join(out, 'login-bg.mp4')) && !process.env.CI && !process.argv.includes('--force')) {
    console.log('login-bg: ya existe (usa --force para regenerarlo)');
    process.exit(0);
  }
  await render();
} catch (e) {
  console.warn('login-bg: no se ha podido generar el vídeo, el login usará el fondo liso.', e.message);
  await fs.rm(tmp, { recursive: true, force: true });
}

async function render() {
const { default: puppeteer } = await import('puppeteer-core');
await fs.rm(tmp, { recursive: true, force: true });
await fs.mkdir(tmp, { recursive: true });
await fs.mkdir(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chrome,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument(() => { window.__RENDERING__ = true; });
await page.goto('file://' + src);

const total = FPS * DURATION;
for (let i = 0; i < total; i++) {
  const data = await page.evaluate((t) => { window.renderAt(t); return document.querySelector('canvas').toDataURL('image/jpeg', 0.96); }, i / FPS);
  await fs.writeFile(path.join(tmp, `f${String(i).padStart(4, '0')}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
}
await browser.close();

const frames = path.join(tmp, 'f%04d.jpg');
const ff = (args) => execFileSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
// MP4 (H.264): lo reproducen todos los navegadores, también iPhone. JPG como póster.
ff(['-framerate', String(FPS), '-i', frames, '-vf', 'scale=960:960', '-c:v', 'libx264', '-preset', 'slow', '-crf', '30',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', path.join(out, 'login-bg.mp4')]);
ff(['-i', path.join(tmp, 'f0000.jpg'), '-vf', 'scale=960:960', '-q:v', '5', path.join(out, 'login-bg.jpg')]);
await fs.rm(tmp, { recursive: true, force: true });

for (const f of ['login-bg.mp4', 'login-bg.jpg']) {
  const { size } = await fs.stat(path.join(out, f));
  console.log(f, Math.round(size / 1024), 'KB');
}
}
