document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("inputText");
  const output = document.getElementById("outputText");
  const message = document.getElementById("message");

  document.getElementById("halfButton").addEventListener("click", () => {
    output.value = input.value
      .replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
      .replace(/　/g, " ");
    message.textContent = "半角に変換しました。";
  });

  document.getElementById("fullButton").addEventListener("click", () => {
    output.value = input.value
      .replace(/[!-~]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0xFEE0))
      .replace(/ /g, "　");
    message.textContent = "全角に変換しました。";
  });

  document.getElementById("clearButton").addEventListener("click", () => {
    input.value = "";
    output.value = "";
    message.textContent = "";
    input.focus();
  });

  document.getElementById("copyButton").addEventListener("click", async () => {
    if (!output.value) {
      message.textContent = "コピーする変換結果がありません。";
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      message.textContent = "変換結果をコピーしました。";
    } catch {
      message.textContent = "コピーできませんでした。ブラウザの権限を確認してください。";
    }
  });
});
