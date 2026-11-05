(function () {
  'use strict';

  const S = 96;

  function makeCanvas() {
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    return c;
  }

  function ellipse(g, cx, cy, rx, ry, rot, fill, stroke, lineWidth) {
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    g.beginPath();
    g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
    if (stroke) {
      g.lineWidth = lineWidth || 1;
      g.strokeStyle = stroke;
      g.stroke();
    }
    g.restore();
  }

  function legs(g, lift) {
    g.save();
    g.strokeStyle = 'rgba(44,38,33,0.9)';
    g.lineWidth = 1.7;
    g.lineCap = 'round';
    for (const dir of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const x = -4 + i * 8;
        const y = dir * (5 + i * 0.6);
        const raise = i === 2 ? lift : 0;
        const ex = x + 9 - raise * 4;
        const ey = y + dir * (13 - raise * 7);
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + 4, y + dir * 8, ex, ey);
        g.lineTo(ex + 7, ey + dir * (4 + raise * 5));
        g.stroke();
      }
    }
    g.restore();
  }

  function wings(g, open) {
    for (const dir of [-1, 1]) {
      g.save();
      g.translate(4, 0);
      g.rotate(dir * (0.12 + open * 0.62));
      const grad = g.createLinearGradient(0, 0, -38, dir * 18);
      grad.addColorStop(0, 'rgba(232,240,247,0.62)');
      grad.addColorStop(0.55, 'rgba(196,214,228,0.42)');
      grad.addColorStop(1, 'rgba(150,176,196,0.24)');
      ellipse(g, -18, dir * 10, 24, 7.6, 0, grad, 'rgba(138,160,180,0.5)', 0.9);
      g.strokeStyle = 'rgba(120,145,165,0.32)';
      g.lineWidth = 0.8;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(-2, dir * (3 + k * 2));
        g.quadraticCurveTo(-18, dir * (8 + k * 2), -38, dir * (8 + k * 4));
        g.stroke();
      }
      g.restore();
    }
  }

  function body(g) {
    const abdomen = g.createLinearGradient(0, -11, 0, 11);
    abdomen.addColorStop(0, '#5c554c');
    abdomen.addColorStop(0.45, '#302d29');
    abdomen.addColorStop(1, '#141312');
    ellipse(g, -7, 0, 17, 10.5, 0, abdomen, 'rgba(18,16,15,0.9)', 1);

    g.strokeStyle = 'rgba(150,140,124,0.28)';
    g.lineWidth = 1.1;
    for (let i = 0; i < 3; i++) {
      const x = -14 + i * 6;
      g.beginPath();
      g.moveTo(x, -8.5);
      g.quadraticCurveTo(x + 2.5, 0, x, 8.5);
      g.stroke();
    }

    const thorax = g.createRadialGradient(6, -4, 1, 8, 0, 12);
    thorax.addColorStop(0, '#5a554d');
    thorax.addColorStop(0.6, '#33302b');
    thorax.addColorStop(1, '#161513');
    ellipse(g, 8, 0, 10, 9, 0, thorax, 'rgba(15,14,13,0.85)', 1);

    const head = g.createRadialGradient(17, -3, 1, 18, 0, 9);
    head.addColorStop(0, '#4a453e');
    head.addColorStop(1, '#1a1817');
    ellipse(g, 18, 0, 7.6, 7, 0, head);

    for (const dir of [-1, 1]) {
      const eye = g.createRadialGradient(21 + dir * 0.5, dir * 5 - 1, 0.5, 21, dir * 5, 4.6);
      eye.addColorStop(0, '#a95c3d');
      eye.addColorStop(0.6, '#7d3a26');
      eye.addColorStop(1, '#3a1b14');
      ellipse(g, 21, dir * 5, 3.6, 4.2, dir * 0.25, eye);
      ellipse(g, 22, dir * 5 - 1.2, 0.9, 1, 0, 'rgba(255,246,232,0.9)');
    }

    g.strokeStyle = 'rgba(48,42,36,0.9)';
    g.lineWidth = 1.3;
    g.lineCap = 'round';
    for (const dir of [-1, 1]) {
      g.beginPath();
      g.moveTo(24, dir * 3);
      g.quadraticCurveTo(29, dir * 5, 31, dir * 10);
      g.stroke();
    }
  }

  function hairs(g) {
    g.strokeStyle = 'rgba(28,25,22,0.75)';
    g.lineWidth = 0.9;
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const x = -21 + t * 36;
      const y = -9.5 - Math.sin(t * Math.PI) * 0.8;
      const dir = i % 2 ? 1 : -1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + dir * 1.6, y - 3.2);
      g.stroke();
    }
  }

  function render(open, lift, landing) {
    const c = makeCanvas();
    const g = c.getContext('2d');
    g.translate(S / 2, S / 2);
    g.shadowColor = 'rgba(0,0,0,0.35)';
    g.shadowBlur = 2;
    legs(g, lift);
    wings(g, landing ? 0.12 : open);
    body(g);
    hairs(g);
    g.shadowBlur = 0;
    return c;
  }

  const flyFrames = [];
  const landFrames = [];
  for (let i = 0; i < 6; i++) {
    const open = 0.5 + 0.5 * Math.sin((i / 6) * Math.PI * 2);
    flyFrames.push(render(open, 0, false));
  }
  for (let i = 0; i < 6; i++) {
    landFrames.push(render(0.14, i < 3 ? 0 : 1, true));
  }

  window.FlySprites = {
    frame(landing, phase) {
      const frames = landing ? landFrames : flyFrames;
      const i = ((Math.floor(phase) % frames.length) + frames.length) % frames.length;
      return frames[i];
    }
  };
})();
