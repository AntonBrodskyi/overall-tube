# OverallTube Privacy Policy

Last updated: 2026-02-20

## What this extension does

OverallTube adds an AI panel on YouTube watch pages and generates a summary, critical review, or Q&A response based on the video transcript.

## Data we process

- User-provided API keys (Gemini and/or OpenAI).
- YouTube page URL and extracted transcript text for the current video.
- User prompts entered in Ask mode.
- Selected response language.

## How data is used

- API keys are used only to call the selected LLM provider API.
- Transcript text and user prompts are sent to Gemini and/or OpenAI to generate responses.
- Response language is used to control output language.

## Data storage

- API keys and language preference are stored locally in `chrome.storage.local` on the user's device.
- Temporary in-memory transcript cache is used only during extension runtime and is not persisted remotely.

## Data sharing

- No data is sold.
- No analytics or advertising SDKs are used by default.
- Data is shared only with the AI provider chosen by the user:
  - Google Gemini API
  - OpenAI API

## Data retention and deletion

- Users can remove stored API keys and preferences from extension storage at any time by clearing extension data in Chrome.
- The extension has no backend database and does not keep server-side user profiles.

## Permissions rationale

- `storage`: save API keys and language preference locally.
- `https://www.youtube.com/*`: run content script on watch pages and read transcript context.
- `https://generativelanguage.googleapis.com/*`: call Gemini API.
- `https://api.openai.com/*`: call OpenAI API.

## Contact

Provide a support contact email in your Chrome Web Store listing before publishing.
