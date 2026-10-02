import { defaults, STORAGE_KEY } from './config.js';

function readStoredState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export const state = Object.assign({}, defaults, readStoredState());
state.autoRules = Object.assign({}, defaults.autoRules, state.autoRules || {});

export function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function ratio(value) {
  const match = String(value || '').match(/([\d.]+)\s*\/\s*([\d.]+)/);
  return match && +match[2]
    ? Math.max(0, Math.min(100, +match[1] / +match[2] * 100))
    : 0;
}

