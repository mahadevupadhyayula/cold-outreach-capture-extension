import { MODES, SECTION_TYPES, SESSION_SCHEMA_VERSION, STORAGE_KEYS } from './constants.js';
import { mergeSession } from './mergeSession.js';

export function getTimestamp() {
  return new Date().toISOString();
}

export function createEmptySession(companyName = '') {
  const timestamp = getTimestamp();

  return {
    schema_version: SESSION_SCHEMA_VERSION,
    created_at: timestamp,
    updated_at: timestamp,
    company_name_entered: companyName.trim(),
    active_mode: MODES.CONTACT,
    contact_extraction: {
      contact_url: '',
      source_page_title: '',
      captured_sections: [],
      merged_contact: {
        contact_identity: {
          full_name: '',
          linkedin_profile_url: '',
          linkedin_headline: '',
          current_job_title: '',
          current_company_name: '',
          location_region: '',
          seniority_level: ''
        },
        profile_content: {
          about_text: '',
          current_experience: [],
          previous_experience: [],
          education: [],
          featured_items: [],
          recent_activity: []
        },
        outreach_inputs: {
          personalization_hook_candidates: [],
          ai_product_keywords: [],
          role_keywords: [],
          possible_dm_angles: []
        }
      }
    },
    company_extraction: {
      company_url: '',
      source_page_title: '',
      captured_sections: [],
      merged_company: {
        company_identity: {
          company_name: '',
          linkedin_company_url: '',
          website: '',
          industry: '',
          company_size: '',
          headquarters: '',
          specialties: []
        },
        company_context: {
          description: '',
          business_model_guess: '',
          ai_product_relevance_notes: [],
          remote_hiring_signals: [],
          open_role_signals: [],
          recent_post_topics: []
        }
      }
    },
    validation_metadata: {
      missing_fields: [],
      field_conflicts: [],
      needs_manual_validation: true
    }
  };
}

export async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return result[STORAGE_KEYS.SETTINGS] || { companyName: '', mode: MODES.CONTACT };
}

export async function saveSettings(settings) {
  const normalized = {
    companyName: (settings.companyName || settings.company_name_entered || '').trim(),
    mode: settings.mode || settings.active_mode || MODES.CONTACT,
    company_name_entered: (settings.company_name_entered || settings.companyName || '').trim(),
    active_mode: settings.active_mode || settings.mode || MODES.CONTACT
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: normalized });

  await initializeSessionIfMissing();
  await updateSession((session) => {
    session.company_name_entered = normalized.company_name_entered;
    session.active_mode = normalized.active_mode;
    return session;
  });

  return normalized;
}

export async function getSession() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SESSION);
  return normalizeSession(result[STORAGE_KEYS.SESSION]);
}

export async function saveSession(session) {
  const current = await getSession();
  const nextSession = normalizeSession({
    ...current,
    ...session,
    created_at: session?.created_at || current.created_at,
    updated_at: getTimestamp()
  });

  await chrome.storage.local.set({ [STORAGE_KEYS.SESSION]: nextSession });
  return nextSession;
}

export async function updateSession(patchFunction) {
  const current = await initializeSessionIfMissing();
  const draft = structuredClone(current);
  const patched = patchFunction(draft) || draft;
  return saveSession(patched);
}

export async function clearSession() {
  await chrome.storage.local.remove(STORAGE_KEYS.SESSION);
}

export async function initializeSessionIfMissing() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SESSION);
  if (result[STORAGE_KEYS.SESSION]) return normalizeSession(result[STORAGE_KEYS.SESSION]);

  const session = createEmptySession();
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSION]: session });
  return session;
}

export async function resetSession(companyName = '') {
  const session = createEmptySession(companyName);
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSION]: session });
  return session;
}

export async function appendSection(section) {
  const [settings, session] = await Promise.all([getSettings(), initializeSessionIfMissing()]);
  const nextSession = mergeCapturedSection(session, section, settings);
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

function normalizeSession(session) {
  const normalized = deepMerge(
    createEmptySession(session?.company_name_entered || session?.companyName || ''),
    session || {}
  );

  if (!normalized.company_name_entered && normalized.companyName) {
    normalized.company_name_entered = normalized.companyName;
  }

  if (normalized.company_extraction.company_url === '' && Array.isArray(normalized.sections)) {
    const companyUrlSection = [...normalized.sections]
      .reverse()
      .find((section) => section.type === SECTION_TYPES.COMPANY_URL);
    normalized.company_extraction.company_url = companyUrlSection?.payload?.url || companyUrlSection?.sourceUrl || '';
  }

  if (normalized.contact_extraction.contact_url === '' && Array.isArray(normalized.sections)) {
    const contactUrlSection = [...normalized.sections]
      .reverse()
      .find((section) => section.type === SECTION_TYPES.CONTACT_URL);
    normalized.contact_extraction.contact_url = contactUrlSection?.payload?.url || contactUrlSection?.sourceUrl || '';
  }

  return normalized;
}

function mergeCapturedSection(session, section, settings) {
  const normalizedSession = normalizeSession(session);
  const companyName = (settings.company_name_entered || settings.companyName || '').trim();
  const activeMode = settings.active_mode || settings.mode || normalizedSession.active_mode || MODES.CONTACT;
  const nextSession = {
    ...normalizedSession,
    company_name_entered: companyName || normalizedSession.company_name_entered || '',
    active_mode: activeMode
  };

  const mergedSession = mergeSession(nextSession, section, companyName);

  if (section.type === SECTION_TYPES.CONTACT_URL) {
    mergedSession.contact_extraction.contact_url = section.payload?.url || section.sourceUrl || '';
    mergedSession.contact_extraction.source_page_title = section.payload?.title || '';
  } else if (section.type === SECTION_TYPES.COMPANY_URL) {
    mergedSession.company_extraction.company_url = section.payload?.url || section.sourceUrl || '';
    mergedSession.company_extraction.source_page_title = section.payload?.title || '';
  }

  return mergedSession;
}


function deepMerge(defaultValue, overrideValue) {
  if (Array.isArray(defaultValue)) {
    return Array.isArray(overrideValue) ? overrideValue : defaultValue;
  }

  if (!isPlainObject(defaultValue)) {
    return overrideValue === undefined ? defaultValue : overrideValue;
  }

  const merged = { ...defaultValue };
  if (!isPlainObject(overrideValue)) return merged;

  for (const [key, value] of Object.entries(overrideValue)) {
    merged[key] = key in defaultValue ? deepMerge(defaultValue[key], value) : value;
  }

  return merged;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
