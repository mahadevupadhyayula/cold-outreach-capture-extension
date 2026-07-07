export const STORAGE_KEYS = Object.freeze({
  SESSION: 'coldOutreachCapture.session',
  SETTINGS: 'coldOutreachCapture.settings',
  LAST_SELECTION: 'coldOutreachCapture.lastSelection'
});

export const SESSION_SCHEMA_VERSION = '0.1.0';

export const MODES = Object.freeze({
  CONTACT: 'contact',
  COMPANY: 'company'
});

export const SECTION_TYPES = Object.freeze({
  CONTACT_INFO: 'contact_info',
  CONTACT_URL: 'contact_url',
  COMPANY_INFO: 'company_info',
  COMPANY_URL: 'company_url'
});

export const MENU_ACTIONS = Object.freeze({
  EXTRACT_CONTACT_INFO: 'extract-contact-info',
  EXTRACT_CONTACT_URL: 'extract-contact-url',
  EXTRACT_COMPANY_INFO: 'extract-company-info',
  EXTRACT_COMPANY_URL: 'extract-company-url'
});

export const MENU_DEFINITIONS = Object.freeze([
  { id: MENU_ACTIONS.EXTRACT_CONTACT_INFO, title: 'Extract contact info', contexts: ['selection'] },
  { id: MENU_ACTIONS.EXTRACT_CONTACT_URL, title: 'Extract contact URL', contexts: ['page', 'link', 'selection'] },
  { id: MENU_ACTIONS.EXTRACT_COMPANY_INFO, title: 'Extract company info', contexts: ['selection'] },
  { id: MENU_ACTIONS.EXTRACT_COMPANY_URL, title: 'Extract company URL', contexts: ['page', 'link', 'selection'] }
]);
