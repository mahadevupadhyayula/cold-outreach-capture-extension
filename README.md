# Cold Outreach Capture

Cold Outreach Capture is a small Chrome extension for **manual local evidence capture for Cold Outreach OS**. It helps you save contact and company research while you browse, without automating the browsing, scraping, messaging, or CRM-update parts of your workflow.

The extension is designed for a human-led cold outreach workflow: you select useful text, right-click to capture it, and download local JSON when you are done. The extension runs locally in your browser and does not send your selections to an external service.

## What the extension does

- Lets you enter the company name for the research session.
- Lets you switch between **Contact** mode and **Company** mode.
- Adds right-click menu actions for saving selected text and page/link URLs.
- Stores the current session in Chrome local storage.
- Shows a simple popup preview with captured section counts, recent sections, URLs, and warnings.
- Downloads captured contact data or company data as `.json.txt` files.

## What it does not do

This extension is intentionally manual and lightweight.

- **No auto-scroll**: it will not scroll pages for you.
- **No bulk scraping**: it only captures the text or URL you manually select or right-click.
- **No automatic LinkedIn scraping**: it does not crawl LinkedIn, open profiles, or collect profile data automatically.
- **No automated messaging**: it does not write, send, schedule, or automate outreach messages.
- **No external API calls**: it does not call AI services, CRMs, enrichment tools, or remote databases.
- **No CRM writeback**: it does not create, update, or sync CRM records.

## Install locally

1. Download or clone this extension folder to your computer.
2. Open Chrome.
3. Go to `chrome://extensions`.
4. Turn on **Developer Mode** in the top-right corner.
5. Click **Load unpacked**.
6. Select the extension folder.
7. Optional: pin **Cold Outreach Capture** to your Chrome toolbar for easier access.

If you edit the extension files later, return to `chrome://extensions` and click the reload icon on the extension card.

## Contact capture workflow

Use **Contact** mode when you are researching one or more people at the same account, such as founders, executives, product leaders, or other outreach prospects. Each contact should have its own captured URL and its own captured sections in the downloaded contacts JSON.

1. Open the extension popup.
2. Enter the company name for the research session.
3. Select **Contact** mode.
4. Open the first contact profile.
5. Right-click the profile page or profile link.
6. Click **Extract contact URL**.
7. Highlight useful profile sections where the first line is the section label.
8. Right-click the highlighted text.
9. Click **Extract contact info**.
10. Open the next contact profile.
11. Right-click the next profile page or profile link.
12. Click **Extract contact URL**.
13. Repeat the section highlighting and **Extract contact info** steps for each contact.
14. Open the extension popup.
15. Click **Download contacts** to download the contacts JSON.

When reviewing the downloaded file, verify that `contacts_count` matches the number of contacts you captured and that each contact has separate `captured_sections`.

## Company capture workflow

Use **Company** mode when you are researching the account or organization.

1. Open the extension popup.
2. Enter the company name.
3. Select **Company** mode.
4. Right-click the company page or company link.
5. Click **Extract company URL**.
6. Highlight useful company sections such as `Overview`, `Company Size`, `Industry`, `Jobs`, `Posts`, and any other relevant visible evidence.
7. Right-click the highlighted text.
8. Click **Extract company info**.
9. Repeat for any other useful company sections.
10. Open the extension popup.
11. Click **Download company info** to download the company info JSON.

## Recommended section labels

The first line of your highlighted text should be a simple label. The extension uses that first line to decide how to parse the rest of the block.

### Contact labels

Recommended labels for contact research:

- `Header` — name, headline, title, company, location.
- `About` — summary, interests, personalization hooks, keywords.
- `Experience` — current or past roles, dates, responsibilities.
- `Activity` — recent posts, comments, topics, possible outreach hooks.
- `Featured` — featured links, media, articles, or resources.
- `Education` — schools, degrees, fields of study.
- `Contact` — email addresses, websites, or other visible contact details.
- `Notes` — anything useful that does not fit another label.

