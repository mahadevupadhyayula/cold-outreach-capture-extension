import { MODES, SECTION_TYPES, SESSION_SCHEMA_VERSION, STORAGE_KEYS } from './constants.js';
import { mergeSession } from './mergeSession.js';

export function getTimestamp() {
  return new Date().toISOString();
}

export function createEmptyMergedContact() {
  return {
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
  };
}

export function createEmptyContact(url = '', pageTitle = '') {
  const timestamp = getTimestamp();
  const contactUrl = normalizeUrl(url);

  return {
    contact_id: crypto.randomUUID(),
    contact_url: contactUrl,
    source_page_title: pageTitle || '',
    created_at: timestamp,
    updated_at: timestamp,
    status: 'in_progress',
    company_name_entered: '',
    captured_sections: [],
    merged_contact: {
      ...createEmptyMergedContact(),
      contact_identity: {
        ...createEmptyMergedContact().contact_identity,
        linkedin_profile_url: contactUrl
      }
    },
    validation_metadata: {
      missing_fields: [],
      field_conflicts: [],
      validation_warnings: [],
      needs_manual_validation: true
    }
  };
}

export function createEmptySession(companyName = '') {
  const timestamp = getTimestamp();

  return {
    schema_version: SESSION_SCHEMA_VERSION,
    created_at: timestamp,
    updated_at: timestamp,
    company_name_entered: companyName.trim(),
    active_mode: MODES.CONTACT,
    contact_capture: {
      current_contact_id: '',
      contacts: []
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
      needs_manual_validation: true,
      session_conflicts: []
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


export async function extractContactUrlFromPage(url, pageTitle = '') {
  const normalizedUrl = normalizeUrl(url);

  return updateSession((session) => {
    if (!normalizedUrl) {
      addSessionValidationWarning(session, 'Contact URL extraction skipped: the current page URL is empty or invalid.');
      return session;
    }

    const existing = findContactByUrl(session, normalizedUrl);
    if (existing) {
      session.contact_capture.current_contact_id = existing.contact_id;
      if (!existing.source_page_title && pageTitle) existing.source_page_title = pageTitle;
      existing.company_name_entered = session.company_name_entered || existing.company_name_entered || '';
      removeCompanyProfileDataFromContact(existing);
      existing.updated_at = getTimestamp();
      return session;
    }

    const contact = createEmptyContact(normalizedUrl, pageTitle);
    contact.company_name_entered = session.company_name_entered || '';
    contact.contact_url = normalizedUrl;
    contact.merged_contact.contact_identity.linkedin_profile_url = normalizedUrl;
    contact.source_page_title = pageTitle || '';
    contact.status = 'in_progress';
    session.contact_capture.contacts.push(contact);
    session.contact_capture.current_contact_id = contact.contact_id;
    return session;
  });
}

export async function saveLastSelection(selection) {
  await chrome.storage.local.set({ [STORAGE_KEYS.LAST_SELECTION]: selection });
}

export async function getLastSelection() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LAST_SELECTION);
  return result[STORAGE_KEYS.LAST_SELECTION] || { text: '', pageUrl: '' };
}

export function getCurrentContact(session) {
  const normalized = normalizeSession(session);
  const contacts = normalized.contact_capture.contacts;
  return contacts.find((contact) => contact.contact_id === normalized.contact_capture.current_contact_id) || null;
}

export function createContactFromUrl(session, url, pageTitle = '') {
  const normalized = session?.contact_capture ? session : normalizeSession(session);
  const existing = findContactByUrl(normalized, url);
  if (existing) {
    normalized.contact_capture.current_contact_id = existing.contact_id;
    if (!existing.source_page_title && pageTitle) existing.source_page_title = pageTitle;
    existing.updated_at = getTimestamp();
    return existing;
  }

  const contact = createEmptyContact(url, pageTitle);
  contact.company_name_entered = normalized.company_name_entered || '';
  normalized.contact_capture.contacts.push(contact);
  normalized.contact_capture.current_contact_id = contact.contact_id;
  normalized.updated_at = getTimestamp();
  return contact;
}

export function findContactByUrl(session, url) {
  const value = normalizeUrl(url);
  if (!value) return null;
  const normalized = session?.contact_capture ? session : normalizeSession(session);
  return normalized.contact_capture.contacts.find((contact) => normalizeUrl(contact.contact_url || contact.merged_contact?.contact_identity?.linkedin_profile_url) === value) || null;
}

export function setCurrentContact(session, contactId) {
  const normalized = session?.contact_capture ? session : normalizeSession(session);
  const contact = normalized.contact_capture.contacts.find((item) => item.contact_id === contactId);
  if (!contact) return null;
  normalized.contact_capture.current_contact_id = contact.contact_id;
  normalized.updated_at = getTimestamp();
  return contact;
}

export function ensureCurrentContact(session) {
  const normalized = session?.contact_capture ? session : normalizeSession(session);
  const current = getCurrentContact(normalized);
  if (current) return current;

  if (normalized.contact_capture.contacts.length > 0) {
    normalized.contact_capture.current_contact_id = normalized.contact_capture.contacts[0].contact_id;
    return normalized.contact_capture.contacts[0];
  }

  const contact = createEmptyContact();
  contact.company_name_entered = normalized.company_name_entered || '';
  normalized.contact_capture.contacts.push(contact);
  normalized.contact_capture.current_contact_id = contact.contact_id;
  normalized.updated_at = getTimestamp();
  return contact;
}

export function normalizeSession(session) {
  const migrated = migrateSession(session);
  const normalized = deepMerge(createEmptySession(migrated?.company_name_entered || migrated?.companyName || ''), migrated || {});

  normalized.schema_version = SESSION_SCHEMA_VERSION;
  normalized.contact_capture = normalizeContactCapture(normalized.contact_capture);
  normalized.validation_metadata = normalizeSessionValidation(normalized.validation_metadata);

  if (!normalized.company_name_entered && normalized.companyName) {
    normalized.company_name_entered = normalized.companyName;
  }

  if (normalized.company_extraction.company_url === '' && Array.isArray(normalized.sections)) {
    const companyUrlSection = [...normalized.sections]
      .reverse()
      .find((section) => section.type === SECTION_TYPES.COMPANY_URL);
    normalized.company_extraction.company_url = companyUrlSection?.payload?.url || companyUrlSection?.sourceUrl || '';
  }

  return normalized;
}

function migrateSession(session) {
  if (!session) return createEmptySession();
  if (session.contact_capture?.contacts) return session;

  const next = {
    ...session,
    schema_version: SESSION_SCHEMA_VERSION,
    contact_capture: {
      current_contact_id: '',
      contacts: []
    },
    validation_metadata: migrateSessionValidation(session.validation_metadata)
  };

  const oldContactExtraction = session.contact_extraction;
  if (oldContactExtraction) {
    const contact = createEmptyContact(oldContactExtraction.contact_url || '', oldContactExtraction.source_page_title || '');
    contact.captured_sections = Array.isArray(oldContactExtraction.captured_sections) ? oldContactExtraction.captured_sections : [];
    contact.merged_contact = deepMerge(createEmptyMergedContact(), oldContactExtraction.merged_contact || {});
    if (oldContactExtraction.contact_url && !contact.merged_contact.contact_identity.linkedin_profile_url) {
      contact.merged_contact.contact_identity.linkedin_profile_url = oldContactExtraction.contact_url;
    }
    contact.validation_metadata = {
      missing_fields: filterLegacyMissingFields(session.validation_metadata?.missing_fields || []),
      field_conflicts: Array.isArray(session.validation_metadata?.field_conflicts) ? session.validation_metadata.field_conflicts : [],
      validation_warnings: Array.isArray(session.validation_metadata?.validation_warnings) ? session.validation_metadata.validation_warnings : [],
      needs_manual_validation: session.validation_metadata?.needs_manual_validation !== false
    };

    const hasContactData = contact.contact_url || contact.captured_sections.length > 0 || hasMergedContactData(contact.merged_contact);
    if (hasContactData) {
      next.contact_capture.contacts.push(contact);
      next.contact_capture.current_contact_id = contact.contact_id;
    }
  }

  delete next.contact_extraction;
  return next;
}

function normalizeContactCapture(contactCapture = {}) {
  const contacts = Array.isArray(contactCapture.contacts) ? contactCapture.contacts.map(normalizeContact) : [];
  const currentContactId = contacts.some((contact) => contact.contact_id === contactCapture.current_contact_id)
    ? contactCapture.current_contact_id
    : '';

  return {
    current_contact_id: currentContactId,
    contacts
  };
}

function normalizeContact(contact = {}) {
  const timestamp = getTimestamp();
  const normalized = deepMerge(createEmptyContact(contact.contact_url || contact.merged_contact?.contact_identity?.linkedin_profile_url || '', contact.source_page_title || ''), contact);
  normalized.contact_id = contact.contact_id || normalized.contact_id;
  normalized.created_at = contact.created_at || timestamp;
  normalized.updated_at = contact.updated_at || timestamp;
  normalized.status = contact.status || 'in_progress';
  normalized.captured_sections = Array.isArray(contact.captured_sections) ? contact.captured_sections : [];
  normalized.merged_contact = deepMerge(createEmptyMergedContact(), contact.merged_contact || {});
  normalized.company_name_entered = typeof contact.company_name_entered === 'string' ? contact.company_name_entered : '';
  removeCompanyProfileDataFromContact(normalized);
  normalized.validation_metadata = normalizeContactValidation(contact.validation_metadata);
  return normalized;
}


function removeCompanyProfileDataFromContact(contact) {
  delete contact.company_extraction;
  delete contact.merged_company;
  delete contact.company_identity;
  delete contact.company_context;
  if (contact.merged_contact) {
    delete contact.merged_contact.company_extraction;
    delete contact.merged_contact.merged_company;
    delete contact.merged_contact.company_identity;
    delete contact.merged_contact.company_context;
  }
}

function normalizeContactValidation(metadata = {}) {
  return {
    missing_fields: Array.isArray(metadata.missing_fields) ? metadata.missing_fields : [],
    field_conflicts: Array.isArray(metadata.field_conflicts) ? metadata.field_conflicts : [],
    validation_warnings: Array.isArray(metadata.validation_warnings) ? metadata.validation_warnings : [],
    needs_manual_validation: metadata.needs_manual_validation !== false
  };
}

function normalizeSessionValidation(metadata = {}) {
  return {
    needs_manual_validation: metadata.needs_manual_validation !== false,
    session_conflicts: Array.isArray(metadata.session_conflicts) ? metadata.session_conflicts : []
  };
}

function migrateSessionValidation(metadata = {}) {
  return {
    needs_manual_validation: metadata?.needs_manual_validation !== false,
    session_conflicts: Array.isArray(metadata?.session_conflicts) ? metadata.session_conflicts : []
  };
}

function filterLegacyMissingFields(fields) {
  return fields
    .filter((field) => String(field).startsWith('merged_contact.'))
    .map((field) => String(field).replace('merged_contact.', ''));
}

function hasMergedContactData(mergedContact) {
  return Object.values(mergedContact.contact_identity || {}).some(Boolean)
    || Object.values(mergedContact.profile_content || {}).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value))
    || Object.values(mergedContact.outreach_inputs || {}).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));
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

  if (section.type === SECTION_TYPES.CONTACT_URL) {
    const contact = createContactFromUrl(nextSession, section.payload?.url || section.sourceUrl || '', section.payload?.title || '');
    if (contact) contact.company_name_entered = nextSession.company_name_entered || '';
  } else if (section.type === SECTION_TYPES.CONTACT_INFO) {
    const contact = ensureCurrentContactForSelectedInfo(nextSession);
    if (contact) contact.company_name_entered = nextSession.company_name_entered || '';
  }

  const mergedSession = mergeSession(nextSession, section, companyName);

  if (section.type === SECTION_TYPES.COMPANY_URL) {
    mergedSession.company_extraction.company_url = section.payload?.url || section.sourceUrl || '';
    mergedSession.company_extraction.source_page_title = section.payload?.title || '';
  }

  return mergedSession;
}


