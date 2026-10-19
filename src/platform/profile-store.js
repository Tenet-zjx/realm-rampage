import { createProfile, migrateProfile } from '../game/progression.js';

// localStorage-backed profile with a write-then-swap backup so a failed write never loses the save.
const KEY = 'realm-rampage-profile-v1';
const BACKUP = `${KEY}-backup`;

export function loadProfile() {
  for (const k of [KEY, BACKUP]) {
    try { const raw = localStorage.getItem(k); if (raw) return migrateProfile(JSON.parse(raw)); } catch { /* corrupt or blocked storage: try backup / fresh */ }
  }
  return createProfile();
}

export function saveProfile(profile) {
  try {
    const data = JSON.stringify(profile);
    const prev = localStorage.getItem(KEY);
    if (prev) localStorage.setItem(BACKUP, prev);
    localStorage.setItem(KEY, data);
    return true;
  } catch { return false; }
}

export function resetProfile() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(BACKUP); } catch { /* ignore */ }
  return createProfile();
}
