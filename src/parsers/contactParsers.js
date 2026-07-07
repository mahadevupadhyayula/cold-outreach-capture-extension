import { cleanText } from '../cleanText.js';

export function parseContactInfo(text) {
  const cleaned = cleanText(text);
  const email = cleaned.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  const phone = cleaned.match(/(?:\+?\d[\d().\-\s]{7,}\d)/)?.[0]?.trim() || '';
  const lines = cleaned.split('\n').map((line) => line.trim()).filter(Boolean);

  return {
    rawText: cleaned,
    name: lines[0] || '',
    headline: lines[1] || '',
    email,
    phone
  };
}

export function parseContactUrl(url) {
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
