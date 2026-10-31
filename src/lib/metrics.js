// Pencatatan kinerja di perangkat (localStorage). Tidak ada data yang dikirim ke server.

const KEY = 'sonarid.metrics.v1';
const MAX_SESSIONS = 30;

export function newSession(settings) {
  return {
    id: Date.now(),
    startedAt: new Date().toISOString(),
    detail: settings.detail,
    nonVisual: settings.nonVisual,
    steps: {},
    latency: { sum: 0, count: 0, max: 0 },
    completed: false,
  };
}

export function recordLatency(session, ms) {
  if (!session || !Number.isFinite(ms)) return;
  session.latency.sum += ms;
  session.latency.count += 1;
  if (ms > session.latency.max) session.latency.max = ms;
}

export function recordStep(session, step, data) {
  if (!session) return;
  const prev = session.steps[step] || { attempts: 0 };
  session.steps[step] = { ...prev, ...data, attempts: prev.attempts + (data.attempt ? 1 : 0) };
  delete session.steps[step].attempt;
}

export function loadSessions() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveSession(session) {
  if (!session) return;
  try {
    const list = loadSessions().filter((s) => s.id !== session.id);
    list.unshift({ ...session, finishedAt: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_SESSIONS)));
  } catch {
    /* penyimpanan tidak tersedia (mode privat), abaikan */
  }
}

export function clearSessions() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* abaikan */
  }
}

export function avgLatency(session) {
  return session && session.latency.count ? session.latency.sum / session.latency.count : null;
}
