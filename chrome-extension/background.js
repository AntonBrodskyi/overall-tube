const DEFAULT_RESPONSE_LANGUAGE = "ru";
const SUPPORTED_LANGUAGES = ["en", "ru", "uk"];
const GEMINI_API_KEY_STORAGE_KEY = "geminiApiKey";
const OPENAI_API_KEY_STORAGE_KEY = "openaiApiKey";
const OPENAI_MODEL = "gpt-5-nano";
const GEMINI_MODEL_BY_LANGUAGE = {
  en: "gemini-2.5-flash",
  ru: "gemini-2.5-flash",
  uk: "gemini-2.5-flash",
};
const FALLBACK_MODELS = ["gemini-2.5-flash-lite", "gemini-3-flash-preview"];

const promptTemplates = {
  critical: {
    en: "Please analyze the following transcript from a YouTube video from a critical thinking perspective. Verify the claims made, identify potential biases, and provide a balanced review of the information presented. Keep the response around 200 words in English.",
    ru: "Пожалуйста, проанализируйте следующую расшифровку YouTube видео с точки зрения критического мышления. Проверьте сделанные утверждения, определите возможную предвзятость и предоставьте сбалансированный обзор представленной информации. Сохраняйте ответ около 200 слов на русском языке.",
    uk: "Будь ласка, проаналізуйте наступну розшифровку YouTube відео з точки зору критичного мислення. Перевірте зроблені твердження, визначте можливу упередженість та надайте збалансований огляд представленої інформації. Зберігайте відповідь близько 200 слів українською мовою.",
  },
  summary: {
    en: "Please provide a brief summary of what this YouTube video is about based on the transcript. Focus on the main topics and key points. Keep the response around 200 words in English.",
    ru: "Предоставьте краткое содержание этого YouTube видео на основе расшифровки. Сосредоточьтесь на основных темах и ключевых моментах. Сохраняйте ответ около 200 слов на русском языке.",
    uk: "Надайте короткий зміст цього YouTube відео на основі розшифровки. Зосередьтеся на основних темах та ключових моментах. Зберігайте відповідь близько 200 слів українською мовою.",
  },
};

const outputRules = {
  en: "Return only the answer content. Do not add introductory or concluding phrases (for example: 'Here is a summary based on the transcript'). Return plain text only: no markdown, no headings, no bullet points, no quotes, and no extra formatting. Split the response into short readable paragraphs.",
  ru: "Верни только содержание ответа. Не добавляй вступительные или заключительные фразы (например: 'Вот краткое содержание видео на основе расшифровки'). Верни только обычный текст: без markdown, без заголовков, без списков, без кавычек и без дополнительного форматирования. Разделяй ответ на короткие абзацы для удобства чтения.",
  uk: "Поверни лише зміст відповіді. Не додавай вступних або завершальних фраз (наприклад: 'Ось короткий зміст відео на основі розшифровки'). Поверни лише звичайний текст: без markdown, без заголовків, без списків, без лапок і без додаткового форматування. Розділяй відповідь на короткі абзаци для зручності читання.",
};

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "FACT_CHECK_REQUEST") {
    return;
  }

  const { youtubeUrl, mode, language: requestedLanguage } = message.payload ?? {};
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

      const transcriptText = await requestTranscriptFromTab(
        tabId,
        videoId,
        resolvedLanguage
      );

      const promptTemplate = promptTemplates[safeMode][resolvedLanguage];
      const prompt = `${promptTemplate}\n\n${outputRules[resolvedLanguage]}\n\nTranscript: ${transcriptText}`;
      const analysis = geminiApiKey
        ? await generateWithFallback(
            geminiApiKey,
            prompt,
            GEMINI_MODEL_BY_LANGUAGE[resolvedLanguage]
          )
        : await callOpenAiModel(openaiApiKey, prompt);

      sendResponse({ ok: true, analysis });
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
