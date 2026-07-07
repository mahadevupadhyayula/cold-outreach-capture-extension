import { MENU_DEFINITIONS, MENU_ACTIONS, SECTION_TYPES } from '../src/constants.js';
import { appendSection, getLastSelection } from '../src/store.js';
import { parseSection } from '../src/sectionParser.js';

chrome.runtime.onInstalled.addListener(() => {
  registerContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  registerContextMenus();
});

function registerContextMenus() {
  chrome.contextMenus.removeAll(() => {
    for (const item of MENU_DEFINITIONS) {
      chrome.contextMenus.create(item);
    }
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const type = sectionTypeForMenu(info.menuItemId);
  if (!type) return;

  const selection = await getCurrentSelection(info, tab);
  const targetUrl = info.linkUrl || info.pageUrl || tab?.url || selection.pageUrl || '';
  const text = info.selectionText || selection.text || '';

  const section = parseSection({
    type,
    text,
    url: targetUrl,
    sourceUrl: info.pageUrl || tab?.url || selection.pageUrl || ''
  });

  await appendSection(section);
});

function sectionTypeForMenu(menuItemId) {
  const map = {
    [MENU_ACTIONS.EXTRACT_CONTACT_INFO]: SECTION_TYPES.CONTACT_INFO,
    [MENU_ACTIONS.EXTRACT_CONTACT_URL]: SECTION_TYPES.CONTACT_URL,
    [MENU_ACTIONS.EXTRACT_COMPANY_INFO]: SECTION_TYPES.COMPANY_INFO,
    [MENU_ACTIONS.EXTRACT_COMPANY_URL]: SECTION_TYPES.COMPANY_URL
  };
  return map[menuItemId] || '';
}

async function getCurrentSelection(info, tab) {
  if (info.selectionText) {
    return { text: info.selectionText, pageUrl: info.pageUrl || tab?.url || '' };
  }

  if (!tab?.id) {
    return getLastSelection();
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' });
    if (response?.text) return response;
  } catch (_error) {
    // Content scripts cannot run on Chrome internal pages. Fall back to the last local selection.
  }

  return getLastSelection();
}
