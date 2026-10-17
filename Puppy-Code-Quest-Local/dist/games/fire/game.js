"use strict";
const $ = (id) => document.getElementById(id),
  dir = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] },
  icons = { U: "↑", D: "↓", L: "←", R: "→", F: "💧", S: "〰", A: "♡" },
  names = {
    U: "Up",
    D: "Down",
    L: "Left",
    R: "Right",
    F: "Fill",
    S: "Spray",
    A: "Rescue",
  };

const truckSVG =
  '<svg viewBox="0 0 100 100"><rect x="17" y="21" width="12" height="20" rx="5" fill="#314348"/><rect x="71" y="21" width="12" height="20" rx="5" fill="#314348"/><rect x="17" y="65" width="12" height="20" rx="5" fill="#314348"/><rect x="71" y="65" width="12" height="20" rx="5" fill="#314348"/><rect x="23" y="9" width="54" height="83" rx="13" fill="#a64e43"/><rect x="25" y="8" width="50" height="80" rx="11" fill="#e17a64"/><rect x="29" y="11" width="42" height="27" rx="7" fill="#f29b7c"/><rect x="32" y="14" width="36" height="15" rx="5" fill="#bce1e3"/><path d="M37 15l-3 12m12-12-3 12" stroke="#efffff" stroke-width="3"/><rect x="29" y="42" width="42" height="41" rx="5" fill="#c35d50"/><rect x="34" y="44" width="32" height="35" rx="3" fill="#eee7cf"/><path d="M39 45v33m22-33v33M39 50h22M39 58h22M39 66h22M39 74h22" stroke="#9b9f96" stroke-width="3"/><rect x="31" y="32" width="38" height="7" rx="3" fill="#fff0d0"/><rect class="lights" x="32" y="33" width="13" height="5" rx="2" fill="#ed5259"/><rect class="lights" x="55" y="33" width="13" height="5" rx="2" fill="#69b8db"/><rect x="29" y="83" width="42" height="5" rx="2" fill="#f5dba7"/><circle cx="28" cy="17" r="3" fill="#fff3ba"/><circle cx="72" cy="17" r="3" fill="#fff3ba"/></svg>';
let pendingInsert = null,
  lastPrompt = "",
  customActive = false,
  draft = null,
  brush = ".";
let idx = 0,
  L = levels[0],
  mode = "explore",
  state,
  program = [],
  notes = [],
  history = [],
  selected = -1,
  bad = -1,
  cursor = 0,
  running = false,
  started = false,
  token = 0,
  facing = 0,
  hint = false,
  notesHidden = false,
  voice = true,
  saved = {},
  sprayTimer;
try {
  saved = JSON.parse(localStorage.getItem("fire-rescue-progress-v2") || "{}");
} catch {}
function initial() {
  let p = L.rows.join("").indexOf("P");
  return {
    x: p % L.rows[0].length,
    y: Math.floor(p / L.rows[0].length),
    water: L.water,
    out: [],
    rescued: [],
  };
}
function targets() {
  let a = [];
  L.rows.forEach((r, y) =>
    [...r].forEach((c, x) => {
      if (c === "A" || c === "B") a.push({ x, y, key: x + "," + y, c });
    }),
  );
  return a;
}
function adjacent(s, c) {
  let a = [];
  L.rows.forEach((r, y) =>
    [...r].forEach((v, x) => {
      if (c.includes(v) && Math.abs(s.x - x) + Math.abs(s.y - y) === 1)
        a.push({ x, y, key: x + "," + y, c: v });
    }),
  );
  return a;
}
function apply(s, action) {
  const n = { ...s, out: [...s.out], rescued: [...s.rescued] };
  if (dir[action]) {
    let [dx, dy] = dir[action],
      cell = L.rows[s.y + dy]?.[s.x + dx];
    if (cell !== "." && cell !== "P")
      return {
        ok: false,
        message:
          cell === undefined
            ? "That is the edge of town. Try another arrow."
            : "A building or tree is in the way. Try another road.",
      };
    n.x += dx;
    n.y += dy;
    return { ok: true, s: n };
  }
  if (action === "F") {
    if (!adjacent(s, "H").length)
      return {
        ok: false,
        message: "Park beside a blue hydrant before choosing Fill.",
      };
    n.water = 1;
    return { ok: true, s: n };
  }
  if (action === "S") {
    const t = adjacent(s, "AB").find((t) => !s.out.includes(t.key));
    if (!t)
      return {
        ok: false,
        message: "Park beside a building with a fire before choosing Spray.",
      };
    if (!s.water)
      return {
        ok: false,
        message: "The tank is empty. Visit a blue hydrant and choose Fill.",
      };
    n.water = 0;
    n.out.push(t.key);
    return { ok: true, s: n, target: t };
  }
  if (action === "A") {
    const t = adjacent(s, "AB").find(
      (t) => s.out.includes(t.key) && !s.rescued.includes(t.key),
    );
    if (!t)
      return {
        ok: false,
        message:
          "Put out the fire first, then rescue your friend from beside the building.",
      };
    n.rescued.push(t.key);
    return { ok: true, s: n, target: t };
  }
  return { ok: false, message: "Choose an instruction." };
}
function won() {
  return state.rescued.length === targets().length;
}
let truckAudio = null,
  engineEnabled = true,
  voiceChoice = "";
