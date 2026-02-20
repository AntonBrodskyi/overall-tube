const DEFAULT_RESPONSE_LANGUAGE = "en";
const RESPONSE_LANGUAGE_KEY = "responseLanguage";
const GEMINI_API_KEY_STORAGE_KEY = "geminiApiKey";
const OPENAI_API_KEY_STORAGE_KEY = "openaiApiKey";
const RESPONSE_LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pl", label: "Polski" },
  { code: "uk", label: "Українська" },
  { code: "ro", label: "Română" },
  { code: "nl", label: "Nederlands" },
  { code: "bg", label: "Български" },
  { code: "hr", label: "Hrvatski" },
  { code: "cs", label: "Čeština" },
  { code: "da", label: "Dansk" },
  { code: "et", label: "Eesti" },
  { code: "fi", label: "Suomi" },
  { code: "el", label: "Ελληνικά" },
  { code: "hu", label: "Magyar" },
  { code: "ga", label: "Gaeilge" },
  { code: "lv", label: "Latviešu" },
  { code: "lt", label: "Lietuvių" },
  { code: "mt", label: "Malti" },
  { code: "sk", label: "Slovenčina" },
  { code: "sl", label: "Slovenščina" },
  { code: "sv", label: "Svenska" },
  { code: "zh", label: "中文（普通话）" },
  { code: "hi", label: "हिन्दी" },
  { code: "bn", label: "বাংলা" },
  { code: "ur", label: "اردو" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "ja", label: "日本語" },
  { code: "mr", label: "मराठी" },
  { code: "te", label: "తెలుగు" },
  { code: "tr", label: "Türkçe" },
  { code: "ta", label: "தமிழ்" },
  { code: "yue", label: "粵語" },
  { code: "ko", label: "한국어" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "th", label: "ไทย" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "fa", label: "فارسی" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "or", label: "ଓଡ଼ିଆ" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "my", label: "မြန်မာဘာသာ" },
  { code: "uz", label: "O‘zbek" },
  { code: "si", label: "සිංහල" },
  { code: "ml", label: "മലയാളം" },
  { code: "ar", label: "العربية" },
  { code: "sw", label: "Kiswahili" },
  { code: "ha", label: "Hausa" },
  { code: "am", label: "አማርኛ" },
  { code: "zu", label: "isiZulu" },
];

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

      const savedLanguage = items[RESPONSE_LANGUAGE_KEY] || DEFAULT_RESPONSE_LANGUAGE;
      const hasOption = RESPONSE_LANGUAGE_OPTIONS.some((option) => option.code === savedLanguage);
      selectEl.value = hasOption ? savedLanguage : DEFAULT_RESPONSE_LANGUAGE;
    }
  );
}

function renderLanguageOptions() {
  const selectEl = document.getElementById("language-select");
  if (!selectEl) {
    return;
  }

  selectEl.innerHTML = "";
  for (const option of RESPONSE_LANGUAGE_OPTIONS) {
    const optionEl = document.createElement("option");
    optionEl.value = option.code;
    optionEl.textContent = option.label;
    selectEl.appendChild(optionEl);
  }
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
  renderLanguageOptions();
  loadSavedApiKey();
  loadSavedLanguage();
  bindApiKeyInput();
  bindLanguageSelector();
});
