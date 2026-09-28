document.addEventListener("DOMContentLoaded", async () => {
  const scheduleUrl = "../../assets/data/horse-racing-past-schedule.json";
  const holder = document.getElementById("pastRaceDays");

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

  function venuePanel(venue) {
    const section = document.createElement("section");
    section.className = "card race-compact-venue";

    const heading = document.createElement("div");
    heading.className = "race-compact-venue-head";

    const h3 = document.createElement("h2");
    h3.textContent = venue.name;

    const count = document.createElement("span");
    count.className = "tools-count";
    count.textContent = (venue.races || []).length + "レース";

    heading.append(h3, count);

    const list = document.createElement("div");
    list.className = "race-compact-list";
    (venue.races || []).forEach((race) => list.appendChild(raceRow(race)));

    section.append(heading, list);
    return section;
  }

  function dayBlock(day) {
    const section = document.createElement("section");
    section.className = "race-archive-day";

    const head = document.createElement("div");
    head.className = "race-archive-day-head";

    const h2 = document.createElement("h2");
    h2.textContent = day.label;

    const source = document.createElement("a");
    source.href = day.sourceUrl;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    source.textContent = "JRA";

    head.append(h2, source);

    const panels = document.createElement("div");
    panels.className = "race-venue-panels";
    (day.venues || []).forEach((venue) => panels.appendChild(venuePanel(venue)));

    section.append(head, panels);
    return section;
  }

  try {
    const res = await fetch(scheduleUrl, {cache: "no-store"});
    if (!res.ok) throw new Error("past schedule");
    const data = await res.json();

    holder.innerHTML = "";
    (data.days || []).forEach((day) => holder.appendChild(dayBlock(day)));

    if (!data.days || !data.days.length) {
      holder.innerHTML = '<section class="card"><p class="notice">過去レースがありません。</p></section>';
    }
  } catch (error) {
    holder.innerHTML =
      '<section class="card"><p class="notice">過去レースを読み込めませんでした。</p></section>';
  }
});