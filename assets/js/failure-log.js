const QUEUE_KEY = 'tienlo-server-failure-queue-v1';
let queue;
try { queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { queue = []; }
if (!Array.isArray(queue)) queue = [];
let flushing = false;

export function queueFailure(entry) {
  if (!entry || !['fail', 'success'].includes(entry.outcome)) return;
  const id = `${entry.at}:${entry.reason}`;
  if (!queue.some(row => `${row.at}:${row.reason}` === id)) {
    queue.push(entry);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
  void flushFailures();
}

async function flushFailures() {
  if (flushing || !queue.length) return;
  flushing = true;
  try {
    while (queue.length) {
      const response = await fetch('/api/quest-failures', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queue[0]), signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) throw new Error('Log server unavailable');
      const result = await response.json();
      if (!result.saved) throw new Error('Log not acknowledged');
      queue.shift();
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (error) {
    console.warn('Log fail đang chờ lưu server; tự thử lại.', error.message);
  } finally { flushing = false; }
}

setInterval(() => void flushFailures(), 10000);
void flushFailures();
