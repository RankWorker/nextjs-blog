import { rm } from "node:fs/promises";

await Promise.all(
  ["dist", "coverage"].map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ),
);
