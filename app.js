const goals = [
  {
    id: "paper",
    name: "讀論文",
    desc: "abstract、method、result、discussion",
    level: "Academic",
  },
  {
    id: "talk",
    name: "做英文演講",
    desc: "開場、轉場、解釋圖表、結論",
    level: "Speaking",
  },
  {
    id: "web",
    name: "讀英文網頁",
    desc: "文件、新聞、部落格、產品頁",
    level: "Web",
  },
  {
    id: "slides",
    name: "簡報詞彙",
    desc: "bullet、圖表標題、speaker notes",
    level: "Talk",
  },
  {
    id: "exam",
    name: "考試輔助",
    desc: "TOEFL、IELTS、全民英檢詞彙",
    level: "Exam",
  },
  {
    id: "custom",
    name: "自由輸入",
    desc: "任何你想讀懂或講清楚的內容",
    level: "Custom",
  },
];

const defaultSentences = [
  "This paper investigates the relationship between model performance and training data quality.",
  "The results suggest that the proposed method improves accuracy under limited supervision.",
  "In this talk, I will briefly introduce the background, method, and key findings.",
  "This website explains the main features and limitations of the framework.",
  "The article is difficult, but I can understand the main idea and key terms.",
];

const starterLessons = [
  {
    tag: "Input",
    title: "貼上你要讀的內容",
    body: "可以是 paper abstract、演講稿、網頁段落或中文主題。",
  },
  {
    tag: "Vocab",
    title: "抓出關鍵詞彙",
    body: "系統會先抓長詞、學術詞、轉折詞與高頻詞組。",
  },
  {
    tag: "Speak",
    title: "挑一句練演講口說",
    body: "把重要句子播放、跟讀，再把不熟的字存進複習。",
  },
];

const storeKey = "lingua-buddy-research-v1";
const state = loadState();
let selectedSentence = state.sentences[0] || defaultSentences[0];
let lastFeedback = null;
let toastTimer = null;
let cloudClient = null;
let cloudSyncTimer = null;
let cloudReady = false;
let isApplyingCloudState = false;

function defaultState() {
  return {
    goal: null,
    lessons: starterLessons,
    mistakes: [],
    vocabulary: [],
    sessions: [],
    sentences: defaultSentences,
    sourceType: "paper",
    streak: 0,
    lastPracticeDate: null,
    updatedAt: 0,
  };
}

function hydrateState(raw) {
  return { ...defaultState(), ...raw };
}

function loadState() {
  try {
    return hydrateState(JSON.parse(localStorage.getItem(storeKey) || "{}"));
  } catch {
    return defaultState();
  }
}

function saveLocalState() {
  localStorage.setItem(storeKey, JSON.stringify(state));
}

function saveState() {
  state.updatedAt = Date.now();
  saveLocalState();
  renderAll();
  queueCloudSync();
}

function setSyncStatus(message, mode = "local") {
  const el = document.querySelector("#syncStatus");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("cloud", mode === "cloud");
  el.classList.toggle("error", mode === "error");
}

function getSupabaseConfig() {
  return window.LINGUA_BUDDY_SUPABASE || {};
}

function isSupabaseConfigured() {
  const config = getSupabaseConfig();
  return Boolean(config.enabled && config.url && config.anonKey && config.ownerId);
}

function queueCloudSync() {
  if (!cloudReady || isApplyingCloudState) return;
  clearTimeout(cloudSyncTimer);
  setSyncStatus("雲端同步中", "cloud");
  cloudSyncTimer = setTimeout(pushCloudState, 650);
}

async function initCloudSync() {
  if (!isSupabaseConfigured()) {
    setSyncStatus("本機保存", "local");
    return;
  }
  if (!window.supabase?.createClient) {
    setSyncStatus("雲端套件未載入", "error");
    return;
  }

  const config = getSupabaseConfig();
  cloudClient = window.supabase.createClient(config.url, config.anonKey);
  cloudReady = true;
  setSyncStatus("雲端同步中", "cloud");

  try {
    const { data, error } = await cloudClient
      .from("learning_states")
      .select("state, updated_at")
      .eq("owner_id", config.ownerId)
      .maybeSingle();
    if (error) throw error;

    if (data?.state && Number(data.state.updatedAt || 0) > Number(state.updatedAt || 0)) {
      isApplyingCloudState = true;
      Object.assign(state, hydrateState(data.state));
      selectedSentence = state.sentences[0] || defaultSentences[0];
      saveLocalState();
      renderAll();
      isApplyingCloudState = false;
      setSyncStatus("雲端已載入", "cloud");
      return;
    }

    await pushCloudState();
  } catch (error) {
    console.warn("Supabase sync failed", error);
    setSyncStatus("雲端連線失敗", "error");
  }
}

