const $ = (id) => document.getElementById(id),
  arrows = { U: "↑", D: "↓", L: "←", R: "→" },
  names = { U: "Up", D: "Down", L: "Left", R: "Right" },
  delta = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
let hintOn = false;
let testMinimum = 0,
  testArrowBaseline = 0;
try {
  const n = Number(localStorage.getItem("puppy-test-minimum"));
  if (Number.isInteger(n) && n >= 0 && n <= 20) testMinimum = n;
} catch {}
function arrowCount() {
  return program.reduce(
    (n, p) => n + (typeof p === "string" ? 1 : p.body.length),
    0,
  );
}
function newArrowCount() {
  return Math.max(0, arrowCount() - testArrowBaseline);
}
function testBlocked() {
  return !started && testMinimum > 0 && newArrowCount() < testMinimum;
}
function renderTestRequirement() {
  const locked = testBlocked();
  $("run").disabled = !running && locked;
  $("step").disabled = running || locked;
  $("testMinimum").disabled = running || started;
}
$("testMinimum").value = String(testMinimum);
$("testMinimum").onchange = () => {
  testMinimum = Number($("testMinimum").value);
  testArrowBaseline = arrowCount();
  try {
    localStorage.setItem("puppy-test-minimum", String(testMinimum));
  } catch {}
  controls();
};
let mode = "walk",
  walkMoves = [],
  notesHidden = false,
  idx = 0,
  L,
  program = [],
  editing = -1,
  selected = null,
  insertion = null,
  history = [],
  state,
  running = false,
  token = 0,
  flat = [],
  cursor = 0,
  started = false,
  voice = true,
  builder = false,
  brush = "#",
  saved = {},
  walkCelebrated = false,
  active = null,
  bad = null;
try {
  const current = localStorage.getItem("puppy-quest-v2");
  const old = JSON.parse(localStorage.getItem("puppy-quest-v1") || "{}");
  const data = current
    ? JSON.parse(current)
    : Object.fromEntries(
        [10, 11].filter((i) => old && old[i]).map((i) => [i, old[i]]),
      );
  if (data && typeof data === "object" && !Array.isArray(data)) saved = data;
} catch {}
let teacherVoice = null,
  preferredVoice = "",
  audioContext = null,
  stepsOn = true,
  footIndex = 0;
try {
  stepsOn = localStorage.getItem("puppy-footsteps") !== "off";
} catch {}
try {
  preferredVoice = localStorage.getItem("puppy-teacher-voice-v2") || "";
} catch {}
function voiceScore(v) {
  let n = v.name.toLowerCase();
  if (/clara/.test(n) && /^en[-_]CA$/i.test(v.lang) && /online|natural/.test(n))
    return 1000;
  if (/clara/.test(n) && /^en[-_]CA$/i.test(v.lang)) return 900;
  let score = /^en/i.test(v.lang) ? 100 : 0;
  if (
    /ana|michelle|jenny|aria|sonia|samantha|karen|moira|zira|susan|female|ava|serena|libby|salli|joanna|emma|allison|victoria/.test(
      n,
    )
  )
    score += 200;
  if (/natural|premium|enhanced|online/.test(n)) score += 65;
  if (/ana|michelle/.test(n)) score += 40;
  else if (/jenny/.test(n)) score += 35;
  else if (/aria|ava|emma/.test(n)) score += 25;
  return score;
}
function refreshVoices() {
  if (!("speechSynthesis" in window)) {
    $("voiceStatus").textContent =
      "Speech is not available in this browser. Justin can still read every message.";
    $("testVoice").disabled = true;
    $("teacherVoice").disabled = true;
    return;
  }
  const voices = window.speechSynthesis
    .getVoices()
    .filter((v) => /^en/i.test(v.lang))
    .sort((a, b) => voiceScore(b) - voiceScore(a));
  teacherVoice =
    voices.find((v) => v.voiceURI === preferredVoice) || voices[0] || null;
  const select = $("teacherVoice");
  select.innerHTML = "";
  if (!voices.length) {
    select.add(new Option("Browser default English voice", ""));
    $("voiceStatus").textContent =
      "English voices are still loading, or this browser provides only its default voice.";
  } else {
    voices.forEach((v) =>
      select.add(new Option(v.name + " · " + v.lang, v.voiceURI)),
    );
    select.value = teacherVoice.voiceURI;
    $("voiceStatus").textContent =
      voiceScore(teacherVoice) >= 300
        ? "A female English voice is selected. Preview it and choose another if you prefer."
        : "A female English voice was not identified. Choose and preview an available voice; the list depends on your device.";
  }
}
function enableAudio() {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio && !audioContext) audioContext = new Audio();
    if (audioContext?.state === "suspended")
      return audioContext.resume().catch(() => {});
  } catch {}
  return Promise.resolve();
}
function footstep() {
  if (!stepsOn) return;
  enableAudio().then(() => {
    if (!stepsOn || !audioContext || audioContext.state !== "running") return;
    try {
      const osc = audioContext.createOscillator(),
        gain = audioContext.createGain(),
        t = audioContext.currentTime;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(footIndex++ % 2 ? 200 : 175, t);
      osc.frequency.exponentialRampToValueAtTime(85, t + 0.075);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.07, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(t);
      osc.stop(t + 0.105);
    } catch {}
  });
}
function renderStepSound() {
  $("stepSound").textContent = stepsOn ? "🔊 Footsteps on" : "🔇 Footsteps off";
  $("stepSound").setAttribute("aria-pressed", String(stepsOn));
}
$("stepSound").onclick = () => {
  stepsOn = !stepsOn;
  try {
    localStorage.setItem("puppy-footsteps", stepsOn ? "on" : "off");
  } catch {}
  renderStepSound();
  if (stepsOn) footstep();
};
renderStepSound();

