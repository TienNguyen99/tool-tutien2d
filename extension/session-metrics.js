(() => {
  let active = false, startedAt = 0, stoppedAt = 0, previous = null;
  let kills = 0, xpGained = 0, stonesGained = 0, stonesSpent = 0;
  const sockets = new WeakSet();
  function observeMessage(message) {
    const selfId = window.PNTT?.Gateway?.selfId;
    if (active && message?.op === 'kill' && selfId != null && message.by != null
      && String(message.by) === String(selfId)) kills++;
  }
  function attach() {
    const socket = window.PNTT?.Gateway?.socket;
    if (!socket?.addEventListener || sockets.has(socket)) return;
    sockets.add(socket);
    socket.addEventListener('message', event => {
      try { observeMessage(JSON.parse(event.data)); } catch { /* Non-JSON packet. */ }
    });
  }
  function sample(progress) {
    const current = { xp: +progress.exp || 0, stones: +progress.stones || 0, realm: progress.realmId };
    if (active && previous) {
      // A realm change resets exp; it is not a negative farming reward.
      if (current.realm === previous.realm) xpGained += Math.max(0, current.xp - previous.xp);
      stonesGained += Math.max(0, current.stones - previous.stones);
      stonesSpent += Math.max(0, previous.stones - current.stones);
    }
    previous = current;
  }
  window.__tienloMetrics = {
    observeMessage,
    start(progress) {
      kills = xpGained = stonesGained = stonesSpent = 0;
      startedAt = Date.now(); stoppedAt = 0; previous = null; active = true;
      sample(progress); attach();
    },
    stop(progress) { sample(progress); if (active) stoppedAt = Date.now(); active = false; },
    read(progress, expMax) {
      attach(); sample(progress);
      const seconds = startedAt ? Math.max(0, ((active ? Date.now() : stoppedAt) - startedAt) / 1000) : 0;
      const rate = value => seconds >= 10 ? Math.round(value * 3600 / seconds) : null;
      const xpPerHour = rate(xpGained);
      return { seconds, kills, xpGained, stonesGained, stonesSpent,
        xpPerHour, killsPerHour: rate(kills), stonesPerHour: rate(stonesGained),
        xpCurrent: +progress.exp || 0, xpMax: expMax,
        fullXpSeconds: xpPerHour > 0 && expMax > 0
          ? Math.ceil(Math.max(0, expMax - (+progress.exp || 0)) * 3600 / xpPerHour) : null,
        killSource: sockets.has(window.PNTT?.Gateway?.socket) ? 'server' : 'unavailable' };
    }
  };
})();
