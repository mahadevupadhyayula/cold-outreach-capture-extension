export function downloadSessionAsText(session) {
  const safeCompanyName = (session.companyName || 'cold-outreach-session')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'cold-outreach-session';
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeCompanyName}-${date}.json.txt`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
