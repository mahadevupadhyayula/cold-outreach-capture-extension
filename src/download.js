import { safeFilename } from './cleanText.js';
import { SESSION_SCHEMA_VERSION } from './constants.js';

const DEFAULT_COMPANY_FILENAME = 'cold-outreach-capture';

export function buildExtractionExport(session, extractionType, companyNameEntered = '') {
  const normalizedCompanyName = (companyNameEntered || session?.company_name_entered || session?.companyName || '').trim();
  const baseExport = {
    schema_version: session?.schema_version || SESSION_SCHEMA_VERSION,
    extraction_type: extractionType,
    company_name_entered: normalizedCompanyName
  };

  if (extractionType === 'contacts') {
    const contacts = buildContactExports(session?.contact_capture?.contacts, normalizedCompanyName);

    return {
      ...baseExport,
      exported_at: new Date().toISOString(),
      contacts_count: contacts.length,
      contacts,
      validation_metadata: buildValidationMetadata(session?.validation_metadata, extractionType)
    };
  }

  return {
    ...baseExport,
    merged_company: session?.company_extraction?.merged_company || null,
    captured_sections: session?.company_extraction?.captured_sections || [],
    validation_metadata: buildValidationMetadata(session?.validation_metadata, extractionType),
    exported_at: new Date().toISOString()
  };
}

export async function downloadExtractionAsJsonText(session, extractionType, companyNameEntered = '') {
  const exportData = buildExtractionExport(session, extractionType, companyNameEntered);
  const filename = buildExtractionFilename(exportData.company_name_entered, extractionType);
  const json = JSON.stringify(exportData, null, 2);
  const url = `data:text/plain;charset=utf-8,${encodeURIComponent(json)}`;

  await chrome.downloads.download({
    url,
    filename,
    saveAs: false
  });
}

export function buildExtractionFilename(companyNameEntered, extractionType) {
  const companyName = safeFilename(companyNameEntered) || DEFAULT_COMPANY_FILENAME;
  const suffix = extractionType === 'contacts' ? 'contacts' : 'company';
  return `${companyName}_${suffix}.json.txt`;
}

function buildValidationMetadata(metadata = {}, extractionType) {
  if (extractionType === 'contacts') {
    return {
      needs_manual_validation: metadata?.needs_manual_validation !== false,
      session_conflicts: Array.isArray(metadata?.session_conflicts) ? metadata.session_conflicts : []
    };
  }

  return {
    needs_manual_validation: metadata?.needs_manual_validation !== false,
    session_conflicts: Array.isArray(metadata?.session_conflicts) ? metadata.session_conflicts : []
  };
}

function buildContactExports(contacts = [], companyNameEntered = '') {
  if (!Array.isArray(contacts)) return [];

  return contacts.map((contact = {}) => {
    const validationMetadata = buildContactValidationMetadata(contact, companyNameEntered);
    return {
      contact_id: contact.contact_id || '',
      contact_url: contact.contact_url || contact.merged_contact?.contact_identity?.linkedin_profile_url || '',
      source_page_title: contact.source_page_title || '',
      status: contact.status || '',
      merged_contact: contact.merged_contact || {},
      captured_sections: Array.isArray(contact.captured_sections) ? contact.captured_sections : [],
      validation_metadata: validationMetadata
    };
  });
}

function buildContactValidationMetadata(contact = {}, companyNameEntered = '') {
  const metadata = {
    missing_fields: Array.isArray(contact.validation_metadata?.missing_fields) ? [...contact.validation_metadata.missing_fields] : [],
    field_conflicts: Array.isArray(contact.validation_metadata?.field_conflicts) ? [...contact.validation_metadata.field_conflicts] : [],
    validation_warnings: Array.isArray(contact.validation_metadata?.validation_warnings) ? [...contact.validation_metadata.validation_warnings] : [],
    needs_manual_validation: contact.validation_metadata?.needs_manual_validation !== false
  };

  for (const field of ['full_name', 'linkedin_profile_url', 'current_job_title', 'current_company_name', 'location_region']) {
    if (isEmpty(contact.merged_contact?.contact_identity?.[field])) addUnique(metadata.missing_fields, `contact_identity.${field}`);
  }
  if (isEmpty(contact.contact_url)) addUnique(metadata.missing_fields, 'contact_url');

  const currentCompanyName = contact.merged_contact?.contact_identity?.current_company_name || '';
  if (!isEmpty(currentCompanyName) && !isEmpty(companyNameEntered) && currentCompanyName.trim().toLowerCase() !== companyNameEntered.trim().toLowerCase()) {
    addUniqueObject(metadata.field_conflicts, {
      type: 'company_name_mismatch',
      field: 'contact_identity.current_company_name',
      existing_value: currentCompanyName,
      expected_value: companyNameEntered,
      message: `Current company (${currentCompanyName}) differs from entered company (${companyNameEntered}). Review manually; no value was overwritten.`
    });
  }

  if (metadata.missing_fields.includes('contact_url')) addUniqueObject(metadata.validation_warnings, { type: 'missing_contact_url', field: 'contact_url', message: 'Contact is missing a URL and needs manual review.' });
  if (metadata.missing_fields.includes('contact_identity.full_name')) addUniqueObject(metadata.validation_warnings, { type: 'missing_full_name', field: 'contact_identity.full_name', message: 'Contact is missing a full name. Do not invent a name; review manually.' });
  if (metadata.field_conflicts.length > 0) addUniqueObject(metadata.validation_warnings, { type: 'field_conflict', field: 'validation_metadata.field_conflicts', message: 'Contact has field conflicts that need manual review.' });

  metadata.needs_manual_validation = metadata.missing_fields.length > 0 || metadata.field_conflicts.length > 0 || metadata.validation_warnings.length > 0;
  return metadata;
}

function addUnique(array, value) { if (!array.includes(value)) array.push(value); }
function addUniqueObject(array, value) {
  const fingerprint = JSON.stringify(value);
  if (!array.some((item) => JSON.stringify(item) === fingerprint)) array.push(value);
}
function isEmpty(value) { return value === undefined || value === null || String(value).trim() === '' || (Array.isArray(value) && value.length === 0); }
