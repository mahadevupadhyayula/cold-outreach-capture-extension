import { cleanText } from '../cleanText.js';

export function parseCompanyInfo(text) {
  const cleaned = cleanText(text);
  const lines = cleaned.split('\n').map((line) => line.trim()).filter(Boolean);

  return {
    rawText: cleaned,
    section_title_raw: lines[0] || '',
    section_text: lines.slice(1).join('\n'),
    name: lines[0] || '',
    description: lines.slice(1).join('\n')
  };
}

export function parseCompanyUrl(url, title = '') {
  const value = cleanText(url);
  return {
    url: value,
    title: cleanText(title),
    isLinkedIn: /(^|\.)linkedin\.com$/i.test(safeHostname(value)),
    capturedAt: new Date().toISOString()
  };
}

function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (_error) {
    return '';
  }
}
