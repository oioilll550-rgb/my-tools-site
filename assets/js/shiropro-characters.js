document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.getElementById("shiroproCharacterBody");
  if (!tableBody) return;

  const searchInput = document.getElementById("shiroproSearch");
  const raritySelect = document.getElementById("shiroproRarity");
  const weaponSelect = document.getElementById("shiroproWeapon");
  const attributeSelect = document.getElementById("shiroproAttribute");
  const bookmarkOnly = document.getElementById("shiroproBookmarkOnly");
  const formationOnly = document.getElementById("shiroproFormationOnly");
  const heldOnly = document.getElementById("shiroproHeldOnly");
  const buffOnly = document.getElementById("shiroproBuffOnly");
  const debuffOnly = document.getElementById("shiroproDebuffOnly");
  const resetButton = document.getElementById("shiroproReset");
  const countLabel = document.getElementById("shiroproCharacterCount");
  const updatedLabel = document.getElementById("shiroproUpdated");
  const sourceLink = document.getElementById("shiroproSource");
  const bookmarkSummary = document.getElementById("shiroproBookmarkSummary");
  const bookmarkSummaryCount = document.getElementById("shiroproBookmarkSummaryCount");
  const detailPanel = document.getElementById("shiroproCharacterDetail");
  const detailTitle = document.getElementById("shiroproCharacterDetailTitle");
  const detailBody = document.getElementById("shiroproCharacterDetailBody");

  const bookmarkKey = "benrichan-shiropro-bookmarks-v1";
  let characters = [];
  let sortKey = "no";
  let sortDirection = "asc";
  let selectedCharacterId = "";

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

  function effectTargetContext(text, fallback = "") {
    const value = String(text || "");
    if (/(?:全ての敵|全敵|射程内の敵|射程外の敵|状態の敵|全ての妖怪|全ての海洋兜|全ての兜|敵の|敵が|敵を|兜の|妖怪の)/.test(value)) {
      return "enemy";
    }
    if (/(?:部隊|城娘|味方|自身|伏兵|蔵|殿|全ての城娘|全城娘|［[^］]+］城娘|\[[^\]]+\]城娘)/.test(value)) {
      return "ally";
    }
    return fallback;
  }

  function classifyEffectText(effectText, contextHint = "") {
    const text = String(effectText || "").replace(/\s+/g, " ").trim();
    if (!text) return { kinds: [], isBuff: false, isDebuff: false };

    const targetContext = effectTargetContext(text, contextHint);
    const enemyContext = targetContext === "enemy";
    const enemyBenefitContext = /(?:敵撃破|敵を撃破|撃破時|敵の防御を[^。]{0,40}?無視|敵に与えるダメージ|敵への与ダメージ)/.test(text);
    const incomingDamageIncrease = /被ダメージ(?:が|を)?[^。]{0,40}?(?:\d+(?:\.\d+)?%?)?\s*上昇/.test(text);

    const debuffPatterns = [
      /(?:敵|兜|妖怪)[^。]{0,160}?(?:低下|減少|延長|後退|停止|行動不能)/,
      /(?:敵|兜|妖怪)[^。]{0,160}?被ダメージ[^。]{0,50}?上昇/,
      /(?:全ての敵|全敵|射程内の敵|射程外の敵|状態の敵)[^。]{0,160}?(?:弱化|低下効果[^。]{0,40}?上昇)/
    ];

    const buffPatterns = [
      /(?:部隊|城娘|味方|自身|伏兵|蔵|殿|城|［[^］]+］|\[[^\]]+\])[^。]{0,180}?(?:上昇|増加|短縮|軽減|回復|加算|無効|大破しない|大破せず|大破扱いにならない|狙われにくく|狙われない|無視|倍|代わりに受ける)/,
      /(?:巨大化気|計略消費気|消費気)[^。]{0,60}?(?:短縮|軽減)/,
      /(?:敵撃破時|撃破時|撃破獲得気)[^。]{0,60}?(?:獲得気|気)[^。]{0,40}?増加/,
      /(?:攻撃時|与ダメージ)[^。]{0,70}?耐久[^。]{0,40}?回復/,
      /(?:足止め数|攻撃対象)[^。]{0,50}?増加/,
      /耐久が\s*0[^。]{0,60}?(?:大破しない|大破せず|大破扱いにならない)/
    ];

    let isDebuff = debuffPatterns.some((pattern) => pattern.test(text));
    let isBuff = buffPatterns.some((pattern) => pattern.test(text));

    if (incomingDamageIncrease) {
      isDebuff = true;
      const withoutIncomingDamage = text.replace(/被ダメージ(?:が|を)?[^。]{0,40}?(?:\d+(?:\.\d+)?%?)?\s*上昇/g, "");
      if (!/(?:上昇|増加|短縮|軽減|回復|加算|無効|大破しない|大破せず|大破扱いにならない|狙われにくく|狙われない|\d+(?:\.\d+)?倍)/.test(withoutIncomingDamage)) {
        isBuff = false;
      }
    }

    if (!isBuff && (!enemyContext || enemyBenefitContext)) {
      if (/(?:上昇|増加|短縮|軽減|回復|加算|無効|大破しない|大破せず|大破扱いにならない|狙われにくく|狙われない|防御を\d+(?:\.\d+)?%無視|\d+(?:\.\d+)?倍)/.test(text) && !incomingDamageIncrease) {
        isBuff = true;
      }
    }

    if (contextHint === "ally" && !incomingDamageIncrease && !isBuff) {
      if (/(?:上昇|増加|短縮|軽減|回復|加算|無効|\d+(?:\.\d+)?倍)/.test(text)) {
        isBuff = true;
      }
    }

    if (enemyContext && !enemyBenefitContext) {
      if (/(?:低下|減少|延長|後退|停止|行動不能|被ダメージ[^。]{0,50}?上昇)/.test(text)) {
        isDebuff = true;
        if (!/(?:自身|味方|城娘|部隊|伏兵|蔵|殿)/.test(text)) isBuff = false;
      }
    }

    const kinds = [];
    if (isBuff) kinds.push("buff");
    if (isDebuff) kinds.push("debuff");
    return { kinds, isBuff, isDebuff };
  }

  function classifyFormationSkill(skill) {
    return classifyEffectText(skill && skill.effect);
  }

  function formationSkillAnalysis(row) {
    if (!row.formationSkillAnalysis) {
      row.formationSkillAnalysis = classifyFormationSkill(row.formationSkill);
    }
    return row.formationSkillAnalysis;
  }

  function normalizeAtomicEffectSpacing(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .replace(/\s*%\s*/g, "%")
      .replace(/([一-龯ぁ-んァ-ヶー])\s+(?=\d)/g, "$1")
      .replace(/\s+(?=(?:低下|上昇|延長|短縮|増加|減少|軽減))/g, "")
      .replace(/\(\s*/g, "(")
      .replace(/\s*\)/g, ")")
      .trim();
  }

  function splitCompoundEnemyClause(clause) {
    const clean = normalizeAtomicEffectSpacing(clause);
    const match = clean.match(
      /^(.+?)(?:が|を)?(\d+(?:\.\d+)?%?)(低下|上昇|延長|短縮|増加|減少|軽減)(.*)$/
    );
    if (!match) return [clean];

    const lhs = match[1].trim();
    const value = match[2];
    const action = match[3];
    const suffix = match[4] || "";
    const atomicStats = new Set([
      "耐久", "攻撃", "防御", "射程", "移動速度", "攻撃速度", "回復",
      "与ダメージ", "被ダメージ", "攻撃後の隙", "計略再使用時間",
      "初回計略使用までの時間", "被回復量", "与回復量"
    ]);

    const fields = lhs
      .split(/と|\//)
      .map((value) => value.trim())
      .filter(Boolean);

    if (fields.length < 2 || !fields.every((value) => atomicStats.has(value))) {
      return [clean];
    }

    return fields.map((field) => field + value + action + suffix);
  }

  function enemyScopedAtomicSegments(effectText) {
    const text = normalizeAtomicEffectSpacing(effectText);
    if (!text) return null;

    const triggerMatch = text.match(
      /^(?:巨大化する度に|巨大化毎に|最大化時|最大巨大化時|配置中、?|合戦中、?)/
    );
    const trigger = triggerMatch ? triggerMatch[0] : "";
    const body = triggerMatch ? text.slice(trigger.length).trim() : text;

    const scopePattern =
      /射程内の敵の|射程外の敵の|全ての敵の|全敵の|全ての妖怪の|全ての海洋兜の|全ての兜の/g;
    const scopeMatches = [...body.matchAll(scopePattern)];

    // Use this stricter parser only when the effect starts with an enemy scope.
    // Mixed ally/enemy effects continue through the generic parser below.
    if (!scopeMatches.length || scopeMatches[0].index !== 0) return null;

    const atomic = [];

    scopeMatches.forEach((scopeMatch, index) => {
      const scope = scopeMatch[0];
      const blockStart = scopeMatch.index + scope.length;
      const blockEnd = index + 1 < scopeMatches.length
        ? scopeMatches[index + 1].index
        : body.length;

      const block = body
        .slice(blockStart, blockEnd)
        .replace(/^[、，,。\s]+|[、，,。\s]+$/g, "");

      block
        .split(/[、，,。]+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => {
          splitCompoundEnemyClause(part).forEach((clause) => {
            const content = trigger + scope + clause;
            const analysis = classifyEffectText(content, "enemy");
            atomic.push({
              content,
              isBuff: analysis.isBuff,
              isDebuff: analysis.isDebuff
            });
          });
        });
    });

    return atomic.length ? atomic : null;
  }

  function effectSegments(effectText) {
    const text = String(effectText || "").replace(/\s+/g, " ").trim();
    if (!text) return [];

    const atomicEnemySegments = enemyScopedAtomicSegments(text);
    if (atomicEnemySegments) return atomicEnemySegments;

    const preparedText = text
      .replace(
        /\s+(?=(?:全ての敵|全敵|全ての妖怪|全ての海洋兜|全ての兜|射程内の敵|射程外の敵|「[^」]+」状態の敵|［[^］]+］状態の敵|\[[^\]]+\]状態の敵))/g,
        "。"
      )
      .replace(
        /、(?=(?:全ての敵|全敵|全ての妖怪|全ての海洋兜|全ての兜|射程内の敵|射程外の敵))/g,
        "。"
      )
      .replace(/(?:。|\s)+(?=(?:最大化時|最大巨大化時))/g, "。");

    const sentences = preparedText
      .split(/[。]+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    const segments = [];

    sentences.forEach((sentence) => {
      const parts = sentence
        .split(/[、，,]/)
        .map((part) => part.trim())
        .filter(Boolean);

      let context = effectTargetContext(sentence, "");
      let carryPrefix = "";

      parts.forEach((part) => {
        context = effectTargetContext(part, context);
        const analysis = classifyEffectText(part, context);

        if (!analysis.isBuff && !analysis.isDebuff) {
          carryPrefix += (carryPrefix ? "、" : "") + part;
          return;
        }

        const content = carryPrefix ? carryPrefix + "、" + part : part;
        carryPrefix = "";
        const combinedAnalysis = classifyEffectText(content, context);

        segments.push({
          content,
          isBuff: combinedAnalysis.isBuff,
          isDebuff: combinedAnalysis.isDebuff
        });
      });

      if (carryPrefix) {
        const analysis = classifyEffectText(carryPrefix, context);
        segments.push({
          content: carryPrefix,
          isBuff: analysis.isBuff,
          isDebuff: analysis.isDebuff
        });
      }
    });

    if (!segments.length) {
      const analysis = classifyEffectText(text);
      segments.push({
        content: text,
        isBuff: analysis.isBuff,
        isDebuff: analysis.isDebuff
      });
    }

    return segments;
  }

  function formationEffectSegments(skill) {
    return effectSegments(skill && skill.effect);
  }

  const cumulativeTraitWeapons = new Set(["本", "歌舞", "鈴"]);
  const traitPropertyPatternSource = [
    "敵撃破時の獲得気",
    "撃破獲得気",
    "初回計略使用までの時間",
    "計略再使用までの時間",
    "計略再使用時間",
    "計略使用までの時間",
    "攻撃後の隙",
    "特殊攻撃ゲージ蓄積量",
    "被回復量",
    "与回復量",
    "移動速度",
    "攻撃速度",
    "被ダメージ",
    "被ダメ",
    "与ダメージ",
    "与ダメ",
    "計略消費気",
    "巨大化気",
    "足止め数",
    "攻撃対象",
    "直撃ボーナス",
    "耐久",
    "攻撃",
    "防御",
    "射程",
    "回復"
  ].join("|");

  function canonicalTraitCadence(value) {
    if (value === "巨大化毎に") return "巨大化する度に";
    return value;
  }

  function splitTraitCadenceBlocks(effectText) {
    const text = String(effectText || "").replace(/\s+/g, " ").trim();
    if (!text) return [];

    const markerPattern = /(【配置】|巨大化する度に|巨大化毎に|最大巨大化時|最大化時|巨大化時|特殊能力中|計略中)/g;
    const matches = [...text.matchAll(markerPattern)];

    if (!matches.length) {
      return [{ cadence: "", body: text }];
    }

    const blocks = [];
    if (matches[0].index > 0) {
      const leading = text.slice(0, matches[0].index).replace(/^[、。\s]+|[、。\s]+$/g, "");
      if (leading) blocks.push({ cadence: "", body: leading });
    }

    matches.forEach((match, index) => {
      const start = match.index + match[0].length;
      const end = index + 1 < matches.length ? matches[index + 1].index : text.length;
      const body = text.slice(start, end).replace(/^[、。\s]+|[、。\s]+$/g, "");
      if (body) {
        blocks.push({
          cadence: canonicalTraitCadence(match[0]),
          body
        });
      }
    });

    return blocks;
  }

  function normalizeTraitScope(scope) {
    return String(scope || "")
      .replace(/射程内敵/g, "射程内の敵")
      .replace(/射程外敵/g, "射程外の敵")
      .replace(/射程内城娘/g, "射程内の城娘")
      .replace(/射程外城娘/g, "射程外の城娘")
      .replace(/射程内味方/g, "射程内の味方")
      .replace(/射程外味方/g, "射程外の味方")
      .replace(/\s+/g, "");
  }

  function traitScopeLooksExplicit(prefix) {
    const value = String(prefix || "");
    return /(?:敵|兜|妖怪|城娘|味方|自身|伏兵|蔵|殿|水城|軍船|平城|山城|平山城|地獄城|全\[|全［|全ての|射程内|射程外)/.test(value);
  }

  function prepareTraitChunks(body) {
    const prop = traitPropertyPatternSource;
    return String(body || "")
      .replace(/[。]+/g, "、")
      .replace(
        new RegExp(
          "(\\d+(?:\\.\\d+)?%?(?:\\s*と\\s*\\d+(?:\\.\\d+)?%?)?)\\s+(?=(?:" +
            prop +
            ")(?:が|を|は|\\s))",
          "g"
        ),
        "$1、"
      )
      .replace(
        new RegExp(
          "(上昇|低下|短縮|軽減|増加|減少|延長|回復|無視)(?:し|する)?\\s+(?=(?:" +
            prop +
            "|射程内|射程外|全ての|全敵|自身|殿と|全\\[|全［))",
          "g"
        ),
        "$1、"
      )
      .split(/[、，,]+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function traitActionInfo(text) {
    const matches = [...String(text || "").matchAll(/(上昇|低下|短縮|軽減|増加|減少|延長|回復|無視)(?:し|する)?/g)];
    if (!matches.length) {
      const multiple = String(text || "").match(/(\d+(?:\.\d+)?)\s*倍(?:$|[（(])/);
      if (multiple) return { action: "倍", index: multiple.index + multiple[1].length };
      return { action: "", index: -1 };
    }
    const match = matches[matches.length - 1];
    return { action: match[1], index: match.index };
  }

  function traitValueMatch(text, action) {
    const valueText = String(text || "").trim();
    if (action === "倍") {
      return valueText.match(/(\d+(?:\.\d+)?)$/);
    }
    return valueText.match(
      /((?:自身の攻撃の|与ダメージの|与ダメの)?\d+(?:\.\d+)?%?(?:の値)?(?:\s*と\s*\d+(?:\.\d+)?%?)?)$/
    );
  }

  function traitAtomicRows(effectText, row) {
    const weapon = normalizeWeapon(row.weapon);
    if (!cumulativeTraitWeapons.has(weapon)) {
      return effectSegments(effectText).map((segment) => ({ ...segment, uncertain: false }));
    }

    const atomicRows = [];

    splitTraitCadenceBlocks(effectText).forEach((block) => {
      const chunks = prepareTraitChunks(block.body);
      const parsed = [];
      let currentScope = "";

      chunks.forEach((rawChunk) => {
        let chunk = rawChunk.replace(/^[、。\s]+|[、。\s]+$/g, "").trim();
        if (!chunk) return;

        const propertyMatch = chunk.match(new RegExp(traitPropertyPatternSource));
        if (!propertyMatch || propertyMatch.index === undefined) {
          parsed.push({
            raw: chunk,
            scope: currentScope,
            payload: chunk,
            action: "",
            uncertain: true
          });
          return;
        }

        const prefix = chunk.slice(0, propertyMatch.index).trim();
        if (prefix && traitScopeLooksExplicit(prefix)) {
          currentScope = normalizeTraitScope(prefix);
          chunk = chunk.slice(propertyMatch.index).trim();
        }

        const actionInfo = traitActionInfo(chunk);
        parsed.push({
          raw: rawChunk,
          scope: currentScope,
          payload: chunk,
          action: actionInfo.action,
          uncertain: false
        });
      });

      // Shared terminal actions are propagated backwards only inside the same target scope.
      for (let i = parsed.length - 2; i >= 0; i -= 1) {
        if (parsed[i].action) continue;
        for (let j = i + 1; j < parsed.length; j += 1) {
          if (parsed[j].scope !== parsed[i].scope) break;
          if (parsed[j].action) {
            parsed[i].action = parsed[j].action;
            break;
          }
        }
      }

      parsed.forEach((item) => {
        const cadence = block.cadence;
        const basePrefix = (cadence || "") + (item.scope || "");
        let payload = String(item.payload || "").trim();

        const annotationMatches = payload.match(/[（(][^）)]*(?:重複|効果)[^）)]*[）)]/g) || [];
        const annotation = annotationMatches.join("");
        annotationMatches.forEach((match) => {
          payload = payload.replace(match, "").trim();
        });

        const action = item.action;
        if (action && action !== "倍") {
          payload = payload.replace(
            new RegExp("(上昇|低下|短縮|軽減|増加|減少|延長|回復|無視)(?:し|する)?\\s*$"),
            ""
          ).trim();
        } else if (action === "倍") {
          payload = payload.replace(/倍\s*$/, "").trim();
        }

        const valueMatch = traitValueMatch(payload, action);
        if (!action || !valueMatch || valueMatch.index === undefined) {
          const content = ((basePrefix || "") + item.raw).replace(/\s+/g, " ").trim();
          const analysis = classifyEffectText(content);
          atomicRows.push({
            content,
            isBuff: analysis.isBuff,
            isDebuff: analysis.isDebuff,
            uncertain: true
          });
          return;
        }

        const value = valueMatch[1].replace(/\s+/g, "");
        let propertyText = payload.slice(0, valueMatch.index).trim();
        const particleMatch = propertyText.match(/(が|を|は)$/);
        const particle = particleMatch ? particleMatch[1] : "";
        if (particle) propertyText = propertyText.slice(0, -1).trim();

        const properties = propertyText
          .split(/\s*(?:と|\/)\s*/)
          .map((part) => part.trim())
          .filter(Boolean);

        const recognizedProperty = new RegExp("^(?:" + traitPropertyPatternSource + ")$");
        if (!properties.length || properties.some((property) => !recognizedProperty.test(property))) {
          const content = ((basePrefix || "") + item.raw).replace(/\s+/g, " ").trim();
          const analysis = classifyEffectText(content);
          atomicRows.push({
            content,
            isBuff: analysis.isBuff,
            isDebuff: analysis.isDebuff,
            uncertain: true
          });
          return;
        }

        properties.forEach((property) => {
          const normalizedProperty =
            property === "被ダメ" ? "被ダメージ" :
            property === "与ダメ" ? "与ダメージ" :
            property;
          const content =
            basePrefix +
            normalizedProperty +
            particle +
            value +
            (action === "倍" ? "倍" : action) +
            annotation;
          const analysis = classifyEffectText(content);
          atomicRows.push({
            content,
            isBuff: analysis.isBuff,
            isDebuff: analysis.isDebuff,
            uncertain: false
          });
        });
      });
    });

    if (!atomicRows.length) {
      return effectSegments(effectText).map((segment) => ({ ...segment, uncertain: true }));
    }

    return atomicRows;
  }

  function upgradeRank(stage) {
    if (stage === "改弐") return 2;
    if (stage === "改壱") return 1;
    return 0;
  }

  function detailMaxUpgrade(row) {
    const stages = [
      row.maxUpgrade,
      row.formationSkill && row.formationSkill.stage,
      row.heldSkill && row.heldSkill.stage,
      ...(Array.isArray(row.buffs) ? row.buffs.map((item) => item.stage) : []),
      ...(Array.isArray(row.debuffs) ? row.debuffs.map((item) => item.stage) : [])
    ].filter(Boolean);

    let best = "無印";
    stages.forEach((stage) => {
      if (upgradeRank(stage) > upgradeRank(best)) best = stage;
    });
    return best;
  }

  function maxGiantizeCount(row) {
    const explicit = Number(
      row.maxGiantizeCount ||
      row.maxGiantize ||
      row.giantizeCount ||
      0
    );
    if (Number.isFinite(explicit) && explicit > 0) return explicit;

    const finalRarity = Number(row.rarity || 0) + upgradeRank(detailMaxUpgrade(row));
    if (finalRarity >= 6) return 5;
    if (finalRarity >= 3) return 4;
    return 3;
  }

  function scaleGiantizeBuffText(contentText, row, sourceEffect) {
    const content = String(contentText || "");
    const source = String(sourceEffect || "");
    const weapon = normalizeWeapon(row.weapon);

    if (!["本", "歌舞"].includes(weapon)) return content;
    // Only the effect explicitly described as "巨大化する度に" is accumulated.
    // Other effects in the same trait, including "最大化時", stay at x1.
    if (!/巨大化する度に/.test(content)) return content;
    if (/(?:最大化時|最大巨大化時)/.test(content)) return content;

    const multiplier = maxGiantizeCount(row);
    if (multiplier <= 1) return content;

    return content.replace(
      /(\d+(?:\.\d+)?)(%?)(?=\s*(?:上昇|増加|短縮|軽減|回復))/g,
      (_, numberText, unit) => {
        const numeric = Number(numberText);
        if (!Number.isFinite(numeric)) return numberText + unit;

        const scaled = numeric * multiplier;
        const value = Number.isInteger(scaled)
          ? String(scaled)
          : String(Number(scaled.toFixed(2)));
        return value + unit;
      }
    );
  }

  function traitEffects(row) {
    const combined = [
      ...(Array.isArray(row.buffs) ? row.buffs : []),
      ...(Array.isArray(row.debuffs) ? row.debuffs : [])
    ];

    let traitItems = combined.filter((item) => {
      if (!item || !item.effect) return false;
      if (String(item.effect).length > 900) return false;
      const sourceKeys = Array.isArray(item.sources)
        ? item.sources.map((source) => String(source && source.key || ""))
        : [];
      return item.section === "特技" || sourceKeys.some((key) => /^trait_/.test(key));
    });

    const maxStage = detailMaxUpgrade(row);
    const maxStageItems = traitItems.filter((item) => (item.stage || "無印") === maxStage);
    if (maxStageItems.length) {
      traitItems = maxStageItems;
    } else if (traitItems.length) {
      const highestRank = Math.max(...traitItems.map((item) => upgradeRank(item.stage)));
      traitItems = traitItems.filter((item) => upgradeRank(item.stage) === highestRank);
    }

    const byEffect = new Map();
    traitItems.forEach((item) => {
      const normalizedEffect = String(item.effect)
        .replace(/\s+/g, "")
        .replace(/[、，,。]/g, "")
        .trim();
      if (!normalizedEffect) return;

      const current = byEffect.get(normalizedEffect);
      if (!current || upgradeRank(item.stage) > upgradeRank(current.stage)) {
        byEffect.set(normalizedEffect, item);
      } else if (current && Array.isArray(item.sources) && item.sources.some((source) => source && source.key === "individual_max")) {
        byEffect.set(normalizedEffect, item);
      }
    });

    // Different scrape sources may differ only by whitespace around numbers.
    const compact = [];
    [...byEffect.values()].forEach((item) => {
      const signature = String(item.effect)
        .replace(/\s+/g, "")
        .replace(/[、，,。]/g, "")
        .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0));
      if (!compact.some((existing) => existing.signature === signature)) {
        compact.push({ signature, item });
      }
    });

    return compact.map((entry) => entry.item);
  }

  function filteredRows() {
    const keyword = normalize(searchInput.value);
    const rarity = raritySelect.value;
    const weapon = weaponSelect.value;
    const attribute = attributeSelect.value;
    const onlyBookmarked = bookmarkOnly.checked;
    const onlyFormationSkill = formationOnly.checked;
    const onlyHeldSkill = heldOnly.checked;
    const onlyBuff = buffOnly.checked;
    const onlyDebuff = debuffOnly.checked;

    const rows = characters.filter((row) => {
      if (keyword && !normalize(row.name).includes(keyword)) return false;
      if (rarity && String(row.rarity) !== rarity) return false;
      if (weapon && normalizeWeapon(row.weapon) !== weapon) return false;
      if (attribute && !splitAttributes(row).includes(attribute)) return false;
      if (onlyBookmarked && !bookmarks.has(rowId(row))) return false;
      if (onlyFormationSkill && !(row.formationSkill && row.formationSkill.effect)) return false;
      if (onlyHeldSkill && !(row.heldSkill && row.heldSkill.effect)) return false;

      const formationAnalysis = formationSkillAnalysis(row);
      const hasBuff = (Array.isArray(row.buffs) && row.buffs.length) || formationAnalysis.isBuff;
      const hasDebuff = (Array.isArray(row.debuffs) && row.debuffs.length) || formationAnalysis.isDebuff;
      if (onlyBuff && !hasBuff) return false;
      if (onlyDebuff && !hasDebuff) return false;
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

  const maxOnlyHeldSkillTargetPattern = /(獲得金|要石|経験値|殿EXP|城娘EXP|合戦時EXP)/i;

  function heldSkillAggregationMode(part) {
    const target = String(part && part.target || "");
    return maxOnlyHeldSkillTargetPattern.test(target) ? "max" : "sum";
  }

  function renderCharacterDetail() {
    if (!detailPanel) return;

    const row = characters.find((item) => rowId(item) === selectedCharacterId);
    if (!row) {
      detailPanel.hidden = true;
      return;
    }

    detailPanel.hidden = false;
    if (detailTitle) {
      const maxUpgrade = detailMaxUpgrade(row);
      const upgradeLabel = maxUpgrade && maxUpgrade !== "無印" ? "　" + maxUpgrade : "";
      detailTitle.textContent = row.name + upgradeLabel;
    }
    if (!detailBody) return;

    detailBody.innerHTML = "";

    function appendEffectRow(list, kind, contentText) {
      const rowElement = document.createElement("div");
      rowElement.className = "shiropro-detail-effect-row";

      const tags = document.createElement("div");
      tags.className = "shiropro-detail-effect-tags";

      const tag = document.createElement("span");
      tag.className = "shiropro-effect-tag" +
        (kind === "buff" ? " is-buff" : kind === "debuff" ? " is-debuff" : "");
      tag.textContent = kind === "buff" ? "バフ" : kind === "debuff" ? "デバフ" : "その他";
      tags.appendChild(tag);

      const content = document.createElement("p");
      content.className = "shiropro-detail-skill-effect";
      content.textContent = contentText;

      rowElement.append(tags, content);
      list.appendChild(rowElement);
    }

    function renderClassifiedSection(titleText, effectEntries, emptyText, options = {}) {
      const section = document.createElement("section");
      section.className = "shiropro-detail-formation";

      const heading = document.createElement("h4");
      heading.textContent = titleText;
      section.appendChild(heading);

      if (!effectEntries.length) {
        const empty = document.createElement("p");
        empty.className = "shiropro-detail-empty";
        empty.textContent = emptyText;
        section.appendChild(empty);
        detailBody.appendChild(section);
        return;
      }

      const effectList = document.createElement("div");
      effectList.className = "shiropro-detail-effect-list";

      const buffRows = [];
      const debuffRows = [];
      const otherRows = [];

      effectEntries.forEach((entry) => {
        const effectText = typeof entry === "string" ? entry : String(entry && entry.effect || "");
        const segments = options.decomposeCumulativeTraits
          ? traitAtomicRows(effectText, row)
          : effectSegments(effectText);

        segments.forEach((segment) => {
          if (segment.isBuff) {
            buffRows.push(
              options.scaleGiantizeBuffs
                ? scaleGiantizeBuffText(segment.content, row, effectText)
                : segment.content
            );
          }
          if (segment.isDebuff) debuffRows.push(segment.content);
          if (!segment.isBuff && !segment.isDebuff) otherRows.push(segment.content);
        });
      });

      const unique = (items) => [...new Set(items.map((item) => item.trim()).filter(Boolean))];

      // Detail order is always buffs first, then debuffs.
      unique(buffRows).forEach((content) => appendEffectRow(effectList, "buff", content));
      unique(debuffRows).forEach((content) => appendEffectRow(effectList, "debuff", content));
      unique(otherRows).forEach((content) => appendEffectRow(effectList, "other", content));

      section.appendChild(effectList);
      detailBody.appendChild(section);
    }

    const formationEffects = row.formationSkill && row.formationSkill.effect
      ? [row.formationSkill.effect]
      : [];
    renderClassifiedSection("編成特技", formationEffects, "編成特技はありません。");

    const traits = traitEffects(row);
    renderClassifiedSection(
      "特技",
      traits,
      "分類対象の特技はありません。",
      {
        scaleGiantizeBuffs: true,
        decomposeCumulativeTraits: true
      }
    );
  }

  function selectCharacter(id) {
    selectedCharacterId = String(id || "");
    tableBody.querySelectorAll("tr[data-character-id]").forEach((tr) => {
      const selected = tr.dataset.characterId === selectedCharacterId;
      tr.classList.toggle("is-selected", selected);
      tr.setAttribute("aria-selected", selected ? "true" : "false");
    });
    renderCharacterDetail();
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
        const aggregationMode = heldSkillAggregationMode(part);
        const current = totals.get(key);

        if (!current) {
          totals.set(key, { ...part, value: part.value, aggregationMode });
          return;
        }

        if (aggregationMode === "max") {
          current.value = Math.max(current.value, part.value);
        } else {
          current.value += part.value;
        }
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
    note.textContent = "獲得金・要石・経験値など戦闘外の同種効果は最大値、それ以外の同じ表記の数値効果は☆選択分で合算しています。";
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
      renderCharacterDetail();
      return;
    }

    const fragment = document.createDocumentFragment();

    rows.forEach((row) => {
      const tr = document.createElement("tr");
      const id = rowId(row);
      tr.dataset.characterId = id;
      tr.tabIndex = 0;
      tr.setAttribute("aria-selected", id === selectedCharacterId ? "true" : "false");
      if (bookmarks.has(id)) tr.classList.add("is-bookmarked");
      if (id === selectedCharacterId) tr.classList.add("is-selected");

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
    renderCharacterDetail();
  }

  tableBody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("input, a, button, select, label")) return;

    const row = target.closest("tr[data-character-id]");
    if (!row) return;
    selectCharacter(row.dataset.characterId);
  });

  tableBody.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("input, a, button, select, label")) return;

    const row = target.closest("tr[data-character-id]");
    if (!row) return;
    event.preventDefault();
    selectCharacter(row.dataset.characterId);
  });

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

  [searchInput, raritySelect, weaponSelect, attributeSelect, bookmarkOnly, formationOnly, heldOnly, buffOnly, debuffOnly].forEach((element) => {
    element.addEventListener(element === searchInput ? "input" : "change", render);
  });

  resetButton.addEventListener("click", () => {
    searchInput.value = "";
    raritySelect.value = "";
    weaponSelect.value = "";
    attributeSelect.value = "";
    bookmarkOnly.checked = false;
    formationOnly.checked = false;
    heldOnly.checked = false;
    buffOnly.checked = false;
    debuffOnly.checked = false;
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
    characters.forEach((row) => {
      row.formationSkillAnalysis = classifyFormationSkill(row.formationSkill);
    });
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