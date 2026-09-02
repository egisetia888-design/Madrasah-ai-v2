import fs from 'fs';
import sharp from 'sharp';

const svgBuffer = fs.readFileSync('public/favicon.svg');

async function generate() {
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile('public/icon-192x192.png');
    
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile('public/icon-512x512.png');

  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile('public/apple-touch-icon.png');
    
  console.log('Icons generated successfully.');
}

generate().catch(console.error);
