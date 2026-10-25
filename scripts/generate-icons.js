import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const PUBLIC_ICONS_DIR = path.resolve('public/icons');
fs.mkdirSync(PUBLIC_ICONS_DIR, { recursive: true });

// SVG icon template
function generateSvgIcon(size, isMaskable = false) {
  const padding = isMaskable ? size * 0.15 : size * 0.08;
  const contentSize = size - padding * 2;
  const radius = isMaskable ? 0 : size * 0.22;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="50%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>
    <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#fef08a" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${size * 0.02}" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background container -->
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bgGrad)" />

  <!-- Sheet & lightning bolt icon graphic -->
  <g transform="translate(${padding}, ${padding}) scale(${contentSize / 100})">
    <!-- Stylized folded paper card -->
    <rect x="18" y="14" width="64" height="74" rx="10" fill="#0f172a" opacity="0.4" />
    <rect x="15" y="12" width="64" height="74" rx="10" fill="#ffffff" opacity="0.95" />
    
    <!-- Notes lines -->
    <rect x="25" y="24" width="30" height="4.5" rx="2.2" fill="#6366f1" />
    <rect x="25" y="34" width="44" height="3.5" rx="1.7" fill="#94a3b8" />
    <rect x="25" y="42" width="40" height="3.5" rx="1.7" fill="#94a3b8" />
    <rect x="25" y="50" width="35" height="3.5" rx="1.7" fill="#94a3b8" />

    <!-- Lightning snap badge -->
    <circle cx="68" cy="68" r="18" fill="url(#bgGrad)" filter="url(#glow)" />
    <!-- Lightning bolt inside circle -->
    <polygon points="70,56 60,69 67,69 65,80 77,66 70,66" fill="url(#boltGrad)" />
  </g>
</svg>`;
}

// Generate pure valid PNG using Node zlib and CRC32
function createPng(width, height, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    crc.writeInt32BE(crcVal, 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: 2 (RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Scanlines with filter byte 0
  const scanlineWidth = 1 + width * 3;
  const rawData = Buffer.alloc(scanlineWidth * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineWidth;
    rawData[rowOffset] = 0; // Filter: None
    const gradFactor = y / height;
    const curR = Math.min(255, Math.floor(r * (1 - gradFactor * 0.3) + 6 * gradFactor));
    const curG = Math.min(255, Math.floor(g * (1 - gradFactor * 0.1) + 182 * gradFactor));
    const curB = Math.min(255, Math.floor(b * (1 - gradFactor * 0.1) + 212 * gradFactor));

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      rawData[pixelOffset] = curR;
      rawData[pixelOffset + 1] = curG;
      rawData[pixelOffset + 2] = curB;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// Minimal CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ -1;
}

// Write SVGs
fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'icon-192.svg'), generateSvgIcon(192, false));
fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'icon-512.svg'), generateSvgIcon(512, false));
fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'icon-maskable.svg'), generateSvgIcon(512, true));
fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'favicon.svg'), generateSvgIcon(64, false));

// Write valid PNGs for maximum PWA compatibility
fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'icon-192.png'), createPng(192, 192, 99, 102, 241));
fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'icon-512.png'), createPng(512, 512, 99, 102, 241));
fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'icon-maskable.png'), createPng(512, 512, 79, 70, 229));

console.log('Successfully generated all PWA icons (SVG & PNG)!');