try {
  voiceChoice = localStorage.getItem("fire-rescue-voice") || "";
} catch {}
function audioReady() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!truckAudio) truckAudio = new AC();
    if (truckAudio.state === "suspended") truckAudio.resume().catch(() => {});
    return truckAudio;
  } catch {
    return null;
  }
}
function engineMove() {
  if (!engineEnabled) return;
  const ctx = audioReady();
  if (!ctx) return;
  const now = ctx.currentTime,
    g = ctx.createGain(),
    filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  filter.connect(g);
  g.connect(ctx.destination);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.045, now + 0.04);
  g.gain.linearRampToValueAtTime(0.025, now + 0.23);
  g.gain.linearRampToValueAtTime(0, now + 0.36);
  for (const [freq, kind] of [
    [75, "sawtooth"],
    [112, "triangle"],
  ]) {
    const o = ctx.createOscillator();
    o.type = kind;
    o.frequency.setValueAtTime(freq, now);
    o.frequency.linearRampToValueAtTime(freq * 1.3, now + 0.12);
    o.frequency.linearRampToValueAtTime(freq * 0.9, now + 0.35);
    o.connect(filter);
    o.start(now);
    o.stop(now + 0.37);
  }
  setTimeout(() => {
    filter.disconnect();
    g.disconnect();
  }, 500);
}
function rescueChime() {
  if (!voice) return;
  const ctx = audioReady();
  if (!ctx) return;
  [523.25, 659.25, 783.99].forEach((hz, i) => {
    let o = ctx.createOscillator(),
      g = ctx.createGain(),
      t = ctx.currentTime + i * 0.1;
    o.type = "sine";
    o.frequency.value = hz;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.32);
    o.onended = () => g.disconnect();
  });
}
function voiceRank(v) {
  return (
    (/en[-_]CA/i.test(v.lang) ? 8 : 0) +
    (/natural|neural|online|premium|enhanced/i.test(v.name) ? 100 : 0) +
    (/clara|claria|jenny|aria|samantha|karen|susan|serena|female/i.test(v.name)
      ? 20
      : 0)
  );
}
function refreshTeacher() {
  if (!window.speechSynthesis) return;
  const select = $("teacherVoice"),
    vs = window.speechSynthesis
      .getVoices()
      .filter((v) => /^en/i.test(v.lang))
      .sort((a, b) => voiceRank(b) - voiceRank(a));
  select.replaceChildren(new Option("Best available natural voice", ""));
  for (const v of vs)
    select.add(new Option(v.name + " · " + v.lang, v.voiceURI));
  select.value = voiceChoice;
  if (select.value !== voiceChoice) voiceChoice = "";
}
function say(t) {
  if (!voice || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t),
    vs = window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
  u.voice =
    vs.find((v) => v.voiceURI === voiceChoice) ||
    vs.sort((a, b) => voiceRank(b) - voiceRank(a))[0] ||
    null;
  u.lang = u.voice?.lang || "en-CA";
  u.rate = 1.02;
  u.pitch = 1.06;
  window.speechSynthesis.speak(u);
}

