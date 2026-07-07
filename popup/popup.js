import { MODES, SECTION_TYPES, STORAGE_KEYS } from '../src/constants.js';
import { downloadExtractionAsJsonText } from '../src/download.js';
import { createEmptySession } from '../src/store.js';

const settingsForm = document.querySelector('#settingsForm');
const companyNameInput = document.querySelector('#companyNameInput');
const extractionMode = document.querySelector('#extractionMode');
const downloadContactsButton = document.querySelector('#downloadContactsButton');
const downloadCompanyInfoButton = document.querySelector('#downloadCompanyInfoButton');
const clearSessionButton = document.querySelector('#clearSessionButton');
const status = document.querySelector('#status');

const previewCompanyName = document.querySelector('#previewCompanyName');
const previewMode = document.querySelector('#previewMode');
const previewContactUrl = document.querySelector('#previewContactUrl');
const previewCompanyUrl = document.querySelector('#previewCompanyUrl');
const previewContactSections = document.querySelector('#previewContactSections');
const previewCompanySections = document.querySelector('#previewCompanySections');
const previewMissingContactFields = document.querySelector('#previewMissingContactFields');
const previewMissingCompanyFields = document.querySelector('#previewMissingCompanyFields');
const previewFieldConflicts = document.querySelector('#previewFieldConflicts');
const previewWarnings = document.querySelector('#previewWarnings');
const previewRecentSections = document.querySelector('#previewRecentSections');

const CONTACT_SECTION_TYPES = new Set([SECTION_TYPES.CONTACT_INFO, SECTION_TYPES.CONTACT_URL]);
const COMPANY_SECTION_TYPES = new Set([SECTION_TYPES.COMPANY_INFO, SECTION_TYPES.COMPANY_URL]);

init();

async function init() {
  const { settings, session } = await loadState();
  companyNameInput.value = getEnteredCompanyName(settings, session);
  extractionMode.value = getActiveMode(settings);
  renderPreview(settings, session);
}

settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const companyName = companyNameInput.value.trim();
  const mode = extractionMode.value || MODES.CONTACT;
  const { session } = await loadState();
  const nextSession = session || createEmptySession(companyName);

  if (companyName) {
    nextSession.company_name_entered = companyName;
    nextSession.companyName = companyName;
  }
  nextSession.active_mode = mode;

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
  renderPreview(settings, session);
});

async function loadState() {
  const result = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS, STORAGE_KEYS.SESSION]);
  return {
    settings: result[STORAGE_KEYS.SETTINGS] || defaultSettings(),
    session: result[STORAGE_KEYS.SESSION] || null
  };
}

function defaultSettings() {
  return {
    companyName: '',
    mode: MODES.CONTACT,
    company_name_entered: '',
    active_mode: MODES.CONTACT
  };
}

function renderPreview(settings, session) {
  const currentSession = session || createEmptySession();
  const summary = buildSessionSummary(settings, currentSession);

  previewCompanyName.textContent = summary.companyName || '—';
  previewMode.textContent = formatMode(summary.activeMode);
  previewContactUrl.textContent = summary.contactUrl || '—';
  previewCompanyUrl.textContent = summary.companyUrl || '—';
  previewContactSections.textContent = String(summary.contactSections.length);
  previewCompanySections.textContent = String(summary.companySections.length);
  previewMissingContactFields.textContent = formatFieldList(summary.missingContactFields);
  previewMissingCompanyFields.textContent = formatFieldList(summary.missingCompanyFields);
  previewFieldConflicts.textContent = String(summary.fieldConflictsCount);
  renderWarnings(buildWarnings(summary));
  renderRecentSections(summary.sections);
}

