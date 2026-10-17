const $ = (id) => document.getElementById(id);
function openGame(which) {
  for (const id of ["home", "puppy", "fire"]) $(id).hidden = id !== which;
  for (const name of ["puppy", "fire"]) {
    const frame = $(name + "Frame");
    frame.src =
      name === which ? "games/" + name + "/index.html" : "about:blank";
  }
  window.speechSynthesis?.cancel();
  window.scrollTo(0, 0);
}
$("playPuppy").onclick = () => openGame("puppy");
$("playRunner").onclick = () => openGame("fire");
$("puppyHome").onclick = $("fireHome").onclick = () => openGame("home");
