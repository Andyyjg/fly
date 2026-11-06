'use strict';

const path = require('path');
const { BrowserWindow, screen } = require('electron');
const { IPC, MODES } = require('../shared/constants');

const OVERLAY_HTML = path.join(__dirname, '..', 'renderer', 'overlay', 'index.html');
const PANEL_HTML = path.join(__dirname, '..', 'renderer', 'panel', 'index.html');
const PRELOAD = path.join(__dirname, 'preload.js');

function unionBounds(displays) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const d of displays) {
    const b = d.bounds;
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width);
    y1 = Math.max(y1, b.y + b.height);
  }
  if (!isFinite(x0)) {
    const b = screen.getPrimaryDisplay().bounds;
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

class WindowManager {
  constructor(store) {
    this.store = store;
    this.overlay = null;
    this.overlayReady = false;
    this.pendingOverlayMessages = [];
    this.panel = null;
    this.mode = MODES.WATCH;
    this.origin = { x: 0, y: 0 };
    this.bounds = { x: 0, y: 0, width: 0, height: 0 };
    this.displays = [];
    this.lastAlive = 0;
    this.quitting = false;
    this.rebuildTimer = null;
  }

  get level() {
    return process.platform === 'win32' ? 'screen-saver' : 'floating';
  }

  get activeDisplays() {
    const all = screen.getAllDisplays();
    if (this.store.get('allDisplays')) return all;
    const primary = screen.getPrimaryDisplay();
    return [primary || all[0]];
  }

  displayData() {
    return {
      origin: this.origin,
      bounds: this.bounds,
      displays: this.displays.map((d) => ({
        x: d.bounds.x,
        y: d.bounds.y,
        width: d.bounds.width,
        height: d.bounds.height
      }))
    };
  }

  sendTo(win, channel, payload) {
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, payload === undefined ? {} : payload);
    }
  }

  broadcast(channel, payload) {
    if (this.overlayReady) this.sendTo(this.overlay, channel, payload);
    this.sendTo(this.panel, channel, payload);
  }

  toOverlay(channel, payload) {
    if (!this.overlay || this.overlay.isDestroyed()) return;
    if (!this.overlayReady) {
      this.pendingOverlayMessages.push({ channel, payload });
      return;
    }
    this.sendTo(this.overlay, channel, payload);
  }

  createOverlay(restoreCount) {
    if (this.overlay && !this.overlay.isDestroyed()) this.overlay.destroy();
    this.overlayReady = false;

    this.displays = this.activeDisplays;
    this.bounds = unionBounds(this.displays);
    this.origin = { x: this.bounds.x, y: this.bounds.y };

    const win = new BrowserWindow({
      x: this.bounds.x,
      y: this.bounds.y,
      width: Math.max(1, this.bounds.width),
      height: Math.max(1, this.bounds.height),
      transparent: true,
      backgroundColor: '#00000000',
      frame: false,
      hasShadow: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      enableLargerThanScreen: true,
      show: false,
      webPreferences: {
        preload: PRELOAD,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: false
      }
    });

    this.overlay = win;
    win.setAlwaysOnTop(true, this.level);
    win.setIgnoreMouseEvents(this.mode === MODES.WATCH, { forward: true });
    if (process.platform === 'darwin') {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    win.once('ready-to-show', () => win.showInactive());
    win.loadFile(OVERLAY_HTML, { query: { role: 'overlay' } });

    this.restoreCount = restoreCount || 0;
    return win;
  }

  rebuild(restoreCount) {
    clearTimeout(this.rebuildTimer);
    this.rebuildTimer = setTimeout(() => {
      if (this.quitting) return;
      this.createOverlay(restoreCount === undefined ? this.lastAlive : restoreCount);
    }, 250);
  }

  initOverlay() {
    if (!this.overlay || this.overlay.isDestroyed() || this.overlayReady) return;

    this.sendTo(this.overlay, IPC.CONFIG, this.store.all());
    this.sendTo(this.overlay, IPC.DISPLAYS, this.displayData());
    this.sendTo(this.overlay, IPC.MODE, this.mode);
    if (this.restoreCount) {
      this.sendTo(this.overlay, IPC.RELEASE, { count: this.restoreCount, instant: true });
      this.restoreCount = 0;
    }

    this.overlayReady = true;
    const pending = this.pendingOverlayMessages.splice(0);
    for (const message of pending) {
      this.sendTo(this.overlay, message.channel, message.payload);
    }
  }

  applyMode(mode) {
    this.mode = mode;
    if (this.overlay && !this.overlay.isDestroyed()) {
      this.overlay.setIgnoreMouseEvents(mode === MODES.WATCH, { forward: true });
    }
    this.broadcast(IPC.MODE, mode);
  }

  createPanel() {
    if (this.panel && !this.panel.isDestroyed()) return this.panel;
    const win = new BrowserWindow({
      width: 410,
      height: 690,
      minWidth: 380,
      resizable: false,
      minimizable: true,
      maximizable: false,
      fullscreenable: false,
      title: 'DeskFlies 控制台',
      show: false,
      backgroundColor: '#12141c',
      autoHideMenuBar: true,
      webPreferences: {
        preload: PRELOAD,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });
    win.setAlwaysOnTop(true, this.level);
    win.on('close', (event) => {
      if (!this.quitting) {
        event.preventDefault();
        win.hide();
      }
    });
    win.loadFile(PANEL_HTML, { query: { role: 'panel' } });
    this.panel = win;
    return win;
  }

  showPanel() {
    const win = this.createPanel();
    if (win.isVisible()) {
      win.focus();
    } else {
      win.show();
    }
    win.moveTop();
    win.focus();
  }

  hidePanel() {
    if (this.panel && !this.panel.isDestroyed()) this.panel.hide();
  }

  setPaused(paused) {
    this.broadcast(IPC.PAUSE, { paused });
  }

  prepareQuit() {
    this.quitting = true;
    clearTimeout(this.rebuildTimer);
  }
}

module.exports = { WindowManager };
