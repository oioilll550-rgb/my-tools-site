document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("advertisingContactButton");
  const status = document.getElementById("advertisingContactStatus");
  if (!button) return;

  const config = window.BENRI_CONFIG || {};
  const url = String(config.advertisingContactUrl || "").trim();

  if (!url) {
    button.href = "#";
    button.setAttribute("aria-disabled", "true");
    button.classList.add("is-disabled");
    if (status) status.textContent = "掲載相談の受付先を準備中です。";
    return;
  }

  button.href = url;
  button.target = "_blank";
  button.rel = "noopener noreferrer";
  button.removeAttribute("aria-disabled");
  button.classList.remove("is-disabled");
  if (status) status.textContent = "現在はGitHub Issueで暫定受付しています。";
});
