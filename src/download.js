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
    return {
      ...baseExport,
      contacts: session?.contact_capture?.contacts || [],
      captured_sections: flattenContactSections(session),
      validation_metadata: buildValidationMetadata(session?.validation_metadata, extractionType),
      exported_at: new Date().toISOString()
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

function flattenContactSections(session) {
  return (session?.contact_capture?.contacts || []).flatMap((contact) => contact.captured_sections || []);
}
