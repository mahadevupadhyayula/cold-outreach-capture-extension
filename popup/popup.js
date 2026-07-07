import { MODES, SECTION_TYPES, STORAGE_KEYS } from '../src/constants.js';
import { downloadExtractionAsJsonText } from '../src/download.js';
import { createEmptyContact, createEmptySession, getTimestamp } from '../src/store.js';

const settingsForm = document.querySelector('#settingsForm');
const companyNameInput = document.querySelector('#companyNameInput');
const extractionMode = document.querySelector('#extractionMode');
const startNewContactButton = document.querySelector('#startNewContactButton');
const removeCurrentContactButton = document.querySelector('#removeCurrentContactButton');
const downloadContactsButton = document.querySelector('#downloadContactsButton');
const downloadCompanyInfoButton = document.querySelector('#downloadCompanyInfoButton');
const clearSessionButton = document.querySelector('#clearSessionButton');
const status = document.querySelector('#status');

const activeContactBadge = document.querySelector('#activeContactBadge');
const previewCurrentContactName = document.querySelector('#previewCurrentContactName');
const previewCurrentContactUrl = document.querySelector('#previewCurrentContactUrl');
const previewCurrentContactStatus = document.querySelector('#previewCurrentContactStatus');
const previewCurrentContactSections = document.querySelector('#previewCurrentContactSections');
const previewTotalContacts = document.querySelector('#previewTotalContacts');
const previewContactList = document.querySelector('#previewContactList');
const companySummaryCard = document.querySelector('#companySummaryCard');
const previewCompanyName = document.querySelector('#previewCompanyName');
const previewMode = document.querySelector('#previewMode');
const previewCompanyUrl = document.querySelector('#previewCompanyUrl');
const previewCompanySections = document.querySelector('#previewCompanySections');
const previewMissingCompanyFields = document.querySelector('#previewMissingCompanyFields');
const previewFieldConflicts = document.querySelector('#previewFieldConflicts');
const previewWarnings = document.querySelector('#previewWarnings');
const previewRecentSections = document.querySelector('#previewRecentSections');

const COMPANY_SECTION_TYPES = new Set([SECTION_TYPES.COMPANY_INFO, SECTION_TYPES.COMPANY_URL]);

init();

async function init() {
  const { settings, session } = await loadState();
  companyNameInput.value = getEnteredCompanyName(settings, session);
  extractionMode.value = getActiveMode(settings, session);
  renderPreview(settings, session);
}

settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const companyName = companyNameInput.value.trim();
  const mode = extractionMode.value || MODES.CONTACT;
  const { session } = await loadState();
  const nextSession = session || createEmptySession(companyName);

  nextSession.company_name_entered = companyName;
  nextSession.companyName = companyName;
  nextSession.active_mode = mode;
  nextSession.updated_at = getTimestamp();

  const settings = {
    companyName,
    mode,
    company_name_entered: companyName,
    active_mode: mode
  };

  await chrome.storage.local.set({
    [STORAGE_KEYS.SETTINGS]: settings,
    [STORAGE_KEYS.SESSION]: nextSession
  });

  renderPreview(settings, nextSession);
  setStatus('Session settings saved.');
});

extractionMode.addEventListener('change', async () => {
  await saveSettingsFromInputs(false);
});

startNewContactButton.addEventListener('click', async () => {
  const { settings, session } = await loadState();
  const nextSession = session || createEmptySession(getEnteredCompanyName(settings, session));
  const contact = createEmptyContact();
  contact.status = 'missing_contact_url';
  contact.merged_contact.contact_identity.linkedin_profile_url = '';

  nextSession.contact_capture = nextSession.contact_capture || { current_contact_id: '', contacts: [] };
  nextSession.contact_capture.contacts.push(contact);
  nextSession.contact_capture.current_contact_id = contact.contact_id;
  nextSession.active_mode = MODES.CONTACT;
  nextSession.updated_at = getTimestamp();

  const nextSettings = { ...settings, mode: MODES.CONTACT, active_mode: MODES.CONTACT };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: nextSettings, [STORAGE_KEYS.SESSION]: nextSession });
  extractionMode.value = MODES.CONTACT;
  renderPreview(nextSettings, nextSession);
  setStatus('Started a new draft contact.');
});

