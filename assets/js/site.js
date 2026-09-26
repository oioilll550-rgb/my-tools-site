const SITE_TOOLS = [
  {
    name: "文字数カウンター",
    url: "tools/character-counter.html",
    keywords: ["文字数", "カウント", "文章", "行数", "単語数"]
  },
  {
    name: "全角・半角変換",
    url: "tools/zenkaku-hankaku.html",
    keywords: ["全角", "半角", "変換", "英数字", "記号"]
  }
];

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[・\s]/g, "");
}

function searchTools() {
  const input = document.getElementById("toolSearch");
  const results = document.getElementById("searchResults");
  if (!input || !results) return;

  const keyword = normalizeSearchText(input.value);
  results.innerHTML = "";

  if (!keyword) return;

  const matched = SITE_TOOLS.filter((tool) => {
    const target = [tool.name, ...(tool.keywords || [])]
      .map(normalizeSearchText)
      .join(" ");
    return target.includes(keyword);
  });

  if (matched.length === 0) {
    const p = document.createElement("p");
    p.textContent = "該当するツールがありません。";
    results.appendChild(p);
    return;
  }

  matched.forEach((tool) => {
    const link = document.createElement("a");
    link.href = tool.url;
    link.textContent = tool.name;
    link.className = "result-link";
    results.appendChild(link);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("toolSearch");
  if (input) {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") searchTools();
    });
  }

  const year = document.querySelector("[data-current-year]");
  if (year) year.textContent = new Date().getFullYear();
});
