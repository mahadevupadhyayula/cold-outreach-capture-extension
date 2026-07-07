import { MENU_DEFINITIONS, MENU_ACTIONS, SECTION_TYPES } from '../src/constants.js';
import { appendSection, extractContactUrlFromPage } from '../src/store.js';
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

  const selection = await getCurrentSelection(tab);
  const pageUrl = info.pageUrl || tab?.url || selection.pageUrl || '';
  const pageTitle = selection.title || tab?.title || '';

  if (type === SECTION_TYPES.CONTACT_URL) {
    await extractContactUrlFromPage(pageUrl, pageTitle);
    return;
  }

  if (type === SECTION_TYPES.COMPANY_URL) {
    await appendSection(parseSection({
      type,
      url: pageUrl,
      sourceUrl: pageUrl,
      title: pageTitle
    }));
    return;
  }

  const text = selection.text || info.selectionText || '';
  if (!text.trim()) return;

  await appendSection(parseSection({
    type,
    text,
    sourceUrl: pageUrl,
    title: pageTitle
  }));
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

async function getCurrentSelection(tab) {
  if (!tab?.id) {
    return { text: '', title: tab?.title || '', pageUrl: tab?.url || '' };
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTED_TEXT' });
    if (response) return normalizeSelectionResponse(response, tab);
  } catch (_error) {
    // The content script may be unavailable on this page or not injected yet.
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        text: window.getSelection().toString(),
        title: document.title,
        pageUrl: window.location.href
      })
    });
    return normalizeSelectionResponse(result?.result, tab);
  } catch (_error) {
    // Chrome internal pages and other restricted URLs cannot run injected scripts.
  }

  return { text: '', title: tab?.title || '', pageUrl: tab?.url || '' };
}

function normalizeSelectionResponse(response, tab) {
  return {
    text: response?.text || '',
    title: response?.title || tab?.title || '',
    pageUrl: response?.pageUrl || response?.url || tab?.url || ''
  };
}
