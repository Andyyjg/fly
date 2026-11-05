(function () {
  'use strict';

  const SWING_TIME = 0.26;

  function drawShape(ctx) {
    const handle = ctx.createLinearGradient(-5, 0, 5, 0);
    handle.addColorStop(0, '#e2563f');
    handle.addColorStop(0.5, '#ff8a5c');
    handle.addColorStop(1, '#c73f2e');
    ctx.fillStyle = handle;
    ctx.strokeStyle = 'rgba(90,26,18,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-5, -8, 10, 52, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(60,20,14,0.35)';
    ctx.beginPath();
    ctx.roundRect(-4, 34, 8, 8, 3);
    ctx.fill();

    const frame = ctx.createLinearGradient(-27, -60, 27, -8);
    frame.addColorStop(0, '#ff7f5e');
    frame.addColorStop(0.55, '#e14c34');
    frame.addColorStop(1, '#a92f22');
    ctx.fillStyle = frame;
    ctx.strokeStyle = 'rgba(84,22,16,0.85)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, -34, 27, 31, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -34, 20.5, 24.5, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(226,240,246,0.22)';
    ctx.fillRect(-28, -62, 56, 58);
    ctx.strokeStyle = 'rgba(70,32,24,0.5)';
    ctx.lineWidth = 1.1;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-26, -34 + i * 6);
      ctx.lineTo(26, -34 + i * 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i * 6, -62);
      ctx.lineTo(i * 6, -6);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -34, 24, 28, 0, Math.PI * 1.05, Math.PI * 1.55);
    ctx.stroke();
  }

  class Swatter {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.swing = 0;
      this.cooldown = 0;
      this.pending = false;
      this.hitDone = false;
      this.angle = -0.5;
      this.visible = false;
    }

    press() {
      if (this.cooldown > 0) return false;
      this.swing = 1;
      this.cooldown = SWING_TIME + 0.06;
      this.pending = true;
      this.hitDone = false;
      return true;
    }

    update(dt, mouse) {
      this.x = mouse.x;
      this.y = mouse.y;
      this.visible = !!mouse.inside;
      this.cooldown = Math.max(0, this.cooldown - dt);
      this.swing = Math.max(0, this.swing - dt / SWING_TIME);
      this.angle = -0.5 + (1 - this.swing) * 1.3;
    }

    get hitActive() {
      return this.pending && !this.hitDone && this.swing <= 0.78 && this.swing >= 0.34;
    }

    hitPoint() {
      const a = this.angle;
      const lx = 0;
      const ly = -34;
      return {
        x: this.x + lx * Math.cos(a) - ly * Math.sin(a),
        y: this.y + lx * Math.sin(a) + ly * Math.cos(a)
      };
    }

    hitRadius() {
      return 30;
    }

    consumeHit() {
      this.hitDone = true;
      this.pending = false;
    }

    draw(ctx) {
      if (!this.visible) return;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.shadowColor = 'rgba(0,0,0,0.28)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      if (this.swing > 0.3) {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.rotate(-0.55);
        drawShape(ctx);
        ctx.restore();
      }
      drawShape(ctx);
      ctx.restore();

      if (this.swing <= 0.78 && this.swing >= 0.34) {
        const p = this.hitPoint();
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = '#fff4d8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.hitRadius(), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  window.Swatter = Swatter;
})();
