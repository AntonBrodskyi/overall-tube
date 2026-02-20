# OverallTube

OverallTube is a Chrome extension that integrates an AI panel directly into YouTube, instantly converting video transcripts into concise summaries and insightful reviews, while also allowing users to ask questions about the video on the watch page.

## Features

- Injects a compact AI panel into YouTube watch pages
- Supports 55 response languages for analysis and Q&A
- Provides three interaction modes:
  - Critical Review
  - Summary
  - Ask (chat-style questions about the current video transcript)
- Uses transcript extraction with multiple fallback strategies
- Caches transcript data per video/language for faster repeated requests
- Uses Gemini/OpenAI (Gemini with fallback model retries)

## Local Setup

1. Clone the repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `chrome-extension` folder.
5. Open the extension popup and set at least one API key:
   - Gemini API key (Free https://aistudio.google.com/app/api-keys), or
   - OpenAI API key.

## Usage

1. Open any YouTube video page (`/watch`).
2. Select one of the 55 supported languages in the injected panel.
3. Choose **Critical Review**, **Summary**, or **Ask**.
4. Read the generated result in the modal window (or continue the Ask conversation about the same video).

## Privacy Notes

- API keys are stored in `chrome.storage.local` on your machine.
- Transcript text is sent to the configured LLM provider (Gemini/OpenAI) to generate a response.
- This project does not run a backend server and does not collect analytics by default.

## Chrome Web Store Release

1. Prepare listing text and policy docs:
   - `docs/chrome-web-store/store-listing.md`
   - `docs/chrome-web-store/privacy-policy.md`
   - `docs/chrome-web-store/submission-checklist.md`
2. Host privacy policy on a public URL (required by Chrome Web Store).
3. Build upload artifact:
   - `bash scripts/release-chrome.sh`
   - Output zip appears in `release/`
4. In Chrome Web Store Developer Dashboard:
   - Upload the zip package
   - Fill in listing fields using `store-listing.md`
   - Provide privacy policy URL
   - Add screenshots (at least one required)
   - Complete Privacy practices questionnaire

## License

This project is licensed under the MIT License. See `LICENSE` for details.
