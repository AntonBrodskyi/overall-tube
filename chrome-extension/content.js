const PANEL_ID = "vfce-panel";
const MODAL_ID = "vfce-modal";
const BUTTON_BUSY_CLASS = "vfce-button--busy";
const CHAT_SEND_BUSY_CLASS = "vfce-chat-send--busy";
const PANEL_ICON_URL = chrome.runtime.getURL("icons/icon-16.png");
const RESPONSE_LANGUAGE_KEY = "responseLanguage";
const DEFAULT_RESPONSE_LANGUAGE = "en";
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
const SUPPORTED_LANGUAGES = RESPONSE_LANGUAGE_OPTIONS.map((option) => option.code);
const ANALYSIS_CACHE = new Map();
const CHAT_SESSIONS = new Map();
const YOUTUBE_WATCH_URL = "https://www.youtube.com/watch?v=";
const TRANSCRIPT_PANEL_SELECTOR =
  'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]';
const TRANSCRIPT_SEGMENT_SELECTOR = "ytd-transcript-segment-renderer";

let activeRequestCount = 0;

function getPreferredLanguages(primaryLanguage) {
  const languageOrder = [primaryLanguage, "en"];
  return languageOrder.filter((lang, index) => languageOrder.indexOf(lang) === index);
}

async function fetchWatchPage(videoId, language) {
  const watchUrl = `${YOUTUBE_WATCH_URL}${encodeURIComponent(videoId)}&hl=${language}`;
  const response = await fetch(watchUrl, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to load YouTube page (${response.status})`);
  }
  return response.text();
}

function extractCaptionTracksFromHtml(html) {
  const anchors = [
    "ytInitialPlayerResponse = ",
    "var ytInitialPlayerResponse = ",
    "window['ytInitialPlayerResponse'] = ",
  ];

  for (const anchor of anchors) {
    const playerResponse = extractJsonObjectByAnchor(html, anchor);
    const tracklist = playerResponse?.captions?.playerCaptionsTracklistRenderer;
    if (Array.isArray(tracklist?.captionTracks)) {
      return tracklist.captionTracks;
    }
  }

  const captionsMatch = html.match(/"captions":(\{.*?\}),"videoDetails":/s);
  if (captionsMatch?.[1]) {
    try {
      const captionsPayload = JSON.parse(captionsMatch[1]);
      const tracklist = captionsPayload?.playerCaptionsTracklistRenderer;
      if (Array.isArray(tracklist?.captionTracks)) {
        return tracklist.captionTracks;
      }
    } catch {
      // Ignore and return empty list.
    }
  }

  return [];
}

function extractJsonObjectByAnchor(text, anchor) {
  const anchorIndex = text.indexOf(anchor);
  if (anchorIndex < 0) {
    return null;
  }

  const jsonStart = text.indexOf("{", anchorIndex + anchor.length);
  if (jsonStart < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = jsonStart; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(jsonStart, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function rankTrack(track, preferredLanguage) {
  const code = String(track?.languageCode || "").toLowerCase();
  const preferred = String(preferredLanguage || "").toLowerCase();
  const isAuto = Boolean(track?.kind === "asr");

  if (code === preferred && !isAuto) {
    return 0;
  }
  if (code.startsWith(`${preferred}-`) && !isAuto) {
    return 1;
  }
  if (code === preferred && isAuto) {
    return 2;
  }
  if (code.startsWith(`${preferred}-`) && isAuto) {
    return 3;
  }
  if (!isAuto) {
    return 4;
  }
  return 5;
}

function selectCaptionTracks(captionTracks, preferredLanguage) {
  return [...captionTracks].sort(
    (a, b) => rankTrack(a, preferredLanguage) - rankTrack(b, preferredLanguage)
  );
}

function normalizeTranscriptText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTranscriptFromDom() {
  const segments = document.querySelectorAll(TRANSCRIPT_SEGMENT_SELECTOR);
  if (!segments || segments.length === 0) {
    return "";
  }

  const text = Array.from(segments)
    .map((segment) => {
      const textEl = segment.querySelector(".segment-text");
      return textEl ? textEl.textContent || "" : "";
    })
    .join(" ");

  return normalizeTranscriptText(text);
}

function isTranscriptPanelVisible() {
  const panel = document.querySelector(TRANSCRIPT_PANEL_SELECTOR);
  if (!panel) {
    return false;
  }

  if (!panel.hasAttribute("visibility")) {
    return true;
  }

  return panel.getAttribute("visibility") !== "ENGAGEMENT_PANEL_VISIBILITY_HIDDEN";
}

function clickTranscriptMenuItem() {
  const menuItemCandidates = document.querySelectorAll(
    "ytd-menu-service-item-renderer, tp-yt-paper-item"
  );
  const matchKeywords = [
    "show transcript",
    "transcript",
    "показать текст видео",
    "расшифров",
    "показати стенограм",
  ];

  for (const candidate of menuItemCandidates) {
    const label = normalizeTranscriptText((candidate.textContent || "").toLowerCase());
    if (!label) {
      continue;
    }
    if (!matchKeywords.some((keyword) => label.includes(keyword))) {
      continue;
    }

    const clickable =
      candidate.querySelector("tp-yt-paper-item, yt-formatted-string") || candidate;
    if (clickable instanceof HTMLElement) {
      clickable.click();
      return true;
    }
  }

  return false;
}

async function openTranscriptPanelIfNeeded() {
  if (isTranscriptPanelVisible()) {
    return true;
  }

  const directButtons = document.querySelectorAll(
    'button[aria-label*="transcript" i], button[aria-label*="текст" i], button[aria-label*="стенограм" i]'
  );
  for (const button of directButtons) {
    if (button instanceof HTMLElement) {
      button.click();
      await sleep(300);
      if (isTranscriptPanelVisible()) {
        return true;
      }
    }
  }

  const moreButton = document.querySelector(
    'ytd-menu-renderer yt-icon-button button[aria-label], button[aria-label="More actions"]'
  );
  if (moreButton instanceof HTMLElement) {
    moreButton.click();
    await sleep(250);
    if (clickTranscriptMenuItem()) {
      await sleep(600);
      return isTranscriptPanelVisible();
    }
  }

  if (clickTranscriptMenuItem()) {
    await sleep(600);
    return isTranscriptPanelVisible();
  }

  return false;
}

async function extractTranscriptViaDomPanel() {
  let transcript = extractTranscriptFromDom();
  if (transcript) {
    return transcript;
  }

  const opened = await openTranscriptPanelIfNeeded();
  if (!opened) {
    return "";
  }

  for (let i = 0; i < 6; i += 1) {
    transcript = extractTranscriptFromDom();
    if (transcript) {
      return transcript;
    }
    await sleep(250);
  }

  return "";
}

function collectJson3TranscriptText(payload) {
  if (!Array.isArray(payload?.events)) {
    return "";
  }

  const chunks = [];
  for (const event of payload.events) {
    if (!Array.isArray(event?.segs)) {
      continue;
    }
    for (const segment of event.segs) {
      if (!segment?.utf8) {
        continue;
      }
      chunks.push(segment.utf8);
    }
  }

  return normalizeTranscriptText(chunks.join(""));
}

function decodeHtmlEntities(input) {
  return input
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function collectXmlTranscriptText(xmlText) {
  const chunks = [];
  const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let match = textRegex.exec(xmlText);

  while (match) {
    chunks.push(decodeHtmlEntities(match[1] || ""));
    match = textRegex.exec(xmlText);
  }

  return normalizeTranscriptText(chunks.join(" "));
}

async function fetchTranscriptByTrack(track) {
  const baseUrl = track?.baseUrl;
  if (!baseUrl) {
    return "";
  }

  const json3Url = new URL(baseUrl);
  json3Url.searchParams.set("fmt", "json3");

  try {
    const jsonResponse = await fetch(json3Url.toString(), { credentials: "include" });
    if (jsonResponse.ok) {
      const jsonPayload = await jsonResponse.json();
      const jsonText = collectJson3TranscriptText(jsonPayload);
      if (jsonText) {
        return jsonText;
      }
    }
  } catch {
    // Fallback to XML below.
  }

  const xmlResponse = await fetch(baseUrl, { credentials: "include" });
  if (!xmlResponse.ok) {
    return "";
  }

  const xmlText = await xmlResponse.text();
  const xmlResult = collectXmlTranscriptText(xmlText);
  if (xmlResult) {
    return xmlResult;
  }

  return "";
}

async function fetchTranscriptWithFallback(videoId, preferredLanguage) {
  const languages = getPreferredLanguages(preferredLanguage);

  try {
    const domTranscript = await extractTranscriptViaDomPanel();
    if (domTranscript) {
      return domTranscript;
    }
  } catch {
    // Fallback to timedtext methods below.
  }

  const currentPageHtml = document.documentElement?.innerHTML || "";
  if (currentPageHtml) {
    const currentPageTracks = selectCaptionTracks(
      extractCaptionTracksFromHtml(currentPageHtml),
      preferredLanguage
    );
    for (const track of currentPageTracks) {
      const transcript = await fetchTranscriptByTrack(track);
      if (transcript) {
        return transcript;
      }
    }
  }

  for (const language of languages) {
    const watchHtml = await fetchWatchPage(videoId, language);
    const extractedTracks = extractCaptionTracksFromHtml(watchHtml);
    const tracks = selectCaptionTracks(extractedTracks, language);
    for (const track of tracks) {
      const transcript = await fetchTranscriptByTrack(track);
      if (transcript) {
        return transcript;
      }
    }
  }

  throw new Error("Transcript is unavailable for this video.");
}

function getCurrentVideoUrl() {
  return window.location.href;
}

function getCurrentVideoId() {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get("v") || window.location.href;
  } catch {
    return window.location.href;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "FETCH_TRANSCRIPT_REQUEST") {
    return;
  }

  const { videoId, language } = message.payload ?? {};
  const safeLanguage = getSafeLanguage(language);

  fetchTranscriptWithFallback(videoId, safeLanguage)
    .then((transcriptText) => {
      sendResponse({ ok: true, transcriptText });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Transcript is unavailable for this video.",
      });
    });

  return true;
});

function getCacheKey(mode, language) {
  return `${getCurrentVideoId()}::${mode}::${language}`;
}

function getChatSessionKey(language) {
  return `${getCurrentVideoId()}::chat::${language}`;
}

function getOrCreateChatSession(language) {
  const key = getChatSessionKey(language);
  if (!CHAT_SESSIONS.has(key)) {
    CHAT_SESSIONS.set(key, { messages: [] });
  }
  return CHAT_SESSIONS.get(key);
}

function lockPageScroll() {
  document.documentElement.classList.add("vfce-no-scroll");
  document.body.classList.add("vfce-no-scroll");
}

function unlockPageScroll() {
  document.documentElement.classList.remove("vfce-no-scroll");
  document.body.classList.remove("vfce-no-scroll");
}

function ensureModal() {
  const existingModal = document.getElementById(MODAL_ID);
  if (existingModal) {
    return existingModal;
  }

  const overlay = document.createElement("div");
  overlay.id = MODAL_ID;
  overlay.className = "vfce-modal-overlay";
  overlay.innerHTML = `
    <div class="vfce-modal" role="dialog" aria-modal="true" aria-label="Fact check result">
      <div class="vfce-modal-header">
        <h3 class="vfce-modal-title">AI Review</h3>
        <button class="vfce-close-button" aria-label="Close">×</button>
      </div>
      <div class="vfce-modal-body"></div>
    </div>
  `;

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      overlay.classList.remove("vfce-visible");
      unlockPageScroll();
    }
  });

  const closeButton = overlay.querySelector(".vfce-close-button");
  closeButton?.addEventListener("click", () => {
    overlay.classList.remove("vfce-visible");
    unlockPageScroll();
  });

  document.body.appendChild(overlay);
  return overlay;
}

function showTextModal(title, text) {
  const overlay = ensureModal();
  const titleEl = overlay.querySelector(".vfce-modal-title");
  const bodyEl = overlay.querySelector(".vfce-modal-body");

  if (titleEl) {
    titleEl.textContent = title;
  }

  if (bodyEl) {
    bodyEl.classList.remove("vfce-chat-mode");
    bodyEl.textContent = text;
  }

  overlay.classList.add("vfce-visible");
  lockPageScroll();
}

function scrollChatToBottom(threadEl) {
  if (!threadEl) {
    return;
  }
  threadEl.scrollTop = threadEl.scrollHeight;
}

function renderChatMessages(threadEl, messages) {
  if (!threadEl) {
    return;
  }

  threadEl.innerHTML = "";
  for (const message of messages) {
    const item = document.createElement("div");
    item.className = `vfce-chat-message vfce-chat-message--${message.role}`;
    item.textContent = message.text;
    threadEl.appendChild(item);
  }

  if (messages.length === 0) {
    const empty = document.createElement("p");
    empty.className = "vfce-chat-empty";
    empty.textContent = "Ask any question about this video.";
    threadEl.appendChild(empty);
  }

  scrollChatToBottom(threadEl);
}

function setChatComposerState(inputEl, submitButton, isBusy) {
  if (inputEl) {
    inputEl.disabled = isBusy;
  }
  if (submitButton) {
    submitButton.disabled = isBusy;
    submitButton.classList.toggle(CHAT_SEND_BUSY_CLASS, isBusy);
  }
}

function showAskModal(language) {
  const safeLanguage = getSafeLanguage(language);
  const session = getOrCreateChatSession(safeLanguage);
  const overlay = ensureModal();
  const titleEl = overlay.querySelector(".vfce-modal-title");
  const bodyEl = overlay.querySelector(".vfce-modal-body");

  if (!bodyEl) {
    return;
  }

  if (titleEl) {
    titleEl.textContent = "Ask about this video";
  }

  bodyEl.classList.add("vfce-chat-mode");
  bodyEl.innerHTML = `
    <div class="vfce-chat-thread"></div>
    <form class="vfce-chat-composer">
      <input
        type="text"
        class="vfce-chat-input"
        placeholder="Type your question..."
        autocomplete="off"
      />
      <button type="submit" class="vfce-chat-send">
        <span class="vfce-chat-send-label">Send</span>
        <span class="vfce-chat-send-spinner" aria-hidden="true"></span>
      </button>
    </form>
  `;

  const threadEl = bodyEl.querySelector(".vfce-chat-thread");
  const formEl = bodyEl.querySelector(".vfce-chat-composer");
  const inputEl = bodyEl.querySelector(".vfce-chat-input");
  const submitButton = bodyEl.querySelector(".vfce-chat-send");

  renderChatMessages(threadEl, session.messages);
  setChatComposerState(inputEl, submitButton, false);
  inputEl?.focus();

  formEl?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!inputEl || !submitButton) {
      return;
    }

    const question = inputEl.value.trim();
    if (!question) {
      return;
    }

    const history = session.messages.slice(-10);
    session.messages.push({ role: "user", text: question });
    renderChatMessages(threadEl, session.messages);
    inputEl.value = "";
    setChatComposerState(inputEl, submitButton, true);

    chrome.runtime.sendMessage(
      {
        type: "ASK_VIDEO_QUESTION",
        payload: {
          youtubeUrl: getCurrentVideoUrl(),
          language: safeLanguage,
          question,
          history,
        },
      },
      (response) => {
        setChatComposerState(inputEl, submitButton, false);

        if (chrome.runtime.lastError) {
          session.messages.push({
            role: "assistant",
            text: "Не удалось связаться с background-скриптом расширения.",
          });
          renderChatMessages(threadEl, session.messages);
          return;
        }

        if (!response?.ok) {
          session.messages.push({
            role: "assistant",
            text: response?.error || "Неизвестная ошибка API.",
          });
          renderChatMessages(threadEl, session.messages);
          return;
        }

        session.messages.push({ role: "assistant", text: response.answer });
        renderChatMessages(threadEl, session.messages);
      }
    );
  });

  overlay.classList.add("vfce-visible");
  lockPageScroll();
}

function setControlsDisabled(isDisabled) {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) {
    return false;
  }

  const controls = panel.querySelectorAll(".vfce-button, .vfce-language-select");
  controls.forEach((el) => {
    el.disabled = isDisabled;
  });

  return true;
}

function setRequestInProgress(activeButton, isStarting) {
  if (isStarting) {
    activeRequestCount += 1;
  } else {
    activeRequestCount = Math.max(0, activeRequestCount - 1);
  }

  if (activeButton) {
    activeButton.classList.toggle(BUTTON_BUSY_CLASS, isStarting);
  }

  if (isStarting) {
    setControlsDisabled(true);
  } else {
    const hasActiveRequests = activeRequestCount > 0;
    setControlsDisabled(hasActiveRequests);
  }
}

function getSafeLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language)
    ? language
    : DEFAULT_RESPONSE_LANGUAGE;
}

function adjustLanguageSelectWidth(select) {
  if (!select) {
    return;
  }

  const selectedOption = select.options[select.selectedIndex];
  const label = selectedOption?.textContent || "";
  const computedStyle = window.getComputedStyle(select);
  const font = computedStyle.font || `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;
  const textMeasureCanvas =
    adjustLanguageSelectWidth.canvas ||
    (adjustLanguageSelectWidth.canvas = document.createElement("canvas"));
  const context = textMeasureCanvas.getContext("2d");
  if (!context) {
    return;
  }

  context.font = font;
  const textWidth = Math.ceil(context.measureText(label).width);
  const leftPadding = parseFloat(computedStyle.paddingLeft) || 0;
  const rightPadding = parseFloat(computedStyle.paddingRight) || 0;
  const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
  const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;
  const totalWidth = textWidth + leftPadding + rightPadding + borderLeft + borderRight;

  select.style.width = `${Math.ceil(totalWidth)}px`;
}

function createLanguageSelect() {
  const select = document.createElement("select");
  select.className = "vfce-language-select";
  select.setAttribute("aria-label", "LLM response language");
  for (const option of RESPONSE_LANGUAGE_OPTIONS) {
    const optionEl = document.createElement("option");
    optionEl.value = option.code;
    optionEl.textContent = option.label;
    select.appendChild(optionEl);
  }

  chrome.storage.local.get(
    { [RESPONSE_LANGUAGE_KEY]: DEFAULT_RESPONSE_LANGUAGE },
    (items) => {
      select.value = getSafeLanguage(items[RESPONSE_LANGUAGE_KEY]);
      adjustLanguageSelectWidth(select);
    }
  );

  select.addEventListener("change", () => {
    const language = getSafeLanguage(select.value);
    chrome.storage.local.set({ [RESPONSE_LANGUAGE_KEY]: language });
    adjustLanguageSelectWidth(select);
  });

  adjustLanguageSelectWidth(select);
  return select;
}

function createButton(label, mode, title, getSelectedLanguage) {
  const button = document.createElement("button");
  button.className = "vfce-button";
  button.type = "button";
  button.title = title;
  button.innerHTML = `
    <span class="vfce-label">${label}</span>
    <span class="vfce-spinner-slot" aria-hidden="true">
      <span class="vfce-spinner"></span>
    </span>
  `;

  button.addEventListener("click", () => {
    const youtubeUrl = getCurrentVideoUrl();
    const language = getSelectedLanguage();
    const cacheKey = getCacheKey(mode, language);
    const cachedAnalysis = ANALYSIS_CACHE.get(cacheKey);

    if (cachedAnalysis) {
      const cachedTitle = mode === "critical" ? "Critical Review" : "Summary";
      showTextModal(cachedTitle, cachedAnalysis);
      return;
    }

    setRequestInProgress(button, true);

    chrome.runtime.sendMessage(
      {
        type: "FACT_CHECK_REQUEST",
        payload: {
          youtubeUrl,
          mode,
          language,
        },
      },
      (response) => {
        setRequestInProgress(button, false);

        if (chrome.runtime.lastError) {
          showTextModal(
            "Connection Error",
            "Не удалось связаться с background-скриптом расширения."
          );
          return;
        }

        if (!response?.ok) {
          showTextModal("Request Failed", response?.error || "Неизвестная ошибка API.");
          return;
        }

        const resultTitle =
          mode === "critical" ? "Critical Review" : "Summary";

        ANALYSIS_CACHE.set(cacheKey, response.analysis);
        showTextModal(resultTitle, response.analysis);
      }
    );
  });

  return button;
}

function createAskButton(getSelectedLanguage) {
  const button = document.createElement("button");
  button.className = "vfce-button";
  button.type = "button";
  button.title = "Ask about this video";
  button.innerHTML = '<span class="vfce-label">Ask</span>';
  button.addEventListener("click", () => {
    showAskModal(getSelectedLanguage());
  });
  return button;
}

function mountPanel() {
  const comments = document.getElementById("comments");
  if (!comments || document.getElementById(PANEL_ID)) {
    return;
  }

  const panel = document.createElement("section");
  panel.id = PANEL_ID;
  panel.className = "vfce-panel";
  panel.innerHTML = `
    <div class="vfce-branding">
      <img class="vfce-logo" src="${PANEL_ICON_URL}" alt="" />
      <span class="vfce-title">OverallTube</span>
    </div>
    <div class="vfce-actions"></div>
  `;

  const actions = panel.querySelector(".vfce-actions");
  const languageSelect = createLanguageSelect();

  const getSelectedLanguage = () =>
    getSafeLanguage(languageSelect.value || DEFAULT_RESPONSE_LANGUAGE);

  actions?.append(
    languageSelect,
    createButton(
      "Critical Review",
      "critical",
      "Critical Review",
      getSelectedLanguage
    ),
    createButton("Summary", "summary", "Summary", getSelectedLanguage),
    createAskButton(getSelectedLanguage)
  );

  comments.parentElement?.insertBefore(panel, comments);
}

function isWatchPage() {
  return window.location.pathname === "/watch";
}

function removePanel() {
  document.getElementById(PANEL_ID)?.remove();
}

function setupPageObservers() {
  if (isWatchPage()) {
    mountPanel();
  }
  ensureModal();

  const observer = new MutationObserver(() => {
    if (isWatchPage()) {
      mountPanel();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  document.addEventListener("yt-navigate-finish", () => {
    removePanel();
    if (isWatchPage()) {
      mountPanel();
    }
  });
}

setupPageObservers();