removeCurrentContactButton.addEventListener('click', async () => {
  const { settings, session } = await loadState();
  const currentSession = session || createEmptySession(getEnteredCompanyName(settings, session));
  const currentContact = getCurrentContact(currentSession);
  if (!currentContact) {
    setStatus('No current contact to remove.');
    return;
  }

  const label = getContactName(currentContact) || currentContact.contact_url || 'this draft contact';
  const confirmed = window.confirm(`Remove ${label} from this session?`);
  if (!confirmed) return;

  const contacts = getContacts(currentSession).filter((contact) => contact.contact_id !== currentContact.contact_id);
  currentSession.contact_capture.contacts = contacts;
  currentSession.contact_capture.current_contact_id = contacts.at(-1)?.contact_id || '';
  currentSession.updated_at = getTimestamp();
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSION]: currentSession });
  renderPreview(settings, currentSession);
  setStatus('Current contact removed.');
});

downloadContactsButton.addEventListener('click', async () => {
  const { settings, session } = await loadState();
  const downloaded = await downloadExtraction(session, settings, 'contacts');
  if (downloaded) setStatus('Contacts downloaded.');
});

downloadCompanyInfoButton.addEventListener('click', async () => {
  const { settings, session } = await loadState();
  const downloaded = await downloadExtraction(session, settings, 'company');
  if (downloaded) setStatus('Company info downloaded.');
});

clearSessionButton.addEventListener('click', async () => {
  const confirmed = window.confirm('Clear all local session data for Cold Outreach Capture?');
  if (!confirmed) return;

  await chrome.storage.local.clear();
  companyNameInput.value = '';
  extractionMode.value = MODES.CONTACT;
  renderPreview(defaultSettings(), createEmptySession());
  setStatus('Session cleared.');
});

chrome.storage.onChanged.addListener(async (_changes, areaName) => {
  if (areaName !== 'local') return;
  const { settings, session } = await loadState();
  companyNameInput.value = getEnteredCompanyName(settings, session);
  extractionMode.value = getActiveMode(settings, session);
  renderPreview(settings, session);
});

async function saveSettingsFromInputs(showStatus = true) {
  const { session } = await loadState();
  const companyName = companyNameInput.value.trim();
  const mode = extractionMode.value || MODES.CONTACT;
  const nextSession = session || createEmptySession(companyName);
  nextSession.company_name_entered = companyName;
  nextSession.companyName = companyName;
  nextSession.active_mode = mode;
  nextSession.updated_at = getTimestamp();

  const settings = { companyName, mode, company_name_entered: companyName, active_mode: mode };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings, [STORAGE_KEYS.SESSION]: nextSession });
  if (showStatus) setStatus('Session settings saved.');
}

async function loadState() {
  const result = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS, STORAGE_KEYS.SESSION]);
  return {
    settings: result[STORAGE_KEYS.SETTINGS] || defaultSettings(),
    session: result[STORAGE_KEYS.SESSION] || null
  };
}

function defaultSettings() {
  return { companyName: '', mode: MODES.CONTACT, company_name_entered: '', active_mode: MODES.CONTACT };
}

function renderPreview(settings, session) {
  const currentSession = session || createEmptySession();
  const summary = buildSessionSummary(settings, currentSession);

  previewCurrentContactName.textContent = summary.currentContactName || '—';
  previewCurrentContactUrl.textContent = summary.currentContactUrl || '—';
  previewCurrentContactStatus.textContent = formatStatus(summary.currentContactStatus || '—');
  previewCurrentContactSections.textContent = String(summary.currentContactSectionsCount);
  activeContactBadge.textContent = summary.currentContact ? 'Active contact' : 'No active contact';
  previewTotalContacts.textContent = String(summary.contacts.length);
  renderContactList(summary.contacts, summary.currentContact?.contact_id);

  previewCompanyName.textContent = summary.companyName || '—';
  previewMode.textContent = formatMode(summary.activeMode);
  companySummaryCard.classList.toggle('is-contact-mode', summary.activeMode !== MODES.COMPANY);
  previewCompanyUrl.textContent = summary.companyUrl || '—';
  previewCompanySections.textContent = String(summary.companySections.length);
  previewMissingCompanyFields.textContent = formatFieldList(summary.missingCompanyFields);
  previewFieldConflicts.textContent = String(summary.fieldConflictsCount);
  renderWarnings(buildWarnings(summary));
  renderRecentSections(summary.sections);
}

