import { MODES, SECTION_TYPES, STORAGE_KEYS } from '../src/constants.js';
import { downloadExtractionAsJsonText } from '../src/download.js';
import { createEmptySession } from '../src/mergeSession.js';

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
const previewLastSection = document.querySelector('#previewLastSection');

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

  if (!nextSession.companyName && companyName) {
    nextSession.companyName = companyName;
  }

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
  await downloadExtraction(session, settings, 'contacts');
  setStatus('Contacts downloaded.');
});

downloadCompanyInfoButton.addEventListener('click', async () => {
  const { settings, session } = await loadState();
  await downloadExtraction(session, settings, 'company');
  setStatus('Company info downloaded.');
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
  const sections = currentSession.sections || [];
  const contactSections = sections.filter((section) => CONTACT_SECTION_TYPES.has(section.type));
  const companySections = sections.filter((section) => COMPANY_SECTION_TYPES.has(section.type));
  const contactUrl = [...sections].reverse().find((section) => section.type === SECTION_TYPES.CONTACT_URL);
  const companyUrl = [...sections].reverse().find((section) => section.type === SECTION_TYPES.COMPANY_URL);
  const lastSection = sections.at(-1);

  previewCompanyName.textContent = getEnteredCompanyName(settings, currentSession) || '—';
  previewMode.textContent = formatMode(getActiveMode(settings));
  previewContactUrl.textContent = readSectionUrl(contactUrl) || '—';
  previewCompanyUrl.textContent = readSectionUrl(companyUrl) || '—';
  previewContactSections.textContent = String(contactSections.length);
  previewCompanySections.textContent = String(companySections.length);
  previewLastSection.textContent = getSectionTitle(lastSection);
}

function getEnteredCompanyName(settings, session) {
  return settings.company_name_entered || settings.companyName || session?.company_name_entered || session?.companyName || '';
}

function getActiveMode(settings) {
  return settings.active_mode || settings.mode || MODES.CONTACT;
}

function formatMode(mode) {
  return mode === MODES.COMPANY ? 'Company' : 'Contact';
}

function readSectionUrl(section) {
  return section?.payload?.url || section?.sourceUrl || '';
}

function getSectionTitle(section) {
  if (!section) return '—';
  return section.payload?.title || section.payload?.name || section.type.replaceAll('_', ' ');
}

async function downloadExtraction(session, settings, extractionType) {
  const companyName = getEnteredCompanyName(settings, session);
  const currentSession = session || createEmptySession(companyName);
  await downloadExtractionAsJsonText(currentSession, extractionType, companyName);
}

function setStatus(message) {
  status.textContent = message;
  window.setTimeout(() => {
    if (status.textContent === message) status.textContent = '';
  }, 2500);
}