async function pushCloudState() {
  if (!cloudReady || !cloudClient) return;
  const config = getSupabaseConfig();
  try {
    const { error } = await cloudClient.from("learning_states").upsert({
      owner_id: config.ownerId,
      state,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    setSyncStatus("雲端已同步", "cloud");
  } catch (error) {
    console.warn("Supabase push failed", error);
    setSyncStatus("雲端同步失敗", "error");
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function setView(viewId) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewId);
  });
  const label = document.querySelector(`.nav-item[data-view="${viewId}"]`)?.textContent || "首頁";
  document.querySelector("#viewTitle").textContent = label;
}

function renderGoals() {
  const grid = document.querySelector("#goalGrid");
  grid.innerHTML = goals
    .map(
      (goal) => `
        <button class="goal-card ${state.goal === goal.id ? "active" : ""}" data-goal="${goal.id}">
          <strong>${goal.name}</strong>
          <span>${goal.level} · ${goal.desc}</span>
        </button>
      `
    )
    .join("");

  grid.querySelectorAll(".goal-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.goal = card.dataset.goal;
      saveState();
      showToast("已更新學習目標");
    });
  });
}

function renderDashboard() {
  const activeGoal = goals.find((goal) => goal.id === state.goal);
  document.querySelector("#currentGoal").textContent = activeGoal
    ? `${activeGoal.name} · ${activeGoal.level}`
    : "尚未設定目標";
  document.querySelector("#todayStatus").textContent = activeGoal ? "可以貼內容分析" : "先選場景開始";
  document.querySelector("#streakCount").textContent = state.streak || 0;
  document.querySelector("#metricSessions").textContent = state.sessions.length;
  document.querySelector("#metricVocab").textContent = state.vocabulary.length;
  document.querySelector("#metricReviews").textContent = getReviewItems().length;

  const recent = state.sessions.slice(-4).reverse();
  document.querySelector("#timeline").innerHTML = recent.length
    ? recent
        .map(
          (item) => `
            <div class="timeline-item">
              <strong>${item.type}</strong>
              <span>${item.date}</span>
            </div>
          `
        )
        .join("")
    : `<div class="timeline-item"><strong>尚無紀錄</strong><span>完成一次練習後會出現在這裡</span></div>`;
}

function renderSourceTabs() {
  document.querySelectorAll(".source-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.source === state.sourceType);
  });
}

function renderLessons() {
  document.querySelector("#lessonList").innerHTML = state.lessons
    .map(
      (lesson) => `
        <article class="lesson-item">
          <span class="lesson-tag">${lesson.tag}</span>
          <strong>${lesson.title}</strong>
          <p>${lesson.body}</p>
        </article>
      `
    )
    .join("");
}

function renderVocabulary() {
  const list = document.querySelector("#vocabList");
  if (!list) return;
  list.innerHTML = state.vocabulary.length
    ? state.vocabulary
        .slice()
        .reverse()
        .map(
          (item) => `
            <article class="vocab-card">
              <div>
                <span class="lesson-tag">${item.source}</span>
                <strong>${item.word}</strong>
                <p>${item.note}</p>
              </div>
              <button class="ghost-action" data-vocab="${item.id}">加入複習</button>
            </article>
          `
        )
        .join("")
    : `<article class="vocab-card"><div><strong>還沒有詞彙</strong><p>到「輸入」貼上論文、演講稿或網頁內容，系統會幫你抓詞。</p></div></article>`;

  list.querySelectorAll("[data-vocab]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.vocabulary.find((word) => word.id === button.dataset.vocab);
      if (!item) return;
      addMistake("詞彙", item.word, item.note);
      saveState();
      showToast("已加入複習");
    });
  });
}

