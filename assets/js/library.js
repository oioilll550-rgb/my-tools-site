document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("libraryHeaderGrid");
  const count = document.getElementById("libraryHeaderCount");
  if (!grid) return;

  try {
    const res = await fetch("assets/header-images/manifest.json", { cache: "no-store" });
    if (!res.ok) throw new Error("manifest");
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];

    grid.innerHTML = "";
    if (count) count.textContent = items.length + "枚";

    if (!items.length) {
      grid.innerHTML = '<p class="notice">ヘッダー画像はまだありません。</p>';
      return;
    }

    items.forEach((item) => {
      const article = document.createElement("article");
      article.className = "library-item";

      const link = document.createElement("a");
      link.href = "../" + item.archive;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      const img = document.createElement("img");
      img.src = "../" + item.archive;
      img.alt = item.title || "ヘッダー画像";
      img.loading = "lazy";
      link.appendChild(img);

      const copy = document.createElement("div");
      copy.className = "library-item-copy";

      const title = document.createElement("strong");
      title.textContent = item.title || "ヘッダー画像";

      const meta = document.createElement("span");
      const bits = [];
      if (item.savedDate) bits.push(item.savedDate.replaceAll("-", "/"));
      if (item.current) bits.push("使用中");
      meta.textContent = bits.join(" ・ ");

      copy.append(title, meta);
      article.append(link, copy);
      grid.appendChild(article);
    });
  } catch (error) {
    grid.innerHTML = '<p class="notice">ヘッダー画像を読み込めませんでした。</p>';
    if (count) count.textContent = "--";
  }
});