### Company labels

Recommended labels for company research:

- `Overview` — company summary or description.
- `About` — longer company description or positioning.
- `Company Size` — employee count.
- `Industry` — industry category.
- `Website` — company website.
- `Headquarters` — headquarters location.
- `Specialties` — product areas, services, or keywords.
- `Jobs` — open roles, hiring signals, remote or hybrid signals.
- `People` — team composition or people summary.
- `Posts` — recent company activity or topics.
- `Funding` — funding announcements or investor notes.
- `Notes` — anything useful that does not fit another label.

## Example highlighted text

Highlight blocks where the first line is the section label, then right-click **Extract contact info**. For example:

```text
Header
Jane Doe
Senior Product Manager, AI Platforms
Example AI
London, England, United Kingdom

About
I build AI workflow products for revenue and operations teams using LLMs and agentic systems.

Experience
Senior Product Manager, AI Platforms
Example AI
Jan 2024 - Present
Leading AI workflow products for enterprise GTM teams.
```

For company capture, use the same first-line label pattern and right-click **Extract company info**. For example:

```text
Overview
Example AI builds AI workflow software for revenue teams. The platform helps sales and marketing teams research accounts, enrich CRM data, and prepare personalized outreach.
```

```text
Company Size
51-200 employees
```

```text
Jobs
Senior Product Manager, AI Platform
Machine Learning Engineer
Remote
Hybrid
```

## Example exported JSON

The extension downloads JSON inside a `.json.txt` file so it is easy to inspect, copy, store, or import into another workflow.

### Contact export example

A contacts export contains a top-level `contacts_count` and a `contacts` array. Each contact in the array has its own `contact_url`, `merged_contact`, `captured_sections`, and `validation_metadata`.

```json
{
  "schema_version": "0.1.0",
  "extraction_type": "contacts",
  "company_name_entered": "Example AI",
  "exported_at": "2026-07-07T00:00:00.000Z",
  "contacts_count": 2,
  "contacts": [
    {
      "contact_id": "contact_1",
      "contact_url": "https://www.linkedin.com/in/jane-doe-example/",
      "source_page_title": "Jane Doe | LinkedIn",
      "status": "captured",
      "company_name_entered": "Example AI",
      "merged_contact": {
        "contact_identity": {
          "full_name": "Jane Doe",
          "linkedin_profile_url": "https://www.linkedin.com/in/jane-doe-example/",
          "current_job_title": "Senior Product Manager, AI Platforms",
          "current_company_name": "Example AI",
          "location_region": "London, England, United Kingdom"
        },
        "about_text": "I build AI workflow products for revenue and operations teams using LLMs and agentic systems."
      },
      "captured_sections": [
        {
          "section_type": "header",
          "section_title_raw": "Header",
          "source_url": "https://www.linkedin.com/in/jane-doe-example/",
          "section_text": "Header\nJane Doe\nSenior Product Manager, AI Platforms\nExample AI\nLondon, England, United Kingdom"
        }
      ],
      "validation_metadata": {
        "missing_fields": [],
        "field_conflicts": [],
        "validation_warnings": [],
        "needs_manual_validation": false
      }
    },
    {
      "contact_id": "contact_2",
      "contact_url": "https://www.linkedin.com/in/alex-smith-example/",
      "source_page_title": "Alex Smith | LinkedIn",
      "status": "captured",
      "company_name_entered": "Example AI",
      "merged_contact": {
        "contact_identity": {
          "full_name": "Alex Smith",
          "linkedin_profile_url": "https://www.linkedin.com/in/alex-smith-example/"
        }
      },
      "captured_sections": [
        {
          "section_type": "notes",
          "section_title_raw": "Notes",
          "source_url": "https://www.linkedin.com/in/alex-smith-example/",
          "section_text": "Notes\nSecond contact captured separately from Jane Doe."
        }
      ],
      "validation_metadata": {
        "missing_fields": ["contact_identity.current_job_title"],
        "field_conflicts": [],
        "validation_warnings": [],
        "needs_manual_validation": true
      }
    }
  ],
  "validation_metadata": {
    "needs_manual_validation": true,
    "session_conflicts": []
  }
}
```

