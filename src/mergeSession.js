import { SECTION_TYPES } from './constants.js';

const CONTACT_REQUIRED_FIELDS = [
  'contact_identity.full_name',
  'contact_identity.linkedin_profile_url',
  'contact_identity.current_job_title',
  'contact_identity.current_company_name',
  'contact_identity.location_region'
];

const COMPANY_REQUIRED_FIELDS = [
  'company_identity.company_name',
  'company_identity.linkedin_company_url',
  'company_identity.website',
  'company_identity.industry',
  'company_identity.company_size',
  'company_identity.headquarters',
  'company_identity.specialties',
  'company_context.description',
  'company_context.open_role_signals',
  'company_context.recent_post_topics'
];

export function createEmptySession(companyName = '') {
  return {
    companyName: companyName.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections: []
  };
}

export function mergeSession(session, section, companyName = '') {
  const current = session || createEmptySession(companyName);
  const timestamp = new Date().toISOString();

  if (isStructuredSession(current)) {
    const next = {
      ...current,
      company_name_entered: companyName.trim() || current.company_name_entered || '',
      companyName: companyName.trim() || current.companyName || current.company_name_entered || '',
      updated_at: timestamp,
      updatedAt: timestamp,
      validation_metadata: normalizeSessionValidationMetadata(current.validation_metadata),
      sections: [...(current.sections || []), section]
    };

    if (isContactSection(section)) {
      next.contact_capture = normalizeContactCapture(current.contact_capture);
      const contact = resolveContact(next, section);
      if (contact) {
        contact.updated_at = timestamp;
        contact.company_name_entered = next.company_name_entered || contact.company_name_entered || '';
        stripCompanyProfileData(contact);
        contact.captured_sections = [...(contact.captured_sections || []), section];
        mergeContactSection(contact, section);
        hydrateContactIdentityFromSection(contact, section, next.company_name_entered || companyName);
      }
    } else if (isCompanySection(section)) {
      next.company_extraction = {
        ...current.company_extraction,
        captured_sections: [...(current.company_extraction?.captured_sections || []), section]
      };
      mergeCompanySection(next, section);
    }

    recalculateValidation(next);
    return next;
  }

  return {
    ...current,
    companyName: companyName.trim() || current.companyName || '',
    updatedAt: timestamp,
    sections: [...(current.sections || []), section]
  };
}

function mergeContactSection(contactRecord, section) {
  const sectionType = getSectionType(section);
  const fields = getParsedFields(section);
  const contact = contactRecord.merged_contact;

  if (section.type === SECTION_TYPES.CONTACT_URL) {
    const url = section.payload?.url || section.sourceUrl || '';
    contactRecord.contact_url = url || contactRecord.contact_url || '';
    contactRecord.source_page_title = section.payload?.title || contactRecord.source_page_title || '';
    mergeScalar(contact.contact_identity, 'linkedin_profile_url', url, contactRecord, section);
    return;
  }

  if (sectionType === 'header') {
    mergeFields(contact.contact_identity, fields, ['full_name', 'linkedin_profile_url', 'linkedin_headline', 'current_job_title', 'current_company_name', 'location_region', 'seniority_level'], contactRecord, section);
    if (!contactRecord.contact_url && contact.contact_identity.linkedin_profile_url) contactRecord.contact_url = contact.contact_identity.linkedin_profile_url;
  } else if (sectionType === 'about') {
    mergeScalar(contact.profile_content, 'about_text', fields.about_text, contactRecord, section);
    mergeArrayFields(contact.outreach_inputs, fields, ['personalization_hook_candidates', 'ai_product_keywords', 'role_keywords', 'possible_dm_angles'], contactRecord, section);
  } else if (sectionType === 'experience') {
    const targetKey = isCurrentExperience(fields) ? 'current_experience' : 'previous_experience';
    mergeArray(contact.profile_content, targetKey, [stripRoutingFields(fields)]);
  } else if (sectionType === 'activity') {
    mergeArray(contact.profile_content, 'recent_activity', [activityItem(fields, section)]);
    mergeArrayFields(contact.outreach_inputs, fields, ['personalization_hook_candidates'], contactRecord, section);
  } else if (sectionType === 'featured') {
    mergeArray(contact.profile_content, 'featured_items', fields.featured_items || []);
  } else if (sectionType === 'education') {
    mergeArray(contact.profile_content, 'education', fields.education || []);
  }
}

