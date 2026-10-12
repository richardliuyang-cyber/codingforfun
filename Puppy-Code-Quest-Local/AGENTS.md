# Project instructions

This is an exported browser-only kindergarten coding game. Edit index.html, styles.css and app.js. No framework or dependencies are needed. Do not replace the game with a starter project.

Preserve walking mode, code mode, path notes, Undo/Clear, clues, teacher voice, footsteps, 12 missions from 3x3 to 6x6, and the two-column desktop layout. Preserve responsive single-column mobile layout. The adventure map is a 2x2 set of level groups beneath the green board; the guide follows it.

Testing requirement: selecting N starts a fresh baseline at the current number of arrows. N additional arrows unlock Test and One step. Starting a test sets the next baseline. Continuing a paused test is allowed. Any time removes the threshold. Clear resets both the program and baseline to zero. Check these behaviours when modifying code.

Do not deploy or push changes to a live production branch unless the user explicitly requests publication. Make a reviewable local draft first. Never put credentials in source files. This export is independent of the original hosted Site; it is not automatically linked to it.

Run npm run check and npm run build after code changes. Browser-test affected interactions when a browser is available; do not claim browser checks from syntax checks alone.
