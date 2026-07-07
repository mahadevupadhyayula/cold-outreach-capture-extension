import { SECTION_TYPES } from './constants.js';
import { cleanText } from './cleanText.js';
import { parseContactInfo, parseContactUrl } from './parsers/contactParsers.js';
import { parseCompanyInfo, parseCompanyUrl } from './parsers/companyParsers.js';

export function parseSection({ type, text, url, sourceUrl, title }) {
  const base = {
    id: crypto.randomUUID(),
    type,
    sourceUrl: sourceUrl || '',
    sourceTitle: title || '',
    capturedAt: new Date().toISOString()
  };

  if (type === SECTION_TYPES.CONTACT_INFO) {
    return { ...base, payload: parseContactInfo(text) };
  }

  if (type === SECTION_TYPES.CONTACT_URL) {
    return { ...base, payload: parseContactUrl(url || sourceUrl, title) };
  }

  if (type === SECTION_TYPES.COMPANY_INFO) {
    return { ...base, payload: parseCompanyInfo(text) };
  }

  if (type === SECTION_TYPES.COMPANY_URL) {
    return { ...base, payload: parseCompanyUrl(url || sourceUrl, title) };
  }

  return { ...base, payload: { rawText: cleanText(text || url || '') } };
}
