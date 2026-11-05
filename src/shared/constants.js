(function (root) {
  'use strict';

  const DEFAULTS = {
    releaseCount: 5,
    recallCount: 5,
    maxFlies: 200,
    panicRadius: 110,
    speed: 1,
    sound: true,
    buzz: false,
    autoBreed: false,
    allDisplays: true,
    autoStart: false
  };

  const IPC = {
    READY: 'app:ready',
    CONFIG: 'app:config',
    DISPLAYS: 'app:displays',
    PAUSE: 'app:pause',
    RELEASE: 'cmd:release',
    RECALL: 'cmd:recall',
    CLEAR: 'cmd:clear',
    MODE: 'cmd:mode',
    STATS: 'app:stats',
    STATE: 'app:state',
    UI_RELEASE: 'ui:release',
    UI_RECALL: 'ui:recall',
    UI_CLEAR: 'ui:clear',
    UI_MODE: 'ui:mode',
    UI_CONFIG: 'ui:config',
    UI_STATE: 'ui:getState',
    UI_PANEL: 'ui:panel',
    UI_HIDE: 'ui:hide'
  };

  const MODES = { WATCH: 'watch', HUNT: 'hunt' };

  const api = { DEFAULTS, IPC, MODES };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.FlyConst = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
