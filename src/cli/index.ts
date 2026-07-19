#!/usr/bin/env node
import { parseArgs } from "node:util";

import * as p from "@clack/prompts";
import pc from "picocolors";

import { detectAppDirectory, generateProject } from "./generate.js";
import { currentPackageSpec, ensureRankWorkerBlogInstalled } from "./install.js";

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      source: { type: "string" },
      "base-path": { type: "string" },
      "site-url": { type: "string" },
      "site-name": { type: "string" },
      "content-directory": { type: "string" },
      yes: { type: "boolean", short: "y" },
      force: { type: "boolean" },
      "skip-install": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help || (positionals[0] && positionals[0] !== "init")) {
    printHelp();
    return;
  }

  const cwd = process.cwd();
  p.intro(pc.bgGreen(pc.black(" RankWorker Next.js Blog ")));
  const source = await valueOrPrompt(values.source, values.yes, "rankworker", () =>
    p.select({
      message: "Where should articles come from?",
      options: [
        { value: "rankworker", label: "RankWorker Direct API", hint: "webhook + ISR" },
        { value: "local-mdx", label: "Local MDX files" },
      ],
    }),
  );
  if (source !== "rankworker" && source !== "local-mdx")
    throw new Error("--source must be rankworker or local-mdx");
  const basePath = await valueOrPrompt(values["base-path"], values.yes, "/blog", () =>
    p.text({ message: "Blog URL path", initialValue: "/blog" }),
  );
  const siteUrl = await valueOrPrompt(
    values["site-url"],
    values.yes,
    "http://localhost:3000",
    () =>
      p.text({
        message: "Canonical site URL",
        placeholder: "https://example.com",
        validate: (value) => (value ? undefined : "Required"),
      }),
  );
  const siteName = await valueOrPrompt(
    values["site-name"],
    values.yes,
    "My Website",
    () =>
      p.text({
        message: "Site name",
        validate: (value) => (value ? undefined : "Required"),
      }),
  );
  const appDirectory = await detectAppDirectory(cwd);
  if (!values["skip-install"]) {
    const installation = await ensureRankWorkerBlogInstalled({
      cwd,
      packageSpec: await currentPackageSpec(),
    });
    if (installation.installed) p.log.step(`Installed ${installation.packageSpec}.`);
  }
  const result = await generateProject({
    cwd,
    appDirectory,
    source,
    basePath,
    siteUrl,
    siteName,
    ...(values["content-directory"] === undefined
      ? {}
      : { contentDirectory: values["content-directory"] }),
    ...(values.force === undefined ? {} : { force: values.force }),
  });

  if (result.skipped.length > 0)
    p.log.warn(
      `Kept ${result.skipped.length} existing file(s). Use --force to replace them.`,
    );
  const environment =
    source === "rankworker"
      ? "Set RANKWORKER_DIRECT_API_KEY and RANKWORKER_WEBHOOK_SECRET in your environment."
      : `Add RankWorker-exported MDX files to ${values["content-directory"] ?? "content/blog"}.`;
  p.note(
    `${result.files.length} files created or updated in ${appDirectory}.\n${environment}${result.nextConfigNeedsManualWrap ? "\nCould not safely update the existing Next config. Wrap it with withRankWorkerBlog()." : ""}`,
    "Ready",
  );
  p.outro(`Start Next.js and visit ${pc.cyan(basePath)}.`);
}

async function valueOrPrompt<T>(
  supplied: T | undefined,
  yes: boolean | undefined,
  fallback: T,
  prompt: () => Promise<T | symbol>,
): Promise<T> {
  if (supplied !== undefined) return supplied;
  if (yes) return fallback;
  const value = await prompt();
  if (p.isCancel(value)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
  return value;
}

function printHelp() {
  console.log(
    `rankworker-blog init [options]\n\n  --source <rankworker|local-mdx>\n  --base-path <path>\n  --site-url <url>\n  --site-name <name>\n  --content-directory <path>\n  --skip-install\n  -y, --yes\n  --force`,
  );
}

main().catch((error: unknown) => {
  p.log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
