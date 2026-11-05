'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { DEFAULTS } = require('../shared/constants');

class Store {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'desk-flies.json');
    this.data = this.load();
  }

  load() {
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return Object.assign({}, DEFAULTS, saved);
    } catch (err) {
      return Object.assign({}, DEFAULTS);
    }
  }

  all() {
    return Object.assign({}, this.data);
  }

  get(key) {
    return this.data[key];
  }

  set(patch) {
    this.data = Object.assign({}, this.data, patch);
    this.save();
    return this.all();
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[DeskFlies] save config failed:', err);
    }
  }
}

module.exports = { Store };
