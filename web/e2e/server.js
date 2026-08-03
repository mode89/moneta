// Serves the app for the end-to-end tests the way `just build-web` lays it out:
// the same URL names, so `index.html`'s import map resolves exactly as it does
// on the device. `just serve` cannot be used here because it serves the
// *built* assets, which need a build to exist.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODULES = join(WEB_DIR, "node_modules");
const ICONS = join(MODULES, "@material-design-icons/svg/outlined");

// Mirrors the copy list in the `build-web` recipe; keep the two in step.
const FILES = {
  "/index.html": join(WEB_DIR, "index.html"),
  "/main.js": join(WEB_DIR, "main.js"),
  "/bootstrap.css": join(MODULES, "bootstrap/dist/css/bootstrap.css"),
  "/solid.js": join(MODULES, "solid-js/dist/solid.js"),
  "/solid-web.js": join(MODULES, "solid-js/web/dist/web.js"),
  "/solid-store.js": join(MODULES, "solid-js/store/dist/store.js"),
  "/solid-html.js": join(MODULES, "solid-js/html/dist/html.js"),
  "/solid-transition-group.js": join(MODULES, "solid-transition-group/dist/index.js"),
  "/sp-transition-group.js": join(MODULES, "@solid-primitives/transition-group/dist/index.js"),
  "/sp-refs.js": join(MODULES, "@solid-primitives/refs/dist/index.js"),
  "/sp-utils.js": join(MODULES, "@solid-primitives/utils/dist/index.js"),
  "/types.js": join(MODULES, "@solid-primitives/utils/dist/types.js"),
  "/file_download.svg": join(ICONS, "file_download.svg"),
  "/file_upload.svg": join(ICONS, "file_upload.svg"),
};

const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

// `just build-web` substitutes the commit date and hash; the tests only need the
// placeholder gone and a value they can assert on.
export const VERSION = "e2e-test-build";

const server = createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  const file = FILES[path === "/" ? "/index.html" : path];
  if (!file) {
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("Not found: " + path);
    return;
  }
  try {
    let body = await readFile(file);
    if (file.endsWith("index.html"))
      body = body.toString().replaceAll("%VERSION%", VERSION);
    response.writeHead(200, {
      "content-type": TYPES[extname(file)] ?? "application/octet-stream",
      // Every test navigation must see the file on disk, never a cached copy.
      "cache-control": "no-store",
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain" });
    response.end(String(error));
  }
});

// The specs import `VERSION` from here, so only listen when run as a program.
if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? process.env.PORT ?? 8099);
  server.listen(port, "127.0.0.1", () => {
    console.log("moneta e2e server on http://127.0.0.1:" + port);
  });
}
