(() => {
  window.__tienloPolicy = {
    priorities: { escape_danger: 1000, recover_health: 900, quest_next_step: 800,
      quest_collect_drop: 750, quest_interact: 700, quest_kill_target: 650,
      quest_farm_xp: 500, farm_optional: 100 },
    dialog: { exploreAfterMs: 6000, learningRate: 0.2, progressReward: 20, failureReward: -20 }
  };
})();