function message(t, speak = false) {
  $("feedback").textContent = t;
  if (speak) say(t);
}
function stop() {
  running = false;
  token++;
}
function reset() {
  stop();
  pendingInsert = null;
  lastPrompt = "";
  state = initial();
  cursor = 0;
  started = false;
  bad = -1;
  facing = 0;
  clearTimeout(sprayTimer);
  $("effects").innerHTML = "";
  $("success").hidden = true;
  render();
}
function load(i) {
  customActive = false;
  idx = i;
  L = levels[i];
  mode = "explore";
  program = [];
  notes = [];
  history = [];
  selected = -1;
  hint = false;
  $("clueText").hidden = true;
  reset();
  $("world").textContent = L.world;
  $("title").textContent = L.title;
  $("subtitle").textContent = L.desc;
  $("mission").textContent =
    "SUNNYBROOK · MISSION " + String(i + 1).padStart(2, "0");
  message("Your crew is ready. Take the wheel and explore!");
  render();
}
function switchMode(m) {
  mode = m;
  selected = -1;
  reset();
  if (m === "explore") {
    for (const a of notes) {
      const r = apply(state, a);
      if (r.ok) state = r.s;
    }
  }
  message(
    m === "code"
      ? "Use your driving notes to build your own rescue program."
      : "Drive with the green arrows. Every successful action is saved.",
  );
  render();
}
function drive(a) {
  if (mode !== "explore" || won()) return;
  const r = apply(state, a);
  if (!r.ok) {
    message(r.message, true);
    return;
  }
  state = r.s;
  notes.push(a);
  if (dir[a]) facing = { U: 0, R: 90, D: 180, L: 270 }[a];
  render();
  effect(a, r);
  promptContext(a, r);
  checkWin();
}
function effect(a, r) {
  if (dir[a]) engineMove();
  if (a === "A") rescueChime();
  if (a === "S" && r.target) {
    const n = L.rows.length,
      x = ((state.x + 0.5) * 100) / n,
      y = ((state.y + 0.5) * 100) / n,
      tx = ((r.target.x + 0.5) * 100) / n,
      ty = ((r.target.y + 0.5) * 100) / n;
    $("effects").innerHTML =
      '<line class="spray" x1="' +
      x +
      '" y1="' +
      y +
      '" x2="' +
      tx +
      '" y2="' +
      ty +
      '" stroke="#ecffff" stroke-width="2.5"/><line class="spray" x1="' +
      x +
      '" y1="' +
      y +
      '" x2="' +
      tx +
      '" y2="' +
      ty +
      '" stroke="#77cadf" stroke-width="1"/>';
    clearTimeout(sprayTimer);
    sprayTimer = setTimeout(() => ($("effects").innerHTML = ""), 600);
  }
  if (a === "F") message("Tank full! You have water for one fire.");
  if (a === "A") message("A friend is safe. Great helping!");
}
function checkWin() {
  if (!won()) return false;
  stop();
  started = false;
  $("success").hidden = false;
  $("successText").textContent =
    mode === "explore"
      ? "You found a rescue route! Now teach your truck with code."
      : "Your instructions worked. Every friend is safe!";
  $("next").textContent =
    mode === "explore"
      ? "Build this rescue in code →"
      : customActive
        ? "Edit my town →"
        : idx === levels.length - 1
          ? "Play the first rescue again →"
          : "Next rescue →";
  if (mode === "code" && !customActive) {
    saved[idx] = true;
    try {
      localStorage.setItem("fire-rescue-progress-v2", JSON.stringify(saved));
    } catch {}
  }
  say(
    "Good job, Justin! You saved the " +
      animal(targets().find((t) => t.key === state.rescued.at(-1)))
        .replace(/[🐱🐶]/gu, "")
        .trim() +
      ". Every friend is safe. Hooray!",
  );
  render();
  return true;
}
function edit(fn) {
  if (running) return;
  history.push([...program]);
  fn();
  pendingInsert = null;
  selected = -1;
  reset();
  render();
}
function add(a) {
  if (mode !== "code" || running) return;
  if (program.length >= (customActive ? 200 : 100) && selected < 0) {
    message("Your program is full. Remove or replace a block.");
    return;
  }
  edit(() => {
    if (pendingInsert !== null) {
      program.splice(pendingInsert, 0, a);
      pendingInsert = null;
    } else if (selected >= 0) program[selected] = a;
    else program.push(a);
  });
}
function tick() {
  if (cursor >= program.length) {
    stop();
    started = false;
    message(
      "Your code finished. Add more instructions to complete the rescue.",
    );
    render();
    return false;
  }
  let i = cursor,
    a = program[i],
    r = apply(state, a);
  if (!r.ok) {
    bad = i;
    selected = i;
    stop();
    started = false;
    message(
      "Block " + (i + 1) + ": " + r.message + " Choose a replacement above.",
      true,
    );
    render();
    return false;
  }
  state = r.s;
  if (dir[a]) facing = { U: 0, R: 90, D: 180, L: 270 }[a];
  cursor++;
  render();
  effect(a, r);
  promptContext(a, r);
  if (checkWin()) return false;
  if (cursor === program.length) {
    stop();
    started = false;
    message("Good start! Add more instructions, then test from the station.");
    render();
    return false;
  }
  return true;
}
function prepare() {
  if (!program.length) {
    message("Add an instruction first.");
    return false;
  }
  if (!started) {
    state = initial();
    cursor = 0;
    started = true;
    bad = -1;
    selected = -1;
    $("success").hidden = true;
  }
  return true;
}
async function run() {
  audioReady();
  if (running) {
    stop();
    render();
    return;
  }
  if (!prepare()) return;
  running = true;
  render();
  const t = ++token;
  while (running && token === t) {
    await new Promise((r) => setTimeout(r, +$("pace").value));
    if (!running || t !== token) break;
    if (!tick()) break;
  }
}
function svg(content) {
  return '<svg viewBox="0 0 100 100" aria-hidden="true">' + content + "</svg>";
}
function tileArt(c, x, y) {
  const key = x + "," + y,
    off = state.out.includes(key),
    rescued = state.rescued.includes(key);
  if (c === "." || c === "P") {
    let lines = "";
    for (const [a, [dx, dy]] of Object.entries(dir)) {
      let v = L.rows[y + dy]?.[x + dx];
      if (v === "." || v === "P")
        lines +=
          '<path d="M50 50L' +
          (50 + dx * 50) +
          " " +
          (50 + dy * 50) +
          '" stroke="#f0eee0" stroke-width="2" stroke-dasharray="6 7"/>';
    }
    return svg(
      '<rect width="100" height="100" fill="#cbd1c5"/><rect x="2" y="2" width="96" height="96" rx="13" fill="#d3d8cd"/>' +
        lines +
        (c === "P"
          ? '<rect x="32" y="34" width="36" height="32" rx="6" fill="#b7c2af"/><text x="50" y="56" font-family="sans-serif" font-weight="bold" font-size="18" text-anchor="middle" fill="#edf0e2">P</text>'
          : ""),
    );
  }
  if (c === "#")
    return svg(
      '<rect width="100" height="100" fill="#bcd1a5"/><path d="M9 19h9m55 65h10m-63-6h5" stroke="#9fbd87" stroke-width="3" stroke-linecap="round"/><ellipse cx="53" cy="75" rx="29" ry="9" fill="#7e9f6a33"/><rect x="46" y="48" width="9" height="29" rx="4" fill="#a8936c"/><circle cx="50" cy="38" r="29" fill="#719965"/><circle cx="40" cy="30" r="21" fill="#87ad75"/><circle cx="63" cy="39" r="18" fill="#7da66b"/><circle cx="33" cy="36" r="5" fill="#a1c18b"/>',
    );
  if (c === "H")
    return svg(
      '<rect width="100" height="100" fill="#bfd6b1"/><rect x="15" y="15" width="70" height="70" rx="20" fill="#dfebd2"/><ellipse cx="50" cy="74" rx="23" ry="6" fill="#7a9a9333"/><rect x="40" y="32" width="20" height="43" rx="7" fill="#6ca7b9"/><rect x="30" y="43" width="40" height="13" rx="5" fill="#88beca"/><rect x="38" y="68" width="24" height="8" rx="3" fill="#538e9c"/><path d="M37 32a13 13 0 0 1 26 0" fill="#9acbd5"/><circle cx="50" cy="49" r="5" fill="#d5ece9"/><path d="M50 10c-9 10-7 14 0 14s9-4 0-14" fill="#f4ffff"/>',
    );
  let fire = off
    ? ""
    : '<g class="flame"><path d="M73 17c-15 15-19 23-10 31 12 9 25-4 19-15-5 4-6-4-9-16" fill="#ed9560"/><path d="M73 30c-10 10-9 17-1 17s10-7 1-17" fill="#ffe1a0"/></g>';
  return svg(
    '<rect width="100" height="100" fill="#c8d7b5"/><ellipse cx="50" cy="84" rx="39" ry="7" fill="#768a6a22"/><rect x="18" y="30" width="64" height="52" rx="5" fill="' +
      (c === "A" ? "#f2d2a3" : "#dfc4c1") +
      '"/><path d="M12 34L50 11l38 23v7H12z" fill="' +
      (c === "A" ? "#be8e76" : "#8797ac") +
      '"/><path d="M19 31L50 15l31 16" fill="none" stroke="#ffffff33" stroke-width="3"/><rect x="25" y="45" width="18" height="19" rx="3" fill="#afc8bd"/><path d="M34 45v19m-9-9h18" stroke="#edf2de" stroke-width="2"/><rect x="53" y="46" width="21" height="35" rx="6" fill="#baa88b"/><rect x="20" y="78" width="60" height="7" rx="2" fill="#e5ddc7"/>' +
      (rescued
        ? '<circle cx="64" cy="60" r="12" fill="#7fa87e"/><path d="M58 60l4 4 8-9" stroke="#fff7d5" stroke-width="3" fill="none"/>'
        : '<text x="63" y="70" text-anchor="middle" font-size="25">' +
          (c === "A" ? "🐱" : "🐶") +
          "</text>") +
      fire,
  );
}
function render() {
  const n = L.rows.length;
  $("tiles").style.gridTemplateColumns = "repeat(" + n + ",1fr)";
  $("tiles").replaceChildren();
  L.rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      const b = document.createElement("button"),
        a = Object.keys(dir).find(
          (a) => state.x + dir[a][0] === x && state.y + dir[a][1] === y,
        ),
        reach = mode === "explore" && a && (c === "." || c === "P") && !won();
      b.className = "tile" + (reach ? " reachable" : "");
      b.innerHTML = tileArt(c, x, y);
      b.setAttribute(
        "aria-label",
        "Row " +
          (y + 1) +
          ", column " +
          (x + 1) +
          ": " +
          {
            P: "station",
            ".": "road",
            "#": "park",
            H: "water hydrant",
            A: "bakery rescue",
            B: "shop rescue",
          }[c],
      );
      b.disabled = !reach;
      b.onclick = () => drive(a);
      $("tiles").append(b);
    }),
  );
  $("truck").style.width = 100 / n + "%";
  $("truck").style.height = 100 / n + "%";
  $("truck").style.left = (state.x * 100) / n + "%";
  $("truck").style.top = (state.y * 100) / n + "%";
  if (!$("truckwrap").innerHTML) $("truckwrap").innerHTML = truckSVG;
  $("truckwrap").firstElementChild.style.transform =
    "rotate(" + facing + "deg)";
  $("water").innerHTML =
    '<span class="water-meter"><span aria-hidden="true" class="tankicon ' +
    (state.water ? "full" : "") +
    '"></span>' +
    (state.water ? "💧 FULL" : "↻ REFILL") +
    "</span>";
  $("water").setAttribute(
    "aria-label",
    state.water
      ? "Water tank full. Ready to spray."
      : "Water tank empty. Refill at a hydrant.",
  );
  $("rescues").textContent = state.rescued.length + " / " + targets().length;
  $("status").textContent = won()
    ? "Good job, Justin! Every friend is safe!"
    : running
      ? "The truck is following your instructions."
      : mode === "explore"
        ? contextPrompt()
        : contextPrompt();
  $("drive").hidden = mode !== "explore";
  $("explorePanel").hidden = mode !== "explore";
  $("codePanel").hidden = mode !== "code";
  $("exploreTab").className = mode === "explore" ? "active" : "";
  $("codeTab").className = mode === "code" ? "active" : "";
  $("program").replaceChildren();
  program.forEach((a, i) => {
    let b = document.createElement("button");
    b.className =
      "block" +
      (!dir[a] ? " action" : "") +
      (i === selected ? " selected" : "") +
      (i === bad ? " error" : "") +
      (running && i === cursor ? " playing" : "");
    b.innerHTML =
      "<small>" +
      (i + 1) +
      "</small>" +
      icons[a] +
      "<small>" +
      names[a] +
      "</small>";
    b.setAttribute("aria-label", "Instruction " + (i + 1) + ": " + names[a]);
    b.disabled = running;
    b.onclick = () => {
      pendingInsert = null;
      selected = selected === i ? -1 : i;
      render();
    };
    enableDragOut(b, $("program"), () => edit(() => program.splice(i, 1)));
    $("program").append(b);
  });
  $("count").textContent = program.length + " blocks";
  $("editRow").hidden = selected < 0 || running;
  $("editHint").textContent =
    pendingInsert !== null
      ? "Choose a move above to insert it."
      : selected >= 0
        ? "Replace block " + (selected + 1) + " using a button above."
        : "Tap to edit · Drag a block outside the box to remove it.";
  $("test").textContent = running
    ? "Ⅱ Pause test"
    : started
      ? "▶ Continue test"
      : "▶ Test my code";
  $("test").disabled = !program.length;
  $("step").disabled = running || !program.length;
  $("undo").disabled = running || !history.length;
  $("remove").disabled = running || selected < 0;
  $("clear").disabled = running || !program.length;
  document
    .querySelectorAll("[data-add]")
    .forEach((b) => (b.disabled = running));
  $("notes").replaceChildren();
  $("notes").hidden = notesHidden;
  $("hideNotes").textContent = notesHidden ? "Show" : "Hide";
  if (!notes.length) {
    $("notes").innerHTML =
      '<span class="muted">Your driving actions will appear here.</span>';
  } else
    notes.forEach((a, i) => {
      const b = document.createElement("span");
      b.className = "note";
      b.innerHTML = "<small>" + (i + 1) + "</small>" + icons[a];
      b.title = names[a];
      $("notes").append(b);
    });
  $("driveUndo").disabled = !notes.length;
  $("driveReset").disabled = !notes.length;
  $("missions").replaceChildren();
  for (let g = 0; g < 4; g++) {
    let d = document.createElement("div");
    d.className = "group";
    d.innerHTML =
      [
        "FIRST RESCUES · 3×3",
        "WATER WORKS · 4×4",
        "HELP THE TOWN · 5×5",
        "RESCUE CAPTAIN · 6×6",
      ][g] + "<div></div>";
    for (let i = g * 3; i < g * 3 + 3; i++) {
      let b = document.createElement("button");
      b.textContent = (saved[i] ? "★ " : "") + (i + 1);
      b.className = !customActive && i === idx ? "current" : "";
      b.setAttribute(
        "aria-label",
        "Mission " + (i + 1) + ": " + levels[i].title,
      );
      b.onclick = () => load(i);
      d.lastElementChild.append(b);
    }
    $("missions").append(d);
  }
}
function solution() {
  let start = initial(),
    queue = [{ s: start, p: [] }],
    seen = new Set();
  for (let k = 0; k < queue.length && k < 25000; k++) {
    let { s, p } = queue[k];
    if (s.rescued.length === targets().length) return p;
    for (let a of ["U", "D", "L", "R", "F", "S", "A"]) {
      let r = apply(s, a);
      if (!r.ok) continue;
      const q = r.s,
        key = [
          q.x,
          q.y,
          q.water,
          [...q.out].sort().join(";"),
          [...q.rescued].sort().join(";"),
        ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ s: q, p: [...p, a] });
    }
  }
  return null;
}
document
  .querySelectorAll("[data-drive]")
  .forEach((b) => (b.onclick = () => drive(b.dataset.drive)));
