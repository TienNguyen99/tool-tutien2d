export const STORAGE_KEY = 'tien-lo-companion-v1';
export const EXPECTED_HOOK_VERSION = '1.3.54';

export const defaults = {
  tasks: [false, false, false],
  priority: 'Tự động',
  build: { atk: 1, hp: 0, sp: 0, armor: 0 },
  live: null,
  autoRules: {
    hp: true,
    sp: true,
    quest: true,
    nearest: true,
    avoidBoss: true,
    stopLowHp: true,
    meditate: true,
    disconnect: true,
    antiStuck: true,
    hpThreshold: 30,
    spThreshold: 20,
    maxDistance: 260,
    skillSlots: '1,2',
    retreatEnabled: true, retreatHpThreshold: 20, damageHpThreshold: 20,
    damageArmorThreshold: 35, retreatSeconds: 8, hitRunEnabled: true,
    kiteMilliseconds: 250, kiteDistance: 36, recoverHealth: true,
    recoverHpThreshold: 30, recoverHpResume: 85, recoverSafeRadius: 200,
    spResumeThreshold: 85, aiPlanner: true, reviveInPlace: true, visionDialogs: false, autoFly: false,
    dailyDuocCong: false, dailyDuocCongTournament: false, utilityWhileGrowing: true
  }
};

