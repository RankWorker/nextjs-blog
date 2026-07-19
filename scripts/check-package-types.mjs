import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const directory = await mkdtemp(path.join(tmpdir(), "rankworker-package-"));

try {
  const packed = spawnSync("npm", ["pack", "--pack-destination", directory, "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (packed.status !== 0) process.exit(packed.status ?? 1);

  const result = JSON.parse(packed.stdout);
  const filename = result?.[0]?.filename;
  if (typeof filename !== "string") {
    throw new Error("npm pack did not report a tarball path.");
  }
  const tarball = path.join(directory, filename);

  const checked = spawnSync("attw", [tarball, "--profile", "esm-only"], {
    stdio: "inherit",
  });
  process.exitCode = checked.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