function buildSessionSummary(settings, session) {
  const flatSections = Array.isArray(session.sections) ? session.sections : [];
  const capturedSections = [
    ...(session.contact_extraction?.captured_sections || []),
    ...(session.company_extraction?.captured_sections || [])
  ];
  const sections = flatSections.length > 0 ? flatSections : capturedSections;
  const contactSections = sections.filter((section) => CONTACT_SECTION_TYPES.has(section.type));
  const companySections = sections.filter((section) => COMPANY_SECTION_TYPES.has(section.type));
  const missingFields = session.validation_metadata?.missing_fields || [];

  return {
    companyName: getEnteredCompanyName(settings, session),
    activeMode: getActiveMode(settings, session),
    contactUrl: session.contact_extraction?.contact_url || readSectionUrl(findLastSection(sections, SECTION_TYPES.CONTACT_URL)),
    companyUrl: session.company_extraction?.company_url || readSectionUrl(findLastSection(sections, SECTION_TYPES.COMPANY_URL)),
    contactSections,
    companySections,
    missingContactFields: filterMissingFields(missingFields, 'merged_contact.'),
    missingCompanyFields: filterMissingFields(missingFields, 'merged_company.'),
    fieldConflictsCount: session.validation_metadata?.field_conflicts?.length || 0,
    sections
  };
}

function buildWarnings(summary, extractionType = null) {
  const warnings = [];
  if (!summary.companyName) warnings.push('Company name is required before downloading.');
  if ((!extractionType || extractionType === 'contacts') && !summary.contactUrl) warnings.push('Contact download has no contact URL.');
  if ((!extractionType || extractionType === 'contacts') && summary.contactSections.length === 0) warnings.push('Contact download has zero contact sections.');
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
    item.innerHTML = `
      <strong>${formatSectionType(section.type)} · ${escapeHtml(getSectionTitle(section))}</strong>
      <span>${formatCapturedAt(getCapturedAt(section))}</span>
      <p>${escapeHtml(getSectionPreview(section))}</p>
    `;
    previewRecentSections.append(item);
  }
}

function getEnteredCompanyName(settings, session) {
  return settings.company_name_entered || settings.companyName || session?.company_name_entered || session?.companyName || '';
}

function getActiveMode(settings, session = null) {
  return settings.active_mode || settings.mode || session?.active_mode || MODES.CONTACT;
}

function formatMode(mode) {
  return mode === MODES.COMPANY ? 'Company' : 'Contact';
}

function readSectionUrl(section) {
  return section?.payload?.url || section?.sourceUrl || section?.payload?.source_url || '';
}

function findLastSection(sections, type) {
  return [...sections].reverse().find((section) => section.type === type);
}

function filterMissingFields(fields, prefix) {
  return fields.filter((field) => String(field).startsWith(prefix)).map((field) => String(field).replace(prefix, ''));
}

function formatFieldList(fields) {
  if (fields.length === 0) return 'None';
  return `${fields.length}: ${fields.map(formatFieldName).join(', ')}`;
}

function formatFieldName(field) {
  return field.split('.').at(-1).replaceAll('_', ' ');
}

function getSectionTitle(section) {
  if (!section) return '—';
  return section.payload?.title || section.payload?.name || section.payload?.section_type || section.type.replaceAll('_', ' ');
}

function getCapturedAt(section) {
  return section?.capturedAt || section?.captured_at || section?.payload?.captured_at || section?.payload?.capturedAt || '';
}

function compareCapturedAt(left, right) {
  return new Date(getCapturedAt(left) || 0) - new Date(getCapturedAt(right) || 0);
}

function formatCapturedAt(value) {
  if (!value) return 'Captured time unknown';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function formatSectionType(type) {
  return String(type || '').replaceAll('_', ' ');
}

function getSectionPreview(section) {
  const text = section?.payload?.selected_text || section?.payload?.text || section?.payload?.raw_text || section?.text || '';
  const compact = String(text).replace(/\s+/g, ' ').trim();
  return compact ? truncate(compact, 110) : 'No text preview available.';
}

function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

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

  await downloadExtractionAsJsonText(currentSession, extractionType, companyName);
  return true;
}

function setStatus(message) {
  status.textContent = message;
  window.setTimeout(() => {
    if (status.textContent === message) status.textContent = '';
  }, 2500);
}
