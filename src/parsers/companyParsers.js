import { cleanText } from '../cleanText.js';

export function parseCompanyInfo(text) {
  const cleaned = cleanText(text);
  const lines = cleaned.split('\n').map((line) => line.trim()).filter(Boolean);

  return {
    rawText: cleaned,
    name: lines[0] || '',
    description: lines.slice(1).join('\n')
  };
}

export function parseCompanyUrl(url) {
  const value = cleanText(url);
  return {
    url: value,
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
