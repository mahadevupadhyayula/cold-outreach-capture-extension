import { MODES } from '../src/constants.js';
import { getSession, getSettings, resetSession, saveSettings } from '../src/store.js';
import { downloadSessionAsText } from '../src/download.js';

const form = document.querySelector('#settings-form');
const companyNameInput = document.querySelector('#company-name');
const sectionCount = document.querySelector('#section-count');
const status = document.querySelector('#status');
const downloadButton = document.querySelector('#download-session');
const resetButton = document.querySelector('#reset-session');

init();

async function init() {
  const [settings, session] = await Promise.all([getSettings(), getSession()]);
  companyNameInput.value = settings.companyName || session.companyName || '';
  const mode = settings.mode || MODES.CONTACT;
  form.elements.mode.value = mode;
  sectionCount.textContent = String(session.sections?.length || 0);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const settings = await saveSettings({
    companyName: companyNameInput.value,
    mode: form.elements.mode.value
  });
  setStatus(`Saved ${settings.companyName || 'session'} details.`);
});

downloadButton.addEventListener('click', async () => {
  const session = await getSession();
  downloadSessionAsText(session);
  setStatus('Downloaded local session file.');
});

resetButton.addEventListener('click', async () => {
  const session = await resetSession(companyNameInput.value);
  sectionCount.textContent = String(session.sections.length);
  setStatus('Session reset.');
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  const session = changes['coldOutreachCapture.session']?.newValue;
  if (session) {
    sectionCount.textContent = String(session.sections?.length || 0);
  }
});

function setStatus(message) {
  status.textContent = message;
  window.setTimeout(() => {
    if (status.textContent === message) status.textContent = '';
  }, 2500);
}
