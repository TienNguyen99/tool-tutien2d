(() => {
  'use strict';

  if (window.__tienloExtensionHook) return;
  const HOOK_VERSION = '1.3.49';
  window.__tienloExtensionHook = HOOK_VERSION;

  const HELPER_URL = 'http://127.0.0.1:8765/index.html';
  const HELPER_ORIGIN = 'http://127.0.0.1:8765';
  const HELPER_NAME = 'tienlo-companion';
  const DEFAULTS = {
    priority: 'Tự động', nearest: true, avoidBoss: true,
    stopLowHp: true, meditate: true, disconnect: true, antiStuck: true,
    hpThreshold: 30, spThreshold: 20, maxDistance: 260, skillSlots: [1, 2],
    retreatEnabled: true, retreatHpThreshold: 20, damageHpThreshold: 20,
    damageArmorThreshold: 35, retreatSeconds: 8, hitRunEnabled: true,
    kiteMilliseconds: 250, kiteDistance: 36, recoverHealth: true,
    recoverHpThreshold: 30, recoverHpResume: 85, recoverSafeRadius: 200,
    spResumeThreshold: 85, aiPlanner: true, reviveInPlace: false, visionDialogs: false
  };

  let helperWindow = null;
  let config = { ...DEFAULTS };
  let timers = [];
  let mode = 'off';
  let skillIndex = 0;
  let pendingChoice = null;
  let chienBangAttemptAt = 0;
  const learnedChoices = new Map();
  const choiceValues = new Map();
  const worldMaps = new Map();
  const mapMemorySignatures = new Map();
  const policy = window.__tienloPolicy || { priorities: {}, dialog: { exploreAfterMs: 6000,
    learningRate: .2, progressReward: 20, failureReward: -20 } };
  let kiteUntil = 0;
  let kiteRouteAt = 0;
  let kiteAttackAt = 0;
  let lastPosition = null;
  let lastMovedAt = Date.now();
  let lastMapId = '';
  let knownAlive = new Set();
  let meditating = false;
  let reviveState = {since:0,lastClick:0,attempts:0};
  let meditateAt = 0;
  let meditateRetryAt = 0;
  let recoveryState = { phase: 'idle', mapId: '', routeAt: 0, attemptAt: 0, attempts: 0, startedAt: 0, hp: null, progressAt: 0 };
  let lastQuestTarget = '';
  let lastQuestRouteAt = 0;
  let lastReportKey = '';
  let lastReportAt = 0;
  let lastDialogChoiceAt = 0;
  let dialogDecision = { signature: '', observedAt: 0, acted: new Set() };
  let defenseState = { mapId: '', hp: null, bp: null, enemy: null, until: 0 };
  let retreatState = { mapId: '', hp: null, bp: null, hits: [], until: 0, routeAt: 0 };
  const avoidedEnemies = new Map();
  let memoryCache = null;
  let encyclopediaKnowledgeCache = null;
  let questWatchdog = {
    key: '', signature: '', progressAt: 0, snapshotAt: 0,
    recoveries: 0, lastAnalysis: ''
  };
  let exploreState = { key: '', mapId: '', waypoints: [], index: 0, exhaustedAt: 0 };
  let zoneQuestState = {
    key: '', progress: '', lastProgressAt: 0, lastListAt: 0, listRequestedAt: 0,
    lastSwitchAt: 0, counts: [], attempted: new Set()
  };
  const stats = {
    startedAt: 0, kills: 0, startXp: 0, startStones: 0,
    xpGained: 0, stonesGained: 0, stuckCount: 0, seenOnline: false
  };

  const $ = selector => document.querySelector(selector);
  const text = selector => $(selector)?.textContent?.trim() || '';
  const safe = (fn, fallback = null) => {
    try {
      const value = fn();
      return value == null ? fallback : value;
    } catch {
      return fallback;
    }
  };
  const pair = (value, max, fallback) =>
    Number.isFinite(+value) && Number.isFinite(+max) && +max > 0
      ? `${Math.round(+value)} / ${Math.round(+max)}`
      : fallback;

  function installButton() {
    if ($('#tienlo-connect')) return;
    const button = document.createElement('button');
    button.id = 'tienlo-connect';
    button.type = 'button';
    button.textContent = '✦ Trợ Thủ';
    button.title = 'Kết nối Tiên Lộ Trợ Thủ';
    Object.assign(button.style, {
      position: 'fixed', right: '14px', bottom: '14px', zIndex: '2147483647',
      padding: '10px 14px', color: '#1b1208', font: '700 13px Segoe UI, sans-serif',
      border: '1px solid #f0d283', borderRadius: '5px', cursor: 'pointer',
      background: 'linear-gradient(#f0d27d,#b98235)', boxShadow: '0 5px 20px #0009'
    });
    button.addEventListener('click', connect);
    document.documentElement.appendChild(button);
  }

  function setButton(label, connected = false) {
    const button = $('#tienlo-connect');
    if (!button) return;
    button.textContent = label;
    button.style.background = connected
      ? 'linear-gradient(#8dd2ac,#4b8c6c)'
      : 'linear-gradient(#f0d27d,#b98235)';
  }

  function post(message) {
    if (helperWindow && !helperWindow.closed) helperWindow.postMessage(message, HELPER_ORIGIN);
    if (message.type === 'TIENLO_QUEST_FAILURE' && window.__tienloLocalRequest) {
      void window.__tienloLocalRequest('record', message.payload).catch(() => {
        // The companion queue remains a retry path when it is open.
        reportOnce('memory-server-unavailable', mode, 'CHƯA LƯU SERVER · bộ nhớ hiện vẫn ở phiên game', 10000);
      });
    }
  }

  function report(nextMode, message) {
    post({ type: 'TIENLO_AUTO_STATUS', mode: nextMode, message });
  }

  function reportOnce(key, nextMode, message, delay = 5000) {
    const now = Date.now();
    if (key === lastReportKey && now - lastReportAt < delay) return;
    lastReportKey = key;
    lastReportAt = now;
    report(nextMode, message);
  }

  function elapsed() {
    const seconds = stats.startedAt ? Math.max(0, Math.floor((Date.now() - stats.startedAt) / 1000)) : 0;
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function readHud() {
    return {
      name: text('#hud-name'), realm: text('#hud-realm'), stones: text('#hud-stones'),
      hp: text('#value-hp'), mp: text('#value-mp'), sp: text('#value-sp'),
      armor: text('#value-bp'), pos: text('#hud-pos'), fps: text('#hud-fps'),
      map: text('#hud-map'), questStage: text('#quest-stage-full'),
      objectives: [...document.querySelectorAll('#quest-objectives li')]
        .map(node => node.textContent.trim()).filter(Boolean),
      xpLabel: text('#xp-label'), xpPercent: $('#bar-xp')?.style?.width || ''
    };
  }

  function readState() {
    const hud = readHud();
    const P = window.PNTT || {};
    const world = P.SceneWorld || {};
    const player = world.player;
    const progress = P.Progress || {};
    const quest = P.Quest || {};
    const map = world.map?.data || {};
    const enemies = Array.isArray(world.enemies) ? world.enemies : [];
    const alive = enemies.filter(enemy => enemy && !enemy.dead && (+enemy.hp > 0 || enemy.hp == null));
    const current = safe(() => P.Targeting?.currentEnemy?.() || P.Targeting?.current?.());
    const realmDef = safe(() => P.realmById?.(progress.realmId));
    const exp = +progress.exp || 0;
    const expMax = +realmDef?.expMax || 0;
    const stones = +progress.stones || 0;
    const questPlan = safe(() => analyzeQuest());
    const target = current ? [
      current.name || current.def?.name || current.type || 'Mục tiêu',
      Number.isFinite(+current.hp) ? `${Math.max(0, Math.round(+current.hp))} HP` : ''
    ].filter(Boolean).join(' · ') : '';

    const metrics = window.__tienloMetrics?.read(progress, expMax);
    stats.seenOnline ||= !!P.Gateway?.connected;

    return {
      source: player ? `PNTT extension ${HOOK_VERSION}` : 'HUD dự phòng',
      hookVersion: HOOK_VERSION,
      name: player?.cfg?.name || hud.name,
      realm: realmDef?.name || player?.realm || hud.realm,
      stones: Number.isFinite(+progress.stones) ? String(progress.stones) : hud.stones,
      hp: pair(player?.hp, player?.hpMax, hud.hp),
      mp: pair(player?.mp, player?.mpMax, hud.mp),
      sp: pair(player?.mp, player?.mpMax, hud.sp),
      armor: pair(player?.bp, player?.bpMax, hud.armor),
      hpPercent: Number.isFinite(+player?.hp) && +player?.hpMax > 0 ? +player.hp / +player.hpMax * 100 : null,
      spPercent: Number.isFinite(+player?.mp) && +player?.mpMax > 0 ? +player.mp / +player.mpMax * 100 : null,
      pos: player ? `${Math.round(player.x)} , ${Math.round(player.y)}` : hud.pos,
      x: Number.isFinite(+player?.x) ? +player.x : null,
      y: Number.isFinite(+player?.y) ? +player.y : null,
      fps: hud.fps, map: map.name || hud.map, mapId: map.id || '',
      questId: quest.id || '', questStage: hud.questStage || quest.title || '',
      questStageIndex: Number.isFinite(+quest.stage) ? +quest.stage : null,
      objectives: hud.objectives,
      questPlan,
      xpLabel: hud.xpLabel || String(exp),
      xpPercent: expMax ? `${Math.min(100, Math.round(exp / expMax * 100))}%` : hud.xpPercent,
      playerState: player?.state || '', downed: !!player?.downed,
      autoOn: !!world.autoOn, online: !!P.Gateway?.connected,
      enemiesAlive: alive.length, target: target || 'Chưa khóa',
      targetDistance: current && player ? Math.round(Math.hypot(current.x - player.x, current.y - player.y)) : null,
      questWatchdog: {
        stalledSeconds: questWatchdog.progressAt
          ? Math.max(0, Math.floor((Date.now() - questWatchdog.progressAt) / 1000)) : 0,
        recoveries: questWatchdog.recoveries,
        analysis: questWatchdog.lastAnalysis
      },
      mode,
      session: {
        elapsed: elapsed(), kills: stats.kills, xpGained: stats.xpGained,
        stonesGained: stats.stonesGained, stuckCount: stats.stuckCount,
        ...metrics
      }
    };
  }

  function sendState() {
    // Optional bookkeeping must never prevent the connection heartbeat.
    safe(() => settleChoiceMemory());
    safe(() => saveWorldMaps());
    try {
      post({ type: 'TIENLO_LIVE_V3', payload: readState(), sentAt: Date.now() });
    } catch (error) {
      report('error', `Hook lỗi: ${error?.message || String(error)}`);
    }
  }

  const cloneSessionId = safe(() => {
    let id = sessionStorage.getItem('tienlo-clone-session');
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('tienlo-clone-session', id); }
    return id;
  }, `clone-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  let cloneSending = false;
  let cloneLastOnlineAt = 0;
  let cloneLinkInterrupted = false;
  let choiceMemoryLoaded = false;
  let observedQuestSignature = '';
  async function cloneHeartbeat() {
    if (cloneSending || !window.PNTT?.SceneWorld?.player) return;
    cloneSending = true;
    try {
      const data = readState();
      const signature = JSON.stringify([data.name,data.questStageIndex,data.objectives]);
      if (data.online && Number.isInteger(data.questStageIndex) && observedQuestSignature !== signature) {
        post({type:'TIENLO_QUEST_FAILURE',payload:{at:new Date().toISOString(),outcome:'success',
          reason:'quest_observed',dialog:'',character:data.name,version:HOOK_VERSION,
          quest:{stage:data.questStageIndex,title:data.questStage,objectives:data.objectives}}});
        observedQuestSignature = signature;
      }
      const { command } = await window.__tienloLocalRequest('heartbeat', { id: cloneSessionId, data });
      cloneLastOnlineAt = Date.now();
      if (cloneLinkInterrupted) {
        cloneLinkInterrupted = false;
        report(mode, 'Đã kết nối lại server quản lý clone');
      }
      if (command === 'stop') { cloneManaged = false; stop(); }
      else if (command === 'farm') { cloneManaged = true; start('farm', config); }
      if (!choiceMemoryLoaded) {
        try {
          const rows = await window.__tienloLocalRequest('memory', {});
          onMessage({ origin: HELPER_ORIGIN, data: { type: 'TIENLO_CHOICE_MEMORY', rows } });
          choiceMemoryLoaded = true;
        } catch { /* A missing memory API must not discard a farm/stop command. */ }
      }
    } catch (error) {
      if (mode === 'farm' && cloneManaged) {
        if (!cloneLinkInterrupted) {
          cloneLinkInterrupted = true;
          report('reconnecting', 'Server quản lý clone gián đoạn — đang tự kết nối lại');
        }
        // Keep retrying transient failures; never leave an unattended clone farming indefinitely.
        if (cloneLastOnlineAt && Date.now() - cloneLastOnlineAt > 30000)
          stop('safe', 'Mất server quản lý clone quá 30 giây — đã dừng an toàn');
      }
    } finally { cloneSending = false; }
  }
  let cloneManaged = false;
  setInterval(cloneHeartbeat, 2000);

  function configure(value) {
    const next = { ...DEFAULTS, ...(value || {}) };
    next.maxDistance = Math.max(60, Math.min(600, +next.maxDistance || DEFAULTS.maxDistance));
    next.hpThreshold = Math.max(1, Math.min(99, +next.hpThreshold || DEFAULTS.hpThreshold));
    next.spThreshold = Math.max(1, Math.min(99, +next.spThreshold || DEFAULTS.spThreshold));
    const limits = {retreatHpThreshold:[1,99],damageHpThreshold:[1,99],damageArmorThreshold:[1,99],
      retreatSeconds:[1,15],kiteMilliseconds:[100,600],kiteDistance:[12,60],recoverHpThreshold:[1,98],
      recoverHpResume:[2,100],recoverSafeRadius:[80,400],spResumeThreshold:[2,100]};
    for (const [key,[min,max]] of Object.entries(limits)) {
      const value = Number(next[key]);
      next[key] = Math.max(min,Math.min(max,Number.isFinite(value)?value:DEFAULTS[key]));
    }
    next.recoverHpResume = Math.max(next.recoverHpThreshold + 1, next.recoverHpResume);
    next.spResumeThreshold = Math.max(next.spThreshold + 1, next.spResumeThreshold);
    next.skillSlots = (Array.isArray(next.skillSlots) ? next.skillSlots : String(next.skillSlots || '').split(','))
      .map(Number).filter(slot => slot >= 1 && slot <= 8);
    config = next;
    const P = window.PNTT || {}, player = P.SceneWorld?.player;
    if (!next.hitRunEnabled && kiteUntil) {
      kiteUntil = 0;
      safe(() => player?.setPath?.([]));
    }
    if ((!next.recoverHealth && recoveryState.phase !== 'idle') ||
        (!next.meditate && (meditating === true || meditating === 'pending'))) {
      safe(() => P.Player?.stand?.(player));
      safe(() => player?.setPath?.([]));
      recoveryState.phase = 'idle'; meditating = false;
      setNativeAuto(mode === 'farm');
    }
  }

  function setNativeAuto(enabled) {
    const scene = window.PNTT?.SceneWorld;
    const input = window.PNTT?.Input;
    if (scene && input?.pressAutoToggle) {
      if (!!scene.autoOn !== enabled) input.pressAutoToggle();
      return;
    }
    const button = $('#btn-auto-touch') || $('#btn-auto');
    if (!button) return;
    const on = button.checked || button.getAttribute('aria-pressed') === 'true' || button.classList.contains('on');
    if (!!on !== enabled) button.click();
  }

  function clearTimers() {
    timers.forEach(clearInterval);
    timers = [];
  }

  function stop(nextMode = 'off', message = 'Đã thu công') {
    window.__tienloMetrics?.stop(window.PNTT?.Progress || {});
    clearTimers();
    setNativeAuto(false);
    const scene = window.PNTT?.SceneWorld;
    if (scene) scene.approach = null;
    if (meditating) safe(() => window.PNTT?.Player?.stand?.(scene?.player));
    safe(() => scene?.player?.setPath?.([]));
    kiteUntil = 0;
    retreatState.until = 0;
    mode = 'off';
    reviveState = {since:0,lastClick:0,attempts:0};
    meditating = false;
    recoveryState.phase = 'idle';
    report(nextMode, message);
    setButton('✦ Trợ Thủ', true);
  }

  function fold(value) {
    return String(value || '').replace(/[đĐ]/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[_-]+/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function memoryStore() {
    if (memoryCache) return memoryCache;
    memoryCache = safe(() => JSON.parse(localStorage.getItem('tienlo-quest-memory-v1') || '{}'), {}) || {};
    return memoryCache;
  }

  function encyclopediaKnowledge() {
    if (encyclopediaKnowledgeCache) return encyclopediaKnowledgeCache;
    encyclopediaKnowledgeCache = safe(() =>
      JSON.parse(localStorage.getItem('tienlo-encyclopedia-knowledge-v1') || 'null'), null);
    if (!encyclopediaKnowledgeCache || !Array.isArray(encyclopediaKnowledgeCache.entries))
      encyclopediaKnowledgeCache = { version: 1, updatedAt: 0, entries: [] };
    return encyclopediaKnowledgeCache;
  }

  function refreshEncyclopediaKnowledge(force = false) {
    const cached = encyclopediaKnowledge();
    if (!force && cached.entries.length && Date.now() - cached.updatedAt < 6 * 60 * 60 * 1000)
      return cached.entries.length;
    const rows = safe(() => window.PNTT?.Encyclopedia?.catalog?.(), []);
    if (!Array.isArray(rows) || !rows.length) return cached.entries.length;
    const entries = rows.map(row => ({
      id: String(row?.id || ''), kind: String(row?.kind || ''), name: String(row?.name || ''),
      categories: Array.isArray(row?.categories) ? row.categories.map(String).slice(0, 8) : [],
      description: String(row?.description || '').slice(0, 900),
      use: String(row?.use || '').slice(0, 700), recipe: String(row?.recipe || '').slice(0, 700),
      obtain: String(row?.obtain || '').slice(0, 900),
      tags: Array.isArray(row?.tags) ? row.tags.map(String).slice(0, 16) : [],
      stats: Array.isArray(row?.stats) ? row.stats.slice(0, 20) : []
    })).filter(row => row.id && row.name);
    encyclopediaKnowledgeCache = { version: 1, updatedAt: Date.now(), entries };
    safe(() => localStorage.setItem('tienlo-encyclopedia-knowledge-v1',
      JSON.stringify(encyclopediaKnowledgeCache)));
    return entries.length;
  }

  function knowledgeMatches(query, limit = 6) {
    refreshEncyclopediaKnowledge();
    const ignored = new Set(['nhiem', 'vu', 'dang', 'tieu', 'muc', 'nhat', 'danh', 'tuong',
      'tac', 'mot', 'tai', 'den', 'cua', 'cho', 'xong', 'dung', 'can']);
    const wanted = fold(query).split(' ').filter(token => token.length >= 3 && !ignored.has(token));
    if (!wanted.length) return [];
    return encyclopediaKnowledge().entries.map(entry => {
      const name = fold(entry.name);
      const body = fold([entry.name, entry.description, entry.use, entry.recipe, entry.obtain,
        ...(entry.tags || []), ...(entry.stats || []).flat()].join(' '));
      let score = wanted.reduce((sum, token) => sum + (name.includes(token) ? 8 : body.includes(token) ? 2 : 0), 0);
      if (fold(query).includes(name) && name.length >= 4) score += 30;
      return { entry, body, score };
    }).filter(row => row.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  }

  function knowledgeHint(objective) {
    const matches = knowledgeMatches(objective, 8);
    if (!matches.length) return null;
    const mapHits = new Map();
    const P = window.PNTT || {};
    const maps = Object.values(P.MapData || {}).filter(value => value?.id && value?.name);
    for (const match of matches) {
      for (const map of maps) {
        const name = fold(map.name);
        if (name.length >= 4 && match.body.includes(name))
          mapHits.set(map.id, (mapHits.get(map.id) || 0) + match.score);
      }
    }
    const mapId = [...mapHits].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const best = matches[0];
    const kind = fold([best.entry.kind, ...(best.entry.categories || [])].join(' '));
    const source = fold(best.entry.obtain);
    let action = '';
    if (/monster|boss|quai/.test(kind) || /ha |diet|danh bai|roi tu/.test(source)) action = 'attack';
    else if (/tuong tac|thu thap|hai |cau |gap |mo |nhan tai/.test(source)) action = 'interact';
    return { entry: best.entry, mapId, action };
  }

  function planKey(plan) {
    const identity = [...(plan?.enemyTypes || []), ...(plan?.enemyNames || []),
      ...(plan?.itemIds || []), ...(plan?.ids || [])];
    if (!identity.length) identity.push(String(plan?.targetLabel || '').replace(/\d+\s*\/\s*\d+/g, ''));
    return fold([plan?.mapId, plan?.action, ...identity].join('|')).replace(/\s+/g, '-');
  }

  function learnedSpots(plan) {
    const rows = memoryStore()[planKey(plan)];
    return Array.isArray(rows) ? rows.filter(row => row && row.mapId === plan.mapId) : [];
  }

  function rememberSpot(plan, x, y, kind = 'target') {
    if (!Number.isFinite(+x) || !Number.isFinite(+y) || !plan?.mapId) return;
    const store = memoryStore();
    const key = planKey(plan);
    const rows = Array.isArray(store[key]) ? store[key] : [];
    let row = rows.find(item => item.mapId === plan.mapId && Math.hypot(item.x - x, item.y - y) < 72);
    const now = Date.now();
    if (row) {
      const seen = Math.max(1, row.seen || 1);
      row.x = Math.round((row.x * seen + x) / (seen + 1));
      row.y = Math.round((row.y * seen + y) / (seen + 1));
      if (now - (row.lastSeen || 0) > 5000) row.seen = (row.seen || 1) + 1;
      row.lastSeen = now;
    } else {
      row = { mapId: plan.mapId, x: Math.round(x), y: Math.round(y), kind, seen: 1, lastSeen: now };
      rows.push(row);
    }
    store[key] = rows.sort((a, b) => (b.seen || 0) - (a.seen || 0) || b.lastSeen - a.lastSeen).slice(0, 8);
    safe(() => localStorage.setItem('tienlo-quest-memory-v1', JSON.stringify(store)));
  }

  function inferEnemyTypes(objective, mapId) {
    const value = fold(objective);
    const rules = [
      [/doc dang|doc dich/, ['doc_dang_yeu']],
      [/yeu cot/, ['yeu_quai_ha_pham']],
      [/linh thuy|duoc linh thu/, ['duoc_linh_thu']],
      [/chia khoa|thach giap/, ['thach_giap_yeu']],
      [/huyen thiet/, ['thach_yeu', 'thach_ma']],
      [/xich long/, ['than_thu_xich_long']],
      [/nguu sung|xich nhan nguu/, ['xich_nhan_nguu']],
      [/nanh ho|bach ho/, ['bach_ho_tuyet']]
    ];
    for (const [pattern, types] of rules) if (pattern.test(value)) return types;
    const P = window.PNTT || {};
    const def = safe(() => P.MapData?.get?.(mapId)) || Object.values(P.MapData || {})
      .find(item => item?.id === mapId);
    const types = [...new Set((def?.enemies || []).map(enemy => enemy?.type).filter(Boolean))];
    return types.filter(type => {
      const typeName = fold(type);
      const mob = P.ENEMIES?.[type] || P.MOBS?.[type] || P.ENEMY_TYPES?.[type];
      const name = fold(mob?.name || '');
      return value.includes(typeName) || (name && value.includes(name));
    });
  }

  function inferItemIds(objective) {
    const value = fold(objective);
    return Object.entries(window.PNTT?.ITEMS || {}).filter(([, item]) => {
      const name = fold(item?.name || '');
      return name.length >= 4 && value.includes(name);
    }).map(([id]) => id).slice(0, 4);
  }

  function inferTargetMap(objective, fallback = '') {
    const value = fold(objective);
    const rules = [
      [/doc dang|doc dich|thao duoc coc/, 'duoc_vien'],
      [/yeu cot|mieu hoang/, 'mieu_hoang'],
      [/duoc linh thu|vuon ca nhan|linh dien/, 'vuon_ca_nhan'],
      [/truc gia|truc tam|rung truc/, 'thanh_truc_lam'],
      [/thach giap|huyen thiet|linh duoc ruong|hang dong/, 'hang_dong_co'],
      [/xich long|long uyen/, 'long_uyen'],
      [/phong linh thao|bai da hang gio/, 'bai_da_hang_gio'],
      [/linh chi|tan vien|thay ong noi/, 'tan_vien']
    ];
    for (const [pattern, mapId] of rules) if (pattern.test(value)) return mapId;
    return fallback || knowledgeHint(objective)?.mapId || '';
  }

  function inferInteractIds(objective, mapId) {
    const P = window.PNTT || {};
    const def = safe(() => P.MapData?.get?.(mapId)) || Object.values(P.MapData || {})
      .find(item => item?.id === mapId);
    const text = fold(objective);
    const ignored = new Set(['nhat', 'hai', 'thu', 'gom', 'chat', 'gap', 'noi', 'chuyen',
      'tuong', 'tac', 'tai', 'den', 'voi', 'mot', 'du', 'mang', 've', 'cho']);
    const tokens = text.split(' ').filter(token => token.length >= 3 && !ignored.has(token));
    return [...(def?.props || []), ...(def?.interactables || [])].filter(obj => {
      const value = fold([obj.id, obj.type, obj.name, obj.title].filter(Boolean).join(' '));
      if (!value) return false;
      const score = tokens.filter(token => value.includes(token)).length;
      return score >= Math.min(2, Math.max(1, tokens.length));
    }).map(obj => obj.id).filter(Boolean).slice(0, 24);
  }

  function objectiveRows() {
    const rows = safe(() => window.PNTT?.Quest?.trackerObjectives?.(), []);
    return (Array.isArray(rows) ? rows : []).map(row => typeof row === 'string'
      ? { text: row, done: false }
      : { text: String(row?.text || ''), done: !!row?.done,
        cur: Number.isFinite(+row?.cur) ? +row.cur : null,
        max: Number.isFinite(+row?.max) ? +row.max : null,
        guide: !!row?.huongDan, sub: !!row?.sub });
  }

  function enemyMatches(enemy, plan) {
    if ((avoidedEnemies.get(`${window.PNTT?.SceneWorld?.map?.data?.id}:${enemy?.id}`) || 0) > Date.now()) return false;
    if (plan?.farmXp) {
      if (enemy?.human || enemy?.def?.human || enemy?.def?.isBoss) return false;
      const P = window.PNTT || {};
      const enemyRealm = enemy?.realmId || enemy?.def?.realmId;
      const playerRealm = P.Progress?.realmId;
      const enemyLevel = enemyRealm ? safe(() => P.realmIndexById?.(enemyRealm), -1) : -1;
      const playerLevel = playerRealm ? safe(() => P.realmIndexById?.(playerRealm), -1) : -1;
      return enemyLevel < 0 || playerLevel < 0 || enemyLevel <= playerLevel + 1;
    }
    const types = (plan?.enemyTypes || []).map(fold).filter(Boolean);
    const names = (plan?.enemyNames || []).map(fold).filter(Boolean);
    const values = [enemy?.type, enemy?.id, enemy?.def?.id, enemy?.name, enemy?.def?.name].map(fold).filter(Boolean);
    return types.some(type => values.some(value => value === type || value.includes(type))) ||
      names.some(name => values.some(value => value.includes(name) || name.includes(value)));
  }

  function scanPlanLocation(plan) {
    const scene = window.PNTT?.SceneWorld;
    const player = scene?.player;
    const mapName = scene?.map?.data?.name || plan.mapId || 'chưa rõ bản đồ';
    if (!player) return mapName;
    const currentMap = scene.map?.data?.id || '';
    if (plan.mapId && currentMap && plan.mapId !== currentMap) {
      const route = mapRoute(currentMap, plan.mapId);
      return route?.length ? `đi ${route.join(' → ')}` : `cần tới ${plan.mapId}`;
    }
    if (plan.action === 'attack') {
      const matches = (scene.enemies || []).filter(enemy => enemy && !enemy.dead &&
        (+enemy.hp > 0 || enemy.hp == null) && enemyMatches(enemy, plan));
      matches.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
      const nearest = matches[0];
      const learned = learnedSpots(plan)[0];
      return nearest
        ? `${mapName} · ${matches.length} mục tiêu · gần nhất ${Math.round(nearest.x)},${Math.round(nearest.y)}`
        : learned ? `${mapName} · điểm đã học ${learned.x},${learned.y} · ${learned.seen} lần`
          : `${mapName} · đang quét khu vực`;
    }
    const target = questTarget({ ids: plan.ids || [] });
    return target
      ? `${mapName} · ${Math.round(target.obj.x)},${Math.round(target.obj.y)} · cách ${Math.round(target.dist)}`
      : mapName;
  }

  function analyzeQuest() {
    const P = window.PNTT || {};
    const Q = P.Quest || {};
    const scene = P.SceneWorld || {};
    const guide = safe(() => Q.guidePlace?.());
    const rows = objectiveRows();
    const active = rows.find(row => !row.done && !(row.max != null && row.cur >= row.max) && !row.guide && !row.sub)
      || rows.find(row => !row.done && !(row.max != null && row.cur >= row.max));
    const objective = active?.text || readHud().objectives[0] || Q.title || 'Chưa xác định nhiệm vụ';
    const currentMap = String(scene.map?.data?.id || '');
    const make = value => {
      const plan = { objective, action: 'manual', targetLabel: 'Cần thao tác thủ công',
        mapId: guide?.mapId || currentMap, ids: guide?.ids || [], ...value };
      plan.location = scanPlanLocation(plan);
      plan.priority = policy.priorities[plan.stepId ? 'quest_next_step' : plan.farmXp
        ? 'quest_farm_xp' : plan.action === 'attack' ? 'quest_kill_target' : 'quest_interact'] || 0;
      plan.summary = `${plan.actionLabel || plan.action.toUpperCase()} · ${plan.targetLabel} · ${plan.location}`;
      return plan;
    };

    const xpObjective = rows.find(row => /tich.*dao hanh/i.test(fold(row.text)) &&
      !row.done && row.cur != null && row.max > 0 && row.cur < row.max);
    const task = safe(() => Q.seedTaskInfo?.());
    const breakthroughStep = !task ? safe(() => Q.buocCuaQuan?.()) : null;
    const killTarget = objective.match(/(?:hạ|diệt|đánh bại)\s+(.+?)(?:\s+ở\s+|\s*\(|,|$)/i)?.[1]?.trim();
    if (killTarget && !task && !breakthroughStep?.place?.ids?.length) {
      const matchingMaps = [...mapDefinitions().values()].filter(def => (def.enemies || []).some(enemy =>
        fold(P.ENEMY_DEFS?.[enemy.type]?.name || enemy.name || '').includes(fold(killTarget))));
      const matchingMap = matchingMaps.find(def => def.id === currentMap) || matchingMaps[0];
      if (matchingMap) return make({ action: 'attack', actionLabel: 'ĐÁNH ĐÚNG QUÁI',
        mapId: matchingMap.id, ids: [], enemyNames: [killTarget],
        enemyTypes: (matchingMap.enemies || []).filter(enemy =>
          fold(P.ENEMY_DEFS?.[enemy.type]?.name || enemy.name || '').includes(fold(killTarget))).map(enemy => enemy.type),
        targetLabel: killTarget });
    }
    // Follow the native next step first. XP farming is only a fallback,
    // never a reason to skip seed credits, planting, brewing or collection.
    if (xpObjective && !task && !breakthroughStep?.place?.ids?.length) {
      const def = safe(() => P.MapData?.get?.(currentMap));
      const hasMonsters = (scene.enemies || []).some(enemy => !enemy?.def?.human && !enemy?.def?.isBoss) ||
        (def?.enemies || []).some(enemy => !enemy?.human && !enemy?.isBoss);
      return make({ objective: xpObjective.text, action: 'attack', actionLabel: 'FARM ĐẠO HẠNH',
        farmXp: true, mapId: hasMonsters ? currentMap : 'thanh_truc_lam', ids: [],
        targetLabel: `Đạo Hạnh ${xpObjective.cur}/${xpObjective.max} · săn quái thường, đủ thì tiếp tục quest` });
    }

    if (+Q.stage === +Q.DOC_DANG_STAGE || +Q.stage === 16) {
      const itemId = Q.DOC_DANG_ITEM || 'doc_dang_doc_dich';
      const have = +safe(() => P.Inventory?.count?.(itemId), 0) || 0;
      const need = +Q.NEED_DOC_DANG || 10;
      const fishHave = +Q.flags?.[Q.LINH_NGU_CATCH_FLAG || 'linh_ngu_cau_duoc'] || 0;
      const fishNeed = +Q.NEED_LINH_NGU || 1;
      if (have < need) return make({ action: 'attack', actionLabel: 'ĐÁNH → NHẶT', mapId: 'duoc_vien',
        targetLabel: `Độc Đằng Yêu → nhặt Độc Dịch ${have}/${need}`,
        enemyTypes: ['doc_dang_yeu'], enemyNames: ['Độc Đằng Yêu'], itemIds: [itemId] });
      if (fishHave < fishNeed) return make({ action: 'interact', actionLabel: 'TƯƠNG TÁC → CÂU', mapId: 'duoc_vien',
        targetLabel: `Mặt nước → tự động câu Linh Ngư ${fishHave}/${fishNeed}`,
        ids: ['ho_bich_thuy_cong', 'suoi_duoc_coc'], autoChoice: 'Tự động câu' });
      return make({ action: 'interact', mapId: 'duoc_vien', targetLabel: 'Đại Phu · giao nhiệm vụ',
        ids: ['dai_phu'] });
    }

    if (+Q.stage === (+Q.BACH_KHOA_STAGE || 17)) {
      const progress = +safe(() => Q.bachKhoaProgress?.(), 0) || 0;
      const need = +Q.BACH_KHOA_NEED || 5;
      if (progress < need) return make({ action: 'interact', mapId: 'tan_vien',
        targetLabel: `Thầy Ông Nội · Hỏi Đạo ${progress}/${need}`, ids: ['su_phu'] });
      if (!safe(() => Q.biTichGachaDone?.(), false)) return make({ action: 'interact', mapId: 'tan_vien',
        targetLabel: 'Tàng Kinh Lão Nhân · rút bí tịch chưa có', ids: ['tang_kinh_lao_nhan'],
        autoChoice: 'Tàng Kinh Sơ Cấp' });
      return make({ action: 'interact', mapId: 'tan_vien',
        targetLabel: 'Thầy Ông Nội · hoàn tất Hỏi Đạo', ids: ['su_phu'] });
    }

    if (+Q.stage === 3) {
      return make({ action: 'interact', stepId: 'luyen_dan', mapId: guide?.mapId || 'tan_vien',
        ids: guide?.ids?.length ? guide.ids : ['dan_lo'], targetLabel: 'Sắc Tẩy Tuỷ Thang ở đan lô',
        autoChoice: P.ITEMS?.tay_tuy_thang?.name || 'Tẩy Tuỷ Thang',craftItemId:'tay_tuy_thang' });
    }
    if (+Q.stage === 9 || +Q.stage === 12) {
      const craftItemId = +Q.stage === 12 ? 'tu_khi_dan' : 'tu_khi_duoc';
      const craftName = +Q.stage === 12 ? 'Tụ Khí Đan' : 'Linh Dược';
      return make({action:'interact',stepId:'luyen_dan',mapId:guide?.mapId||'vuon_ca_nhan',
        ids:guide?.ids?.length?guide.ids:['dan_lo'],targetLabel:`Luyện ${craftName} ở đan lô trong vườn`,
        autoChoice:craftName,craftItemId});
    }

    if (task?.kind === 'fishing' && !safe(() => Q.seedQuestComplete?.(), false)) {
      return make({ action: 'interact', actionLabel: 'TƯƠNG TÁC → CÂU', mapId: currentMap || 'duoc_vien',
        targetLabel: `Mặt nước → tự động câu ${safe(() => Q.seedQuestProgress?.(), 0)}/${task.need || 3}`,
        ids: ['ho_bich_thuy_cong', 'suoi_duoc_coc', 'ho_bich_thuy'], autoChoice: 'Tự động câu' });
    }
    if (task?.kind === 'collect') return make({ action: 'interact', mapId: guide?.mapId || currentMap,
      targetLabel: task.itemName || task.shortName || 'Nguyên liệu nhiệm vụ', ids: guide?.ids || task.propIds || [] });
    if (task?.kind === 'escort') return make({ action: 'interact', mapId: 'tan_vien',
      targetLabel: 'Thầy Ông Nội · giao người', ids: ['su_phu'] });
    if (task?.kind === 'tournament') return make({ action: 'manual', targetLabel: 'Đại Hội Tu Tiên' });

    // The game's current prerequisite is more specific than a broad HUD objective.
    // For example, gaining experience may first require earning seed credits.
    if (breakthroughStep?.place?.ids?.length) {
      return make({ action: 'interact', objective: breakthroughStep.hint || objective,
        stepId: breakthroughStep.id,
        targetLabel: breakthroughStep.ngan || breakthroughStep.hint || objective,
        mapId: breakthroughStep.place.mapId, ids: breakthroughStep.place.ids,
        autoChoice: breakthroughStep.id === 'gap_dai_phu' ? 'Xem Sổ Việc Dược Công'
          : breakthroughStep.id === 'doi_hat' ? 'Mở Quầy Đổi Hạt'
          : breakthroughStep.id === 'luyen_dan' ? P.ITEMS?.[P.BREAKTHROUGH?.[P.Progress?.realmId]?.item]?.name
          : breakthroughStep.id === 'pha_quan' ? 'Bắt Đầu Phá Quan' : undefined });
    }
    if (guide?.mapId && guide?.ids?.length) {
      return make({ action: 'interact', targetLabel: objective,
        mapId: guide.mapId, ids: guide.ids });
    }

    const lowered = fold(objective);
    const parenthesized = objective.match(/\(\s*hạ\s+([^)]+)\)/i);
    const directKill = objective.match(/(?:hạ|diệt|đánh bại)\s+(.+?)(?:\s*\(|,|\s+để|$)/i);
    const enemyName = (parenthesized?.[1] || directKill?.[1] || '').trim();
    if (enemyName || /yeu cot|doc dich|thu nanh|lay chia khoa tu/i.test(lowered)) {
      const targetMap = inferTargetMap(enemyName || objective, guide?.mapId || currentMap);
      return make({ action: 'attack', actionLabel: /^\s*nhặt/i.test(objective) ? 'ĐÁNH → NHẶT' : 'ĐÁNH', targetLabel: enemyName || objective,
        enemyNames: enemyName ? [enemyName] : [], enemyTypes: inferEnemyTypes(enemyName || objective, targetMap),
        itemIds: inferItemIds(objective), mapId: targetMap });
    }
    if (/cau ca|linh ngu/.test(lowered)) return make({ action: 'interact',
      targetLabel: 'Mặt nước → tự động câu', mapId: guide?.mapId || currentMap,
      ids: guide?.ids?.length ? guide.ids : ['ho_bich_thuy_cong', 'suoi_duoc_coc', 'ho_bich_thuy'],
      autoChoice: 'Tự động câu' });
    if (/nhat|hai|thu gom|chat|mo |gap |noi chuyen|tuong tac/.test(lowered) || guide?.ids?.length) {
      const targetMap = inferTargetMap(objective, guide?.mapId || currentMap);
      return make({ action: 'interact', targetLabel: objective, mapId: targetMap,
        ids: guide?.ids?.length ? guide.ids : inferInteractIds(objective, targetMap) });
    }
    const learned = knowledgeHint(objective);
    if (learned?.action === 'attack') {
      const targetMap = learned.mapId || guide?.mapId || currentMap;
      return make({ action: 'attack', actionLabel: 'BÁCH KHOA → ĐÁNH',
        targetLabel: learned.entry.name, enemyNames: [learned.entry.name],
        enemyTypes: inferEnemyTypes(learned.entry.name, targetMap),
        itemIds: inferItemIds(objective), mapId: targetMap, knowledgeId: learned.entry.id });
    }
    if (learned?.action === 'interact') {
      const targetMap = learned.mapId || guide?.mapId || currentMap;
      return make({ action: 'interact', actionLabel: 'BÁCH KHOA → TƯƠNG TÁC',
        targetLabel: learned.entry.name, mapId: targetMap,
        ids: guide?.ids?.length ? guide.ids : inferInteractIds(learned.entry.name, targetMap),
        knowledgeId: learned.entry.id });
    }
    return make({ action: 'manual', targetLabel: objective, mapId: guide?.mapId || currentMap,
      ids: guide?.ids || [] });
  }

  function chooseTarget(autoMode, plan = null) {
    const P = window.PNTT || {};
    const scene = P.SceneWorld;
    const player = scene?.player;
    if (!player || !Array.isArray(scene.enemies)) return null;

    let candidates = scene.enemies
      .filter(enemy => enemy && !enemy.dead && (+enemy.hp > 0 || enemy.hp == null) && !enemy.def?.human)
      .filter(enemy => (avoidedEnemies.get(`${scene.map?.data?.id}:${enemy.id}`) || 0) <= Date.now())
      .filter(enemy => !plan || enemyMatches(enemy, plan))
      .map(enemy => ({
        enemy, distance: Math.hypot(enemy.x - player.x, enemy.y - player.y),
        boss: !!enemy.def?.isBoss,
        ratio: +enemy.hpMax > 0 ? +enemy.hp / +enemy.hpMax : 1
      }))
      .filter(item => item.distance <= config.maxDistance);

    if (autoMode === 'quest' && config.avoidBoss) candidates = candidates.filter(item => !item.boss);
    if (config.priority === 'Yêu Vương') candidates = candidates.filter(item => item.boss);
    else if (config.priority === 'Yêu Thú') candidates = candidates.filter(item => !item.boss);

    if (config.priority === 'Khí Huyết thấp') candidates.sort((a, b) => a.ratio - b.ratio || a.distance - b.distance);
    else if (config.nearest) candidates.sort((a, b) => a.distance - b.distance);

    const selected = candidates.find(item => P.Targeting?.key === `foe:${item.enemy.id}`) || candidates[0];
    if (selected && P.Targeting) {
      P.Targeting.key = `foe:${selected.enemy.id}`;
      P.Targeting.manual = true;
      return selected.enemy;
    }

    return null;
  }

  function move() {
    if (window.PNTT?.SceneWorld?.player?.downed || reviveState.since) return;
    if (meditating) return;
    if (Date.now() < kiteUntil) return;
    if (['attack', 'pose'].includes(window.PNTT?.SceneWorld?.player?.state)) return;
    const minimap = $('#minimap');
    if (!minimap) return;
    const rect = minimap.getBoundingClientRect();
    minimap.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: rect.left + rect.width * (.2 + Math.random() * .6),
      clientY: rect.top + rect.height * (.2 + Math.random() * .6)
    }));
  }

  function combatTick(autoMode) {
    if (window.PNTT?.SceneWorld?.player?.downed || reviveState.since) return;
    if (retreatTick()) return;
    if (config.recoverHealth && recoveryTick()) return;
    if (Date.now() < kiteUntil) return;
    if (meditating) return;
    chooseTarget(autoMode);
    const player = window.PNTT?.SceneWorld?.player;
    if (player?.state === 'attack' || player?.state === 'pose') return;
    const input = window.PNTT?.Input;
    if (config.skillSlots.length) input?.pressSlot?.(config.skillSlots[skillIndex++ % config.skillSlots.length]);
    input?.pressAttack?.();
  }

  function holdQuestPosition() {
    const P = window.PNTT || {};
    const scene = P.SceneWorld;
    const player = scene?.player;
    if (!player) return;
    scene.approach = null;
    safe(() => player.setPath?.([]));
    safe(() => P.Player?.stand?.(player));
    lastQuestTarget = '';
  }

  function questTarget(guide) {
    const P = window.PNTT || {};
    const scene = P.SceneWorld;
    const player = scene?.player;
    const ids = (Array.isArray(guide?.ids) ? guide.ids : [])
      .map(id => String(id).toLowerCase());
    if (!player || !ids.length) return null;

    const matches = (obj, key = '') => {
      const values = [obj?.id, obj?.def?.id, obj?.cfg?.id, key]
        .filter(value => value != null).map(value => String(value).toLowerCase());
      return ids.some(id => values.some(value => value === id || value.endsWith(`:${id}`)));
    };
    const listed = (P.Targeting?.list || [])
      .filter(item => item?.obj && !item.obj.hidden && matches(item.obj, item.key))
      .map(item => ({ obj: item.obj, key: item.key, dist: Number.isFinite(+item.dist)
        ? +item.dist : Math.hypot(item.obj.x - player.x, item.obj.y - player.y) }));
    if (listed.length) return listed.sort((a, b) => a.dist - b.dist)[0];

    const pools = [scene.map?.props, scene.map?.flatProps, scene.map?.interactables,
      scene.props, scene.interactables];
    const seen = new Set();
    const found = [];
    for (const pool of pools) {
      if (!Array.isArray(pool)) continue;
      for (const obj of pool) {
        if (!obj || seen.has(obj) || obj.hidden || !matches(obj)) continue;
        seen.add(obj);
        found.push({ obj, key: `quest:${obj.id || obj.def?.id || found.length}`,
          dist: Math.hypot(obj.x - player.x, obj.y - player.y) });
      }
    }
    return found.sort((a, b) => a.dist - b.dist)[0] || null;
  }

  function clickDialogChoice(label) {
    if (!label || Date.now() - lastDialogChoiceAt < 2000) return false;
    const wanted = fold(label);
    const button = [...document.querySelectorAll('button')].find(node =>
      !node.disabled && node.offsetParent && fold(node.textContent).includes(wanted));
    if (!button) return false;
    lastDialogChoiceAt = Date.now();
    button.click();
    return true;
  }

  function quizAnswer() {
    const question = fold(document.querySelector('#dialog-text')?.textContent);
    const answers = [
      [/tu khi dan dung de lam gi/, 'Phá quan khi Đạo Hạnh đã đầy'],
      [/yeu cot vun thuong lay tu dau/, 'Yêu Quái Nhất Giai Hạ Phẩm ở Miếu Hoang'],
      [/doc dang doc dich roi tu dau/, 'Độc Đằng Yêu ở Thảo Dược Cốc'],
      [/bi tich dung de lam gi/, 'Học pháp quyết mới'],
      [/co the cau linh ngu o dau/, 'Hồ Bích Thủy hoặc Suối Dẫn Thủy'],
      [/muon tim truc tam thi nen toi dau/, 'Rừng Trúc'],
      [/muon vao hang dong can dat canh gioi nao/, 'Luyện Khí Tầng 7'],
      [/ai chi duong vao hang dong/, 'Lão Đạo Hành Cước ở cửa hang Long Uyên Cốc'],
      [/mo linh duoc ruong cuoi hang dong can vat gi/, 'Chìa Khoá'],
      [/ren vu khi huyen thiet can gi/, '2 Huyền Thiết Khoáng và 50 Linh Thạch'],
      [/mang nguyen lieu toi dau de ren vu khi/, 'Thợ Rèn ở làng Tản Viên'],
      [/huyen thiet khoang chu yeu dung de lam gi/, 'Rèn vũ khí'],
      [/sau khi ren xong vu khi nguoi choi se buoc vao phan nao/, 'Thử Lửa Đạo Tâm'],
      [/muon lay long huyet can lam gi/, 'Góp sức hạ Thần Thú Xích Long'],
      [/long uyen nam o dau/, 'Qua rìa phía đông Rừng Trúc'],
      [/bang go truoc cua long uyen dung de lam gi/, 'Xem thời gian Xích Long xuất hiện'],
      [/huyet xich cam dia va dai hoi tu tien lan luot thu dieu gi/, 'Thử thân và thử tâm']
    ];
    return answers.find(([pattern]) => pattern.test(question))?.[1] || '';
  }

  function handleBachKhoaDialog(buttons) {
    const Q = window.PNTT?.Quest;
    if (!Q || +Q.stage !== (+Q.BACH_KHOA_STAGE || 17) || safe(() => Q.bachKhoaXong?.(), false))
      return false;
    const dialogText = fold(document.querySelector('#dialog-text')?.textContent);
    const findButton = pattern => buttons.find(button => pattern.test(fold(button.textContent)));
    const choose = (button, message) => {
      if (!button) return false;
      lastDialogChoiceAt = Date.now();
      button.click();
      report('quest', message);
      return true;
    };

    const answer = quizAnswer();
    if (answer) {
      const wanted = fold(answer);
      return choose(buttons.find(button => fold(button.textContent).includes(wanted)),
        `HỎI ĐẠO · chọn đáp án: ${answer}`);
    }
    if (/tien do\s+\d+\s+5 cau dung/.test(dialogText))
      return choose(findButton(/bat dau hoi dao/), 'HỎI ĐẠO · bắt đầu câu hỏi');
    if (/dung roi|cau tiep theo/.test(dialogText))
      return choose(findButton(/cau tiep theo/), 'HỎI ĐẠO · sang câu tiếp theo');
    if (/chua dung|thu lai cau nay/.test(dialogText))
      return choose(findButton(/thu lai cau nay/), 'HỎI ĐẠO · thử lại câu hỏi');

    // Never fall through to the generic chooser while a quiz question is visible.
    // A newly added question is safer to pause on than to reopen the encyclopedia forever.
    if (/cau\s+\d+\s+5/.test(dialogText)) {
      reportOnce('quest-quiz-unknown', 'quest',
        'HỎI ĐẠO · chưa nhận ra câu hỏi, đã khóa nút mở Bách Khoa', 3000);
      return true;
    }
    return false;
  }

  function handleQuestOverlay() {
    const visible = element => element && !element.classList.contains('hidden') &&
      getComputedStyle(element).display !== 'none' && element.getClientRects().length;
    const encyclopedia = document.querySelector('#encyclopedia');
    if (visible(encyclopedia)) {
      if (Date.now() - lastDialogChoiceAt >= 1000) {
        lastDialogChoiceAt = Date.now();
        document.querySelector('#encyclopedia-close')?.click();
        report('quest', 'ĐÃ TRA CỨU · quay lại Thầy Ông Nội để trả lời');
      }
      return true;
    }
    const gacha = document.querySelector('#gacha');
    if (visible(gacha)) {
      const done = safe(() => window.PNTT?.Quest?.biTichGachaDone?.(), false);
      const button = done ? document.querySelector('#gacha-close') : document.querySelector('#gacha-one');
      if (button && !button.disabled && Date.now() - lastDialogChoiceAt >= 1800) {
        lastDialogChoiceAt = Date.now();
        button.click();
        report('quest', done ? 'ĐÃ CÓ BÍ TỊCH MỚI · đóng tủ sách' :
          'RÚT BÍ TỊCH · đang tìm quyển chưa có');
      } else if (!done && button?.disabled) {
        reportOnce('quest-gacha-disabled', 'quest',
          'Tủ sách đang xử lý hoặc không đủ Linh Thạch', 3000);
      }
      return true;
    }
    return false;
  }

  function rankDialogChoices(labels, plan, seedPackName = '', neededHerbs = []) {
    const wanted = fold(plan?.autoChoice || '');
    const pack = fold(seedPackName);
    const context = fold([plan?.targetLabel, plan?.objective].join(' '));
    const tokens = [...new Set(context.split(' ').filter(token => token.length >= 4 &&
      !/^(nhiem|dang|tuong|nhan|tien|hanh)$/.test(token)))];
    return labels.map((text, index) => {
      const label = fold(text);
      let score = 0;
      let reason = '';
      if (plan?.stepId === 'luyen_dan' && /pha canh|pha quan|^thieu$/.test(label))
        return { index, score: -1000, reason: 'Cần luyện đan trước khi phá quan' };
      if (/^gieo hat /.test(label)) {
        const ingredient = neededHerbs.findIndex(name => label.includes(fold(name)));
        return { index, score: ingredient >= 0 ? 220 - ingredient * 20 : -1000,
          reason: ingredient >= 0 ? 'Gieo nguyên liệu còn thiếu của đan cần luyện' : 'Không phải nguyên liệu cần luyện' };
      }
      if (/xoa|huy nhiem vu|vut|pha huy|do sat|ti thi|ghi danh|mo bach khoa|lui buoc|quay lai/.test(label))
        return { index, score: -1000, reason: 'Không phục vụ bước hiện tại' };
      if (/doi goi hat/.test(label)) {
        const exactPack = pack && label.startsWith(`doi ${pack}`);
        return { index, score: exactPack ? 200 : -1000,
          reason: exactPack ? 'Đúng gói hạt bước phá quan đang cần' : 'Sai gói hạt cần dùng' };
      }
      if (wanted && label.includes(wanted)) {
        score = 180;
        reason = 'Đúng lựa chọn bước nhiệm vụ hiện tại';
      } else if (/mua|doi |rut /.test(label)) {
        score = -1000;
      } else {
        const hits = tokens.filter(token => label.includes(token));
        score = hits.length * 10;
        if (hits.length && /hoan thanh|giao |nhan |cau|thu hai|nhat|hoi viec|tiep tuc/.test(label)) score += 25;
        reason = `Khớp mục tiêu: ${hits.join(', ')}`;
      }
      return { index, score, reason };
    }).sort((a, b) => b.score - a.score);
  }

  function dialogChoiceLabel(button, plan) {
    if (window.__tienloWorkflow && plan?.stepId === 'luyen_dan') {
      const observed=window.__tienloWorkflow.observe(button,plan);
      if (observed.action==='open_recipe' && /thieu/.test(fold(button.getAttribute('aria-label')||button.textContent))) return 'Thiếu';
      if (observed.action!=='select_option') return observed.label;
    }
    const label = button.textContent.trim();
    if (plan?.stepId === 'luyen_dan' && button.matches('.forge-slot')) {
      const accessible = button.getAttribute('aria-label') || '';
      if (/thiếu/i.test(accessible) || /^thiếu$/i.test(label)) return 'Thiếu';
      return `Luyện ${button.title || accessible}`;
    }
    if (plan?.stepId === 'luyen_dan' && /^luyện$/i.test(label)) {
      const context = button.closest('.bag-detail-card')?.querySelector('h3')?.textContent
        || button.parentElement?.textContent || '';
      if (plan.autoChoice && fold(context).includes(fold(plan.autoChoice)))
        return `${label} ${plan.autoChoice}`;
    }
    return label;
  }

  function logDialogFailure(plan, root, buttons, reason, waitedMs) {
    const P = window.PNTT || {};
    const snapshot = {
      at: new Date().toISOString(), version: HOOK_VERSION, outcome: 'fail', reason,
      character: P.SceneWorld?.player?.cfg?.name || '', quest: {stage:P.Quest?.stage},
      waitedMs, plan: { objective: plan?.objective, stepId: plan?.stepId,
        targetLabel: plan?.targetLabel, mapId: plan?.mapId, ids: plan?.ids, autoChoice: plan?.autoChoice },
      world: { mapId: P.SceneWorld?.map?.data?.id, x: P.SceneWorld?.player?.x, y: P.SceneWorld?.player?.y },
      dialog: root.textContent.trim().slice(0, 6000),
      choices: buttons.map(button => ({ label: button.textContent.trim(), title: button.title,
        accessible: button.getAttribute('aria-label'), disabled: button.disabled })),
      attempted: dialogDecision.acted.has(dialogDecision.signature), recovery: 'back'
    };
    const stored = safe(() => JSON.parse(localStorage.getItem('tienlo-quest-failures-v1') || '[]'), []);
    const rows = Array.isArray(stored) ? stored : [];
    rows.unshift(snapshot);
    safe(() => localStorage.setItem('tienlo-quest-failures-v1', JSON.stringify(rows.slice(0, 200))));
    post({ type: 'TIENLO_QUEST_FAILURE', payload: snapshot });
    return snapshot;
  }

  function choiceContext(plan, labels) {
    // Progress counters and option order must not erase a failed choice's identity.
    const normalize = value => fold(value || '').replace(/\d+\s*\/\s*\d+/g, '#/#');
    return JSON.stringify(['v2', window.PNTT?.Quest?.stage, plan?.stepId || '', normalize(plan?.objective),
      plan?.mapId || '', labels.map(normalize).sort()]);
  }

  function settleChoiceMemory(forceFailure = '') {
    if (!pendingChoice) return;
    if (window.PNTT?.Quest?.stage === 19 && /tan tu chien bang/.test(fold(pendingChoice.label)) &&
        document.querySelector?.('#dialog .cb-panel')?.getClientRects().length) {
      pendingChoice = null;
      return;
    }
    const progress = JSON.stringify([window.PNTT?.Quest?.stage, readHud().objectives]);
    const workflow = pendingChoice.workflow;
    const stepSucceeded = workflow && safe(() => window.__tienloWorkflow?.evaluate(workflow.step,workflow.before,
      window.__tienloWorkflow.snapshot(window.PNTT||{},document,workflow.step.itemId))) === 'success';
    const changed = workflow?.step.action === 'open_recipe' ? !!stepSucceeded : stepSucceeded || progress !== pendingChoice.progress;
    if (!changed && !forceFailure && Date.now() - pendingChoice.time < 15000) return;
    const entry = { ...pendingChoice, at: new Date().toISOString(), outcome: changed ? 'success' : 'fail',
      reason: 'choice_result', dialog: pendingChoice.dialog, version: HOOK_VERSION };
    if (!changed && forceFailure) entry.failureReason = forceFailure;
    if (workflow) entry.sequence = safe(() => window.__tienloWorkflow.record(
      workflow.chainKey,workflow.step,entry.outcome),[]);
    const valueKey = JSON.stringify([entry.key, entry.label]);
    const oldValue = choiceValues.get(valueKey) || 0;
    entry.reward = changed ? policy.dialog.progressReward : policy.dialog.failureReward;
    entry.value = oldValue + policy.dialog.learningRate * (entry.reward - oldValue);
    choiceValues.set(valueKey, entry.value);
    if (changed) learnedChoices.set(entry.key, entry.label);
    else if (learnedChoices.get(entry.key) === entry.label) learnedChoices.delete(entry.key);
    post({ type: 'TIENLO_QUEST_FAILURE', payload: entry });
    reportOnce(`learn:${entry.key}`, 'quest', changed
      ? `ĐÃ NHỚ · ${entry.label} · nhiệm vụ có tiến triển`
      : `CHƯA THÀNH CÔNG · ${entry.label} · không ghi nhớ để tự chọn lại`, 2000);
    pendingChoice = null;
  }

  function rememberDialogClick(button) {
    const root = button.closest('#dialog');
    if (!root || button.disabled || button.id === 'dialog-close'
      || /^(lui buoc|quay lai|dong|✕|×)$/.test(fold(button.textContent.trim()))) return;
    const plan = safe(() => analyzeQuest());
    settleChoiceMemory();
    const detail = root.querySelector('.forge-detail');
    const choiceRoot = detail && detail.getClientRects().length ? detail : root;
    const buttons = [...choiceRoot.querySelectorAll('button')].filter(b => !b.disabled && b.getClientRects().length
      && b.getAttribute('role') !== 'tab' && (plan?.stepId === 'luyen_dan' || !b.matches('.forge-slot')));
    const labels = buttons.map(b => dialogChoiceLabel(b, plan));
    pendingChoice = { key: choiceContext(plan, labels), label: dialogChoiceLabel(button, plan),
      character: window.PNTT?.SceneWorld?.player?.cfg?.name || readHud().name || '',
      time: Date.now(), progress: JSON.stringify([window.PNTT?.Quest?.stage, readHud().objectives]),
      optionIndex: buttons.indexOf(button), dialog: choiceRoot.textContent.trim().slice(0, 6000) };
    if (window.__tienloWorkflow && plan?.stepId==='luyen_dan') {
      const step=window.__tienloWorkflow.observe(button,plan);
      if(step.action!=='select_option')pendingChoice.workflow={step,chainKey:JSON.stringify([window.PNTT?.Quest?.stage,step.itemId]),
        before:window.__tienloWorkflow.snapshot(window.PNTT||{},document,step.itemId)};
    }
  }
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#dialog button');
    if (button) rememberDialogClick(button);
  }, true);

  function handleChienBangDialog(plan, root, buttons) {
    const P = window.PNTT || {};
    const Q = P.Quest;
    if (!Q || Q.stage !== (Q.TAN_TU_CHIEN_BANG_STAGE || 19) ||
        Q.flags?.[Q.TAN_TU_CHIEN_BANG_FLAG] ||
        !/dau 1 tran.*chien bang/.test(fold(String(plan?.objective || plan?.targetLabel || '').toLowerCase()))) return false;
    if (root.querySelector('.cb-panel')) {
      // Opening the board is an intermediate step, not a failed quest action.
      if (pendingChoice && /tan tu chien bang/.test(fold(pendingChoice.label))) pendingChoice = null;
      dialogDecision.acted.clear();
      dialogDecision.ai = null;
      if (Date.now() - chienBangAttemptAt < 8000) return true;
      const challenge = [...buttons].reverse().find(button => button.matches('.cb-fight') && !button.disabled);
      if (!challenge) {
        reportOnce('chienbang-unavailable','quest','CHIẾN BẢNG · chưa có đối thủ khả dụng hoặc đã hết lượt',5000);
        return true;
      }
      chienBangAttemptAt = Date.now();
      lastDialogChoiceAt = Date.now();
      challenge.click();
      report('quest','CHIẾN BẢNG · đã chọn Khiêu chiến, chờ game xác nhận trận đấu');
      return true;
    }
    const entry = buttons.find(button => /^tan tu chien bang/.test(fold(button.textContent.trim())));
    if (!entry) return false;
    lastDialogChoiceAt = Date.now();
    entry.click();
    report('quest','CHIẾN BẢNG · mở bảng để chọn đối thủ');
    return true;
  }

  function clickQuestDialogDecision(plan) {
    if (Date.now() - lastDialogChoiceAt < 700) return false;
    const root = document.querySelector('#dialog');
    if (!root || root.classList.contains('hidden') || !root.getClientRects().length) return false;
    const visibleButton = button => button && !button.disabled && button.getClientRects().length &&
      getComputedStyle(button).display !== 'none' && getComputedStyle(button).visibility !== 'hidden';
    const detail = root.querySelector('.forge-detail');
    const choiceRoot = detail && detail.getClientRects().length ? detail : root;
    const allButtons = [...choiceRoot.querySelectorAll('button')];
    const buttons = allButtons.filter(visibleButton).filter(button =>
      button.getAttribute('role') !== 'tab' &&
      (plan?.stepId === 'luyen_dan' || !button.matches('.forge-slot')));
    if (handleChienBangDialog(plan, root, buttons)) return true;
    // Empty interaction panels must not trap the bot while it is still approaching.
    const isBack = button => button.id === 'dialog-close' || /^(lui buoc|quay lai|dong|✕|×)$/.test(fold(button.textContent.trim()));
    if (buttons.length && buttons.every(isBack)) {
      settleChoiceMemory('empty_interaction_panel');
      lastDialogChoiceAt = Date.now();
      buttons[0].click();
      dialogDecision.signature = ''; dialogDecision.ai = null;
      lastQuestTarget = ''; lastQuestRouteAt = 0;
      reportOnce('quest-empty-panel','quest','TIẾN LẠI · đóng hộp không có hành động, kiểm tra lại điểm tương tác',2500);
      return true;
    }
    const signature = JSON.stringify([choiceRoot.textContent, plan?.autoChoice, plan?.targetLabel,
      choiceRoot === detail ? 'recipe_detail' : 'recipe_list',
      buttons.map(button => [button.title, button.getAttribute('aria-label'), button.disabled])]);
    if (dialogDecision.signature !== signature) {
      dialogDecision.signature = signature;
      dialogDecision.ai = null;
      dialogDecision.observedAt = Date.now();
      reportOnce('quest-dialog-analyze', 'quest', 'PHÂN TÍCH · đối chiếu lựa chọn với bước nhiệm vụ', 2500);
      return true;
    }
    if (Date.now() - dialogDecision.observedAt < 600) return true;
    const waitedMs = Date.now() - dialogDecision.observedAt;
    if (waitedMs >= 16000 || (waitedMs >= 8000 && dialogDecision.acted.has(signature))) {
      const back = buttons.find(button => button.id === 'dialog-close')
        || buttons.find(button => /^(lui buoc|quay lai|dong|đong|✕|×)$/.test(fold(button.textContent.trim())));
      if (back) {
        settleChoiceMemory('dialog_timeout');
        logDialogFailure(plan, choiceRoot, allButtons,
          dialogDecision.acted.has(signature) ? 'choice_no_result' : 'no_confident_choice', waitedMs);
        lastDialogChoiceAt = Date.now();
        dialogDecision.acted.delete(signature);
        back.click();
        dialogDecision.signature = '';
        dialogDecision.observedAt = 0;
        lastQuestTarget = '';
        lastQuestRouteAt = 0;
        report('quest', 'FAIL · hội thoại quá 8 giây; đã lưu log và quay lại để phân tích bước tiếp theo');
        return true;
      }
    }
    if (dialogDecision.acted.has(signature)) {
      reportOnce('quest-dialog-wait', 'quest', 'CHỜ KẾT QUẢ · đã chọn một lần, không bấm lặp', 5000);
      return true;
    }
    if (handleBachKhoaDialog(buttons)) return true;
    if (plan?.stepId === 'luyen_dan' && /dai da/.test(fold(root.textContent))) {
      const close = buttons.find(button => button.id === 'dialog-close');
      if (close) {
        lastDialogChoiceAt = Date.now();
        dialogDecision.acted.add(signature);
        close.click();
        lastQuestTarget = '';
        lastQuestRouteAt = 0;
        report('quest', 'ĐỔI ĐIỂM · đang ở đài đá, cần tới đan lô luyện đan trước');
        return true;
      }
    }
    const step = safe(() => window.PNTT?.Quest?.buocCuaQuan?.());
    const seedPackName = step?.id === 'doi_hat'
      ? String(step.ngan || step.hint || '').match(/Gói Hạt[^.\n"]+/i)?.[0]?.trim() || '' : '';
    const P = window.PNTT || {};
    const requiredItem = P.BREAKTHROUGH?.[P.Progress?.realmId]?.item;
    const recipe = safe(() => P.Quest?.brewRecipe?.(requiredItem))?.recipe || [];
    const neededHerbs = recipe.filter(item =>
      (+safe(() => P.Inventory?.count?.(item.id), 0) || 0) < item.qty)
      .map(item => P.ITEMS?.[item.id]?.name).filter(Boolean);
    const labels = buttons.map(button => dialogChoiceLabel(button, plan));
    const ranked = rankDialogChoices(labels, plan, seedPackName, neededHerbs);
    const memoryKey = choiceContext(plan, labels);
    for (const row of ranked) {
      const value = choiceValues.get(JSON.stringify([memoryKey, labels[row.index]])) || 0;
      if (value < 0) { row.score = -1000; row.reason = 'Lựa chọn đã thất bại, thử lựa chọn khác'; }
      else if (row.score > -1000) row.score += value;
    }
    ranked.sort((a, b) => b.score - a.score);
    const remembered = learnedChoices.get(choiceContext(plan, labels));
    const rememberedIndex = labels.findIndex(label => label === remembered);
    if (rememberedIndex >= 0) {
      const row = ranked.find(row => row.index === rememberedIndex);
      if (row && row.score >= 0) {
        row.score += 100; row.reason = 'lựa chọn đã làm nhiệm vụ tiến triển';
        ranked.sort((a, b) => b.score - a.score);
      }
    }
    const fallback = waitedMs >= policy.dialog.exploreAfterMs
      ? labels.map((label,index) => ({index,label})).find(row =>
        buttons[row.index].id !== 'dialog-close' && row.label.trim() &&
        !/^(lui buoc|quay lai|de sau|dong|✕|×)$|thieu|xoa|vut|pha huy|huy nhiem vu|do sat/.test(fold(row.label)) &&
        (choiceValues.get(JSON.stringify([memoryKey, row.label])) || 0) >= 0) : null;
    if (fallback) fallback.reason = 'Chưa xác định được: thử nút đầu tiên chưa thất bại';
    const confident = ranked[0]?.score >= 35 && ranked[0].score - (ranked[1]?.score ?? -1000) >= 12;
    if (!confident && config.aiPlanner !== false && window.__tienloLocalRequest && !dialogDecision.ai) {
      const requestState = {pending:true,result:null};
      dialogDecision.ai = requestState;
      const rect=root.getBoundingClientRect?.();
      const x=Math.max(0,rect?.x||0),y=Math.max(0,rect?.y||0);
      const region=rect?{x,y,width:Math.min(rect.right,innerWidth)-x,height:Math.min(rect.bottom,innerHeight)-y,
        viewportWidth:innerWidth,viewportHeight:innerHeight}:null;
      const useVision=config.visionDialogs && region && region.width>0 && region.height>0;
      void window.__tienloLocalRequest(useVision?'planVision':'plan', {key:memoryKey,quest:plan?.objective || plan?.targetLabel || '',
        ...(useVision?{region}:{}),
        dialog:choiceRoot.textContent.trim().slice(0,6000),options:labels,
        map:plan?.mapId || '',hpPercent:safe(()=>readState().hpPercent)}).then(result=>{
          if (dialogDecision.ai === requestState && dialogDecision.signature === signature) requestState.result=result;
        }).catch(error=>{reportOnce('vision-error','quest',`AI chưa phân tích được · ${error.message} · dùng fallback`,5000);}).finally(()=>{requestState.pending=false;});
    }
    const decision = dialogDecision.ai?.result?.decision;
    const aiIndex = decision?.optionIndex;
    const aiChoice = config.aiPlanner !== false && Number.isInteger(aiIndex) && aiIndex >= 0 && aiIndex < buttons.length &&
      decision.action === 'select_dialog_option' && decision.confidence >= .6 && decision.confidence <= 1 &&
      decision.label === labels[aiIndex] && buttons[aiIndex].id !== 'dialog-close' && visibleButton(buttons[aiIndex]) &&
      !/thieu|xoa|vut|pha huy|huy nhiem vu|do sat|^(lui buoc|quay lai|dong|de sau|✕|×)$/.test(fold(labels[aiIndex])) &&
      (choiceValues.get(JSON.stringify([memoryKey,labels[aiIndex]])) || 0) >= 0
      ? {index:aiIndex,reason:`AI · ${String(decision.reason || '').slice(0,400)}`} : null;
    const choice = confident ? ranked[0] : aiChoice || fallback;
    if (choice) {
      lastDialogChoiceAt = Date.now();
      dialogDecision.acted.add(signature);
      if (dialogDecision.acted.size > 50) dialogDecision.acted.delete(dialogDecision.acted.values().next().value);
      const button = buttons[choice.index];
      if (window.__tienloWorkflow && !window.__tienloWorkflow.attempt(
          JSON.stringify([window.PNTT?.SceneWorld?.player?.cfg?.name,window.PNTT?.Quest?.stage,readHud().objectives]),labels[choice.index])) {
        choiceValues.set(JSON.stringify([memoryKey,labels[choice.index]]),-20);
        logDialogFailure(plan,choiceRoot,allButtons,'repeated_action_limit',waitedMs);
        report('quest',`ĐỔI CÁCH · ${labels[choice.index]} đã thử 4 lần mà quest chưa tiến triển`);
        return true;
      }
      if (plan?.stepId==='luyen_dan' && window.__tienloWorkflow &&
          !window.__tienloWorkflow.canExecute(window.__tienloWorkflow.observe(button,plan))) {
        const back=detail?.querySelector('.panel-x')||root.querySelector('#dialog-close');
        if(back){back.click();dialogDecision.signature='';dialogDecision.ai=null;}
        reportOnce('wrong-recipe','quest','KHÔNG LUYỆN · tên đan chưa khớp nhiệm vụ, quay lại kiểm tra',2500);
        return true;
      }
      report('quest', `${confident ? 'QUYẾT ĐỊNH' : 'THỬ MỘT LẦN'} · ${button.textContent.trim()} · ${choice.reason}`);
      button.click();
      return true;
    }
    reportOnce('quest-decision-uncertain', 'quest',
      'TẠM DỪNG · chưa đủ căn cứ chọn đúng; giữ hội thoại để phân tích', 5000);
    return true;
  }

  function visibleDialog() {
    return [...document.querySelectorAll('[role="dialog"]')].find(element => {
      if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' &&
        element.getClientRects().length > 0;
    }) || null;
  }

  function resetZoneQuestState() {
    zoneQuestState = {
      key: '', progress: '', lastProgressAt: 0, lastListAt: 0, listRequestedAt: 0,
      lastSwitchAt: 0, counts: [], attempted: new Set()
    };
  }

  function ensureZoneListProbe(P) {
    const ui = P.KhuUI;
    if (!ui || ui.__tienloListProbe) return;
    const original = ui.onList;
    if (typeof original !== 'function') return;
    ui.onList = function(packet) {
      if (packet && packet.mapId === ui.mapId) {
        zoneQuestState.counts = Array.isArray(packet.dem)
          ? packet.dem.map(value => Math.max(0, Number(value) || 0)) : [];
        zoneQuestState.lastListAt = Date.now();
        if (packet.khu > 0) ui.khu = Number(packet.khu) | 0;
      }
      return original.apply(this, arguments);
    };
    ui.__tienloListProbe = true;
  }

  function questProgressSignature(plan) {
    const P = window.PNTT || {};
    const bag = P.Inventory?.bag || {};
    const items = (plan.itemIds || []).map(id => `${id}:${Number(bag[id]) || 0}`).join('|');
    return [P.Quest?.stage, ...readHud().objectives, items].join('|');
  }

  function resetQuestWatchdog(plan = null) {
    questWatchdog = {
      key: plan ? planKey(plan) : '',
      signature: plan ? questProgressSignature(plan) : '',
      progressAt: Date.now(), snapshotAt: 0, recoveries: 0, lastAnalysis: ''
    };
  }

  function visibleElement(selector) {
    const element = document.querySelector(selector);
    if (!element || element.hidden || element.classList.contains('hidden') || !element.getClientRects().length)
      return null;
    const style = getComputedStyle(element);
    return style.display === 'none' || style.visibility === 'hidden' ? null : element;
  }

  function diagnoseQuestStall(plan, stalledSeconds) {
    const P = window.PNTT || {};
    const scene = P.SceneWorld || {};
    const player = scene.player;
    const dialog = visibleElement('#dialog');
    const encyclopedia = visibleElement('#encyclopedia');
    const gacha = visibleElement('#gacha');
    const buttons = dialog ? [...dialog.querySelectorAll('button')]
      .filter(button => button.getClientRects().length && !button.disabled)
      .map(button => button.textContent.trim()).filter(Boolean) : [];
    let analysis = 'chưa xác định nguyên nhân';
    if (encyclopedia) analysis = 'vòng lặp mở Bách Khoa';
    else if (gacha) analysis = 'kẹt tại tủ bí tịch';
    else if (dialog) analysis = `kẹt hội thoại: ${buttons.join(' / ') || 'không có lựa chọn'}`;
    else if (plan.mapId && plan.mapId !== scene.map?.data?.id) analysis = 'chưa tới đúng bản đồ nhiệm vụ';
    else if (plan.action === 'attack') analysis = 'không tìm thấy hoặc không hạ được đúng quái';
    else if (plan.action === 'interact') analysis = 'không tới được hoặc chưa kích hoạt đúng điểm tương tác';

    const hud = readHud();
    const snapshot = {
      at: new Date().toISOString(), version: HOOK_VERSION, stalledSeconds, analysis,
      quest: { stage: P.Quest?.stage, title: hud.questStage, objectives: hud.objectives },
      plan: { action: plan.action, actionLabel: plan.actionLabel, targetLabel: plan.targetLabel,
        mapId: plan.mapId, ids: plan.ids || [], itemIds: plan.itemIds || [] },
      world: { mapId: scene.map?.data?.id || '', map: scene.map?.data?.name || '',
        x: Number.isFinite(+player?.x) ? Math.round(player.x) : null,
        y: Number.isFinite(+player?.y) ? Math.round(player.y) : null,
        target: lastQuestTarget },
      ui: { dialog: dialog?.querySelector('#dialog-text')?.textContent?.trim() || '', buttons,
        encyclopedia: !!encyclopedia, gacha: !!gacha },
      knowledge: knowledgeMatches(plan.objective, 3)
        .map(row => ({ id: row.id, kind: row.kind, name: row.name }))
    };
    const history = safe(() => JSON.parse(
      localStorage.getItem('tienlo-quest-diagnostics-v1') || '[]'), []);
    const rows = Array.isArray(history) ? history : [];
    rows.unshift(snapshot);
    safe(() => localStorage.setItem('tienlo-quest-diagnostics-v1',
      JSON.stringify(rows.slice(0, 30))));
    questWatchdog.lastAnalysis = analysis;
    return snapshot;
  }

  function questWatchdogTick(plan) {
    const P = window.PNTT || {};
    const now = Date.now();
    const key = planKey(plan);
    const signature = questProgressSignature(plan);
    if (questWatchdog.key !== key || questWatchdog.signature !== signature) {
      resetQuestWatchdog(plan);
      return false;
    }
    const stalledFor = now - questWatchdog.progressAt;
    if (stalledFor < 20000 || now - questWatchdog.snapshotAt < 15000) return false;
    questWatchdog.snapshotAt = now;
    questWatchdog.recoveries++;
    stats.stuckCount++;
    const snapshot = diagnoseQuestStall(plan, Math.floor(stalledFor / 1000));
    post({type:'TIENLO_QUEST_FAILURE',payload:{...snapshot,outcome:'fail',reason:'quest_stuck',
      dialog:snapshot.ui.dialog,character:P.SceneWorld?.player?.cfg?.name || ''}});
    report('quest', `AI WATCHDOG · kẹt ${snapshot.stalledSeconds}s · ${snapshot.analysis}`);
    if (questWatchdog.recoveries >= 4) {
      settleChoiceMemory('repeated_recovery_limit');
      stop('safe','DỪNG CHỐNG LẶP · 4 lần khôi phục không có tiến triển; log đã lưu trong Quest line');
      return true;
    }

    const encyclopedia = visibleElement('#encyclopedia');
    if (encyclopedia) {
      lastDialogChoiceAt = now;
      document.querySelector('#encyclopedia-close')?.click();
      return true;
    }
    const dialog = visibleElement('#dialog');
    if (dialog) {
      const buttons = [...dialog.querySelectorAll('button')].filter(button =>
        !button.disabled && button.getClientRects().length);
      if (handleBachKhoaDialog(buttons)) return true;
    }
    lastQuestTarget = '';
    lastQuestRouteAt = 0;
    exploreState = { key: '', mapId: '', waypoints: [], index: 0, exhaustedAt: 0 };
    return false;
  }

  function maybeSwitchQuietZone(plan) {
    const P = window.PNTT || {};
    const scene = P.SceneWorld;
    const ui = P.KhuUI;
    const gateway = P.Gateway;
    if (!gateway?.connected || !ui || Number(ui.soKhu) <= 1 || !scene?.map?.data?.id) return false;
    ensureZoneListProbe(P);

    const now = Date.now();
    const current = Math.max(1, Number(ui.khu) || 1);
    const total = Math.max(1, Number(ui.soKhu) || 1);
    const key = `${planKey(plan)}|${scene.map.data.id}`;
    const progress = questProgressSignature(plan);
    if (zoneQuestState.key !== key) {
      resetZoneQuestState();
      zoneQuestState.key = key;
      zoneQuestState.progress = progress;
      zoneQuestState.lastProgressAt = now;
      zoneQuestState.attempted.add(current);
      return false;
    }
    if (zoneQuestState.progress !== progress) {
      zoneQuestState.progress = progress;
      zoneQuestState.lastProgressAt = now;
      zoneQuestState.attempted = new Set([current]);
      return false;
    }

    const stalledFor = now - zoneQuestState.lastProgressAt;
    if (stalledFor >= 12000 && now - zoneQuestState.lastListAt > 5000 &&
      now - zoneQuestState.listRequestedAt > 3000) {
      zoneQuestState.listRequestedAt = now;
      safe(() => gateway.send?.({ op: 'khu', act: 'xem' }), false);
      reportOnce('quest-zone-probe', 'quest',
        `ĐANG TÌM KHU VẮNG · chưa có tiến độ ${Math.floor(stalledFor / 1000)} giây`, 2500);
    }
    if (stalledFor < 15000 || now - zoneQuestState.lastSwitchAt < 12000 ||
      now - zoneQuestState.lastListAt > 6000) return false;

    let candidates = [];
    for (let khu = 1; khu <= total; khu++) {
      if (khu === current || zoneQuestState.attempted.has(khu)) continue;
      const count = Number(zoneQuestState.counts[khu - 1]);
      candidates.push({ khu, count: Number.isFinite(count) ? count : Number.MAX_SAFE_INTEGER });
    }
    if (!candidates.length) {
      zoneQuestState.attempted = new Set([current]);
      for (let khu = 1; khu <= total; khu++) {
        if (khu === current) continue;
        const count = Number(zoneQuestState.counts[khu - 1]);
        candidates.push({ khu, count: Number.isFinite(count) ? count : Number.MAX_SAFE_INTEGER });
      }
    }
    candidates.sort((a, b) => a.count - b.count || a.khu - b.khu);
    const target = candidates[0];
    if (!target) return false;

    const sent = safe(() => gateway.send?.({ op: 'khu', act: 'chon', khu: target.khu }), false);
    if (!sent) return false;
    zoneQuestState.attempted.add(target.khu);
    zoneQuestState.lastSwitchAt = now;
    zoneQuestState.lastProgressAt = now;
    lastQuestTarget = '';
    lastQuestRouteAt = 0;
    exploreState = { key: '', mapId: '', waypoints: [], index: 0, exhaustedAt: 0 };
    report('quest', `ĐỔI KHU · ${current} → ${target.khu} · ${target.count === Number.MAX_SAFE_INTEGER ? 'chưa rõ' : target.count} người`);
    return true;
  }

  function mapDefinitions() {
    const defs = new Map();
    const data = window.PNTT?.MapData || {};
    const pending = [];
    const add = value => {
      if (!value?.id || !Array.isArray(value.portals) || defs.has(value.id)) return;
      defs.set(value.id, value);
      pending.push(value);
    };
    Object.values(data).forEach(add);
    const current = window.PNTT?.SceneWorld?.map?.data;
    add(current);
    for (const value of worldMaps.values()) {
      add(safe(() => data.get?.(value.id), value));
    }
    // New maps may only be exposed through get(), rather than enumerable fields.
    while (pending.length) {
      for (const portal of pending.shift().portals) {
        if (portal?.toMap && !defs.has(portal.toMap))
          add(safe(() => data.get?.(portal.toMap)));
      }
    }
    return defs;
  }

  function saveWorldMaps() {
    if (!helperWindow || helperWindow.closed) return;
    const compact = object => Object.fromEntries(Object.entries(object || {}).filter(([key, value]) =>
      ['id','type','name','x','y','r','toMap','toX','toY','byHand'].includes(key)
      && ['string','number','boolean'].includes(typeof value)));
    for (const def of mapDefinitions().values()) {
      const map = { id: def.id, name: def.name, width: def.width, height: def.height,
        portals: (def.portals || []).map(compact),
        objects: (def.objects || []).map(compact), enemies: (def.enemies || []).map(compact) };
      const signature = JSON.stringify(map);
      if (mapMemorySignatures.get(map.id) === signature) continue;
      worldMaps.set(map.id, map);
      mapMemorySignatures.set(map.id, signature);
      post({ type: 'TIENLO_QUEST_FAILURE', payload: { at: new Date().toISOString(),
        outcome: 'success', reason: `world_map:${map.id}`, dialog: '', map } });
    }
  }

  // Use the same feet-anchored collision rectangle as Player movement.
  function safePathRoute(map, sx, sy, ex, ey) {
    const P = window.PNTT || {};
    const tile = +P.CONFIG?.TILE || 32;
    const halfW = (+P.CONFIG?.PLAYER?.HITBOX_W || 18) / 2;
    const height = +P.CONFIG?.PLAYER?.HITBOX_H || 24;
    if (!map?.rectBlocked || !P.Pathfinder?.find) return [];
    const clear = (x, y) => !map.rectBlocked(x - halfW, y - height, x + halfW, y);
    const segmentClear = (a, b) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
      for (let i = 0; i <= steps; i++)
        if (!clear(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps)) return false;
      return true;
    };
    const start = { x: sx, y: sy }, end = { x: ex, y: ey };
    if (!clear(ex, ey)) return [];
    if (segmentClear(start, end)) return [end];
    const grid = {
      width: map.width, height: map.height,
      isBlockedTile: (x, y) => map.isBlockedTile(x, y)
        || !clear((x + .5) * tile, (y + .5) * tile)
    };
    const cells = P.Pathfinder.find(grid, Math.floor(sx / tile), Math.floor(sy / tile),
      Math.floor(ex / tile), Math.floor(ey / tile), Math.max(4000, map.width * map.height));
    if (!Array.isArray(cells)) return [];
    const points = cells.map(p => ({ x: (p.tx + .5) * tile, y: (p.ty + .5) * tile }));
    points.push(end);
    const route = [];
    let anchor = start, index = 0;
    while (index < points.length) {
      let next = points.length - 1;
      while (next >= index && !segmentClear(anchor, points[next])) next--;
      if (next < index) return []; // Never fall back to a colliding adjacent step.
      route.push(points[next]);
      anchor = points[next];
      index = next + 1;
    }
    return route;
  }

  function routeDistance(player, route) {
    let previous = player, distance = 0;
    for (const point of route) {
      distance += Math.hypot(point.x - previous.x, point.y - previous.y);
      previous = point;
    }
    return distance;
  }

  function routeToInteractable(scene, player, obj, targetKey = '', variant = 0) {
    const P = window.PNTT || {};
    const halfW = (+P.CONFIG?.PLAYER?.HITBOX_W || 18) / 2;
    const height = +P.CONFIG?.PLAYER?.HITBOX_H || 24;
    const tile = +P.CONFIG?.TILE || 32;
    const scenery = targetKey.startsWith('scn:') || scene.map?.interactables?.includes(obj) || scene.interactables?.includes(obj);
    const centerY = scenery ? obj.y : obj.y - tile / 2;
    // Targeting.propReach is a selection radius, not permission to interact remotely.
    const nativeReach = +safe(() => P.Targeting?.propReach?.(obj), obj.r || 40) || 40;
    const reach = Math.min(48, Math.max(12, nativeReach - 8));
    const candidates = [{ x: obj.x, y: centerY }];
    const radius = Math.max(22, reach - 7);
    for (let index = 0; index < 12; index++) {
      const angle = Math.PI * 2 * index / 12;
      candidates.push({ x: obj.x + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius });
    }
    const routes = candidates.map(point => safe(() => safePathRoute(
      scene.map, player.x, player.y, point.x, point.y, halfW, height), []))
      .filter(route => Array.isArray(route) && route.length &&
        Math.hypot(route.at(-1).x - obj.x, route.at(-1).y - centerY) <= reach);
    routes.sort((a, b) => routeDistance(player, a) - routeDistance(player, b));
    return { route: routes.length ? routes[Math.min(variant,routes.length-1)] : [], reach, centerY };
  }

  function mapRoute(from, to) {
    if (!from || !to) return null;
    if (from === to) return [from];
    const defs = mapDefinitions();
    const knownLinks = {
      tan_vien: ['thanh_truc_lam', 'mieu_hoang', 'dong_mach_ngam'],
      thanh_truc_lam: ['tan_vien', 'duoc_vien', 'long_uyen'],
      duoc_vien: ['thanh_truc_lam', 'vuon_ca_nhan'],
      vuon_ca_nhan: ['duoc_vien'],
      mieu_hoang: ['tan_vien'],
      long_uyen: ['thanh_truc_lam', 'hang_dong_co'],
      hang_dong_co: ['long_uyen']
    };
    const queue = [[from]];
    const seen = new Set([from]);
    while (queue.length) {
      const path = queue.shift();
      const def = defs.get(path[path.length - 1]);
      const neighbors = [...new Set([...(def?.portals || []).filter(portal => !portal.byHand)
        .map(portal => portal.toMap), ...(knownLinks[path[path.length - 1]] || [])].filter(Boolean))];
      for (const neighbor of neighbors) {
        if (seen.has(neighbor)) continue;
        const next = [...path, neighbor];
        if (neighbor === to) return next;
        seen.add(neighbor);
        queue.push(next);
      }
    }
    return null;
  }

  function navigateToMap(plan, forceRoute = false) {
    const P = window.PNTT || {};
    const scene = P.SceneWorld;
    const player = scene?.player;
    const current = scene?.map?.data?.id;
    if (!player || !current || !plan?.mapId || current === plan.mapId) return false;
    const maps = mapRoute(current, plan.mapId);
    if (!maps || maps.length < 2) {
      holdQuestPosition();
      reportOnce(`quest-map-no-route:${current}:${plan.mapId}`, 'quest',
        `Không tìm được chuỗi cổng ${current} → ${plan.mapId}`);
      return true;
    }
    const nextMap = maps[1];
    const tile = scene.map.pxWidth && scene.map.width ? scene.map.pxWidth / scene.map.width : 32;
    const portals = (scene.map.portals || scene.map.data?.portals || [])
      .filter(portal => portal?.toMap === nextMap && !portal.byHand)
      .map(portal => ({ portal, x: portal.tx * tile + tile / 2, y: portal.ty * tile + tile / 2 }))
      .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
    for (const entry of portals) {
      const key = `portal:${current}:${nextMap}:${entry.portal.tx},${entry.portal.ty}`;
      const now = Date.now();
      if (!forceRoute && key === lastQuestTarget && now - lastQuestRouteAt < 1800) return true;
      const route = safe(() => safePathRoute(scene.map, player.x, player.y,
        entry.x, entry.y, (+P.CONFIG?.PLAYER?.HITBOX_W || 18) / 2,
        +P.CONFIG?.PLAYER?.HITBOX_H || 24), []);
      if (Array.isArray(route) && route.length) {
        scene.approach = null;
        safe(() => P.Player?.stand?.(player));
        safe(() => player.setPath?.(route));
        lastQuestTarget = key;
        lastQuestRouteAt = now;
        reportOnce(`quest-portal:${current}:${nextMap}`, 'quest',
          `ĐI BẢN ĐỒ · ${current} → ${nextMap} · còn ${maps.length - 1} chặng`, 3000);
        return true;
      }
    }
    holdQuestPosition();
    reportOnce(`quest-portal-blocked:${current}:${nextMap}`, 'quest',
      `Không có đường đi được tới cổng ${nextMap}`);
    return true;
  }

  function buildExploreWaypoints(plan) {
    const scene = window.PNTT?.SceneWorld;
    const map = scene?.map;
    const player = scene?.player;
    if (!map || !player) return [];
    const tile = map.pxWidth && map.width ? map.pxWidth / map.width : 32;
    const points = [];
    const add = (x, y, source) => {
      if (!Number.isFinite(+x) || !Number.isFinite(+y)) return;
      if (points.some(point => Math.hypot(point.x - x, point.y - y) < tile * 2)) return;
      points.push({ x: +x, y: +y, source });
    };
    learnedSpots(plan).forEach(row => add(row.x, row.y, 'đã học'));
    const spawns = [...(map.data?.enemies || []), ...(map.enemySpawns || [])];
    spawns.filter(spawn => enemyMatches({ type: spawn.type, id: spawn.id,
      def: window.PNTT?.ENEMIES?.[spawn.type] || window.PNTT?.MOBS?.[spawn.type] }, plan))
      .forEach(spawn => add(spawn.tx * tile + tile / 2, spawn.ty * tile + tile / 2, 'điểm sinh'));
    const grid = [];
    for (let ty = 3; ty < map.height - 2; ty += 6) {
      for (let tx = 3; tx < map.width - 2; tx += 6) {
        if (!map.isBlockedTile?.(tx, ty)) grid.push({ x: tx * tile + tile / 2,
          y: ty * tile + tile / 2, source: 'quét' });
      }
    }
    grid.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
    grid.forEach(point => add(point.x, point.y, point.source));
    return points;
  }

  function questExploreTick(plan, forceRoute = false) {
    const P = window.PNTT || {};
    const scene = P.SceneWorld;
    const player = scene?.player;
    if (!player) return;
    const key = planKey(plan);
    const mapId = scene.map?.data?.id || '';
    if (exploreState.key !== key || exploreState.mapId !== mapId ||
      (exploreState.exhaustedAt && Date.now() - exploreState.exhaustedAt > 15000)) {
      exploreState = { key, mapId, waypoints: buildExploreWaypoints(plan), index: 0, exhaustedAt: 0 };
    }
    for (let attempts = 0; attempts < 6; attempts++) {
      const point = exploreState.waypoints[exploreState.index];
      if (!point) {
        if (!exploreState.exhaustedAt) exploreState.exhaustedAt = Date.now();
        holdQuestPosition();
        return reportOnce(`quest-scan-complete:${key}`, 'quest',
          `ĐÃ QUÉT HẾT · ${plan.targetLabel} chưa xuất hiện · sẽ quét lại`, 5000);
      }
      const dist = Math.hypot(point.x - player.x, point.y - player.y);
      if (dist < 52) {
        exploreState.index++;
        continue;
      }
      const routeKey = `scan:${key}:${exploreState.index}`;
      const now = Date.now();
      if (!forceRoute && routeKey === lastQuestTarget && now - lastQuestRouteAt < 1800) return;
      const route = safe(() => safePathRoute(scene.map, player.x, player.y,
        point.x, point.y, (+P.CONFIG?.PLAYER?.HITBOX_W || 18) / 2,
        +P.CONFIG?.PLAYER?.HITBOX_H || 24), []);
      if (!Array.isArray(route) || !route.length) {
        exploreState.index++;
        continue;
      }
      scene.approach = null;
      safe(() => P.Player?.stand?.(player));
      safe(() => player.setPath?.(route));
      lastQuestTarget = routeKey;
      lastQuestRouteAt = now;
      return reportOnce(routeKey, 'quest',
        `QUÉT ${exploreState.index + 1}/${exploreState.waypoints.length} · ${point.source} ${Math.round(point.x)},${Math.round(point.y)} · tìm ${plan.targetLabel}`, 2500);
    }
  }

  function questAttackTick(plan, forceRoute = false) {
    if (Date.now() < kiteUntil) return;
    const P = window.PNTT || {};
    const scene = P.SceneWorld;
    const player = scene?.player;
    if (!player) return;

    const wantedItems = (plan.itemIds || []).map(String);
    const drop = (scene.drops || []).filter(item => item && wantedItems.includes(String(item.itemId)))
      .map(item => ({ item, dist: Math.hypot(item.x - player.x, item.y - player.y) }))
      .sort((a, b) => a.dist - b.dist)[0];
    if (drop) {
      const key = `drop:${drop.item.lootId || drop.item.itemId}`;
      const now = Date.now();
      if (forceRoute || key !== lastQuestTarget || now - lastQuestRouteAt >= 1200) {
        const route = safe(() => safePathRoute(scene.map, player.x, player.y,
          drop.item.x, drop.item.y, 9, 24), []);
        if (Array.isArray(route) && route.length) safe(() => player.setPath?.(route));
        lastQuestTarget = key;
        lastQuestRouteAt = now;
      }
      return reportOnce(`quest-pick:${drop.item.itemId}`, 'quest',
        `NHẶT · ${drop.item.itemId} tại ${Math.round(drop.item.x)},${Math.round(drop.item.y)}`, 2500);
    }

    const candidates = (scene.enemies || []).filter(enemy => enemy && !enemy.dead &&
      (+enemy.hp > 0 || enemy.hp == null) && enemyMatches(enemy, plan))
      .map(enemy => ({ enemy, dist: Math.hypot(enemy.x - player.x, enemy.y - player.y) }))
      .sort((a, b) => a.dist - b.dist);
    const selected = candidates.find(item => P.Targeting?.key === `foe:${item.enemy.id}`) || candidates[0];
    if (!selected) {
      return questExploreTick(plan, forceRoute);
    }

    const enemy = selected.enemy;
    if (player.state === 'attack' || player.state === 'pose') return;
    rememberSpot(plan, enemy.x, enemy.y, 'quái');
    const key = `foe:${enemy.id}`;
    if (P.Targeting) {
      P.Targeting.key = key;
      P.Targeting.manual = true;
    }
    scene.approach = null;
    const reach = +safe(() => P.Player?.reach?.(), 48) || 48;
    const now = Date.now();
    if (selected.dist > reach + (+enemy.def?.bodyRadius || 0)) {
      if (forceRoute || key !== lastQuestTarget || now - lastQuestRouteAt >= 1200) {
        const route = safe(() => safePathRoute(scene.map, player.x, player.y,
          enemy.x, enemy.y, (+P.CONFIG?.PLAYER?.HITBOX_W || 18) / 2,
          +P.CONFIG?.PLAYER?.HITBOX_H || 24), []);
        if (Array.isArray(route) && route.length) {
          safe(() => P.Player?.stand?.(player));
          safe(() => player.setPath?.(route));
          lastQuestTarget = key;
          lastQuestRouteAt = now;
        }
      }
      return reportOnce(`quest-hunt:${enemy.type || enemy.id}`, 'quest',
        `ĐÁNH · đang tới ${enemy.def?.name || enemy.name || plan.targetLabel} tại ${Math.round(enemy.x)},${Math.round(enemy.y)}`, 3000);
    }

    safe(() => player.setPath?.([]));
    if (config.skillSlots.length) P.Input?.pressSlot?.(config.skillSlots[skillIndex++ % config.skillSlots.length]);
    P.Input?.pressAttack?.();
    reportOnce(`quest-fight:${enemy.type || enemy.id}`, 'quest',
      `ĐÁNH · ${enemy.def?.name || enemy.name || plan.targetLabel} · còn ${candidates.length} mục tiêu`, 3000);
  }

  function questTick(forceRoute = false) {
    if (window.PNTT?.SceneWorld?.player?.downed || reviveState.since) return;
    if (retreatTick()) return;
    if (config.recoverHealth && recoveryTick()) return;
    if (Date.now() < kiteUntil) return;
    if (mode !== 'quest' || meditating) return;
    const P = window.PNTT || {};
    const scene = P.SceneWorld;
    const player = scene?.player;
    if (!player || !scene.map) {
      return reportOnce('quest-no-world', 'quest', 'Chưa vào thế giới game');
    }
    if (questDefenseTick()) return;
    const plan = analyzeQuest();
    if (questWatchdogTick(plan)) return;
    if (handleQuestOverlay()) return;
    const hudDialogOpen = typeof P.HUD?.dialogOpen === 'function'
      ? safe(() => P.HUD.dialogOpen(), false)
      : !!P.HUD?.dialogOpen;
    if (hudDialogOpen || visibleDialog()) {
      if (plan.farmXp) {
        const root = visibleElement('#dialog');
        const detail = root?.querySelector('.forge-detail');
        const back = detail?.querySelector('.panel-x') || root?.querySelector('#dialog-close');
        if (back && Date.now() - lastDialogChoiceAt >= 1400) {
          lastDialogChoiceAt = Date.now();
          back.click();
          lastQuestTarget = '';
          lastQuestRouteAt = 0;
          report('quest', 'FARM ĐẠO HẠNH · đóng hội thoại, đi săn quái đến khi đủ');
        }
        return;
      }
      if (clickQuestDialogDecision(plan)) return;
      return reportOnce('quest-dialog', 'quest', 'Đang phân tích lựa chọn hội thoại');
    }

    const currentMap = String(scene.map?.data?.id || '');
    const destinationMap = String(plan.mapId || currentMap);
    if (destinationMap && currentMap && destinationMap !== currentMap)
      return navigateToMap(plan, forceRoute);

    if (plan.action === 'attack') {
      if (maybeSwitchQuietZone(plan)) return;
      return questAttackTick(plan, forceRoute);
    }
    if (plan.action === 'manual') {
      holdQuestPosition();
      return reportOnce(`quest-manual:${plan.targetLabel}`, 'quest',
        `THỦ CÔNG · ${plan.targetLabel}`);
    }

    const nativeGuide = safe(() => P.Quest?.guidePlace?.());
    const guide = { mapId: plan.mapId || nativeGuide?.mapId || currentMap,
      ids: plan.ids?.length ? plan.ids : nativeGuide?.ids || [], anyState: nativeGuide?.anyState };
    if (!guide.ids.length) {
      holdQuestPosition();
      return reportOnce('quest-no-guide', 'quest',
        `Không quét được vị trí cho: ${plan.targetLabel}`);
    }

    const target = questTarget(guide);
    if (!target) {
      holdQuestPosition();
      return reportOnce(`quest-missing:${guide.ids.join(',')}`, 'quest',
        `Không thấy đúng điểm tương tác: ${plan.targetLabel}`);
    }

    rememberSpot(plan, target.obj.x, target.obj.y, 'tương tác');

    if (P.Targeting) {
      P.Targeting.key = target.key;
      P.Targeting.manual = true;
    }
    const now = Date.now();
    const changed = target.key !== lastQuestTarget;
    if (!forceRoute && !changed && now - lastQuestRouteAt < 3500) return;

    const approach = routeToInteractable(scene, player, target.obj, target.key, questWatchdog.recoveries || 0);
    const route = approach.route;
    scene.approach = null;
    const interactionDistance = Math.hypot(target.obj.x - player.x, approach.centerY - player.y);
    if (interactionDistance <= approach.reach) {
      safe(() => player.setPath?.([]));
      lastQuestTarget = target.key;
      lastQuestRouteAt = now;
      if (typeof P.Input?.pressInteract === 'function') {
        P.Input.pressInteract();
        return reportOnce(`quest-arrived:${target.key}`, 'quest',
          `TƯƠNG TÁC E · ${plan.targetLabel} · chờ game xử lý`, 1800);
      }
      scene.approach = {
        obj: target.obj,
        until: (+P.Game?.time || 0) + (+P.CONFIG?.TARGET?.APPROACH_TIME || 8)
      };
      return reportOnce(`quest-arrived:${target.key}`, 'quest',
        `ĐÃ LẠI GẦN · đang tương tác ${plan.targetLabel}`, 1800);
    }
    if (Array.isArray(route) && route.length) {
      safe(() => P.Player?.stand?.(player));
      safe(() => player.setPath?.(route));
      lastQuestTarget = target.key;
      lastQuestRouteAt = now;
      reportOnce(`quest-route:${target.key}`, 'quest',
        `ĐANG LẠI GẦN · ${plan.targetLabel} tại ${Math.round(target.obj.x)},${Math.round(target.obj.y)}`);
    } else {
      holdQuestPosition();
      reportOnce(`quest-no-route:${target.key}`, 'quest',
        `Pathfinder không tìm được điểm đứng gần ${plan.targetLabel}`);
    }
  }

  function updateKills() {
    // Nearby deaths/despawns are not evidence of a personal kill.
    stats.kills = window.__tienloMetrics?.read(window.PNTT?.Progress || {}, 0)?.kills || 0;
  }

  function questDefenseTick() {
    if (Date.now() < kiteUntil) return true;
    if (['attack', 'pose'].includes(window.PNTT?.SceneWorld?.player?.state)) return true;
    const P = window.PNTT || {};
    const scene = P.SceneWorld;
    const player = scene?.player;
    if (!player) return false;
    const mapId = scene.map?.data?.id;
    const damaged = defenseState.mapId === mapId &&
      ((defenseState.hp != null && player.hp < defenseState.hp) ||
       (defenseState.bp != null && player.bp < defenseState.bp));
    defenseState.mapId = mapId;
    defenseState.hp = player.hp;
    defenseState.bp = player.bp;
    const nearby = (scene.enemies || []).filter(enemy => enemy && !enemy.dead &&
      !enemy.def?.human && !enemy.human && (+enemy.hp > 0 || enemy.hp == null) &&
      Math.hypot(enemy.x - player.x, enemy.y - player.y) <= 160)
      .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
    if (damaged && nearby.length) {
      defenseState.enemy = nearby[0];
      defenseState.until = Date.now() + 5000;
    }
    const enemy = defenseState.enemy;
    if (!enemy || !nearby.includes(enemy) || Date.now() > defenseState.until) {
      if (enemy) {
        if (P.Targeting?.key === `foe:${enemy.id}`) {
          P.Targeting.key = null;
          P.Targeting.manual = false;
        }
        lastQuestTarget = '';
        lastQuestRouteAt = 0;
        reportOnce('quest-defense-resume', 'quest', 'TIẾP TỤC QUEST · kết thúc tự vệ, tìm lại đường tới mục tiêu', 2500);
      }
      defenseState.enemy = null;
      return false;
    }
    const dialog = visibleElement('#dialog');
    if (dialog) {
      dialog.querySelector('#dialog-close')?.click();
      // A closed dialog was interrupted, not successfully completed.
      dialogDecision.acted.delete(dialogDecision.signature);
      dialogDecision.signature = '';
      dialogDecision.observedAt = 0;
      return true;
    }
    if (P.Targeting) {
      P.Targeting.key = `foe:${enemy.id}`;
      P.Targeting.manual = true;
    }
    scene.approach = null;
    safe(() => P.Player?.stand?.(player));
    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    const reach = (+safe(() => P.Player?.reach?.(), 48) || 48) + (+enemy.def?.bodyRadius || 0);
    if (distance > reach) {
      const key = `defense:${enemy.id}`;
      if (lastQuestTarget !== key || Date.now() - lastQuestRouteAt >= 1200) {
        const route = safe(() => safePathRoute(scene.map, player.x, player.y,
          enemy.x, enemy.y, (+P.CONFIG?.PLAYER?.HITBOX_W || 18) / 2,
          +P.CONFIG?.PLAYER?.HITBOX_H || 24), []);
        if (route.length) safe(() => player.setPath?.(route));
        lastQuestTarget = key;
        lastQuestRouteAt = Date.now();
      }
      reportOnce('quest-defense-approach', 'quest', 'TỰ VỆ · tiến tới quái để vào tầm đánh', 2500);
      return true;
    }
    safe(() => player.setPath?.([]));
    if (config.skillSlots.length) P.Input?.pressSlot?.(config.skillSlots[skillIndex++ % config.skillSlots.length]);
    P.Input?.pressAttack?.();
    reportOnce('quest-defense', 'quest', `TỰ VỆ · bị mất máu/giáp, đánh quái gần nhất: ${enemy.def?.name || enemy.name || enemy.type}`, 2500);
    return true;
  }

  function retreatTick() {
    const P = window.PNTT || {};
    const scene = P.SceneWorld;
    const player = scene?.player;
    if (!player || player.downed || !(player.hp > 0)) return false;
    const now = Date.now();
    const mapId = scene.map?.data?.id;
    if (retreatState.mapId !== mapId) retreatState = { mapId, hp: player.hp, bp: player.bp, hits: [], until: 0, routeAt: 0 };
    const hpLost = Math.max(0, (retreatState.hp ?? player.hp) - player.hp);
    const bpLost = Math.max(0, (retreatState.bp ?? player.bp) - player.bp);
    retreatState.hp = player.hp;
    retreatState.bp = player.bp;
    retreatState.hits = retreatState.hits.filter(hit => now - hit.at <= 3000);
    if (hpLost || bpLost) retreatState.hits.push({ at: now, hp: hpLost, bp: bpLost });
    const threats = (scene.enemies || []).filter(enemy => enemy && !enemy.dead &&
      (+enemy.hp > 0 || enemy.hp == null) && Math.hypot(enemy.x - player.x, enemy.y - player.y) < 260);
    const hpDamage = retreatState.hits.reduce((sum, hit) => sum + hit.hp, 0);
    const bpDamage = retreatState.hits.reduce((sum, hit) => sum + hit.bp, 0);
    const lowHp = player.hpMax > 0 && player.hp / player.hpMax * 100 < config.hpThreshold;
    const criticalHp = player.hpMax > 0 && player.hp / player.hpMax * 100 < (config.retreatHpThreshold ?? 20);
    const heavyDamage = (player.hpMax > 0 && hpDamage >= player.hpMax * (config.damageHpThreshold ?? 20) / 100) ||
      (player.bpMax > 0 && bpDamage >= player.bpMax * (config.damageArmorThreshold ?? 35) / 100);
    // Low HP alone is not evidence of a strong attack. Only fresh damage
    // may trigger/extend an escape; old samples must not refresh the timer.
    if (config.retreatEnabled !== false && criticalHp && threats.length && heavyDamage && (hpLost > 0 || bpLost > 0)) {
      retreatState.until = now + (config.retreatSeconds ?? 8) * 1000;
      for (const enemy of threats) avoidedEnemies.set(`${mapId}:${enemy.id}`, now + 60000);
    }
    if (!retreatState.until) return false;
    const lastHitAt = retreatState.hits.at(-1)?.at || 0;
    const safeFromContact = !threats.some(enemy =>
      Math.hypot(enemy.x - player.x, enemy.y - player.y) < 120);
    if (config.retreatEnabled === false || !criticalHp || now >= retreatState.until || (safeFromContact && now - lastHitAt >= 1000)) {
      retreatState.until = 0;
      retreatState.hits = [];
      lastQuestTarget = '';
      lastQuestRouteAt = 0;
      defenseState.enemy = null;
      safe(() => player.setPath?.([]));
      kiteUntil = 0;
      setNativeAuto(mode === 'farm' && !lowHp);
      if (lowHp && config.stopLowHp && !config.recoverHealth) {
        stop('safe', 'ĐÃ DỪNG CHẠY · Khí Huyết thấp, chờ hồi phục');
        return true;
      }
      report('quest', 'ĐÃ THOÁT · tiếp tục, tránh quái vừa đánh quá mạnh trong 60 giây');
      return false;
    }
    setNativeAuto(false);
    meditating = false;
    recoveryState.phase = 'idle';
    if (P.Targeting) { P.Targeting.key = null; P.Targeting.manual = false; }
    scene.approach = null;
    visibleElement('#dialog')?.querySelector('#dialog-close')?.click();
    safe(() => P.Player?.stand?.(player));
    if (now - retreatState.routeAt >= 1200) {
      retreatState.routeAt = now;
      const candidates = [];
      for (const radius of [160, 260, 360]) {
        for (let index = 0; index < 12; index++) {
          const angle = index * Math.PI / 6;
          const x = player.x + Math.cos(angle) * radius, y = player.y + Math.sin(angle) * radius;
          const route = safe(() => safePathRoute(scene.map, player.x, player.y, x, y,
            (+P.CONFIG?.PLAYER?.HITBOX_W || 18) / 2, +P.CONFIG?.PLAYER?.HITBOX_H || 24), []);
          if (!route.length) continue;
          const clearance = threats.length ? Math.min(...threats.map(enemy => Math.hypot(x - enemy.x, y - enemy.y))) : radius;
          candidates.push({ route, score: clearance - routeDistance(player, route) * .15 });
        }
      }
      candidates.sort((a, b) => b.score - a.score);
      if (candidates.length) safe(() => player.setPath?.(candidates[0].route));
      else reportOnce('retreat-blocked', 'quest', 'RÚT LUI · chưa tìm được đường thoát', 3000);
    }
    reportOnce('retreat-danger', 'quest', 'RÚT LUI · quái đánh quá mạnh, ngừng đánh và chạy ra xa', 3000);
    return true;
  }

  function kiteTick() {
    if (mode === 'off' || meditating || config.hitRunEnabled === false || Date.now() < retreatState.until) return;
    const P = window.PNTT || {}, scene = P.SceneWorld, player = scene?.player;
    if (!player || player.downed || !scene.map) return;
    const now = Date.now();
    if (kiteUntil) {
      if (now < kiteUntil) return; // A fixed short dodge, never extend it every tick.
      player.setPath?.([]);
      kiteUntil = 0;
      lastQuestRouteAt = 0;
      // Resume the same target; do not turn this dodge into a retreat.
      // Let the normal combat tick resume without forcing a target reselection.
      return;
    }
    const threats = (scene.enemies || []).filter(e => e && !e.dead && +e.hp > 0
      && !e.def?.human && !e.human && +e.def?.contactDmg > 0
      && Math.hypot(e.x - player.x, e.y - player.y) < 180);
    const dangerRadius = e => Math.max(55, (+e.def?.bodyRadius || 16) + 30)
      + Math.min(45, (+e.def?.speed || 40) * .35);
    const danger = threats.some(e => Math.hypot(e.x - player.x, e.y - player.y) < dangerRadius(e));
    if (!danger) return;
    const target = safe(() => P.Targeting?.currentEnemy?.());
    const reach = (+safe(() => P.Player?.reach?.(), 48) || 48) + (+target?.def?.bodyRadius || 0);
    if (!target || target.dead || now-kiteAttackAt < 600) return;
    // Input is not proof that a strike happened. Never interrupt the windup
    // or a skill pose; only dodge after Player has emitted its attack.
    if (player.state !== 'attack' || player.attackFired !== true) return;
    kiteAttackAt = now;
    setNativeAuto(false);
    scene.approach = null;
    kiteRouteAt = now;
    const clearance = point => Math.min(...threats.map(e => Math.hypot(point.x-e.x,point.y-e.y)-dangerRadius(e)));
    const candidates = [];
    const dodgeDistance = config.kiteDistance ?? 36;
    for (const radius of [dodgeDistance * 2 / 3, dodgeDistance]) for (let i=0;i<16;i++) {
      const angle=i*Math.PI/8, end={x:player.x+Math.cos(angle)*radius,y:player.y+Math.sin(angle)*radius};
      const route=safe(() => safePathRoute(scene.map,player.x,player.y,end.x,end.y),[]);
      if (!route.length || clearance(end)<=clearance(player)+10) continue;
      if (routeDistance(player, route) > dodgeDistance * 4 / 3) continue; // No long wall detour for a micro-dodge.
      // The escape must improve clearance immediately, not detour toward a mob.
      const first=route[0], length=Math.hypot(first.x-player.x,first.y-player.y);
      const next={x:player.x+(first.x-player.x)*Math.min(1,20/length),y:player.y+(first.y-player.y)*Math.min(1,20/length)};
      if (clearance(next)<clearance(player)) continue;
      candidates.push({route,score:clearance(end)-routeDistance(player,route)*.15});
    }
    candidates.sort((a,b)=>b.score-a.score);
    if (candidates.length) {
      safe(() => P.Player?.stand?.(player));
      player.setPath?.(candidates[0].route);
      kiteUntil = now + (config.kiteMilliseconds ?? 250);
      lastQuestRouteAt=0;
      reportOnce('kite',mode,`HIT & RUN · đánh → lùi ngắn ${config.kiteMilliseconds ?? 250}ms → đánh tiếp`,2500);
    } else reportOnce('kite-no-route',mode,'HIT & RUN · bị vây, chưa có đường né an toàn',2500);
  }

  function recoveryTick() {
    const P = window.PNTT || {}, scene = P.SceneWorld, player = scene?.player;
    if (mode === 'off' || !player || player.downed || !(player.hpMax > 0)) return false;
    const now = Date.now(), mapId = scene.map?.data?.id;
    const hpPercent = player.hp / player.hpMax * 100;
    if (!config.recoverHealth) {
      if (recoveryState.phase !== 'idle') {
        safe(() => P.Player?.stand?.(player));
        safe(() => player.setPath?.([]));
        recoveryState.phase = 'idle'; meditating = false;
      }
      return false;
    }
    if (recoveryState.phase === 'idle' && hpPercent >= config.recoverHpThreshold) return false;
    if (recoveryState.phase === 'idle' || recoveryState.mapId !== mapId) {
      recoveryState = { phase: 'seeking', mapId, routeAt: 0, attemptAt: 0, attempts: 0,
        startedAt: now, hp: player.hp, progressAt: now };
      kiteUntil = 0;
    }
    if (hpPercent >= config.recoverHpResume) {
      safe(() => P.Player?.stand?.(player));
      safe(() => player.setPath?.([]));
      recoveryState.phase = 'idle'; meditating = false;
      lastQuestRouteAt = 0; lastMovedAt = now;
      setNativeAuto(mode === 'farm');
      report(mode, `ĐÃ HỒI PHỤC · Khí Huyết ${Math.round(hpPercent)}%, tiếp tục`);
      return false;
    }
    meditating = 'recovering';
    setNativeAuto(false);
    scene.approach = null;
    const threats = (scene.enemies || []).filter(e => e && !e.dead && +e.hp > 0 &&
      !e.def?.human && !e.human && e.def?.contactDmg !== 0);
    const clearance = point => threats.length ? Math.min(...threats.map(e =>
      Math.hypot(point.x - e.x, point.y - e.y) - (+e.def?.bodyRadius || 0))) : Infinity;
    if (clearance(player) < config.recoverSafeRadius) {
      if (recoveryState.phase === 'sitting') {
        recoveryState.startedAt = now;
        recoveryState.attempts = 0;
      }
      if (player.state === 'sit') safe(() => P.Player?.stand?.(player));
      recoveryState.phase = 'seeking'; recoveryState.attemptAt = 0;
      if (now - recoveryState.startedAt > 30000) {
        stop('safe', 'HỒI MÁU · tìm nơi an toàn quá 30s, đã dừng để kiểm tra');
        return true;
      }
      if (now - recoveryState.routeAt >= 1200) {
        recoveryState.routeAt = now;
        const routes = [];
        for (const radius of [80, 160, 240, 360]) for (let i = 0; i < 16; i++) {
          const angle = i * Math.PI / 8;
          const point = { x: player.x + Math.cos(angle) * radius, y: player.y + Math.sin(angle) * radius };
          if (clearance(point) < config.recoverSafeRadius) continue;
          const route = safe(() => safePathRoute(scene.map, player.x, player.y, point.x, point.y), []);
          if (!route.length) continue;
          // Reject paths which move closer to contact danger before escaping.
          let previous = player, risky = false;
          for (const waypoint of route) {
            const n = Math.max(1, Math.ceil(Math.hypot(waypoint.x-previous.x, waypoint.y-previous.y)/12));
            for (let j = 1; j <= n; j++) {
              const sample = {x:previous.x+(waypoint.x-previous.x)*j/n,y:previous.y+(waypoint.y-previous.y)*j/n};
              if (clearance(sample) < Math.min(45, clearance(player))) { risky = true; break; }
            }
            if (risky) break;
            previous = waypoint;
          }
          if (!risky) routes.push({ route, distance: routeDistance(player, route) });
        }
        routes.sort((a,b) => a.distance-b.distance);
        if (routes.length) {
          safe(() => P.Player?.stand?.(player));
          player.setPath?.(routes[0].route);
        } else {
          player.setPath?.([]);
          if (now - recoveryState.startedAt > 15000) {
            stop('safe', 'HỒI MÁU · không tìm được nơi thiền an toàn, đã dừng');
            return true;
          }
        }
      }
      reportOnce('recovery-seeking', mode, `HỒI MÁU · tìm chỗ thiền cách quái ≥${config.recoverSafeRadius}px`, 2500);
      return true;
    }
    player.setPath?.([]);
    if (player.state === 'attack' || player.state === 'pose') return true;
    if (player.state === 'sit') {
      if (recoveryState.phase !== 'sitting') { recoveryState.progressAt = now; recoveryState.hp = player.hp; }
      recoveryState.phase = 'sitting';
      if (player.hp > recoveryState.hp) recoveryState.progressAt = now;
      recoveryState.hp = player.hp;
      if (now-recoveryState.progressAt > 20000) {
        stop('safe', 'HỒI MÁU · đã thiền nhưng HP không tăng 20s, cần kiểm tra');
        return true;
      }
      reportOnce('recovery-sitting', mode, `THIỀN Q · HP ${Math.round(hpPercent)}% → ${config.recoverHpResume}%`, 2500);
    } else if (!recoveryState.attemptAt || now-recoveryState.attemptAt >= 3000) {
      if (recoveryState.attempts >= 3 || !P.Input?.pressMeditate) {
        stop('safe', 'HỒI MÁU · không kích hoạt được thiền Q, đã dừng');
        return true;
      }
      visibleElement('#dialog')?.querySelector('#dialog-close')?.click();
      safe(() => P.Player?.stand?.(player));
      P.Input.pressMeditate();
      recoveryState.attemptAt = now; recoveryState.attempts++;
      recoveryState.phase = 'pending';
    }
    return true;
  }

  function reviveTick(data) {
    if (mode === 'off') return;
    const now=Date.now();
    if (!reviveState.since) {
      reviveState={since:now,lastClick:0,attempts:0};
      setNativeAuto(false);meditating=false;kiteUntil=0;retreatState.until=0;
      safe(()=>window.PNTT?.SceneWorld?.player?.setPath?.([]));
    }
    if (stats.seenOnline && !data.online) return stop('safe','HỒI SINH · mất kết nối, đã dừng');
    if (now-reviveState.since>30000 || reviveState.attempts>=3 && now-reviveState.lastClick>=5000)
      return stop('safe','HỒI SINH · chưa thành công sau giới hạn thử, đã dừng');
    const root=visibleElement('#downed');
    const button=root && [...root.querySelectorAll('button')].find(b=> !b.disabled && b.getClientRects().length &&
      /hoi sinh tai cho/.test(fold(`${b.textContent} ${b.getAttribute('aria-label')||''}`)));
    if (!button) return reportOnce('revive-wait',mode,'HỒI SINH · chờ nút hồi sinh tại chỗ khả dụng',2500);
    if (reviveState.lastClick && now-reviveState.lastClick<5000) return;
    reviveState.lastClick=now;reviveState.attempts++;
    button.click();
    report(mode,'HỒI SINH TẠI CHỖ · đã chọn, chờ xác nhận nhân vật sống lại');
  }

  function safetyTick() {
    const data = readState();
    updateKills();
    if (data.downed || data.hpPercent === 0 || $('#downed')?.offsetParent) {
      if (config.reviveInPlace) { reviveTick(data); sendState(); return; }
      return stop('safe', 'Đã thu công vì nhân vật trọng thương');
    }
    if (reviveState.since) {
      reviveState = {since:0,lastClick:0,attempts:0};
      meditating = false; recoveryState.phase='idle'; retreatState.until=0; kiteUntil=0;
      lastQuestTarget='';lastQuestRouteAt=0;lastMovedAt=Date.now();
      resetQuestWatchdog();
      report(mode,'ĐÃ HỒI SINH · kiểm tra hồi phục rồi tiếp tục');
    }
    if (retreatTick()) { sendState(); return; }
    if (config.disconnect && stats.seenOnline && !data.online)
      return stop('safe', 'Đã thu công vì mất kết nối máy chủ');
    if (recoveryTick()) { sendState(); return; }
    if (config.stopLowHp && !config.recoverHealth && data.hpPercent != null && data.hpPercent < config.hpThreshold)
      return stop('safe', `Đã thu công: Khí Huyết dưới ${config.hpThreshold}%`);
    if (config.meditate && data.spPercent != null) {
      if (meditating === 'pending' && data.playerState === 'sit') meditating = true;
      else if (meditating === 'pending' && Date.now() - meditateAt > 2500) {
        meditating = false;
        meditateRetryAt = Date.now() + 15000;
        setNativeAuto(mode === 'farm');
      }
      if (data.spPercent < config.spThreshold && !meditating && Date.now() >= meditateRetryAt) {
        setNativeAuto(false);
        window.PNTT?.Input?.pressMeditate?.();
        meditateAt = Date.now();
        meditating = 'pending';
        report('meditate', 'Thần Thức thấp — đang đả tọa');
      } else if (meditating === true && data.spPercent >= config.spResumeThreshold) {
        safe(() => window.PNTT?.Player?.stand?.(window.PNTT?.SceneWorld?.player));
        meditating = false;
        lastQuestTarget = ''; lastQuestRouteAt = 0; lastMovedAt = Date.now();
        setNativeAuto(mode === 'farm');
        report(mode, 'Linh lực đã hồi phục — đứng dậy, tiếp tục hành công');
      }
    }
    if (mode !== 'off' && !meditating && data.playerState === 'sit' &&
        data.hpPercent >= (config.recoverHpResume || 85) && data.spPercent >= (config.spResumeThreshold || 85)) {
      const plan = mode === 'quest' ? safe(() => analyzeQuest()) : null;
      const questRequiresSitting = plan && /da toa|van cong|ngoi.*dai da/.test(fold(`${plan.objective || ''} ${plan.targetLabel || ''}`));
      if (!questRequiresSitting) {
        safe(() => window.PNTT?.Player?.stand?.(window.PNTT?.SceneWorld?.player));
        lastQuestTarget = ''; lastQuestRouteAt = 0; lastMovedAt = Date.now();
        reportOnce('sit-recovered',mode,'ĐÃ HỒI ĐỦ · đứng dậy, tiếp tục nhiệm vụ',2500);
      }
    }

    if (config.antiStuck && data.x != null && data.y != null && !meditating) {
      const point = { x: data.x, y: data.y };
      if (!lastPosition || Math.hypot(point.x - lastPosition.x, point.y - lastPosition.y) > 6) {
        lastPosition = point;
        lastMovedAt = Date.now();
      } else if (Date.now() - lastMovedAt > 12000 && (mode !== 'quest' || lastQuestTarget)) {
        stats.stuckCount++;
        lastMovedAt = Date.now();
        if (mode === 'quest') questTick(true);
        else {
          chooseTarget(mode);
          move();
          report('unstuck', 'Phát hiện mắc kẹt — đang tìm đường');
        }
      }
    }
    sendState();
  }

  function start(autoMode, value) {
    configure(value);
    clearTimers();
    refreshEncyclopediaKnowledge(true);
    const data = readState();
    if (data.downed || data.hpPercent === 0)
      return report('safe', 'Không thể hành công khi nhân vật trọng thương');

    const P = window.PNTT || {};
    const scene = P.SceneWorld || {};
    const progress = P.Progress || {};
    stats.startedAt = Date.now();
    window.__tienloMetrics?.start(progress);
    stats.kills = 0;
    stats.startXp = +progress.exp || 0;
    stats.startStones = +progress.stones || 0;
    stats.xpGained = 0;
    stats.stonesGained = 0;
    stats.stuckCount = 0;
    stats.seenOnline = !!P.Gateway?.connected;
    lastMapId = scene.map?.data?.id || '';
    knownAlive = new Set((scene.enemies || [])
      .filter(enemy => enemy && !enemy.dead && (+enemy.hp > 0 || enemy.hp == null))
      .map(enemy => String(enemy.id)));
    lastPosition = scene.player ? { x: scene.player.x, y: scene.player.y } : null;
    lastMovedAt = Date.now();
    skillIndex = 0;
    meditating = false;
    meditateRetryAt = 0;
    recoveryState.phase = 'idle';
    lastQuestTarget = '';
    lastQuestRouteAt = 0;
    lastReportKey = '';
    lastReportAt = 0;
    lastDialogChoiceAt = 0;
    exploreState = { key: '', mapId: '', waypoints: [], index: 0, exhaustedAt: 0 };
    resetZoneQuestState();
    resetQuestWatchdog();
    mode = autoMode;
    kiteUntil = kiteRouteAt = kiteAttackAt = 0;
    setNativeAuto(autoMode === 'farm');
    timers = autoMode === 'quest'
      ? [setInterval(questTick, 1000), setInterval(safetyTick, 1000)]
      : [setInterval(() => combatTick('farm'), 1500), setInterval(move, 9000), setInterval(safetyTick, 1000)];
    timers.push(setInterval(kiteTick, 150));
    // Poll only open dialogs more often; movement and combat keep their own cadence.
    if (autoMode === 'quest') timers.push(setInterval(() => {
      if (mode !== 'quest' || meditating || recoveryState.phase !== 'idle' ||
          retreatState.until > Date.now() || reviveState.since || !visibleDialog()) return;
      questTick();
    }, 250));
    report(autoMode, autoMode === 'quest' ? 'Đang tự hành tiên vụ' : 'Đang tuần sát yêu thú');
    if (autoMode === 'quest') questTick(true);
    else {
      combatTick('farm');
      move();
    }
    setButton(autoMode === 'quest' ? '✦ Auto Quest' : '✦ Auto Farm', true);
  }

  function onMessage(event) {
    if (event.origin === HELPER_ORIGIN && event.data?.type === 'TIENLO_LINK_PING') {
      helperWindow = event.source;
      if (!window.__tienloExtensionLiveTimer)
        window.__tienloExtensionLiveTimer = setInterval(sendState, 1000);
      sendState();
      return;
    }
    if (event.origin === HELPER_ORIGIN && event.data?.type === 'TIENLO_CHOICE_MEMORY') {
      for (const row of (event.data.rows || []).slice(-2000)) {
        if (row.map?.id && Array.isArray(row.map.portals)) {
          worldMaps.set(row.map.id, row.map);
          continue;
        }
        if (typeof row.key !== 'string' || typeof row.label !== 'string') continue;
        if (Number.isFinite(row.value)) choiceValues.set(JSON.stringify([row.key, row.label]), row.value);
        if (row.outcome === 'success') learnedChoices.set(row.key, row.label);
        else if (learnedChoices.get(row.key) === row.label) learnedChoices.delete(row.key);
      }
      return;
    }
    if (event.origin !== HELPER_ORIGIN || event.data?.type !== 'TIENLO_COMMAND_V1') return;
    if (event.data.command === 'stop') stop();
    else if (event.data.command === 'config') {
      configure(event.data.config);
      report('config', 'Đã đồng bộ cấu hình');
    } else start(event.data.command, event.data.config);
  }

  function connect() {
    helperWindow = window.open(HELPER_URL, HELPER_NAME);
    if (!helperWindow) {
      setButton('Popup bị chặn');
      alert('Trình duyệt đang chặn tab trợ thủ. Hãy cho phép popup cho tutien2d.online.');
      return;
    }
    window.removeEventListener('message', onMessage);
    window.addEventListener('message', onMessage);
    clearInterval(window.__tienloExtensionLiveTimer);
    setTimeout(() => {
      sendState();
      const backlog = safe(() => JSON.parse(localStorage.getItem('tienlo-quest-failures-v1') || '[]'), []);
      if (Array.isArray(backlog)) backlog.forEach(payload => post({ type: 'TIENLO_QUEST_FAILURE', payload }));
    }, 500);
    window.__tienloExtensionLiveTimer = setInterval(sendState, 1000);
    setButton('✓ Đã kết nối', true);
    setTimeout(() => report('ready', 'Đã kết nối qua extension'), 350);
    setTimeout(() => { try { helperWindow.blur(); window.focus(); } catch {} }, 700);
  }

  window.__tienloQuestAnalyze = analyzeQuest;
  window.__tienloQuestAI = { analyze: analyzeQuest, mapRoute, navigate: navigateToMap,
    explore: questExploreTick, memory: memoryStore, knowledge: encyclopediaKnowledge,
    learnEncyclopedia: refreshEncyclopediaKnowledge, searchKnowledge: knowledgeMatches,
    diagnostics: () => safe(() => JSON.parse(
      localStorage.getItem('tienlo-quest-diagnostics-v1') || '[]'), []),
    failures: () => safe(() => JSON.parse(
      localStorage.getItem('tienlo-quest-failures-v1') || '[]'), []) };
  setTimeout(() => refreshEncyclopediaKnowledge(true), 1500);
  window.addEventListener('message', onMessage);
  window.addEventListener('pageshow', () => { if (helperWindow) sendState(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && helperWindow) sendState();
  });
  installButton();
})();
