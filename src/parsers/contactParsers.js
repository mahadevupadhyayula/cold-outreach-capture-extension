import { cleanText } from '../cleanText.js';

export function parseContactInfo(text) {
  const cleaned = cleanText(text);
  const email = cleaned.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  const phone = cleaned.match(/(?:\+?\d[\d().\-\s]{7,}\d)/)?.[0]?.trim() || '';
  const lines = cleaned.split('\n').map((line) => line.trim()).filter(Boolean);

  return {
    rawText: cleaned,
    section_title_raw: lines[0] || '',
    section_text: lines.slice(1).join('\n'),
    name: lines[0] || '',
    headline: lines[1] || '',
    email,
    phone
  };
}

export function parseContactUrl(url, title = '') {
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
