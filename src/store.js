import { STORAGE_KEYS, MODES } from './constants.js';
import { createEmptySession, mergeSession } from './mergeSession.js';

export async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return result[STORAGE_KEYS.SETTINGS] || { companyName: '', mode: MODES.CONTACT };
}

export async function saveSettings(settings) {
  const normalized = {
    companyName: (settings.companyName || '').trim(),
    mode: settings.mode || MODES.CONTACT
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: normalized });
  return normalized;
}

export async function getSession() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SESSION);
  return result[STORAGE_KEYS.SESSION] || createEmptySession();
}

export async function resetSession(companyName = '') {
  const session = createEmptySession(companyName);
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSION]: session });
  return session;
}

export async function appendSection(section) {
  const [settings, session] = await Promise.all([getSettings(), getSession()]);
  const nextSession = mergeSession(session, section, settings.companyName);
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSION]: nextSession });
  return nextSession;
}

export async function saveLastSelection(selection) {
  await chrome.storage.local.set({ [STORAGE_KEYS.LAST_SELECTION]: selection });
}

export async function getLastSelection() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LAST_SELECTION);
  return result[STORAGE_KEYS.LAST_SELECTION] || { text: '', pageUrl: '' };
}