export function hydrateContactIdentityFromSection(contactRecord, section, companyNameEntered = '') {
  const identity = contactRecord?.merged_contact?.contact_identity;
  if (!identity) return;

  if (!identity.linkedin_profile_url && contactRecord.contact_url) {
    mergeScalar(identity, 'linkedin_profile_url', contactRecord.contact_url, contactRecord, section);
  }

  const sectionType = getSectionType(section);
  const fields = getParsedFields(section);
  const rawText = section?.payload?.section_text || section?.payload?.cleaned_text || section?.payload?.raw_selected_text || '';

  if (sectionType === 'notes' || !sectionType || sectionType === 'unknown' || sectionType === 'custom') {
    hydrateFromNotes(identity, fields, rawText, contactRecord, section);
  }

  if (sectionType === 'experience') {
    const normalizedCompany = normalizeCompanyName(fields.company_name);
    const title = cleanScalar(fields.job_title);
    const location = cleanScalar(fields.location_region);
    const isReliableCurrent = isCurrentExperience(fields) || sameText(normalizedCompany, companyNameEntered);

    if (isReliableCurrent) {
      if (title && !sameText(title, companyNameEntered) && !sameText(title, normalizedCompany)) mergeScalar(identity, 'current_job_title', title, contactRecord, section);
      if (normalizedCompany && !isLikelyDurationLine(normalizedCompany)) mergeScalar(identity, 'current_company_name', normalizedCompany, contactRecord, section);
      if (location) mergeScalar(identity, 'location_region', location, contactRecord, section);
    }
  }

  const title = identity.current_job_title;
  const seniority = inferSeniorityLevel(title);
  if (seniority && seniority !== 'Unknown') {
    if (isEmpty(identity.seniority_level) || identity.seniority_level === 'Unknown') identity.seniority_level = seniority;
    else if (identity.seniority_level !== seniority) addConflict(contactRecord, section, 'seniority_level', identity.seniority_level, seniority);
  }
}

function hydrateFromNotes(identity, fields, rawText, contactRecord, section) {
  const text = cleanScalar(fields.note_text) || cleanScalar(rawText);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const first = lines[0] || text;

  if (isEmpty(identity.full_name) && lines.length === 1 && isLikelyName(first)) mergeScalar(identity, 'full_name', first, contactRecord, section);
  if (fields.full_name) mergeScalar(identity, 'full_name', fields.full_name, contactRecord, section);
  if (fields.linkedin_headline) mergeScalar(identity, 'linkedin_headline', fields.linkedin_headline, contactRecord, section);

  const [title, company] = splitHeadline(first);
  const reliableTitle = title && company && isLikelyJobTitle(title) && !/^(building|helping|working)\b/i.test(title);
  if (reliableTitle) {
    mergeScalar(identity, 'current_job_title', title, contactRecord, section);
    mergeScalar(identity, 'current_company_name', company, contactRecord, section);
  } else if (!identity.linkedin_headline && /@| at |\|/i.test(first)) {
    mergeScalar(identity, 'linkedin_headline', first, contactRecord, section);
  }

  mergeScalar(identity, 'current_job_title', fields.current_job_title, contactRecord, section);
  mergeScalar(identity, 'current_company_name', normalizeCompanyName(fields.current_company_name), contactRecord, section);
}

function mergeCompanySection(session, section) {
  const sectionType = getSectionType(section);
  const fields = getParsedFields(section);
  const company = session.company_extraction.merged_company;

  if (section.type === SECTION_TYPES.COMPANY_URL) {
    mergeScalar(company.company_identity, 'linkedin_company_url', section.payload?.url || section.sourceUrl || '', session, section);
    return;
  }

  if (sectionType === 'overview' || sectionType === 'about') {
    mergeScalar(company.company_context, 'description', fields.description, session, section);
  }

  mergeFields(company.company_identity, fields, ['website', 'industry', 'company_size', 'headquarters'], session, section);
  mergeArrayFields(company.company_identity, fields, ['specialties'], session, section);
  mergeArrayFields(company.company_context, fields, ['open_role_signals', 'remote_hiring_signals', 'recent_post_topics', 'ai_product_relevance_notes'], session, section);
}

function resolveContact(session, section) {
  const contacts = session.contact_capture.contacts;
  const sectionUrl = getContactUrlFromSection(section);
  if (sectionUrl) {
    const existing = findContactByUrlInList(contacts, sectionUrl);
    if (existing) return setCurrentContact(session, existing);

    const created = createContactRecord(sectionUrl, section);
    contacts.push(created);
    return setCurrentContact(session, created);
  }

  const current = contacts.find((contact) => contact.contact_id === session.contact_capture.current_contact_id);
  if (current) return current;
  return contacts[0] || null;
}

