import { SECTION_TYPES } from './constants.js';
import { cleanText } from './cleanText.js';
import { parseContactInfo, parseContactUrl } from './parsers/contactParsers.js';
import { parseCompanyInfo, parseCompanyUrl } from './parsers/companyParsers.js';

export function parseSection({ type, text, url, sourceUrl }) {
  const base = {
    id: crypto.randomUUID(),
    type,
    sourceUrl: sourceUrl || '',
    capturedAt: new Date().toISOString()
  };

  if (type === SECTION_TYPES.CONTACT_INFO) {
    return { ...base, payload: parseContactInfo(text) };
  }

  if (type === SECTION_TYPES.CONTACT_URL) {
    return { ...base, payload: parseContactUrl(url || sourceUrl) };
  }

  if (type === SECTION_TYPES.COMPANY_INFO) {
    return { ...base, payload: parseCompanyInfo(text) };
  }

  if (type === SECTION_TYPES.COMPANY_URL) {
    return { ...base, payload: parseCompanyUrl(url || sourceUrl) };
  }

  return { ...base, payload: { rawText: cleanText(text || url || '') } };
}