function chime() {
  if (!voice || !audioContext || audioContext.state !== "running") return;
  try {
    [523.25, 659.25, 783.99].forEach((f, i) => {
      let osc = audioContext.createOscillator(),
        gain = audioContext.createGain(),
        t = audioContext.currentTime + i * 0.1;
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.035, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  } catch {}
}
function setTeacher(on) {
  voice = on;
  $("sound").textContent = on ? "🔊 Teacher on" : "🔇 Teacher off";
  $("sound").setAttribute("aria-pressed", String(on));
  $("sound").setAttribute(
    "aria-label",
    on ? "Turn teacher voice off" : "Turn teacher voice on",
  );
  if (on) enableAudio();
  else if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
function say(t, force = false) {
  if (!(voice || force) || !("speechSynthesis" in window)) return;
  refreshVoices();
  window.speechSynthesis.cancel();
  let clean = t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
  let u = new SpeechSynthesisUtterance(clean);
  u.lang = teacherVoice?.lang || "en-CA";
  if (teacherVoice) u.voice = teacherVoice;
  u.rate = 1.06;
  u.pitch = 1.02;
  u.volume = 1;
  u.onerror = (e) => {
    if (!["interrupted", "canceled"].includes(e.error))
      $("voiceStatus").textContent =
        "The voice could not play. Try a different voice or check your device sound.";
  };
  window.speechSynthesis.speak(u);
}
function msg(t, type = "", speak = false) {
  $("message").textContent = t;
  $("message").className = "message " + type;
  if (speak) {
    if (type === "success") chime();
    say(t.includes("Justin") ? t : "Justin, " + t);
  }
}
function starsTotal() {
  return L.rows.join("").split("*").length - 1;
}
function initial() {
  let p = L.rows.join("").indexOf("P");
  return {
    x: p % L.rows[0].length,
    y: Math.floor(p / L.rows[0].length),
    got: new Set(),
    key: false,
    trail: new Set(),
    win: false,
  };
}
function canMove(d) {
  let [dx, dy] = delta[d],
    c = L.rows[state.y + dy]?.[state.x + dx];
  return c !== undefined && c !== "#" && (c !== "D" || state.key);
}
function movePuppy(d, silent = false) {
  if (!canMove(d)) return false;
  let [dx, dy] = delta[d];
  state.trail.add(state.x + "," + state.y);
  state.x += dx;
  state.y += dy;
  let c = L.rows[state.y][state.x];
  if (c === "*") state.got.add(state.x + "," + state.y);
  if (c === "K") state.key = true;
  if (!silent) footstep();
  return true;
}
function atGoal() {
  return L.rows[state.y][state.x] === "F" && state.got.size === starsTotal();
}
function celebrate() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const layer = $("confetti");
  layer.innerHTML = "";
  for (let i = 0; i < 24; i++) {
    let p = document.createElement("i");
    p.style.left = i * 4.2 + "%";
    p.style.background = ["#7650ed", "#f5c64a", "#4caa7b", "#ec88ae"][i % 4];
    p.style.animationDelay = (i % 5) * 0.08 + "s";
    layer.appendChild(p);
  }
  setTimeout(() => {
    layer.innerHTML = "";
  }, 2300);
}
function stop() {
  running = false;
  token++;
  controls();
}
function reset(silent = false) {
  stop();
  state = initial();
  flat = [];
  cursor = 0;
  started = false;
  active = null;
  bad = null;
  selected = null;
  insertion = null;
  $("next").classList.add("hidden");
  renderBoard();
  renderCode();
  controls();
  if (!silent)
    msg(
      mode === "walk"
        ? "Walk with the green arrows. Your steps appear in My path notes."
        : "Puppy is ready. Build your instructions, then press Test code.",
    );
}
function load(i) {
  testArrowBaseline = 0;
  hintOn = false;
  stop();
  mode = "walk";
  walkMoves = [];
  notesHidden = false;
  walkCelebrated = false;
  builder = false;
  idx = i;
  L = structuredClone(levels[i]);
  program = L.seed ? [...L.seed] : [];
  history = [];
  editing = -1;
  selected = null;
  $("title").textContent = L.title;
  $("world").textContent = L.world;
  $("mission").textContent =
    "MISSION " + String(i + 1).padStart(2, "0") + " / 12";
  $("build").textContent = "🛠 Make a level";
  reset();
  renderMode();
  nav();
}
function renderBoard() {
  let b = $("board");
  b.style.gridTemplateColumns = `repeat(${L.rows[0].length},1fr)`;
  b.innerHTML = "";
  L.rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      let k = x + "," + y,
        current = state.x === x && state.y === y,
        dir = Object.keys(delta).find(
          (d) => state.x + delta[d][0] === x && state.y + delta[d][1] === y,
        ),
        reachable = mode === "walk" && dir && canMove(dir);
      let el = document.createElement("button");
      el.type = "button";
      el.className =
        "cell" +
        (c === "#" ? " wall" : "") +
        (state.trail.has(k) ? " visited" : "") +
        (current ? " current" : "") +
        (reachable ? " reachable" : "");
      let icon =
        c === "#"
          ? "🌲"
          : c === "F"
            ? "🏁"
            : c === "*" && !state.got.has(k)
              ? "⭐"
              : c === "K" && !state.key
                ? "🔑"
                : c === "D"
                  ? state.key
                    ? "🔓"
                    : "🔒"
                  : "";
      el.innerHTML = current ? '<span class="puppy">🐶</span>' : icon;
      el.disabled = !(reachable || (builder && mode === "code")) || running;
      el.setAttribute(
        "aria-label",
        `Row ${y + 1}, column ${x + 1}: ${current ? "Puppy" : { "#": "tree", F: "finish", "*": "star", K: "key", D: "gate" }[c] || "path"}${reachable ? ", walk " + names[dir] : ""}`,
      );
      el.onclick = () => {
        if (reachable) walk(dir);
        else if (builder) paint(x, y);
      };
      b.appendChild(el);
    }),
  );
  $("stars").textContent =
    `⭐ ${state.got.size} / ${starsTotal()}${state.key ? " · 🔑" : ""}`;
  for (let d in delta) {
    $("walk" + d).disabled = running || !canMove(d);
    $("walk" + d).setAttribute(
      "aria-label",
      "Walk " + names[d] + (canMove(d) ? "" : " — path blocked"),
    );
  }
  if (mode === "walk") {
    $("boardStatus").textContent = atGoal()
      ? "Path found! Ready to teach Puppy?"
      : "Glowing squares show where Puppy can step.";
  } else
    $("boardStatus").textContent = running
      ? "Puppy is following your code."
      : state.win
        ? "Mission complete!"
        : started
          ? "Paused here. Continue when you are ready."
          : "Puppy moves when you test your code.";
  updateCoach();
  renderClue();
}
function cost() {
  return program.reduce(
    (n, p) => n + (typeof p === "string" ? 1 : 1 + p.body.length),
    0,
  );
}
function remember() {
  history.push(structuredClone(program));
  if (history.length > 60) history.shift();
}
function changed() {
  reset(true);
  renderNotes();
  if (editing >= 0)
    msg(
      "Justin, put the moves you want to repeat inside this loop. Pick how many times, then close it.",
    );
  else msg("Plan updated. Ready to test?");
}
function selectBlock(i, j) {
  if (running) return;
  insertion = null;
  selected = { i, j };
  renderCode();
  $("blockEdit")
    .querySelector(".editrow")
    .scrollIntoView({ block: "nearest", behavior: "instant" });
}
function tokenButton(d, i, j = -1) {
  let b = document.createElement("button");
  b.className =
    "token" +
    (active?.i === i && active.j === j ? " playing" : "") +
    (bad?.i === i && bad.j === j ? " needschange" : "") +
    (selected?.i === i && selected.j === j ? " selected" : "");
  b.innerHTML = (j < 0 ? "<small>" + (i + 1) + "</small>" : "") + arrows[d];
  b.disabled = running;
  b.setAttribute(
    "aria-label",
    names[d] +
      ", edit " +
      (j < 0 ? "block " + (i + 1) : "loop move " + (j + 1)),
  );
  b.onclick = () => selectBlock(i, j);
  enableDragOut(b, $("code"), () => {
    if (running) return;
    remember();
    if (j >= 0) program[i].body.splice(j, 1);
    else program.splice(i, 1);
    editing = -1;
    changed();
    msg("Block removed. Undo can bring it back.");
  });
  return b;
}
function renderCode() {
  let c = $("code");
  c.innerHTML = "";
  if (!program.length)
    c.innerHTML =
      '<div class="empty">Add purple arrow blocks above.<br>Then press Test code.</div>';
  program.forEach((p, i) => {
    if (typeof p === "string") c.appendChild(tokenButton(p, i));
    else {
      let w = document.createElement("div");
      w.className = "loop" + (i === editing ? " editing" : "");
      let label = document.createElement("span");
      label.className = "looplabel";
      label.textContent = i + 1 + ". ↻";
      w.appendChild(label);
      let s = document.createElement("select");
      s.setAttribute("aria-label", "Loop " + (i + 1) + " repeat count");
      for (let n = 2; n <= 6; n++) s.add(new Option(n + "×", n));
      s.value = p.n;
      s.disabled = running;
      s.onchange = () => {
        remember();
        p.n = +s.value;
        changed();
      };
      w.appendChild(s);
      p.body.forEach((d, j) => w.appendChild(tokenButton(d, i, j)));
      let e = document.createElement("button");
      e.className = "tiny";
      e.textContent = editing === i ? "Close loop" : "Add moves";
      e.disabled = running;
      e.onclick = () => {
        editing = editing === i ? -1 : i;
        selected = null;
        renderCode();
        msg(
          editing >= 0
            ? "Purple arrows now go inside this loop."
            : "Loop closed. New arrows go after the loop.",
        );
      };
      w.appendChild(e);
      let d = document.createElement("button");
      d.className = "tiny";
      d.textContent = "×";
      d.setAttribute("aria-label", "Remove loop");
      d.disabled = running;
      d.onclick = () => {
        remember();
        program.splice(i, 1);
        editing = -1;
        changed();
      };
      w.appendChild(d);
      c.appendChild(w);
    }
  });
  $("count").textContent = cost() + " blocks";
  $("budget").textContent = builder
    ? "Invent a route, then see if your code can solve it."
    : `Optional gold challenge: ${L.budget} blocks or fewer. Every solved program counts!`;
  $("blockEdit").classList.toggle("hidden", !selected || running);
  $("editLabel").textContent = selected
    ? "Change " +
      (selected.j >= 0
        ? "this move inside loop " + (selected.i + 1)
        : "block " + (selected.i + 1))
    : "Change this move";
  $("undo").disabled = running || !history.length;
}
function add(d) {
  if (running || mode !== "code") return;
  if (cost() >= 60) {
    msg("Lots of ideas! Remove a move to make room for another.");
    return;
  }
  remember();
  if (insertion) {
    let { i, j, after } = insertion;
    if (j >= 0) program[i].body.splice(j + (after ? 1 : 0), 0, d);
    else program.splice(i + (after ? 1 : 0), 0, d);
    editing = -1;
  } else if (editing >= 0 && program[editing]?.body)
    program[editing].body.push(d);
  else program.push(d);
  changed();
}
function replaceBlock(d) {
  if (!selected || running) return;
  let { i, j } = selected;
  remember();
  if (j >= 0) program[i].body[j] = d;
  else program[i] = d;
  changed();
}
function controls() {
  document
    .querySelectorAll(
      ".move,#clear,#step,#build,#levels button,#walkMode,#codeMode",
    )
    .forEach((b) => (b.disabled = running));
  $("run").textContent = running
    ? "⏸ Pause test"
    : started
      ? "▶ Continue test"
      : "▶ Test code";
  $("undo").disabled = running || !history.length;
  renderTestRequirement();
}
function expand() {
  let out = [];
  program.forEach((p, i) => {
    if (typeof p === "string") out.push({ d: p, i, j: -1 });
    else
      for (let n = 0; n < p.n; n++)
        p.body.forEach((d, j) => out.push({ d, i, j }));
  });
  return out;
}
function prepare() {
  if (mode !== "code") return false;
  if (testBlocked()) {
    renderTestRequirement();
    return false;
  }
  const empty = program.findIndex(
    (p) => typeof p !== "string" && !p.body.length,
  );
  if (empty >= 0) {
    editing = empty;
    renderCode();
    msg(
      "Let’s give your loop something to do. Add a purple arrow inside it.",
      "",
      true,
    );
    return false;
  }
  flat = expand();
  if (!flat.length) {
    msg("Choose a purple arrow first. What should Puppy do?", "", true);
    return false;
  }
  testArrowBaseline = arrowCount();
  state = initial();
  cursor = 0;
  started = true;
  editing = -1;
  selected = null;
  bad = null;
  active = null;
  renderBoard();
  return true;
}
function tick() {
  if (cursor >= flat.length) return finish();
  let a = flat[cursor];
  active = a;
  if (!canMove(a.d)) {
    bad = a;
    started = false;
    stop();
    renderCode();
    renderBoard();
    let [dx, dy] = delta[a.d],
      c = L.rows[state.y + dy]?.[state.x + dx];
    msg(
      `You can do this, Justin. Puppy paused at block ${a.i + 1}. ${c === "D" ? "A key will open this gate." : c === "#" ? "A tree is in the way." : "This is the edge of the map."} Tap the highlighted move to change it, or explore another route.`,
      "oops",
      true,
    );
    return false;
  }
  let old = state.got.size;
  movePuppy(a.d);
  cursor++;
  renderBoard();
  renderCode();
  if (cursor === flat.length) return finish();
  msg(
    state.got.size > old
      ? "⭐ A star! Your plan is working."
      : `Trying your plan… move ${cursor} of ${flat.length}.`,
  );
  return true;
}
function finish() {
  started = false;
  stop();
  active = null;
  renderCode();
  if (atGoal()) {
    state.win = true;
    let gold = cost() <= L.budget;
    if (!builder) {
      saved[idx] = Math.max(saved[idx] || 0, gold ? 2 : 1);
      try {
        localStorage.setItem("puppy-quest-v2", JSON.stringify(saved));
      } catch {}
      nav();
      if (idx < 11) {
        $("next").textContent = "Next adventure";
        $("next").classList.remove("hidden");
      }
    }
    celebrate();
    msg(
      gold
        ? "🏅 Amazing work, Justin! Your code worked! You collected every star and earned a gold badge!"
        : "🎉 Good job, Justin! You did it! Your plan brought Puppy home. Ready for another adventure?",
      "success",
      true,
    );
  } else if (L.rows[state.y][state.x] === "F") {
    let n = starsTotal() - state.got.size;
    msg(
      `You found the flag! There ${n === 1 ? "is one star" : "are " + n + " stars"} still to find. Explore a detour, then add it to your code.`,
      "",
      true,
    );
  } else
    msg(
      "Good trying, Justin! Your code brought Puppy here. Add a few more moves, or walk the path again for ideas.",
      "",
      true,
    );
  renderBoard();
  return false;
}
async function run() {
  if (mode !== "code") return;
  if (stepsOn) enableAudio();
  if (running) {
    stop();
    renderCode();
    renderBoard();
    msg("Paused. Continue this test, take one step, or change your code.");
    return;
  }
  if (!started && !prepare()) return;
  running = true;
  selected = null;
  controls();
  renderCode();
  renderBoard();
  let t = ++token;
  while (t === token && running) {
    await new Promise((r) => setTimeout(r, +$("pace").value));
    if (t !== token || !running) break;
    if (!tick()) break;
  }
}
function renderNotes() {
  $("notes").innerHTML = "";
  $("noteCount").textContent = walkMoves.length ? "· " + walkMoves.length : "";
  $("toggleNotes").textContent = notesHidden ? "Show" : "Hide";
  $("toggleNotes").setAttribute("aria-expanded", String(!notesHidden));
  $("noteHelp").textContent =
    mode === "walk"
      ? "Moves are saved automatically. Undo removes the last step."
      : "Use these clues to build your code, one arrow at a time.";
  if (notesHidden) {
    let p = document.createElement("p");
    p.className = "notesempty";
    p.textContent = "Notes hidden. Tap Show whenever you need a clue.";
    $("notes").appendChild(p);
  } else if (!walkMoves.length) {
    let p = document.createElement("p");
    p.className = "notesempty";
    p.textContent =
      "Walk Puppy with the green arrows. Your numbered steps will appear right here.";
    $("notes").appendChild(p);
  } else
    walkMoves.forEach((d, i) => {
      let n = document.createElement("span");
      n.className = "note";
      n.setAttribute("aria-label", "Walking step " + (i + 1) + ": " + names[d]);
      n.innerHTML = "<small>" + (i + 1) + "</small>" + arrows[d];
      $("notes").appendChild(n);
    });
  $("walkUndo").disabled = !walkMoves.length;
  $("walkReset").disabled = !walkMoves.length;
}
function updateCoach() {
  if (!L) return;
  let found = atGoal() && mode === "walk";
  $("coachIcon").textContent = found ? "🌟" : "🧭";
  $("coachTitle").textContent = found
    ? "You found a route, Justin!"
    : "Let’s explore, Justin!";
  $("coachText").textContent = found
    ? "Your steps are saved in My path notes. Now build a program that teaches Puppy how to get here."
    : "Explore with the green arrows. Try another turn, undo a move, or start again whenever you like.";
  $("checkExplore").classList.toggle("complete", walkMoves.length > 0);
  $("checkStars").classList.toggle("complete", state.got.size === starsTotal());
  $("checkFlag").classList.toggle("complete", found);
}
function renderMode() {
  let walking = mode === "walk";
  document.body.classList.toggle("walkmode", walking);
  $("walkMode").classList.toggle("active", walking);
  $("codeMode").classList.toggle("active", !walking);
  $("walkMode").setAttribute("aria-pressed", String(walking));
  $("codeMode").setAttribute("aria-pressed", String(!walking));
  $("walkControls").classList.toggle("hidden", !walking);
  $("exploreCoach").classList.toggle("hidden", !walking);
  $("codePanel").classList.toggle("hidden", walking);
  $("buildertools").classList.toggle("hidden", !builder || walking);
  renderBoard();
  renderNotes();
  controls();
}
function replayWalk() {
  state = initial();
  for (let d of walkMoves) movePuppy(d, true);
  renderBoard();
  renderNotes();
}
function walk(d) {
  if (mode !== "walk" || running || !canMove(d)) return;
  if (walkMoves.length >= 200) {
    msg("That was a big adventure! Start a new walk to try another path.");
    return;
  }
  let old = state.got.size,
    key = state.key;
  movePuppy(d);
  walkMoves.push(d);
  renderBoard();
  renderNotes();
  if (!notesHidden) $("notes").scrollTop = $("notes").scrollHeight;
  if (atGoal()) {
    if (!walkCelebrated) {
      celebrate();
      walkCelebrated = true;
    }
    msg(
      "🌟 Well done, Justin! You found a route! Your notes are ready. Let’s teach Puppy your plan.",
      "success",
      true,
    );
  } else if (state.got.size > old) {
    msg("⭐ Great exploring, Justin! You found a star!", "success", true);
  } else if (!key && state.key)
    msg(
      "🔑 Clever exploring, Justin! You found the key. Now you can open the gates!",
      "success",
      true,
    );
  else msg("Nice exploring. Your path notes are saving each step.");
}
function setMode(next) {
  if (running || mode === next) return;
  mode = next;
  editing = -1;
  reset(true);
  if (mode === "walk") {
    replayWalk();
    msg("Green arrows move Puppy now. Explore freely—your code is kept safe.");
  } else
    msg(
      L.seed && !walkMoves.length
        ? "A program is waiting for a little repair. Test it, then tap a block to change it."
        : walkMoves.length
          ? "Puppy is back at the start. Your path notes are above the code builder."
          : "Purple arrows build your program. Test code makes Puppy follow it.",
    );
  renderMode();
}
function newWalk() {
  if (mode !== "walk") return;
  walkMoves = [];
  walkCelebrated = false;
  reset(true);
  renderMode();
  msg("A fresh adventure, Justin! Try any route you like.");
}
function nav() {
  $("levels").innerHTML = "";
  for (let group = 0; group < 4; group++) {
    let w = document.createElement("div");
    w.className = "worldgroup";
    w.setAttribute(
      "aria-label",
      ["3 by 3", "4 by 4", "5 by 5", "6 by 6"][group],
    );
    let size = document.createElement("span");
    size.className = "gridsize";
    size.textContent = group + 3 + "×" + (group + 3);
    w.appendChild(size);
    for (let i = group * 3; i < group * 3 + 3; i++) {
      let b = document.createElement("button");
      b.textContent = saved[i] === 2 ? "★" : i + 1;
      b.className =
        (saved[i] ? "done " : "") + (!builder && i === idx ? "selected" : "");
      b.setAttribute(
        "aria-label",
        `Mission ${i + 1}: ${levels[i].title}${saved[i] ? " completed" : ""}`,
      );
      b.onclick = () => load(i);
      w.appendChild(b);
    }
    $("levels").appendChild(w);
  }
}
function paint(x, y) {
  if (running || mode !== "code") return;
  let rows = L.rows.map((r) => [...r]),
    old = rows[y][x];
  if ((old === "P" || old === "F") && brush !== old) {
    msg(
      "Keep Puppy and the flag. Choose their tool to move them to another square.",
    );
    return;
  }
  if (brush === "P" || brush === "F" || brush === "K")
    rows = rows.map((r) => r.map((c) => (c === brush ? "." : c)));
  rows[y][x] = brush;
  L.rows = rows.map((r) => r.join(""));
  walkMoves = [];
  walkCelebrated = false;
  reset(true);
  renderNotes();
  msg("Map updated. Choose Walk Puppy to explore it.");
}
function build() {
  testArrowBaseline = 0;
  hintOn = false;
  if (builder) {
    load(idx);
    return;
  }
  stop();
  mode = "code";
  walkMoves = [];
  notesHidden = false;
  walkCelebrated = false;
  builder = true;
  L = {
    title: "Your own adventure",
    rows: [".....F", "......", "..*...", "...*..", "......", "P....."],
    budget: 60,
  };
  program = [];
  history = [];
  editing = -1;
  selected = null;
  $("title").textContent = L.title;
  $("world").textContent = "Creative playground";
  $("mission").textContent = "PAINT · WALK · CODE";
  $("build").textContent = "Back to missions";
  $("buildertools").innerHTML = "";
  const labels = {
      ".": "Path",
      "#": "Tree",
      "*": "Star",
      P: "Puppy",
      F: "Flag",
      K: "Key",
      D: "Gate",
    },
    icons = {
      ".": "▫️",
      "#": "🌲",
      "*": "⭐",
      P: "🐶",
      F: "🏁",
      K: "🔑",
      D: "🔒",
    };
  for (let k in labels) {
    let b = document.createElement("button");
    b.textContent = icons[k];
    b.title = labels[k];
    b.setAttribute("aria-label", "Paint " + labels[k]);
    b.className = brush === k ? "active" : "";
    b.onclick = () => {
      brush = k;
      [...$("buildertools").children].forEach((e) =>
        e.classList.remove("active"),
      );
      b.classList.add("active");
    };
    $("buildertools").appendChild(b);
  }
  reset(true);
  renderMode();
  nav();
  msg(
    "Choose a painting tool above the board, then tap a square. Walk Puppy to test your map.",
  );
}
$("seeNotes").onclick = () => {
  notesHidden = false;
  renderNotes();
  $("notebook").scrollIntoView({
    behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "center",
  });
};
$("walkMode").onclick = () => setMode("walk");
$("codeMode").onclick = () => setMode("code");
$("writeNow").onclick = () => {
  setMode("code");
  if (window.innerWidth < 851)
    $("codePanel").scrollIntoView({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
};
$("walkUndo").onclick = () => {
  if (mode !== "walk" || !walkMoves.length) return;
  walkMoves.pop();
  replayWalk();
  msg("One step back. Try a different turn if you like.");
};
$("walkReset").onclick = newWalk;
$("toggleNotes").onclick = () => {
  notesHidden = !notesHidden;
  renderNotes();
};
document
  .querySelectorAll("[data-walk]")
  .forEach((b) => (b.onclick = () => walk(b.dataset.walk)));
document
  .querySelectorAll("[data-dir]")
  .forEach((b) => (b.onclick = () => add(b.dataset.dir)));
document
  .querySelectorAll("[data-replace]")
  .forEach((b) => (b.onclick = () => replaceBlock(b.dataset.replace)));
for (let id of ["insertBefore", "insertAfter"])
  $(id).onclick = () => {
    if (!selected) return;
    insertion = { ...selected, after: id === "insertAfter" };
    selected = null;
    renderCode();
    msg("Choose a purple arrow above to insert one move.");
  };
$("closeEdit").onclick = () => {
  selected = null;
  renderCode();
};
$("deleteBlock").onclick = () => {
  if (!selected || running) return;
  remember();
  let { i, j } = selected;
  if (j >= 0) program[i].body.splice(j, 1);
  else program.splice(i, 1);
  editing = -1;
  changed();
};
$("undo").onclick = () => {
  if (running || !history.length) return;
  program = history.pop();
  editing = -1;
  changed();
  msg("Your last code edit is undone.");
};
$("clear").onclick = () => {
  if (running) return;
  if (program.length) remember();
  program = [];
  testMinimum = Number($("testMinimum").value) || 0;
  testArrowBaseline = 0;
  editing = -1;
  changed();
  msg("A fresh coding page. Undo can bring your program back.");
};
$("run").onclick = run;
$("step").onclick = () => {
  if (running || mode !== "code") return;
  if (stepsOn) enableAudio();
  if (!started && !prepare()) return;
  tick();
  controls();
};
$("reset").onclick = () => reset();
$("hint").onclick = toggleClue;
$("next").onclick = () => load(Math.min(11, idx + 1));
$("help").onclick = openDemo;
$("closeHelp").onclick = $("playHelp").onclick = () => $("helpDialog").close();
$("hear").onclick = () =>
  say(
    `${L.title}. Collect every star, then reach the flag. ${mode === "walk" ? "Use the green arrows to move Puppy. Your steps appear in My path notes." : "Add purple arrow blocks, then press Test code."}`,
    true,
  );
$("sound").onclick = () => {
  if (!("speechSynthesis" in window)) {
    $("voiceDialog").showModal();
    refreshVoices();
    return;
  }
  setTeacher(!voice);
  if (voice)
    say(
      "Hi, Justin! I am here to cheer you on. Let’s explore, try our ideas, and have fun!",
    );
};
$("build").onclick = build;
$("voiceSettings").onclick = () => {
  refreshVoices();
  $("voiceDialog").showModal();
};
$("closeVoice").onclick = () => $("voiceDialog").close();
$("teacherVoice").onchange = () => {
  preferredVoice = $("teacherVoice").value;
  try {
    localStorage.setItem("puppy-teacher-voice-v2", preferredVoice);
  } catch {}
  refreshVoices();
  setTeacher(true);
  say("Good job, Justin! Keep trying. You can do this!");
};
$("testVoice").onclick = () => {
  setTeacher(true);
  chime();
  say(
    "Well done, Justin! You tried your idea, and you made it work. I love how you kept trying!",
  );
};
refreshVoices();
if ("speechSynthesis" in window)
  window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
// Search includes position, collected stars and key possession; never changes play state.
function winningRoute(start = state) {
  const w = L.rows[0].length,
    h = L.rows.length,
    stars = [];
  L.rows.forEach((r, y) =>
    [...r].forEach((c, x) => {
      if (c === "*") stars.push(x + "," + y);
    }),
  );
  const bit = new Map(stars.map((k, i) => [k, 1n << BigInt(i)])),
    all = (1n << BigInt(stars.length)) - 1n;
  let mask = 0n;
  for (let k of start.got) mask |= bit.get(k) || 0n;
  const q = [{ x: start.x, y: start.y, mask, key: start.key, path: [] }],
    seen = new Set([`${start.x},${start.y}:${mask}:${start.key}`]);
  for (let n = 0; n < q.length && n < 80000; n++) {
    const a = q[n];
    if (L.rows[a.y][a.x] === "F" && a.mask === all) return a.path;
    for (let d of ["U", "R", "D", "L"]) {
      const [dx, dy] = delta[d],
        x = a.x + dx,
        y = a.y + dy,
        c = L.rows[y]?.[x];
      if (
        x < 0 ||
        x >= w ||
        y < 0 ||
        y >= h ||
        c === "#" ||
        (c === "D" && !a.key)
      )
        continue;
      let m = a.mask | (bit.get(x + "," + y) || 0n),
        key = a.key || c === "K",
        id = `${x},${y}:${m}:${key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      q.push({ x, y, mask: m, key, path: [...a.path, d] });
    }
  }
  return null;
}
function renderClue() {
  const region = $("clueRoute");
  region.classList.toggle("hidden", !hintOn);
  $("hint").textContent = hintOn
    ? "💡 Hide the winning path"
    : "💡 Give me a clue";
  if (!hintOn) return;
  const path = winningRoute();
  region.innerHTML = "";
  if (path === null) {
    region.textContent = builder
      ? "No route found. Try opening a path between Puppy, the stars and the flag."
      : "Try returning Puppy to the start, then ask for a clue again.";
    return;
  }
  if (!path.length) {
    region.textContent = "You are already at the finish with every star!";
    return;
  }
  let title = document.createElement("strong");
  title.textContent = "Follow the numbered path from Puppy.";
  region.appendChild(title);
  let strip = document.createElement("div");
  strip.className = "cluearrows";
  let x = state.x,
    y = state.y,
    points = [[(x + 0.5) * 100, (y + 0.5) * 100]],
    visits = new Map();
  path.forEach((d, i) => {
    x += delta[d][0];
    y += delta[d][1];
    points.push([(x + 0.5) * 100, (y + 0.5) * 100]);
    const index = y * L.rows[0].length + x;
    if (!visits.has(index)) visits.set(index, []);
    visits.get(index).push(i + 1);
    let n = document.createElement("span");
    n.innerHTML = "<small>" + (i + 1) + "</small>" + arrows[d];
    n.setAttribute("aria-label", "Step " + (i + 1) + " " + names[d]);
    strip.appendChild(n);
  });
  region.appendChild(strip);
  const b = $("board");
  for (let [index, nums] of visits) {
    const cell = b.children[index];
    cell.classList.add("cluecell");
    const label = document.createElement("span");
    label.className = "routenum";
    label.textContent = nums.join(", ");
    cell.appendChild(label);
  }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "routeoverlay");
  svg.setAttribute(
    "viewBox",
    `0 0 ${L.rows[0].length * 100} ${L.rows.length * 100}`,
  );
  svg.setAttribute("aria-hidden", "true");
  const line = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "polyline",
  );
  line.setAttribute("points", points.map((p) => p.join(",")).join(" "));
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "#b97e15");
  line.setAttribute("stroke-width", "5");
  line.setAttribute("stroke-dasharray", "8 10");
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("stroke-linejoin", "round");
  svg.appendChild(line);
  b.appendChild(svg);
}
function toggleClue() {
  if (running) {
    stop();
    renderCode();
  }
  hintOn = !hintOn;
  renderBoard();
  if (hintOn) {
    const path = winningRoute();
    msg(
      path === null
        ? "Justin, this map needs an open path. Try changing a tree."
        : path.length
          ? "Justin, follow the golden path. The little numbers show each step, including places you visit twice."
          : "You have already found the way, Justin!",
      "",
      true,
    );
  }
}
// Gold targets use ordinary arrow blocks now that loop controls have been removed.
for (let l of levels) {
  const previous = L;
  L = l;
  const route = winningRoute(initial());
  if (route) l.budget = route.length;
  L = previous;
}
let miniTimer = null,
  demoTimer = null,
  demoIndex = 0,
  demoPaused = false;
function showDirection(d) {
  clearTimeout(miniTimer);
  const [x, y] = delta[d];
  $("miniDog").style.transform = `translate(${x * 35}px,${y * 35}px)`;
  $("arrowMeaning").textContent = arrows[d] + " " + names[d] + " — one step";
  say("Justin, this arrow tells Puppy to go " + names[d].toLowerCase() + ".");
  miniTimer = setTimeout(() => {
    $("miniDog").style.transform = "translate(0,0)";
  }, 700);
}
document
  .querySelectorAll("[data-demo-dir]")
  .forEach((b) => (b.onclick = () => showDirection(b.dataset.demoDir)));
const demoFrames = [
  { phase: 0, x: 0, y: 2, n: 0, t: "1. Walk Puppy and discover a path." },
  { phase: 0, x: 1, y: 2, n: 1, t: "Right. One arrow means one step." },
  {
    phase: 0,
    x: 2,
    y: 2,
    n: 2,
    t: "Right again. Pick up the star!",
    star: true,
  },
  {
    phase: 0,
    x: 2,
    y: 1,
    n: 3,
    t: "Up. Your walking steps become notes.",
    star: true,
  },
  {
    phase: 0,
    x: 2,
    y: 0,
    n: 4,
    t: "Up again. You found the flag!",
    star: true,
  },
  {
    phase: 1,
    x: 0,
    y: 2,
    n: 0,
    t: "2. Bring Puppy back. Build your own code.",
  },
  { phase: 1, x: 0, y: 2, n: 1, t: "Add Right." },
  { phase: 1, x: 0, y: 2, n: 2, t: "Add another Right." },
  { phase: 1, x: 0, y: 2, n: 3, t: "Add Up." },
  { phase: 1, x: 0, y: 2, n: 4, t: "Add Up. Your plan is ready!" },
  {
    phase: 2,
    x: 0,
    y: 2,
    n: 4,
    t: "3. Press Test code. Puppy follows your plan.",
  },
  { phase: 2, x: 1, y: 2, n: 4, active: 0, t: "Right." },
  {
    phase: 2,
    x: 2,
    y: 2,
    n: 4,
    active: 1,
    t: "Right. There is the star!",
    star: true,
  },
  { phase: 2, x: 2, y: 1, n: 4, active: 2, t: "Up.", star: true },
  {
    phase: 2,
    x: 2,
    y: 0,
    n: 4,
    active: 3,
    t: "Up. It worked! Your turn, Justin!",
    star: true,
  },
];
function drawDemo() {
  const f = demoFrames[demoIndex];
  $("demoCaption").textContent = f.t;
  ["phaseWalk", "phaseCode", "phaseTest"].forEach((id, i) =>
    $(id).classList.toggle("active", i === f.phase),
  );
  $("demoPup").style.left = (f.x * 100) / 3 + "%";
  $("demoPup").style.top = (f.y * 100) / 3 + "%";
  $("demoStar").style.opacity = f.star ? "0" : "1";
  $("demoCode").innerHTML = "";
  ["R", "R", "U", "U"].slice(0, f.n).forEach((d, i) => {
    let b = document.createElement("span");
    b.className = i === f.active ? "active" : "";
    b.textContent = arrows[d];
    $("demoCode").appendChild(b);
  });
  $("pauseDemo").disabled = demoIndex === demoFrames.length - 1;
}
function advanceDemo() {
  if (demoPaused || !$("demoDialog").open) return;
  drawDemo();
  if (demoIndex < demoFrames.length - 1)
    demoTimer = setTimeout(() => {
      demoIndex++;
      advanceDemo();
    }, 1000);
}
function playDemo() {
  clearTimeout(demoTimer);
  demoIndex = 0;
  demoPaused = false;
  $("pauseDemo").textContent = "Pause";
  advanceDemo();
  say(
    "Justin, watch Puppy explore. Then build the same moves with arrows, and test your code.",
  );
}
function openDemo() {
  if (running) {
    stop();
    renderCode();
    renderBoard();
  }
  $("demoDialog").showModal();
  playDemo();
}
function closeDemo() {
  clearTimeout(demoTimer);
  demoPaused = true;
  $("demoDialog").close();
}
$("watchDemo").onclick = openDemo;
$("playDemo").onclick = playDemo;
$("closeDemo").onclick = $("doneDemo").onclick = closeDemo;
$("demoDialog").addEventListener("close", () => {
  clearTimeout(demoTimer);
  demoPaused = true;
});
$("pauseDemo").onclick = () => {
  demoPaused = !demoPaused;
  $("pauseDemo").textContent = demoPaused ? "Continue" : "Pause";
  clearTimeout(demoTimer);
  if (!demoPaused) {
    if (demoIndex < demoFrames.length - 1) demoIndex++;
    advanceDemo();
  }
};

document.addEventListener("keydown", (e) => {
  if (
    mode !== "walk" ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName) ||
    $("helpDialog").open ||
    $("voiceDialog").open ||
    $("demoDialog").open
  )
    return;
  let d = { ArrowUp: "U", ArrowDown: "D", ArrowLeft: "L", ArrowRight: "R" }[
    e.key
  ];
  if (d) {
    e.preventDefault();
    walk(d);
  }
});
load(0);

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
load(0);
