document.addEventListener("DOMContentLoaded", async () => {
  const scheduleUrl = "../../assets/data/horse-racing-next-schedule.json";
  const panels = document.getElementById("raceVenuePanels");

  function venueId(name, index) {
    const known = {
      "東京": "tokyo", "京都": "kyoto", "中山": "nakayama", "阪神": "hanshin",
      "中京": "chukyo", "新潟": "niigata", "福島": "fukushima",
      "小倉": "kokura", "札幌": "sapporo", "函館": "hakodate"
    };
    return "venue-" + (known[name] || ("v" + index));
  }

  function raceRow(race) {
    const a = document.createElement("a");
    a.className = "race-compact-row";
    a.href = "analysis.html?race=" + encodeURIComponent(race.key);
    a.setAttribute("aria-label", race.raceNo + "R " + race.title + " " + race.surface + race.distance + "m");

    const no = document.createElement("strong");
    no.className = "race-compact-no";
    no.textContent = race.raceNo + "R";

    const title = document.createElement("span");
    title.className = "race-compact-title";
    title.textContent = race.title;

    const course = document.createElement("span");
    course.className = "race-compact-course";
    course.textContent =
      race.surface + race.distance + "m" +
      (race.courseDetail ? " " + race.courseDetail : "");

    a.append(no, title, course);
    return a;
  }

  function venuePanel(venue, index) {
    const section = document.createElement("section");
    section.className = "card race-compact-venue";
    section.id = venueId(venue.name, index);

    const heading = document.createElement("div");
    heading.className = "race-compact-venue-head";

    const h2 = document.createElement("h2");
    h2.textContent = venue.name;

    const count = document.createElement("span");
    count.className = "tools-count";
    count.textContent = (venue.races || []).length + "レース";

    heading.append(h2, count);

    const list = document.createElement("div");
    list.className = "race-compact-list";
    (venue.races || []).forEach((race) => list.appendChild(raceRow(race)));

    section.append(heading, list);
    return section;
  }

  try {
    const res = await fetch(scheduleUrl, {cache: "no-store"});
    if (!res.ok) throw new Error("schedule");
    const data = await res.json();

    document.getElementById("nextRaceDateTitle").textContent =
      data.label + "｜全レース";
    const source = document.getElementById("nextRaceSource");
    source.href = data.sourceUrl;
    source.textContent = data.sourceUrl;

    panels.innerHTML = "";

    (data.venues || []).forEach((venue, index) => {
      panels.appendChild(venuePanel(venue, index));
    });

    if (!data.venues || !data.venues.length) {
      panels.innerHTML = '<section class="card"><p class="notice">開催予定がありません。</p></section>';
    }
  } catch (error) {
    panels.innerHTML =
      '<section class="card"><p class="notice">開催予定を読み込めませんでした。</p></section>';
  }
});