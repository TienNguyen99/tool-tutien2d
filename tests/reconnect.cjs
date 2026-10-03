const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const hook = fs.readFileSync(path.join(__dirname, '../extension/hook.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../assets/js/app.js'), 'utf8');
const between = (start, end) => hook.slice(hook.indexOf(start), hook.indexOf(end));

const pings = [];
const gameTab = { closed: false, postMessage: (...args) => pings.push(args) };
const companion = vm.createContext({ gameWindow: null, window: { opener: gameTab } });
vm.runInContext(app.slice(app.indexOf('function pingGame(){'), app.indexOf("document.querySelector('#startQuestAuto').addEventListener")), companion);
companion.pingGame();
assert.equal(pings[0][0].type, 'TIENLO_LINK_PING');
assert.equal(pings[0][1], 'https://tutien2d.online');

let stateSends = 0;
let buttonLabel='';
const linked = vm.createContext({
  HELPER_ORIGIN: 'http://127.0.0.1:8765', helperWindow: null,
  sendState: () => { stateSends++; },
  window: {}, setInterval: () => 123,
  mode:'off',setButton:label=>{buttonLabel=label;},
});
vm.runInContext(between('  function onMessage(', '  function connect('), linked);
const dashboard = {};
linked.onMessage({ origin: 'https://other.example', data: { type: 'TIENLO_LINK_PING' }, source: dashboard });
assert.equal(stateSends, 0, 'Only the companion origin may reconnect');
linked.onMessage({ origin: linked.HELPER_ORIGIN, data: { type: 'TIENLO_LINK_PING' }, source: dashboard });
assert.equal(linked.helperWindow, dashboard, 'Reloaded dashboard window is attached again');
assert.equal(stateSends, 1, 'Reconnect sends fresh state without starting automation');
assert.equal(linked.window.__tienloExtensionLiveTimer,123,'Handshake restores missing live timer');
linked.onMessage({origin:linked.HELPER_ORIGIN,data:{type:'TIENLO_LINK_PING'},source:dashboard});
assert.equal(stateSends,2,'Every ping returns fresh data');
assert.equal(buttonLabel,'✓ Đã kết nối','Reconnect updates idle button label');
linked.mode='quest';
linked.onMessage({origin:linked.HELPER_ORIGIN,data:{type:'TIENLO_LINK_PING'},source:dashboard});
assert.equal(buttonLabel,'✦ Auto Quest','Reconnect preserves active mode label');

const liveMessages=[];
const live=vm.createContext({safe:fn=>{try{return fn()}catch{}},
  settleChoiceMemory:()=>{throw Error('Storage unavailable')},
  saveWorldMaps:()=>{throw Error('Storage unavailable')},
  readState:()=>({name:'Test'}),post:message=>liveMessages.push(message),
  report:()=>{throw Error('Heartbeat must still succeed')}});
vm.runInContext(between('  function sendState()', '  const cloneSessionId'),live);
live.sendState();
assert.equal(liveMessages[0].type,'TIENLO_LIVE_V3','Bookkeeping failure cannot interrupt live data');

let now = 1000;
let shouldFail = false;
const reports = [];
const stops = [];
const clone = vm.createContext({
  Date: { now: () => now },
  window: { PNTT: { SceneWorld: { player: {} } },
    __tienloLocalRequest: async () => {
      if (shouldFail) throw Error('Server unavailable');
      return { command: null };
    } },
  cloneSending: false, cloneLastOnlineAt: 0, cloneLinkInterrupted: false,
  choiceMemoryLoaded: true, observedQuestSignature: '', cloneSessionId: 'clone-1',
  cloneManaged: true, mode: 'farm', HOOK_VERSION: 'test',
  readState: () => ({ online: false, questStageIndex: null }),
  report: (...args) => reports.push(args), stop: (...args) => stops.push(args),
});
vm.runInContext(between('  async function cloneHeartbeat(', '  let cloneManaged = false;'), clone);
(async () => {
  await clone.cloneHeartbeat();
  assert.equal(clone.cloneLastOnlineAt, 1000);
  shouldFail = true;
  now = 9000;
  await clone.cloneHeartbeat();
  assert.equal(stops.length, 0, 'A transient server failure must not stop farming');
  assert.equal(reports.length, 1, 'Transient failure reports reconnection once');
  shouldFail = false;
  now = 10000;
  await clone.cloneHeartbeat();
  assert.equal(reports.length, 2, 'Recovery is reported');
  shouldFail = true;
  now = 42001;
  await clone.cloneHeartbeat();
  assert.equal(stops.length, 1, 'Long unmanaged farm still stops safely');
  console.log('Dashboard handshake and clone reconnect regressions passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
