import { SECTION_TYPES } from './constants.js';
import { cleanText, normalizeSectionTitle, splitSectionTitleAndBody } from './cleanText.js';
import { parseContactSection, parseContactUrl } from './parsers/contactParsers.js';
import { parseCompanySection, parseCompanyUrl } from './parsers/companyParsers.js';

export function parseSection(input = {}) {
  const extractionType = input.extraction_type || extractionTypeFromLegacyType(input.type);
  const sectionType = normalizeRequestedSectionType(input.section_type, input.section_title_raw, input.text || input.section_text);

  if (isStructuredSectionInput(input, extractionType)) {
    return parseStructuredSection({ ...input, extraction_type: extractionType, section_type: sectionType });
  }

  return parseLegacySection(input, extractionType, sectionType);
}

function parseStructuredSection(input) {
  if (input.extraction_type === 'contact') return parseContactSection(input);
  if (input.extraction_type === 'company') return parseCompanySection(input);
  return buildUnknownSection(input);
}

function parseLegacySection(input, extractionType, sectionType) {
  const { type, text, url, sourceUrl, title } = input;
  const base = {
    id: crypto.randomUUID(),
    type,
    sourceUrl: sourceUrl || '',
    sourceTitle: title || '',
    capturedAt: new Date().toISOString()
  };

  if (type === SECTION_TYPES.CONTACT_URL) {
    return { ...base, payload: parseContactUrl(url || sourceUrl, title) };
  }

  if (type === SECTION_TYPES.COMPANY_URL) {
    return { ...base, payload: parseCompanyUrl(url || sourceUrl, title) };
  }

  const splitSection = splitSectionTitleAndBody(text);
  const sectionInput = {
    extraction_type: extractionType,
    section_type: sectionType,
    section_title_raw: splitSection.section_title_raw,
    section_text: splitSection.section_text,
    page_url: sourceUrl || url || '',
    page_title: title || ''
  };

  if (type === SECTION_TYPES.CONTACT_INFO) {
    return { ...base, payload: parseContactSection(sectionInput) };
  }

  if (type === SECTION_TYPES.COMPANY_INFO) {
    return { ...base, payload: parseCompanySection(sectionInput) };
  }

  return { ...base, payload: { rawText: cleanText(text || url || '') } };
}

function buildUnknownSection(input) {
  const text = cleanText(input.section_text || input.text || '');
  return {
    section_type: input.section_type || 'notes',
    section_title_raw: input.section_title_raw || '',
    captured_at: new Date().toISOString(),
    source_url: input.page_url || input.sourceUrl || '',
    source_page_title: input.page_title || input.title || '',
    raw_selected_text: input.section_text || input.text || '',
    cleaned_text: text,
    section_text: text,
    parsed_fields: text ? { note_text: text } : {},
    source_snippets: text ? [text.slice(0, 220)] : [],
    confidence_score: text ? 0.35 : 0
  };
}

function isStructuredSectionInput(input, extractionType) {
  return Boolean(input.extraction_type || (input.section_type && extractionType));
}

function extractionTypeFromLegacyType(type) {
  if (type === SECTION_TYPES.CONTACT_INFO || type === SECTION_TYPES.CONTACT_URL) return 'contact';
  if (type === SECTION_TYPES.COMPANY_INFO || type === SECTION_TYPES.COMPANY_URL) return 'company';
  return '';
}

function normalizeRequestedSectionType(sectionType, sectionTitleRaw, text) {
  if (sectionType) return normalizeSectionTitle(sectionType);
  if (sectionTitleRaw) return normalizeSectionTitle(sectionTitleRaw);
  const split = splitSectionTitleAndBody(text || '');
  return normalizeSectionTitle(split.section_title_raw || 'notes');
}
