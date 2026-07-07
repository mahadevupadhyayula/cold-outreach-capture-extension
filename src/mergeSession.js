import { SECTION_TYPES } from './constants.js';

const CONTACT_REQUIRED_FIELDS = [
  'contact_identity.full_name',
  'contact_identity.linkedin_profile_url',
  'contact_identity.linkedin_headline',
  'contact_identity.current_job_title',
  'contact_identity.current_company_name',
  'contact_identity.location_region',
  'contact_identity.seniority_level',
  'profile_content.about_text',
  'profile_content.current_experience',
  'profile_content.education',
  'profile_content.recent_activity'
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
        contact.captured_sections = [...(contact.captured_sections || []), section];
        mergeContactSection(contact, section);
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
    const targetKey = fields.is_current_role ? 'current_experience' : 'previous_experience';
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
  if (section.type === SECTION_TYPES.CONTACT_URL) {
    const url = section.payload?.url || section.sourceUrl || '';
    const existing = findContactByUrlInList(contacts, url);
    if (existing) {
      session.contact_capture.current_contact_id = existing.contact_id;
      return existing;
    }
  }

  const current = contacts.find((contact) => contact.contact_id === session.contact_capture.current_contact_id);
  if (current) return current;
  return contacts[0] || null;
}

function normalizeContactCapture(contactCapture = {}) {
  return {
    current_contact_id: contactCapture.current_contact_id || '',
    contacts: Array.isArray(contactCapture.contacts) ? contactCapture.contacts : []
  };
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
    contact.validation_metadata.needs_manual_validation = contact.validation_metadata.missing_fields.length > 0 || contact.validation_metadata.field_conflicts.length > 0;
  }

  const companyMissingFields = calculateCompanyMissingFields(session);
  session.validation_metadata.needs_manual_validation = companyMissingFields.length > 0
    || (session.contact_capture?.contacts || []).some((contact) => contact.validation_metadata.needs_manual_validation)
    || session.validation_metadata.session_conflicts.length > 0;
}

function calculateContactMissingFields(contact) {
  const missing = [];
  addMissing(missing, '', contact.merged_contact, CONTACT_REQUIRED_FIELDS);
  return missing;
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
    needs_manual_validation: metadata.needs_manual_validation !== false
  };
}

function isStructuredSession(session) { return Boolean(session?.contact_capture && session?.company_extraction); }
function isContactSection(section) { return section?.type === SECTION_TYPES.CONTACT_INFO || section?.type === SECTION_TYPES.CONTACT_URL; }
function isCompanySection(section) { return section?.type === SECTION_TYPES.COMPANY_INFO || section?.type === SECTION_TYPES.COMPANY_URL; }
function getParsedFields(section) { return section?.payload?.parsed_fields || {}; }
function getSectionType(section) { return String(section?.payload?.section_type || '').toLowerCase(); }
function stripRoutingFields(fields) { const { is_current_role, ...rest } = fields; return rest; }
function activityItem(fields, section) { return fields.recent_activity_summary ? { summary: fields.recent_activity_summary, topics: fields.recent_post_topics || [] } : { ...fields, source_url: section?.payload?.source_url || section?.sourceUrl || '' }; }
function isEmpty(value) { return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0); }
function getPath(object, path) { return path.split('.').reduce((value, key) => value?.[key], object); }
function normalizeUrl(url) { return String(url || '').trim().replace(/\/$/, ''); }
function stableStringify(value) { return typeof value === 'string' ? value : JSON.stringify(sortValue(value)); }
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((sorted, key) => ({ ...sorted, [key]: sortValue(value[key]) }), {});
}
