import { readFile } from "node:fs/promises";

const faqEntry = await readFile(new URL("../dist/faq.js", import.meta.url), "utf8");
const appEntry = await readFile(new URL("../dist/app.js", import.meta.url), "utf8");

if (!faqEntry.includes('"use client";')) {
  throw new Error('The FAQ entry must preserve its "use client" directive.');
}

if (!/from ['"]@rankworker\/nextjs-blog\/faq['"]/.test(appEntry)) {
  throw new Error(
    "The server app entry must reference the separate FAQ client module.",
  );
}

if (appEntry.includes("useState")) {
  throw new Error("The server app entry must not bundle FAQ client hooks.");
}