function buildSessionSummary(settings, session) {
  const flatSections = Array.isArray(session.sections) ? session.sections : [];
  const capturedSections = [
    ...(getContacts(session).flatMap((contact) => contact.captured_sections || [])),
    ...(session.company_extraction?.captured_sections || [])
  ];
  const sections = flatSections.length > 0 ? flatSections : capturedSections;
  const companySections = sections.filter((section) => COMPANY_SECTION_TYPES.has(section.type));
  const missingFields = session.validation_metadata?.missing_fields || [];
  const contacts = getContacts(session);
  const currentContact = getCurrentContact(session) || contacts.at(-1) || null;

  return {
    companyName: getEnteredCompanyName(settings, session),
    activeMode: getActiveMode(settings, session),
    contacts,
    currentContact,
    currentContactName: currentContact ? getContactName(currentContact) : '',
    currentContactUrl: currentContact ? getContactUrl(currentContact) : '',
    currentContactStatus: currentContact?.status || '',
    currentContactSectionsCount: currentContact?.captured_sections?.length || 0,
    companyUrl: session.company_extraction?.company_url || readSectionUrl(findLastSection(sections, SECTION_TYPES.COMPANY_URL)),
    companySections,
    missingCompanyFields: filterMissingFields(missingFields, 'merged_company.'),
    contactsMissingUrlCount: contacts.filter((contact) => getMissingFields(contact).includes('contact_url') || !getContactUrl(contact)).length,
    contactsMissingNameCount: contacts.filter((contact) => getMissingFields(contact).includes('contact_identity.full_name') || !getContactName(contact)).length,
    contactsWithConflictsCount: contacts.filter((contact) => (contact.validation_metadata?.field_conflicts || []).length > 0).length,
    fieldConflictsCount: getConflictCount(session),
    sections
  };
}

function getContacts(session) {
  return Array.isArray(session?.contact_capture?.contacts) ? session.contact_capture.contacts : [];
}

function getCurrentContact(session) {
  const contacts = getContacts(session);
  return contacts.find((contact) => contact.contact_id === session?.contact_capture?.current_contact_id) || null;
}

function renderContactList(contacts, currentContactId) {
  previewContactList.innerHTML = '';
  if (contacts.length === 0) {
    const item = document.createElement('li');
    item.className = 'empty-state';
    item.textContent = 'No contacts captured yet. Start a new contact or right-click a profile URL.';
    previewContactList.append(item);
    return;
  }

  contacts.forEach((contact, index) => {
    const item = document.createElement('li');
    if (contact.contact_id === currentContactId) item.classList.add('active-contact');
    const missingFields = getMissingFields(contact);
    const conflictCount = contact.validation_metadata?.field_conflicts?.length || 0;
    const reviewLabel = contact.validation_metadata?.needs_manual_validation
      ? `Manual review: ${missingFields.length} missing${conflictCount ? `, ${conflictCount} conflict${conflictCount === 1 ? '' : 's'}` : ''}`
      : 'Complete';
    item.innerHTML = `
      <strong>${escapeHtml(getContactName(contact) || 'Unnamed contact')}${contact.contact_id === currentContactId ? ' · Active' : ''}</strong>
      <span>${escapeHtml(getContactUrl(contact) || 'No contact URL')}</span>
      <p class="contact-meta">
        <span>${(contact.captured_sections || []).length} sections</span>
        <span>${escapeHtml(formatStatus(contact.status || 'unknown'))}</span>
        <span>${escapeHtml(reviewLabel)}</span>
        <span>#${index + 1}</span>
      </p>
    `;
    previewContactList.append(item);
  });
}

function getContactName(contact) {
  return contact?.merged_contact?.contact_identity?.full_name || '';
}

function getContactUrl(contact) {
  return contact?.contact_url || contact?.merged_contact?.contact_identity?.linkedin_profile_url || '';
}

function getMissingFields(contact) {
  return Array.isArray(contact?.validation_metadata?.missing_fields) ? contact.validation_metadata.missing_fields : [];
}

function getConflictCount(session) {
  const contactConflicts = getContacts(session).reduce((count, contact) => count + (contact.validation_metadata?.field_conflicts?.length || 0), 0);
  return contactConflicts + (session.validation_metadata?.session_conflicts?.length || 0);
}

function buildWarnings(summary, extractionType = null) {
  const warnings = [];
  if (!summary.companyName) warnings.push('Company name is required before downloading.');
  if ((!extractionType || extractionType === 'contacts') && summary.contacts.length === 0) warnings.push('Contact download has no contacts.');
  if ((!extractionType || extractionType === 'contacts') && summary.contactsMissingUrlCount > 0) warnings.push(`${summary.contactsMissingUrlCount} contact${summary.contactsMissingUrlCount === 1 ? '' : 's'} missing URL.`);
  if ((!extractionType || extractionType === 'contacts') && summary.contactsMissingNameCount > 0) warnings.push(`${summary.contactsMissingNameCount} contact${summary.contactsMissingNameCount === 1 ? '' : 's'} missing name.`);
  if ((!extractionType || extractionType === 'contacts') && summary.contactsWithConflictsCount > 0) warnings.push(`${summary.contactsWithConflictsCount} contact${summary.contactsWithConflictsCount === 1 ? '' : 's'} with field conflicts.`);
  if ((!extractionType || extractionType === 'company') && summary.companySections.length === 0) warnings.push('Company download has zero company sections.');
  return warnings;
}

