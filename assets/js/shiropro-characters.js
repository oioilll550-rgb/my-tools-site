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
  const bookmarkSummary = document.getElementById("shiroproBookmarkSummary");
  const bookmarkSummaryCount = document.getElementById("shiroproBookmarkSummaryCount");

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
      // Browser storage is optional.
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
      case "水": return "attr-water";
      case "地獄": return "attr-hell";
      case "無": return "attr-none";
      default: return "attr-other";
    }
  }

  function attributeColor(value) {
    switch (value) {
      case "平": return "#1f5f3f";
      case "平山": return "#7fbf3f";
      case "山": return "#8a5a2b";
      case "水": return "#8ed8f8";
      case "地獄": return "#6b3fa0";
      case "無": return "#a7adb4";
      default: return "#e88bb5";
    }
  }

  function setNameAttributeBackground(cell, row) {
    const [attribute1, attribute2] = splitAttributes(row);
    const color1 = attributeColor(attribute1 || "その他");

    cell.classList.add("shiropro-name-cell");
    cell.dataset.attribute1 = attribute1 || "";
    cell.dataset.attribute2 = attribute2 || "";

    if (attribute2) {
      const color2 = attributeColor(attribute2);
      cell.style.background =
        "linear-gradient(90deg," +
        color1 + " 0%," +
        color1 + " 50%," +
        color2 + " 50%," +
        color2 + " 100%)";
    } else {
      cell.style.background = color1;
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

    if (key === "rarity" || key === "no") {
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

  function setSkillCell(cell, skill) {
    cell.className = "shiropro-skill-cell";
    if (!skill || !skill.effect) {
      cell.textContent = "—";
      return;
    }

    const head = document.createElement("div");
    head.className = "shiropro-skill-head";

    if (skill.stage && skill.stage !== "無印") {
      const stage = document.createElement("span");
      stage.className = "shiropro-skill-stage";
      stage.textContent = skill.stage;
      head.appendChild(stage);
    }

    if (skill.name) {
      const name = document.createElement("strong");
      name.textContent = skill.name;
      head.appendChild(name);
    }

    const effect = document.createElement("div");
    effect.className = "shiropro-skill-effect";
    effect.textContent = skill.effect;

    cell.append(head, effect);
  }

  function additiveParts(effectText) {
    const text = String(effectText || "")
      .replace(/（[^）]*）/g, "")
      .replace(/\([^)]*\)/g, "");
    const parts = [];
    const pattern = /(.+?)(?:が|を)(\d+(?:\.\d+)?)(%|秒)?(上昇|低下|短縮|延長|増加|軽減)/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      let target = match[1]
        .replace(/^.*?所持しているだけで/, "")
        .replace(/^[、。\s]+/, "")
        .replace(/^(さらに|また|かつ)/, "")
        .trim();

      if (!target) continue;

      parts.push({
        target,
        value: Number(match[2]),
        unit: match[3] || "",
        action: match[4]
      });
    }

    return parts;
  }

  function renderBookmarkSummary() {
    if (!bookmarkSummary || !bookmarkSummaryCount) return;

    const selected = characters.filter((row) => bookmarks.has(rowId(row)));
    const withHeld = selected.filter((row) => row.heldSkill && row.heldSkill.effect);

    bookmarkSummaryCount.textContent = "☆ " + selected.length + "人";
    bookmarkSummary.innerHTML = "";

    if (!selected.length) {
      const p = document.createElement("p");
      p.className = "notice";
      p.textContent = "一覧で☆を付けると、対象キャラの所持特技をここに合算表示します。";
      bookmarkSummary.appendChild(p);
      return;
    }

    if (!withHeld.length) {
      const p = document.createElement("p");
      p.className = "notice";
      p.textContent = "☆を付けたキャラに所持特技はありません。";
      bookmarkSummary.appendChild(p);
      return;
    }

    const totals = new Map();

    withHeld.forEach((row) => {
      additiveParts(row.heldSkill.effect).forEach((part) => {
        const key = [part.target, part.unit, part.action].join("|");
        const current = totals.get(key) || { ...part, value: 0 };
        current.value += part.value;
        totals.set(key, current);
      });
    });

    const resultBlock = document.createElement("div");
    resultBlock.className = "shiropro-bookmark-total-list";

    if (totals.size) {
      [...totals.values()]
        .sort((a, b) => a.target.localeCompare(b.target, "ja"))
        .forEach((item) => {
          const chip = document.createElement("span");
          chip.className = "shiropro-bookmark-total";
          const value = Number.isInteger(item.value) ? item.value : Number(item.value.toFixed(2));
          chip.textContent = item.target + " " + value + item.unit + item.action;
          resultBlock.appendChild(chip);
        });
    } else {
      const p = document.createElement("p");
      p.className = "notice";
      p.textContent = "単純加算できる数値効果はありません。";
      resultBlock.appendChild(p);
    }

    bookmarkSummary.appendChild(resultBlock);

    const note = document.createElement("p");
    note.className = "shiropro-bookmark-summary-note";
    note.textContent = "同じ表記の数値効果を☆選択分で単純加算しています。";
    bookmarkSummary.appendChild(note);

    const details = document.createElement("details");
    details.className = "shiropro-bookmark-skill-details";

    const summary = document.createElement("summary");
    summary.textContent = "☆キャラの所持特技を見る（" + withHeld.length + "件）";
    details.appendChild(summary);

    const list = document.createElement("div");
    list.className = "shiropro-bookmark-skill-list";

    withHeld.forEach((row) => {
      const item = document.createElement("div");
      item.className = "shiropro-bookmark-skill-item";

      const title = document.createElement("strong");
      title.textContent = row.name;

      const body = document.createElement("span");
      const stage = row.heldSkill.stage && row.heldSkill.stage !== "無印"
        ? "［" + row.heldSkill.stage + "］ "
        : "";
      body.textContent = stage + (row.heldSkill.name ? row.heldSkill.name + "： " : "") + row.heldSkill.effect;

      item.append(title, body);
      list.appendChild(item);
    });

    details.appendChild(list);
    bookmarkSummary.appendChild(details);
  }

  function render() {
    const rows = filteredRows();
    tableBody.innerHTML = "";

    if (countLabel) {
      countLabel.textContent = "表示 " + rows.length + " / " + characters.length;
    }

    renderBookmarkSummary();

    if (!rows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
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

      const nameCell = document.createElement("td");
      setNameAttributeBackground(nameCell, row);
      const link = document.createElement("a");
      link.href = row.wikiUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = row.name;
      nameCell.appendChild(link);

      const formationCell = document.createElement("td");
      setSkillCell(formationCell, row.formationSkill);

      const heldCell = document.createElement("td");
      setSkillCell(heldCell, row.heldSkill);

      tr.append(
        bookmarkCell,
        rarityCell,
        weaponCell,
        nameCell,
        formationCell,
        heldCell
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
    tableBody.innerHTML = '<tr><td colspan="6" class="shiropro-empty">キャラクターデータを読み込めませんでした。</td></tr>';
    if (countLabel) countLabel.textContent = "--";
  }
});