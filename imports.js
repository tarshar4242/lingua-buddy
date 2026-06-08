(function () {
  if (typeof handleFileInput === "function") return;

  let activeAudioUrl = null;

  function setImportStatus(message, mode = "idle") {
    const status = document.querySelector("#importStatus");
    if (!status) return;
    status.innerHTML = `<span>${message}</span>`;
    status.classList.toggle("working", mode === "working");
    status.classList.toggle("error", mode === "error");
    status.classList.toggle("done", mode === "done");
  }

  function cleanImportedText(text) {
    return text
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function appendMaterialText(text, label) {
    const input = document.querySelector("#materialInput");
    const current = input.value.trim();
    input.value = current ? `${current}\n\n--- ${label} ---\n${text}` : text;
    input.focus();
  }

  function addImportRecord(kind, name, note) {
    state.imports = state.imports || [];
    state.imports.push({
      id: crypto.randomUUID(),
      kind,
      name,
      note,
      createdAt: Date.now(),
    });
    state.imports = state.imports.slice(-20);
  }

  function mountNativeFileInputs() {
    const pairs = [
      ["pdf", "pdfFile"],
      ["text", "textFile"],
      ["image", "imageFile"],
      ["audio", "audioFile"],
    ];
    pairs.forEach(([kind, inputId]) => {
      const card = document.querySelector(`[data-import='${kind}']`);
      const input = document.querySelector(`#${inputId}`);
      if (!card || !input || card.contains(input)) return;
      input.setAttribute("aria-label", `${card.innerText.trim()} 上傳`);
      card.appendChild(input);
    });
  }

  async function extractTextFromPdf(file) {
    if (!window.pdfjsLib) throw new Error("PDF 套件尚未載入，請確認網路後重試。");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const chunks = [];
    const maxPages = Math.min(pdf.numPages, 40);
    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      setImportStatus(`正在讀 PDF：第 ${pageNumber} / ${maxPages} 頁`, "working");
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      chunks.push(textContent.items.map((item) => item.str).join(" "));
    }
    const suffix = pdf.numPages > maxPages ? `\n\n[只先擷取前 ${maxPages} 頁，完整 PDF 共 ${pdf.numPages} 頁。]` : "";
    return cleanImportedText(chunks.join("\n\n")) + suffix;
  }

  async function extractTextFromImage(file) {
    if (!window.Tesseract?.recognize) throw new Error("OCR 套件尚未載入，請確認網路後重試。");
    const result = await window.Tesseract.recognize(file, "eng+chi_tra", {
      logger: (event) => {
        if (event.status === "recognizing text") {
          setImportStatus(`OCR 辨識中：${Math.round((event.progress || 0) * 100)}%`, "working");
        } else if (event.status) {
          setImportStatus(`OCR 準備中：${event.status}`, "working");
        }
      },
    });
    return cleanImportedText(result.data.text || "");
  }

  async function handleFileInput(input, handler) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      await handler(file);
    } catch (error) {
      console.warn("Import failed", error);
      setImportStatus(error.message || "匯入失敗，請換一個檔案試試。", "error");
      showToast("匯入失敗");
    }
  }

  async function handleTextImport(file) {
    setImportStatus(`正在讀取 ${file.name}`, "working");
    const text = cleanImportedText(await file.text());
    if (!text) throw new Error("沒有讀到文字。");
    appendMaterialText(text, file.name);
    addImportRecord("文字檔", file.name, `已匯入 ${text.length} 個字元`);
    addSession("文字檔匯入");
    saveState();
    setImportStatus(`已匯入文字檔：${file.name}`, "done");
    showToast("文字檔已放入輸入框");
  }

  async function handlePdfImport(file) {
    setImportStatus(`正在讀取 PDF：${file.name}`, "working");
    const text = await extractTextFromPdf(file);
    if (!text) throw new Error("這份 PDF 沒有可抽取文字，可能是掃描圖檔，請改用照片 OCR。");
    appendMaterialText(text, file.name);
    addImportRecord("PDF", file.name, `已抽取 ${text.length} 個字元`);
    addSession("PDF 匯入");
    saveState();
    setImportStatus(`PDF 已抽出文字：${file.name}`, "done");
    showToast("PDF 文字已放入輸入框");
  }

  async function handleImageImport(file) {
    setImportStatus(`正在 OCR：${file.name}`, "working");
    const text = await extractTextFromImage(file);
    if (!text) throw new Error("沒有辨識到文字，請換清楚一點的截圖或照片。");
    appendMaterialText(text, file.name);
    addImportRecord("照片 OCR", file.name, `已辨識 ${text.length} 個字元`);
    addSession("照片 OCR");
    saveState();
    setImportStatus(`OCR 完成：${file.name}`, "done");
    showToast("照片文字已放入輸入框");
  }

  function handleAudioImport(file) {
    if (activeAudioUrl) URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = URL.createObjectURL(file);
    document.querySelector("#audioPreview").src = activeAudioUrl;
    document.querySelector("#audioImport").hidden = false;
    addImportRecord("音檔", file.name, "已匯入音檔，可播放；自動逐字稿需接 Whisper 後端。");
    state.lessons = [
      {
        tag: "Audio",
        title: `音檔：${file.name}`,
        body: "已建立音檔素材。請先播放聽重點，再把逐字稿或重點句貼到輸入框分析。",
      },
      ...state.lessons.filter((lesson) => lesson.tag !== "Audio").slice(0, 4),
    ];
    addSession("音檔匯入");
    saveState();
    setImportStatus(`音檔已匯入：${file.name}。可播放；逐字稿下一階段接 AI 後端。`, "done");
    showToast("音檔已加入素材");
  }

  function bindImportEvents() {
    mountNativeFileInputs();
    document.querySelector("#pdfFile")?.addEventListener("change", (event) => handleFileInput(event.target, handlePdfImport));
    document.querySelector("#textFile")?.addEventListener("change", (event) => handleFileInput(event.target, handleTextImport));
    document.querySelector("#imageFile")?.addEventListener("change", (event) => handleFileInput(event.target, handleImageImport));
    document.querySelector("#audioFile")?.addEventListener("change", (event) => handleFileInput(event.target, handleAudioImport));
  }

  bindImportEvents();
})();
