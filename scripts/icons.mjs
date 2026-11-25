// Genera los iconos PNG de la app a partir de un SVG.
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const glyph = (scale) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <path d="M136 250 L256 146 L376 250" fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M166 232 V366 a16 16 0 0 0 16 16 H330 a16 16 0 0 0 16 -16 V232" fill="none" stroke="#fff" stroke-width="30" stroke-linejoin="round"/>
    <circle cx="256" cy="304" r="44" fill="#f2c14e"/>
    <path d="M271 284 a24 24 0 1 0 0 40 M228 297 H262 M228 311 H262" fill="none" stroke="#0ea5e9" stroke-width="9" stroke-linecap="round"/>
  </g>`;

await fs.mkdir(out, { recursive: true });

const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#0ea5e9"/>${glyph(1)}</svg>`;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0ea5e9"/>${glyph(0.78)}</svg>`;

await sharp(Buffer.from(rounded)).resize(192, 192).png().toFile(path.join(out, 'icon-192.png'));
await sharp(Buffer.from(rounded)).resize(512, 512).png().toFile(path.join(out, 'icon-512.png'));
await sharp(Buffer.from(full)).resize(512, 512).png().toFile(path.join(out, 'icon-maskable-512.png'));
await sharp(Buffer.from(full)).resize(180, 180).png().toFile(path.join(out, 'apple-touch-icon.png'));
console.log('iconos OK');
