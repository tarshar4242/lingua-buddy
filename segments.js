(function () {
  function splitIntoPracticeChunks(text) {
    const clean = text.replace(/\r/g, "").replace(/\s+/g, " ").trim();
    if (!clean) return [];
    const sentences = clean
      .split(/(?<=[.!?。！？])\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const chunks = [];
    let current = "";
    sentences.forEach((sentence) => {
      const next = current ? `${current} ${sentence}` : sentence;
      if (next.length > 320 && current) {
        chunks.push(current);
        current = sentence;
      } else {
        current = next;
      }
    });
    if (current) chunks.push(current);

    if (chunks.length <= 1 && clean.length > 420) {
      const words = clean.split(" ");
      const fallback = [];
      for (let index = 0; index < words.length; index += 50) {
        fallback.push(words.slice(index, index + 50).join(" "));
      }
      return fallback.slice(0, 10);
    }
    return chunks.slice(0, 10);
  }

  function lessonExcerpt(text, limit = 210) {
    return text.length > limit ? `${text.slice(0, limit)}...` : text;
  }

  function practiceSentenceFromChunk(chunk) {
    const options = chunk
      .split(/[.!?。！？]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 12);
    return pickBestSentence(options) || options[0] || chunk.slice(0, 140);
  }

  window.createLessonsFromMaterial = function createSegmentedLessons(raw) {
    const text = raw.trim();
    if (!text) return starterLessons;

    const chunks = splitIntoPracticeChunks(text);
    const chunkSentences = chunks.map(practiceSentenceFromChunk).filter(Boolean);
    const keywords = extractVocabulary(text, state.sourceType);
    state.sentences = chunkSentences.length ? chunkSentences : defaultSentences;
    selectedSentence = state.sentences[0];
    mergeVocabulary(keywords);

    const overview = [
      {
        tag: sourceLabel(state.sourceType),
        title: `已切成 ${chunks.length || 1} 小段`,
        body: "每次只練一小段：先看懂主旨，再跟讀一句，最後把不熟詞加入複習。",
      },
      {
        tag: "Vocab",
        title: "本篇關鍵詞",
        body: keywords.length ? keywords.map((item) => item.word).join(" · ") : "沒有抓到明顯關鍵詞，請貼更長一段。",
      },
    ];

    const segmentLessons = chunks.map((chunk, index) => ({
      id: `segment-${Date.now()}-${index}`,
      tag: `段落 ${index + 1}/${chunks.length}`,
      title: `第 ${index + 1} 小段練習`,
      body: lessonExcerpt(chunk),
      practiceText: chunk,
      sentence: practiceSentenceFromChunk(chunk),
    }));

    return [...overview, ...segmentLessons];
  };

  window.renderLessons = function renderSegmentLessons() {
    const list = document.querySelector("#lessonList");
    if (!list) return;
    list.innerHTML = state.lessons
      .map(
        (lesson) => `
          <article class="lesson-item ${lesson.practiceText ? "segment-lesson" : ""}">
            <span class="lesson-tag">${lesson.tag}</span>
            <strong>${lesson.title}</strong>
            <p>${lesson.body}</p>
            ${lesson.practiceText ? `<button class="ghost-action segment-practice" data-segment-id="${lesson.id}">練這段</button>` : ""}
          </article>
        `
      )
      .join("");

    list.querySelectorAll("[data-segment-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const lesson = state.lessons.find((item) => item.id === button.dataset.segmentId);
        if (!lesson) return;
        document.querySelector("#materialInput").value = lesson.practiceText;
        selectedSentence = lesson.sentence || practiceSentenceFromChunk(lesson.practiceText);
        state.sentences = [selectedSentence, ...state.sentences.filter((item) => item !== selectedSentence)].slice(0, 8);
        addSession("段落練習");
        saveState();
        setView("speaking");
        showToast("已切到這一小段，開始跟讀");
      });
    });
  };

  const oldBuildButton = document.querySelector("#buildLesson");
  if (oldBuildButton && !oldBuildButton.dataset.segmentPatch) {
    oldBuildButton.dataset.segmentPatch = "1";
    oldBuildButton.addEventListener("click", () => {
      setTimeout(() => {
        state.lessons = window.createLessonsFromMaterial(document.querySelector("#materialInput").value);
        saveState();
      }, 0);
    });
  }

  window.renderLessons();
})();