function normalizeContactCapture(contactCapture = {}) {
  return {
    current_contact_id: contactCapture.current_contact_id || '',
    contacts: Array.isArray(contactCapture.contacts) ? contactCapture.contacts.map(normalizeContactRecord) : []
  };
}

function normalizeContactRecord(contact = {}) {
  const normalized = {
    ...contact,
    captured_sections: Array.isArray(contact.captured_sections) ? contact.captured_sections : [],
    merged_contact: {
      contact_identity: {},
      profile_content: {},
      outreach_inputs: {},
      ...(contact.merged_contact || {}),
      contact_identity: contact.merged_contact?.contact_identity || {},
      profile_content: contact.merged_contact?.profile_content || {},
      outreach_inputs: contact.merged_contact?.outreach_inputs || {}
    },
    validation_metadata: normalizeContactValidationMetadata(contact.validation_metadata)
  };
  stripCompanyProfileData(normalized);
  return normalized;
}


function stripCompanyProfileData(contact) {
  delete contact.company_extraction;
  delete contact.merged_company;
  delete contact.company_identity;
  delete contact.company_context;
  if (contact.merged_contact) {
    delete contact.merged_contact.company_extraction;
    delete contact.merged_contact.merged_company;
    delete contact.merged_contact.company_identity;
    delete contact.merged_contact.company_context;
  }
}

function createContactRecord(url, section) {
  const normalizedUrl = normalizeUrl(url);
  const timestamp = new Date().toISOString();
  return normalizeContactRecord({
    contact_id: crypto.randomUUID(),
    contact_url: normalizedUrl,
    source_page_title: section?.payload?.source_page_title || section?.payload?.title || section?.pageTitle || '',
    created_at: timestamp,
    updated_at: timestamp,
    status: 'in_progress',
    company_name_entered: '',
    captured_sections: [],
    merged_contact: {
      contact_identity: {
        linkedin_profile_url: normalizedUrl
      },
      profile_content: {},
      outreach_inputs: {}
    },
    validation_metadata: {}
  });
}

function setCurrentContact(session, contact) {
  session.contact_capture.current_contact_id = contact.contact_id;
  return contact;
}

function findContactByUrlInList(contacts, url) {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) return null;
  return contacts.find((contact) => normalizeUrl(contact.contact_url || contact.merged_contact?.contact_identity?.linkedin_profile_url) === normalizedUrl) || null;
}

function recalculateValidation(session) {
  for (const contact of session.contact_capture?.contacts || []) {
    contact.validation_metadata = normalizeContactValidationMetadata(contact.validation_metadata);
    contact.validation_metadata.missing_fields = calculateContactMissingFields(contact);
    contact.validation_metadata.field_conflicts = calculateContactFieldConflicts(contact, session.company_name_entered);
    contact.validation_metadata.validation_warnings = calculateContactValidationWarnings(contact);
    contact.validation_metadata.needs_manual_validation = contact.validation_metadata.missing_fields.length > 0
      || contact.validation_metadata.field_conflicts.length > 0
      || contact.validation_metadata.validation_warnings.length > 0;
    if (!contact.validation_metadata.needs_manual_validation) contact.status = 'complete';
    else if (contact.validation_metadata.missing_fields.includes('contact_url')) contact.status = 'missing_contact_url';
  }

  const companyMissingFields = calculateCompanyMissingFields(session);
  session.validation_metadata.needs_manual_validation = companyMissingFields.length > 0
    || (session.contact_capture?.contacts || []).some((contact) => contact.validation_metadata.needs_manual_validation)
    || session.validation_metadata.session_conflicts.length > 0;
}

function calculateContactMissingFields(contact) {
  const missing = [];
  addMissing(missing, '', contact.merged_contact, CONTACT_REQUIRED_FIELDS);
  if (isEmpty(contact.contact_url)) addUnique(missing, 'contact_url');
  return missing;
}

