import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../dist/faq.js", import.meta.url);
const output = await readFile(path, "utf8");

// esbuild removes directives while bundling. Re-add the client boundary after
// bundling so Next.js treats the exported FAQ component as a Client Component.
await writeFile(path, `"use client";\n${output}`);
