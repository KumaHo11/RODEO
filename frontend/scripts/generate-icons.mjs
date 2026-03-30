// Script to generate PNG icons from SVG using Canvas API via node
// Run: node scripts/generate-icons.mjs

import { createCanvas } from 'canvas';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sizes = [192, 512];

for (const size of sizes) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Green background with rounded corners
  const r = size * 0.19;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = '#16a34a';
  ctx.fill();
  
  // White "R" letter for RODEO
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.55}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('R', size / 2, size / 2 - size * 0.04);
  
  // Green dot (like a paddock)
  ctx.fillStyle = '#86efac';
  ctx.beginPath();
  ctx.arc(size * 0.62, size * 0.68, size * 0.06, 0, Math.PI * 2);
  ctx.fill();
  
  const buffer = canvas.toBuffer('image/png');
  const outPath = join(__dirname, '..', 'public', 'icons', `icon-${size}.png`);
  writeFileSync(outPath, buffer);
  console.log(`Generated ${outPath}`);
}
