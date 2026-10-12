# Puppy Code Quest — local Codex project

Exported from published version 14 on October 12, 2026. This contains the actual game source, including the Clear/counting fixes. The existing name and Justin encouragement are preserved; a broader brand has not yet been selected.

## Quick start on Windows
1. Download the ZIP and use Extract All. Keep the extracted files together.
2. For a quick look, double-click index.html. For dependable local progress saving and development, use the local server below.
3. Install a supported Node.js LTS release if needed. This project requires Node 20 or later.
4. Open the extracted puppy-code-quest-local folder in your Codex-capable coding environment.
5. Open a terminal in that folder and run:

```sh
npm run dev
```

6. Open http://localhost:3000 in your browser. Leave the terminal running. Press Ctrl+C to stop.

There are no third-party packages, so npm install is not required. Voice availability depends on the browser/device. Enable audio with a click in the game.

## Files
- index.html: page structure and controls.
- styles.css: colours, spacing and responsive layout.
- app.js: missions, movement, code editing, audio and game logic.
- AGENTS.md: instructions for Codex, including publish-only-on-request.
- scripts/serve.cjs: local development server.
- scripts/build.cjs: copies public files to dist for hosting.
- CODEX-PROMPT.md: a first message to paste into Codex.

## Check and build
```sh
npm run check
npm run build
```

Deploy only the resulting dist folder. If adding new assets later, update the build script to include them.

## Publishing workflow
This ZIP is a standalone copy. Local edits do NOT update the original ChatGPT Site automatically. The original live website is unchanged by this export.

For your own hosting: create a repository in your own GitHub account, put this project there, and connect it to Cloudflare Pages in your own account. Use no framework preset, build command npm run build, output directory dist, and the project root as the build root. Set the production branch to main. A deployment connection must be configured separately; none is included or activated in this download.

For future updates, ask Codex to edit a draft branch, run checks and preview locally. Review the changes. Say Publish only when ready, then merge/push to the configured production branch. With Git-connected hosting, a push to that branch can automatically publish, so keep unapproved edits off it.

After purchasing your domain, add it to the hosting provider's custom-domain settings and apply the DNS records the provider supplies. Future deployments use that same domain; DNS normally does not need changing each time. Save rollback points in Git.

Progress and settings live in each browser's localStorage. They do not transfer automatically from the old site to localhost or a new domain. No credentials, hosting-account connection, Git history, private account data or server database is included.

## Verification
The HTML/CSS/JavaScript was extracted from the existing source without changing game logic. JavaScript syntax, build output and the existing simulated Clear flow were checked. Browser layout/audio were not verified during export.

## Referenced video
https://www.youtube.com/watch?v=ibMU_E7XzBY
YouTube could not be fetched and the video's transcript was unavailable here. These are general local-project instructions, not a verified reproduction of that video's steps. Share the transcript or screenshots to map them precisely.
