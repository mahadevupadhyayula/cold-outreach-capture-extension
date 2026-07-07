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
  return {
    ...current,
    companyName: companyName.trim() || current.companyName || '',
    updatedAt: new Date().toISOString(),
    sections: [...(current.sections || []), section]
  };
}
