const UI_ONLY_LINES = new Set([
  'connect',
  'message',
  'follow',
  'more',
  'see more',
  'show more',
  'show all',
  'show less',
  'contact info',
  'people also viewed',
  'promoted'
]);

const SECTION_TITLE_MAP = new Map([
  ['header', 'header'],
  ['profile', 'header'],
  ['about', 'about'],
  ['experience', 'experience'],
  ['current role', 'experience'],
  ['activity', 'activity'],
  ['posts', 'activity'],
  ['featured', 'featured'],
  ['education', 'education'],
  ['contact', 'contact'],
  ['overview', 'overview'],
  ['companysize', 'company_size'],
  ['company size', 'company_size'],
  ['industry', 'industry'],
  ['website', 'website'],
  ['headquarters', 'headquarters'],
  ['specialties', 'specialties'],
  ['jobs', 'jobs'],
  ['people', 'people'],
  ['funding', 'funding'],
  ['notes', 'notes']
]);

export function cleanText(value) {
  return cleanSelectedText(value);
}

export function cleanSelectedText(text) {
  if (!text) return '';

  return String(text)
    .replace(/\u00a0/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/[\t ]+/g, ' '))
    .filter((line) => line && !UI_ONLY_LINES.has(line.toLowerCase()))
    .join('\n');
}

export function splitSectionTitleAndBody(text) {
  const cleaned = cleanSelectedText(text);
  const lines = cleaned.split('\n').map((line) => line.trim()).filter(Boolean);

  if (lines.length <= 1) {
    return {
      section_title_raw: 'Notes',
      section_text: lines[0] || ''
    };
  }

  return {
    section_title_raw: lines[0],
    section_text: lines.slice(1).join('\n')
  };
}

export function normalizeSectionTitle(title) {
  const normalized = String(title || '')
    .replace(/\u00a0/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return SECTION_TITLE_MAP.get(normalized) || SECTION_TITLE_MAP.get(normalized.replace(/\s+/g, '')) || normalized;
}

export function removeTrackingParams(url) {
  const value = cleanSelectedText(url);
  if (!value) return '';

  try {
    const parsed = new URL(value);
    if (!/(^|\.)linkedin\.com$/i.test(parsed.hostname)) {
      return value;
    }

    return `${parsed.origin}${parsed.pathname}`;
  } catch (_error) {
    return value;
  }
}

export function safeFilename(input) {
  return String(input || '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_');
}
