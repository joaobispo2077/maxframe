import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

export function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const start = y * (stride + 1);
    raw[start] = 0;
    rgba.copy(raw, start + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const COLORS = {
  pass: [27, 127, 58, 255],
  fail: [176, 0, 32, 255],
  unknown: [92, 103, 112, 255],
  floor: [31, 78, 121, 255],
  paper: [255, 255, 255, 255],
  ink: [26, 26, 26, 255],
};

function setPixel(rgba, width, x, y, color) {
  if (x < 0 || y < 0) return;
  const height = rgba.length / (width * 4);
  if (x >= width || y >= height) return;
  const index = (y * width + x) * 4;
  rgba[index] = color[0];
  rgba[index + 1] = color[1];
  rgba[index + 2] = color[2];
  rgba[index + 3] = color[3];
}

function fillRect(rgba, width, x, y, w, h, color) {
  for (let row = y; row < y + h; row += 1) {
    for (let col = x; col < x + w; col += 1) {
      setPixel(rgba, width, col, row, color);
    }
  }
}

export function statusColor(status) {
  if (status === 'PASS') return COLORS.pass;
  if (status === 'FAIL') return COLORS.fail;
  return COLORS.unknown;
}

export function renderBarPng(rows, { width = 640, rowHeight = 28 } = {}) {
  const height = Math.max(rowHeight, rows.length * rowHeight + 16);
  const rgba = Buffer.alloc(width * height * 4, 255);
  rows.forEach((row, index) => {
    const y = 8 + index * rowHeight;
    const measured = Number(row.drawn);
    const span = Number.isFinite(measured)
      ? Math.max(
          4,
          Math.round(
            (Math.min(100, Math.max(0, measured)) / 100) * (width - 24),
          ),
        )
      : 18;
    fillRect(rgba, width, 12, y, span, rowHeight - 10, statusColor(row.status));
    if (Number.isFinite(row.line)) {
      const lineX =
        12 + Math.round((Math.min(100, row.line) / 100) * (width - 24));
      fillRect(rgba, width, lineX, y - 2, 2, rowHeight - 6, COLORS.floor);
    }
  });
  return encodePng(width, height, rgba);
}
