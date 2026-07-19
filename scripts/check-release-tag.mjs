import { readFile } from "node:fs/promises";

const manifest = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const expectedTag = `v${manifest.version}`;
const actualTag = process.env.RELEASE_TAG;

if (actualTag !== expectedTag) {
  throw new Error(
    `Release tag ${JSON.stringify(actualTag)} does not match package version ${JSON.stringify(expectedTag)}.`,
  );
}