function calculateContactFieldConflicts(contact, companyNameEntered = '') {
  const existingConflicts = Array.isArray(contact.validation_metadata?.field_conflicts)
    ? contact.validation_metadata.field_conflicts.filter((conflict) => conflict?.type !== 'company_name_mismatch')
    : [];
  const currentCompanyName = contact.merged_contact?.contact_identity?.current_company_name || '';
  if (!isEmpty(currentCompanyName) && !isEmpty(companyNameEntered) && !sameText(currentCompanyName, companyNameEntered)) {
    existingConflicts.push({
      type: 'company_name_mismatch',
      field: 'contact_identity.current_company_name',
      existing_value: currentCompanyName,
      expected_value: companyNameEntered,
      message: `Current company (${currentCompanyName}) differs from entered company (${companyNameEntered}). Review manually; no value was overwritten.`
    });
  }
  return dedupeByStableStringify(existingConflicts);
}

function calculateContactValidationWarnings(contact) {
  const preserved = Array.isArray(contact.validation_metadata?.validation_warnings)
    ? contact.validation_metadata.validation_warnings.filter((warning) => !['missing_contact_url', 'missing_full_name', 'field_conflict'].includes(warning?.type))
    : [];

  if (contact.validation_metadata?.missing_fields?.includes('contact_url')) {
    preserved.push({ type: 'missing_contact_url', field: 'contact_url', message: 'Contact is missing a URL and needs manual review.' });
  }
  if (contact.validation_metadata?.missing_fields?.includes('contact_identity.full_name')) {
    preserved.push({ type: 'missing_full_name', field: 'contact_identity.full_name', message: 'Contact is missing a full name. Do not invent a name; review manually.' });
  }
  if ((contact.validation_metadata?.field_conflicts || []).length > 0) {
    preserved.push({ type: 'field_conflict', field: 'validation_metadata.field_conflicts', message: 'Contact has field conflicts that need manual review.' });
  }

  return dedupeByStableStringify(preserved);
}

function calculateCompanyMissingFields(session) {
  const missing = [];
  addMissing(missing, 'merged_company', session.company_extraction?.merged_company, COMPANY_REQUIRED_FIELDS);
  return missing;
}

function mergeFields(target, fields, keys, owner, section) {
  for (const key of keys) mergeScalar(target, key, fields[key], owner, section);
}

function mergeArrayFields(target, fields, keys, owner, section) {
  for (const key of keys) mergeArray(target, key, fields[key] || [], owner, section);
}

function mergeScalar(target, key, value, owner, section) {
  if (isEmpty(value)) return;
  if (Array.isArray(value)) return mergeArray(target, key, value);
  const existing = target[key];
  if (isEmpty(existing)) {
    target[key] = value;
  } else if (existing !== value) {
    addConflict(owner, section, key, existing, value);
  }
}

function mergeArray(target, key, values) {
  if (!Array.isArray(values) || values.length === 0) return;
  const existing = Array.isArray(target[key]) ? target[key] : [];
  const seen = new Set(existing.map(stableStringify));
  target[key] = [...existing];
  for (const value of values) {
    if (isEmpty(value)) continue;
    const fingerprint = stableStringify(value);
    if (!seen.has(fingerprint)) {
      target[key].push(value);
      seen.add(fingerprint);
    }
  }
}

function addConflict(owner, section, field, existing_value, new_value) {
  const conflict = {
    field,
    existing_value,
    new_value,
    section_id: section?.id || '',
    captured_at: section?.capturedAt || section?.payload?.captured_at || section?.payload?.capturedAt || ''
  };

  if (owner?.contact_id) {
    const conflicts = owner.validation_metadata.field_conflicts;
    if (!conflicts.some((item) => stableStringify(item) === stableStringify(conflict))) conflicts.push(conflict);
    return;
  }

  const conflicts = owner.validation_metadata.session_conflicts;
  if (!conflicts.some((item) => stableStringify(item) === stableStringify(conflict))) conflicts.push(conflict);
}

function addMissing(missing, root, object, paths) {
  for (const path of paths) {
    if (isEmpty(getPath(object, path))) missing.push(root ? `${root}.${path}` : path);
  }
}

function normalizeSessionValidationMetadata(metadata = {}) {
  return {
    needs_manual_validation: metadata.needs_manual_validation !== false,
    session_conflicts: Array.isArray(metadata.session_conflicts) ? metadata.session_conflicts : []
  };
}

function normalizeContactValidationMetadata(metadata = {}) {
  return {
    missing_fields: Array.isArray(metadata.missing_fields) ? metadata.missing_fields : [],
    field_conflicts: Array.isArray(metadata.field_conflicts) ? metadata.field_conflicts : [],
    validation_warnings: Array.isArray(metadata.validation_warnings) ? metadata.validation_warnings : [],
    needs_manual_validation: metadata.needs_manual_validation !== false
  };
}

