/**
 * Rasterize Мова brand icons from SVG source into public/.
 * Run: node scripts/generate-brand-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pub = path.join(root, 'public');

const BG = '#0E0F10';
const ACCENT = '#FF5722';
const CREAM = '#F4F1EC';
const MUTED = '#9A9590';

const MARK_INNER = `
  <path fill="${ACCENT}" d="M12 48V16h7.2l8.4 20.4L36 16h7.2v32h-6.4V27.6L29.6 48h-5.2L17.2 27.6V48H12z"/>
  <rect x="46" y="25" width="9" height="4" rx="1.2" fill="${CREAM}"/>
  <rect x="46" y="35" width="9" height="4" rx="1.2" fill="${CREAM}"/>
`;

/** Tight app icon (any / favicon / apple). */
function markSvg(size) {
  const scale = size / 64;
  const rx = Math.round(size * 0.22);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${BG}"/>
  <g transform="scale(${scale})">${MARK_INNER}</g>
</svg>`;
}

/** Maskable: full-bleed plate, mark inset ~12% for safe zone. */
function maskableSvg(size) {
  const pad = size * 0.12;
  const inner = size - pad * 2;
  const scale = inner / 64;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <g transform="translate(${pad} ${pad}) scale(${scale})">${MARK_INNER}</g>
</svg>`;
}

function ogSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" fill="none">
  <rect width="1200" height="630" fill="${BG}"/>
  <circle cx="1020" cy="90" r="280" fill="${ACCENT}" fill-opacity="0.16"/>
  <circle cx="-40" cy="560" r="220" fill="${ACCENT}" fill-opacity="0.08"/>
  <rect x="80" y="150" width="96" height="96" rx="22" fill="${BG}" stroke="${ACCENT}" stroke-opacity="0.35" stroke-width="2"/>
  <g transform="translate(80 150) scale(1.5)">${MARK_INNER}</g>
  <text x="210" y="230" fill="${CREAM}" font-family="Arial Black, Helvetica Neue, Arial, sans-serif" font-size="96" font-weight="900" letter-spacing="-0.04em">Мова</text>
  <text x="80" y="340" fill="${ACCENT}" font-family="Helvetica Neue, Arial, sans-serif" font-size="36" font-weight="700">Язык твоего авто</text>
  <text x="80" y="400" fill="${MUTED}" font-family="Helvetica Neue, Arial, sans-serif" font-size="26" font-weight="500">Русификация китайских авто · Минск</text>
  <text x="80" y="520" fill="${MUTED}" font-family="Helvetica Neue, Arial, sans-serif" font-size="22" font-weight="500">mova-auto.tech</text>
</svg>`;
}

function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries = [];
  for (const buf of pngBuffers) {
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    entries.push({ buf, w: w >= 256 ? 0 : w, h: h >= 256 ? 0 : h, offset, size: buf.length });
    offset += buf.length;
  }
  const out = Buffer.alloc(offset);
  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(count, 4);
  let entryAt = 6;
  for (const e of entries) {
    out.writeUInt8(e.w, entryAt);
    out.writeUInt8(e.h, entryAt + 1);
    out.writeUInt8(0, entryAt + 2);
    out.writeUInt8(0, entryAt + 3);
    out.writeUInt16LE(1, entryAt + 4);
    out.writeUInt16LE(32, entryAt + 6);
    out.writeUInt32LE(e.size, entryAt + 8);
    out.writeUInt32LE(e.offset, entryAt + 12);
    e.buf.copy(out, e.offset);
    entryAt += 16;
  }
  return out;
}

async function pngFromSvg(svg, size) {
  return sharp(Buffer.from(svg)).resize(size, size, { fit: 'fill' }).png().toBuffer();
}

async function main() {
  const jobs = [
    { file: 'apple-touch-icon.png', svg: markSvg(180), size: 180 },
    { file: 'icon-192.png', svg: markSvg(192), size: 192 },
    { file: 'icon-512.png', svg: markSvg(512), size: 512 },
    { file: 'icon-maskable-192.png', svg: maskableSvg(192), size: 192 },
    { file: 'icon-maskable-512.png', svg: maskableSvg(512), size: 512 },
  ];

  for (const j of jobs) {
    const buf = await pngFromSvg(j.svg, j.size);
    fs.writeFileSync(path.join(pub, j.file), buf);
    console.log('wrote', j.file, buf.length);
  }

  const ico = buildIco([
    await pngFromSvg(markSvg(16), 16),
    await pngFromSvg(markSvg(32), 32),
    await pngFromSvg(markSvg(48), 48),
  ]);
  fs.writeFileSync(path.join(pub, 'favicon.ico'), ico);
  console.log('wrote favicon.ico', ico.length);

  const ogBuf = await sharp(Buffer.from(ogSvg())).png().toBuffer();
  fs.writeFileSync(path.join(pub, 'og.png'), ogBuf);
  console.log('wrote og.png', ogBuf.length);
  fs.writeFileSync(path.join(pub, 'og.svg'), ogSvg());
  console.log('wrote og.svg');

  const manifest = {
    name: 'Мова — русификация авто',
    short_name: 'Мова',
    description: 'Русификация мультимедиа китайских авто в Минске',
    start_url: '/',
    display: 'standalone',
    background_color: BG,
    theme_color: BG,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  fs.writeFileSync(path.join(pub, 'site.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('wrote site.webmanifest');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