document
  .querySelectorAll("[data-add]")
  .forEach((b) => (b.onclick = () => add(b.dataset.add)));
$("exploreTab").onclick = () => switchMode("explore");
$("codeTab").onclick = $("buildNow").onclick = () => switchMode("code");
$("test").onclick = run;
$("step").onclick = () => {
  audioReady();
  if (prepare()) tick();
};
$("reset").onclick = reset;
$("clear").onclick = () => edit(() => (program = []));
$("remove").onclick = () => {
  if (selected >= 0) edit(() => program.splice(selected, 1));
};
$("undo").onclick = () => {
  if (!history.length) return;
  program = history.pop();
  selected = -1;
  reset();
};
$("driveUndo").onclick = () => {
  notes.pop();
  state = initial();
  for (const a of notes) state = apply(state, a).s;
  $("success").hidden = true;
  render();
};
$("driveReset").onclick = () => {
  notes = [];
  reset();
};
$("hideNotes").onclick = () => {
  notesHidden = !notesHidden;
  render();
};
$("next").onclick = () => {
  if (mode === "explore") switchMode("code");
  else if (customActive) openBuilder();
  else load((idx + 1) % levels.length);
};
$("clue").onclick = () => {
  hint = !hint;
  $("clueText").hidden = !hint;
  if (hint) {
    const s = solution();
    $("clueText").textContent = s
      ? "From the station: " +
        s.map((a) => icons[a] + " " + names[a]).join(" · ")
      : "Try exploring a new route.";
  }
};
$("sound").onclick = () => {
  voice = !voice;
  $("sound").textContent = voice ? "♪ Teacher on" : "♪ Teacher off";
  if (!voice) window.speechSynthesis?.cancel();
  else say("Welcome to the rescue crew!");
};
$("help").onclick = () => $("helpDialog").showModal();
$("closeHelp").onclick = () => $("helpDialog").close();
window.addEventListener("keydown", (e) => {
  if (
    ["SELECT", "INPUT", "TEXTAREA"].includes(e.target.tagName) ||
    $("helpDialog").open ||
    $("builderDialog").open
  )
    return;
  const a = { ArrowUp: "U", ArrowDown: "D", ArrowLeft: "L", ArrowRight: "R" }[
    e.key
  ];
  if (a) {
    e.preventDefault();
    if (mode === "explore") drive(a);
    else add(a);
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && running) {
    stop();
    render();
  }
});
function animal(t) {
  return t.c === "A" ? "🐱 kitten" : "🐶 puppy";
}
function contextPrompt() {
  const near = adjacent(state, "AB"),
    waiting = near.find(
      (t) => state.out.includes(t.key) && !state.rescued.includes(t.key),
    ),
    burning = near.find((t) => !state.out.includes(t.key));
  if (waiting)
    return "♡ Ready to rescue the " + animal(waiting) + "! Choose Rescue.";
  if (adjacent(state, "H").length && !state.water)
    return "💧 Beside the hydrant! Ready to fill the tank. Choose Fill.";
  if (burning)
    return state.water
      ? "〰 Ready to spray! Put out the fire, then rescue the " +
          animal(burning) +
          "."
      : "💧 Your tank needs water. Visit a blue hydrant and choose Fill.";
  return state.water
    ? "💧 Water ready. Drive beside a building with a fire."
    : "💧 Tank empty. Find a blue hydrant to refill.";
}
function promptContext(a, r) {
  let text = contextPrompt();
  if (a === "S")
    text =
      "Fire out! Your tank needs refilling. First, choose Rescue to save the " +
      animal(r.target) +
      ".";
  else if (a === "F") text = "💧 Tank full! You are ready for the next fire.";
  else if (a === "A")
    text =
      "Good job, Justin! You rescued the " +
      animal(r.target) +
      "! " +
      (state.rescued.length === targets().length
        ? "Every friend is safe!"
        : state.water
          ? "Drive to the next friend."
          : "Now refill your water at a blue hydrant.");
  $("status").textContent = text;
  message(text);
  if (
    text !== lastPrompt &&
    (a === "S" || a === "F" || a === "A" || adjacent(state, "ABH").length)
  ) {
    say(text.replace(/[🐱🐶💧♡〰]/gu, ""));
    lastPrompt = text;
  }
}
for (const id of ["insertBefore", "insertAfter"])
  $(id).onclick = () => {
    if (selected < 0 || running) return;
    pendingInsert = selected + (id === "insertAfter" ? 1 : 0);
    selected = -1;
    render();
  };
