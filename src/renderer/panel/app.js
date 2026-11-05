(function () {
  'use strict';

  const api = window.flyAPI;
  const IPC = api.IPC;
  const MODES = api.MODES;
  const $ = (id) => document.getElementById(id);
  let initialized = false;
  let shortcutsRendered = false;

  function pretty(accelerator) {
    return accelerator
      ? accelerator.replace('CommandOrControl', 'Ctrl/⌘').replace(/\+/g, ' + ')
      : '未注册';
  }

  function fillShortcuts(shortcuts) {
    const rows = [
      [$('shortcutRow1'), [['切换模式', shortcuts.toggle], ['打开控制台', shortcuts.panel]]],
      [$('shortcutRow2'), [['释放苍蝇', shortcuts.release], ['全部回收', shortcuts.clear]]]
    ];
    for (const [row, items] of rows) {
      row.textContent = '';
      for (const [label, accelerator] of items) {
        const kbd = document.createElement('kbd');
        kbd.textContent = pretty(accelerator);
        row.appendChild(kbd);
        const text = document.createElement('span');
        text.textContent = ' ' + label + '    ';
        row.appendChild(text);
      }
    }
  }

  function paintRange(el) {
    const min = Number(el.min);
    const max = Number(el.max);
    const pct = ((Number(el.value) - min) / (max - min)) * 100;
    el.style.setProperty('--fill', pct + '%');
  }

  function bindRange(el, output, format, key, transform) {
    const sync = () => {
      paintRange(el);
      output.textContent = format(Number(el.value));
    };
    el.addEventListener('input', () => {
      sync();
      api.send(IPC.UI_CONFIG, { [key]: transform ? transform(Number(el.value)) : Number(el.value) });
    });
    sync();
    return sync;
  }

  function bindToggle(el, key) {
    el.addEventListener('change', () => api.send(IPC.UI_CONFIG, { [key]: el.checked }));
  }

  const syncRelease = bindRange($('releaseRange'), $('releaseVal'), (v) => v + ' 只', 'releaseCount');
  const syncRecall = bindRange($('recallRange'), $('recallVal'), (v) => v + ' 只', 'recallCount');
  bindRange($('panicRange'), $('panicVal'), (v) => v === 0 ? '不怕人' : v + ' px', 'panicRadius');
  bindRange($('speedRange'), $('speedVal'), (v) => v.toFixed(1) + '×', 'speed');
  bindToggle($('soundChk'), 'sound');
  bindToggle($('buzzChk'), 'buzz');
  bindToggle($('breedChk'), 'autoBreed');
  bindToggle($('displaysChk'), 'allDisplays');
  bindToggle($('autoStartChk'), 'autoStart');

  function updateReleaseLabel() {
    $('releaseBtn').textContent = '释放 ' + $('releaseRange').value + ' 只苍蝇';
    $('recallBtn').textContent = '回收 ' + $('recallRange').value + ' 只';
  }
  $('releaseRange').addEventListener('input', updateReleaseLabel);
  $('recallRange').addEventListener('input', updateReleaseLabel);
  updateReleaseLabel();

  $('releaseBtn').addEventListener('click', () => {
    api.send(IPC.UI_RELEASE, { count: Number($('releaseRange').value) });
  });
  document.querySelectorAll('[data-release]').forEach((btn) => {
    btn.addEventListener('click', () => {
      api.send(IPC.UI_RELEASE, { count: Number(btn.dataset.release) });
    });
  });
  $('recallBtn').addEventListener('click', () => {
    api.send(IPC.UI_RECALL, { count: Number($('recallRange').value) });
  });
  $('clearBtn').addEventListener('click', () => api.send(IPC.UI_CLEAR, {}));
  $('hideBtn').addEventListener('click', () => api.send(IPC.UI_HIDE, {}));

  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => api.send(IPC.UI_MODE, { mode: btn.dataset.mode }));
  });

  function applyConfig(config) {
    const c = Object.assign({}, api.C, config || {});
    $('releaseRange').value = c.releaseCount;
    $('recallRange').value = c.recallCount;
    $('panicRange').value = c.panicRadius;
    $('speedRange').value = c.speed;
    $('soundChk').checked = !!c.sound;
    $('buzzChk').checked = !!c.buzz;
    $('breedChk').checked = !!c.autoBreed;
    $('displaysChk').checked = !!c.allDisplays;
    $('autoStartChk').checked = !!c.autoStart;
    syncRelease();
    syncRecall();
    paintRange($('panicRange'));
    paintRange($('speedRange'));
    $('panicVal').textContent = Number(c.panicRadius) === 0 ? '不怕人' : Number(c.panicRadius) + ' px';
    $('speedVal').textContent = Number(c.speed).toFixed(1) + '×';
    updateReleaseLabel();
  }

  api.on(IPC.STATE, (s) => {
    if (!s) return;
    $('aliveVal').textContent = s.alive || 0;
    $('killedVal').textContent = s.killed || 0;
    $('comboVal').textContent = s.combo || 0;
    $('maxComboVal').textContent = s.maxCombo || 0;
    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === s.mode);
    });
    if (!initialized) {
      initialized = true;
      applyConfig(s.config);
    }
    if (!shortcutsRendered && s.shortcuts) {
      shortcutsRendered = true;
      fillShortcuts(s.shortcuts);
    }
  });

  api.send(IPC.READY, { role: api.role });
  api.send(IPC.UI_STATE, {});
})();
