(function () {
  'use strict';

  const api = window.flyAPI;
  const IPC = api.IPC;
  const MODES = api.MODES;
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d', { alpha: true });
  const sprites = window.FlySprites;
  const Fly = window.Fly;
  const swatter = new window.Swatter();
  const audio = new window.FlyAudio();

  const flies = [];
  const particles = [];
  const floats = [];
  const rand = (a, b) => a + Math.random() * (b - a);
  const PARTICLE_COLORS = ['#3a332c', '#6b5b48', '#b45b3a', '#d8c49c', '#8a8f86'];

  const env = {
    config: Object.assign({}, api.C),
    displays: [{ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }],
    origin: { x: 0, y: 0 },
    mouse: { x: -1e5, y: -1e5, inside: false }
  };

  let dpr = 1;
  let mode = MODES.WATCH;
  let paused = false;
  let killed = 0;
  let combo = 0;
  let maxCombo = 0;
  let comboTimer = 0;
  let breedTimer = 0;
  let lastTs = 0;
  let statsTimer = 0;

  function aliveCount() {
    let n = 0;
    for (const f of flies) if (f.alive) n++;
    return n;
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
    canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }

  function recallTarget() {
    const d = env.displays[0] || { x: 0, y: 0, width: 1280, height: 800 };
    return { x: d.x + d.width - 54, y: d.y + d.height - 54 };
  }

  function spawnParticles(x, y, amount) {
    for (let i = 0; i < amount; i++) {
      particles.push({
        x, y,
        vx: rand(-170, 170),
        vy: rand(-190, 60),
        life: rand(0.3, 0.65),
        age: 0,
        size: rand(1.4, 3.4),
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)]
      });
    }
  }

  function doSwat() {
    const p = swatter.hitPoint();
    const radius = swatter.hitRadius();
    let hits = 0;
    for (const f of flies) {
      if (!f.hitTest(p.x, p.y, radius)) continue;
      if (f.kill((f.x - p.x) * 8, -160)) {
        hits++;
        spawnParticles(f.x, f.y, 9);
      }
    }
    audio.swat(hits);
    if (hits === 0) return;
    killed += hits;
    combo += hits;
    maxCombo = Math.max(maxCombo, combo);
    comboTimer = 2.6;
    floats.push({
      x: p.x,
      y: p.y - 24,
      text: combo > 1 ? `+${hits}   ×${combo} 连击` : '啪！',
      age: 0,
      life: 1
    });
  }

  function update(dt) {
    swatter.update(dt, env.mouse);
    if (swatter.hitActive) {
      swatter.consumeHit();
      doSwat();
    }

    for (const f of flies) f.update(dt, env);
    for (let i = flies.length - 1; i >= 0; i--) {
      if (flies[i].done) flies.splice(i, 1);
    }

    for (const p of particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      p.vx *= 1 - 1.4 * dt;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].age >= particles[i].life) particles.splice(i, 1);
    }
    for (const t of floats) {
      t.age += dt;
      t.y -= 34 * dt;
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      if (floats[i].age >= floats[i].life) floats.splice(i, 1);
    }

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }

    if (env.config.autoBreed) {
      breedTimer += dt;
      if (breedTimer > 22) {
        breedTimer = 0;
        if (aliveCount() < env.config.maxFlies) flies.push(new Fly(env, { fromEdge: true }));
      }
    }
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, -env.origin.x * dpr, -env.origin.y * dpr);

    for (const f of flies) f.draw(ctx, sprites);

    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const t of floats) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t.age / t.life);
      ctx.font = 'bold 17px "Microsoft YaHei", "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#ffd98a';
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }

    if (mode === MODES.HUNT) swatter.draw(ctx);
  }

  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000 || 0));
    lastTs = ts;
    if (paused || document.hidden) return;
    update(dt);
    draw();
    statsTimer += dt;
    if (statsTimer >= 0.35) {
      statsTimer = 0;
      const alive = aliveCount();
      api.send(IPC.STATS, { alive, killed, combo, maxCombo });
      audio.setBuzz(!!env.config.buzz && !!env.config.sound, alive);
    }
  }

  function bindEvents() {
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', (event) => {
      env.mouse.x = event.clientX + env.origin.x;
      env.mouse.y = event.clientY + env.origin.y;
      env.mouse.inside = true;
    });
    window.addEventListener('mouseleave', () => { env.mouse.inside = false; });
    window.addEventListener('mousedown', (event) => {
      if (event.button !== 0 || mode !== MODES.HUNT) return;
      audio.ensure();
      swatter.press();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && mode === MODES.HUNT) {
        api.send(IPC.UI_MODE, { mode: MODES.WATCH });
      }
    });

    api.on(IPC.CONFIG, (config) => {
      env.config = Object.assign({}, api.C, config);
      audio.setEnabled(!!env.config.sound);
      if (!env.config.buzz) audio.setBuzz(false, 0);
    });

    api.on(IPC.DISPLAYS, (data) => {
      if (!data) return;
      env.origin = data.origin || env.origin;
      if (data.displays && data.displays.length) env.displays = data.displays;
      resize();
    });

    api.on(IPC.MODE, (next) => {
      mode = next === MODES.HUNT ? MODES.HUNT : MODES.WATCH;
      document.body.classList.toggle('hunt', mode === MODES.HUNT);
      if (mode === MODES.WATCH) {
        env.mouse.inside = false;
        swatter.pending = false;
      }
    });

    api.on(IPC.PAUSE, (payload) => { paused = !!(payload && payload.paused); });

    api.on(IPC.RELEASE, (payload) => {
      const requested = Math.max(0, Math.round(Number(payload && payload.count) || 0));
      const room = Math.max(0, Math.min(500, env.config.maxFlies) - aliveCount());
      const n = Math.min(requested, room);
      for (let i = 0; i < n; i++) flies.push(new Fly(env, { fromEdge: !payload.instant }));
    });

    api.on(IPC.RECALL, (payload) => {
      let left = Math.max(0, Math.round(Number(payload && payload.count) || 0));
      const target = recallTarget();
      let recalled = 0;
      for (const f of flies) {
        if (left <= 0) break;
        if (f.recall(target)) { left--; recalled++; }
      }
      if (recalled > 0) audio.recall();
    });

    api.on(IPC.CLEAR, () => {
      for (const f of flies) f.vanish();
      combo = 0;
      audio.setBuzz(false, 0);
    });
  }

  resize();
  bindEvents();
  api.send(IPC.READY, { role: api.role });
  requestAnimationFrame(frame);
})();
