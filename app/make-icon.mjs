/**
 * Generate the tray and window icons without any image dependency:
 * render at 4x, downsample for anti-aliasing, encode a PNG by hand.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));

const BLUE = [59, 111, 224];
const GREEN = [47, 158, 107];
const WHITE = [244, 247, 255];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const payload = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(payload), 0);
  return Buffer.concat([length, payload, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** One pixel of the calendar artwork, in 0..1 canvas coordinates. */
function sample(x, y) {
  const left = 0.17;
  const right = 0.83;
  const top = 0.22;
  const bottom = 0.84;
  const radius = 0.09;
  const border = 0.055;

  const innerX = Math.max(left + radius - x, 0, x - (right - radius));
  const innerY = Math.max(top + radius - y, 0, y - (bottom - radius));
  const outsideRounded = Math.hypot(innerX, innerY);
  const inBody = x > left && x < right && y > top && y < bottom && outsideRounded < radius;
  if (inBody) {
    const inner =
      x > left + border && x < right - border && y > top + border && y < bottom - border &&
      Math.hypot(
        Math.max(left + border + radius - x, 0, x - (right - border - radius)),
        Math.max(top + border + radius - y, 0, y - (bottom - border - radius))
      ) < radius;
    if (!inner) return BLUE;
    // header rule
    if (y > top + 0.16 && y < top + 0.16 + 0.045 && x > left + border && x < right - border) return BLUE;
  }
  // hangers
  const hangerTop = 0.13;
  const hangerBottom = 0.28;
  for (const hx of [0.34, 0.66]) {
    if (Math.abs(x - hx) < 0.035 && y > hangerTop && y < hangerBottom) return BLUE;
  }
  // check mark
  const segments = [
    [[0.36, 0.58], [0.47, 0.69]],
    [[0.47, 0.69], [0.66, 0.45]]
  ];
  for (const [[x1, y1], [x2, y2]] of segments) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
    const distance = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
    if (distance < 0.043) return GREEN;
  }
  return null;
}

function render(size, scale) {
  const buffer = Buffer.alloc(size * size * 4);
  const ss = 4;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const px = (x + (sx + 0.5) / ss) / size;
          const py = (y + (sy + 0.5) / ss) / size;
          const colour = sample(px, py);
          if (colour !== null) {
            r += colour[0];
            g += colour[1];
            b += colour[2];
            a += 255;
          }
        }
      }
      const count = ss * ss;
      const offset = (y * size + x) * 4;
      if (a > 0) {
        const covered = a / 255;
        buffer[offset] = Math.round(r / covered);
        buffer[offset + 1] = Math.round(g / covered);
        buffer[offset + 2] = Math.round(b / covered);
        buffer[offset + 3] = Math.round((a / count) * scale);
      }
    }
  }
  return buffer;
}

const assets = path.join(here, 'assets');
mkdirSync(assets, { recursive: true });

const pngs = [];
for (const [name, size] of [['tray.png', 32], ['icon.png', 256]]) {
  const rgba = render(size, 1);
  const buffer = encodePng(size, size, rgba);
  writeFileSync(path.join(assets, name), buffer);
  pngs.push({ size, buffer });
  console.log(`${name}: ${size}x${size}`);
}
writeFileSync(path.join(assets, 'blank.png'), encodePng(16, 16, Buffer.alloc(16 * 16 * 4)));

/** A multi-size .ico whose entries carry PNG payloads (Vista and later). */
function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const directory = Buffer.alloc(16 * entries.length);
  let offset = 6 + directory.length;
  entries.forEach((entry, index) => {
    const base = index * 16;
    directory[base] = entry.size >= 256 ? 0 : entry.size;
    directory[base + 1] = entry.size >= 256 ? 0 : entry.size;
    directory[base + 2] = 0;
    directory[base + 3] = 0;
    directory.writeUInt16LE(1, base + 4);
    directory.writeUInt16LE(32, base + 6);
    directory.writeUInt32LE(entry.buffer.length, base + 8);
    directory.writeUInt32LE(offset, base + 12);
    offset += entry.buffer.length;
  });
  return Buffer.concat([header, directory, ...entries.map((entry) => entry.buffer)]);
}

writeFileSync(path.join(assets, 'icon.ico'), encodeIco(pngs.slice().sort((a, b) => b.size - a.size)));
console.log('icon.ico: ' + pngs.map((entry) => entry.size).join(' + '));
