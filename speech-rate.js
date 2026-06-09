(function () {
  const rateKey = "lingua-buddy-speech-rate";
  const defaultRate = "0.80";

  function rateLabel(rate) {
    if (rate <= 0.7) return "慢速聽懂";
    if (rate <= 0.9) return "跟讀練習";
    if (rate <= 1.05) return "正常速度";
    return "快速反應";
  }

  function savedRate() {
    const value = Number(localStorage.getItem(rateKey) || defaultRate);
    return Number.isFinite(value) ? Math.min(1.25, Math.max(0.55, value)) : Number(defaultRate);
  }

  function updateRateText(rate) {
    const label = document.querySelector("#speechRateValue");
    if (!label) return;
    label.textContent = `${rate.toFixed(2)}x · ${rateLabel(rate)}`;
  }

  function speakAtRate(text) {
    if (!("speechSynthesis" in window)) {
      showToast("這個瀏覽器不支援語音播放");
      return;
    }

    const rate = savedRate();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = rate;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }

  function mountRateControl() {
    const sentenceCard = document.querySelector(".sentence-card");
    if (!sentenceCard || document.querySelector("#speechRate")) return;

    const currentRate = savedRate();
    const panel = document.createElement("div");
    panel.className = "speech-rate-panel";
    panel.innerHTML = `
      <div class="speech-rate-head">
        <span>播放語速</span>
        <strong id="speechRateValue"></strong>
      </div>
      <input id="speechRate" type="range" min="0.55" max="1.25" step="0.05" value="${currentRate}" aria-label="調整英文播放語速" />
      <div class="speech-rate-presets" aria-label="語速快速選擇">
        <button type="button" data-rate="0.65">慢</button>
        <button type="button" data-rate="0.85">練</button>
        <button type="button" data-rate="1.05">正常</button>
      </div>
    `;
    sentenceCard.insertAdjacentElement("afterend", panel);

    const slider = panel.querySelector("#speechRate");
    updateRateText(currentRate);
    slider.addEventListener("input", () => {
      const rate = Number(slider.value);
      localStorage.setItem(rateKey, String(rate));
      updateRateText(rate);
    });

    panel.querySelectorAll("[data-rate]").forEach((button) => {
      button.addEventListener("click", () => {
        const rate = Number(button.dataset.rate);
        slider.value = String(rate);
        localStorage.setItem(rateKey, String(rate));
        updateRateText(rate);
        speakAtRate(selectedSentence);
      });
    });
  }

  function replaceSpeakButton() {
    const oldButton = document.querySelector("#speakSentence");
    if (!oldButton || oldButton.dataset.rateButton === "1") return;

    const newButton = oldButton.cloneNode(true);
    newButton.dataset.rateButton = "1";
    oldButton.replaceWith(newButton);
    newButton.addEventListener("click", () => speakAtRate(selectedSentence));
  }

  function injectStyles() {
    if (document.querySelector("#speechRateStyles")) return;
    const style = document.createElement("style");
    style.id = "speechRateStyles";
    style.textContent = `
      .speech-rate-panel {
        margin-top: 14px;
        padding: 16px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #f5faf8;
      }

      .speech-rate-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        margin-bottom: 10px;
      }

      .speech-rate-head span {
        color: var(--muted);
        font-weight: 800;
      }

      .speech-rate-head strong {
        color: var(--mint-dark);
        white-space: nowrap;
      }

      #speechRate {
        width: 100%;
        min-height: 32px;
        padding: 0;
        accent-color: var(--mint-dark);
      }

      .speech-rate-presets {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-top: 10px;
      }

      .speech-rate-presets button {
        min-height: 40px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
        color: var(--ink);
        font-weight: 800;
      }

      @media (max-width: 640px) {
        .speech-rate-head {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    `;
    document.head.appendChild(style);
  }

  window.speakText = speakAtRate;
  injectStyles();
  mountRateControl();
  replaceSpeakButton();
})();
