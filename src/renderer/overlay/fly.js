(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const FALLBACK = { x: 0, y: 0, width: 1280, height: 800 };

  function pickDisplay(displays) {
    return displays[Math.floor(Math.random() * displays.length)] || FALLBACK;
  }

  function randomPoint(displays, edgeBias) {
    const d = pickDisplay(displays);
    const m = 40;
    const w = Math.max(80, d.width - m * 2);
    const h = Math.max(80, d.height - m * 2);
    let x = d.x + m + Math.random() * w;
    let y = d.y + m + Math.random() * h;
    if (edgeBias && Math.random() < 0.55) {
      if (Math.random() < 0.5) x = Math.random() < 0.5 ? d.x + m : d.x + d.width - m;
      else y = Math.random() < 0.5 ? d.y + m : d.y + d.height - m;
    }
    return { x, y };
  }

  function findDisplay(displays, x, y) {
    const m = -12;
    for (const d of displays) {
      if (x >= d.x + m && x <= d.x + d.width - m &&
          y >= d.y + m && y <= d.y + d.height - m) return d;
    }
    return null;
  }

  class Fly {
    constructor(env, options) {
      const opts = options || {};
      this.done = false;
      this.alpha = 1;
      this.scale = 1;
      this.age = 0;
      this.seed = Math.random() * 1000;
      this.size = rand(0.82, 1.35);
      this.drawSize = 30 * this.size;
      this.speedFactor = rand(0.85, 1.25);
      this.wing = rand(0, 6);
      this.state = 'spawn';
      this.stateTimer = rand(0.55, 1.1);
      this.vx = 0;
      this.vy = 0;

      if (opts.fromEdge) {
        const d = pickDisplay(env.displays);
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { this.x = rand(d.x, d.x + d.width); this.y = d.y - 34; }
        else if (side === 1) { this.x = d.x + d.width + 34; this.y = rand(d.y, d.y + d.height); }
        else if (side === 2) { this.x = rand(d.x, d.x + d.width); this.y = d.y + d.height + 34; }
        else { this.x = d.x - 34; this.y = rand(d.y, d.y + d.height); }
        const t = randomPoint(env.displays, false);
        const a = Math.atan2(t.y - this.y, t.x - this.x);
        const speed = rand(190, 310);
        this.vx = Math.cos(a) * speed;
        this.vy = Math.sin(a) * speed;
        this.angle = a;
      } else {
        const p = randomPoint(env.displays, false);
        this.x = p.x;
        this.y = p.y;
        this.angle = rand(0, TAU);
        const a = this.angle;
        this.vx = Math.cos(a) * 90;
        this.vy = Math.sin(a) * 90;
      }
      this.target = randomPoint(env.displays, false);
    }

    get alive() {
      return !this.done && this.state !== 'dead' && this.state !== 'vanish' && this.state !== 'recall';
    }

    pickBehavior(env) {
      const r = Math.random();
      if (r < 0.27) {
        this.state = 'land';
        this.stateTimer = rand(1.8, 6);
      } else if (r < 0.52) {
        this.state = 'hover';
        this.stateTimer = rand(0.5, 1.9);
      } else {
        this.state = 'cruise';
        this.stateTimer = rand(0.7, 2.3);
        this.target = randomPoint(env.displays, Math.random() < 0.45);
        if (Math.random() < 0.22) {
          const a = rand(0, TAU);
          const burst = rand(130, 270);
          this.vx += Math.cos(a) * burst;
          this.vy += Math.sin(a) * burst;
        }
      }
    }

    startFlee(dx, dy, dist, speedScale) {
      this.state = 'flee';
      this.stateTimer = rand(0.55, 0.95);
      const a = Math.atan2(dy, dx) + rand(-0.55, 0.55);
      const speed = rand(330, 500) * speedScale;
      this.vx = Math.cos(a) * speed;
      this.vy = Math.sin(a) * speed;
    }

    keepInside(env) {
      if (this.state === 'spawn') return;
      if (findDisplay(env.displays, this.x, this.y)) return;
      let best = null;
      let bestDist = Infinity;
      for (const d of env.displays) {
        const cx = Math.max(d.x, Math.min(this.x, d.x + d.width));
        const cy = Math.max(d.y, Math.min(this.y, d.y + d.height));
        const dist = Math.hypot(this.x - cx, this.y - cy);
        if (dist < bestDist) { bestDist = dist; best = d; }
      }
      if (!best) return;
      this.x = Math.max(best.x + 8, Math.min(this.x, best.x + best.width - 8));
      this.y = Math.max(best.y + 8, Math.min(this.y, best.y + best.height - 8));
      this.vx *= -0.6;
      this.vy *= -0.6;
      this.stateTimer = 0;
    }

    update(dt, env) {
      if (this.done) return;
      this.age += dt;
      const cfg = env.config;
      const speedScale = Math.max(0.2, cfg.speed || 1);

      if (this.state === 'land') this.wing += dt * 8;
      else this.wing += dt * 30;

      if (this.state === 'dead') {
        this.vy += 950 * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.angle += this.spin * dt;
        this.deadTimer -= dt;
        this.alpha = Math.max(0, this.deadTimer / 0.9);
        this.scale = 0.75 + 0.25 * this.alpha;
        if (this.deadTimer <= 0) this.done = true;
        return;
      }

      if (this.state === 'vanish') {
        this.fade -= dt;
        this.alpha = Math.max(0, this.fade / 0.3);
        this.scale = 0.55 + 0.45 * this.alpha;
        if (this.fade <= 0) this.done = true;
        return;
      }

      if (this.state === 'recall') {
        const dx = this.recallTarget.x - this.x;
        const dy = this.recallTarget.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        this.vx += (dx / dist) * 900 * dt;
        this.vy += (dy / dist) * 900 * dt;
        this.vx *= Math.max(0, 1 - 1.2 * dt);
        this.vy *= Math.max(0, 1 - 1.2 * dt);
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.angle = Math.atan2(this.vy, this.vx);
        this.recallTimer -= dt;
        this.alpha = Math.max(0, this.recallTimer / 1.5);
        this.scale = Math.max(0.05, this.alpha);
        if (this.recallTimer <= 0 || dist < 26) this.done = true;
        return;
      }

      if (env.mouse.inside && cfg.panicRadius > 0 && this.state !== 'flee') {
        const dx = this.x - env.mouse.x;
        const dy = this.y - env.mouse.y;
        const d2 = dx * dx + dy * dy;
        const r = cfg.panicRadius * (0.8 + this.size * 0.3);
        if (d2 < r * r) this.startFlee(dx, dy, Math.sqrt(d2) || 1, speedScale);
      }

      this.stateTimer -= dt;
      switch (this.state) {
        case 'spawn': {
          const damp = Math.max(0, 1 - 0.5 * dt);
          this.vx *= damp;
          this.vy *= damp;
          break;
        }
        case 'cruise': {
          const dx = this.target.x - this.x;
          const dy = this.target.y - this.y;
          const dist = Math.hypot(dx, dy) || 1;
          const acc = 270 * speedScale;
          this.vx += ((dx / dist) * acc + Math.sin(this.age * 14 + this.seed) * 115) * dt;
          this.vy += ((dy / dist) * acc + Math.cos(this.age * 12 + this.seed) * 115) * dt;
          if (dist < 26) this.stateTimer = 0;
          break;
        }
        case 'hover': {
          this.vx += (Math.sin(this.age * 7 + this.seed) * 65 - this.vx) * Math.min(1, dt * 4);
          this.vy += (Math.cos(this.age * 6 + this.seed) * 58 - this.vy) * Math.min(1, dt * 4);
          break;
        }
        case 'land': {
          const damp = Math.max(0, 1 - 8 * dt);
          this.vx *= damp;
          this.vy *= damp;
          break;
        }
        case 'flee': {
          this.vx += Math.sin(this.age * 26 + this.seed) * 180 * dt;
          this.vy += Math.cos(this.age * 23 + this.seed) * 180 * dt;
          break;
        }
        default:
          break;
      }

      let damp = Math.max(0, 1 - (this.state === 'flee' ? 0.7 : 1.1) * dt);
      this.vx *= damp;
      this.vy *= damp;
      const maxSpeed = 230 * speedScale * this.speedFactor;
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > maxSpeed) {
        this.vx *= maxSpeed / speed;
        this.vy *= maxSpeed / speed;
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.keepInside(env);

      if (speed > 18) {
        const targetAngle = Math.atan2(this.vy, this.vx);
        let delta = targetAngle - this.angle;
        while (delta > Math.PI) delta -= TAU;
        while (delta < -Math.PI) delta += TAU;
        this.angle += delta * Math.min(1, dt * 9);
      }

      if (this.stateTimer <= 0) {
        if (this.state === 'flee') {
          this.state = 'cruise';
          this.stateTimer = rand(0.6, 1.6);
          this.target = randomPoint(env.displays, false);
        } else {
          this.pickBehavior(env);
        }
      }
    }

    hitTest(x, y, radius) {
      if (!this.alive) return false;
      return Math.hypot(this.x - x, this.y - y) < radius + this.drawSize * 0.3;
    }

    kill(impactX, impactY) {
      if (!this.alive) return false;
      this.state = 'dead';
      this.deadTimer = 0.9;
      this.spin = rand(-16, 16);
      this.vx = impactX * 0.25 + rand(-70, 70);
      this.vy = Math.abs(impactY) * 0.2 + rand(70, 170);
      return true;
    }

    recall(target) {
      if (!this.alive) return false;
      this.state = 'recall';
      this.recallTarget = target;
      this.recallTimer = 1.5;
      return true;
    }

    vanish() {
      if (this.done) return;
      this.state = 'vanish';
      this.fade = 0.3;
    }

    draw(ctx, sprites) {
      if (this.done) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, this.alpha));

      if (this.state !== 'dead' && this.state !== 'recall') {
        ctx.save();
        ctx.translate(this.x + 5 * this.scale, this.y + 10 * this.scale);
        ctx.scale(1, 0.42);
        ctx.fillStyle = 'rgba(0,0,0,0.13)';
        ctx.beginPath();
        ctx.arc(0, 0, this.drawSize * 0.42, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.scale(this.scale, this.scale);
      const frame = sprites.frame(this.state === 'land', this.wing);
      const s = this.drawSize;
      ctx.drawImage(frame, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }

  window.Fly = Fly;
  window.FlyUtil = { randomPoint, pickDisplay };
})();
