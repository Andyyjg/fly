'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const { DEFAULTS, IPC, MODES } = require('../shared/constants');

const allowed = new Set(Object.values(IPC));
const role = new URLSearchParams(window.location.search).get('role') || 'overlay';

function safe(channel) {
  if (!allowed.has(channel)) throw new Error('[DeskFlies] unknown IPC channel: ' + channel);
  return channel;
}

contextBridge.exposeInMainWorld('flyAPI', {
  role,
  C: Object.assign({}, DEFAULTS),
  IPC: Object.assign({}, IPC),
  MODES: Object.assign({}, MODES),
  on(channel, callback) {
    const ch = safe(channel);
    const listener = (_event, ...args) => callback(...args);
    ipcRenderer.on(ch, listener);
    return () => ipcRenderer.removeListener(ch, listener);
  },
  send(channel, payload) {
    ipcRenderer.send(safe(channel), payload === undefined ? {} : payload);
  }
});