### Company export example

```json
{
  "schema_version": "0.1.0",
  "extraction_type": "company",
  "company_name_entered": "ExampleAI",
  "merged_company": {
    "description": "ExampleAI builds AI workflow software for revenue teams.",
    "company_size": "51-200 employees",
    "website": "https://www.exampleai.com",
    "headquarters": "San Francisco, CA",
    "specialties": ["AI", "CRM", "workflow automation"]
  },
  "captured_sections": [
    {
      "section_type": "overview",
      "section_title_raw": "Overview",
      "source_url": "https://www.linkedin.com/company/exampleai/",
      "section_text": "Overview\nExampleAI builds AI workflow software for revenue teams.",
      "parsed_fields": {
        "description": "Overview\nExampleAI builds AI workflow software for revenue teams.",
        "ai_product_relevance_notes": ["AI", "workflow"]
      },
      "confidence_score": 0.69
    }
  ],
  "validation_metadata": {
    "missing_fields": [],
    "field_conflicts": [],
    "needs_manual_validation": true
  },
  "exported_at": "2026-07-07T00:00:00.000Z"
}
```

## Testing steps

Use a local HTML page first so you can confirm the workflow without depending on a live site layout.

1. Load the unpacked extension from `chrome://extensions`.
2. Test on a local HTML page with sample contact and company text.
3. In **Contact** mode, test contact A by extracting a contact URL and at least one labeled section.
4. Open another profile or local test page and test contact B by extracting a different contact URL and at least one labeled section.
5. Download contacts.
6. Open the downloaded contacts JSON and verify that `contacts_count` is `2` and each contact has separate `captured_sections`.
7. Switch to **Company** mode, extract a company URL, capture labeled company sections, and download company info JSON.

## Troubleshooting

### Context menu not visible

Try these checks:

- Make sure the extension is enabled at `chrome://extensions`.
- Reload the extension from `chrome://extensions`.
- Refresh the page you are trying to capture from.
- For text extraction actions, make sure text is highlighted before right-clicking.
- Some Chrome pages and browser-owned pages do not allow extensions to run. Try a normal website page instead.

### Selected text not captured

Try these checks:

- Highlight regular page text, not text inside an image or screenshot.
- Keep the highlight active, then right-click directly on the selected text.
- Put the section label on the first line of the selected block.
- Refresh the page after installing or reloading the extension.
- Try selecting a smaller block if the page has unusual formatting.

### Popup not updating

Try these checks:

- Click **Save session details** after entering the company name or changing modes.
- Close and reopen the popup.
- Refresh the page where you are capturing text.
- Reload the extension from `chrome://extensions`.
- If the session looks stuck, use **Clear session** and start a new capture session.

### Duplicate contact created

Try these checks:

- Confirm that you extracted the correct profile URL for each person before capturing sections.
- If two contacts were created for the same person, compare the captured URLs for small differences such as tracking parameters or alternate profile links.
- Remove the duplicate contact in the popup if needed, then re-capture the sections under the intended contact.
- Use one contact profile URL consistently for each person during a session.

### Download not starting

Try these checks:

- Make sure Chrome allows downloads from extensions.
- Check your browser downloads shelf or downloads page.
- Enter a company name before downloading.
- Capture at least one relevant section before downloading.
- If nothing happens, reload the extension from `chrome://extensions` and try again.

## Practical tips

- Capture one section at a time instead of highlighting an entire page.
- Use clear labels on the first line so the export is easier to review.
- Always capture the contact URL or company URL before downloading.
- Review the exported JSON before using it in another tool or workflow.
- Treat captured data as research notes that still need human validation.
