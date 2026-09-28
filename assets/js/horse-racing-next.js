document.addEventListener("DOMContentLoaded", async () => {
  const scheduleUrl = "../../assets/data/horse-racing-next-schedule.json";

  function raceCard(race) {
    const a = document.createElement("a");
    a.className = "race-schedule-card";
    a.href = "analysis.html?race=" + encodeURIComponent(race.key);

    const top = document.createElement("div");
    top.className = "race-schedule-card-top";

    const no = document.createElement("strong");
    no.className = "race-schedule-no";
    no.textContent = race.raceNo + "R";

    const time = document.createElement("span");
    time.className = "race-schedule-time";
    time.textContent = race.postTime || "--:--";

    top.append(no, time);

    const title = document.createElement("span");
    title.className = "race-schedule-title";
    title.textContent = race.title;

    const meta = document.createElement("span");
    meta.className = "race-schedule-meta";
    meta.textContent =
      (race.subtitle ? race.subtitle + "｜" : "") +
      race.surface + race.distance + "m" +
      (race.courseDetail ? " " + race.courseDetail : "");

    a.append(top, title, meta);
    return a;
  }

  function renderVenue(containerId, countId, venues, emptyText) {
    const holder = document.getElementById(containerId);
    const count = document.getElementById(countId);
    holder.innerHTML = "";

    const races = venues.flatMap((venue) =>
      (venue.races || []).map((race) => ({...race, venueName: venue.name}))
    );

    if (!races.length) {
      const p = document.createElement("p");
      p.className = "notice";
      p.textContent = emptyText;
      holder.appendChild(p);
      count.textContent = "開催なし";
      return;
    }

    count.textContent = races.length + "レース";

    venues.forEach((venue) => {
      if (venues.length > 1) {
        const heading = document.createElement("h3");
        heading.className = "race-other-venue-heading";
        heading.textContent = venue.name;
        holder.appendChild(heading);
      }
      (venue.races || []).forEach((race) => holder.appendChild(raceCard(race)));
    });
  }

  try {
    const res = await fetch(scheduleUrl, {cache: "no-store"});
    if (!res.ok) throw new Error("schedule");
    const data = await res.json();

    document.getElementById("nextRaceDateTitle").textContent =
      data.label + "｜全レース";
    document.getElementById("nextRaceScheduleNote").textContent = data.note || "";

    const tokyo = data.venues.filter((v) => v.name === "東京");
    const kyoto = data.venues.filter((v) => v.name === "京都");
    const other = data.venues.filter((v) => !["東京", "京都"].includes(v.name));

    renderVenue("tokyoRaceGrid", "tokyoRaceCount", tokyo, "東京開催はありません。");
    renderVenue("kyotoRaceGrid", "kyotoRaceCount", kyoto, "京都開催はありません。");
    renderVenue(
      "otherRaceGrid",
      "otherRaceCount",
      other,
      "この日のJRA開催は東京・京都のみで、その他競馬場の開催はありません。"
    );
  } catch (error) {
    ["tokyoRaceGrid", "kyotoRaceGrid", "otherRaceGrid"].forEach((id) => {
      document.getElementById(id).innerHTML =
        '<p class="notice">開催予定を読み込めませんでした。</p>';
    });
  }
});