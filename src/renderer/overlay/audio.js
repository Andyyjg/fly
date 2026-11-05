(function () {
  'use strict';

  class FlyAudio {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this.buzzNodes = null;
      this.buzzWanted = false;
    }

    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { this.ctx = new AC(); } catch (err) { return null; }
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    }

    setEnabled(on) {
      this.enabled = !!on;
      if (!this.enabled) this.stopBuzz();
    }

    stopBuzz() {
      const nodes = this.buzzNodes;
      this.buzzNodes = null;
      if (!nodes) return;
      try {
        nodes.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
        setTimeout(() => {
          try { nodes.a.stop(); nodes.b.stop(); } catch (err) { /* already stopped */ }
        }, 250);
      } catch (err) { /* ignore */ }
    }

    setBuzz(on, count) {
      this.buzzWanted = !!on && this.enabled && count > 0;
      if (!this.buzzWanted) { this.stopBuzz(); return; }
      if (this.buzzNodes) {
        const target = Math.min(0.012, 0.0015 + count * 0.00018);
        this.buzzNodes.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
        return;
      }
      if (!this.ctx || this.ctx.state !== 'running') return;
      const c = this.ctx;
      const a = c.createOscillator();
      const b = c.createOscillator();
      const filter = c.createBiquadFilter();
      const gain = c.createGain();
      a.type = 'sawtooth';
      b.type = 'sawtooth';
      a.frequency.value = 108;
      b.frequency.value = 116;
      filter.type = 'lowpass';
      filter.frequency.value = 380;
      gain.gain.value = 0.0001;
      a.connect(filter);
      b.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);
      a.start();
      b.start();
      gain.gain.setTargetAtTime(Math.min(0.012, 0.0015 + count * 0.00018), c.currentTime, 0.4);
      this.buzzNodes = { a, b, gain, filter };
    }

    swat(hits) {
      if (!this.enabled) return;
      const c = this.ensure();
      if (!c) return;
      const now = c.currentTime;
      const length = Math.floor(c.sampleRate * 0.1);
      const buffer = c.createBuffer(1, length, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.2);
      }
      const src = c.createBufferSource();
      src.buffer = buffer;
      const band = c.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1500 + Math.min(4, hits) * 220;
      band.Q.value = 0.8;
      const gain = c.createGain();
      gain.gain.setValueAtTime(hits > 0 ? 0.42 : 0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      src.connect(band);
      band.connect(gain);
      gain.connect(c.destination);
      src.start(now);
      src.stop(now + 0.12);

      const thump = c.createOscillator();
      const tg = c.createGain();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(160, now);
      thump.frequency.exponentialRampToValueAtTime(55, now + 0.1);
      tg.gain.setValueAtTime(0.22, now);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      thump.connect(tg);
      tg.connect(c.destination);
      thump.start(now);
      thump.stop(now + 0.13);
    }

    recall() {
      if (!this.enabled) return;
      const c = this.ensure();
      if (!c) return;
      const now = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(1150, now + 0.24);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.1, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  }

  window.FlyAudio = FlyAudio;
})();
