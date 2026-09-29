document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.getElementById("shiroproCharacterBody");
  if (!tableBody) return;

  const searchInput = document.getElementById("shiroproSearch");
  const raritySelect = document.getElementById("shiroproRarity");
  const weaponSelect = document.getElementById("shiroproWeapon");
  const attributeSelect = document.getElementById("shiroproAttribute");
  const bookmarkOnly = document.getElementById("shiroproBookmarkOnly");
  const resetButton = document.getElementById("shiroproReset");
  const countLabel = document.getElementById("shiroproCharacterCount");
  const updatedLabel = document.getElementById("shiroproUpdated");
  const sourceLink = document.getElementById("shiroproSource");

  const bookmarkKey = "benrichan-shiropro-bookmarks-v1";
  let characters = [];
  let sortKey = "no";
  let sortDirection = "asc";

  function loadBookmarks() {
    try {
      const saved = JSON.parse(localStorage.getItem(bookmarkKey) || "[]");
      return new Set(Array.isArray(saved) ? saved.map(String) : []);
    } catch (_) {
      return new Set();
    }
  }

  let bookmarks = loadBookmarks();

  function saveBookmarks() {
    try {
      localStorage.setItem(bookmarkKey, JSON.stringify([...bookmarks]));
    } catch (_) {
      // The table still works even when browser storage is unavailable.
    }
  }

  function normalize(value) {
    return String(value ?? "").trim().toLowerCase();
  }

  function rowId(row) {
    return String(row.id || row.no || row.name);
  }

  const standardWeapons = new Set([
    "刀", "槍", "槌", "盾", "拳", "鎌", "戦棍", "双剣", "ランス",
    "弓", "石弓", "鉄砲", "大砲", "歌舞", "法術", "鈴", "杖", "祓串",
    "本", "投剣", "鞭", "陣貝", "軍船", "茶器", "その他",
    "刀/鉄砲", "鞭/双剣", "ランス/大砲", "戦棍/槌", "鎌/槍"
  ]);

  function normalizeWeapon(value) {
    const weapon = String(value || "").trim();
    if (!weapon) return "";
    return standardWeapons.has(weapon) ? weapon : "その他";
  }

  function normalizeAttribute(value) {
    const attribute = String(value || "").trim();
    return attribute === "地" ? "地獄" : attribute;
  }

  function splitAttributes(row) {
    const raw = String(row.attribute || "").trim();
    if (!raw) return ["", ""];
    const parts = raw.split("/").map((value) => normalizeAttribute(value)).filter(Boolean);
    return [parts[0] || "", parts[1] || ""];
  }

  function attributeValue(row, index) {
    return splitAttributes(row)[index] || "";
  }

  function attributeClass(value) {
    switch (value) {
      case "平": return "attr-flat";
      case "平山": return "attr-flat-hill";
      case "山": return "attr-mountain";
      case "地獄": return "attr-hell";
      case "無": return "attr-none";
      default: return "attr-other";
    }
  }

  function setAttributeBadge(cell, value) {
    if (!value) {
      cell.textContent = "";
      return;
    }
    const badge = document.createElement("span");
    badge.className = "shiropro-attribute-badge " + attributeClass(value);
    badge.textContent = value;
    cell.appendChild(badge);
  }

  function addOption(select, value, label = value) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  function fillFilters() {
    const rarities = [...new Set(characters.map((row) => row.rarity).filter(Number.isFinite))]
      .sort((a, b) => b - a);
    const weapons = [...new Set(
      characters.map((row) => normalizeWeapon(row.weapon)).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "ja"));
    const attributes = [...new Set(
      characters.flatMap((row) => splitAttributes(row)).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "ja"));

    rarities.forEach((value) => addOption(raritySelect, String(value), "★" + value));
    weapons.forEach((value) => addOption(weaponSelect, value));
    attributes.forEach((value) => addOption(attributeSelect, value));
  }

  function compareValues(a, b, key) {
    const av = key === "attribute1"
      ? attributeValue(a, 0)
      : key === "attribute2"
        ? attributeValue(a, 1)
        : key === "weapon"
          ? normalizeWeapon(a.weapon)
          : a[key];
    const bv = key === "attribute1"
      ? attributeValue(b, 0)
      : key === "attribute2"
        ? attributeValue(b, 1)
        : key === "weapon"
          ? normalizeWeapon(b.weapon)
          : b[key];

    if (key === "rarity" || key === "basicCost" || key === "no") {
      const an = av === null || av === "" || av === undefined
        ? Number.POSITIVE_INFINITY
        : Number(av);
      const bn = bv === null || bv === "" || bv === undefined
        ? Number.POSITIVE_INFINITY
        : Number(bv);
      return an - bn;
    }

    return String(av ?? "").localeCompare(String(bv ?? ""), "ja", {
      numeric: true,
      sensitivity: "base"
    });
  }

  function filteredRows() {
    const keyword = normalize(searchInput.value);
    const rarity = raritySelect.value;
    const weapon = weaponSelect.value;
    const attribute = attributeSelect.value;
    const onlyBookmarked = bookmarkOnly.checked;

    const rows = characters.filter((row) => {
      if (keyword && !normalize(row.name).includes(keyword)) return false;
      if (rarity && String(row.rarity) !== rarity) return false;
      if (weapon && normalizeWeapon(row.weapon) !== weapon) return false;
      if (attribute && !splitAttributes(row).includes(attribute)) return false;
      if (onlyBookmarked && !bookmarks.has(rowId(row))) return false;
      return true;
    });

    rows.sort((a, b) => {
      const result = compareValues(a, b, sortKey);
      if (result !== 0) return sortDirection === "asc" ? result : -result;
      return compareValues(a, b, "no");
    });

    return rows;
  }

  function updateSortHeaders() {
    document.querySelectorAll("[data-shiropro-sort]").forEach((button) => {
      const key = button.dataset.shiroproSort;
      const marker = button.querySelector(".shiropro-sort-marker");
      const th = button.closest("th");
      if (key === sortKey) {
        if (marker) marker.textContent = sortDirection === "asc" ? "▲" : "▼";
        if (th) th.setAttribute("aria-sort", sortDirection === "asc" ? "ascending" : "descending");
      } else {
        if (marker) marker.textContent = "";
        if (th) th.setAttribute("aria-sort", "none");
      }
    });
  }

  function render() {
    const rows = filteredRows();
    tableBody.innerHTML = "";

    if (countLabel) {
      countLabel.textContent = "表示 " + rows.length + " / " + characters.length;
    }

    if (!rows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 7;
      td.className = "shiropro-empty";
      td.textContent = "条件に一致するキャラクターがありません。";
      tr.appendChild(td);
      tableBody.appendChild(tr);
      updateSortHeaders();
      return;
    }

    const fragment = document.createDocumentFragment();

    rows.forEach((row) => {
      const tr = document.createElement("tr");
      if (bookmarks.has(rowId(row))) tr.classList.add("is-bookmarked");

      const bookmarkCell = document.createElement("td");
      bookmarkCell.className = "shiropro-bookmark-cell";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.className = "shiropro-bookmark-check";
      check.checked = bookmarks.has(rowId(row));
      check.dataset.characterId = rowId(row);
      check.setAttribute("aria-label", row.name + "をお気に入り登録");
      bookmarkCell.appendChild(check);

      const rarityCell = document.createElement("td");
      rarityCell.textContent = "★" + row.rarity;

      const weaponCell = document.createElement("td");
      weaponCell.textContent = normalizeWeapon(row.weapon) || "—";

      const [attribute1, attribute2] = splitAttributes(row);
      const attribute1Cell = document.createElement("td");
      setAttributeBadge(attribute1Cell, attribute1 || "—");

      const attribute2Cell = document.createElement("td");
      setAttributeBadge(attribute2Cell, attribute2);

      const nameCell = document.createElement("td");
      const link = document.createElement("a");
      link.href = row.wikiUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = row.name;
      nameCell.appendChild(link);

      const costCell = document.createElement("td");
      costCell.className = "shiropro-cost";
      costCell.textContent = Number.isFinite(row.basicCost) ? String(row.basicCost) : "—";

      tr.append(
        bookmarkCell,
        rarityCell,
        weaponCell,
        attribute1Cell,
        attribute2Cell,
        nameCell,
        costCell
      );
      fragment.appendChild(tr);
    });

    tableBody.appendChild(fragment);
    updateSortHeaders();
  }

  tableBody.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.classList.contains("shiropro-bookmark-check")) {
      return;
    }

    const id = String(target.dataset.characterId || "");
    if (!id) return;

    if (target.checked) bookmarks.add(id);
    else bookmarks.delete(id);

    saveBookmarks();
    render();
  });

  [searchInput, raritySelect, weaponSelect, attributeSelect, bookmarkOnly].forEach((element) => {
    element.addEventListener(element === searchInput ? "input" : "change", render);
  });

  resetButton.addEventListener("click", () => {
    searchInput.value = "";
    raritySelect.value = "";
    weaponSelect.value = "";
    attributeSelect.value = "";
    bookmarkOnly.checked = false;
    sortKey = "no";
    sortDirection = "asc";
    render();
  });

  document.querySelectorAll("[data-shiropro-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.shiroproSort;
      if (!key) return;

      if (sortKey === key) {
        sortDirection = sortDirection === "asc" ? "desc" : "asc";
      } else {
        sortKey = key;
        sortDirection = key === "rarity" ? "desc" : "asc";
      }
      render();
    });
  });

  try {
    const response = await fetch("../../../assets/data/shiropro-characters.json", { cache: "no-store" });
    if (!response.ok) throw new Error("character data");
    const data = await response.json();

    characters = Array.isArray(data.characters) ? data.characters : [];
    fillFilters();

    if (sourceLink && data.source) sourceLink.href = data.source;
    if (updatedLabel && data.updatedAtJst) {
      const date = data.updatedAtJst.slice(0, 10).replaceAll("-", "/");
      updatedLabel.textContent = "更新 " + date;
    }

    render();
  } catch (error) {
    tableBody.innerHTML = '<tr><td colspan="7" class="shiropro-empty">キャラクターデータを読み込めませんでした。</td></tr>';
    if (countLabel) countLabel.textContent = "--";
  }
});