const DEFAULT_RESPONSE_LANGUAGE = "en";
const RESPONSE_LANGUAGE_OPTIONS = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pl", name: "Polish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ro", name: "Romanian" },
  { code: "nl", name: "Dutch" },
  { code: "bg", name: "Bulgarian" },
  { code: "hr", name: "Croatian" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "et", name: "Estonian" },
  { code: "fi", name: "Finnish" },
  { code: "el", name: "Greek" },
  { code: "hu", name: "Hungarian" },
  { code: "ga", name: "Irish" },
  { code: "lv", name: "Latvian" },
  { code: "lt", name: "Lithuanian" },
  { code: "mt", name: "Maltese" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "sv", name: "Swedish" },
  { code: "zh", name: "Mandarin Chinese" },
  { code: "hi", name: "Hindi" },
  { code: "bn", name: "Bengali" },
  { code: "ur", name: "Urdu" },
  { code: "id", name: "Indonesian" },
  { code: "ja", name: "Japanese" },
  { code: "mr", name: "Marathi" },
  { code: "te", name: "Telugu" },
  { code: "tr", name: "Turkish" },
  { code: "ta", name: "Tamil" },
  { code: "yue", name: "Cantonese" },
  { code: "ko", name: "Korean" },
  { code: "vi", name: "Vietnamese" },
  { code: "th", name: "Thai" },
  { code: "gu", name: "Gujarati" },
  { code: "fa", name: "Persian (Farsi)" },
  { code: "ms", name: "Malay" },
  { code: "kn", name: "Kannada" },
  { code: "or", name: "Odia" },
  { code: "pa", name: "Punjabi" },
  { code: "my", name: "Burmese" },
  { code: "uz", name: "Uzbek" },
  { code: "si", name: "Sinhala" },
  { code: "ml", name: "Malayalam" },
  { code: "ar", name: "Arabic" },
  { code: "sw", name: "Swahili" },
  { code: "ha", name: "Hausa" },
  { code: "am", name: "Amharic" },
  { code: "zu", name: "Zulu" },
];
const SUPPORTED_LANGUAGES = RESPONSE_LANGUAGE_OPTIONS.map((option) => option.code);
const LANGUAGE_NAMES = Object.fromEntries(
  RESPONSE_LANGUAGE_OPTIONS.map((option) => [option.code, option.name])
);
const GEMINI_API_KEY_STORAGE_KEY = "geminiApiKey";
const OPENAI_API_KEY_STORAGE_KEY = "openaiApiKey";
const OPENAI_MODEL = "gpt-5-nano";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const FALLBACK_MODELS = ["gemini-2.5-flash-lite", "gemini-3-flash-preview"];
const TRANSCRIPT_CACHE = new Map();
const MAX_HISTORY_MESSAGES = 12;
const OUTPUT_RULES =
  "Return only the answer content. Do not add introductory or concluding phrases. Return plain text only: no markdown, no headings, no bullet points, no quotes, and no extra formatting. Split the response into short readable paragraphs.";

function extractVideoId(youtubeUrl) {
  try {
    const url = new URL(youtubeUrl);

    if (url.hostname.includes("youtu.be")) {
      return url.pathname.slice(1).split("/")[0] || null;
    }

    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }

    if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
      return url.pathname.split("/")[2] || null;
    }
  } catch {
    return null;
  }

  return null;
}

function getSavedApiKeys() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      { [GEMINI_API_KEY_STORAGE_KEY]: "", [OPENAI_API_KEY_STORAGE_KEY]: "" },
      (items) => {
        resolve({
          geminiApiKey: (items[GEMINI_API_KEY_STORAGE_KEY] || "").trim(),
          openaiApiKey: (items[OPENAI_API_KEY_STORAGE_KEY] || "").trim(),
        });
      }
    );
  });
}

function getSavedLanguage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      { responseLanguage: DEFAULT_RESPONSE_LANGUAGE },
      (items) => {
        const language = items.responseLanguage;
        resolve(
          SUPPORTED_LANGUAGES.includes(language)
            ? language
            : DEFAULT_RESPONSE_LANGUAGE
        );
      }
    );
  });
}

function requestTranscriptFromTab(tabId, videoId, language) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        type: "FETCH_TRANSCRIPT_REQUEST",
        payload: { videoId, language },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response?.ok || !response?.transcriptText) {
          reject(new Error(response?.error || "Transcript is unavailable for this video."));
          return;
        }

        resolve(response.transcriptText);
      }
    );
  });
}

function getTranscriptCacheKey(videoId, language) {
  return `${videoId}::${language}`;
}

async function getTranscriptForRequest(tabId, videoId, language) {
  const cacheKey = getTranscriptCacheKey(videoId, language);
  const cachedTranscript = TRANSCRIPT_CACHE.get(cacheKey);
  if (cachedTranscript) {
    return cachedTranscript;
  }

  const transcriptText = await requestTranscriptFromTab(tabId, videoId, language);
  TRANSCRIPT_CACHE.set(cacheKey, transcriptText);
  return transcriptText;
}

function isTemporaryModelError(message) {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("unavailable") ||
    normalized.includes("high demand") ||
    normalized.includes('"code":503')
  );
}

