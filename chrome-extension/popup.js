const DEFAULT_RESPONSE_LANGUAGE = "ru";
const RESPONSE_LANGUAGE_KEY = "responseLanguage";
const GEMINI_API_KEY_STORAGE_KEY = "geminiApiKey";
const OPENAI_API_KEY_STORAGE_KEY = "openaiApiKey";

function setStatus(text) {
  const statusEl = document.getElementById("save-status");
  if (!statusEl) {
    return;
  }

  statusEl.textContent = text;
  if (!text) {
    return;
  }

  setTimeout(() => {
    statusEl.textContent = "";
  }, 1200);
}

function loadSavedLanguage() {
  chrome.storage.local.get(
    { [RESPONSE_LANGUAGE_KEY]: DEFAULT_RESPONSE_LANGUAGE },
    (items) => {
      const selectEl = document.getElementById("language-select");
      if (!selectEl) {
        return;
      }

      selectEl.value = items[RESPONSE_LANGUAGE_KEY] || DEFAULT_RESPONSE_LANGUAGE;
    }
  );
}

function loadSavedApiKey() {
  chrome.storage.local.get({ [GEMINI_API_KEY_STORAGE_KEY]: "" }, (items) => {
    const inputEl = document.getElementById("gemini-api-key");
    if (!inputEl) {
      return;
    }

    inputEl.value = items[GEMINI_API_KEY_STORAGE_KEY] || "";
  });

  chrome.storage.local.get({ [OPENAI_API_KEY_STORAGE_KEY]: "" }, (items) => {
    const inputEl = document.getElementById("openai-api-key");
    if (!inputEl) {
      return;
    }

    inputEl.value = items[OPENAI_API_KEY_STORAGE_KEY] || "";
  });
}

function bindApiKeyInput() {
  const inputEl = document.getElementById("gemini-api-key");
  const openAiInputEl = document.getElementById("openai-api-key");

  if (inputEl) {
    inputEl.addEventListener("change", () => {
      chrome.storage.local.set({ [GEMINI_API_KEY_STORAGE_KEY]: inputEl.value.trim() }, () => {
        setStatus("Saved");
      });
    });
  }

  if (openAiInputEl) {
    openAiInputEl.addEventListener("change", () => {
      chrome.storage.local.set({ [OPENAI_API_KEY_STORAGE_KEY]: openAiInputEl.value.trim() }, () => {
        setStatus("Saved");
      });
    });
  }
}

function bindLanguageSelector() {
  const selectEl = document.getElementById("language-select");
  if (!selectEl) {
    return;
  }

  selectEl.addEventListener("change", () => {
    chrome.storage.local.set({ [RESPONSE_LANGUAGE_KEY]: selectEl.value }, () => {
      setStatus("Saved");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadSavedApiKey();
  loadSavedLanguage();
  bindApiKeyInput();
  bindLanguageSelector();
});
