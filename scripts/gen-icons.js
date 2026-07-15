// Gera os ícones PNG do PWA (public/icons) sem dependências externas,
// codificando o PNG manualmente com zlib. Desenha um quadrado arredondado
// em degradê com um "check" branco (marca da Fatura Expert).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filtro none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawIcon(size) {
  const img = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  // check: de (0.28, 0.52) a (0.44, 0.68) a (0.74, 0.34), espessura relativa
  const w = size * 0.075;
  const p1 = [0.28 * size, 0.52 * size], p2 = [0.44 * size, 0.68 * size], p3 = [0.74 * size, 0.34 * size];
  const distSeg = (px, py, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // máscara de canto arredondado
      const cx = Math.max(radius - x, x - (size - 1 - radius), 0);
      const cy = Math.max(radius - y, y - (size - 1 - radius), 0);
      if (cx * cx + cy * cy > radius * radius) { img[i + 3] = 0; continue; }
      // degradê azul -> roxo
      const g = (x + y) / (2 * size);
      let r = Math.round(37 + g * (124 - 37));
      let gr = Math.round(99 + g * (58 - 99));
      let b = Math.round(235 + g * (237 - 235));
      const d = Math.min(distSeg(x, y, p1, p2), distSeg(x, y, p2, p3));
      if (d < w) { r = gr = b = 255; }
      else if (d < w + 1.5) { const mix = (d - w) / 1.5; r = Math.round(255 * (1 - mix) + r * mix); gr = Math.round(255 * (1 - mix) + gr * mix); b = Math.round(255 * (1 - mix) + b * mix); }
      img[i] = r; img[i + 1] = gr; img[i + 2] = b; img[i + 3] = 255;
    }
  }
  return encodePNG(size, size, img);
}

const dir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(dir, { recursive: true });
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(dir, `icon-${size}.png`), drawIcon(size));
  console.log(`icon-${size}.png gerado`);
}