$("doneEdit").onclick = () => {
  selected = -1;
  pendingInsert = null;
  render();
};

function enableDragOut(button, box, onDelete) {
  let drag = null,
    suppress = false;
  button.addEventListener(
    "click",
    (e) => {
      if (suppress) {
        e.preventDefault();
        e.stopImmediatePropagation();
        suppress = false;
      }
    },
    true,
  );
  button.addEventListener("pointerdown", (e) => {
    if (button.disabled || e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false };
    button.setPointerCapture(e.pointerId);
  });
  const finish = (e, cancel = false) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    let outside = false;
    if (d.active) {
      const r = box.getBoundingClientRect();
      outside =
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom;
      d.ghost.remove();
      d.tip.remove();
      button.classList.remove("drag-source");
      box.classList.remove("drag-delete-zone");
      suppress = true;
      setTimeout(() => (suppress = false), 400);
    }
    if (button.hasPointerCapture?.(e.pointerId))
      button.releasePointerCapture(e.pointerId);
    if (d.active && outside && !cancel) onDelete();
  };
  button.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag;
    if (!d.active && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 9) return;
    e.preventDefault();
    if (!d.active) {
      d.active = true;
      d.ghost = button.cloneNode(true);
      d.ghost.removeAttribute("id");
      d.ghost.setAttribute("aria-hidden", "true");
      d.ghost.classList.add("drag-ghost");
      d.ghost.style.width = button.offsetWidth + "px";
      document.body.append(d.ghost);
      d.tip = document.createElement("div");
      d.tip.className = "drag-tip";
      document.body.append(d.tip);
      button.classList.add("drag-source");
    }
    d.ghost.style.left = e.clientX - 20 + "px";
    d.ghost.style.top = e.clientY - 25 + "px";
    const r = box.getBoundingClientRect(),
      out =
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom;
    box.classList.toggle("drag-delete-zone", out);
    d.tip.textContent = out
      ? "🗑 Release to remove this block"
      : "Drag outside the box to remove";
  });
  button.addEventListener("pointerup", (e) => finish(e));
  button.addEventListener("pointercancel", (e) => finish(e, true));
  button.addEventListener("lostpointercapture", (e) => {
    if (drag) finish(e, true);
  });
  button.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drag)
      finish({ pointerId: drag.id, clientX: drag.x, clientY: drag.y }, true);
  });
}

