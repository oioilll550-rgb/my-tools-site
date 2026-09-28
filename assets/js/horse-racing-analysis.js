document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.getElementById("raceTableBody");
  if (!tableBody) return;

  const raceKey = new URLSearchParams(location.search).get("race") || "next";
  const raceDataMap = {
    next: "../../assets/data/horse-racing-next-2026-10-03-tokyo-r1.json",
    "2026-09-27": "../../assets/data/horse-racing-2026-09-27-nakayama-r1.json",
    "2026-09-26": "../../assets/data/horse-racing-2026-09-26-nakayama-r1.json"
  };
  const DATA_URL = raceDataMap[raceKey] || raceDataMap.next;
  const isArchive = raceKey !== "next";
  const gradeScore = {
    "GⅠ": 100, "JpnⅠ": 95, "GⅡ": 85, "JpnⅡ": 82,
    "GⅢ": 75, "JpnⅢ": 72, "L": 65, "OP": 60, "3勝": 50
  };

  // 距離ごとに評価を変えられるよう、種牡馬は固定点ではなく中心距離で持つ。
  // これは産駒統計ではなく、血統要素を小さく加えるための試験的な距離タイプ辞書。
  const pedigreeDistance = {
    "ロードカナロア": 1200, "ディープインパクト": 2000,
    "キズナ": 2000, "シンボリクリスエス": 2000,
    "クロフネ": 1400, "キングカメハメハ": 1800,
    "American Pharoah": 1800, "Galileo": 2400,
    "ミッキーアイル": 1200, "ケイムホーム": 1200,
    "ゼンノロブロイ": 2000, "キンシャサノキセキ": 1200,
    "マクフィ": 1600, "ハーツクライ": 2200,
    "ドレフォン": 1600, "ダイワメジャー": 1400,
    "タワーオブロンドン": 1200, "エンパイアメーカー": 2000,
    "ドゥラメンテ": 2000, "New Approach": 2000,
    "キタサンブラック": 2200, "トゥザワールド": 2000,
    "ヴィクトワールピサ": 2000, "スクリーンヒーロー": 1800,
    "マイネルラヴ": 1200, "サートゥルナーリア": 2000,
    "サクラバクシンオー": 1200, "アジアエクスプレス": 1600
  };

  const selected = new Set();
  let scored = [];
  let race = null;

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const round1 = (n) => Math.round(n * 10) / 10;

  function finishScore(run) {
    if (!run || run.field <= 1) return 50;
    return clamp((run.field - run.finish) / (run.field - 1) * 100, 0, 100);
  }

  function weightedAverage(rows, fallback = 55) {
    if (!rows.length) return fallback;
    let sum = 0;
    let weight = 0;
    rows.forEach(({value, w}) => {
      sum += value * w;
      weight += w;
    });
    return weight ? sum / weight : fallback;
  }

  function evidenceScore(rows) {
    if (!Array.isArray(rows) || !rows.length) return 55;
    return rows.reduce((sum, row) => sum + finishScore(row), 0) / rows.length;
  }

  function distanceSimilarity(runDistance, targetDistance) {
    if (!Number.isFinite(runDistance) || !Number.isFinite(targetDistance)) return 0;
    const span = Math.max(400, targetDistance * .3);
    return clamp(1 - Math.abs(runDistance - targetDistance) / span, 0, 1);
  }

  function distanceScore(horse, currentRace) {
    const weights = [4, 3, 2, 1];
    const rows = horse.runs
      .map((run, i) => ({run, w: weights[i] || 1}))
      .filter(({run}) => run.surface === currentRace.surface)
      .map(({run, w}) => {
        const similarity = distanceSimilarity(run.distance, currentRace.distance);
        if (similarity <= 0) return null;
        const performance = finishScore(run);
        // 距離が離れるほど50点（中立）へ寄せる。
        return {value: 50 + (performance - 50) * similarity, w: w * similarity};
      })
      .filter(Boolean);
    return weightedAverage(rows, 50);
  }

  function pedigreeFitForDistance(name, targetDistance) {
    const ideal = pedigreeDistance[name];
    if (!Number.isFinite(ideal)) return 55;
    const span = Math.max(800, targetDistance * .45);
    return clamp(100 - Math.abs(ideal - targetDistance) / span * 65, 35, 100);
  }

  function pedigreeScore(horse, currentRace) {
    const sire = pedigreeFitForDistance(horse.pedigree?.sire, currentRace.distance);
    const damsire = pedigreeFitForDistance(horse.pedigree?.damsire, currentRace.distance);
    return sire * .7 + damsire * .3;
  }

  function jockeyScore(horse) {
    const indexes = Array.isArray(horse.sameJockeyRunIndexes) ? horse.sameJockeyRunIndexes : [];
    if (!indexes.length) return 50;
    const weights = [4, 3, 2, 1];
    const rows = indexes
      .filter((i) => horse.runs[i])
      .map((i) => ({value: finishScore(horse.runs[i]), w: weights[i] || 1}));
    const performance = weightedAverage(rows, 50);
    const continuityWeight = indexes.reduce((sum, i) => sum + (weights[i] || 1), 0) / 10 * 100;
    return performance * .65 + continuityWeight * .35;
  }

  function calculate(horse, currentRace) {
    const recentRatings = horse.runs.map((r) => r.rating).filter(Number.isFinite);
    const baseRating = Number.isFinite(horse.preRating)
      ? horse.preRating
      : (recentRatings.length ? Math.max(...recentRatings) : null);
    const ability = Number.isFinite(baseRating)
      ? clamp((baseRating - 90) / 30 * 100, 0, 100)
      : 50;

    const weights = [4, 3, 2, 1];
    const form = weightedAverage(horse.runs.map((run, i) => ({
      value: finishScore(run),
      w: weights[i] || 1
    })), 50);

    const distance = distanceScore(horse, currentRace);
    const course = evidenceScore(horse.courseEvidence);
    const going = evidenceScore(horse.goingEvidence);
    const jockey = jockeyScore(horse);
    const pedigree = pedigreeScore(horse, currentRace);
    const classLevel = Math.max(...horse.runs.map((r) => gradeScore[r.grade] || 45), 45);

    const total =
      ability * .25 +
      form * .20 +
      distance * .15 +
      course * .10 +
      going * .10 +
      jockey * .10 +
      pedigree * .05 +
      classLevel * .05;

    return {
      ...horse,
      ability: round1(ability),
      form: round1(form),
      distanceFit: round1(distance),
      course: round1(course),
      going: round1(going),
      jockeyFit: round1(jockey),
      pedigreeFit: round1(pedigree),
      classLevel: round1(classLevel),
      score: round1(total),
      baseRating
    };
  }

  function targetLabel(currentRace) {
    return currentRace.venue + " " + currentRace.surface + currentRace.distance + "m" +
      (currentRace.direction ? " " + currentRace.direction : "");
  }

  function notes(horse) {
    const strengths = [];
    const cautions = [];
    const condition = targetLabel(race);
    if (horse.baseRating >= 114) strengths.push("レーティング水準が高い");
    if (horse.form >= 75) strengths.push("近4走の内容が安定");
    if (horse.distanceFit >= 78) strengths.push(race.surface + race.distance + "mへの距離適性が高い");
    if (horse.courseEvidence?.length && horse.course >= 75) strengths.push(condition + "の実績が高い");
    if (horse.goingEvidence?.length && horse.going >= 75) strengths.push((race.going || "今回の馬場") + "への適性が高い");
    if ((horse.sameJockeyRunIndexes || []).length >= 3) strengths.push("現騎手との継続性が高い");
    if (horse.pedigreeFit >= 85) strengths.push(race.distance + "m向きの血統シグナル");
    if (!horse.courseEvidence?.length) cautions.push(condition + "の近走実績は確認できない");
    if (!(horse.sameJockeyRunIndexes || []).length) cautions.push("近4走から現騎手との実戦相性を確認できない");
    return [...strengths.slice(0, 3), ...cautions.slice(0, 1)];
  }

  function renderMeta(currentRace) {
    document.getElementById("raceTitle").textContent = currentRace.title + "｜出走馬実力比較";
    document.getElementById("raceLead").textContent =
      currentRace.date.replaceAll("-", "/") + " " + currentRace.venue + currentRace.raceNo +
      "Rを、近4走・騎手・血統・コース・馬場まで含めて比較します。";
    const meta = document.getElementById("raceMeta");
    meta.innerHTML = "";
    [
      currentRace.date.replaceAll("-", "/"),
      currentRace.venue + currentRace.raceNo + "R",
      currentRace.grade,
      currentRace.surface + currentRace.distance + "m",
      currentRace.direction,
      currentRace.postTime ? "発走 " + currentRace.postTime : "",
      "馬場 " + (currentRace.going || "未設定")
    ].filter(Boolean).forEach((text) => {
      const span = document.createElement("span");
      span.textContent = text;
      meta.appendChild(span);
    });

    const kicker = document.getElementById("raceKicker");
    if (kicker) kicker.textContent = currentRace.kicker || (isArchive ? "過去分析" : "次回開催日の分析");
    const breadcrumbTail = document.getElementById("raceBreadcrumbTail");
    if (breadcrumbTail) breadcrumbTail.textContent = isArchive ? currentRace.date.replaceAll("-", "/") + " の分析" : "次回開催日の分析";
    const source = document.getElementById("raceSource");
    source.href = currentRace.sourceUrl;
    const sourceLabel = document.getElementById("raceSourceLabel");
    if (sourceLabel) sourceLabel.textContent = currentRace.sourceLabel || "JRA公式 出馬表";
    const policyNote = document.getElementById("racePolicyNote");
    if (policyNote) policyNote.textContent = currentRace.analysisNote || "";

    document.getElementById("distanceMethodText").textContent =
      currentRace.surface + currentRace.distance + "mに近い近走ほど重く評価します。";
    document.getElementById("courseMethodText").textContent =
      targetLabel(currentRace) + "と同等条件の実績を評価します。未経験は中立値です。";
    document.getElementById("goingMethodText").textContent =
      (currentRace.going || "今回の馬場") + "での実績を評価します。該当実績なしは中立値です。";
    document.getElementById("pedigreeMethodText").textContent =
      "父・母父の簡易距離タイプを" + currentRace.distance + "mへの近さで評価します。";
    if (currentRace.status === "entries_pending") {
      document.getElementById("raceAboutText").textContent =
        currentRace.date.replaceAll("-", "/") + "・" + currentRace.venue + currentRace.raceNo +
        "R「" + currentRace.title + "」の開催予定を表示しています。出馬表公開後に、出走馬・近走・騎手・血統を読み込んで指数を表示します。";
    } else {
      document.getElementById("raceAboutText").textContent =
        currentRace.date.replaceAll("-", "/") + "・" + currentRace.venue + currentRace.raceNo +
        "R「" + currentRace.title + "」のJRA公式出馬表を参考にした分析です。" +
        "レース条件（" + targetLabel(currentRace) + "・" + (currentRace.going || "馬場未設定") +
        "）に合わせて距離・コース・馬場・血統の評価を切り替えます。対象レース自身の結果・オッズ・人気は指数に使いません。";
    }
  }

  function sortRows(mode) {
    const rows = [...scored];
    const keyMap = {
      rating: "ability", form: "form", distance: "distanceFit", course: "course",
      going: "going", jockey: "jockeyFit", pedigree: "pedigreeFit", score: "score"
    };
    if (mode === "number") return rows.sort((a, b) => a.number - b.number);
    const key = keyMap[mode] || "score";
    return rows.sort((a, b) => b[key] - a[key] || a.number - b.number);
  }

  function td(text, className) {
    const cell = document.createElement("td");
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function renderTable(mode = "score") {
    const rankByScore = new Map(
      [...scored].sort((a,b) => b.score - a.score || a.number - b.number)
        .map((h, i) => [h.number, i + 1])
    );
    tableBody.innerHTML = "";
    sortRows(mode).forEach((horse) => {
      const tr = document.createElement("tr");
      const rank = document.createElement("td");
      const rankBadge = document.createElement("span");
      rankBadge.className = "race-rank";
      rankBadge.textContent = rankByScore.get(horse.number);
      rank.appendChild(rankBadge);

      const horseCell = document.createElement("td");
      const name = document.createElement("span");
      name.className = "race-horse-name";
      name.textContent = horse.number + " " + horse.name;
      const sub = document.createElement("small");
      sub.className = "race-horse-sub";
      sub.textContent = horse.sexAge + " / " + horse.jockey + " / " +
        (horse.pedigree?.sire || "父不明") + " × " + (horse.pedigree?.damsire || "母父不明");
      horseCell.append(name, sub);

      const checkCell = document.createElement("td");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.className = "race-compare-check";
      check.checked = selected.has(horse.number);
      check.setAttribute("aria-label", horse.name + "を比較");
      check.addEventListener("change", () => {
        if (check.checked) {
          if (selected.size >= 3) {
            check.checked = false;
            return;
          }
          selected.add(horse.number);
        } else {
          selected.delete(horse.number);
        }
        renderCompare();
      });
      checkCell.appendChild(check);

      tr.append(
        rank, horseCell, td(horse.score.toFixed(1), "race-score"),
        td(horse.ability.toFixed(1)), td(horse.form.toFixed(1)),
        td(horse.distanceFit.toFixed(1)), td(horse.course.toFixed(1)),
        td(horse.going.toFixed(1)), td(horse.jockeyFit.toFixed(1)),
        td(horse.pedigreeFit.toFixed(1)), td(horse.classLevel.toFixed(1)),
        checkCell
      );
      tableBody.appendChild(tr);
    });
  }

  function metric(label, value) {
    const row = document.createElement("div");
    row.className = "race-metric-row";
    const l = document.createElement("span");
    l.textContent = label;
    const track = document.createElement("div");
    track.className = "race-metric-track";
    const bar = document.createElement("div");
    bar.className = "race-metric-bar";
    bar.style.width = clamp(value, 0, 100) + "%";
    track.appendChild(bar);
    const v = document.createElement("strong");
    v.textContent = value.toFixed(1);
    row.append(l, track, v);
    return row;
  }

  function recentRunsBlock(horse) {
    const details = document.createElement("details");
    details.className = "race-runs-details";
    const summary = document.createElement("summary");
    summary.textContent = "近4走の計算対象を見る";
    const list = document.createElement("div");
    list.className = "race-runs-list";
    horse.runs.forEach((run, i) => {
      const row = document.createElement("div");
      const similarity = Math.round(distanceSimilarity(run.distance, race.distance) * 100);
      row.textContent =
        (i === 0 ? "前走" : (i + 1) + "走前") + "｜" +
        (run.grade || "—") + " " + run.surface + run.distance + "m｜" +
        run.finish + "着/" + run.field + "頭｜R " + (run.rating ?? "—") +
        "｜距離近似 " + similarity + "%";
      list.appendChild(row);
    });
    details.append(summary, list);
    return details;
  }

  function renderCompare() {
    const grid = document.getElementById("raceCompareGrid");
    const status = document.getElementById("raceCompareStatus");
    status.textContent = selected.size + "/3頭";
    grid.innerHTML = "";

    if (!selected.size) {
      grid.innerHTML = '<p class="notice">表の「比較」にチェックを入れると、ここに指標の内訳を表示します。</p>';
      return;
    }

    [...selected].forEach((number) => {
      const horse = scored.find((h) => h.number === number);
      if (!horse) return;
      const card = document.createElement("article");
      card.className = "race-compare-card";
      const h3 = document.createElement("h3");
      h3.textContent = horse.number + " " + horse.name;
      const p = document.createElement("p");
      p.textContent = horse.sexAge + " / " + horse.jockey + " / 総合 " + horse.score.toFixed(1);
      const blood = document.createElement("p");
      blood.className = "race-pedigree-line";
      blood.textContent = "父 " + horse.pedigree.sire + "｜母父 " + horse.pedigree.damsire;
      card.append(h3, p, blood);
      card.append(
        metric("基礎能力", horse.ability),
        metric("近走", horse.form),
        metric("距離 " + race.distance + "m", horse.distanceFit),
        metric("コース", horse.course),
        metric("馬場 " + (race.going || "—"), horse.going),
        metric("騎手", horse.jockeyFit),
        metric("血統距離", horse.pedigreeFit),
        metric("格", horse.classLevel)
      );

      const noteBox = document.createElement("div");
      noteBox.className = "race-notes";
      notes(horse).forEach((text) => {
        const n = document.createElement("div");
        n.className = "race-note";
        n.textContent = "・" + text;
        noteBox.appendChild(n);
      });
      card.append(noteBox, recentRunsBlock(horse));
      grid.appendChild(card);
    });
  }

  function renderTop() {
    const holder = document.getElementById("raceTopSummary");
    holder.innerHTML = "";
    [...scored].sort((a,b) => b.score - a.score).slice(0,3).forEach((horse, i) => {
      const card = document.createElement("div");
      card.className = "race-summary-card";
      const rank = document.createElement("span");
      rank.textContent = "指数 " + (i + 1) + "位";
      const name = document.createElement("strong");
      name.textContent = horse.number + " " + horse.name + "  " + horse.score.toFixed(1);
      const detail = document.createElement("small");
      const n = notes(horse);
      detail.textContent = n.length ? n.join(" / ") : "各指標を総合して算出";
      card.append(rank, name, detail);
      holder.appendChild(card);
    });
  }

  try {
    const res = await fetch(DATA_URL, {cache: "no-store"});
    if (!res.ok) throw new Error("race data");
    const data = await res.json();
    race = data.race;
    renderMeta(race);
    scored = Array.isArray(data.horses) ? data.horses.map((horse) => calculate(horse, race)) : [];
    document.getElementById("raceHorseCount").textContent = scored.length + "頭";

    if (!scored.length) {
      const message = race.statusMessage || "出走馬データはまだ公開されていません。";
      document.getElementById("raceTopSummary").innerHTML = '<p class="notice">' + message + '</p>';
      tableBody.innerHTML = '<tr><td colspan="12">' + message + '</td></tr>';
      document.getElementById("raceSort").disabled = true;
      return;
    }

    renderTop();
    renderTable();
    document.getElementById("raceSort").addEventListener("change", (e) => renderTable(e.target.value));
  } catch (error) {
    console.warn("Horse racing analysis error:", error);
    tableBody.innerHTML = '<tr><td colspan="12">データを読み込めませんでした。</td></tr>';
    document.getElementById("raceTopSummary").innerHTML =
      '<p class="notice">分析データを読み込めませんでした。</p>';
  }
});