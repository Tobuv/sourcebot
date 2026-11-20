// Renders the NexusCode mark (see src/app/components/nexusCodeMark.tsx) into
// the raster / standalone icon files. Run from packages/web:
//   node scripts/generateBrandAssets.mjs
import sharp from 'sharp';
import { writeFileSync } from 'fs';

const mark = (color) => `
  <g fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="12,2 20.66,7 20.66,17 12,22 3.34,17 3.34,7"/>
    <line x1="12" y1="12" x2="12" y2="2"/>
    <line x1="12" y1="12" x2="20.66" y2="17"/>
    <line x1="12" y1="12" x2="3.34" y2="17"/>
    <circle cx="12" cy="12" r="2.6" fill="${color}" stroke="none"/>
    <circle cx="12" cy="2" r="1.7" fill="${color}" stroke="none"/>
    <circle cx="20.66" cy="17" r="1.7" fill="${color}" stroke="none"/>
    <circle cx="3.34" cy="17" r="1.7" fill="${color}" stroke="none"/>
  </g>`;

// App icon: white mark on a dark rounded square.
const appIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#0f172a"/>
  <g transform="translate(5 5) scale(0.9167)">${mark('#ffffff')}</g>
</svg>`;

// Mark only, white on transparent (for dark backgrounds such as share images).
const markDark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${mark('#ffffff')}</svg>`;

writeFileSync('src/app/icon.svg', appIcon + '\n');
await sharp(Buffer.from(appIcon), { density: 1200 }).resize(512, 512).png().toFile('public/logo_512.png');
await sharp(Buffer.from(appIcon), { density: 600 }).resize(180, 180).png().toFile('src/app/apple-icon.png');
await sharp(Buffer.from(markDark), { density: 1200 }).resize(256, 256).png().toFile('public/nexuscode_mark_dark.png');
console.log('done');
