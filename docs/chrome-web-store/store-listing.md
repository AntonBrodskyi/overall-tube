# Chrome Web Store Listing Draft

## Extension name

OverallTube

## Short description (<= 132 chars)

AI summary, critical review, and Q&A panel for YouTube videos, powered by your Gemini/OpenAI API key.

## Detailed description

OverallTube adds a compact AI panel directly to YouTube watch pages.

Use it to:
- Generate a concise summary of the current video transcript
- Get a critical review with balanced analysis and bias checks
- Ask follow-up questions in chat style about the same video

Key points:
- Works on YouTube watch pages
- Supports 55 response languages
- Uses transcript extraction with fallback strategies
- Stores API keys locally in your browser (`chrome.storage.local`)
- Supports Gemini with fallback model retries and OpenAI as an alternative provider

OverallTube does not require account sign-in and does not run a backend server by default.

## Single purpose statement

OverallTube helps users understand YouTube videos faster by analyzing video transcripts and generating AI summaries, critical reviews, and transcript-based answers.

## Permissions justification (for "Privacy practices" form)

- `storage`: stores user API keys and language preference locally.
- `https://www.youtube.com/*`: injects UI on watch pages and reads transcript context.
- `https://generativelanguage.googleapis.com/*`: sends transcript and prompt to Gemini API.
- `https://api.openai.com/*`: sends transcript and prompt to OpenAI API.

## Data handling answers template

- Sold data: No
- Used for ads: No
- Used for credit scoring/lending: No
- Collected personal data: User-provided API key, transcript content, user prompt
- Data processed locally: yes (settings and cache)
- Data transmitted externally: yes (to selected AI provider)

## Required store assets (manual)

- Extension icon: 128x128 (already in repo)
- At least 1 screenshot: 1280x800 or 640x400
- Optional promotional tiles:
  - Small tile: 440x280
  - Marquee: 1400x560
  - Large promo tile: 920x680
