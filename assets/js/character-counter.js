document.addEventListener("DOMContentLoaded", () => {
  const text = document.getElementById("text");
  const characterCount = document.getElementById("characterCount");
  const noSpaceCount = document.getElementById("noSpaceCount");
  const lineCount = document.getElementById("lineCount");
  const wordCount = document.getElementById("wordCount");
  const message = document.getElementById("message");

  function updateCount() {
    const value = text.value;
    characterCount.textContent = value.length;
    noSpaceCount.textContent = value.replace(/\s/g, "").length;
    lineCount.textContent = value.length === 0 ? 0 : value.split(/\r\n|\r|\n/).length;

    const trimmed = value.trim();
    wordCount.textContent = trimmed === "" ? 0 : trimmed.split(/\s+/).filter(Boolean).length;
  }

  document.getElementById("clearButton").addEventListener("click", () => {
    text.value = "";
    message.textContent = "";
    updateCount();
    text.focus();
  });

  document.getElementById("copyButton").addEventListener("click", async () => {
    if (!text.value) {
      message.textContent = "コピーする文章がありません。";
      return;
    }

    try {
      await navigator.clipboard.writeText(text.value);
      message.textContent = "文章をコピーしました。";
    } catch {
      message.textContent = "コピーできませんでした。ブラウザの権限を確認してください。";
    }
  });

  text.addEventListener("input", updateCount);
  updateCount();
});
