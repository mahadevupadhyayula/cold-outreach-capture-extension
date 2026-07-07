import { cleanText } from '../cleanText.js';

const AI_PRODUCT_KEYWORDS = [
  'AI',
  'artificial intelligence',
  'LLM',
  'agents',
  'agentic',
  'automation',
  'product',
  'platform',
  'workflow',
  'data',
  'CRM',
  'GTM',
  'SaaS'
];

const ROLE_KEYWORDS = [
  'founder',
  'ceo',
  'cto',
  'cpo',
  'vp',
  'head',
  'director',
  'manager',
  'product',
  'engineering',
  'sales',
  'marketing',
  'growth',
  'operations',
  'data',
  'ai',
  'ml'
];

const SENIORITY_PATTERNS = [
  ['Co-founder', /\bco[-\s]?founder\b/i],
  ['Founding', /\bfounding\b/i],
  ['Founder', /\bfound(?:er|ing)\b/i],
  ['CEO', /\bCEO\b|Chief Executive Officer/i],
  ['VP', /\bVP\b|Vice President/i],
  ['RVP', /\bRVP\b|Regional Vice President/i],
  ['Head', /\bHead of\b/i],
  ['Director', /\bDirector\b/i],
  ['Staff', /\bStaff\b/i],
  ['Principal', /\bPrincipal\b/i],
  ['Senior', /\bSenior\b|\bSr\.?\b/i],
  ['Manager', /\bManager\b/i]
];

export function parseContactSection(input = {}) {
  const context = normalizeInput(input);
  const sectionType = normalizeType(context.section_type || 'notes');
  const parser = CONTACT_SECTION_PARSERS[sectionType] || parseNotes;
  return withScore(context, parser(context));
}

