document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.getElementById("raceTableBody");
  if (!tableBody) return;

  const DATA_URL = "../../assets/data/horse-racing-sprinters-2026.json";
  const gradeScore = {
    "GⅠ": 100, "JpnⅠ": 95, "GⅡ": 85, "JpnⅡ": 82,
    "GⅢ": 75, "JpnⅢ": 72, "L": 65, "OP": 60, "3勝": 50
  };

  // 試験的な距離タイプ辞書。産駒統計ではなく、血統の参考要素を
  // 数値化するための小さな補助指標なので総合指数への重みは5%に限定。
  const pedigreeProfile = {
    "ロードカナロア": 94, "ディープインパクト": 60,
    "キズナ": 62, "シンボリクリスエス": 50,
    "クロフネ": 82, "キングカメハメハ": 72,
    "American Pharoah": 60, "Galileo": 42,
    "ミッキーアイル": 92, "ケイムホーム": 82,
    "ゼンノロブロイ": 50, "キンシャサノキセキ": 96,
    "マクフィ": 72, "ハーツクライ": 50,
    "ドレフォン": 80, "ダイワメジャー": 86,
    "タワーオブロンドン": 96, "エンパイアメーカー": 52,
    "ドゥラメンテ": 56, "New Approach": 56,
    "キタサンブラック": 46, "トゥザワールド": 56,
    "ヴィクトワールピサ": 56, "スクリーンヒーロー": 62,
    "マイネルラヴ": 92, "サートゥルナーリア": 58,
    "サクラバクシンオー": 100, "アジアエクスプレス": 72
  };

  const selected = new Set();
  let scored = [];

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const round1 = (n) => Math.round(n * 10) / 10;

  function finishScore(run) {
    if (!run || run.field <= 1) return 50;
    return clamp((run.field - run.finish) / (run.field - 1) * 100, 0, 100);
  }

  function weightedAverage(rows) {
    if (!rows.length) return 55;
    let sum = 0;
    let weight = 0;
    rows.forEach(({value, w}) => {
      sum += value * w;
      weight += w;
    });
    return weight ? sum / weight : 55;
  }

  function evidenceScore(rows) {
    if (!Array.isArray(rows) || !rows.length) return 55;
    return rows.reduce((sum, row) => sum + finishScore(row), 0) / rows.length;
  }

  function pedigreeScore(horse) {
    const sire = pedigreeProfile[horse.pedigree?.sire] ?? 55;
    const damsire = pedigreeProfile[horse.pedigree?.damsire] ?? 55;
    return sire * .7 + damsire * .3;
  }

  function jockeyScore(horse) {
    const indexes = Array.isArray(horse.sameJockeyRunIndexes) ? horse.sameJockeyRunIndexes : [];
    if (!indexes.length) return 50;
    const weights = [4, 3, 2, 1];
    const rows = indexes
      .filter((i) => horse.runs[i])
      .map((i) => ({value: finishScore(horse.runs[i]), w: weights[i] || 1}));
    const performance = weightedAverage(rows);
    const continuityWeight = indexes.reduce((sum, i) => sum + (weights[i] || 1), 0) / 10 * 100;
    return performance * .65 + continuityWeight * .35;
  }

  function calculate(horse) {
    const recentRatings = horse.runs.map((r) => r.rating).filter(Number.isFinite);
    const baseRating = Number.isFinite(horse.preRating)
      ? horse.preRating
      : (recentRatings.length ? Math.max(...recentRatings) : 100);
    const ability = clamp((baseRating - 90) / 30 * 100, 0, 100);

    const weights = [4, 3, 2, 1];
    const form = weightedAverage(horse.runs.map((run, i) => ({
      value: finishScore(run),
      w: weights[i] || 1
    })));

    const sprintRuns = horse.runs
      .map((run, i) => ({run, w: weights[i] || 1}))
      .filter(({run}) => run.surface === "芝" && run.distance >= 1000 && run.distance <= 1200);
    const sprint = sprintRuns.length
      ? weightedAverage(sprintRuns.map(({run, w}) => ({value: finishScore(run), w})))
      : 50;

    const course = evidenceScore(horse.courseEvidence);
    const going = evidenceScore(horse.goingEvidence);
    const jockey = jockeyScore(horse);
    const pedigree = pedigreeScore(horse);
    const classLevel = Math.max(...horse.runs.map((r) => gradeScore[r.grade] || 45), 45);

    const total =
      ability * .25 +
      form * .20 +
      sprint * .15 +
      course * .10 +
      going * .10 +
      jockey * .10 +
      pedigree * .05 +
      classLevel * .05;

    return {
      ...horse,
      ability: round1(ability),
      form: round1(form),
      sprint: round1(sprint),
      course: round1(course),
      going: round1(going),
      jockeyFit: round1(jockey),
      pedigreeFit: round1(pedigree),
      classLevel: round1(classLevel),
      score: round1(total),
      baseRating
    };
  }

  function notes(horse) {
    const strengths = [];
    const cautions = [];
    if (horse.baseRating >= 114) strengths.push("レーティング水準が高い");
    if (horse.form >= 75) strengths.push("近4走の内容が安定");
    if (horse.sprint >= 78) strengths.push("芝1000〜1200mの近走が強い");
    if (horse.courseEvidence?.length && horse.course >= 75) strengths.push("中山芝1200m実績が高い");
    if (horse.goingEvidence?.length && horse.going >= 75) strengths.push("道悪の短距離実績が高い");
    if ((horse.sameJockeyRunIndexes || []).length >= 3) strengths.push("現騎手との継続性が高い");
    if (horse.pedigreeFit >= 85) strengths.push("短距離寄りの血統シグナル");
    if (!horse.courseEvidence?.length) cautions.push("近4走に中山芝1200m実績なし");
    if (!(horse.sameJockeyRunIndexes || []).length) cautions.push("近4走から現騎手との実戦相性を確認できない");
    return [...strengths.slice(0, 3), ...cautions.slice(0, 1)];
  }

  function renderMeta(race) {
    document.getElementById("raceTitle").textContent = race.title + "｜出走馬実力比較";
    document.getElementById("raceLead").textContent =
      race.date.replaceAll("-", "/") + " " + race.venue + race.raceNo + "Rを、近4走・騎手・血統・コース・馬場まで含めて比較します。";
    const meta = document.getElementById("raceMeta");
    meta.innerHTML = "";
    [
      race.date.replaceAll("-", "/"),
      race.venue + race.raceNo + "R",
      race.grade,
      race.surface + race.distance + "m",
      race.direction,
      "馬場 " + (race.going || "未設定")
    ].forEach((text) => {
      const span = document.createElement("span");
      span.textContent = text;
      meta.appendChild(span);
    });
    document.getElementById("raceSource").href = race.sourceUrl;
  }

  function sortRows(mode) {
    const rows = [...scored];
    const keyMap = {
      rating: "ability", form: "form", sprint: "sprint", course: "course",
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
        td(horse.sprint.toFixed(1)), td(horse.course.toFixed(1)),
        td(horse.going.toFixed(1)), td(horse.jockeyFit.toFixed(1)),
        td(horse.pedigreeFit.toFixed(1)), td(horse.classLevel.toFixed(1)),
        td(horse.popularity + "人気 / " + horse.odds.toFixed(1)), checkCell
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
      row.textContent =
        (i === 0 ? "前走" : (i + 1) + "走前") + "｜" +
        (run.grade || "—") + " " + run.surface + run.distance + "m｜" +
        run.finish + "着/" + run.field + "頭｜R " + (run.rating ?? "—");
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
        metric("基礎能力", horse.ability), metric("近走", horse.form),
        metric("短距離", horse.sprint), metric("コース", horse.course),
        metric("馬場", horse.going), metric("騎手", horse.jockeyFit),
        metric("血統", horse.pedigreeFit), metric("格", horse.classLevel)
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
    renderMeta(data.race);
    scored = data.horses.map(calculate);
    document.getElementById("raceHorseCount").textContent = scored.length + "頭";
    renderTop();
    renderTable();
    document.getElementById("raceSort").addEventListener("change", (e) => renderTable(e.target.value));
  } catch (error) {
    console.warn("Horse racing analysis error:", error);
    tableBody.innerHTML = '<tr><td colspan="13">データを読み込めませんでした。</td></tr>';
    document.getElementById("raceTopSummary").innerHTML =
      '<p class="notice">分析データを読み込めませんでした。</p>';
  }
});