function ensureCurrentContactForSelectedInfo(session) {
  const normalized = session?.contact_capture ? session : normalizeSession(session);
  const current = getCurrentContact(normalized);
  if (current) return current;

  const contact = createEmptyContact();
  contact.company_name_entered = normalized.company_name_entered || '';
  contact.contact_url = '';
  contact.status = 'missing_contact_url';
  contact.merged_contact.contact_identity.linkedin_profile_url = '';
  contact.validation_metadata = normalizeContactValidation(contact.validation_metadata);
  addContactValidationWarning(contact, 'Contact URL missing. Use Extract contact URL on the contact profile.');
  normalized.contact_capture.contacts.push(contact);
  normalized.contact_capture.current_contact_id = contact.contact_id;
  normalized.updated_at = getTimestamp();
  return contact;
}

function addContactValidationWarning(contact, message) {
  contact.validation_metadata = normalizeContactValidation(contact.validation_metadata);
  const warning = {
    type: 'validation_warning',
    field: 'contact_url',
    message,
    captured_at: getTimestamp()
  };

  const exists = contact.validation_metadata.validation_warnings.some((item) => (
    item?.type === warning.type
      && item?.field === warning.field
      && item?.message === warning.message
  ));

  if (!exists) contact.validation_metadata.validation_warnings.push(warning);
}

function normalizeUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';

  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch (_error) {
    return '';
  }
}

function addSessionValidationWarning(session, message) {
  session.validation_metadata = normalizeSessionValidation(session.validation_metadata);
  const warning = {
    type: 'validation_warning',
    field: 'contact_url',
    message,
    captured_at: getTimestamp()
  };

  const hasWarning = session.validation_metadata.session_conflicts.some((item) => (
    item?.type === warning.type
      && item?.field === warning.field
      && item?.message === warning.message
  ));

  if (!hasWarning) session.validation_metadata.session_conflicts.push(warning);
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