export function parseContactInfo(text) {
  return parseContactSection({ section_text: text, section_title_raw: firstLine(text) });
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

const CONTACT_SECTION_PARSERS = {
  header: parseHeader,
  about: parseAbout,
  experience: parseExperience,
  activity: parseActivity,
  featured: parseFeatured,
  education: parseEducation,
  contact: parseContactDetails,
  notes: parseNotes
};

function parseHeader({ cleaned_text, page_url }) {
  const lines = meaningfulLines(cleaned_text);
  const fields = {};
  const snippets = [];

  if (lines[0] && isLikelyName(lines[0])) addField(fields, snippets, 'full_name', lines[0], lines[0]);
  const headline = lines.find((line, index) => index > 0 && line.length >= 12 && !isLikelyLocation(line));
  if (headline) {
    addField(fields, snippets, 'linkedin_headline', headline, headline);
    const [title, company] = splitHeadline(headline);
    if (title) addField(fields, snippets, 'current_job_title', title, headline);
    if (company) addField(fields, snippets, 'current_company_name', company, headline);
    const seniority = detectSeniority(headline);
    if (seniority) addField(fields, snippets, 'seniority_level', seniority, headline);
  }
  const location = lines.find(isLikelyLocation);
  if (location) addField(fields, snippets, 'location_region', location, location);
  if (page_url) addField(fields, snippets, 'linkedin_profile_url', page_url, page_url);

  return { parsed_fields: fields, source_snippets: snippets };
}

function parseAbout({ section_text, cleaned_text }) {
  const body = cleanText(section_text || cleaned_text);
  const fields = {};
  const snippets = [];
  if (body) addField(fields, snippets, 'about_text', body, snippet(body));
  const roleKeywords = matchingKeywords(body, ROLE_KEYWORDS);
  if (roleKeywords.length) addField(fields, snippets, 'role_keywords', roleKeywords, body);
  const aiKeywords = matchingKeywords(body, AI_PRODUCT_KEYWORDS);
  if (aiKeywords.length) addField(fields, snippets, 'ai_product_keywords', aiKeywords, body);
  const strong = firstStrongSentence(body);
  if (strong) addField(fields, snippets, 'personalization_hook_candidates', [strong], strong);
  return { parsed_fields: fields, source_snippets: snippets };
}

function parseExperience({ section_text, cleaned_text }) {
  const text = cleanText(section_text || cleaned_text);
  const lines = meaningfulLines(text);
  const fields = {};
  const snippets = [];

  const dateLine = lines.find(isLikelyDateLine);
  const durationLine = lines.find(isLikelyDurationLine);
  const locationLine = lines.find((line) => line !== dateLine && line !== durationLine && isLikelyLocation(line));
  const first = lines[0] || '';
  const second = lines[1] || '';
  const third = lines[2] || '';

  let titleLine = '';
  let companyLine = '';

  if (first && isLikelyCompanyLine(first) && second && isLikelyDurationLine(second) && third) {
    companyLine = first;
    titleLine = third;
  } else {
    titleLine = first;
    companyLine = second && !isLikelyDateLine(second) && !isLikelyDurationLine(second) ? second : '';
  }

  const company = normalizeCompanyName(companyLine);
  if (titleLine && !sameText(titleLine, company) && !isLikelyDurationLine(titleLine)) addField(fields, snippets, 'job_title', titleLine, titleLine);
  if (company && !isLikelyDurationLine(company)) addField(fields, snippets, 'company_name', company, companyLine);
  if (dateLine) addField(fields, snippets, 'employment_dates', dateLine, dateLine);
  if (durationLine) addField(fields, snippets, 'duration', durationLine, durationLine);
  if (locationLine) addField(fields, snippets, 'location_region', locationLine, locationLine);
  const desc = lines.filter((line) => ![titleLine, companyLine, dateLine, durationLine, locationLine].includes(line)).join('\n');
  if (desc) addField(fields, snippets, 'role_description', desc, snippet(desc));
  const domains = matchingKeywords(text, [...ROLE_KEYWORDS, ...AI_PRODUCT_KEYWORDS]);
  if (domains.length) addField(fields, snippets, 'domains_keywords', domains, text);
  if (/\bPresent\b/i.test(text)) addField(fields, snippets, 'is_current_role', true, dateLine || text);
  return { parsed_fields: fields, source_snippets: snippets };
}

function parseActivity({ section_text, cleaned_text }) {
  const text = cleanText(section_text || cleaned_text);
  const fields = {};
  const snippets = [];
  if (text) addField(fields, snippets, 'recent_activity_summary', snippet(text, 280), snippet(text));
  const topics = extractTopics(text);
  if (topics.length) addField(fields, snippets, 'recent_post_topics', topics, text);
  const hook = firstStrongSentence(text);
  if (hook) addField(fields, snippets, 'personalization_hook_candidates', [hook], hook);
  return { parsed_fields: fields, source_snippets: snippets };
}

function parseFeatured({ section_text, cleaned_text }) {
  const items = meaningfulLines(section_text || cleaned_text).slice(0, 10).map((line) => ({ title: line }));
  return items.length ? { parsed_fields: { featured_items: items }, source_snippets: items.map((item) => item.title) } : emptyParsed();
}

function parseEducation({ section_text, cleaned_text }) {
  const lines = meaningfulLines(section_text || cleaned_text);
  const items = [];
  for (let i = 0; i < lines.length; i += 2) {
    const school = lines[i];
    if (!school) continue;
    const item = { school_name: school };
    if (lines[i + 1]) item.degree_or_field = lines[i + 1];
    items.push(item);
  }
  return items.length ? { parsed_fields: { education: items }, source_snippets: lines } : emptyParsed();
}

function parseContactDetails({ section_text, cleaned_text }) {
  const text = cleanText(section_text || cleaned_text);
  const emails = [...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])];
  const websites = [...new Set(text.match(/https?:\/\/[^\s)]+|\b(?:www\.)[A-Z0-9.-]+\.[A-Z]{2,}[^\s)]*/gi) || [])];
  const fields = {};
  if (emails.length) fields.emails = emails;
  if (websites.length) fields.websites = websites;
  return { parsed_fields: fields, source_snippets: [...emails, ...websites] };
}

