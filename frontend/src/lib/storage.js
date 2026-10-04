// Everything is stored in the browser: no account, no server, no video ever
// leaves the machine.

const KEYS = {
  sessions: "lockedin.sessions.v1",
  settings: "lockedin.settings.v1",
  baseline: "lockedin.baseline.v1",
};

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: tracking still works for this tab.
  }
};

export const DEFAULT_SETTINGS = {
  sensitivity: "balanced",
  alertAfterSec: 20,
  sound: true,
  notifications: true,
  breakEveryMin: 30,
  showSkeleton: true,
  dailyGoalMin: 120,
};

export const loadSettings = () => ({ ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) });
export const saveSettings = (s) => write(KEYS.settings, s);

export const loadBaseline = () => read(KEYS.baseline, null);
export const saveBaseline = (b) => write(KEYS.baseline, b);

export const loadSessions = () => read(KEYS.sessions, []);
export const saveSessions = (list) => write(KEYS.sessions, list);