function isStructuredSession(session) { return Boolean(session?.contact_capture && session?.company_extraction); }
function isContactSection(section) { return section?.type === SECTION_TYPES.CONTACT_INFO || section?.type === SECTION_TYPES.CONTACT_URL; }
function isCompanySection(section) { return section?.type === SECTION_TYPES.COMPANY_INFO || section?.type === SECTION_TYPES.COMPANY_URL; }
function getParsedFields(section) { return section?.payload?.parsed_fields || {}; }
function getSectionType(section) { return String(section?.payload?.section_type || '').toLowerCase(); }
function stripRoutingFields(fields) { const { is_current_role, ...rest } = fields; return rest; }
function isCurrentExperience(fields) { return Boolean(fields.is_current_role) || /\bPresent\b/i.test(Object.values(fields || {}).join(' ')); }
function getContactUrlFromSection(section) {
  if (section?.type === SECTION_TYPES.CONTACT_URL) return section.payload?.url || section.sourceUrl || '';
  return section?.payload?.parsed_fields?.linkedin_profile_url
    || section?.payload?.source_url
    || section?.sourceUrl
    || '';
}
function activityItem(fields, section) { return fields.recent_activity_summary ? { summary: fields.recent_activity_summary, topics: fields.recent_post_topics || [] } : { ...fields, source_url: section?.payload?.source_url || section?.sourceUrl || '' }; }
function isEmpty(value) { return value === undefined || value === null || String(value).trim?.() === '' || (Array.isArray(value) && value.length === 0); }
function cleanScalar(value) { return typeof value === 'string' ? value.trim() : ''; }
function isLikelyName(line) { return /^[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,3}$/.test(String(line || '').trim()) && !/[|@]/.test(line); }
function splitHeadline(line) {
  const match = String(line || '').match(/^(.+?)\s*(?:@|(?:\bat\b)|\|)\s*([^|,]+).*$/i);
  return [match?.[1]?.trim() || '', normalizeCompanyName(match?.[2] || '')];
}
function normalizeCompanyName(value) { return String(value || '').replace(/\s*·\s*(Full-time|Part-time|Contract|Self-employed|Freelance).*$/i, '').trim(); }
function isLikelyDurationLine(line) { return /^(?:Full-time\s*·\s*)?(?:\d+\s*(?:yr|yrs|year|years))?(?:\s*\d+\s*(?:mo|mos|month|months))$/i.test(String(line || '').trim()); }
function isLikelyJobTitle(line) { return /\b(Product|Manager|Director|VP|RVP|Head|Recruiter|Talent|Solutions|Engineer|PM|GTM|Strategy|Planning|Agent|Founder|Founding|Staff|Principal|Senior)\b/i.test(String(line || '')); }
export function inferSeniorityLevel(jobTitle = '') {
  const title = String(jobTitle || '');
  if (/\bco[-\s]?founder\b/i.test(title)) return 'Co-founder';
  if (/\bfounding\b/i.test(title)) return 'Founding';
  if (/\bfounder\b/i.test(title)) return 'Founder';
  if (/\bCEO\b|Chief Executive Officer/i.test(title)) return 'CEO';
  if (/\bRVP\b|Regional Vice President/i.test(title)) return 'RVP';
  if (/\bVP\b|Vice President/i.test(title)) return 'VP';
  if (/\bDirector\b/i.test(title)) return 'Director';
  if (/\bHead\b/i.test(title)) return 'Head';
  if (/\bStaff\b/i.test(title)) return 'Staff';
  if (/\bPrincipal\b/i.test(title)) return 'Principal';
  if (/\bSenior\b|\bSr\.?\b/i.test(title)) return 'Senior';
  if (/\bManager\b/i.test(title)) return 'Manager';
  if (/\bRecruiter\b/i.test(title)) return 'Recruiter';
  if (title.trim()) return 'IC';
  return 'Unknown';
}
function getPath(object, path) { return path.split('.').reduce((value, key) => value?.[key], object); }
function normalizeUrl(url) { return String(url || '').trim().replace(/\/$/, ''); }
function addUnique(array, value) { if (!array.includes(value)) array.push(value); }
function sameText(left, right) { return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase(); }
function dedupeByStableStringify(items) {
  const seen = new Set();
  return items.filter((item) => {
    const fingerprint = stableStringify(item);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}
function stableStringify(value) { return typeof value === 'string' ? value : JSON.stringify(sortValue(value)); }
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((sorted, key) => ({ ...sorted, [key]: sortValue(value[key]) }), {});
}
