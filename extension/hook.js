(() => {
  'use strict';

  if (window.__tienloExtensionHook) return;
  const HOOK_VERSION = '1.3.8';
  window.__tienloExtensionHook = HOOK_VERSION;

  const HELPER_URL = 'http://127.0.0.1:8765/index.html';
  const HELPER_ORIGIN = 'http://127.0.0.1:8765';
  const HELPER_NAME = 'tienlo-companion';
  const DEFAULTS = {
    priority: 'Tự động', nearest: true, avoidBoss: true,
    stopLowHp: true, meditate: true, disconnect: true, antiStuck: true,
    hpThreshold: 30, spThreshold: 20, maxDistance: 260, skillSlots: [1, 2]
  };

  let helperWindow = null;
  let config = { ...DEFAULTS };
  let timers = [];
  let mode = 'off';
  let skillIndex = 0;
  let lastPosition = null;
  let lastMovedAt = Date.now();
  let lastMapId = '';
  let knownAlive = new Set();
  let meditating = false;
  let meditateAt = 0;
  let meditateRetryAt = 0;
  let lastQuestTarget = '';
  let lastQuestRouteAt = 0;
  let lastReportKey = '';
  let lastReportAt = 0;
  let lastDialogChoiceAt = 0;
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

    stats.xpGained = stats.startedAt ? Math.max(0, exp - stats.startXp) : 0;
    stats.stonesGained = stats.startedAt ? Math.max(0, stones - stats.startStones) : 0;
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
        stonesGained: stats.stonesGained, stuckCount: stats.stuckCount
      }
    };
  }

  function sendState() {
    try {
      post({ type: 'TIENLO_LIVE_V3', payload: readState(), sentAt: Date.now() });
    } catch (error) {
      report('error', `Hook lỗi: ${error?.message || String(error)}`);
    }
  }

  function configure(value) {
    const next = { ...DEFAULTS, ...(value || {}) };
    next.maxDistance = Math.max(60, Math.min(600, +next.maxDistance || DEFAULTS.maxDistance));
    next.hpThreshold = Math.max(1, Math.min(99, +next.hpThreshold || DEFAULTS.hpThreshold));
    next.spThreshold = Math.max(1, Math.min(99, +next.spThreshold || DEFAULTS.spThreshold));
    next.skillSlots = (Array.isArray(next.skillSlots) ? next.skillSlots : String(next.skillSlots || '').split(','))
      .map(Number).filter(slot => slot >= 1 && slot <= 8);
    config = next;
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
    clearTimers();
    setNativeAuto(false);
    mode = 'off';
    meditating = false;
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
    const learnedMap = knowledgeHint(objective)?.mapId;
    if (learnedMap) return learnedMap;
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
    return fallback;
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
      plan.summary = `${plan.actionLabel || plan.action.toUpperCase()} · ${plan.targetLabel} · ${plan.location}`;
      return plan;
    };

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

    const task = safe(() => Q.seedTaskInfo?.());
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

    const selected = candidates[0];
    if (selected && P.Targeting) {
      P.Targeting.key = `foe:${selected.enemy.id}`;
      P.Targeting.manual = true;
      return selected.enemy;
    }

    return null;
  }

  function move() {
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
    if (meditating) return;
    chooseTarget(autoMode);
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

  function clickQuestDialogDecision(plan) {
    if (Date.now() - lastDialogChoiceAt < 1400) return false;
    const root = document.querySelector('#dialog');
    if (!root || root.classList.contains('hidden') || !root.getClientRects().length) return false;
    const visibleButton = button => button && !button.disabled && button.getClientRects().length &&
      getComputedStyle(button).display !== 'none' && getComputedStyle(button).visibility !== 'hidden';
    const buttons = [...root.querySelectorAll('button')].filter(visibleButton);
    if (handleBachKhoaDialog(buttons)) return true;
    const dangerous = /xoa|xoa vinh vien|huy nhiem vu|xac nhan huy|mua|doi |rut |vut|pha huy|do sat|ti thi|ghi danh|roi to doi|moi roi|nhuong|mo them|mo bach khoa/;
    const retreat = /de sau|lui buoc|quay lai|thoi|dong|huy/;
    const positive = /tu dong|hoan thanh|giao |nhan |cau|thu hai|nhat|noi chuyen|hoi viec|tiep tuc|dong y|tien hanh|buoc vao/;
    const context = fold([plan?.targetLabel, plan?.actionLabel, ...readHud().objectives].join(' '));
    const tokens = [...new Set(context.split(' ').filter(token => token.length >= 4 &&
      !/^(nhiem|vu|dang|tieu|muc|tuong|tac|tai|den|nhat|danh)$/.test(token)))];
    const ranked = buttons.map((button, index) => {
      const label = fold(button.textContent);
      let score = 0;
      if (button.id === 'dialog-action') score += 80;
      if (positive.test(label)) score += 35;
      if (plan?.action === 'interact') score += 5;
      for (const token of tokens) if (label.includes(token)) score += 7;
      if (dangerous.test(label)) score -= 1000;
      if (retreat.test(label)) score -= 100;
      return { button, label, score, index };
    }).sort((a, b) => b.score - a.score || a.index - b.index);
    const choice = ranked.find(item => item.score > -100);
    if (choice) {
      lastDialogChoiceAt = Date.now();
      choice.button.click();
      reportOnce(`quest-decision:${choice.label}`, 'quest',
        `TỰ CHỌN · ${choice.button.textContent.trim()}`, 1800);
      return true;
    }
    const close = buttons.find(button => button.id === 'dialog-close');
    if (close) {
      lastDialogChoiceAt = Date.now();
      close.click();
      reportOnce('quest-decision-skip', 'quest', 'TỰ QUYẾT ĐỊNH · bỏ qua lựa chọn không an toàn', 2500);
      return true;
    }
    return false;
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
    report('quest', `AI WATCHDOG · kẹt ${snapshot.stalledSeconds}s · ${snapshot.analysis}`);

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
    for (const value of Object.values(window.PNTT?.MapData || {})) {
      if (value?.id && Array.isArray(value.portals)) defs.set(value.id, value);
    }
    const current = window.PNTT?.SceneWorld?.map?.data;
    if (current?.id && Array.isArray(current.portals)) defs.set(current.id, current);
    return defs;
  }

  function routeToInteractable(scene, player, obj) {
    const P = window.PNTT || {};
    const halfW = (+P.CONFIG?.PLAYER?.HITBOX_W || 18) / 2;
    const height = +P.CONFIG?.PLAYER?.HITBOX_H || 24;
    const tile = +P.CONFIG?.TILE || 32;
    const centerY = obj.y - tile / 2;
    const reach = Math.max(30, +safe(() => P.Targeting?.propReach?.(obj), obj.r || 40) || 40);
    const candidates = [{ x: obj.x, y: centerY }];
    const radius = Math.max(22, reach - 7);
    for (let index = 0; index < 12; index++) {
      const angle = Math.PI * 2 * index / 12;
      candidates.push({ x: obj.x + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius });
    }
    const routes = candidates.map(point => safe(() => P.Pathfinder?.route?.(
      scene.map, player.x, player.y, point.x, point.y, halfW, height), []))
      .filter(route => Array.isArray(route) && route.length);
    routes.sort((a, b) => a.length - b.length);
    return { route: routes[0] || [], reach, centerY };
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
      const route = safe(() => P.Pathfinder?.route?.(scene.map, player.x, player.y,
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
      const route = safe(() => P.Pathfinder?.route?.(scene.map, player.x, player.y,
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
        const route = safe(() => P.Pathfinder?.route?.(scene.map, player.x, player.y,
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
    const selected = candidates[0];
    if (!selected) {
      return questExploreTick(plan, forceRoute);
    }

    const enemy = selected.enemy;
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
        const route = safe(() => P.Pathfinder?.route?.(scene.map, player.x, player.y,
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
    if (mode !== 'quest' || meditating) return;
    const P = window.PNTT || {};
    const scene = P.SceneWorld;
    const player = scene?.player;
    if (!player || !scene.map) {
      return reportOnce('quest-no-world', 'quest', 'Chưa vào thế giới game');
    }
    const plan = analyzeQuest();
    if (questWatchdogTick(plan)) return;
    if (handleQuestOverlay()) return;
    const hudDialogOpen = typeof P.HUD?.dialogOpen === 'function'
      ? safe(() => P.HUD.dialogOpen(), false)
      : !!P.HUD?.dialogOpen;
    if (hudDialogOpen || visibleDialog()) {
      if (plan.autoChoice && clickDialogChoice(plan.autoChoice)) {
        return reportOnce(`quest-choice:${plan.autoChoice}`, 'quest',
          `TƯƠNG TÁC · đã chọn ${plan.autoChoice}`, 3000);
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

    const approach = routeToInteractable(scene, player, target.obj);
    const route = approach.route;
    scene.approach = {
      obj: target.obj,
      until: (+P.Game?.time || 0) + (+P.CONFIG?.TARGET?.APPROACH_TIME || 8000)
    };
    const interactionDistance = Math.hypot(target.obj.x - player.x, approach.centerY - player.y);
    if (interactionDistance <= approach.reach) {
      safe(() => player.setPath?.([]));
      lastQuestTarget = target.key;
      lastQuestRouteAt = now;
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
    const scene = window.PNTT?.SceneWorld;
    const mapId = scene?.map?.data?.id || '';
    const alive = new Set((scene?.enemies || [])
      .filter(enemy => enemy && !enemy.dead && (+enemy.hp > 0 || enemy.hp == null))
      .map(enemy => String(enemy.id)));
    if (mapId !== lastMapId) {
      lastMapId = mapId;
      knownAlive = alive;
      return;
    }
    for (const id of knownAlive) if (!alive.has(id)) stats.kills++;
    knownAlive = alive;
  }

  function safetyTick() {
    const data = readState();
    updateKills();
    if (data.downed || data.hpPercent === 0 || $('#downed')?.offsetParent)
      return stop('safe', 'Đã thu công vì nhân vật trọng thương');
    if (config.stopLowHp && data.hpPercent != null && data.hpPercent < config.hpThreshold)
      return stop('safe', `Đã thu công: Khí Huyết dưới ${config.hpThreshold}%`);
    if (config.disconnect && stats.seenOnline && !data.online)
      return stop('safe', 'Đã thu công vì mất kết nối máy chủ');

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
      } else if (meditating === true && data.spPercent >= 85) {
        window.PNTT?.Input?.pressMeditate?.();
        meditating = false;
        setNativeAuto(mode === 'farm');
        report(mode, 'Thần Thức đã hồi phục — tiếp tục hành công');
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
    lastQuestTarget = '';
    lastQuestRouteAt = 0;
    lastReportKey = '';
    lastReportAt = 0;
    lastDialogChoiceAt = 0;
    exploreState = { key: '', mapId: '', waypoints: [], index: 0, exhaustedAt: 0 };
    resetZoneQuestState();
    resetQuestWatchdog();
    mode = autoMode;
    setNativeAuto(autoMode === 'farm');
    timers = autoMode === 'quest'
      ? [setInterval(questTick, 1000), setInterval(safetyTick, 1000)]
      : [setInterval(() => combatTick('farm'), 1500), setInterval(move, 9000), setInterval(safetyTick, 1000)];
    report(autoMode, autoMode === 'quest' ? 'Đang tự hành tiên vụ' : 'Đang tuần sát yêu thú');
    if (autoMode === 'quest') questTick(true);
    else {
      combatTick('farm');
      move();
    }
    setButton(autoMode === 'quest' ? '✦ Auto Quest' : '✦ Auto Farm', true);
  }

  function onMessage(event) {
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
    setTimeout(sendState, 500);
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
      localStorage.getItem('tienlo-quest-diagnostics-v1') || '[]'), []) };
  setTimeout(() => refreshEncyclopediaKnowledge(true), 1500);
  installButton();
})();
