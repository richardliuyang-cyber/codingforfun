import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
};
const port = Number(process.env.PORT || 3000);
http
  .createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      let file = path.resolve(root, "." + urlPath);
      if (file !== path.resolve(root) && !file.startsWith(root)) {
        res.writeHead(403).end();
        return;
      }
      if ((await fs.stat(file)).isDirectory())
        file = path.join(file, "index.html");
      const data = await fs.readFile(file);
      res.writeHead(200, {
        "Content-Type":
          (types[path.extname(file)] || "application/octet-stream") +
          "; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(data);
    } catch {
      res.writeHead(404).end("File not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(
      `FunCoding preview: http://localhost:${port}\nPress Ctrl+C to stop.`,
    ),
  );
