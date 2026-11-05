'use strict';

const zlib = require('zlib');
const { nativeImage } = require('electron');

const CRC_TABLE = (function () {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function renderAppIcon(size) {
  const scale = size / 256;
  const buf = Buffer.alloc(size * size * 4);
  const blendPixel = (x, y, rgb, alpha) => {
    if (x < 0 || y < 0 || x >= size || y >= size || alpha <= 0) return;
    const i = (y * size + x) * 4;
    const dstA = buf[i + 3] / 255;
    const outA = alpha + dstA * (1 - alpha);
    for (let c = 0; c < 3; c++) {
      buf[i + c] = Math.round((rgb[c] * alpha + buf[i + c] * dstA * (1 - alpha)) / (outA || 1));
    }
    buf[i + 3] = Math.round(outA * 255);
  };

  // Rounded, cool-toned tile so the insect stays legible against the desktop.
  const radius = 52 * scale;
  const edge = 18 * scale;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const qx = Math.abs(px - size / 2) - (size / 2 - radius);
      const qy = Math.abs(py - size / 2) - (size / 2 - radius);
      const distance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
      const coverage = Math.max(0, Math.min(1, 0.5 - distance));
      if (!coverage) continue;
      const vertical = py / size;
      const glow = Math.max(0, 1 - Math.hypot((px - size * 0.5) / (size * 0.62), (py - size * 0.48) / (size * 0.68)));
      const tint = Math.min(1, glow * 0.34);
      const top = [12, 27, 43];
      const bottom = [20, 51, 66];
      const teal = [26, 107, 112];
      const rgb = top.map((v, c) => Math.round(v * (1 - vertical) + bottom[c] * vertical + (teal[c] - (v * (1 - vertical) + bottom[c] * vertical)) * tint));
      const i = (y * size + x) * 4;
      buf[i] = rgb[0];
      buf[i + 1] = rgb[1];
      buf[i + 2] = rgb[2];
      buf[i + 3] = Math.round(coverage * 255);
    }
  }

  const E = (cx, cy, rx, ry, rot, rgb, alpha) =>
    ellipse(buf, size, size, cx * scale, cy * scale, rx * scale, ry * scale, rot, rgb, alpha);
  const L = (x1, y1, x2, y2, rgb, width) =>
    line(buf, size, size, x1 * scale, y1 * scale, x2 * scale, y2 * scale, rgb, width * scale);

  E(128, 132, 88, 88, 0, [39, 174, 169], 0.11);

  // Four translucent wings, with dark veins for definition at small sizes.
  E(81, 99, 54, 22, -0.63, [190, 239, 238], 0.92);
  E(175, 99, 54, 22, 0.63, [190, 239, 238], 0.92);
  E(82, 100, 48, 14, -0.63, [227, 250, 246], 0.36);
  E(174, 100, 48, 14, 0.63, [227, 250, 246], 0.36);
  L(54, 81, 113, 117, [105, 184, 183], 1.1);
  L(202, 81, 143, 117, [105, 184, 183], 1.1);

  // Legs and antennae frame the fly without crowding the silhouette.
  const leg = [24, 35, 42];
  L(110, 135, 78, 155, leg, 2.2);
  L(112, 151, 75, 183, leg, 2.2);
  L(119, 164, 96, 202, leg, 2.2);
  L(146, 135, 178, 155, leg, 2.2);
  L(144, 151, 181, 183, leg, 2.2);
  L(137, 164, 160, 202, leg, 2.2);
  L(119, 83, 105, 63, [34, 44, 51], 2);
  L(137, 83, 151, 63, [34, 44, 51], 2);

  // Body: amber abdomen, charcoal thorax, and two warm red compound eyes.
  E(128, 184, 17, 37, 0, [148, 76, 39], 1);
  E(128, 177, 13, 29, 0, [190, 103, 48], 0.92);
  L(114, 171, 142, 171, [94, 54, 39], 2.1);
  L(113, 185, 143, 185, [94, 54, 39], 2.1);
  L(117, 199, 139, 199, [94, 54, 39], 1.7);
  E(128, 132, 23, 27, 0, [33, 39, 43], 1);
  E(125, 123, 12, 12, -0.2, [67, 78, 80], 0.55);
  E(128, 91, 21, 19, 0, [37, 41, 43], 1);
  E(111, 88, 8.2, 9.2, -0.2, [176, 69, 53], 1);
  E(145, 88, 8.2, 9.2, 0.2, [176, 69, 53], 1);
  E(109, 85, 2.7, 2.7, 0, [255, 220, 175], 0.94);
  E(143, 85, 2.7, 2.7, 0, [255, 220, 175], 0.94);

  return encodePNG(size, size, buf);
}

