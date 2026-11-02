import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const indexPath = path.join(distDir, "index.html");
let html = await readFile(indexPath, "utf8");

const stylesheets = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)];
const scriptMatch = html.match(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/);

if (stylesheets.length === 0 || !scriptMatch) {
  throw new Error("Built CSS or JavaScript asset was not found.");
}

for (const match of stylesheets) {
  const css = await readFile(path.join(distDir, match[1].replace(/^\//, "")), "utf8");
  html = html.replace(match[0], () => `<style>${css}</style>`);
}

const javascript = await readFile(
  path.join(distDir, scriptMatch[1].replace(/^\//, "")),
  "utf8"
);

const inlinedScript = `<script type="module">${javascript.replaceAll("</script>", "<\\/script>")}</script>`;

html = html
  .replace(/<link rel="modulepreload"[^>]*>/g, "")
  .replace(scriptMatch[0], () => inlinedScript);

const manifest = await readFile(path.resolve("public/manifest.webmanifest"), "utf8");
const icon = await readFile(path.resolve("public/favicon.svg"), "utf8");
const serviceWorker = await readFile(path.resolve("public/sw.js"), "utf8");

const workerSource = `const html = ${JSON.stringify(html)};
const manifest = ${JSON.stringify(manifest)};
const icon = ${JSON.stringify(icon)};
const serviceWorker = ${JSON.stringify(serviceWorker)};

export default {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === "/manifest.webmanifest") {
      return new Response(manifest, {
        headers: {
          "content-type": "application/manifest+json; charset=UTF-8",
          "cache-control": "no-cache",
        },
      });
    }
    if (pathname === "/favicon.svg") {
      return new Response(icon, {
        headers: {
          "content-type": "image/svg+xml; charset=UTF-8",
          "cache-control": "no-cache",
        },
      });
    }
    if (pathname === "/sw.js") {
      return new Response(serviceWorker, {
        headers: {
          "content-type": "application/javascript; charset=UTF-8",
          "cache-control": "no-cache",
        },
      });
    }
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