function parseNotes({ section_text, cleaned_text }) {
  const text = cleanText(section_text || cleaned_text);
  const fields = {};
  const snippets = [];
  if (!text) return emptyParsed();
  addField(fields, snippets, 'note_text', text, text);
  const lines = meaningfulLines(text);
  if (lines.length === 1 && isLikelyName(lines[0])) addField(fields, snippets, 'full_name', lines[0], lines[0]);
  const headline = lines[0] || text;
  const [title, company] = splitHeadline(headline);
  if (title && company && isLikelyJobTitle(title) && !/^(building|helping|working)\b/i.test(title)) {
    addField(fields, snippets, 'current_job_title', title, headline);
    addField(fields, snippets, 'current_company_name', company, headline);
    addField(fields, snippets, 'seniority_level', detectSeniority(title), title);
  } else if (/@| at |\|/i.test(headline)) {
    addField(fields, snippets, 'linkedin_headline', headline, headline);
  }
  return { parsed_fields: fields, source_snippets: snippets };
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
    confidence_score: count ? Math.min(0.95, 0.35 + count * 0.1) : 0
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
function normalizeType(type) { return String(type || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'notes'; }
function isLikelyName(line) { return /^[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,3}$/.test(line) && !/[|@]/.test(line); }
function isLikelyLocation(line) { return /\b([A-Z][a-z]+,\s*(?:[A-Z]{2}|[A-Z][a-z]+)|United States|USA|Canada|United Kingdom|Ireland|London|San Francisco|New York|Bay Area|Metropolitan Area|Greater|Area|Region|Remote|Hybrid|On-site)\b/.test(line); }
function splitHeadline(line) {
  const match = String(line || '').match(/^(.+?)\s*(?:@|(?:\bat\b)|\|)\s*([^|,]+).*$/i);
  return [match?.[1]?.trim() || '', normalizeCompanyName(match?.[2] || '')];
}
function splitTitleCompany(line, lines) { const parts = splitHeadline(line); return [parts[0], parts[1] || '']; }
function detectSeniority(text) { return SENIORITY_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] || ''; }
function isLikelyDateLine(line) { return /\b(?:Present|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4})\b/i.test(line) && /[-–—]|Present/i.test(line); }
function isLikelyDurationLine(line) { return /^(?:Full-time\s*·\s*)?(?:\d+\s*(?:yr|yrs|year|years))?(?:\s*\d+\s*(?:mo|mos|month|months))$/i.test(String(line || '').trim()); }
function isLikelyCompanyLine(line) { return Boolean(line) && !isLikelyDateLine(line) && !isLikelyDurationLine(line) && !isLikelyLocation(line) && !isLikelyJobTitle(line); }
function isLikelyJobTitle(line) { return /\b(Product|Manager|Director|VP|RVP|Head|Recruiter|Talent|Solutions|Engineer|PM|GTM|Strategy|Planning|Agent|Founder|Founding|Staff|Principal|Senior)\b/i.test(line); }
function normalizeCompanyName(value) { return String(value || '').replace(/\s*·\s*(Full-time|Part-time|Contract|Self-employed|Freelance).*$/i, '').trim(); }
function sameText(left, right) { return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase(); }
function matchingKeywords(text, keywords) { return keywords.filter((keyword) => new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i').test(text)); }
function extractTopics(text) { return matchingKeywords(text, [...AI_PRODUCT_KEYWORDS, ...ROLE_KEYWORDS]).slice(0, 12); }
function firstStrongSentence(text) { return (text.match(/[^.!?]{35,220}[.!?]/) || [])[0]?.trim() || ''; }
function snippet(text, length = 220) { return cleanText(text).slice(0, length); }
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function safeHostname(url) { try { return new URL(url).hostname; } catch (_error) { return ''; } }