function ellipse(buf, w, h, cx, cy, rx, ry, rot, rgb, alpha) {
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const minX = Math.max(0, Math.floor(cx - rx - ry - 2));
  const maxX = Math.min(w - 1, Math.ceil(cx + rx + ry + 2));
  const minY = Math.max(0, Math.floor(cy - rx - ry - 2));
  const maxY = Math.min(h - 1, Math.ceil(cy + rx + ry + 2));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const u = dx * cos - dy * sin;
      const v = dx * sin + dy * cos;
      const d = (u * u) / (rx * rx) + (v * v) / (ry * ry);
      if (d > 1) continue;
      const i = (y * w + x) * 4;
      const a = alpha * Math.min(1, (1 - d) * 8);
      const dstA = buf[i + 3] / 255;
      const outA = a + dstA * (1 - a);
      for (let c = 0; c < 3; c++) {
        buf[i + c] = Math.round((rgb[c] * a + buf[i + c] * dstA * (1 - a)) / (outA || 1));
      }
      buf[i + 3] = Math.round(outA * 255);
    }
  }
}

function line(buf, w, h, x1, y1, x2, y2, rgb, width) {
  const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    ellipse(buf, w, h, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t,
      width, width, 0, rgb, 0.9);
  }
}

function renderFly(size) {
  const s = size / 32;
  const buf = Buffer.alloc(size * size * 4);
  const E = (cx, cy, rx, ry, rot, rgb, a) =>
    ellipse(buf, size, size, cx * s, cy * s, rx * s, ry * s, rot, rgb, a);
  const L = (x1, y1, x2, y2, rgb, width) =>
    line(buf, size, size, x1 * s, y1 * s, x2 * s, y2 * s, rgb, width * s);

  const leg = [72, 66, 58];
  L(18, 12, 12, 7, leg, 0.7);
  L(18, 20, 11, 25, leg, 0.7);
  L(24, 12, 27, 6, leg, 0.7);
  L(24, 20, 29, 26, leg, 0.7);
  L(15, 12, 9, 9, leg, 0.7);
  L(15, 20, 8, 23, leg, 0.7);

  const wing = [206, 218, 228];
  E(19, 10, 9, 3.6, -0.42, wing, 0.72);
  E(19, 22, 9, 3.6, 0.42, wing, 0.72);
  L(13, 8, 25, 12, [160, 178, 192], 0.35);
  L(13, 24, 25, 20, [160, 178, 192], 0.35);

  E(21.5, 16, 8.5, 5.8, 0, [43, 41, 39], 1);
  E(21, 14, 7.5, 2.4, 0, [66, 62, 57], 0.55);
  E(16.5, 16, 5.2, 5, 0, [55, 52, 49], 1);
  E(10.5, 16, 4.2, 4.2, 0, [38, 36, 35], 1);
  E(9, 13.4, 2.1, 2.3, -0.3, [128, 58, 40], 1);
  E(9, 18.6, 2.1, 2.3, 0.3, [128, 58, 40], 1);
  E(8.4, 12.8, 0.7, 0.7, 0, [245, 240, 230], 0.9);
  E(8.4, 18, 0.7, 0.7, 0, [245, 240, 230], 0.75);
  L(7.5, 16, 5, 14, leg, 0.55);
  return encodePNG(size, size, buf);
}

let cache = null;

function trayIcon() {
  if (!cache) {
    const { nativeImage } = require('electron');
    cache = nativeImage.createFromBuffer(renderFly(32));
    if (process.platform === 'darwin') cache.setTemplateImage(false);
  }
  return cache;
}

module.exports = { trayIcon, renderFly, renderAppIcon };