async function callGeminiModel(model, apiKey, prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const responseData = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      responseData?.error?.message || `Gemini request failed (${response.status})`;
    throw new Error(message);
  }

  const parts = responseData?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts
        .map((part) => String(part?.text || ""))
        .join("")
        .trim()
    : "";
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

async function generateWithFallback(apiKey, prompt, primaryModel) {
  const modelsToTry = [primaryModel, ...FALLBACK_MODELS].filter(
    (model, index, arr) => arr.indexOf(model) === index
  );
  let lastError = null;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await callGeminiModel(model, apiKey, prompt);
      } catch (error) {
        lastError = error;
        const shouldRetry = isTemporaryModelError(error?.message) && attempt === 0;
        if (shouldRetry) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }
        break;
      }
    }
  }

  throw lastError || new Error("Gemini request failed.");
}

function extractOpenAiResponseText(responseData) {
  if (typeof responseData?.output_text === "string" && responseData.output_text.trim()) {
    return responseData.output_text.trim();
  }

  const textParts = [];
  const outputs = Array.isArray(responseData?.output) ? responseData.output : [];
  for (const outputItem of outputs) {
    const contentItems = Array.isArray(outputItem?.content) ? outputItem.content : [];
    for (const contentItem of contentItems) {
      if (contentItem?.type === "output_text" && typeof contentItem?.text === "string") {
        textParts.push(contentItem.text);
      }
    }
  }

  return textParts.join("").trim();
}

async function callOpenAiModel(apiKey, prompt) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: prompt,
    }),
  });

  const responseData = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      responseData?.error?.message || `OpenAI request failed (${response.status})`;
    throw new Error(message);
  }

  const text = extractOpenAiResponseText(responseData);
  if (!text) {
    throw new Error("OpenAI returned an empty response.");
  }

  return text;
}

function getSafeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      text: String(item?.text || "").trim(),
    }))
    .filter((item) => item.text);
}

function getLanguageName(language) {
  return LANGUAGE_NAMES[language] || LANGUAGE_NAMES[DEFAULT_RESPONSE_LANGUAGE];
}

function buildAnalysisPrompt(mode, language, transcriptText) {
  const languageName = getLanguageName(language);
  const analysisInstruction =
    mode === "summary"
      ? "Provide a brief summary of this YouTube video based on the transcript. Focus on the main topics and key points."
      : "Analyze this YouTube transcript using critical thinking. Verify claims, identify possible biases, and provide a balanced review of the information.";

  return `${analysisInstruction} Keep the response around 200 words and write it in ${languageName}.\n\n${OUTPUT_RULES}\n\nTranscript: ${transcriptText}`;
}

function buildAskPrompt(language, transcriptText, question, history) {
  const historyBlock = history.length
    ? history
        .map((item) => `${item.role === "assistant" ? "Assistant" : "User"}: ${item.text}`)
        .join("\n")
    : "No previous conversation.";

  return `Answer the user's question using only this YouTube video transcript. If the transcript does not contain enough information, explicitly say that there is not enough information in the transcript. Respond in ${getLanguageName(language)}.\n\n${OUTPUT_RULES}\n\nConversation history:\n${historyBlock}\n\nCurrent user question: ${question}\n\nTranscript: ${transcriptText}`;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "FACT_CHECK_REQUEST" && message?.type !== "ASK_VIDEO_QUESTION") {
    return;
  }

  const { youtubeUrl, mode, language: requestedLanguage, question, history } = message.payload ?? {};
  const isAskRequest = message?.type === "ASK_VIDEO_QUESTION";
  const language = SUPPORTED_LANGUAGES.includes(requestedLanguage)
    ? requestedLanguage
    : null;
  const safeMode = mode === "summary" ? "summary" : "critical";

  Promise.all([Promise.resolve(language || getSavedLanguage()), getSavedApiKeys()])
    .then(async ([resolvedLanguage, { geminiApiKey, openaiApiKey }]) => {
      if (!geminiApiKey && !openaiApiKey) {
        throw new Error(
          "API key is missing. Save GEMINI_API_KEY or OPENAI_API_KEY in extension popup."
        );
      }

      const videoId = extractVideoId(youtubeUrl);
      if (!videoId) {
        throw new Error("Invalid YouTube URL.");
      }

      const tabId = sender?.tab?.id;
      if (typeof tabId !== "number") {
        throw new Error("Active tab is unavailable.");
      }

      const transcriptText = await getTranscriptForRequest(tabId, videoId, resolvedLanguage);
      if (isAskRequest && !String(question || "").trim()) {
        throw new Error("Question is required.");
      }

      const prompt = isAskRequest
        ? buildAskPrompt(
            resolvedLanguage,
            transcriptText,
            String(question || "").trim(),
            getSafeHistory(history)
          )
        : buildAnalysisPrompt(safeMode, resolvedLanguage, transcriptText);
      const llmText = geminiApiKey
        ? await generateWithFallback(
            geminiApiKey,
            prompt,
            DEFAULT_GEMINI_MODEL
          )
        : await callOpenAiModel(openaiApiKey, prompt);

      sendResponse(isAskRequest ? { ok: true, answer: llmText } : { ok: true, analysis: llmText });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to process video in extension.",
      });
    });

  return true;
});