function freshDraft(n) {
  draft = {
    rows: Array.from({ length: n }, (_, y) =>
      y === n - 1 ? "P" + ".".repeat(n - 1) : ".".repeat(n),
    ),
    water: 1,
  };
}
function saveDraft() {
  try {
    localStorage.setItem("fire-rescue-custom-town", JSON.stringify(draft));
  } catch {}
}
function openBuilder() {
  stop();
  render();
  if (!draft) {
    try {
      const d = JSON.parse(localStorage.getItem("fire-rescue-custom-town"));
      if (
        d &&
        d.rows.length >= 3 &&
        d.rows.length <= 7 &&
        d.rows.every(
          (r) =>
            typeof r === "string" &&
            r.length === d.rows.length &&
            /^[.PHAB#]+$/.test(r),
        ) &&
        [0, 1].includes(d.water) &&
        d.rows.join("").split("P").length === 2
      )
        draft = d;
    } catch {}
  }
  if (!draft) freshDraft(3);
  $("builderMessage").textContent =
    "Choose a tile below, then tap a square to paint.";
  renderBuilder();
  $("builderDialog").showModal();
}
function renderBuilder() {
  const n = draft.rows.length;
  $("builderSize").value = n;
  $("builderWater").value = draft.water;
  $("paintTools").replaceChildren();
  for (const [c, label] of Object.entries({
    ".": "Road",
    "#": "Tree",
    P: "Truck station",
    H: "Water hydrant",
    A: "Kitten house",
    B: "Puppy house",
  })) {
    let b = document.createElement("button");
    b.textContent = label;
    b.dataset.paint = c;
    b.setAttribute("aria-pressed", String(brush === c));
    b.onclick = () => {
      brush = c;
      renderBuilder();
    };
    $("paintTools").append(b);
  }
  $("builderGrid").style.gridTemplateColumns = "repeat(" + n + ",1fr)";
  $("builderGrid").replaceChildren();
  const oldL = L,
    oldState = state;
  L = draft;
  state = { out: [], rescued: [] };
  draft.rows.forEach((r, y) =>
    [...r].forEach((c, x) => {
      let b = document.createElement("button");
      b.dataset.x = x;
      b.dataset.y = y;
      b.setAttribute(
        "aria-label",
        "Row " +
          (y + 1) +
          ", column " +
          (x + 1) +
          ": " +
          {
            ".": "road",
            "#": "tree",
            P: "truck station",
            H: "hydrant",
            A: "kitten house",
            B: "puppy house",
          }[c],
      );
      b.innerHTML = c === "P" ? truckSVG : tileArt(c, x, y);
      b.onclick = () => paintTown(x, y);
      $("builderGrid").append(b);
    }),
  );
  L = oldL;
  state = oldState;
}
function paintTown(x, y) {
  let rows = draft.rows.map((r) => [...r]);
  if (rows[y][x] === "P" && brush !== "P") {
    $("builderMessage").textContent =
      "Move the truck station by choosing Truck station and tapping another square.";
    return;
  }
  if (
    "AB".includes(brush) &&
    !"AB".includes(rows[y][x]) &&
    rows.flat().filter((c) => "AB".includes(c)).length >= 3
  ) {
    $("builderMessage").textContent =
      "Use up to three animal houses in one town.";
    return;
  }
  if (brush === "P")
    rows = rows.map((r) => r.map((c) => (c === "P" ? "." : c)));
  rows[y][x] = brush;
  draft.rows = rows.map((r) => r.join(""));
  saveDraft();
  renderBuilder();
  $("builderMessage").textContent =
    "Tile placed. Check your town when you are ready.";
}
function validateTown() {
  let rows = draft.rows,
    n = rows.length,
    p = rows.join("").indexOf("P"),
    queue = [[p % n, Math.floor(p / n)]],
    seen = new Set([queue[0].join(",")]);
  for (let i = 0; i < queue.length; i++)
    for (const [dx, dy] of Object.values(dir)) {
      let x = queue[i][0] + dx,
        y = queue[i][1] + dy,
        k = x + "," + y;
      if (".P".includes(rows[y]?.[x] || "!") && !seen.has(k)) {
        seen.add(k);
        queue.push([x, y]);
      }
    }
  let pets = [],
    hydrants = [];
  rows.forEach((r, y) =>
    [...r].forEach((c, x) => {
      if ("AB".includes(c)) pets.push([x, y]);
      if (c === "H") hydrants.push([x, y]);
    }),
  );
  const beside = ([x, y]) =>
    Object.values(dir).some(([dx, dy]) => seen.has(x + dx + "," + (y + dy)));
  if (!pets.length) return "Add at least one kitten or puppy house.";
  if (pets.some((t) => !beside(t)))
    return "An animal house cannot be reached. Paint a road from the truck to a square beside every house.";
  if ((!draft.water || pets.length > 1) && !hydrants.some(beside))
    return "Add a reachable hydrant. An empty tank or multiple fires needs a water stop.";
  return "";
}
$("makeLevel").onclick = openBuilder;
$("closeBuilder").onclick = () => $("builderDialog").close();
$("builderSize").onchange = () => {
  freshDraft(Number($("builderSize").value));
  saveDraft();
  renderBuilder();
  $("builderMessage").textContent = "Fresh map ready. Add an animal house.";
};
$("builderWater").onchange = () => {
  draft.water = Number($("builderWater").value);
  saveDraft();
};
$("clearTown").onclick = () => {
  freshDraft(draft.rows.length);
  saveDraft();
  renderBuilder();
  $("builderMessage").textContent = "Map cleared. Your truck station is ready.";
};
$("checkTown").onclick = () => {
  $("builderMessage").textContent =
    validateTown() || "Your town works! Every friend can be rescued.";
};
$("playTown").onclick = () => {
  const error = validateTown();
  if (error) {
    $("builderMessage").textContent = error;
    return;
  }
  saveDraft();
  customActive = true;
  L = {
    ...structuredClone(draft),
    title: "My rescue town",
    world: draft.rows.length + " × " + draft.rows.length + " · Your creation",
    desc: "Your town. Your plan. Help every friend!",
  };
  mode = "explore";
  program = [];
  notes = [];
  history = [];
  selected = -1;
  hint = false;
  $("clueText").hidden = true;
  reset();
  $("world").textContent = L.world;
  $("title").textContent = L.title;
  $("subtitle").textContent = L.desc;
  $("mission").textContent = "CUSTOM TOWN";
  $("builderDialog").close();
  message("Your town is ready! Explore, then build your rescue code.");
  render();
};

$("teacherVoice").onchange = () => {
  voiceChoice = $("teacherVoice").value;
  try {
    localStorage.setItem("fire-rescue-voice", voiceChoice);
  } catch {}
};
$("previewTeacher").onclick = () => {
  voice = true;
  $("sound").textContent = "♪ Teacher on";
  say("Good job, Justin! You saved your little friend. Hooray!");
};
$("engineSound").onclick = () => {
  engineEnabled = !engineEnabled;
  $("engineSound").textContent = engineEnabled
    ? "Engine sound on"
    : "Engine sound off";
  $("engineSound").setAttribute("aria-pressed", String(engineEnabled));
};
window.speechSynthesis?.addEventListener("voiceschanged", refreshTeacher);
refreshTeacher();
load(0);
