'use strict';

const {
  app,
  globalShortcut,
  ipcMain,
  powerMonitor,
  screen
} = require('electron');
const { Store } = require('./store');
const { WindowManager } = require('./windows');
const { AppTray } = require('./tray');
const { DEFAULTS, IPC, MODES } = require('../shared/constants');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  const store = new Store();
  const windows = new WindowManager(store);
  const state = {
    alive: 0,
    killed: 0,
    combo: 0,
    maxCombo: 0,
    mode: MODES.WATCH,
    paused: false,
    shortcuts: {}
  };
  let tray = null;
  let lastTraySignature = '';

  function pushState() {
    const config = store.all();
    const payload = Object.assign({}, state, { config });
    windows.broadcast(IPC.STATE, payload);
    const signature = [state.alive, state.killed, state.mode, JSON.stringify(config)].join('|');
    if (tray && signature !== lastTraySignature) {
      lastTraySignature = signature;
      tray.refresh(state, config);
    }
  }

  function release(count) {
    const n = Math.max(0, Math.min(500, Math.round(Number(count) || 0)));
    if (n > 0) windows.toOverlay(IPC.RELEASE, { count: n });
  }

  function recall(count) {
    const n = Math.max(0, Math.min(500, Math.round(Number(count) || 0)));
    if (n > 0) windows.toOverlay(IPC.RECALL, { count: n });
  }

  function clear() {
    windows.toOverlay(IPC.CLEAR, {});
    setMode(MODES.WATCH);
  }

  function setMode(mode) {
    const next = mode === MODES.HUNT ? MODES.HUNT : MODES.WATCH;
    state.mode = next;
    windows.applyMode(next);
    pushState();
  }

  function toggleMode() {
    setMode(state.mode === MODES.HUNT ? MODES.WATCH : MODES.HUNT);
  }

  function updateConfig(patch) {
    const next = {};
    for (const key of Object.keys(DEFAULTS)) {
      if (!(key in patch)) continue;
      const value = patch[key];
      if (typeof DEFAULTS[key] === 'boolean') next[key] = !!value;
      else if (typeof DEFAULTS[key] === 'number') next[key] = Number(value);
      else next[key] = value;
    }
    const before = store.all();
    const after = store.set(next);

    if ('autoStart' in next) {
      app.setLoginItemSettings({
        openAtLogin: !!after.autoStart,
        openAsHidden: true,
        args: ['--hidden']
      });
    }
    if ('allDisplays' in next && next.allDisplays !== before.allDisplays) {
      windows.rebuild(state.alive);
    }
    windows.toOverlay(IPC.CONFIG, after);
    pushState();
  }

  function registerShortcuts() {
    const groups = [
      {
        name: 'toggle',
        handler: () => toggleMode(),
        candidates: ['CommandOrControl+Alt+F', 'CommandOrControl+Alt+Shift+F', 'Alt+Shift+F']
      },
      {
        name: 'panel',
        handler: () => windows.showPanel(),
        candidates: ['CommandOrControl+Alt+D', 'CommandOrControl+Alt+Shift+D']
      },
      {
        name: 'release',
        handler: () => release(store.get('releaseCount')),
        candidates: ['CommandOrControl+Alt+R', 'CommandOrControl+Alt+Shift+R', 'Alt+Shift+R']
      },
      {
        name: 'clear',
        handler: () => clear(),
        candidates: ['CommandOrControl+Alt+Shift+X', 'CommandOrControl+Alt+Shift+F', 'Alt+Shift+X']
      }
    ];
    for (const group of groups) {
      let registered = null;
      for (const accelerator of group.candidates) {
        if (globalShortcut.register(accelerator, group.handler)) {
          registered = accelerator;
          break;
        }
      }
      state.shortcuts[group.name] = registered;
      if (!registered) console.warn('[DeskFlies] no available shortcut for:', group.name);
    }
  }

  function bindIpc() {
    ipcMain.on(IPC.READY, (_event, payload) => {
      if (payload && payload.role === 'panel') {
        pushState();
      } else {
        windows.initOverlay();
      }
    });

    ipcMain.on(IPC.STATS, (_event, payload) => {
      state.alive = Math.max(0, Number(payload.alive) || 0);
      state.killed = Math.max(0, Number(payload.killed) || 0);
      state.combo = Math.max(0, Number(payload.combo) || 0);
      state.maxCombo = Math.max(state.maxCombo, state.combo, Math.max(0, Number(payload.maxCombo) || 0));
      windows.lastAlive = state.alive;
      pushState();
    });

    ipcMain.on(IPC.UI_RELEASE, (_event, p) => release(p && p.count));
    ipcMain.on(IPC.UI_RECALL, (_event, p) => recall(p && p.count));
    ipcMain.on(IPC.UI_CLEAR, () => clear());
    ipcMain.on(IPC.UI_MODE, (_event, p) => setMode(p && p.mode));
    ipcMain.on(IPC.UI_CONFIG, (_event, p) => updateConfig(p || {}));
    ipcMain.on(IPC.UI_STATE, () => pushState());
    ipcMain.on(IPC.UI_PANEL, () => windows.showPanel());
    ipcMain.on(IPC.UI_HIDE, () => windows.hidePanel());
  }

  function boot() {
    bindIpc();
    windows.createOverlay(store.get('releaseCount'));
    windows.createPanel();

    tray = new AppTray({
      openPanel: () => windows.showPanel(),
      release,
      recall,
      clear,
      toggleMode,
      config: updateConfig,
      quit: () => app.quit()
    });

    registerShortcuts();
    app.setLoginItemSettings({
      openAtLogin: !!store.get('autoStart'),
      openAsHidden: true,
      args: ['--hidden']
    });

    const onDisplaysChanged = () => windows.rebuild(state.alive);
    screen.on('display-added', onDisplaysChanged);
    screen.on('display-removed', onDisplaysChanged);
    screen.on('display-metrics-changed', onDisplaysChanged);

    powerMonitor.on('suspend', () => windows.setPaused(true));
    powerMonitor.on('lock-screen', () => windows.setPaused(true));
    powerMonitor.on('resume', () => windows.setPaused(false));
    powerMonitor.on('unlock-screen', () => windows.setPaused(false));

    if (!process.argv.includes('--hidden')) windows.showPanel();
    pushState();
  }

  app.on('second-instance', () => windows.showPanel());
  app.on('activate', () => windows.showPanel());
  app.on('window-all-closed', () => { /* tray app: keep running */ });
  app.on('will-quit', () => {
    windows.prepareQuit();
    globalShortcut.unregisterAll();
    if (tray) tray.destroy();
  });

  app.whenReady().then(boot).catch((err) => {
    console.error('[DeskFlies] boot failed:', err);
  });
}
