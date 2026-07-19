import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { detectAppDirectory, generateProject } from "../src/cli/generate.js";

describe("initializer", () => {
  it("generates thin App Router adapters, config, webhook, sitemaps, styles layout, and manifest", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "rankworker-init-"));
    await mkdir(path.join(cwd, "src", "app"), { recursive: true });
    expect(await detectAppDirectory(cwd)).toBe("src/app");
    const result = await generateProject({
      cwd,
      appDirectory: "src/app",
      source: "rankworker",
      basePath: "/journal",
      siteUrl: "https://example.com",
      siteName: "Example",
    });
    expect(result.nextConfigCreated).toBe(true);
    expect(result.files).toContain("src/app/journal/[slug]/page.tsx");
    expect(
      await readFile(path.join(cwd, "src/app/api/rankworker/webhook/route.ts"), "utf8"),
    ).toContain("createNextWebhookHandler");
    expect(await readFile(path.join(cwd, "rankworker-blog.ts"), "utf8")).toContain(
      "RANKWORKER_DIRECT_API_KEY",
    );
    expect(
      JSON.parse(await readFile(path.join(cwd, ".rankworker-blog.json"), "utf8")),
    ).toMatchObject({ schemaVersion: 1, basePath: "/journal" });

    const second = await generateProject({
      cwd,
      appDirectory: "src/app",
      source: "rankworker",
      basePath: "/journal",
      siteUrl: "https://example.com",
      siteName: "Example",
    });
    expect(second.skipped.length).toBeGreaterThan(5);
  });

  it("generates local MDX configuration without a webhook", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "rankworker-mdx-init-"));
    expect(await detectAppDirectory(cwd)).toBe("src/app");
    await generateProject({
      cwd,
      appDirectory: "app",
      source: "local-mdx",
      basePath: "/blog",
      siteUrl: "http://localhost:3000",
      siteName: "Local",
      contentDirectory: "posts",
    });
    expect(await readFile(path.join(cwd, "rankworker-blog.ts"), "utf8")).toContain(
      'directory: "posts"',
    );
    await expect(
      readFile(path.join(cwd, "app/api/rankworker/webhook/route.ts"), "utf8"),
    ).rejects.toThrow();
  });

  it("wraps a conventional existing TypeScript Next config", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "rankworker-next-config-"));
    await mkdir(path.join(cwd, "app"), { recursive: true });
    await writeFile(
      path.join(cwd, "next.config.ts"),
      'import type { NextConfig } from "next";\n\nconst nextConfig: NextConfig = {};\n\nexport default nextConfig;\n',
    );

    const result = await generateProject({
      cwd,
      appDirectory: "app",
      source: "local-mdx",
      basePath: "/blog",
      siteUrl: "https://example.com",
      siteName: "Example",
    });

    expect(result.nextConfigUpdated).toBe(true);
    expect(result.nextConfigNeedsManualWrap).toBe(false);
    await expect(readFile(path.join(cwd, "next.config.ts"), "utf8")).resolves.toContain(
      "export default withRankWorkerBlog(nextConfig);",
    );
  });
});
