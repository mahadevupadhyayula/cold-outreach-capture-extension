# Cold Outreach Capture

Cold Outreach Capture is a small Chrome extension for manually saving contact and company research while you browse. It is designed for a human-led cold outreach workflow: you select useful text, right-click to capture it, and download a local JSON text file when you are done.

The extension runs locally in your browser. It does not send your selections to an external service.

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
- **No message automation**: it does not write, send, schedule, or automate outreach messages.
- **No external API calls**: it does not call AI services, CRMs, enrichment tools, or remote databases.

## Install locally

1. Download or clone this extension folder to your computer.
2. Open Chrome.
3. Go to `chrome://extensions`.
4. Turn on **Developer Mode** in the top-right corner.
5. Click **Load unpacked**.
6. Select the extension folder.
7. Optional: pin **Cold Outreach Capture** to your Chrome toolbar for easier access.

If you edit the extension files later, return to `chrome://extensions` and click the reload icon on the extension card.

## How to use for contact extraction

Use Contact mode when you are researching a person, such as a founder, executive, product leader, or other outreach prospect.

1. Open the extension popup.
2. Enter the company name.
3. Choose **Contact** mode.
4. Click **Save session details**.
5. On the page you are researching, highlight a useful text block.
   - Put the section label on the first line of the highlighted block when possible.
   - Example first lines: `Header`, `About`, `Experience`, `Activity`, `Featured`, `Education`, `Contact`.
6. Right-click the highlighted text.
7. Click **Extract contact info**.
8. To capture the contact URL, right-click on the profile page or profile link.
9. Click **Extract contact URL**.
10. Repeat for any other useful contact sections.
11. Open the extension popup.
12. Click **Download contacts**.

## How to use for company extraction

Use Company mode when you are researching the account or organization.

1. Open the extension popup.
2. Enter the company name.
3. Choose **Company** mode.
4. Click **Save session details**.
5. Highlight a useful company text block.
   - Put the section label on the first line of the highlighted block when possible.
   - Example first lines: `Overview`, `About`, `Company size`, `Industry`, `Website`, `Headquarters`, `Specialties`, `Jobs`, `People`, `Posts`, `Funding`.
6. Right-click the highlighted text.
7. Click **Extract company info**.
8. To capture the company URL, right-click on the company page or company link.
9. Click **Extract company URL**.
10. Repeat for any other useful company sections.
11. Open the extension popup.
12. Click **Download company info**.

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
- `Company size` — employee count.
- `Industry` — industry category.
- `Website` — company website.
- `Headquarters` — headquarters location.
- `Specialties` — product areas, services, or keywords.
- `Jobs` — open roles, hiring signals, remote or hybrid signals.
- `People` — team composition or people summary.
- `Posts` — recent company activity or topics.
- `Funding` — funding announcements or investor notes.
- `Notes` — anything useful that does not fit another label.

## Example highlighted text blocks

### Contact example: Header

Highlight a block like this, then right-click **Extract contact info**:

```text
Header
Jordan Lee
VP Product at ExampleAI
San Francisco Bay Area
```

### Contact example: About

```text
About
I lead product teams building AI workflow tools for revenue teams. Recently focused on agentic CRM automation, data quality, and sales productivity.
```

### Contact example: Experience

```text
Experience
VP Product at ExampleAI
Jan 2023 – Present
Leading product strategy for AI agents that help GTM teams automate research workflows.
```

### Company example: Overview

Highlight a block like this, then right-click **Extract company info**:

```text
Overview
ExampleAI builds AI workflow software for revenue teams. The platform helps sales and marketing teams research accounts, enrich CRM data, and prepare personalized outreach.
```

### Company example: Company size

```text
Company size
51-200 employees
```

### Company example: Jobs

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

```json
{
  "schema_version": "0.1.0",
  "extraction_type": "contacts",
  "company_name_entered": "ExampleAI",
  "merged_contact": {
    "full_name": "Jordan Lee",
    "current_job_title": "VP Product",
    "current_company_name": "ExampleAI",
    "location_region": "San Francisco Bay Area",
    "linkedin_profile_url": "https://www.linkedin.com/in/jordan-lee-example/",
    "about_text": "I lead product teams building AI workflow tools for revenue teams.",
    "role_keywords": ["product", "ai"],
    "ai_product_keywords": ["AI", "workflow", "CRM"]
  },
  "captured_sections": [
    {
      "section_type": "header",
      "section_title_raw": "Header",
      "source_url": "https://www.linkedin.com/in/jordan-lee-example/",
      "section_text": "Header\nJordan Lee\nVP Product at ExampleAI\nSan Francisco Bay Area",
      "parsed_fields": {
        "full_name": "Jordan Lee",
        "linkedin_headline": "VP Product at ExampleAI",
        "current_job_title": "VP Product",
        "current_company_name": "ExampleAI",
        "location_region": "San Francisco Bay Area"
      },
      "confidence_score": 0.85
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

### Downloads not starting

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
