'use strict';

const { Tray, Menu } = require('electron');
const { trayIcon } = require('./icon');
const { MODES } = require('../shared/constants');

class AppTray {
  constructor(actions) {
    this.actions = actions;
    this.tray = new Tray(trayIcon());
    this.tray.setToolTip('DeskFlies — 桌面苍蝇');
    this.refresh();
    if (process.platform !== 'darwin') {
      this.tray.on('click', () => this.actions.openPanel());
      this.tray.on('double-click', () => this.actions.openPanel());
    }
  }

  refresh(state, config) {
    const s = state || {};
    const c = config || {};
    const a = this.actions;
    const release = c.releaseCount || 5;
    const recall = c.recallCount || 5;
    const hunting = s.mode === MODES.HUNT;

    const menu = Menu.buildFromTemplate([
      { label: 'DeskFlies  桌面苍蝇', enabled: false },
      { type: 'separator' },
      { label: `现在有 ${s.alive || 0} 只苍蝇 · 已拍死 ${s.killed || 0} 只`, enabled: false },
      { type: 'separator' },
      { label: '打开控制台', click: () => a.openPanel() },
      { label: `释放 ${release} 只`, click: () => a.release(release) },
      { label: '释放 20 只', click: () => a.release(20) },
      { label: `回收 ${recall} 只`, click: () => a.recall(recall) },
      { label: '全部回收', click: () => a.clear() },
      { type: 'separator' },
      {
        label: hunting ? '切换回观赏模式' : '进入捕蝇模式（挥拍）',
        click: () => a.toggleMode()
      },
      {
        label: '音效',
        type: 'checkbox',
        checked: !!c.sound,
        click: () => a.config({ sound: !c.sound })
      },
      {
        label: '开机自动启动',
        type: 'checkbox',
        checked: !!c.autoStart,
        click: () => a.config({ autoStart: !c.autoStart })
      },
      { type: 'separator' },
      { label: '退出 DeskFlies', click: () => a.quit() }
    ]);
    this.tray.setContextMenu(menu);
    return menu;
  }

  destroy() {
    if (this.tray && !this.tray.isDestroyed()) this.tray.destroy();
  }
}

module.exports = { AppTray };
