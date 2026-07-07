function readSelection() {
  return String(window.getSelection?.() || '').trim();
}

async function storeSelection() {
  const text = readSelection();
  if (!text) return;

  await chrome.storage.local.set({
    'coldOutreachCapture.lastSelection': {
      text,
      pageUrl: window.location.href,
      title: document.title,
      capturedAt: new Date().toISOString()
    }
  });
}

document.addEventListener('selectionchange', () => {
  window.clearTimeout(window.__coldOutreachSelectionTimer);
  window.__coldOutreachSelectionTimer = window.setTimeout(storeSelection, 150);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'GET_SELECTION') return false;

  sendResponse({
    text: readSelection(),
    pageUrl: window.location.href,
    title: document.title
  });
  return false;
});
