# Cold Outreach Capture

Cold Outreach Capture is a Manifest V3 Chrome extension for manual, local-only evidence capture for a Cold Outreach OS workflow.

## What it does

- Opens a popup where you can enter a company name.
- Lets you choose an extraction mode: **Contact** or **Company**.
- Registers four right-click context menu actions:
  - Extract contact info
  - Extract contact URL
  - Extract company info
  - Extract company URL
- Captures highlighted text or the current/link URL from LinkedIn or any webpage.
- Appends each capture to a local session stored in `chrome.storage.local`.
- Downloads the final local session as a JSON `.txt` file.

## Privacy and safety boundaries

This extension is intentionally manual and local-only.

- No auto-scroll.
- No bulk scraping.
- No auto-clicking.
- No external API calls.
- No remote storage.
- All session data is stored locally with `chrome.storage.local`.

## Install locally

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. Pin **Cold Outreach Capture** if desired.

## Usage

1. Open the extension popup.
2. Enter a company name.
3. Select **Contact** or **Company** mode.
4. Click **Save session details**.
5. Highlight text on LinkedIn or any webpage.
6. Right-click and choose one of the extraction actions.
7. Open the popup to see the captured section count.
8. Click **Download JSON .txt** to save the local session.

## Session format

Downloaded sessions are JSON text files with this shape:

```json
{
  "companyName": "Example Company",
  "createdAt": "2026-07-07T00:00:00.000Z",
  "updatedAt": "2026-07-07T00:00:00.000Z",
  "sections": [
    {
      "id": "uuid",
      "type": "contact_info",
      "sourceUrl": "https://www.linkedin.com/",
      "capturedAt": "2026-07-07T00:00:00.000Z",
      "payload": {
        "rawText": "Selected text"
      }
    }
  ]
}
```

## Development notes

The extension uses only plain JavaScript, HTML, and CSS. There are no build tools, React, TypeScript, or package dependencies.