function renderWarnings(warnings) {
  previewWarnings.innerHTML = '';
  if (warnings.length === 0) {
    previewWarnings.hidden = true;
    return;
  }
  previewWarnings.hidden = false;
  for (const warning of warnings) {
    const item = document.createElement('li');
    item.textContent = warning;
    previewWarnings.append(item);
  }
}

function renderRecentSections(sections) {
  previewRecentSections.innerHTML = '';
  const recentSections = [...sections].sort(compareCapturedAt).slice(-5).reverse();
  if (recentSections.length === 0) {
    const item = document.createElement('li');
    item.className = 'empty-state';
    item.textContent = 'No sections captured yet.';
    previewRecentSections.append(item);
    return;
  }
  for (const section of recentSections) {
    const item = document.createElement('li');
    item.innerHTML = `<strong>${formatSectionType(section.type)} · ${escapeHtml(getSectionTitle(section))}</strong><span>${formatCapturedAt(getCapturedAt(section))}</span><p>${escapeHtml(getSectionPreview(section))}</p>`;
    previewRecentSections.append(item);
  }
}

function getEnteredCompanyName(settings, session) {
  return settings.company_name_entered || settings.companyName || session?.company_name_entered || session?.companyName || '';
}

function getActiveMode(settings, session = null) {
  return settings.active_mode || settings.mode || session?.active_mode || MODES.CONTACT;
}

function formatMode(mode) { return mode === MODES.COMPANY ? 'Company' : 'Contact'; }
function formatStatus(value) { return String(value || '').replaceAll('_', ' '); }
function readSectionUrl(section) { return section?.payload?.url || section?.sourceUrl || section?.payload?.source_url || ''; }
function findLastSection(sections, type) { return [...sections].reverse().find((section) => section.type === type); }
function filterMissingFields(fields, prefix) { return fields.filter((field) => String(field).startsWith(prefix)).map((field) => String(field).replace(prefix, '')); }
function formatFieldList(fields) { return fields.length === 0 ? 'None' : `${fields.length}: ${fields.map(formatFieldName).join(', ')}`; }
function formatFieldName(field) { return field.split('.').at(-1).replaceAll('_', ' '); }
function getSectionTitle(section) { return section?.payload?.title || section?.payload?.name || section?.payload?.section_type || String(section?.type || '').replaceAll('_', ' ') || '—'; }
function getCapturedAt(section) { return section?.capturedAt || section?.captured_at || section?.payload?.captured_at || section?.payload?.capturedAt || ''; }
function compareCapturedAt(left, right) { return new Date(getCapturedAt(left) || 0) - new Date(getCapturedAt(right) || 0); }
function formatCapturedAt(value) { return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : 'Captured time unknown'; }
function formatSectionType(type) { return String(type || '').replaceAll('_', ' '); }
function getSectionPreview(section) {
  const text = section?.payload?.selected_text || section?.payload?.text || section?.payload?.raw_text || section?.text || '';
  const compact = String(text).replace(/\s+/g, ' ').trim();
  return compact ? truncate(compact, 110) : 'No text preview available.';
}
function truncate(value, maxLength) { return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }

async function downloadExtraction(session, settings, extractionType) {
  const companyName = getEnteredCompanyName(settings, session);
  const currentSession = session || createEmptySession(companyName);
  const summary = buildSessionSummary(settings, currentSession);
  const warnings = buildWarnings(summary, extractionType);
  renderWarnings(warnings);

  if (!companyName) {
    setStatus('Add a company name before downloading.');
    return false;
  }
  if (extractionType === 'contacts' && summary.contacts.length === 0) {
    setStatus('Capture or start at least one contact before downloading.');
    return false;
  }

  await downloadExtractionAsJsonText(currentSession, extractionType, companyName);
  return true;
}

function setStatus(message) {
  status.textContent = message;
  window.setTimeout(() => {
    if (status.textContent === message) status.textContent = '';
  }, 2500);
}
