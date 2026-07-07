function readSelectedText() {
  return window.getSelection().toString();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'GET_SELECTED_TEXT') return false;

  sendResponse({
    text: readSelectedText(),
    title: document.title,
    pageUrl: window.location.href
  });
  return false;
});
