import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";
import packageMetadata from "../package.json" with { type: "json" };

const { once, spawn } = vi.hoisted(() => ({
  once: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock("node:child_process", () => ({ spawn }));
vi.mock("node:events", () => ({ once }));

import {
  currentPackageSpec,
  ensureRankWorkerBlogInstalled,
} from "../src/cli/install.js";

describe("CLI dependency installation", () => {
  it("uses the executing package version for self-installation", async () => {
    await expect(currentPackageSpec()).resolves.toBe(
      `${packageMetadata.name}@${packageMetadata.version}`,
    );
  });

  it("installs the executing package when the project does not list it", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "rankworker-install-"));
    await writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify({ name: "consumer", version: "1.0.0" }),
    );
    const install = vi.fn().mockResolvedValue(undefined);

    const result = await ensureRankWorkerBlogInstalled({
      cwd,
      packageSpec: "@rankworker/nextjs-blog@1.2.3",
      install,
    });

    expect(result).toEqual({
      installed: true,
      packageSpec: "@rankworker/nextjs-blog@1.2.3",
    });
    expect(install).toHaveBeenCalledWith(cwd, "@rankworker/nextjs-blog@1.2.3");
  });

  it("does not alter a project that already lists the library", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "rankworker-installed-"));
    await writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify({
        name: "consumer",
        version: "1.0.0",
        devDependencies: { "@rankworker/nextjs-blog": "^1.0.0" },
      }),
    );
    const install = vi.fn().mockResolvedValue(undefined);

    const result = await ensureRankWorkerBlogInstalled({
      cwd,
      packageSpec: "@rankworker/nextjs-blog@1.2.3",
      install,
    });

    expect(result.installed).toBe(false);
    expect(install).not.toHaveBeenCalled();
  });

  it("installs when the project does not yet have a package manifest", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "rankworker-no-manifest-"));
    const install = vi.fn().mockResolvedValue(undefined);

    await ensureRankWorkerBlogInstalled({
      cwd,
      packageSpec: "@rankworker/nextjs-blog@1.2.3",
      install,
    });

    expect(install).toHaveBeenCalledOnce();
  });

  it("uses npm to install a missing dependency", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "rankworker-npm-install-"));
    spawn.mockReturnValue({});
    once.mockResolvedValue([0, null]);

    await ensureRankWorkerBlogInstalled({
      cwd,
      packageSpec: "@rankworker/nextjs-blog@1.2.3",
    });

    expect(spawn).toHaveBeenCalledWith(
      "npm",
      ["install", "@rankworker/nextjs-blog@1.2.3"],
      expect.objectContaining({ cwd, stdio: "inherit" }),
    );
  });

  it("reports npm failures with the process result", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "rankworker-npm-error-"));
    spawn.mockReturnValue({});
    once.mockResolvedValue([1, null]);

    await expect(
      ensureRankWorkerBlogInstalled({
        cwd,
        packageSpec: "@rankworker/nextjs-blog@1.2.3",
      }),
    ).rejects.toThrow("npm install failed with exit code 1");

    once.mockResolvedValue([null, "SIGTERM"]);
    await expect(
      ensureRankWorkerBlogInstalled({
        cwd,
        packageSpec: "@rankworker/nextjs-blog@1.2.3",
      }),
    ).rejects.toThrow("npm install failed with signal SIGTERM");
  });

  it("fails clearly for an invalid project manifest", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "rankworker-invalid-manifest-"));
    await writeFile(path.join(cwd, "package.json"), "not-json");

    await expect(
      ensureRankWorkerBlogInstalled({
        cwd,
        packageSpec: "@rankworker/nextjs-blog@1.2.3",
        install: vi.fn(),
      }),
    ).rejects.toThrow("Could not parse package.json");
  });
});
