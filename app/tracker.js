// tracker.js — progress state for the Leonida Legend trophy tracker.
//
// Everything about "what has this player earned" lives here: the state
// shape, saving it to localStorage, reading it back, and turning it into
// an export file (and back) so progress can move between browsers.

export const STORAGE_KEY = 'leonida-legend.progress.v1';

/** A fresh state: nothing earned, story spoilers hidden. */
export function emptyState() {
  return { earned: [], hideSpoilers: true };
}

/**
 * Read the saved state from localStorage. Any damage — no storage, bad
 * JSON, unknown trophy ids — falls back to a clean state rather than
 * breaking the guide.
 */
export function loadState(validIds) {
  const state = emptyState();
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return state;
  }
  if (!raw) return state;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.earned)) {
      state.earned = parsed.earned.filter((id) => validIds.has(id));
    }
    if (typeof parsed.hideSpoilers === 'boolean') {
      state.hideSpoilers = parsed.hideSpoilers;
    }
  } catch {
    return emptyState();
  }
  return state;
}

/** Persist the state. Storage failures (private mode, quota) are ignored. */
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The tracker keeps working for the session even if saving is refused.
  }
}

/** Forget everything: earned trophies and settings. */
export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage itself is unavailable.
  }
}

/**
 * Build the export file's text: the earned trophies by id and by name, so
 * the file stays readable and portable even outside this app.
 */
export function buildExport(state, trophies, now = new Date()) {
  const byId = new Map(trophies.map((t) => [t.id, t]));
  const earned = state.earned
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((t) => ({ id: t.id, name: t.name }));
  return JSON.stringify(
    {
      app: 'leonida-legend',
      game: 'Grand Theft Auto VI',
      platform: 'PlayStation 5',
      version: 1,
      exportedAt: now.toISOString(),
      earnedCount: earned.length,
      earned,
    },
    null,
    2,
  );
}

/**
 * Read an export file's text back into a list of trophy ids. Accepts this
 * app's own export shape, a bare array of ids, or a bare array of trophy
 * names, so older or hand-made files still import.
 */
export function parseImport(text, trophies) {
  const byId = new Map(trophies.map((t) => [t.id, t]));
  const byName = new Map(trophies.map((t) => [t.name.toLowerCase(), t]));
  const parsed = JSON.parse(text);
  const items = Array.isArray(parsed) ? parsed : parsed.earned;
  if (!Array.isArray(items)) {
    throw new Error('No earned list found in that file.');
  }
  const ids = [];
  for (const item of items) {
    if (typeof item === 'number' && byId.has(item)) ids.push(item);
    if (typeof item === 'string') {
      const hit = byName.get(item.toLowerCase());
      if (hit) ids.push(hit.id);
    }
    if (item && typeof item === 'object') {
      if (byId.has(item.id)) ids.push(item.id);
      else if (typeof item.name === 'string') {
        const hit = byName.get(item.name.toLowerCase());
        if (hit) ids.push(hit.id);
      }
    }
  }
  return [...new Set(ids)];
}
