import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
let count = 0;
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (/\.(js|mjs)$/.test(file)) {
      const result = spawnSync(process.execPath, ["--check", file], {
        stdio: "inherit",
      });
      if (result.status !== 0) process.exit(1);
      count++;
    } else if (entry.name.endsWith(".html")) {
      for (const match of fs
        .readFileSync(file, "utf8")
        .matchAll(/(?:src|href)="([^"]+)"/g)) {
        if (/^(data:|https?:|#|about:)/.test(match[1])) continue;
        if (!fs.existsSync(path.resolve(dir, match[1])))
          throw Error(`Missing asset: ${file} -> ${match[1]}`);
      }
    }
  }
}
visit(root);
console.log(
  `Passed: ${count} JavaScript syntax checks and HTML asset references.`,
);
