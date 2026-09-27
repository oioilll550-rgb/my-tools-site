document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("feedbackFormButton");
  const status = document.getElementById("feedbackFormStatus");
  if (!button) return;

  const config = window.BENRI_CONFIG || {};
  const url = String(config.feedbackFormUrl || "").trim();

  if (/^https:\/\/(docs\.google\.com\/forms|forms\.gle)\//.test(url)) {
    button.href = url;
    button.target = "_blank";
    button.rel = "noopener noreferrer";
    button.removeAttribute("aria-disabled");
    button.textContent = "Googleフォームを開く";
    if (status) status.textContent = "Googleフォームが別タブで開きます。";
  }
});