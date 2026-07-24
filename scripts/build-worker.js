import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const indexPath = path.join(distDir, "index.html");
let html = await readFile(indexPath, "utf8");

const stylesheetMatch = html.match(
  /<link rel="stylesheet" crossorigin href="([^"]+)">/
);
const scriptMatch = html.match(
  /<script type="module" crossorigin src="([^"]+)"><\/script>/
);

if (!stylesheetMatch || !scriptMatch) {
  throw new Error("Built CSS or JavaScript asset was not found.");
}

const css = await readFile(
  path.join(distDir, stylesheetMatch[1].replace(/^\//, "")),
  "utf8"
);
const javascript = await readFile(
  path.join(distDir, scriptMatch[1].replace(/^\//, "")),
  "utf8"
);

html = html
  .replace(stylesheetMatch[0], `<style>${css}</style>`)
  .replace(
    scriptMatch[0],
    `<script type="module">${javascript.replaceAll("</script>", "<\\/script>")}</script>`
  );

const workerSource = `const html = ${JSON.stringify(html)};

export default {
  async fetch() {
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "no-cache",
      },
    });
  },
};
`;

const serverDir = path.join(distDir, "server");
await mkdir(serverDir, { recursive: true });
await writeFile(path.join(serverDir, "index.js"), workerSource, "utf8");
