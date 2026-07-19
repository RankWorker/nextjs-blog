import { once } from "node:events";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const PACKAGE_NAME = "@rankworker/nextjs-blog";

type NpmInstall = (cwd: string, packageSpec: string) => Promise<void>;

export type EnsureInstalledOptions = {
  cwd: string;
  packageSpec: string;
  install?: NpmInstall;
};

export type EnsureInstalledResult = {
  installed: boolean;
  packageSpec: string;
};

/** Returns the package spec for the CLI package currently being executed. */
export async function currentPackageSpec(): Promise<string> {
  for (const relativePath of ["../package.json", "../../package.json"]) {
    try {
      const manifest = parsePackageManifest(
        await readFile(new URL(relativePath, import.meta.url), "utf8"),
      );
      return `${manifest.name}@${manifest.version}`;
    } catch (error) {
      if (isMissingFile(error)) continue;
      throw error;
    }
  }
  throw new Error("Could not locate the CLI package.json.");
}

/** Installs the library only when the current project does not already list it. */
export async function ensureRankWorkerBlogInstalled(
  options: EnsureInstalledOptions,
): Promise<EnsureInstalledResult> {
  if (await projectListsPackage(options.cwd, PACKAGE_NAME)) {
    return { installed: false, packageSpec: options.packageSpec };
  }

  await (options.install ?? npmInstall)(options.cwd, options.packageSpec);
  return { installed: true, packageSpec: options.packageSpec };
}

async function projectListsPackage(cwd: string, packageName: string): Promise<boolean> {
  let raw: string;
  try {
    raw = await readFile(path.join(cwd, "package.json"), "utf8");
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }

  const manifest = parsePackageManifest(raw);
  return [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ].some((dependencies) => dependencies?.[packageName] !== undefined);
}

async function npmInstall(cwd: string, packageSpec: string): Promise<void> {
  const child = spawn("npm", ["install", packageSpec], {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  const [code, signal] = (await once(child, "exit")) as [number | null, string | null];
  if (code !== 0) {
    throw new Error(
      `npm install failed${signal ? ` with signal ${signal}` : ` with exit code ${code ?? "unknown"}`}.`,
    );
  }
}

type PackageManifest = {
  name: string;
  version: string;
  dependencies: Record<string, string> | undefined;
  devDependencies: Record<string, string> | undefined;
  optionalDependencies: Record<string, string> | undefined;
  peerDependencies: Record<string, string> | undefined;
};

function parsePackageManifest(raw: string): PackageManifest {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new Error("Could not parse package.json.", { cause: error });
  }
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    typeof value.version !== "string"
  ) {
    throw new Error("package.json must contain string name and version fields.");
  }

  return {
    name: value.name,
    version: value.version,
    dependencies: dependencyMap(value.dependencies),
    devDependencies: dependencyMap(value.devDependencies),
    optionalDependencies: dependencyMap(value.optionalDependencies),
    peerDependencies: dependencyMap(value.peerDependencies),
  };
}

function dependencyMap(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return isRecord(error) && error.code === "ENOENT";
}
