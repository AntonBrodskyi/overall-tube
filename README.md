# OverallTube

OverallTube is a Chrome extension that adds an AI panel to YouTube, instantly turning video transcripts into clear summaries or critical reviews - right on the watch page.

## Features

- Injects a small panel into YouTube watch pages
- Generates two response modes:
  - Critical Review
  - Summary
- Extracts transcripts with multiple fallback strategies
- Uses Gemini/OpenAI

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
2. Select output language in the injected panel.
3. Click **Critical Review** or **Summary**.
4. Read the generated result in the modal window.

## Privacy Notes

- API keys are stored in `chrome.storage.local` on your machine.
- Transcript text is sent to the configured LLM provider (Gemini/OpenAI) to generate a response.
- This project does not run a backend server and does not collect analytics by default.

## License

This project is licensed under the MIT License. See `LICENSE` for details.
