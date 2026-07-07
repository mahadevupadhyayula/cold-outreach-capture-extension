import { cleanText } from '../cleanText.js';

const RELEVANCE_KEYWORDS = ['AI', 'artificial intelligence', 'LLM', 'agents', 'agentic', 'automation', 'product', 'platform', 'workflow', 'data', 'CRM', 'GTM', 'SaaS'];
const ROLE_SIGNAL_KEYWORDS = ['Remote', 'Hybrid', 'AI', 'Product Manager', 'ML', 'Data', 'Engineer', 'Designer', 'Sales', 'Marketing'];

export function parseCompanySection(input = {}) {
  const context = normalizeInput(input);
  const sectionType = normalizeType(context.section_type || 'notes');
  const parser = COMPANY_SECTION_PARSERS[sectionType] || parseNotes;
  return withScore(context, parser(context));
}

export function parseCompanyInfo(text) {
  return parseCompanySection({ section_text: text, section_title_raw: firstLine(text) });
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

const COMPANY_SECTION_PARSERS = {
  overview: parseOverviewAbout,
  about: parseOverviewAbout,
  companysize: parseCompanySize,
  company_size: parseCompanySize,
  industry: parseIndustry,
  website: parseWebsite,
  headquarters: parseHeadquarters,
  specialties: parseSpecialties,
  jobs: parseJobs,
  people: parsePeople,
  posts: parsePosts,
  funding: parseFunding,
  notes: parseNotes
};

function parseOverviewAbout({ section_text, cleaned_text }) {
  const text = cleanText(section_text || cleaned_text);
  const fields = {};
  const snippets = [];
  if (text) addField(fields, snippets, 'description', text, snippet(text));
  const notes = matchingKeywords(text, RELEVANCE_KEYWORDS);
  if (notes.length) addField(fields, snippets, 'ai_product_relevance_notes', notes, text);
  return { parsed_fields: fields, source_snippets: snippets };
}

function parseCompanySize({ section_text, cleaned_text }) {
  const text = cleanText(section_text || cleaned_text);
  const match = text.match(/\b\d[\d,]*(?:\+)?\s*(?:-–—|to)\s*\d[\d,]*(?:\+)?\s+employees\b|\b\d[\d,]*\+?\s+employees\b/i);
  return match ? { parsed_fields: { company_size: match[0] }, source_snippets: [match[0]] } : emptyParsed();
}

function parseIndustry({ section_text, cleaned_text }) {
  const line = firstUsefulValue(section_text || cleaned_text);
  return line ? { parsed_fields: { industry: line }, source_snippets: [line] } : emptyParsed();
}

function parseWebsite({ section_text, cleaned_text }) {
  const text = cleanText(section_text || cleaned_text);
  const website = (text.match(/https?:\/\/[^\s)]+|\bwww\.[A-Z0-9.-]+\.[A-Z]{2,}[^\s)]*/i) || [])[0] || '';
  return website ? { parsed_fields: { website }, source_snippets: [website] } : emptyParsed();
}

function parseHeadquarters({ section_text, cleaned_text }) {
  const line = firstUsefulValue(section_text || cleaned_text);
  return line ? { parsed_fields: { headquarters: line }, source_snippets: [line] } : emptyParsed();
}

function parseSpecialties({ section_text, cleaned_text }) {
  const text = cleanText(section_text || cleaned_text);
  const specialties = text.split(/[,\n•]/).map((item) => item.trim()).filter((item) => item && item.length <= 80).slice(0, 30);
  return specialties.length ? { parsed_fields: { specialties }, source_snippets: specialties } : emptyParsed();
}

function parseJobs({ section_text, cleaned_text }) {
  const text = cleanText(section_text || cleaned_text);
  const fields = {};
  const snippets = [];
  const roleSignals = extractRoleSignals(text);
  if (roleSignals.length) addField(fields, snippets, 'open_role_signals', roleSignals, text);
  const remote = matchingKeywords(text, ['Remote', 'Hybrid']);
  if (remote.length) addField(fields, snippets, 'remote_hiring_signals', remote, text);
  return { parsed_fields: fields, source_snippets: snippets };
}

function parsePeople({ section_text, cleaned_text }) {
  const text = cleanText(section_text || cleaned_text);
  return text ? { parsed_fields: { people_summary: snippet(text, 320) }, source_snippets: [snippet(text)] } : emptyParsed();
}

function parsePosts({ section_text, cleaned_text }) {
  const text = cleanText(section_text || cleaned_text);
  const topics = matchingKeywords(text, RELEVANCE_KEYWORDS).slice(0, 12);
  return topics.length ? { parsed_fields: { recent_post_topics: topics }, source_snippets: [snippet(text)] } : emptyParsed();
}

function parseFunding({ section_text, cleaned_text }) {
  const text = cleanText(section_text || cleaned_text);
  return text ? { parsed_fields: { funding_notes: text }, source_snippets: [snippet(text)] } : emptyParsed();
}

function parseNotes({ section_text, cleaned_text }) {
  const text = cleanText(section_text || cleaned_text);
  return text ? { parsed_fields: { note_text: text }, source_snippets: [snippet(text)] } : emptyParsed();
}

function normalizeInput(input) {
  const raw = input.section_text || input.text || '';
  return {
    ...input,
    raw_selected_text: raw,
    section_type: input.section_type || input.sectionType,
    page_url: input.page_url || input.sourceUrl || input.url || '',
    page_title: input.page_title || input.title || '',
    section_title_raw: input.section_title_raw || '',
    cleaned_text: cleanText(raw),
    section_text: cleanText(raw)
  };
}

function withScore(context, result) {
  const parsedFields = result.parsed_fields || {};
  const count = Object.keys(parsedFields).length;
  return {
    section_type: normalizeType(context.section_type || 'notes'),
    section_title_raw: context.section_title_raw || '',
    captured_at: new Date().toISOString(),
    source_url: context.page_url || '',
    source_page_title: context.page_title || '',
    raw_selected_text: context.raw_selected_text || context.section_text || '',
    cleaned_text: context.cleaned_text || '',
    section_text: context.section_text || '',
    parsed_fields: parsedFields,
    source_snippets: [...new Set(result.source_snippets || [])].filter(Boolean),
    confidence_score: count ? Math.min(0.95, 0.45 + count * 0.12) : 0
  };
}

function addField(fields, snippets, key, value, source) {
  if (value === '' || value === undefined || value === null || (Array.isArray(value) && !value.length)) return;
  fields[key] = value;
  if (source) snippets.push(snippet(String(source)));
}
function emptyParsed() { return { parsed_fields: {}, source_snippets: [] }; }
function meaningfulLines(text) { return cleanText(text).split('\n').map((line) => line.trim()).filter(Boolean); }
function firstLine(text) { return meaningfulLines(text)[0] || ''; }
function firstUsefulValue(text) { return meaningfulLines(text).find((line) => !/^(industry|headquarters|company size|website)$/i.test(line)) || ''; }
function normalizeType(type) { return String(type || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'notes'; }
function matchingKeywords(text, keywords) { return keywords.filter((keyword) => new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i').test(text)); }
function extractRoleSignals(text) { return matchingKeywords(text, ROLE_SIGNAL_KEYWORDS).slice(0, 12); }
function snippet(text, length = 220) { return cleanText(text).slice(0, length); }
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function safeHostname(url) { try { return new URL(url).hostname; } catch (_error) { return ''; } }
