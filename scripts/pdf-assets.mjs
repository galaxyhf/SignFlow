import { cp, mkdir } from "node:fs/promises";
const source = new URL("../node_modules/pdfjs-dist/", import.meta.url),
  destination = new URL("../apps/web/public/", import.meta.url);
await mkdir(destination, { recursive: true });
await cp(
  new URL("build/pdf.worker.min.mjs", source),
  new URL("pdf.worker.min.mjs", destination),
);
for (const [from, to] of [
  ["standard_fonts", "pdf-fonts"],
  ["wasm", "pdf-wasm"],
])
  await cp(new URL(from, source), new URL(to, destination), {
    recursive: true,
  });
