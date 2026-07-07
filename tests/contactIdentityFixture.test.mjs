import assert from 'node:assert/strict';
import { createEmptySession } from '../src/store.js';
import { mergeSession } from '../src/mergeSession.js';
import { parseContactSection } from '../src/parsers/contactParsers.js';
import { SECTION_TYPES } from '../src/constants.js';

function contactInfo(text, sectionType, url = 'https://www.linkedin.com/in/example') {
  return {
    id: crypto.randomUUID(),
    type: SECTION_TYPES.CONTACT_INFO,
    sourceUrl: url,
    payload: parseContactSection({
      section_text: text,
      section_type: sectionType,
      page_url: url,
      page_title: 'LinkedIn profile'
    })
  };
}

function runContact({ name, url, sections }) {
  let session = createEmptySession('Decagon');
  for (const section of sections) session = mergeSession(session, contactInfo(section.text, section.type, url), 'Decagon');
  return session.contact_capture.contacts[0];
}

const fixtures = [
  {
    name: 'Kevin Dempsey',
    url: 'https://www.linkedin.com/in/kevin-dempsey',
    sections: [
      { type: 'notes', text: 'Kevin Dempsey' },
      { type: 'notes', text: 'Founding GTM Recruiter - International @ Decagon' },
      { type: 'experience', text: 'Founding GTM Recruiter - International\nDecagon · Full-time\nJan 2026 - Present · 6 mos\nIreland · Hybrid' }
    ],
    expected: { full_name: 'Kevin Dempsey', current_job_title: 'Founding GTM Recruiter - International', current_company_name: 'Decagon', location_region: 'Ireland · Hybrid', seniority_level: 'Founding' }
  },
  {
    name: 'Breuer Bass',
    url: 'https://www.linkedin.com/in/breuer-bass',
    sections: [
      { type: 'notes', text: 'Breuer Bass' },
      { type: 'experience', text: 'Decagon\n1 yr 6 mos\nRVP, Solutions\nApr 2026 - Present · 4 mos\nSan Francisco, California, United States\nLeading global Solutions Engineering...' }
    ],
    expected: { full_name: 'Breuer Bass', current_job_title: 'RVP, Solutions', current_company_name: 'Decagon', location_region: 'San Francisco, California, United States', seniority_level: 'RVP' }
  },
  {
    name: 'Terry Lee',
    url: 'https://www.linkedin.com/in/terry-lee',
    sections: [
      { type: 'notes', text: 'Terry Lee' },
      { type: 'notes', text: 'Head of GTM Strategy & Planning at Decagon' },
      { type: 'experience', text: 'Head of GTM Strategy & Planning\nDecagon\nFeb 2026 - Present · 5 mos\nNew York City Metropolitan Area' }
    ],
    expected: { full_name: 'Terry Lee', current_job_title: 'Head of GTM Strategy & Planning', current_company_name: 'Decagon', location_region: 'New York City Metropolitan Area', seniority_level: 'Head' }
  },
  {
    name: 'Alan Yiu',
    url: 'https://www.linkedin.com/in/alan-yiu',
    sections: [
      { type: 'notes', text: 'Alan Yiu' },
      { type: 'experience', text: 'VP Product\nDecagon · Full-time\nDec 2025 - Present · 8 mos' }
    ],
    expected: { full_name: 'Alan Yiu', current_job_title: 'VP Product', current_company_name: 'Decagon', seniority_level: 'VP' }
  },
  {
    name: 'Karen Islas',
    url: 'https://www.linkedin.com/in/karen-islas',
    sections: [
      { type: 'notes', text: 'Karen Islas' },
      { type: 'experience', text: 'Staff Product Manager\nDecagon · Full-time\nMar 2026 - Present · 4 mos\nSan Francisco Bay Area · On-site' }
    ],
    expected: { full_name: 'Karen Islas', current_job_title: 'Staff Product Manager', current_company_name: 'Decagon', location_region: 'San Francisco Bay Area · On-site', seniority_level: 'Staff' }
  },
  {
    name: 'Bihan Jiang',
    url: 'https://www.linkedin.com/in/bihan-jiang',
    sections: [
      { type: 'notes', text: 'Bihan Jiang' },
      { type: 'notes', text: 'Director of Product @ Decagon' },
      { type: 'experience', text: 'Director of Product\nDecagon · Full-time\nApr 2026 - Present · 4 mos\nSan Francisco, California, United States' }
    ],
    expected: { full_name: 'Bihan Jiang', current_job_title: 'Director of Product', current_company_name: 'Decagon', location_region: 'San Francisco, California, United States', seniority_level: 'Director' }
  },
  {
    name: 'Isabelle Hughes',
    url: 'https://www.linkedin.com/in/isabelle-hughes',
    sections: [{ type: 'notes', text: 'Isabelle Hughes' }, { type: 'notes', text: 'Product @ Decagon' }],
    expected: { full_name: 'Isabelle Hughes', current_job_title: 'Product', current_company_name: 'Decagon', seniority_level: 'IC' }
  },
  {
    name: 'Jacob Arnall',
    url: 'https://www.linkedin.com/in/jacob-arnall',
    sections: [{ type: 'notes', text: 'Jacob Arnall' }, { type: 'notes', text: 'Senior Agent Product Manager @ Decagon' }],
    expected: { full_name: 'Jacob Arnall', current_job_title: 'Senior Agent Product Manager', current_company_name: 'Decagon', seniority_level: 'Senior' }
  },
  {
    name: 'Erin Livesey-Becks',
    url: 'https://www.linkedin.com/in/erin-livesey-becks',
    sections: [{ type: 'notes', text: 'Erin Livesey-Becks' }, { type: 'notes', text: 'Building AI Agents @Decagon | ex Exa | ex McKinsey' }],
    expected: { full_name: 'Erin Livesey-Becks', linkedin_headline: 'Building AI Agents @Decagon | ex Exa | ex McKinsey' }
  }
];

for (const fixture of fixtures) {
  const contact = runContact(fixture);
  const identity = contact.merged_contact.contact_identity;
  for (const [field, value] of Object.entries(fixture.expected)) assert.equal(identity[field], value, `${fixture.name} ${field}`);
  assert.notEqual(identity.current_job_title, 'Decagon', `${fixture.name} should not use company as title`);
  assert.ok(!['11 mos', '1 yr 6 mos', 'Full-time · 10 mos'].includes(identity.current_company_name), `${fixture.name} should not use duration as company`);
  assert.ok(contact.captured_sections.length === fixture.sections.length, `${fixture.name} preserves raw captured sections`);
}

console.log(`Passed ${fixtures.length} contact identity fixture cases`);
