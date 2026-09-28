document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.getElementById("raceTableBody");
  if (!tableBody) return;

  const DATA_URL = "../../assets/data/horse-racing-sprinters-2026.json";
  const gradeScore = {
    "GⅠ": 100, "JpnⅠ": 95, "GⅡ": 85, "JpnⅡ": 82,
    "GⅢ": 75, "JpnⅢ": 72, "L": 65, "OP": 60, "3勝": 50
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
    if (!rows.length) return 50;
    let sum = 0;
    let weight = 0;
    rows.forEach(({value, w}) => {
      sum += value * w;
      weight += w;
    });
    return weight ? sum / weight : 50;
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
      : 45;

    const classLevel = Math.max(...horse.runs.map((r) => gradeScore[r.grade] || 45), 45);
    const total = ability * .40 + form * .30 + sprint * .20 + classLevel * .10;

    return {
      ...horse,
      ability: round1(ability),
      form: round1(form),
      sprint: round1(sprint),
      classLevel: round1(classLevel),
      score: round1(total),
      baseRating
    };
  }

  function notes(horse) {
    const strengths = [];
    const cautions = [];
    if (horse.baseRating >= 114) strengths.push("レーティング水準が高い");
    if (horse.form >= 75) strengths.push("近4走の着順内容が安定");
    if (horse.sprint >= 78) strengths.push("芝1000〜1200mの近走成績が強い");
    if (horse.runs[0] && horse.runs[0].finish === 1) strengths.push("前走勝利");
    if (!horse.runs.some((r) => r.surface === "芝" && r.distance <= 1200)) cautions.push("近4走に芝1200m以下の実績なし");
    if (horse.runs[0] && horse.runs[0].finish >= 10) cautions.push("前走着順は二桁");
    if (horse.sprint < 45) cautions.push("短距離近走の安定度は低め");
    return [...strengths.slice(0, 2), ...cautions.slice(0, 1)];
  }

  function renderMeta(race) {
    document.getElementById("raceTitle").textContent = race.title + "｜出走馬実力比較";
    document.getElementById("raceLead").textContent =
      race.date.replaceAll("-", "/") + " " + race.venue + race.raceNo + "Rを、出走表の実績だけで比較します。";
    const meta = document.getElementById("raceMeta");
    [
      race.date.replaceAll("-", "/"),
      race.venue + race.raceNo + "R",
      race.grade,
      race.surface + race.distance + "m",
      race.direction
    ].forEach((text) => {
      const span = document.createElement("span");
      span.textContent = text;
      meta.appendChild(span);
    });
    const source = document.getElementById("raceSource");
    source.href = race.sourceUrl;
  }

  function sortRows(mode) {
    const rows = [...scored];
    const key = mode === "rating" ? "ability" : mode === "form" ? "form" : mode === "sprint" ? "sprint" : "score";
    if (mode === "number") return rows.sort((a, b) => a.number - b.number);
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
      sub.textContent = horse.sexAge + " / " + horse.jockey + " / PR " + (horse.preRating ?? "—");
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
        rank,
        horseCell,
        td(horse.score.toFixed(1), "race-score"),
        td(horse.ability.toFixed(1)),
        td(horse.form.toFixed(1)),
        td(horse.sprint.toFixed(1)),
        td(horse.classLevel.toFixed(1)),
        td(horse.popularity + "人気 / " + horse.odds.toFixed(1)),
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
      card.append(h3, p);
      card.append(
        metric("基礎能力", horse.ability),
        metric("近走", horse.form),
        metric("短距離", horse.sprint),
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
      card.appendChild(noteBox);
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

    const sort = document.getElementById("raceSort");
    sort.addEventListener("change", () => renderTable(sort.value));
  } catch (error) {
    console.warn("Horse racing analysis error:", error);
    tableBody.innerHTML = '<tr><td colspan="9">データを読み込めませんでした。</td></tr>';
    document.getElementById("raceTopSummary").innerHTML =
      '<p class="notice">分析データを読み込めませんでした。</p>';
  }
});