function renderSpeaking() {
  document.querySelector("#targetSentence").textContent = selectedSentence;
}

function getReviewItems() {
  const now = Date.now();
  return state.mistakes
    .map((item) => {
      const ageHours = (now - item.createdAt) / 36e5;
      const priority = item.reviewed ? ageHours / 48 : ageHours / 12 + 1;
      return { ...item, priority };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8);
}

function renderReviews() {
  const items = getReviewItems();
  document.querySelector("#reviewList").innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="review-item">
              <span class="mistake-tag">${item.kind}</span>
              <strong>${item.title}</strong>
              <p>${item.note}</p>
              <button class="ghost-action" data-review="${item.id}">完成複習</button>
            </article>
          `
        )
        .join("")
    : `<article class="review-item"><strong>今天沒有待複習</strong><p>完成口說練習或新增錯題後，這裡會自動安排。</p></article>`;

  document.querySelectorAll("[data-review]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.mistakes.find((mistake) => mistake.id === button.dataset.review);
      if (item) item.reviewed = true;
      addSession("複習完成");
      saveState();
      showToast("複習完成，已更新紀錄");
    });
  });
}

function renderMistakes() {
  document.querySelector("#mistakeList").innerHTML = state.mistakes.length
    ? state.mistakes
        .slice()
        .reverse()
        .map(
          (item) => `
            <article class="mistake-item">
              <span class="mistake-tag">${item.kind}</span>
              <strong>${item.title}</strong>
              <p>${item.note}</p>
            </article>
          `
        )
        .join("")
    : `<article class="mistake-item"><strong>錯題本是空的</strong><p>口說比對失誤或手動新增的內容會放在這裡。</p></article>`;
}

function renderAll() {
  renderGoals();
  renderDashboard();
  renderSourceTabs();
  renderLessons();
  renderVocabulary();
  renderSpeaking();
  renderReviews();
  renderMistakes();
}

function addSession(type) {
  const today = todayKey();
  if (state.lastPracticeDate !== today) {
    state.streak = state.lastPracticeDate ? state.streak + 1 : 1;
    state.lastPracticeDate = today;
  }
  state.sessions.push({ type, date: new Date().toLocaleString("zh-TW") });
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compareSpeech(target, transcript) {
  const targetWords = normalizeText(target).split(" ").filter(Boolean);
  const spokenWords = normalizeText(transcript).split(" ").filter(Boolean);
  const matched = targetWords.filter((word) => spokenWords.includes(word));
  const missing = targetWords.filter((word) => !spokenWords.includes(word));
  const extra = spokenWords.filter((word) => !targetWords.includes(word));
  const score = targetWords.length ? Math.round((matched.length / targetWords.length) * 100) : 0;
  return { score, missing, extra };
}

function updateFeedback(result, transcript) {
  const circle = document.querySelector("#scoreCircle");
  const offset = 314 - (314 * result.score) / 100;
  circle.style.strokeDashoffset = String(offset);
  document.querySelector("#scoreText").textContent = result.score;

  const feedback = [];
  if (result.score >= 85) {
    feedback.push(["很接近", "句子完整度很好，下一步練速度與語調。"]);
  } else if (result.score >= 55) {
    feedback.push(["可以更清楚", `漏掉或辨識不到：${result.missing.join(", ") || "無"}`]);
  } else {
    feedback.push(["先放慢", "建議一句拆成兩段，先把關鍵字念清楚。"]);
  }
  if (result.extra.length) {
    feedback.push(["多出的字", result.extra.slice(0, 8).join(", ")]);
  }

  document.querySelector("#feedbackList").innerHTML = feedback
    .map(
      ([title, body]) => `
        <article class="feedback-item">
          <strong>${title}</strong>
          <p>${body}</p>
        </article>
      `
    )
    .join("");

  lastFeedback = {
    title: selectedSentence,
    note: `辨識結果：${transcript}。分數：${result.score}。漏掉：${result.missing.join(", ") || "無"}`,
  };
}

function createLessonsFromMaterial(raw) {
  const text = raw.trim();
  if (!text) return starterLessons;
  const sentences = text
    .replace(/\n+/g, " ")
    .split(/[.!?。！？]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 8)
    .slice(0, 5);

  const firstSentence = pickBestSentence(sentences) || "I want to understand this material step by step";
  const keywords = extractVocabulary(text, state.sourceType);

  state.sentences = sentences.length ? sentences : defaultSentences;
  selectedSentence = state.sentences[0];
  mergeVocabulary(keywords);

  return [
    {
      tag: sourceLabel(state.sourceType),
      title: "內容快照",
      body: text.slice(0, 120) + (text.length > 120 ? "..." : ""),
    },
    {
      tag: "Vocab",
      title: "新增詞彙",
      body: keywords.length ? keywords.map((item) => item.word).join(" · ") : "沒有抓到明顯關鍵詞，請貼更長一段。",
    },
    {
      tag: "Summary",
      title: "先抓主旨",
      body: buildReadingPrompt(state.sourceType),
    },
    {
      tag: "Speaking",
      title: "演講跟讀句",
      body: firstSentence,
    },
    {
      tag: "Review",
      title: "複習任務",
      body: "選 5 個不熟的詞放入複習，明天先看中文提示再回想英文。",
    },
  ];
}

function sourceLabel(source) {
  const labels = { paper: "Paper", talk: "Talk", web: "Web" };
  return labels[source] || "Input";
}

function buildReadingPrompt(source) {
  if (source === "paper") return "用一句中文說明研究問題、方法、結果各是什麼。";
  if (source === "talk") return "把這段改成你可以在台上說的 20 秒英文摘要。";
  if (source === "web") return "抓出這頁最重要的功能、限制或操作步驟。";
  return "先用中文確認意思，再挑一句英文跟讀。";
}

function pickBestSentence(sentences) {
  return sentences
    .slice()
    .sort((a, b) => scoreSentence(b) - scoreSentence(a))[0];
}

function scoreSentence(sentence) {
  const lower = sentence.toLowerCase();
  const academicHits = ["result", "method", "suggest", "propose", "indicate", "framework", "analysis"].filter((word) =>
    lower.includes(word)
  ).length;
  return sentence.length + academicHits * 40;
}

function extractVocabulary(text, source) {
  const glossary = {
    analysis: "分析",
    approach: "方法、取徑",
    assessment: "評估",
    combines: "結合",
    contribution: "貢獻",
    dataset: "資料集",
    document: "文件",
    evidence: "證據",
    experimental: "實驗的",
    framework: "框架",
    generation: "生成",
    hallucination: "幻覺、錯誤生成",
    implementation: "實作",
    investigates: "研究、探討",
    methodology: "方法論",
    performance: "表現",
    proposed: "提出的",
    question: "問題",
    reliability: "可靠性",
    response: "回應",
    results: "結果",
    retrieval: "檢索",
    significant: "顯著的",
    therefore: "因此",
  };
  const stopWords = new Set([
    "about",
    "after",
    "again",
    "also",
    "because",
    "between",
    "could",
    "first",
    "from",
    "have",
    "into",
    "more",
    "other",
    "please",
    "should",
    "than",
    "that",
    "their",
    "there",
    "these",
    "this",
    "those",
    "through",
    "under",
    "using",
    "which",
    "would",
    "with",
  ]);
  const academicWords = new Set([
    "analysis",
    "approach",
    "assessment",
    "constraint",
    "contribution",
    "dataset",
    "evaluate",
    "evidence",
    "framework",
    "hypothesis",
    "implementation",
    "methodology",
    "performance",
    "proposed",
    "significant",
    "therefore",
  ]);

  const counts = new Map();
  normalizeText(text)
    .split(" ")
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter((word) => word.length >= 6 && !stopWords.has(word))
    .forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));

  return [...counts.entries()]
    .map(([word, count]) => ({
      id: crypto.randomUUID(),
      word,
      source: sourceLabel(source),
      score: count * 3 + word.length + (academicWords.has(word) ? 12 : 0),
      note: buildVocabNote(word, count, source, academicWords.has(word), glossary[word]),
      createdAt: Date.now(),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

function buildVocabNote(word, count, source, isAcademic, gloss) {
  const sourceText = source === "paper" ? "論文" : source === "talk" ? "演講" : "網頁";
  const type = isAcademic ? "常見學術詞" : word.length >= 10 ? "長詞，建議拆音節練" : "值得累積的閱讀詞";
  const meaning = gloss ? `中文提示：${gloss}。` : "";
  return `${sourceText}內容出現 ${count} 次。${meaning}${type}。先記意思，再練用一句話解釋。`;
}

function mergeVocabulary(items) {
  const existing = new Map(state.vocabulary.map((item) => [item.word, item]));
  items.forEach((item) => {
    const current = existing.get(item.word);
    if (current) {
      current.note = item.note;
      current.source = item.source;
    } else {
      state.vocabulary.push(item);
    }
  });
}

function addMistake(kind, title, note) {
  state.mistakes.push({
    id: crypto.randomUUID(),
    kind,
    title,
    note,
    reviewed: false,
    createdAt: Date.now(),
  });
}

function speakText(text) {
  if (!("speechSynthesis" in window)) {
    showToast("這個瀏覽器不支援語音播放");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.78;
  window.speechSynthesis.speak(utterance);
}

function startRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast("這個瀏覽器不支援語音辨識，建議用 Chrome 測試");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const button = document.querySelector("#recordSpeech");
  button.textContent = "聆聽中...";
  button.disabled = true;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.querySelector("#transcriptText").textContent = transcript;
    const result = compareSpeech(selectedSentence, transcript);
    updateFeedback(result, transcript);
    addSession("口說練習");
    saveState();
  };

  recognition.onerror = () => showToast("沒有收到清楚的聲音，請再試一次");
  recognition.onend = () => {
    button.textContent = "開始跟讀";
    button.disabled = false;
  };

  recognition.start();
}

function bindEvents() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  document.querySelector("#startToday").addEventListener("click", () => setView("materials"));
  document.querySelector("#speakSentence").addEventListener("click", () => speakText(selectedSentence));
  document.querySelector("#recordSpeech").addEventListener("click", startRecognition);

  document.querySelector("#nextSentence").addEventListener("click", () => {
    const currentIndex = state.sentences.indexOf(selectedSentence);
    selectedSentence = state.sentences[(currentIndex + 1) % state.sentences.length];
    document.querySelector("#transcriptText").textContent = "尚未錄音";
    document.querySelector("#feedbackList").innerHTML = "";
    document.querySelector("#scoreText").textContent = "--";
    document.querySelector("#scoreCircle").style.strokeDashoffset = "314";
    renderSpeaking();
  });

  document.querySelector("#loadSample").addEventListener("click", () => {
    document.querySelector("#materialInput").value =
      "This paper investigates how retrieval augmented generation improves the reliability of question answering systems. The proposed framework combines document retrieval, evidence selection, and response generation. Experimental results suggest that grounding responses in relevant passages can reduce hallucination and improve user trust.";
  });

  document.querySelector("#buildLesson").addEventListener("click", () => {
    state.lessons = createLessonsFromMaterial(document.querySelector("#materialInput").value);
    addSession("內容分析");
    saveState();
    showToast("已分析內容並加入詞彙");
  });

  document.querySelectorAll(".source-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.sourceType = button.dataset.source;
      document.querySelectorAll(".source-tab").forEach((tab) => tab.classList.toggle("active", tab === button));
      saveState();
    });
  });

  document.querySelector("#saveSpeakingMistake").addEventListener("click", () => {
    if (!lastFeedback) {
      showToast("請先完成一次跟讀");
      return;
    }
    addMistake("口說", lastFeedback.title, lastFeedback.note);
    saveState();
    showToast("已存入口說錯題");
  });

  document.querySelector("#addManualMistake").addEventListener("click", () => {
    const input = document.querySelector("#manualMistake");
    const value = input.value.trim();
    if (!value) return;
    addMistake("手動", value, "手動新增，需要定期複習。");
    input.value = "";
    saveState();
    showToast("已新增錯題");
  });
}

bindEvents();
renderAll();
initCloudSync();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
